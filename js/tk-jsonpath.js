/* WooaDev Tool Kit — JSONPath 평가기 (RFC 9535 + Goessner 확장 일부, eval 미사용) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var JP = TK.jsonpath = TK.jsonpath || {};
  var t = function (a, b) { return TK.t(a, b); };

  function err(msg, pos) { var e = new Error(msg + (pos != null ? ' (' + t('위치 ', 'at ') + (pos + 1) + ')' : '')); e.pos = pos; return e; }
  var NAME = /^[\w$\u0080-￿][\w$\u0080-￿-]*/;

  function readString(s, i) {
    var q = s[i], out = '', j = i + 1;
    while (j < s.length) {
      var c = s[j];
      if (c === '\\') {
        var e = s[j + 1];
        if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(s.substr(j + 2, 4))) { out += String.fromCharCode(parseInt(s.substr(j + 2, 4), 16)); j += 6; continue; }
        var map = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
        out += map[e] != null ? map[e] : e; j += 2; continue;
      }
      if (c === q) return { v: out, end: j + 1 };
      out += c; j++;
    }
    throw err(t('문자열이 닫히지 않았습니다', 'Unterminated string'), i);
  }

  /** 세그먼트 목록 파싱. s[i] 부터 시작해 더 이어질 수 없는 지점에서 멈춘다. */
  function parseSegments(s, i, inFilter) {
    var segs = [];
    while (i < s.length) {
      var c = s[i], desc = false;
      if (c === '.' && s[i + 1] === '.') { desc = true; i += 2; c = s[i]; if (c === undefined) throw err(t('".." 뒤에 이름이 필요합니다', 'A name is required after ".."'), i); }
      else if (c === '.') { i++; c = s[i]; }
      else if (c !== '[') break;
      if (c === '*') { segs.push({ desc: desc, sel: [{ k: 'wild' }] }); i++; continue; }
      if (c === '[') {
        var r = parseBracket(s, i);
        segs.push({ desc: desc, sel: r.sel }); i = r.end; continue;
      }
      var m = NAME.exec(s.slice(i));
      if (!m) throw err(t('이름이 올바르지 않습니다', 'Invalid member name'), i);
      segs.push({ desc: desc, sel: [{ k: 'name', v: m[0] }] }); i += m[0].length;
    }
    return { segs: segs, end: i };
  }

  function parseBracket(s, i) {
    // s[i] === '['
    var j = i + 1, depthP = 0, depthB = 1, q = null;
    for (; j < s.length; j++) {
      var c = s[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '[') depthB++;
      else if (c === ']') { depthB--; if (!depthB) break; }
    }
    if (depthB) throw err(t('대괄호가 닫히지 않았습니다', 'Unclosed bracket'), i);
    var body = s.slice(i + 1, j), sel = [], parts = splitTop(body);
    parts.forEach(function (p) {
      var x = p.trim();
      if (x === '*') sel.push({ k: 'wild' });
      else if (x[0] === '?') {
        var ex = x.slice(1).trim();
        sel.push({ k: 'filter', e: parseExpr(ex) });
      } else if (x[0] === '(') {
        throw err(t('스크립트 표현식 [(...)]은 지원하지 않습니다 (필터 [?(...)]를 사용하세요)', 'Script expressions [(...)] are not supported (use a filter [?(...)])'), i);
      } else if (x[0] === '"' || x[0] === "'") {
        var st = readString(x, 0);
        if (st.end !== x.length) throw err(t('대괄호 안 문자열이 올바르지 않습니다', 'Invalid string in brackets'), i);
        sel.push({ k: 'name', v: st.v });
      } else if (/^-?\d+$/.test(x)) sel.push({ k: 'index', v: parseInt(x, 10) });
      else if (/^(-?\d*)\s*:\s*(-?\d*)\s*(:\s*(-?\d*))?$/.test(x)) {
        var mm = /^(-?\d*)\s*:\s*(-?\d*)\s*(?::\s*(-?\d*))?$/.exec(x);
        sel.push({ k: 'slice', a: mm[1] === '' ? null : parseInt(mm[1], 10), b: mm[2] === '' ? null : parseInt(mm[2], 10), c: mm[3] == null || mm[3] === '' ? 1 : parseInt(mm[3], 10) });
      } else if (NAME.test(x) && NAME.exec(x)[0] === x) sel.push({ k: 'name', v: x });
      else throw err(t('해석할 수 없는 선택자: ' + x, 'Unrecognized selector: ' + x), i);
    });
    if (!sel.length) throw err(t('대괄호가 비어 있습니다', 'Empty brackets'), i);
    return { sel: sel, end: j + 1 };
  }

  function splitTop(body) {
    var parts = [], cur = '', depth = 0, q = null;
    for (var i = 0; i < body.length; i++) {
      var c = body[i];
      if (q) { cur += c; if (c === '\\') { cur += body[++i] || ''; } else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }

  /* ── 필터 표현식 ── */
  function parseExpr(src) {
    var s = src, i = 0;
    function ws() { while (i < s.length && /\s/.test(s[i])) i++; }
    function peek(str) { ws(); return s.substr(i, str.length) === str; }
    function eat(str) { if (peek(str)) { i += str.length; return true; } return false; }
    function or() { var l = and(); while (eat('||')) l = { op: '||', l: l, r: and() }; return l; }
    function and() { var l = not(); while (eat('&&')) l = { op: '&&', l: l, r: not() }; return l; }
    function not() {
      ws();
      if (s[i] === '!' && s[i + 1] !== '=') { i++; return { op: '!', e: not() }; }
      return cmp();
    }
    function cmp() {
      var l = prim(); ws();
      var ops = ['===', '!==', '==', '!=', '<=', '>=', '=~', '<', '>'];
      for (var k = 0; k < ops.length; k++) if (peek(ops[k])) {
        i += ops[k].length;
        var r = prim();
        return { op: ops[k] === '===' ? '==' : ops[k] === '!==' ? '!=' : ops[k], l: l, r: r };
      }
      return l;
    }
    function prim() {
      ws();
      var c = s[i];
      if (c === undefined) throw err(t('필터 식이 끝났습니다', 'Filter expression ended unexpectedly'), i);
      if (c === '(') { i++; var e = or(); ws(); if (s[i] !== ')') throw err(t('괄호가 닫히지 않았습니다', 'Unclosed parenthesis'), i); i++; return e; }
      if (c === '"' || c === "'") { var r = readString(s, i); i = r.end; return { lit: r.v }; }
      if (c === '/') {
        var j = i + 1; while (j < s.length && s[j] !== '/') { if (s[j] === '\\') j++; j++; }
        var body = s.slice(i + 1, j), fl = /^[gimsuy]*/.exec(s.slice(j + 1))[0];
        i = j + 1 + fl.length;
        try { return { lit: new RegExp(body, fl) }; } catch (e2) { throw err(t('정규식이 올바르지 않습니다', 'Invalid regular expression'), i); }
      }
      var m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i));
      if (m) { i += m[0].length; return { lit: Number(m[0]) }; }
      if (c === '@' || c === '$') {
        var sg = parseSegments(s, i + 1, true); i = sg.end;
        return { path: sg.segs, abs: c === '$' };
      }
      m = /^[A-Za-z_]\w*/.exec(s.slice(i));
      if (m) {
        if (m[0] === 'true') { i += 4; return { lit: true }; }
        if (m[0] === 'false') { i += 5; return { lit: false }; }
        if (m[0] === 'null') { i += 4; return { lit: null }; }
        i += m[0].length; ws();
        if (s[i] === '(') {
          i++; var args = []; ws();
          if (s[i] !== ')') { do { args.push(or()); } while (eat(',')); }
          ws(); if (s[i] !== ')') throw err(t('함수 호출 괄호가 닫히지 않았습니다', 'Unclosed function call'), i); i++;
          return { fn: m[0], args: args };
        }
        throw err(t('알 수 없는 식별자: ' + m[0], 'Unknown identifier: ' + m[0]), i);
      }
      throw err(t("필터 식에서 예상치 못한 문자 '" + c + "'", "Unexpected character '" + c + "' in filter"), i);
    }
    var tree = or(); ws();
    if (i < s.length) throw err(t("필터 식 끝에 불필요한 '" + s.slice(i) + "'", "Unexpected '" + s.slice(i) + "' at end of filter"), i);
    return tree;
  }

  var NOTHING = { nothing: true };
  function nodesOf(segs, start, root) { return select(segs, [start], root); }

  function evalExpr(e, cur, root) {
    if (e.lit !== undefined || ('lit' in e)) return e.lit;
    if (e.path) {
      var ns = nodesOf(e.path, e.abs ? { p: [], v: root } : cur, root);
      return { nodes: ns };
    }
    if (e.fn) return callFn(e, cur, root);
    if (e.op === '||') return truthy(evalExpr(e.l, cur, root)) || truthy(evalExpr(e.r, cur, root));
    if (e.op === '&&') return truthy(evalExpr(e.l, cur, root)) && truthy(evalExpr(e.r, cur, root));
    if (e.op === '!') return !truthy(evalExpr(e.e, cur, root));
    var a = scalar(evalExpr(e.l, cur, root)), b = scalar(evalExpr(e.r, cur, root));
    switch (e.op) {
      case '==': return a === NOTHING || b === NOTHING ? a === b : TK.json.eq(a, b);
      case '!=': return !(a === NOTHING || b === NOTHING ? a === b : TK.json.eq(a, b));
      case '<': return cmpv(a, b, function (x, y) { return x < y; });
      case '<=': return cmpv(a, b, function (x, y) { return x <= y; }) || (a !== NOTHING && b !== NOTHING && TK.json.eq(a, b));
      case '>': return cmpv(a, b, function (x, y) { return x > y; });
      case '>=': return cmpv(a, b, function (x, y) { return x >= y; }) || (a !== NOTHING && b !== NOTHING && TK.json.eq(a, b));
      case '=~': return b instanceof RegExp && typeof a === 'string' && b.test(a);
    }
    return false;
  }
  function cmpv(a, b, f) {
    if (a === NOTHING || b === NOTHING) return false;
    if (typeof a === typeof b && (typeof a === 'number' || typeof a === 'string')) return f(a, b);
    return false;
  }
  function scalar(x) {
    if (x && x.nodes) return x.nodes.length === 1 ? x.nodes[0].v : NOTHING;
    return x;
  }
  function truthy(x) {
    if (x && x.nodes) return x.nodes.length > 0;
    return x === true || (x !== false && x !== null && x !== undefined && x !== NOTHING && x !== 0 && x !== '');
  }
  function callFn(e, cur, root) {
    var a = e.args.map(function (x) { return evalExpr(x, cur, root); });
    switch (e.fn) {
      case 'length': { var v = scalar(a[0]); return typeof v === 'string' ? Array.from(v).length : Array.isArray(v) ? v.length : v && typeof v === 'object' && v !== NOTHING ? Object.keys(v).length : NOTHING; }
      case 'count': return a[0] && a[0].nodes ? a[0].nodes.length : NOTHING;
      case 'value': return scalar(a[0]);
      case 'match': case 'search': {
        var s = scalar(a[0]), re = scalar(a[1]);
        if (typeof s !== 'string') return false;
        try {
          var rx = re instanceof RegExp ? re : new RegExp(e.fn === 'match' ? '^(?:' + re + ')$' : String(re));
          if (re instanceof RegExp && e.fn === 'match') rx = new RegExp('^(?:' + re.source + ')$', re.flags);
          return rx.test(s);
        } catch (x) { return false; }
      }
      default: throw err(t('지원하지 않는 함수: ' + e.fn, 'Unsupported function: ' + e.fn));
    }
  }

  function children(n) {
    var v = n.v, out = [];
    if (Array.isArray(v)) v.forEach(function (x, i) { out.push({ p: n.p.concat([i]), v: x }); });
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { out.push({ p: n.p.concat([k]), v: v[k] }); });
    return out;
  }
  function applySel(sel, n, root, out) {
    var v = n.v;
    switch (sel.k) {
      case 'name':
        if (v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, sel.v)) out.push({ p: n.p.concat([sel.v]), v: v[sel.v] });
        else if (sel.v === 'length' && (Array.isArray(v) || typeof v === 'string')) out.push({ p: n.p.concat(['length']), v: v.length });
        break;
      case 'index':
        if (Array.isArray(v)) { var ix = sel.v < 0 ? v.length + sel.v : sel.v; if (ix >= 0 && ix < v.length) out.push({ p: n.p.concat([ix]), v: v[ix] }); }
        break;
      case 'wild': children(n).forEach(function (c) { out.push(c); }); break;
      case 'slice':
        if (Array.isArray(v)) {
          var len = v.length, step = sel.c || 1, lo, hi;
          var norm = function (x, d) { if (x == null) return d; return x < 0 ? Math.max(len + x, 0) : Math.min(x, len); };
          if (step > 0) { lo = norm(sel.a, 0); hi = norm(sel.b, len); for (var i = lo; i < hi; i += step) out.push({ p: n.p.concat([i]), v: v[i] }); }
          else { lo = sel.a == null ? len - 1 : (sel.a < 0 ? Math.max(len + sel.a, -1) : Math.min(sel.a, len - 1)); hi = sel.b == null ? -1 : (sel.b < 0 ? Math.max(len + sel.b, -1) : Math.min(sel.b, len - 1)); for (var k = lo; k > hi; k += step) out.push({ p: n.p.concat([k]), v: v[k] }); }
        }
        break;
      case 'filter':
        children(n).forEach(function (c) { if (truthy(evalExpr(sel.e, c, root))) out.push(c); });
        break;
    }
  }
  function descendants(n, out) { out.push(n); children(n).forEach(function (c) { descendants(c, out); }); }

  function select(segs, nodes, root) {
    segs.forEach(function (seg) {
      var next = [];
      nodes.forEach(function (n) {
        var targets = [];
        if (seg.desc) descendants(n, targets); else targets.push(n);
        targets.forEach(function (tn) { seg.sel.forEach(function (sl) { applySel(sl, tn, root, next); }); });
      });
      nodes = next;
    });
    return nodes;
  }

  JP.parse = function (expr) {
    var s = String(expr).trim();
    if (!s) throw err(t('JSONPath 식이 비어 있습니다', 'The JSONPath expression is empty'));
    if (s[0] !== '$' && s[0] !== '@') s = (s[0] === '[' ? '$' : '$.') + s;
    var r = parseSegments(s, 1);
    if (r.end < s.length) throw err(t("해석할 수 없는 부분: '" + s.slice(r.end) + "'", "Cannot parse: '" + s.slice(r.end) + "'"), r.end);
    return r.segs;
  };
  /** 반환: [{p:[경로 부분], v:값}] */
  JP.query = function (data, expr) {
    var segs = JP.parse(expr);
    return select(segs, [{ p: [], v: data }], data);
  };
  /** 정규화 경로: $['a'][0] */
  JP.normalPath = function (parts) {
    return '$' + parts.map(function (p) { return typeof p === 'number' ? '[' + p + ']' : "['" + String(p).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "']"; }).join('');
  };
})(typeof window !== 'undefined' ? window : globalThis);
