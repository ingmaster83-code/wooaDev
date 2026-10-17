/* WooaDev Tool Kit — 바이너리 입력(16진수/Base64/파일) · 헥스덤프 · 태그 값 JSON 직렬화 공용 모듈 */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var B = TK.binin = TK.binin || {};
  var t = function (a, b) { return TK.t(a, b); };

  /** 입력 정의: 텍스트(16진수/Base64) 또는 파일 */
  B.inputs = function (id, label, sample, rows) {
    return [
      { id: id, label: label, rows: rows || 6, sample: sample, show: function (o) { return o.mode !== 'file'; } },
      { id: 'file', type: 'file', buffer: true, label: ['파일 선택 (서버로 전송되지 않습니다)', 'Choose a file (never uploaded)'], show: function (o) { return o.mode === 'file'; } }
    ];
  };
  B.modeOption = function (extra) {
    return { id: 'mode', type: 'select', label: ['입력 방식', 'Input'], choices: [['text', ['16진수 / Base64 붙여 넣기', 'Paste hex / Base64']], ['file', ['파일 선택', 'Choose a file']]], default: 'text' };
  };
  B.fmtOption = function () {
    return { id: 'fmt', type: 'select', label: ['텍스트 형식', 'Text format'], choices: [['auto', ['자동 판별', 'Auto-detect']], ['hex', ['16진수', 'Hex']], ['b64', 'Base64']], default: 'auto', show: function (o) { return o.mode !== 'file'; } };
  };

  B.fromB64 = function (s) {
    var c = String(s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!c || /[^A-Za-z0-9+\/=]/.test(c)) throw new Error(t('Base64 가 아닌 문자가 있습니다', 'Not valid Base64'));
    c = c.replace(/=+$/, '');
    if (c.length % 4 === 1) throw new Error(t('Base64 길이가 올바르지 않습니다', 'Invalid Base64 length'));
    var bin = atob(c + '==='.slice(0, (4 - c.length % 4) % 4));
    var a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a;
  };
  B.toB64 = function (u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  B.toHex = function (u8, sep) { var out = []; for (var i = 0; i < u8.length; i++) out.push((u8[i] < 16 ? '0' : '') + u8[i].toString(16)); return out.join(sep == null ? '' : sep); };

  /** 입력 → Uint8Array. {bytes, kind, name} */
  B.get = function (v, o, id) {
    id = id || 'in';
    if (o.mode === 'file') {
      var f = v.file; if (!f || !f.buf) throw new Error(t('파일을 선택하세요', 'Choose a file'));
      return { bytes: new Uint8Array(f.buf), kind: 'file', name: f.name };
    }
    var s = String(v[id] || '').trim();
    if (!s) throw new Error(t('16진수 또는 Base64 를 입력하세요', 'Enter hex or Base64'));
    var hx = s.replace(/0x/gi, '').replace(/[\s,:\-]/g, ''), fmt = o.fmt || 'auto';
    var looksHex = /^[0-9a-fA-F]+$/.test(hx);
    if (fmt === 'hex' || (fmt === 'auto' && looksHex && hx.length % 2 === 0)) {
      if (!looksHex) throw new Error(t('16진수가 아닌 문자가 있습니다', 'Non-hex character found'));
      if (hx.length % 2) throw new Error(t('16진수 문자열의 길이가 홀수입니다', 'The hex string has an odd length'));
      var a = new Uint8Array(hx.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(hx.substr(i * 2, 2), 16);
      return { bytes: a, kind: 'hex', name: '' };
    }
    return { bytes: B.fromB64(s), kind: 'base64', name: '' };
  };

  B.hexdump = function (u8, max) {
    max = Math.min(max || 256, u8.length); var lines = [];
    for (var i = 0; i < max; i += 16) {
      var row = u8.subarray(i, Math.min(i + 16, max)), hex = '', asc = '';
      for (var j = 0; j < 16; j++) { hex += j < row.length ? (row[j] < 16 ? '0' : '') + row[j].toString(16) + ' ' : '   '; if (j === 7) hex += ' '; asc += j < row.length ? (row[j] >= 32 && row[j] < 127 ? String.fromCharCode(row[j]) : '.') : ''; }
      lines.push(('0000000' + i.toString(16)).slice(-8) + '  ' + hex + ' |' + asc + '|');
    }
    if (u8.length > max) lines.push('… ' + (u8.length - max) + t(' 바이트 생략', ' more bytes'));
    return lines.join('\n');
  };

  /* ---- 태그 값: plain(일반 JSON 표현) / ej(확장 JSON 표현) ---- */
  B.mark = function (plain, ej, rx) { return { __t: 'x', plain: plain, ej: ej === undefined ? plain : ej, rx: rx }; };
  B.isMark = function (x) { return x && typeof x === 'object' && x.__t === 'x'; };

  /** 값 → JSON 문자열. BigInt 는 숫자 그대로, Map 키는 문자열, Uint8Array 는 {"$binary": base64} */
  B.toJson = function (val, mode, indent) {
    indent = indent == null ? 2 : indent;
    function num(n) {
      if (typeof n === 'bigint') return n.toString();
      if (!isFinite(n)) return JSON.stringify(String(n));
      if (Object.is(n, -0)) return '-0';
      return String(n);
    }
    function ser(x, lvl) {
      var pad = indent ? '\n' + new Array(lvl + 2).join(' ').slice(0, 0) + new Array((lvl + 1) * indent + 1).join(' ') : '', padEnd = indent ? '\n' + new Array(lvl * indent + 1).join(' ') : '', sep = indent ? ': ' : ':';
      if (x === null || x === undefined) return x === undefined ? '{"$undefined":true}' : 'null';
      if (typeof x === 'boolean') return String(x);
      if (typeof x === 'number' || typeof x === 'bigint') return num(x);
      if (typeof x === 'string') return JSON.stringify(x);
      if (B.isMark(x)) return ser(mode === 'ejson' ? x.ej : mode === 'relaxed' ? (x.rx !== undefined ? x.rx : x.ej) : x.plain, lvl);
      if (x instanceof Uint8Array) return '{"$binary":' + JSON.stringify(B.toB64(x)) + '}';
      if (Array.isArray(x)) { if (!x.length) return '[]'; return '[' + pad + x.map(function (e) { return ser(e, lvl + 1); }).join(',' + pad) + padEnd + ']'; }
      var entries = x instanceof Map ? Array.from(x.entries()).map(function (e) { return [typeof e[0] === 'string' ? e[0] : (e[0] instanceof Uint8Array ? B.toHex(e[0]) : B.keyStr(e[0])), e[1]]; }) : Object.keys(x).map(function (k) { return [k, x[k]]; });
      if (!entries.length) return '{}';
      return '{' + pad + entries.map(function (e) { return JSON.stringify(e[0]) + sep + ser(e[1], lvl + 1); }).join(',' + pad) + padEnd + '}';
    }
    return ser(val, 0);
  };
  B.keyStr = function (k) { return typeof k === 'object' && k !== null ? B.toJson(k, 'plain', 0) : String(k); };

  /** float32 를 왕복되는 가장 짧은 십진수로 */
  B.f32 = function (x) { if (!isFinite(x) || x === 0) return String(x); for (var p = 1; p <= 9; p++) { var s = x.toPrecision(p); if (Math.fround(parseFloat(s)) === x) return String(parseFloat(s)); } return String(x); };

  B.short = function (s, n) { s = String(s); return s.length > (n || 80) ? s.slice(0, n || 80) + '…' : s; };
  B.disp = function (x) {
    if (x === null) return 'null'; if (x === undefined) return 'undefined';
    if (typeof x === 'string') return JSON.stringify(B.short(x, 70));
    if (typeof x === 'bigint') return x.toString();
    if (typeof x === 'number') return Object.is(x, -0) ? '-0' : String(x);
    if (x instanceof Uint8Array) return 'h\'' + B.short(B.toHex(x), 48) + '\' (' + x.length + ' B)';
    if (B.isMark(x)) return B.disp(x.plain);
    if (typeof x === 'object') return B.short(B.toJson(x, 'plain', 0), 70);
    return String(x);
  };
})(typeof window !== 'undefined' ? window : globalThis);
