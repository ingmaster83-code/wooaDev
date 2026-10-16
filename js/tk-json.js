/* WooaDev Tool Kit — JSON 공용 함수 (엄격 파서·통계·비교·경로) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var J = TK.json = TK.json || {};
  var t = function (a, b) { return TK.t(a, b); };
  var MAX_DEPTH = 3000;

  J.kind = function (v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; };

  J.pathStr = function (parts) {
    var s = '$';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (typeof p === 'number') s += '[' + p + ']';
      else if (/^[A-Za-z_$][\w$]*$/.test(p)) s += '.' + p;
      else s += "['" + p.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "']";
    }
    return s;
  };

  J.setProp = function (o, k, v) {
    if (k === '__proto__') Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
    else o[k] = v;
  };

  /**
   * 엄격한 JSON 파서. 오류에 줄·열을 붙이고 중복 키를 수집한다.
   * opts.multi=true 이면 공백으로 이어진 여러 최상위 값을 {values:[...]} 로 돌려준다.
   */
  J.parse = function (text, opts) {
    opts = opts || {};
    var s = String(text), n = s.length, i = 0, dups = [], path = [];
    if (s.charCodeAt(0) === 0xFEFF) i = 1;

    function lc(p) {
      var line = 1, col = 1;
      for (var k = 0; k < p && k < n; k++) { if (s.charCodeAt(k) === 10) { line++; col = 1; } else col++; }
      return { line: line, col: col };
    }
    function fail(msg, p) {
      if (p == null) p = i;
      var q = lc(p);
      var e = new Error(msg + ' (' + t('줄 ', 'line ') + q.line + t(', 열 ', ', col ') + q.col + ')');
      e.pos = p; e.line = q.line; e.col = q.col; e.reason = msg;
      throw e;
    }
    function ws() { while (i < n) { var c = s.charCodeAt(i); if (c === 32 || c === 9 || c === 10 || c === 13) i++; else break; } }
    function show(c) { return c === '\n' ? '\\n' : c === '\t' ? '\\t' : c; }
    function unexpected() {
      if (i >= n) fail(t('입력이 도중에 끝났습니다 (닫는 괄호나 따옴표가 빠졌을 수 있습니다)', 'Unexpected end of input (a closing bracket or quote may be missing)'));
      var c = s[i];
      if (c === "'") fail(t("작은따옴표 문자열은 JSON에서 쓸 수 없습니다. 큰따옴표(\")를 사용하세요", 'Single-quoted strings are not valid JSON. Use double quotes (")'));
      if (c === '/' && (s[i + 1] === '/' || s[i + 1] === '*')) fail(t('주석은 JSON에서 허용되지 않습니다', 'Comments are not allowed in JSON'));
      if (c === '#') fail(t('주석(#)은 JSON에서 허용되지 않습니다', 'Comments (#) are not allowed in JSON'));
      var m = /^(undefined|NaN|Infinity|True|False|None|nil)\b/.exec(s.slice(i, i + 10));
      if (m) fail(t('"' + m[1] + '"은(는) JSON 값이 아닙니다 (true/false/null/숫자/문자열만 가능)', '"' + m[1] + '" is not a JSON value (only true/false/null, numbers and strings)'));
      if (/[A-Za-z_]/.test(c)) fail(t('따옴표 없는 문자열 "' + s.slice(i, i + 12).split(/[\s,\]}:]/)[0] + '"은(는) 허용되지 않습니다', 'Unquoted token "' + s.slice(i, i + 12).split(/[\s,\]}:]/)[0] + '" is not allowed'));
      fail(t("예상치 못한 문자 '" + show(c) + "'", "Unexpected character '" + show(c) + "'"));
    }
    function str() {
      var start = i; i++;
      var out = '', seg = i;
      while (true) {
        if (i >= n) fail(t('문자열이 닫히지 않았습니다 (끝나는 " 누락)', 'Unterminated string (missing closing ")'), start);
        var c = s.charCodeAt(i);
        if (c === 34) { out += s.slice(seg, i); i++; return out; }
        if (c < 32) fail(t('문자열 안에 줄바꿈·제어 문자가 있습니다. \\n 처럼 이스케이프해야 합니다', 'Raw newline/control character inside a string; escape it (e.g. \\n)'));
        if (c === 92) {
          out += s.slice(seg, i); i++;
          var e = s[i];
          if (e === '"' || e === '\\' || e === '/') out += e;
          else if (e === 'b') out += '\b'; else if (e === 'f') out += '\f'; else if (e === 'n') out += '\n';
          else if (e === 'r') out += '\r'; else if (e === 't') out += '\t';
          else if (e === 'u') {
            var hex = s.substr(i + 1, 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail(t('\\u 뒤에는 16진수 4자리가 필요합니다', '\\u must be followed by 4 hex digits'));
            out += String.fromCharCode(parseInt(hex, 16)); i += 4;
          } else fail(t("잘못된 이스케이프 \\" + (e || ''), 'Invalid escape \\' + (e || '')));
          i++; seg = i;
        } else i++;
      }
    }
    var NUM = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    function num() {
      NUM.lastIndex = i;
      var m = NUM.exec(s);
      if (!m) {
        if (s[i] === '-' ) fail(t('"-" 뒤에 숫자가 필요합니다', 'A digit is required after "-"'));
        unexpected();
      }
      var next = s[i + m[0].length];
      if (next !== undefined && /[0-9.]/.test(next) && m[0] !== '-') {
        if (m[0] === '0' && /\d/.test(next)) fail(t('숫자는 0으로 시작할 수 없습니다 (예: 007)', 'Numbers cannot have leading zeros (e.g. 007)'));
        if (next === '.') fail(t('소수점 뒤에 숫자가 필요합니다', 'A digit is required after the decimal point'), i + m[0].length);
      }
      i += m[0].length;
      return Number(m[0]);
    }
    function value(depth) {
      if (depth > MAX_DEPTH) fail(t('중첩이 너무 깊습니다', 'Nesting is too deep'));
      ws();
      if (i >= n) unexpected();
      var c = s[i];
      if (c === '{') return obj(depth);
      if (c === '[') return arr(depth);
      if (c === '"') return str();
      if (c === 't' && s.substr(i, 4) === 'true') { i += 4; return true; }
      if (c === 'f' && s.substr(i, 5) === 'false') { i += 5; return false; }
      if (c === 'n' && s.substr(i, 4) === 'null') { i += 4; return null; }
      if (c === '-' || (c >= '0' && c <= '9')) return num();
      unexpected();
    }
    function obj(depth) {
      var open = i, o = {}, seen = Object.create(null);
      i++; ws();
      if (s[i] === '}') { i++; return o; }
      while (true) {
        ws();
        if (i >= n) fail(t('객체가 닫히지 않았습니다 (} 누락)', 'Unclosed object (missing })'), open);
        if (s[i] === '}') fail(t('후행 쉼표(trailing comma)는 허용되지 않습니다', 'Trailing commas are not allowed'), lastComma);
        if (s[i] !== '"') {
          if (s[i] === "'" ) unexpected();
          if (/[A-Za-z_$0-9]/.test(s[i])) fail(t('속성 이름은 큰따옴표로 감싸야 합니다', 'Property names must be wrapped in double quotes'));
          unexpected();
        }
        var kp = i, k = str();
        if (seen[k]) dups.push({ path: J.pathStr(path), key: k, pos: kp, line: lc(kp).line, col: lc(kp).col });
        seen[k] = 1;
        ws();
        if (s[i] !== ':') fail(t('키 뒤에 콜론(:)이 필요합니다', 'A colon (:) is required after the key'));
        i++;
        path.push(k);
        var v = value(depth + 1);
        path.pop();
        J.setProp(o, k, v);
        ws();
        if (s[i] === ',') { var lastComma = i; i++; continue; }
        if (s[i] === '}') { i++; return o; }
        if (i >= n) fail(t('객체가 닫히지 않았습니다 (} 누락)', 'Unclosed object (missing })'), open);
        fail(t('값 뒤에 쉼표(,) 또는 }가 필요합니다', 'Expected a comma (,) or } after the value'));
      }
    }
    function arr(depth) {
      var open = i, a = [], idx = 0, lastComma = -1;
      i++; ws();
      if (s[i] === ']') { i++; return a; }
      while (true) {
        ws();
        if (i >= n) fail(t('배열이 닫히지 않았습니다 (] 누락)', 'Unclosed array (missing ])'), open);
        if (s[i] === ']') fail(t('후행 쉼표(trailing comma)는 허용되지 않습니다', 'Trailing commas are not allowed'), lastComma);
        path.push(idx++);
        a.push(value(depth + 1));
        path.pop();
        ws();
        if (s[i] === ',') { lastComma = i; i++; continue; }
        if (s[i] === ']') { i++; return a; }
        if (i >= n) fail(t('배열이 닫히지 않았습니다 (] 누락)', 'Unclosed array (missing ])'), open);
        fail(t('값 뒤에 쉼표(,) 또는 ]가 필요합니다', 'Expected a comma (,) or ] after the value'));
      }
    }

    if (opts.multi) {
      var vals = [];
      ws();
      while (i < n) { vals.push(value(0)); ws(); if (s[i] === ',') { i++; ws(); } }
      if (!vals.length) fail(t('JSON 값이 없습니다', 'No JSON value found'));
      return { values: vals, value: vals[0], dups: dups };
    }
    ws();
    if (i >= n) fail(t('입력이 비어 있습니다', 'Input is empty'));
    var v = value(0);
    ws();
    if (i < n) {
      if (s[i] === ',' ) fail(t('최상위에 여러 값이 있습니다. 하나의 JSON 값만 허용됩니다', 'Multiple top-level values; JSON allows only one'));
      fail(t("값이 끝난 뒤에 불필요한 문자 '" + show(s[i]) + "'가 있습니다", "Unexpected trailing character '" + show(s[i]) + "'"));
    }
    return { value: v, dups: dups };
  };

  /** 편의: 파싱만 하고 값 반환(오류는 줄·열 포함 Error) */
  J.parseValue = function (text, opts) { return J.parse(text, opts).value; };

  J.stats = function (v) {
    var st = { depth: 0, objects: 0, arrays: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0, keys: 0 };
    (function rec(x, d) {
      if (d > st.depth) st.depth = d;
      if (x === null) st.nulls++;
      else if (Array.isArray(x)) { st.arrays++; x.forEach(function (c) { rec(c, d + 1); }); }
      else if (typeof x === 'object') { st.objects++; Object.keys(x).forEach(function (k) { st.keys++; rec(x[k], d + 1); }); }
      else if (typeof x === 'string') st.strings++;
      else if (typeof x === 'number') st.numbers++;
      else if (typeof x === 'boolean') st.booleans++;
    })(v, 1);
    return st;
  };

  J.eq = function eq(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number' && a !== a && b !== b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false; return true; }
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) { var k = ka[j]; if (!Object.prototype.hasOwnProperty.call(b, k) || !eq(a[k], b[k])) return false; }
    return true;
  };

  J.fmt = function (v, indent) {
    var ind = indent === 'tab' || indent === '\t' ? '\t' : Number(indent) || 0;
    var s = JSON.stringify(v, null, ind || undefined);
    return s === undefined ? 'null' : s;
  };

  J.sortKeys = function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).sort().forEach(function (k) { J.setProp(o, k, sortKeys(v[k])); }); return o; }
    return v;
  };

  /** 짧은 값 요약(표 셀용) */
  J.brief = function (v, max) {
    max = max || 80;
    var s = v === undefined ? '' : JSON.stringify(v);
    if (s === undefined) s = String(v);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  };

  /**
   * 두 JSON 값의 차이를 [{op:'add'|'remove'|'change', path, a, b, typeChange}] 로 돌려준다.
   * opts.unordered: 배열 순서 무시. opts.looseNumbers: 1 과 1.0 은 JSON에서 같음(기본 동작).
   */
  J.diff = function (a, b, opts) {
    opts = opts || {};
    var out = [];
    function rec(x, y, p) {
      var kx = J.kind(x), ky = J.kind(y);
      if (kx !== ky) { out.push({ op: 'change', path: p, a: x, b: y, typeChange: true }); return; }
      if (kx === 'object') {
        Object.keys(x).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(y, k)) out.push({ op: 'remove', path: p.concat([k]), a: x[k] });
          else rec(x[k], y[k], p.concat([k]));
        });
        Object.keys(y).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(x, k)) out.push({ op: 'add', path: p.concat([k]), b: y[k] }); });
      } else if (kx === 'array') {
        if (opts.unordered) unordered(x, y, p);
        else {
          var m = Math.min(x.length, y.length), i;
          for (i = 0; i < m; i++) rec(x[i], y[i], p.concat([i]));
          for (i = m; i < x.length; i++) out.push({ op: 'remove', path: p.concat([i]), a: x[i] });
          for (i = m; i < y.length; i++) out.push({ op: 'add', path: p.concat([i]), b: y[i] });
        }
      } else if (x !== y && !(x !== x && y !== y)) out.push({ op: 'change', path: p, a: x, b: y });
    }
    function unordered(x, y, p) {
      var usedY = new Array(y.length), lx = [];
      x.forEach(function (xv, xi) {
        for (var j = 0; j < y.length; j++) if (!usedY[j] && J.eq(xv, y[j])) { usedY[j] = true; return; }
        lx.push(xi);
      });
      var ly = [];
      y.forEach(function (_, j) { if (!usedY[j]) ly.push(j); });
      var m = Math.min(lx.length, ly.length), i;
      for (i = 0; i < m; i++) rec(x[lx[i]], y[ly[i]], p.concat([lx[i]]));
      for (i = m; i < lx.length; i++) out.push({ op: 'remove', path: p.concat([lx[i]]), a: x[lx[i]] });
      for (i = m; i < ly.length; i++) out.push({ op: 'add', path: p.concat([ly[i]]), b: y[ly[i]] });
    }
    rec(a, b, []);
    return out;
  };

  /** diff 결과를 tk 표 형식으로 */
  J.diffTable = function (d, labels) {
    labels = labels || {};
    var L = { add: t('추가', 'Added'), remove: t('삭제', 'Removed'), change: t('변경', 'Changed') };
    return {
      head: [['구분', 'Type'], ['경로', 'Path'], [labels.a || '이전(A)', labels.a ? labels.a : 'Before (A)'], [labels.b || '이후(B)', labels.b ? labels.b : 'After (B)']],
      rows: d.map(function (x) {
        return { cls: x.op === 'add' ? 'r-add' : x.op === 'remove' ? 'r-del' : 'r-chg', cells: [L[x.op] + (x.typeChange ? t(' (타입)', ' (type)') : ''), J.pathStr(x.path), x.op === 'add' ? '' : J.brief(x.a), x.op === 'remove' ? '' : J.brief(x.b)] };
      }),
      empty: ['차이가 없습니다. 두 값이 같습니다.', 'No differences — both values are identical.']
    };
  };

  J.diffSummary = function (d) {
    var c = { add: 0, remove: 0, change: 0 };
    d.forEach(function (x) { c[x.op]++; });
    return t('추가 ' + c.add + ' · 삭제 ' + c.remove + ' · 변경 ' + c.change, 'Added ' + c.add + ' · Removed ' + c.remove + ' · Changed ' + c.change);
  };
})(typeof window !== 'undefined' ? window : globalThis);
