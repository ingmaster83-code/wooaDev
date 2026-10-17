/* WooaDev Tool Kit — jq 언어 해석기 (파서 + 제너레이터 기반 평가기). jq 1.7 의 대부분을 구현 */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var Q = TK.jq = TK.jq || {};
  var t = function (a, b) { return TK.t(a, b); };

  function JQError(val) { this.val = val; }
  function BreakErr(label) { this.label = label; }
  Q.JQError = JQError;

  /* ---------------------------------------------------------------- 값 유틸 */
  function typeOf(v) { if (v === null) return 'null'; var ty = typeof v; if (ty === 'boolean') return 'boolean'; if (ty === 'number') return 'number'; if (ty === 'string') return 'string'; return Array.isArray(v) ? 'array' : 'object'; }
  var ORDER = { null: 0, boolean: 1, number: 3, string: 4, array: 5, object: 6 };
  function numStr(n) { if (n !== n) return 'null'; if (n === Infinity) return '1.7976931348623157e+308'; if (n === -Infinity) return '-1.7976931348623157e+308'; return String(n); }
  function toJson(v, indent, sortKeys) {
    var ind = indent === undefined ? null : indent;
    function ser(x, lvl) {
      if (x === null) return 'null';
      var ty = typeof x;
      if (ty === 'boolean') return x ? 'true' : 'false';
      if (ty === 'number') return numStr(x);
      if (ty === 'string') return JSON.stringify(x).replace(/\u007f/g, '\\u007f');
      var pad = ind === null ? '' : '\n' + new Array(lvl + 2).join(ind), end = ind === null ? '' : '\n' + new Array(lvl + 1).join(ind), sep = ind === null ? ':' : ': ';
      if (Array.isArray(x)) return x.length ? '[' + pad + x.map(function (e) { return ser(e, lvl + 1); }).join(',' + pad) + end + ']' : '[]';
      var ks = Object.keys(x); if (sortKeys) ks.sort(cmpStr);
      return ks.length ? '{' + pad + ks.map(function (k) { return JSON.stringify(k) + sep + ser(x[k], lvl + 1); }).join(',' + pad) + end + '}' : '{}';
    }
    return ser(v, 0);
  }
  function cmpStr(a, b) { var A = Array.from(a), B = Array.from(b), n = Math.min(A.length, B.length); for (var i = 0; i < n; i++) { var x = A[i].codePointAt(0), y = B[i].codePointAt(0); if (x !== y) return x < y ? -1 : 1; } return A.length - B.length < 0 ? -1 : A.length > B.length ? 1 : 0; }
  function cmp(a, b) {
    var ta = typeOf(a), tb = typeOf(b);
    if (ta === 'boolean') ta = 'boolean'; var oa = ta === 'boolean' ? (a ? 2 : 1) : ORDER[ta], ob = tb === 'boolean' ? (b ? 2 : 1) : ORDER[tb];
    if (oa !== ob) return oa < ob ? -1 : 1;
    switch (ta) {
      case 'number': if (a !== a) return -1; if (b !== b) return 1; return a < b ? -1 : a > b ? 1 : 0;
      case 'string': return cmpStr(a, b);
      case 'array': { var n = Math.min(a.length, b.length); for (var i = 0; i < n; i++) { var c = cmp(a[i], b[i]); if (c) return c; } return a.length < b.length ? -1 : a.length > b.length ? 1 : 0; }
      case 'object': { var ka = Object.keys(a).sort(cmpStr), kb = Object.keys(b).sort(cmpStr), c2 = cmp(ka, kb); if (c2) return c2; for (var j = 0; j < ka.length; j++) { var c3 = cmp(a[ka[j]], b[ka[j]]); if (c3) return c3; } return 0; }
      default: return 0;
    }
  }
  function eq(a, b) { return cmp(a, b) === 0; }
  function trunc(v) { var s = toJson(v); return s.length > 11 ? s.slice(0, 10) + '...' : s; }
  function err(msg) { return new JQError(msg); }
  function truthy(v) { return v !== null && v !== false; }
  function clone(v) { return v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function add(a, b) {
    if (a === null) return b; if (b === null) return a;
    var ta = typeOf(a), tb = typeOf(b);
    if (ta === 'number' && tb === 'number') return a + b;
    if (ta === 'string' && tb === 'string') return a + b;
    if (ta === 'array' && tb === 'array') return a.concat(b);
    if (ta === 'object' && tb === 'object') { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b).forEach(function (k) { o[k] = b[k]; }); return o; }
    throw err(ta + ' (' + trunc(a) + ') and ' + tb + ' (' + trunc(b) + ') cannot be added');
  }
  function sub(a, b) {
    var ta = typeOf(a), tb = typeOf(b);
    if (ta === 'number' && tb === 'number') return a - b;
    if (ta === 'array' && tb === 'array') return a.filter(function (x) { return !b.some(function (y) { return eq(x, y); }); });
    throw err(ta + ' (' + trunc(a) + ') and ' + tb + ' (' + trunc(b) + ') cannot be subtracted');
  }
  function deepMerge(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b).forEach(function (k) { o[k] = isObj(o[k]) && isObj(b[k]) ? deepMerge(o[k], b[k]) : b[k]; }); return o; }
  function mul(a, b) {
    var ta = typeOf(a), tb = typeOf(b);
    if (ta === 'number' && tb === 'number') return a * b;
    if ((ta === 'string' && tb === 'number') || (ta === 'number' && tb === 'string')) { var s = ta === 'string' ? a : b, n = ta === 'string' ? b : a; if (n <= 0) return null; var cnt = n < 1 ? 1 : Math.floor(n); if (s.length * cnt > 1e7) throw err('Repeat string result too long'); return new Array(cnt + 1).join(s); }
    if (ta === 'object' && tb === 'object') return deepMerge(a, b);
    throw err(ta + ' (' + trunc(a) + ') and ' + tb + ' (' + trunc(b) + ') cannot be multiplied');
  }
  function div(a, b) {
    var ta = typeOf(a), tb = typeOf(b);
    if (ta === 'number' && tb === 'number') { if (b === 0) throw err(ta + ' (' + trunc(a) + ') and ' + tb + ' (' + trunc(b) + ') cannot be divided because the divisor is zero'); return a / b; }
    if (ta === 'string' && tb === 'string') return splitStr(a, b);
    throw err(ta + ' (' + trunc(a) + ') and ' + tb + ' (' + trunc(b) + ') cannot be divided');
  }
  function mod(a, b) {
    var ta = typeOf(a), tb = typeOf(b);
    if (ta === 'number' && tb === 'number') { var x = Math.trunc(a), y = Math.trunc(b); if (y === 0) throw err(ta + ' (' + trunc(a) + ') and ' + tb + ' (' + trunc(b) + ') cannot be divided because the divisor is zero'); var r = Math.abs(x) % Math.abs(y); return x < 0 ? -r : r; }
    throw err(ta + ' (' + trunc(a) + ') and ' + tb + ' (' + trunc(b) + ') cannot be divided');
  }
  function splitStr(a, sep) { if (a === '') return []; if (sep === '') return Array.from(a); return a.split(sep); }

  /* ---------------------------------------------------------------- 렉서 */
  var KEYWORDS = { def: 1, 'if': 1, then: 1, elif: 1, 'else': 1, end: 1, as: 1, reduce: 1, foreach: 1, 'try': 1, 'catch': 1, label: 1, import: 1, include: 1, and: 1, or: 1, __loc__: 1 };
  function lex(src) {
    var toks = [], i = 0, n = src.length;
    function readString(start) {
      var j = start + 1, parts = [], cur = '';
      while (j < n) {
        var c = src[j];
        if (c === '"') { parts.push(cur); return { parts: parts, end: j + 1 }; }
        if (c === '\\') {
          var d = src[j + 1];
          if (d === '(') {
            var depth = 1, k = j + 2;
            while (k < n && depth) { var ch = src[k]; if (ch === '"') { var inner = readString(k); k = inner.end; continue; } if (ch === '(') depth++; else if (ch === ')') depth--; k++; }
            if (depth) throw err('syntax error: unterminated string interpolation');
            parts.push(cur); cur = ''; parts.push({ src: src.slice(j + 2, k - 1) }); j = k; continue;
          }
          var map = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '/': '/', '\\': '\\', '"': '"' };
          if (map[d] !== undefined) { cur += map[d]; j += 2; continue; }
          if (d === 'u') { var hx = src.slice(j + 2, j + 6); if (!/^[0-9a-fA-F]{4}$/.test(hx)) throw err('syntax error: invalid \\u escape'); cur += String.fromCharCode(parseInt(hx, 16)); j += 6; continue; }
          throw err('syntax error: invalid escape \\' + d);
        }
        cur += c; j++;
      }
      throw err('syntax error: unterminated string literal');
    }
    while (i < n) {
      var c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '"') { var s = readString(i); toks.push({ t: 'str', parts: s.parts }); i = s.end; continue; }
      var m;
      if ((m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i)))) { toks.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if (c === '.' && src[i + 1] === '.') { toks.push({ t: 'op', v: '..' }); i += 2; continue; }
      if (c === '.' && (m = /^\.([A-Za-z_][A-Za-z0-9_]*)/.exec(src.slice(i)))) { toks.push({ t: 'field', v: m[1] }); i += m[0].length; continue; }
      if (c === '$' && (m = /^\$(__loc__|[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)/.exec(src.slice(i)))) { toks.push({ t: 'var', v: m[1] }); i += m[0].length; continue; }
      if (c === '@' && (m = /^@[A-Za-z0-9_]+/.exec(src.slice(i)))) { toks.push({ t: 'fmt', v: m[0] }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i)))) { toks.push({ t: KEYWORDS[m[0]] ? 'kw' : 'id', v: m[0] }); i += m[0].length; continue; }
      var three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === '?//' || three === '//=') { toks.push({ t: 'op', v: three }); i += 3; continue; }
      if (['|=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '//'].indexOf(two) >= 0) { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('.[](){}|,:;=<>+-*/%?$'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c }); i++; continue; }
      throw err('syntax error: unexpected character ' + JSON.stringify(c));
    }
    toks.push({ t: 'eof' });
    return toks;
  }

  /* ---------------------------------------------------------------- 파서 */
  function parse(src) {
    var toks = lex(src), p = 0;
    function peek() { return toks[p]; }
    function isOp(v) { var k = toks[p]; return k.t === 'op' && k.v === v; }
    function isKw(v) { var k = toks[p]; return k.t === 'kw' && k.v === v; }
    function fail(msg) { var k = toks[p]; throw err('syntax error: ' + (msg || 'unexpected ' + (k.t === 'eof' ? 'end of input' : JSON.stringify(k.v !== undefined ? k.v : k.t)))); }
    function eatOp(v) { if (!isOp(v)) fail('expected "' + v + '"'); p++; }
    function eatKw(v) { if (!isKw(v)) fail('expected "' + v + '"'); p++; }
    function strNode(tok, fmt) {
      var parts = tok.parts.map(function (x) { return typeof x === 'string' ? x : { ast: parse(x.src) }; });
      if (parts.length === 1) return { type: 'lit', v: parts[0] };
      return { type: 'strinterp', parts: parts, fmt: fmt || null };
    }
    function parsePipe() {
      if (isKw('def')) { var d = parseDef(); var rest = parsePipe(); return { type: 'defs', def: d, body: rest }; }
      var l = parseComma();
      if (isOp('|')) { p++; var r = parsePipe(); return { type: 'pipe', l: l, r: r }; }
      return l;
    }
    function parseDef() {
      eatKw('def'); var nm = peek(); if (nm.t !== 'id' && nm.t !== 'kw') fail('expected function name'); p++;
      var params = [];
      if (isOp('(')) { p++; while (true) { var a = peek(); if (a.t === 'var') { params.push({ name: a.v, val: true }); p++; } else if (a.t === 'id' || a.t === 'kw') { params.push({ name: a.v, val: false }); p++; } else fail('expected parameter'); if (isOp(';')) { p++; continue; } break; } eatOp(')'); }
      eatOp(':'); var body = parsePipe(); eatOp(';');
      return { name: nm.v, params: params, body: body };
    }
    function parseComma() { var l = parseAlt(); while (isOp(',')) { p++; var r = parseAlt(); l = { type: 'comma', l: l, r: r }; } return l; }
    function parseAlt() { var l = parseAssign(); if (isOp('//')) { p++; var r = parseAlt(); return { type: 'alt', l: l, r: r }; } return l; }
    function parseAssign() {
      var l = parseOr(), k = peek();
      if (k.t === 'op' && ['=', '|=', '+=', '-=', '*=', '/=', '%=', '//='].indexOf(k.v) >= 0) { p++; var r = parseAlt(); return { type: 'assign', op: k.v, l: l, r: r }; }
      return l;
    }
    function parseOr() { var l = parseAnd(); while (isKw('or')) { p++; l = { type: 'or', l: l, r: parseAnd() }; } return l; }
    function parseAnd() { var l = parseCmp(); while (isKw('and')) { p++; l = { type: 'and', l: l, r: parseCmp() }; } return l; }
    function parseCmp() { var l = parseAdd(), k = peek(); if (k.t === 'op' && ['==', '!=', '<', '<=', '>', '>='].indexOf(k.v) >= 0) { p++; return { type: 'bin', op: k.v, l: l, r: parseAdd() }; } return l; }
    function parseAdd() { var l = parseMul(); while (isOp('+') || isOp('-')) { var op = toks[p++].v; l = { type: 'bin', op: op, l: l, r: parseMul() }; } return l; }
    function parseMul() { var l = parseUnary(); while (isOp('*') || isOp('/') || isOp('%')) { var op = toks[p++].v; l = { type: 'bin', op: op, l: l, r: parseUnary() }; } return l; }
    function parseUnary() { if (isOp('-')) { p++; return { type: 'neg', e: parseUnary() }; } return parsePostfix(); }
    function parsePattern() {
      var k = peek();
      if (k.t === 'var') { p++; return { type: 'pvar', name: k.v }; }
      if (isOp('[')) { p++; var els = []; while (!isOp(']')) { els.push(parsePattern()); if (isOp(',')) p++; else break; } eatOp(']'); return { type: 'parr', els: els }; }
      if (isOp('{')) {
        p++; var ents = [];
        while (!isOp('}')) {
          var kk = peek(), ent = {};
          if (kk.t === 'var') { p++; ent.keyVar = kk.v; ent.key = { type: 'lit', v: kk.v }; if (isOp(':')) { p++; ent.pat = parsePattern(); } }
          else if (kk.t === 'id' || kk.t === 'kw') { p++; ent.key = { type: 'lit', v: kk.v }; eatOp(':'); ent.pat = parsePattern(); }
          else if (kk.t === 'str') { p++; ent.key = strNode(kk); eatOp(':'); ent.pat = parsePattern(); }
          else if (isOp('(')) { p++; ent.key = parsePipe(); eatOp(')'); eatOp(':'); ent.pat = parsePattern(); }
          else fail('bad object pattern');
          ents.push(ent); if (isOp(',')) p++; else break;
        }
        eatOp('}'); return { type: 'pobj', ents: ents };
      }
      fail('expected pattern');
    }
    function parsePatterns() { var pats = [parsePattern()]; while (isOp('?//')) { p++; pats.push(parsePattern()); } return pats; }
    function parsePostfix() {
      var e = parsePrimary();
      while (true) {
        var k = peek();
        if (k.t === 'field') { p++; e = { type: 'index', e: e, idx: { type: 'lit', v: k.v } }; }
        else if (isOp('.') && toks[p + 1].t === 'str') { p++; var s = toks[p++]; e = { type: 'index', e: e, idx: strNode(s) }; }
        else if (isOp('.') && toks[p + 1].t === 'op' && toks[p + 1].v === '[') { p++; }
        else if (isOp('[')) { p++; e = parseBracket(e); }
        else if (isOp('?')) { p++; e = { type: 'try', body: e, handler: null }; }
        else if (isKw('as')) { p++; var pats = parsePatterns(); eatOp('|'); var body = parsePipe(); return { type: 'as', src: e, pats: pats, body: body }; }
        else break;
      }
      return e;
    }
    function parseBracket(e) {
      if (isOp(']')) { p++; return { type: 'iter', e: e }; }
      if (isOp(':')) { p++; var to = parsePipe(); eatOp(']'); return { type: 'slice', e: e, from: null, to: to }; }
      var a = parsePipe();
      if (isOp(':')) { p++; if (isOp(']')) { p++; return { type: 'slice', e: e, from: a, to: null }; } var b = parsePipe(); eatOp(']'); return { type: 'slice', e: e, from: a, to: b }; }
      eatOp(']'); return { type: 'index', e: e, idx: a };
    }
    function parsePrimary() {
      var k = peek();
      if (k.t === 'num') { p++; return { type: 'lit', v: k.v }; }
      if (k.t === 'str') { p++; return strNode(k); }
      if (k.t === 'fmt') { p++; if (peek().t === 'str') { var s = toks[p++]; var node = strNode(s, k.v); if (node.type === 'lit') return { type: 'fmtstr', fmt: k.v, v: node.v }; return node; } return { type: 'fmt', name: k.v }; }
      if (k.t === 'field') { p++; return { type: 'index', e: { type: 'id' }, idx: { type: 'lit', v: k.v } }; }
      if (k.t === 'var') { p++; return k.v === '__loc__' ? { type: 'lit', v: { file: '<top-level>', line: 1 } } : { type: 'var', name: k.v }; }
      if (isOp('..')) { p++; return { type: 'recurse' }; }
      if (isOp('.')) {
        p++; var nx = peek();
        if (nx.t === 'str') { p++; return { type: 'index', e: { type: 'id' }, idx: strNode(nx) }; }
        if (isOp('[')) { p++; return parseBracket({ type: 'id' }); }
        return { type: 'id' };
      }
      if (isOp('(')) { p++; var e = parsePipe(); eatOp(')'); return { type: 'paren', e: e }; }
      if (isOp('[')) { p++; if (isOp(']')) { p++; return { type: 'arr', e: null }; } var ae = parsePipe(); eatOp(']'); return { type: 'arr', e: ae }; }
      if (isOp('{')) return parseObject();
      if (isOp('-')) { p++; return { type: 'neg', e: parsePostfix() }; }
      if (k.t === 'kw') {
        if (k.v === 'if') {
          p++; var c = parsePipe(); eatKw('then'); var th = parsePipe(); var node2 = { type: 'if', cond: c, then: th, els: null }, cur = node2;
          while (isKw('elif')) { p++; var c2 = parsePipe(); eatKw('then'); var t2 = parsePipe(); var n2 = { type: 'if', cond: c2, then: t2, els: null }; cur.els = n2; cur = n2; }
          if (isKw('else')) { p++; cur.els = parsePipe(); }
          eatKw('end'); return node2;
        }
        if (k.v === 'try') { p++; var body = parsePostBody(); var handler = null; if (isKw('catch')) { p++; handler = parsePostBody(); } return { type: 'try', body: body, handler: handler }; }
        if (k.v === 'reduce') { p++; var src = parsePostfixNoAs(); eatKw('as'); var pats = parsePatterns(); eatOp('('); var init = parsePipe(); eatOp(';'); var upd = parsePipe(); eatOp(')'); return { type: 'reduce', src: src, pats: pats, init: init, update: upd }; }
        if (k.v === 'foreach') { p++; var src2 = parsePostfixNoAs(); eatKw('as'); var pats2 = parsePatterns(); eatOp('('); var init2 = parsePipe(); eatOp(';'); var upd2 = parsePipe(); var ext = null; if (isOp(';')) { p++; ext = parsePipe(); } eatOp(')'); return { type: 'foreach', src: src2, pats: pats2, init: init2, update: upd2, extract: ext }; }
        if (k.v === 'label') { p++; var lv = peek(); if (lv.t !== 'var') fail('expected label name'); p++; eatOp('|'); var lb = parsePipe(); return { type: 'label', name: lv.v, body: lb }; }
        if (k.v === 'def') { var d = parseDef(); var rest = parsePipe(); return { type: 'defs', def: d, body: rest }; }
        fail();
      }
      if (k.t === 'id') {
        p++;
        if (k.v === 'break' && peek().t === 'var') { var bv = toks[p++]; return { type: 'break', name: bv.v }; }
        var args = [];
        if (isOp('(')) { p++; while (true) { args.push(parsePipe()); if (isOp(';')) { p++; continue; } break; } eatOp(')'); }
        return { type: 'call', name: k.v, args: args };
      }
      fail();
    }
    function parsePostfixNoAs() {
      var e = parsePrimary();
      while (true) {
        var k = peek();
        if (k.t === 'field') { p++; e = { type: 'index', e: e, idx: { type: 'lit', v: k.v } }; }
        else if (isOp('.') && toks[p + 1].t === 'str') { p++; var s = toks[p++]; e = { type: 'index', e: e, idx: strNode(s) }; }
        else if (isOp('[')) { p++; e = parseBracket(e); }
        else if (isOp('?')) { p++; e = { type: 'try', body: e, handler: null }; }
        else break;
      }
      return e;
    }
    function parsePostBody() { return parsePostfixNoAs(); }
    function parseObject() {
      eatOp('{'); var ents = [];
      while (!isOp('}')) {
        var k = peek(), ent = {};
        if (k.t === 'var') { p++; ent.key = { type: 'lit', v: k.v }; ent.val = { type: 'var', name: k.v }; }
        else if (k.t === 'id' || k.t === 'kw') { p++; ent.key = { type: 'lit', v: k.v }; if (isOp(':')) { p++; ent.val = parseObjVal(); } else ent.val = { type: 'index', e: { type: 'id' }, idx: { type: 'lit', v: k.v } }; }
        else if (k.t === 'num') { p++; ent.key = { type: 'lit', v: String(k.v) }; eatOp(':'); ent.val = parseObjVal(); }
        else if (k.t === 'str') { p++; ent.key = strNode(k); if (isOp(':')) { p++; ent.val = parseObjVal(); } else ent.val = { type: 'index', e: { type: 'id' }, idx: ent.key }; }
        else if (k.t === 'fmt') { p++; var s = peek(); if (s.t !== 'str') fail('expected string after format'); p++; ent.key = strNode(s, k.v); if (isOp(':')) { p++; ent.val = parseObjVal(); } else ent.val = { type: 'index', e: { type: 'id' }, idx: ent.key }; }
        else if (isOp('(')) { p++; ent.key = parsePipe(); eatOp(')'); eatOp(':'); ent.val = parseObjVal(); }
        else fail('bad object key');
        ents.push(ent); if (isOp(',')) p++; else break;
      }
      eatOp('}'); return { type: 'obj', ents: ents };
    }
    function parseObjVal() { var l = parseAlt(); while (isOp('|')) { p++; l = { type: 'pipe', l: l, r: parseAlt() }; } return l; }
    var ast = parsePipe();
    if (peek().t !== 'eof') fail();
    return ast;
  }
  Q.parse = parse;

  /* ---------------------------------------------------------------- 환경 */
  function Env(parent) { this.parent = parent; this.vars = null; this.funcs = null; }
  Env.prototype.getVar = function (n) { for (var e = this; e; e = e.parent) if (e.vars && Object.prototype.hasOwnProperty.call(e.vars, n)) return e.vars[n]; return undefined; };
  Env.prototype.getFunc = function (k) { for (var e = this; e; e = e.parent) if (e.funcs && Object.prototype.hasOwnProperty.call(e.funcs, k)) return e.funcs[k]; return undefined; };
  function withVar(env, n, v) { var e = new Env(env); e.vars = {}; e.vars[n] = v; return e; }
  function withFunc(env, k, f) { var e = new Env(env); e.funcs = {}; e.funcs[k] = f; return e; }

  /* ---------------------------------------------------------------- 평가기 */
  var STEPS = 0, MAX_STEPS = 3000000;
  function tick() { if (++STEPS > MAX_STEPS) throw err('실행 단계가 너무 많아 중단했습니다 (무한 루프?)'); }

  function idx(v, k) {
    var tv = typeOf(v), tk = typeOf(k);
    if (tv === 'object' && tk === 'string') return Object.prototype.hasOwnProperty.call(v, k) ? v[k] : null;
    if (tv === 'array' && tk === 'number') { if (k !== k) return null; var i = Math.floor(k); if (i < 0) i += v.length; return i >= 0 && i < v.length ? v[i] : null; }
    if (tv === 'null' && (tk === 'string' || tk === 'number' || tk === 'null')) return null;
    if (tv === 'array' && tk === 'object') return sliceVal(v, k.start, k.end);
    if (tv === 'array' && tk === 'array') return indicesOf(v, k);
    if (tv === 'object') throw err('Cannot index object with ' + tk + (tk === 'string' ? ' "' + k + '"' : ''));
    throw err('Cannot index ' + tv + ' with ' + (tk === 'string' ? 'string "' + k + '"' : tk));
  }
  function indicesOf(v, k) { if (!k.length) return null; var r = []; for (var i = 0; i + k.length <= v.length; i++) { var ok = true; for (var j = 0; j < k.length; j++) if (!eq(v[i + j], k[j])) { ok = false; break; } if (ok) r.push(i); } return r; }
  function sliceVal(v, from, to) {
    var tv = typeOf(v);
    if (tv === 'null') return null;
    if (tv !== 'array' && tv !== 'string') throw err('Cannot index ' + tv + ' with object');
    var items = tv === 'string' ? Array.from(v) : v, n = items.length;
    function norm(x, d) { if (x === null || x === undefined) return d; if (typeof x !== 'number') throw err('Start and end indices of an array slice must be numbers'); if (x < 0) x += n; return x; }
    var s = Math.floor(Math.max(0, Math.min(n, norm(from, 0)))), e = Math.ceil(Math.max(0, Math.min(n, norm(to, n))));
    if (e < s) e = s;
    var r = items.slice(s, e); return tv === 'string' ? r.join('') : r;
  }
  function iterate(v) {
    if (Array.isArray(v)) return v;
    if (isObj(v)) return Object.keys(v).map(function (k) { return v[k]; });
    throw err('Cannot iterate over ' + typeOf(v) + (v === null ? '' : ' (' + trunc(v) + ')'));
  }

  function* ev(n, v, env) {
    tick();
    switch (n.type) {
      case 'id': yield v; return;
      case 'paren': yield* ev(n.e, v, env); return;
      case 'lit': yield n.v; return;
      case 'recurse': yield* recurseDefault(v); return;
      case 'var': { var val = env.getVar(n.name); if (val === undefined) { if (n.name === 'ENV') { yield {}; return; } if (n.name === '__prog_args') { yield []; return; } throw err('$' + n.name + ' is not defined'); } yield val; return; }
      case 'index': {
        for (var b of ev(n.e, v, env)) for (var k of ev(n.idx, v, env)) yield idx(b, k);
        return;
      }
      case 'slice': {
        for (var b2 of ev(n.e, v, env)) for (var to of (n.to ? ev(n.to, v, env) : [null])) for (var fr of (n.from ? ev(n.from, v, env) : [null])) yield sliceVal(b2, fr, to);
        return;
      }
      case 'iter': { for (var b3 of ev(n.e, v, env)) yield* iterate(b3); return; }
      case 'pipe': { for (var x of ev(n.l, v, env)) yield* ev(n.r, x, env); return; }
      case 'comma': { yield* ev(n.l, v, env); yield* ev(n.r, v, env); return; }
      case 'neg': { for (var nv of ev(n.e, v, env)) { if (typeof nv !== 'number') throw err(typeOf(nv) + ' (' + trunc(nv) + ') cannot be negated'); yield -nv; } return; }
      case 'bin': {
        for (var r of ev(n.r, v, env)) for (var l of ev(n.l, v, env)) yield binop(n.op, l, r);
        return;
      }
      case 'and': { for (var la of ev(n.l, v, env)) { if (!truthy(la)) { yield false; continue; } for (var ra of ev(n.r, v, env)) yield truthy(ra); } return; }
      case 'or': { for (var lo of ev(n.l, v, env)) { if (truthy(lo)) { yield true; continue; } for (var ro of ev(n.r, v, env)) yield truthy(ro); } return; }
      case 'alt': {
        var any = false;
        try { for (var a of ev(n.l, v, env)) if (truthy(a)) { any = true; yield a; } } catch (e) { if (!(e instanceof JQError)) throw e; }
        if (!any) yield* ev(n.r, v, env);
        return;
      }
      case 'if': {
        for (var c of ev(n.cond, v, env)) { if (truthy(c)) yield* ev(n.then, v, env); else if (n.els) yield* ev(n.els, v, env); else yield v; }
        return;
      }
      case 'try': {
        var gen = ev(n.body, v, env);
        while (true) {
          var nx;
          try { nx = gen.next(); } catch (e) {
            if (e instanceof JQError) { if (e.val && e.val.__break) throw e; if (n.handler) { yield* ev(n.handler, e.val, env); } return; }
            throw e;
          }
          if (nx.done) return; yield nx.value;
        }
      }
      case 'arr': { if (!n.e) { yield []; return; } var out = []; for (var ae of ev(n.e, v, env)) out.push(ae); yield out; return; }
      case 'obj': { yield* objBuild(n.ents, 0, {}, v, env); return; }
      case 'strinterp': {
        var fmt = n.fmt;
        function* build(i, acc) {
          if (i === n.parts.length) { yield acc; return; }
          var pt = n.parts[i];
          if (typeof pt === 'string') { yield* build(i + 1, acc + pt); return; }
          for (var sv of ev(pt.ast, v, env)) yield* build(i + 1, acc + (fmt ? applyFormat(fmt, sv) : (typeof sv === 'string' ? sv : toJson(sv))));
        }
        yield* build(0, ''); return;
      }
      case 'fmtstr': yield n.v; return;
      case 'fmt': yield applyFormat(n.name, v); return;
      case 'as': {
        for (var sv2 of ev(n.src, v, env)) yield* bindPatterns(n.pats, sv2, env, function* (e2) { yield* ev(n.body, v, e2); });
        return;
      }
      case 'reduce': {
        var accs = Array.from(ev(n.init, v, env));
        for (var ai = 0; ai < accs.length; ai++) {
          var acc = accs[ai];
          for (var sv3 of ev(n.src, v, env)) {
            var results = [];
            for (var _ of bindPatterns(n.pats, sv3, env, function* (e3) { for (var u of ev(n.update, acc, e3)) { results.push(u); } })) { }
            if (results.length) { acc = results[results.length - 1]; } else acc = null;
          }
          yield acc;
        }
        return;
      }
      case 'foreach': {
        var accs2 = Array.from(ev(n.init, v, env));
        for (var bi = 0; bi < accs2.length; bi++) {
          var st = accs2[bi];
          for (var sv4 of ev(n.src, v, env)) {
            yield* bindPatterns(n.pats, sv4, env, function* (e4) { for (var u2 of ev(n.update, st, e4)) { st = u2; if (n.extract) yield* ev(n.extract, u2, e4); else yield u2; } });
          }
        }
        return;
      }
      case 'label': {
        var lenv = withVar(env, '*label*' + n.name, {});
        try { yield* ev(n.body, v, lenv); } catch (e) { if (e instanceof BreakErr && e.label === lenv.vars['*label*' + n.name]) return; throw e; }
        return;
      }
      case 'break': { var lab = env.getVar('*label*' + n.name); if (lab === undefined) throw err('$*label-' + n.name + ' is not defined'); throw new BreakErr(lab); }
      case 'defs': {
        var d = n.def, key = d.name + '/' + d.params.length, fobj = { def: d, env: null };
        var env2 = withFunc(env, key, fobj); fobj.env = env2;
        yield* ev(n.body, v, env2); return;
      }
      case 'assign': { yield* assign(n, v, env); return; }
      case 'call': { yield* callFn(n, v, env); return; }
      default: throw err('내부 오류: 알 수 없는 노드 ' + n.type);
    }
  }

  function* recurseDefault(v) { yield v; if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) yield* recurseDefault(v[i]); } else if (isObj(v)) { var ks = Object.keys(v); for (var j = 0; j < ks.length; j++) yield* recurseDefault(v[ks[j]]); } }

  function binop(op, l, r) {
    switch (op) {
      case '+': return add(l, r); case '-': return sub(l, r); case '*': return mul(l, r); case '/': return div(l, r); case '%': return mod(l, r);
      case '==': return eq(l, r); case '!=': return !eq(l, r); case '<': return cmp(l, r) < 0; case '<=': return cmp(l, r) <= 0; case '>': return cmp(l, r) > 0; case '>=': return cmp(l, r) >= 0;
    }
  }

  function* objBuild(ents, i, acc, v, env) {
    if (i === ents.length) { yield acc; return; }
    var en = ents[i];
    for (var k of ev(en.key, v, env)) {
      if (typeof k !== 'string') throw err('Object keys must be strings');
      for (var val of ev(en.val, v, env)) { var o = {}; Object.keys(acc).forEach(function (kk) { o[kk] = acc[kk]; }); o[k] = val; yield* objBuild(ents, i + 1, o, v, env); }
    }
  }

  function* bindPatterns(pats, value, env, body) {
    if (pats.length === 1) { for (var e of destructure(pats[0], value, env)) yield* body(e); return; }
    /* ?// 대체 패턴: 앞 패턴에서 오류가 나면 다음 패턴 */
    var allVars = []; pats.forEach(function (p) { collectVars(p, allVars); });
    for (var i = 0; i < pats.length; i++) {
      var base = env; allVars.forEach(function (nm) { base = withVar(base, nm, null); });
      try { for (var e2 of destructure(pats[i], value, base)) yield* body(e2); return; } catch (er) { if (!(er instanceof JQError) || i === pats.length - 1) throw er; }
    }
  }
  function collectVars(p, out) { if (p.type === 'pvar') out.push(p.name); else if (p.type === 'parr') p.els.forEach(function (x) { collectVars(x, out); }); else p.ents.forEach(function (e) { if (e.keyVar) out.push(e.keyVar); if (e.pat) collectVars(e.pat, out); }); }
  function* destructure(p, value, env) {
    if (p.type === 'pvar') { yield withVar(env, p.name, value); return; }
    if (p.type === 'parr') {
      if (value !== null && !Array.isArray(value)) throw err('Cannot index ' + typeOf(value) + ' with number');
      function* go(i, e) { if (i === p.els.length) { yield e; return; } for (var e2 of destructure(p.els[i], value === null ? null : (i < value.length ? value[i] : null), e)) yield* go(i + 1, e2); }
      yield* go(0, env); return;
    }
    function* goo(i, e) {
      if (i === p.ents.length) { yield e; return; }
      var en = p.ents[i];
      for (var k of ev(en.key, value, e)) {
        if (typeof k !== 'string') throw err('Cannot index ' + typeOf(value) + ' with ' + typeOf(k));
        var fv = idx(value, k), e1 = e;
        if (en.keyVar) e1 = withVar(e1, en.keyVar, fv);
        if (en.pat) { for (var e3 of destructure(en.pat, fv, e1)) yield* goo(i + 1, e3); } else yield* goo(i + 1, e1);
      }
    }
    yield* goo(0, env);
  }

  /* ------------------------------------------------------------- 경로 평가 */
  function* evp(n, pv, env) {
    tick();
    var path = pv[0], v = pv[1];
    function nop() { if (path === null) throw err('Invalid path expression with result ' + trunc(v)); }
    switch (n.type) {
      case 'id': yield pv; return;
      case 'paren': yield* evp(n.e, pv, env); return;
      case 'recurse': { nop(); yield* recursePaths(path, v); return; }
      case 'index': {
        for (var b of evp(n.e, pv, env)) {
          if (b[0] === null) throw err('Invalid path expression with result ' + trunc(b[1]));
          for (var k of ev(n.idx, v, env)) yield [b[0].concat([k]), idx(b[1], k)];
        }
        return;
      }
      case 'slice': {
        for (var b2 of evp(n.e, pv, env)) {
          if (b2[0] === null) throw err('Invalid path expression with result ' + trunc(b2[1]));
          for (var to of (n.to ? ev(n.to, v, env) : [null])) for (var fr of (n.from ? ev(n.from, v, env) : [null])) yield [b2[0].concat([{ start: fr, end: to }]), sliceVal(b2[1], fr, to)];
        }
        return;
      }
      case 'iter': {
        for (var b3 of evp(n.e, pv, env)) {
          if (b3[0] === null) throw err('Invalid path expression with result ' + trunc(b3[1]));
          var val = b3[1];
          if (Array.isArray(val)) for (var i = 0; i < val.length; i++) yield [b3[0].concat([i]), val[i]];
          else if (isObj(val)) { var ks = Object.keys(val); for (var j = 0; j < ks.length; j++) yield [b3[0].concat([ks[j]]), val[ks[j]]]; }
          else iterate(val);
        }
        return;
      }
      case 'pipe': { for (var x of evp(n.l, pv, env)) yield* evp(n.r, x, env); return; }
      case 'comma': { yield* evp(n.l, pv, env); yield* evp(n.r, pv, env); return; }
      case 'alt': {
        var any = false;
        try { for (var a of evp(n.l, pv, env)) if (truthy(a[1])) { any = true; yield a; } } catch (e) { if (!(e instanceof JQError)) throw e; }
        if (!any) yield* evp(n.r, pv, env);
        return;
      }
      case 'if': {
        for (var c of ev(n.cond, v, env)) { if (truthy(c)) yield* evp(n.then, pv, env); else if (n.els) yield* evp(n.els, pv, env); else yield pv; }
        return;
      }
      case 'try': {
        var gen = evp(n.body, pv, env);
        while (true) {
          var nx;
          try { nx = gen.next(); } catch (e) { if (e instanceof JQError) { if (n.handler) { for (var hv of ev(n.handler, e.val, env)) yield [null, hv]; } return; } throw e; }
          if (nx.done) return; yield nx.value;
        }
      }
      case 'as': {
        for (var sv of ev(n.src, v, env)) yield* (function* () { var outs = []; for (var _ of bindPatterns(n.pats, sv, env, function* (e2) { for (var r of evp(n.body, pv, e2)) outs.push(r); })) { } for (var o of outs) yield o; })();
        return;
      }
      case 'defs': {
        var d = n.def, key = d.name + '/' + d.params.length, fobj = { def: d, env: null };
        var env2 = withFunc(env, key, fobj); fobj.env = env2;
        yield* evp(n.body, pv, env2); return;
      }
      case 'label': {
        var lenv = withVar(env, '*label*' + n.name, {});
        try { yield* evp(n.body, pv, lenv); } catch (e) { if (e instanceof BreakErr && e.label === lenv.vars['*label*' + n.name]) return; throw e; }
        return;
      }
      case 'break': { var lab = env.getVar('*label*' + n.name); throw new BreakErr(lab); }
      case 'reduce': {
        var accs = Array.from(evp(n.init, pv, env));
        for (var ai = 0; ai < accs.length; ai++) {
          var acc = accs[ai];
          for (var sv2 of ev(n.src, v, env)) {
            var results = [];
            for (var _2 of bindPatterns(n.pats, sv2, env, function* (e3) { for (var u of evp(n.update, acc, e3)) results.push(u); })) { }
            acc = results.length ? results[results.length - 1] : [null, null];
          }
          yield acc;
        }
        return;
      }
      case 'foreach': {
        var paccs = Array.from(evp(n.init, pv, env));
        for (var pbi = 0; pbi < paccs.length; pbi++) {
          var pst = paccs[pbi];
          for (var psv of ev(n.src, v, env)) {
            yield* bindPatterns(n.pats, psv, env, function* (e4) { for (var pu of evp(n.update, pst, e4)) { pst = pu; if (n.extract) yield* evp(n.extract, pu, e4); else yield pu; } });
          }
        }
        return;
      }
      case 'call': { yield* callFnPath(n, pv, env); return; }
      default:
        for (var out of ev(n, v, env)) yield [null, out];
    }
  }
  function* recursePaths(path, v) { yield [path, v]; if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) yield* recursePaths(path.concat([i]), v[i]); } else if (isObj(v)) { var ks = Object.keys(v); for (var j = 0; j < ks.length; j++) yield* recursePaths(path.concat([ks[j]]), v[ks[j]]); } }

  function getpath(v, path) {
    var cur = v;
    for (var i = 0; i < path.length; i++) { if (cur === null) return null; cur = idx(cur, path[i]); }
    return cur;
  }
  function setpath(v, path, val, i) {
    i = i || 0;
    if (i === path.length) return val;
    var k = path[i];
    if (typeof k === 'string') {
      if (v !== null && !isObj(v)) throw err('Cannot index ' + typeOf(v) + ' with "' + k + '"');
      var o = {}; if (v) Object.keys(v).forEach(function (x) { o[x] = v[x]; });
      o[k] = setpath(v && Object.prototype.hasOwnProperty.call(v, k) ? v[k] : null, path, val, i + 1); return o;
    }
    if (typeof k === 'number') {
      if (v !== null && !Array.isArray(v)) throw err('Cannot index ' + typeOf(v) + ' with number');
      var a = v ? v.slice() : [], ix = Math.floor(k); if (ix < 0) { ix += a.length; if (ix < 0) throw err('Out of bounds negative array index'); }
      if (ix > 536870911) throw err('Array index too large');
      while (a.length <= ix) a.push(null);
      a[ix] = setpath(a[ix], path, val, i + 1); return a;
    }
    if (isObj(k)) {
      if (v !== null && !Array.isArray(v)) throw err('Cannot update field at object index of ' + typeOf(v));
      var arr = v ? v.slice() : [], n = arr.length;
      function nz(x, d) { if (x === null || x === undefined) return d; if (x < 0) x += n; return x; }
      var s = Math.floor(Math.max(0, Math.min(n, nz(k.start, 0)))), e = Math.ceil(Math.max(0, Math.min(n, nz(k.end, n)))); if (e < s) e = s;
      var repl = setpath(arr.slice(s, e), path, val, i + 1);
      if (!Array.isArray(repl)) throw err('A slice of an array can only be assigned another array');
      return arr.slice(0, s).concat(repl, arr.slice(e));
    }
    throw err('Invalid path component ' + trunc(k));
  }
  function delpaths(v, paths) {
    var sorted = paths.slice().sort(cmp).reverse();
    var cur = v;
    sorted.forEach(function (p) { cur = delpath(cur, p, 0); });
    return cur;
  }
  function delpath(v, path, i) {
    if (path.length === 0) return null;
    if (v === null) return null;
    var k = path[i];
    if (i === path.length - 1) {
      if (typeof k === 'string') { if (!isObj(v)) throw err('Cannot delete field at object index of ' + typeOf(v)); var o = {}; Object.keys(v).forEach(function (x) { if (x !== k) o[x] = v[x]; }); return o; }
      if (typeof k === 'number') { if (!Array.isArray(v)) throw err('Cannot delete field at array index of ' + typeOf(v)); var ix = Math.floor(k); if (ix < 0) ix += v.length; return v.filter(function (_, j) { return j !== ix; }); }
      if (isObj(k)) { if (!Array.isArray(v)) throw err('Cannot delete field at object index of ' + typeOf(v)); var n = v.length; var nz = function (x, d) { if (x === null || x === undefined) return d; if (x < 0) x += n; return x; }; var s = Math.floor(Math.max(0, Math.min(n, nz(k.start, 0)))), e = Math.ceil(Math.max(0, Math.min(n, nz(k.end, n)))); return v.slice(0, s).concat(v.slice(Math.max(s, e))); }
      throw err('Invalid path component');
    }
    var child = idx(v, k);
    if (child === null) return v;
    return setpath(v, [k], delpath(child, path, i + 1));
  }

  function* assign(n, v, env) {
    var op = n.op;
    if (op === '=') {
      for (var rv of ev(n.r, v, env)) {
        var res = v;
        for (var pp of evp(n.l, [[], v], env)) { if (pp[0] === null) throw err('Invalid path expression with result ' + trunc(pp[1])); res = setpath(res, pp[0], rv); }
        yield res;
      }
      return;
    }
    if (op === '|=') {
      var paths = []; for (var p1 of evp(n.l, [[], v], env)) { if (p1[0] === null) throw err('Invalid path expression with result ' + trunc(p1[1])); paths.push(p1[0]); }
      var res2 = v, dels = [];
      for (var i = 0; i < paths.length; i++) {
        var old = getpath(res2, paths[i]), first = null, got = false;
        var gen = ev(n.r, old, env), nx = gen.next();
        if (!nx.done) { first = nx.value; got = true; }
        if (got) res2 = setpath(res2, paths[i], first); else dels.push(paths[i]);
      }
      if (dels.length) res2 = delpaths(res2, dels);
      yield res2; return;
    }
    var bop = op.slice(0, -1);
    for (var rv2 of ev(n.r, v, env)) {
      var res3 = v;
      for (var p2 of evp(n.l, [[], v], env)) {
        if (p2[0] === null) throw err('Invalid path expression with result ' + trunc(p2[1]));
        var cur = getpath(res3, p2[0]), nv = bop === '//' ? (truthy(cur) ? cur : rv2) : binop(bop, cur, rv2);
        res3 = setpath(res3, p2[0], nv);
      }
      yield res3;
    }
  }

  /* ----------------------------------------------------------- 함수 호출 */
  function* callFn(n, v, env) {
    var key = n.name + '/' + n.args.length, f = env.getFunc(key);
    if (f) { yield* callUser(f, n, v, env, false); return; }
    var nat = NATIVE[key];
    if (nat) { yield* nat(v, n.args, env); return; }
    throw err(n.name + '/' + n.args.length + ' is not defined');
  }
  function* callUser(f, n, v, env, pathMode) {
    if (f.closure) { /* 인자 클로저 */ if (pathMode) yield* evp(f.body, v, f.env); else yield* ev(f.body, v, f.env); return; }
    var d = f.def, callEnv = f.env;
    function* bind(i, e) {
      if (i === d.params.length) { if (pathMode) yield* evp(d.body, v, e); else yield* ev(d.body, pathMode ? v : v, e); return; }
      var prm = d.params[i], arg = n.args[i];
      if (prm.val) {
        var ie = pathMode ? v[1] : v;
        for (var av of ev(arg, ie, env)) { var e2 = withVar(e, prm.name, av); e2 = withFunc(e2, prm.name + '/0', { closure: true, body: { type: 'lit', v: av }, env: e2 }); yield* bind(i + 1, e2); }
      } else {
        yield* bind(i + 1, withFunc(e, prm.name + '/0', { closure: true, body: arg, env: env }));
        return;
      }
    }
    /* 비-값 매개변수의 클로저 인자는 호출자 환경에서 평가 — bind 안에서 처리 */
    yield* bind(0, callEnv);
  }
  function* callFnPath(n, pv, env) {
    var key = n.name + '/' + n.args.length, f = env.getFunc(key);
    if (f) { yield* callUser(f, n, pv, env, true); return; }
    var nat = NATIVE_PATH[key];
    if (nat) { yield* nat(pv, n.args, env); return; }
    for (var out of callFn(n, pv[1], env)) yield [null, out];
  }

  function* cart(args, v, env) {
    function* go(i, acc) { if (i === args.length) { yield acc.slice(); return; } for (var x of ev(args[i], v, env)) { acc.push(x); yield* go(i + 1, acc); acc.pop(); } }
    yield* go(0, []);
  }
  function str(x, what) { if (typeof x !== 'string') throw err(typeOf(x) + ' (' + trunc(x) + ') cannot be ' + what); return x; }

  /* 정규식 */
  function mkRegex(re, flags, global) {
    if (typeof re !== 'string') throw err(typeOf(re) + ' (' + trunc(re) + ') cannot be matched, as it is not a string');
    var fl = flags === null || flags === undefined ? '' : flags;
    if (typeof fl !== 'string') throw err(typeOf(fl) + ' (' + trunc(fl) + ') is not a string');
    var js = '', g2 = !!global, ext = false, skipEmpty = false;
    for (var i = 0; i < fl.length; i++) { var c = fl[i]; if (c === 'g') g2 = true; else if (c === 'i') js += 'i'; else if (c === 'x') ext = true; else if (c === 's') js += 's'; else if (c === 'n') skipEmpty = true; else if (c === 'l' || c === 'p') { if (c === 'p') js += 's'; } else throw err(fl + ' is not a valid modifier string'); }
    if (ext) re = re.replace(/\\#/g, '\u0001').replace(/#.*$/gm, '').replace(/\s+/g, '').replace(/\u0001/g, '\\#');
    try { return { rx: new RegExp(re, js + 'gu'), global: g2, skipEmpty: skipEmpty }; } catch (e) { throw err(re + ' (at offset 0) is not a valid regex: ' + e.message); }
  }
  function cpOffset(s, idx2) { return Array.from(s.slice(0, idx2)).length; }
  function matches(input, re, flags, global) {
    str(input, 'matched, as it is not a string');
    var r = mkRegex(re, flags, global), out = [], m;
    r.rx.lastIndex = 0;
    while ((m = r.rx.exec(input))) {
      if (m[0] === '' && r.skipEmpty) { r.rx.lastIndex++; continue; }
      var names = {}; if (m.groups) Object.keys(m.groups).forEach(function (k) { names[k] = true; });
      var caps = [], groupNames = []; (function () { var rxs = r.rx.source; var cnt = 0, gi = 0; for (var q = 0; q < rxs.length; q++) { if (rxs[q] === '\\') { q++; continue; } if (rxs[q] === '[') { while (q < rxs.length && rxs[q] !== ']') { if (rxs[q] === '\\') q++; q++; } continue; } if (rxs[q] === '(') { if (rxs[q + 1] !== '?') { groupNames.push(null); } else { var nm = /^\(\?<([A-Za-z_][A-Za-z0-9_]*)>/.exec(rxs.slice(q)); if (nm) groupNames.push(nm[1]); } } } })();
      var idxs = m.indices;
      for (var gi2 = 1; gi2 < m.length; gi2++) {
        var gs = m[gi2], off = -1;
        if (gs !== undefined) { off = null; }
        var capOff = gs === undefined ? -1 : cpOffset(input, locate(input, m, gi2));
        caps.push({ offset: capOff, length: gs === undefined ? 0 : Array.from(gs).length, string: gs === undefined ? null : gs, name: groupNames[gi2 - 1] || null });
      }
      out.push({ offset: cpOffset(input, m.index), length: Array.from(m[0]).length, string: m[0], captures: caps });
      if (m[0] === '') r.rx.lastIndex++;
      if (!r.global) break;
    }
    return out;
  }
  function locate(input, m, gi) { /* 그룹 위치 근사: 전체 매치 안에서 그룹 문자열 첫 등장 */ var s = m[gi], base = m.index, at = input.indexOf(s, base); return at < 0 ? base : at; }

  function applyFormat(name, v) {
    switch (name) {
      case '@text': return typeof v === 'string' ? v : toJson(v);
      case '@json': return toJson(v);
      case '@html': return (typeof v === 'string' ? v : toJson(v)).replace(/[<>&'"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' }[c]; });
      case '@uri': return encodeURIComponent(typeof v === 'string' ? v : toJson(v)).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
      case '@csv': case '@tsv': {
        if (!Array.isArray(v)) throw err(typeOf(v) + ' (' + trunc(v) + ') cannot be ' + (name === '@csv' ? 'csv' : 'tsv') + '-formatted, only an array can be');
        return v.map(function (x) {
          if (typeof x === 'number') return numStr(x); if (x === null) return ''; if (typeof x === 'boolean') return x ? 'true' : 'false';
          if (typeof x === 'string') return name === '@csv' ? '"' + x.replace(/"/g, '""') + '"' : x.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
          throw err(typeOf(x) + ' (' + trunc(x) + ') is not valid in a csv row');
        }).join(name === '@csv' ? ',' : '\t');
      }
      case '@sh': {
        function q(x) { if (typeof x === 'string') return "'" + x.replace(/'/g, "'\\''") + "'"; if (x !== null && typeof x === 'object') throw err(typeOf(x) + ' (' + trunc(x) + ') can not be escaped for shell'); return toJson(x); }
        return Array.isArray(v) ? v.map(q).join(' ') : q(v);
      }
      case '@base64': { var u = new TextEncoder().encode(typeof v === 'string' ? v : toJson(v)), s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
      case '@base32': { var u8 = new TextEncoder().encode(typeof v === 'string' ? v : toJson(v)), AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', bits = '', o32 = ''; for (var q = 0; q < u8.length; q++) bits += ('00000000' + u8[q].toString(2)).slice(-8); while (bits.length % 5) bits += '0'; for (var z = 0; z < bits.length; z += 5) o32 += AL[parseInt(bits.substr(z, 5), 2)]; while (o32.length % 8) o32 += '='; return o32; }
      case '@base32d': { var inp32 = String(typeof v === 'string' ? v : toJson(v)).replace(/=+$/, ''), AL2 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', b2 = ''; for (var w = 0; w < inp32.length; w++) { var ix = AL2.indexOf(inp32[w]); if (ix < 0) throw err(typeOf(v) + ' (' + trunc(v) + ') is not valid base32 data'); b2 += ('00000' + ix.toString(2)).slice(-5); } var by = []; for (var y = 0; y + 8 <= b2.length; y += 8) by.push(parseInt(b2.substr(y, 8), 2)); return new TextDecoder('utf-8').decode(new Uint8Array(by)); }
      case '@base64d': {
        var inp = typeof v === 'string' ? v : toJson(v);
        try { var bs = atob(inp.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')), ua = new Uint8Array(bs.length); for (var j = 0; j < bs.length; j++) ua[j] = bs.charCodeAt(j); return new TextDecoder('utf-8').decode(ua); } catch (e) { throw err(typeOf(v) + ' (' + trunc(v) + ') is not valid base64 data'); }
      }
      default: throw err(name.slice(1) + ' is not a valid format');
    }
  }

  function sortBy(arr, keyFn) { var items = arr.map(function (x, i) { return { x: x, k: keyFn(x), i: i }; }); items.sort(function (a, b) { return cmp(a.k, b.k) || a.i - b.i; }); return items; }
  function keysOf(v) { if (isObj(v)) return Object.keys(v).sort(cmpStr); if (Array.isArray(v)) return v.map(function (_, i) { return i; }); throw err(typeOf(v) + ' (' + trunc(v) + ') has no keys'); }
  function lengthOf(v) { var ty = typeOf(v); if (ty === 'null') return 0; if (ty === 'boolean') throw err('boolean (' + v + ') has no length'); if (ty === 'number') return Math.abs(v); if (ty === 'string') return Array.from(v).length; if (ty === 'array') return v.length; return Object.keys(v).length; }
  function flatten(a, d) { var out = []; (function go(x, depth) { x.forEach(function (e) { if (Array.isArray(e) && depth > 0) go(e, depth - 1); else out.push(e); }); })(a, d); return out; }
  function contains(a, b) {
    var ta = typeOf(a), tb = typeOf(b);
    if (ta !== tb) throw err(ta + ' (' + trunc(a) + ') and ' + tb + ' (' + trunc(b) + ') cannot have their containment checked');
    if (ta === 'object') return Object.keys(b).every(function (k) { return Object.prototype.hasOwnProperty.call(a, k) && contains(a[k], b[k]); });
    if (ta === 'array') return b.every(function (y) { return a.some(function (x) { return typeOf(x) === typeOf(y) && contains(x, y); }); });
    if (ta === 'string') return a.indexOf(b) >= 0;
    return eq(a, b);
  }
  function tonumber(v) { if (typeof v === 'number') return v; if (typeof v === 'string') { var s = v.trim(); if (s !== '' && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) || s === 'nan' || s === 'NaN') return s === 'nan' || s === 'NaN' ? NaN : parseFloat(s); throw err('Cannot parse \'' + v + '\' as number'); } throw err(typeOf(v) + ' (' + trunc(v) + ') cannot be parsed as a number'); }
  function fmtDate(sec, f) {
    var d = new Date(sec * 1000), pad = function (x, n) { return ('0000' + x).slice(-(n || 2)); };
    var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
    return f.replace(/%([a-zA-Z%])/g, function (_, c) {
      switch (c) {
        case 'Y': return d.getUTCFullYear(); case 'm': return pad(d.getUTCMonth() + 1); case 'd': return pad(d.getUTCDate()); case 'e': return ('  ' + d.getUTCDate()).slice(-2);
        case 'H': return pad(d.getUTCHours()); case 'M': return pad(d.getUTCMinutes()); case 'S': return pad(d.getUTCSeconds()); case 'Z': return 'UTC'; case 'z': return '+0000';
        case 'y': return pad(d.getUTCFullYear() % 100); case 'j': return pad(doy, 3); case 'a': return DAYS[d.getUTCDay()].slice(0, 3); case 'A': return DAYS[d.getUTCDay()];
        case 'b': case 'h': return MON[d.getUTCMonth()].slice(0, 3); case 'B': return MON[d.getUTCMonth()]; case 'p': return d.getUTCHours() < 12 ? 'AM' : 'PM';
        case 'I': return pad(d.getUTCHours() % 12 || 12); case 's': return String(Math.floor(sec)); case 'u': return String(d.getUTCDay() || 7); case 'w': return String(d.getUTCDay());
        case 'T': return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); case 'D': return pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()) + '/' + pad(d.getUTCFullYear() % 100);
        case 'F': return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); case '%': return '%'; case 'n': return '\n'; case 't': return '\t';
        default: return '%' + c;
      }
    });
  }
  function brokenDown(sec) { var d = new Date(sec * 1000), doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000) - 1; return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds() + (sec % 1), d.getUTCDay(), doy]; }
  function mktime(bt) { if (!Array.isArray(bt) || bt.length < 6) throw err('mktime requires array of 6 numbers'); return Math.floor(Date.UTC(bt[0], bt[1], bt[2], bt[3], bt[4], Math.floor(bt[5])) / 1000); }

  var INPUTS = [];
  Q.setInputs = function (arr) { INPUTS = arr.slice(); };

  /* 값 하나만 받는 단순 함수들 (인자 0개) */
  var F0 = {
    length: lengthOf,
    utf8bytelength: function (v) { return new TextEncoder().encode(str(v, 'counted')).length; },
    not: function (v) { return !truthy(v); },
    keys: keysOf,
    keys_unsorted: function (v) { if (isObj(v)) return Object.keys(v); return keysOf(v); },
    type: typeOf,
    floor: function (v) { return Math.floor(num(v, 'floor')); }, ceil: function (v) { return Math.ceil(num(v, 'ceil')); }, round: function (v) { var x = num(v, 'round'); return x < 0 ? -Math.round(-x) : Math.round(x); },
    sqrt: function (v) { return Math.sqrt(num(v, 'sqrt')); }, fabs: function (v) { return Math.abs(num(v, 'fabs')); }, abs: function (v) { if (typeof v !== 'number') throw err(typeOf(v) + ' (' + trunc(v) + ') has no absolute value'); return v < 0 ? -v : v; },
    log: function (v) { return Math.log(num(v, 'log')); }, log2: function (v) { return Math.log2(num(v, 'log2')); }, log10: function (v) { return Math.log10(num(v, 'log10')); }, exp: function (v) { return Math.exp(num(v, 'exp')); }, exp2: function (v) { return Math.pow(2, num(v, 'exp2')); }, exp10: function (v) { return Math.pow(10, num(v, 'exp10')); },
    sin: function (v) { return Math.sin(num(v, 'sin')); }, cos: function (v) { return Math.cos(num(v, 'cos')); }, tan: function (v) { return Math.tan(num(v, 'tan')); }, asin: function (v) { return Math.asin(num(v, 'asin')); }, acos: function (v) { return Math.acos(num(v, 'acos')); }, atan: function (v) { return Math.atan(num(v, 'atan')); }, cbrt: function (v) { return Math.cbrt(num(v, 'cbrt')); }, trunc: function (v) { return Math.trunc(num(v, 'trunc')); },
    tostring: function (v) { return typeof v === 'string' ? v : toJson(v); },
    tonumber: tonumber,
    tojson: function (v) { return toJson(v); },
    fromjson: function (v) { str(v, 'parsed as JSON'); try { return JSON.parse(v); } catch (e) { throw err(e.message + ' (while parsing \'' + v + '\')'); } },
    ascii_downcase: function (v) { return str(v, 'lowercased').replace(/[A-Z]/g, function (c) { return c.toLowerCase(); }); },
    ascii_upcase: function (v) { return str(v, 'uppercased').replace(/[a-z]/g, function (c) { return c.toUpperCase(); }); },
    explode: function (v) { return Array.from(str(v, 'exploded')).map(function (c) { return c.codePointAt(0); }); },
    implode: function (v) { if (!Array.isArray(v)) throw err('implode input must be an array'); return v.map(function (c) { if (typeof c !== 'number') throw err('Unicode codepoint must be numeric'); return String.fromCodePoint(c); }).join(''); },
    trim: function (v) { return str(v, 'trimmed').trim(); }, ltrim: function (v) { return str(v, 'trimmed').replace(/^\s+/, ''); }, rtrim: function (v) { return str(v, 'trimmed').replace(/\s+$/, ''); },
    reverse: function (v) { if (typeof v === 'string') return Array.from(v).reverse().join(''); if (v === null) return []; if (!Array.isArray(v)) throw err('Cannot reverse ' + typeOf(v)); return v.slice().reverse(); },
    sort: function (v) { if (!Array.isArray(v)) throw err(typeOf(v) + ' (' + trunc(v) + ') cannot be sorted, as it is not an array'); return sortBy(v, function (x) { return x; }).map(function (i) { return i.x; }); },
    unique: function (v) { if (!Array.isArray(v)) throw err(typeOf(v) + ' (' + trunc(v) + ') cannot be sorted, as it is not an array'); var s = sortBy(v, function (x) { return x; }), out = []; s.forEach(function (i) { if (!out.length || !eq(out[out.length - 1], i.x)) out.push(i.x); }); return out; },
    min: function (v) { if (!Array.isArray(v)) throw err(typeOf(v) + ' (' + trunc(v) + ') cannot be iterated over'); return v.length ? v.reduce(function (m, x) { return cmp(x, m) < 0 ? x : m; }) : null; },
    max: function (v) { if (!Array.isArray(v)) throw err(typeOf(v) + ' (' + trunc(v) + ') cannot be iterated over'); return v.length ? v.reduce(function (m, x) { return cmp(x, m) >= 0 ? x : m; }) : null; },
    add: function (v) { if (v === null) return null; return iterate(v).reduce(function (a, x) { return add(a, x); }, null); },
    flatten: function (v) { if (!Array.isArray(v)) throw err('Cannot iterate over ' + typeOf(v)); return flatten(v, 1e9); },
    transpose: function (v) { var n = 0; v.forEach(function (r) { n = Math.max(n, r.length); }); var out = []; for (var i = 0; i < n; i++) out.push(v.map(function (r) { return i < r.length ? r[i] : null; })); return out; },
    to_entries: function (v) { return keysOfU(v).map(function (k) { return { key: k, value: v[k] }; }); },
    from_entries: function (v) {
      var o = {};
      iterate(v).forEach(function (e) {
        var k, val;
        if (isObj(e)) { var kc = ['key', 'k', 'name', 'Name', 'Key', 'K'].filter(function (x) { return Object.prototype.hasOwnProperty.call(e, x) && e[x] !== null && e[x] !== false; })[0]; k = kc === undefined ? null : e[kc]; var vc = ['value', 'v', 'Value', 'V'].filter(function (x) { return Object.prototype.hasOwnProperty.call(e, x); })[0]; val = vc === undefined ? null : e[vc]; } else throw err('Cannot index ' + typeOf(e) + ' with "key"');
        if (typeof k === 'string') { } else if (k === null) k = 'null'; else if (typeof k === 'number' || typeof k === 'boolean') k = toJson(k); else throw err('Cannot use ' + typeOf(k) + ' (' + trunc(k) + ') as object key');
        o[k] = val;
      });
      return o;
    },
    any: function (v) { return iterate(v).some(truthy); }, all: function (v) { return iterate(v).every(truthy); },
    isinfinite: function (v) { return num(v, 'checked') === Infinity || v === -Infinity; }, isnan: function (v) { var x = num(v, 'checked'); return x !== x; }, isnormal: function (v) { var x = num(v, 'checked'); return isFinite(x) && x !== 0; },
    infinite: function () { return Infinity; }, nan: function () { return NaN; },
    null: function () { return null; }, true: function () { return true; }, false: function () { return false; },
    now: function () { return Date.now() / 1000; },
    todate: function (v) { return fmtDate(num(v, 'formatted as date'), '%Y-%m-%dT%H:%M:%SZ'); },
    fromdate: function (v) { return fromIso(v); }, fromdateiso8601: function (v) { return fromIso(v); }, todateiso8601: function (v) { return fmtDate(num(v, 'formatted as date'), '%Y-%m-%dT%H:%M:%SZ'); }, dateadd: null,
    date: function (v) { return fmtDate(num(v, 'formatted as date'), '%Y-%m-%dT%H:%M:%SZ'); },
    gmtime: brokenDown, mktime: mktime,
    toarray: function (v) { return Array.isArray(v) ? v : [v]; },
    ascii: function (v) { return String.fromCharCode(v); },
    input_line_number: function () { return 0; }, input_filename: function () { return null; },
    env: function () { return {}; }, halt: function () { throw new JQError({ __halt: true }); },
  };
  function fromIso(v) { str(v, 'parsed as a date'); var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(v); if (!m) throw err('date "' + v + '" does not match format "%Y-%m-%dT%H:%M:%SZ"'); return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000); }
  function num(v, what) { if (typeof v !== 'number') throw err(typeOf(v) + ' (' + trunc(v) + ') number required'); return v; }
  function keysOfU(v) { if (isObj(v)) return Object.keys(v); throw err(typeOf(v) + ' (' + trunc(v) + ') has no keys'); }

  /* 값 인자를 받는 함수들: f(input, a1, a2...) */
  var FV = {
    'has/1': function (v, k) { if (isObj(v) && typeof k === 'string') return Object.prototype.hasOwnProperty.call(v, k); if (Array.isArray(v) && typeof k === 'number') return k >= 0 && k < v.length; throw err('Cannot check whether ' + typeOf(v) + ' has a ' + (typeof k === 'string' ? 'string' : typeOf(k)) + ' key'); },
    'contains/1': contains, 'inside/1': function (v, b) { return contains(b, v); },
    'startswith/1': function (v, s) { if (typeof v !== 'string' || typeof s !== 'string') throw err('startswith() requires string inputs'); return v.indexOf(s) === 0; },
    'endswith/1': function (v, s) { if (typeof v !== 'string' || typeof s !== 'string') throw err('endswith() requires string inputs'); return v.length >= s.length && v.slice(v.length - s.length) === s; },
    'ltrimstr/1': function (v, s) { return typeof v === 'string' && typeof s === 'string' && v.indexOf(s) === 0 ? v.slice(s.length) : v; },
    'rtrimstr/1': function (v, s) { return typeof v === 'string' && typeof s === 'string' && s !== '' && v.length >= s.length && v.slice(v.length - s.length) === s ? v.slice(0, v.length - s.length) : v; },
    'trimstr/1': function (v, s) { var r = FV['ltrimstr/1'](v, s); return FV['rtrimstr/1'](r, s); },
    'split/1': function (v, s) { if (typeof v !== 'string' || typeof s !== 'string') throw err('split input and separator must be strings'); return splitStr(v, s); },
    'join/1': function (v, s) { var items = iterate(v); if (!items.length) return ''; if (typeof s !== 'string') { if (items.length === 1) { } else throw err(typeOf(s) + ' (' + trunc(s) + ') and string cannot be added'); } return items.map(function (x) { if (x === null) return ''; if (typeof x === 'string') return x; if (typeof x === 'number' || typeof x === 'boolean') return toJson(x); throw err('string (' + trunc(s) + ') and ' + typeOf(x) + ' (' + trunc(x) + ') cannot be added'); }).join(s); },
    'index/1': function (v, s) { var r = indicesFn(v, s); return r === null || !r.length ? null : r[0]; },
    'rindex/1': function (v, s) { var r = indicesFn(v, s); return r === null || !r.length ? null : r[r.length - 1]; },
    'indices/1': function (v, s) { return indicesFn(v, s); }, '_indices/1': function (v, s) { return indicesFn(v, s); },
    'flatten/1': function (v, d) { if (d < 0) throw err('flatten depth must not be negative'); if (!Array.isArray(v)) throw err('Cannot iterate over ' + typeOf(v)); return flatten(v, d); },
    'pow/2': function (v, a, b) { return Math.pow(num(a), num(b)); }, 'atan2/2': function (v, a, b) { return Math.atan2(num(a), num(b)); }, 'fmin/2': function (v, a, b) { return Math.min(a, b); }, 'fmax/2': function (v, a, b) { return Math.max(a, b); }, 'fmod/2': function (v, a, b) { return a % b; },
    'getpath/1': function (v, p) { if (!Array.isArray(p)) throw err('Path must be specified as an array'); try { return getpath(v, p); } catch (e) { if (e instanceof JQError) return null; throw e; } },
    'setpath/2': function (v, p, x) { if (!Array.isArray(p)) throw err('Path must be specified as an array'); return setpath(v, p, x); },
    'delpaths/1': function (v, ps) { if (!Array.isArray(ps)) throw err('Paths must be specified as an array'); return delpaths(v, ps); },
    'tojson/0': null,
    'error/1': function (v, m) { throw new JQError(m); },
    'strftime/1': function (v, f) { if (Array.isArray(v)) v = mktime(v); return fmtDate(num(v, 'formatted as date'), f); }, 'strflocaltime/1': function (v, f) { if (Array.isArray(v)) v = mktime(v); return fmtDate(num(v, 'formatted'), f); },
    'strptime/1': function (v, f) { var m = /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)?(\d{2})?:?(\d{2})?:?(\d{2})?Z?$/.exec(v); if (!m) throw err('date "' + v + '" does not match format "' + f + '"'); var sec = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1000; return brokenDown(sec); },
    'splits/1': null,
    'bsearch/1': function (v, x) { var lo = 0, hi = v.length - 1; while (lo <= hi) { var mid = (lo + hi) >> 1, c = cmp(v[mid], x); if (c === 0) return mid; if (c < 0) lo = mid + 1; else hi = mid - 1; } return -1 - lo; },
    'combinations/0': null,
    'test/1': function (v, re) { return matches(v, Array.isArray(re) ? re[0] : re, Array.isArray(re) ? re[1] : null, false).length > 0; },
    'test/2': function (v, re, fl) { return matches(v, re, fl, false).length > 0; },
    'ascii/0': null,
    'input/0': null,
    'ltrimstr2/1': null
  };
  function indicesFn(v, s) {
    if (v === null) return null;
    if (typeof v === 'string' && typeof s === 'string') { if (s === '') return null; var r = [], i = -1; var cps = Array.from(v); var sj = v; var at = sj.indexOf(s); while (at >= 0) { r.push(cpOffset(v, at)); at = sj.indexOf(s, at + 1); } return r; }
    if (Array.isArray(v) && Array.isArray(s)) return indicesOf(v, s);
    if (Array.isArray(v)) { var o = []; v.forEach(function (x, j) { if (eq(x, s)) o.push(j); }); return o; }
    throw err('Cannot determine indices of ' + typeOf(s) + ' in ' + typeOf(v));
  }
  function matchObjToCapture(m) { var o = {}; m.captures.forEach(function (c) { if (c.name) o[c.name] = c.string; }); return o; }

  var NATIVE = {}, NATIVE_PATH = {};
  Object.keys(F0).forEach(function (k) { var f = F0[k]; if (typeof f !== 'function') return; NATIVE[k + '/0'] = function* (v) { yield f(v); }; });
  Object.keys(FV).forEach(function (k) {
    var f = FV[k]; if (typeof f !== 'function') return; var ar = Number(k.split('/')[1]);
    NATIVE[k] = function* (v, args, env) { for (var vals of cart(args, v, env)) yield f.apply(null, [v].concat(vals)); };
  });
  NATIVE['empty/0'] = function* () { };
  NATIVE['error/0'] = function* (v) { throw new JQError(v); };
  NATIVE['select/1'] = function* (v, args, env) { for (var c of ev(args[0], v, env)) if (truthy(c)) yield v; };
  NATIVE['map/1'] = function* (v, args, env) { var out = []; for (var x of iterate(v)) for (var y of ev(args[0], x, env)) out.push(y); yield out; };
  NATIVE['map_values/1'] = function* (v, args, env) { if (Array.isArray(v)) { var o = []; v.forEach(function (x) { var g = ev(args[0], x, env).next(); if (!g.done) o.push(g.value); }); yield o; } else if (isObj(v)) { var oo = {}; Object.keys(v).forEach(function (k) { var g = ev(args[0], v[k], env).next(); if (!g.done) oo[k] = g.value; }); yield oo; } else throw err('Cannot iterate over ' + typeOf(v)); };
  NATIVE['recurse/0'] = function* (v) { yield* recurseDefault(v); };
  NATIVE['recurse/1'] = function* (v, args, env) { function* r(x) { yield x; for (var y of ev(args[0], x, env)) yield* r(y); } yield* r(v); };
  NATIVE['recurse/2'] = function* (v, args, env) { function* r(x) { yield x; for (var y of ev(args[0], x, env)) { var ok = false; for (var c of ev(args[1], y, env)) if (truthy(c)) { ok = true; break; } if (ok) yield* r(y); } } yield* r(v); };
  NATIVE['values/0'] = function* (v) { if (v !== null) yield v; };
  NATIVE['nulls/0'] = function* (v) { if (v === null) yield v; };
  ['booleans', 'numbers', 'strings', 'arrays', 'objects'].forEach(function (nm) { var ty = nm.slice(0, -1); NATIVE[nm + '/0'] = function* (v) { if (typeOf(v) === ty) yield v; }; });
  NATIVE['iterables/0'] = function* (v) { if (v !== null && typeof v === 'object') yield v; };
  NATIVE['scalars/0'] = function* (v) { if (v === null || typeof v !== 'object') yield v; };
  NATIVE['range/1'] = function* (v, args, env) { for (var n of ev(args[0], v, env)) { if (typeof n !== 'number') throw err('Range bounds must be numeric'); for (var i = 0; i < n; i++) yield i; } };
  NATIVE['range/2'] = function* (v, args, env) { for (var a of ev(args[0], v, env)) for (var b of ev(args[1], v, env)) { if (typeof a !== 'number' || typeof b !== 'number') throw err('Range bounds must be numeric'); for (var i = a; i < b; i++) yield i; } };
  NATIVE['range/3'] = function* (v, args, env) { for (var a of ev(args[0], v, env)) for (var b of ev(args[1], v, env)) for (var s of ev(args[2], v, env)) { if (typeof a !== 'number' || typeof b !== 'number' || typeof s !== 'number') throw err('Range bounds must be numeric'); if (s > 0) for (var i = a; i < b; i += s) yield i; else if (s < 0) for (var j = a; j > b; j += s) yield j; else if (a < b) while (true) yield a; } };
  NATIVE['limit/2'] = function* (v, args, env) { for (var n of ev(args[0], v, env)) { if (n <= 0) continue; var c = 0; for (var x of ev(args[1], v, env)) { yield x; if (++c >= n) break; } } };
  NATIVE['first/1'] = function* (v, args, env) { for (var x of ev(args[0], v, env)) { yield x; return; } };
  NATIVE['last/1'] = function* (v, args, env) { var has = false, last; for (var x of ev(args[0], v, env)) { has = true; last = x; } if (has) yield last; };
  NATIVE['nth/2'] = function* (v, args, env) { for (var n of ev(args[0], v, env)) { if (n < 0) throw err('Out of bounds negative array index'); var c = 0; for (var x of ev(args[1], v, env)) { if (c++ === n) { yield x; break; } } } };
  NATIVE['first/0'] = function* (v) { yield idx(v, 0); };
  NATIVE['last/0'] = function* (v) { yield idx(v, -1); };
  NATIVE['nth/1'] = function* (v, args, env) { for (var n of ev(args[0], v, env)) yield idx(v, n); };
  NATIVE['isempty/1'] = function* (v, args, env) { for (var x of ev(args[0], v, env)) { yield false; return; } yield true; };
  NATIVE['until/2'] = function* (v, args, env) { function* go(x) { for (var c of ev(args[0], x, env)) { if (truthy(c)) yield x; else for (var y of ev(args[1], x, env)) yield* go(y); } } yield* go(v); };
  NATIVE['while/2'] = function* (v, args, env) { function* go(x) { for (var c of ev(args[0], x, env)) { if (truthy(c)) { yield x; for (var y of ev(args[1], x, env)) yield* go(y); } } } yield* go(v); };
  NATIVE['repeat/1'] = function* (v, args, env) { function* go(x) { yield x; for (var y of ev(args[0], x, env)) yield* go(y); } yield* go(v); };
  NATIVE['any/1'] = function* (v, args, env) { for (var x of iterate(v)) for (var c of ev(args[0], x, env)) if (truthy(c)) { yield true; return; } yield false; };
  NATIVE['all/1'] = function* (v, args, env) { for (var x of iterate(v)) for (var c of ev(args[0], x, env)) if (!truthy(c)) { yield false; return; } yield true; };
  NATIVE['any/2'] = function* (v, args, env) { for (var x of ev(args[0], v, env)) for (var c of ev(args[1], x, env)) if (truthy(c)) { yield true; return; } yield false; };
  NATIVE['all/2'] = function* (v, args, env) { for (var x of ev(args[0], v, env)) for (var c of ev(args[1], x, env)) if (!truthy(c)) { yield false; return; } yield true; };
  NATIVE['add/1'] = function* (v, args, env) { var acc = null; for (var x of ev(args[0], v, env)) acc = add(acc, x); yield acc; };
  function keyed(args, env) { return function (x) { var r = []; for (var k of ev(args[0], x, env)) r.push(k); return r; }; }
  NATIVE['sort_by/1'] = function* (v, args, env) { if (!Array.isArray(v)) throw err(typeOf(v) + ' (' + trunc(v) + ') cannot be sorted, as it is not an array'); yield sortBy(v, keyed(args, env)).map(function (i) { return i.x; }); };
  NATIVE['group_by/1'] = function* (v, args, env) { if (!Array.isArray(v)) throw err('Cannot index ' + typeOf(v) + ' with number'); var s = sortBy(v, keyed(args, env)), out = [], lastK = null; s.forEach(function (i) { if (out.length && eq(lastK, i.k)) out[out.length - 1].push(i.x); else { out.push([i.x]); lastK = i.k; } }); yield out; };
  NATIVE['unique_by/1'] = function* (v, args, env) { var s = sortBy(v, keyed(args, env)), out = [], lastK = null; s.forEach(function (i) { if (!out.length || !eq(lastK, i.k)) { out.push(i.x); lastK = i.k; } }); yield out; };
  NATIVE['min_by/1'] = function* (v, args, env) { var f = keyed(args, env), best = null, bk = null, has = false; iterate(v).forEach(function (x) { var k = f(x); if (!has || cmp(k, bk) < 0) { best = x; bk = k; has = true; } }); yield has ? best : null; };
  NATIVE['max_by/1'] = function* (v, args, env) { var f = keyed(args, env), best = null, bk = null, has = false; iterate(v).forEach(function (x) { var k = f(x); if (!has || cmp(k, bk) >= 0) { best = x; bk = k; has = true; } }); yield has ? best : null; };
  NATIVE['with_entries/1'] = function* (v, args, env) { var ents = F0.to_entries(v), out = []; ents.forEach(function (e) { for (var y of ev(args[0], e, env)) out.push(y); }); yield F0.from_entries(out); };
  NATIVE['walk/1'] = function* (v, args, env) { function* w(x) { var y; if (Array.isArray(x)) { var a = []; for (var e of x) for (var r of w(e)) a.push(r); y = a; } else if (isObj(x)) { var o = {}; for (var k of Object.keys(x)) { var g = w(x[k]).next(); if (!g.done) o[k] = g.value; } y = o; } else y = x; yield* ev(args[0], y, env); } yield* w(v); };
  NATIVE['paths/0'] = function* (v) { for (var pv of recursePaths([], v)) if (pv[0].length) yield pv[0]; };
  NATIVE['paths/1'] = function* (v, args, env) { for (var pv of recursePaths([], v)) if (pv[0].length) for (var c of ev(args[0], pv[1], env)) if (truthy(c)) yield pv[0]; };
  NATIVE['leaf_paths/0'] = function* (v) { for (var pv of recursePaths([], v)) if (pv[0].length && (pv[1] === null || typeof pv[1] !== 'object')) yield pv[0]; };
  NATIVE['path/1'] = function* (v, args, env) { for (var pv of evp(args[0], [[], v], env)) { if (pv[0] === null) throw err('Invalid path expression with result ' + trunc(pv[1])); yield pv[0]; } };
  NATIVE['del/1'] = function* (v, args, env) { var ps = []; for (var pv of evp(args[0], [[], v], env)) { if (pv[0] === null) throw err('Invalid path expression with result ' + trunc(pv[1])); ps.push(pv[0]); } yield delpaths(v, ps); };
  NATIVE['to_entries/0'] = function* (v) { yield F0.to_entries(v); };
  NATIVE['pick/1'] = function* (v, args, env) { var out = null; for (var pv of evp(args[0], [[], v], env)) { if (pv[0] === null) throw err('Invalid path expression'); out = setpath(out, pv[0], getpath(v, pv[0])); } yield out; };
  NATIVE['splits/1'] = function* (v, args, env) { for (var re of ev(args[0], v, env)) { var ms = matches(v, re, 'g', true), pos = 0, cps = v; ms.forEach(function () { }); var last = 0, chars = Array.from(v); for (var m of ms) { yield chars.slice(last, m.offset).join(''); last = m.offset + m.length; } yield chars.slice(last).join(''); } };
  NATIVE['splits/2'] = function* (v, args, env) { for (var re of ev(args[0], v, env)) for (var fl of ev(args[1], v, env)) { var ms = matches(v, re, (fl || '') + 'g', true), last = 0, chars = Array.from(v); for (var m of ms) { yield chars.slice(last, m.offset).join(''); last = m.offset + m.length; } yield chars.slice(last).join(''); } };
  NATIVE['split/2'] = function* (v, args, env) { for (var re of ev(args[0], v, env)) for (var fl of ev(args[1], v, env)) { var ms = matches(v, re, (fl || '') + 'g', true), last = 0, chars = Array.from(v), out = []; for (var m of ms) { out.push(chars.slice(last, m.offset).join('')); last = m.offset + m.length; } out.push(chars.slice(last).join('')); yield out; } };
  function* matchGen(v, args, env, mode) {
    for (var vals of cart(args, v, env)) {
      var re = vals[0], fl = vals.length > 1 ? vals[1] : null;
      if (Array.isArray(re)) { fl = re[1]; re = re[0]; }
      for (var m of matches(v, re, fl, mode.global)) yield mode.fn(m);
    }
  }
  NATIVE['match/1'] = function* (v, a, e) { yield* matchGen(v, a, e, { global: false, fn: function (m) { return m; } }); };
  NATIVE['match/2'] = function* (v, a, e) { var g = false; for (var vals of cart(a, v, e)) { var fl = vals[1] || ''; for (var m of matches(v, vals[0], fl, false)) yield m; } };
  NATIVE['capture/1'] = function* (v, a, e) { yield* matchGen(v, a, e, { global: false, fn: matchObjToCapture }); };
  NATIVE['capture/2'] = function* (v, a, e) { for (var vals of cart(a, v, e)) for (var m of matches(v, vals[0], vals[1], false)) yield matchObjToCapture(m); };
  NATIVE['scan/1'] = function* (v, a, e) { for (var vals of cart(a, v, e)) for (var m of matches(v, vals[0], 'g', true)) yield m.captures.length ? m.captures.map(function (c) { return c.string; }) : m.string; };
  NATIVE['scan/2'] = function* (v, a, e) { for (var vals of cart(a, v, e)) for (var m of matches(v, vals[0], (vals[1] || '') + 'g', true)) yield m.captures.length ? m.captures.map(function (c) { return c.string; }) : m.string; };
  function* subGen(v, args, env, glob) {
    for (var re of ev(args[0], v, env)) {
      var fl = args[2] ? Array.from(ev(args[2], v, env))[0] : '';
      var ms = matches(v, re, (fl || '') + (glob ? 'g' : ''), glob);
      var chars = Array.from(v);
      function* build(i, last, acc) {
        if (i === ms.length) { yield acc + chars.slice(last).join(''); return; }
        var m = ms[i];
        for (var rep of ev(args[1], matchObjToCapture(m), env)) {
          if (typeof rep !== 'string') throw err(typeOf(acc) + ' (' + trunc(acc) + ') and ' + typeOf(rep) + ' (' + trunc(rep) + ') cannot be added');
          yield* build(i + 1, m.offset + m.length, acc + chars.slice(last, m.offset).join('') + rep);
        }
      }
      yield* build(0, 0, '');
    }
  }
  NATIVE['sub/2'] = function* (v, a, e) { yield* subGen(v, a, e, false); };
  NATIVE['sub/3'] = function* (v, a, e) { yield* subGen(v, a, e, false); };
  NATIVE['gsub/2'] = function* (v, a, e) { yield* subGen(v, a, e, true); };
  NATIVE['gsub/3'] = function* (v, a, e) { yield* subGen(v, a, e, true); };
  NATIVE['ascii/0'] = function* (v) { yield String.fromCharCode(v); };
  NATIVE['combinations/0'] = function* (v) { function* go(i, acc) { if (i === v.length) { yield acc.slice(); return; } for (var x of v[i]) { acc.push(x); yield* go(i + 1, acc); acc.pop(); } } yield* go(0, []); };
  NATIVE['combinations/1'] = function* (v, args, env) { for (var n of ev(args[0], v, env)) { var arr = []; for (var i = 0; i < n; i++) arr.push(v); yield* NATIVE['combinations/0'](arr); } };
  NATIVE['IN/1'] = function* (v, args, env) { for (var x of ev(args[0], v, env)) if (eq(x, v)) { yield true; return; } yield false; };
  NATIVE['IN/2'] = function* (v, args, env) { for (var s of ev(args[0], v, env)) for (var x of ev(args[1], v, env)) if (eq(x, s)) { yield true; return; } yield false; };
  NATIVE['in/1'] = function* (v, args, env) { for (var o of ev(args[0], v, env)) yield FV['has/1'](o, v); };
  NATIVE['getpath/1'] = function* (v, args, env) { for (var p of ev(args[0], v, env)) yield FV['getpath/1'](v, p); };
  NATIVE_PATH['getpath/1'] = function* (pv, args, env) { for (var p of ev(args[0], pv[1], env)) { if (pv[0] === null) throw err('Invalid path expression with result ' + trunc(pv[1])); var val; try { val = getpath(pv[1], p); } catch (e) { val = null; } yield [pv[0].concat(p), val]; } };
  NATIVE_PATH['empty/0'] = function* () { };
  NATIVE_PATH['error/0'] = function* (pv) { throw new JQError(pv[1]); };
  NATIVE_PATH['error/1'] = function* (pv, args, env) { for (var m of ev(args[0], pv[1], env)) throw new JQError(m); };
  NATIVE_PATH['select/1'] = function* (pv, args, env) { for (var c of ev(args[0], pv[1], env)) if (truthy(c)) yield pv; };
  NATIVE_PATH['recurse/0'] = function* (pv) { if (pv[0] === null) throw err('Invalid path expression'); yield* recursePaths(pv[0], pv[1]); };
  NATIVE_PATH['recurse/1'] = function* (pv, args, env) { function* r(x) { yield x; for (var y of evp(args[0], x, env)) yield* r(y); } yield* r(pv); };
  NATIVE_PATH['recurse/2'] = function* (pv, args, env) { function* r(x) { yield x; for (var y of evp(args[0], x, env)) { var ok = false; for (var c of ev(args[1], y[1], env)) if (truthy(c)) { ok = true; break; } if (ok) yield* r(y); } } yield* r(pv); };
  NATIVE_PATH['first/1'] = function* (pv, args, env) { for (var x of evp(args[0], pv, env)) { yield x; return; } };
  NATIVE_PATH['last/1'] = function* (pv, args, env) { var has = false, l; for (var x of evp(args[0], pv, env)) { has = true; l = x; } if (has) yield l; };
  NATIVE_PATH['limit/2'] = function* (pv, args, env) { for (var n of ev(args[0], pv[1], env)) { if (n <= 0) continue; var c = 0; for (var x of evp(args[1], pv, env)) { yield x; if (++c >= n) break; } } };
  NATIVE_PATH['first/0'] = function* (pv) { yield [pv[0].concat([0]), idx(pv[1], 0)]; };
  NATIVE_PATH['last/0'] = function* (pv) { yield [pv[0].concat([-1]), idx(pv[1], -1)]; };
  NATIVE_PATH['paths/0'] = null; NATIVE_PATH['values/0'] = function* (pv) { if (pv[1] !== null) yield pv; };
  ['nulls', 'booleans', 'numbers', 'strings', 'arrays', 'objects', 'iterables', 'scalars'].forEach(function (nm) { NATIVE_PATH[nm + '/0'] = function* (pv) { for (var out of NATIVE[nm + '/0'](pv[1])) yield pv; }; });
  NATIVE_PATH['map/1'] = null; NATIVE_PATH['to_entries/0'] = null;
  Object.keys(NATIVE_PATH).forEach(function (k) { if (!NATIVE_PATH[k]) delete NATIVE_PATH[k]; });
  Object.keys(NATIVE).forEach(function (k) { if (!NATIVE[k]) delete NATIVE[k]; });
  NATIVE['input/0'] = function* () { if (!INPUTS.length) throw err('No more inputs'); yield INPUTS.shift(); };
  NATIVE['inputs/0'] = function* () { while (INPUTS.length) yield INPUTS.shift(); };
  NATIVE['debug/0'] = function* (v) { Q.debugLog.push(['DEBUG:', v]); yield v; };
  NATIVE['debug/1'] = function* (v, args, env) { for (var m of ev(args[0], v, env)) Q.debugLog.push(['DEBUG:', m]); yield v; };
  NATIVE['stderr/0'] = function* (v) { Q.debugLog.push(['STDERR:', v]); yield v; };
  NATIVE['halt/0'] = function* () { throw new JQError({ __halt: true }); };
  NATIVE['halt_error/0'] = function* (v) { throw new JQError({ __halt: true, msg: v }); };
  NATIVE['halt_error/1'] = function* (v) { throw new JQError({ __halt: true, msg: v }); };
  NATIVE['tostream/0'] = function* (v) {
    function* go(path, x, top) {
      if (Array.isArray(x) && x.length) { for (var i = 0; i < x.length; i++) yield* go(path.concat([i]), x[i], false); yield [path.concat([x.length - 1])]; }
      else if (isObj(x) && Object.keys(x).length) { var ks = Object.keys(x); for (var j = 0; j < ks.length; j++) yield* go(path.concat([ks[j]]), x[ks[j]], false); yield [path.concat([ks[ks.length - 1]])]; }
      else yield [path, x];
    }
    yield* (function* () { var all = Array.from(go([], v, true)); for (var e of all) yield e; })();
  };
  NATIVE['fromstream/1'] = function* (v, args, env) { var cur = null, has = false; for (var ev1 of ev(args[0], v, env)) { if (ev1.length === 2) { cur = setpath(cur, ev1[0], ev1[1]); has = true; if (ev1[0].length === 0) { yield cur; cur = null; has = false; } } else if (ev1.length === 1 && ev1[0].length <= 1) { if (has) yield cur; cur = null; has = false; } } };
  NATIVE['truncate_stream/1'] = function* (v, args, env) { for (var d of ev({ type: 'lit', v: 0 }, v, env)) { } yield* []; };
  NATIVE['env/0'] = function* () { yield {}; };
  NATIVE['builtins/0'] = function* () { yield Object.keys(NATIVE); };
  NATIVE['input_line_number/0'] = function* () { yield 0; };
  NATIVE['significand/0'] = function* (v) { yield v === 0 ? 0 : v / Math.pow(2, Math.floor(Math.log2(Math.abs(v)))); };
  NATIVE['abs/0'] = function* (v) { yield F0.abs(v); };
  NATIVE['have_literal_numbers/0'] = function* () { yield true; };
  NATIVE['have_decnum/0'] = function* () { yield false; };
  NATIVE['tojson/0'] = function* (v) { yield toJson(v); };
  Object.keys(NATIVE).forEach(function (k) { if (!NATIVE[k] || /unused/.test(k)) delete NATIVE[k]; });
  Q.debugLog = [];

  /* ------------------------------------------------------- 공개 실행 API */
  /** program: 문자열, inputs: 값 배열, opts: {args: {name: value}, nullInput, slurp}. 반환 {outputs, errors, debug} */
  Q.run = function (program, inputs, opts) {
    opts = opts || {};
    var ast = parse(program), outputs = [], errors = [];
    STEPS = 0; Q.debugLog = [];
    var env = new Env(null);
    var named = {}; Object.keys(opts.args || {}).forEach(function (k) { named[k] = opts.args[k]; });
    env = withVar(env, 'ENV', {}); env = withVar(env, '__prog_args', []); env = withVar(env, 'named', named);
    Object.keys(named).forEach(function (k) { env = withVar(env, k, named[k]); });
    env = withVar(env, '__named', named);
    var queue = opts.nullInput ? [null] : (opts.slurp ? [inputs] : inputs.slice());
    INPUTS = opts.nullInput ? inputs.slice() : queue;
    var halted = false, idxIn = 0;
    while (queue.length && !halted) {
      var cur = queue.shift(), gen = ev(ast, cur, env); idxIn++;
      while (true) {
        var nx;
        try { nx = gen.next(); } catch (e) {
          if (e instanceof JQError) { if (e.val && e.val.__halt) { halted = true; if (e.val.msg !== undefined) errors.push({ halt: true, msg: e.val.msg }); break; } errors.push({ input: idxIn - 1, val: e.val }); break; }
          if (e instanceof BreakErr) { errors.push({ input: idxIn - 1, val: 'break' }); break; }
          if (e instanceof RangeError) { errors.push({ input: idxIn - 1, val: '재귀가 너무 깊습니다' }); break; }
          throw e;
        }
        if (nx.done) break; outputs.push(nx.value);
        if (outputs.length > 20000) { errors.push({ input: idxIn - 1, val: '출력이 20,000개를 넘어 중단했습니다' }); halted = true; break; }
      }
    }
    return { outputs: outputs, errors: errors, debug: Q.debugLog.slice() };
  };
  Q.toJson = toJson;
  Q.errorMessage = function (val) { return typeof val === 'string' ? val : toJson(val) + ' (not a string)'; };
  /** 연속된 JSON 값 파서 */
  Q.parseInputs = function (text) {
    var out = [], i = 0, n = text.length;
    function ws() { while (i < n && /\s/.test(text[i])) i++; }
    while (true) {
      ws(); if (i >= n) break;
      var c = text[i], start = i;
      if (c === '{' || c === '[') {
        var depth = 0, inStr = false;
        for (; i < n; i++) { var ch = text[i]; if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; } if (ch === '"') inStr = true; else if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') { depth--; if (depth === 0) { i++; break; } } }
        if (depth) throw err('입력 JSON 이 끝나지 않았습니다 (위치 ' + start + ')');
      } else if (c === '"') { i++; while (i < n && text[i] !== '"') { if (text[i] === '\\') i++; i++; } i++; }
      else { while (i < n && !/[\s,\]\[{}"]/.test(text[i])) i++; if (i === start) i++; }
      var piece = text.slice(start, i);
      try { out.push(JSON.parse(piece)); } catch (e) { if (piece === 'NaN' || piece === 'nan') out.push(NaN); else throw err('입력 JSON 오류: ' + e.message.replace(/^JSON\.parse: /, '') + ' (' + piece.slice(0, 30) + ')'); }
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
