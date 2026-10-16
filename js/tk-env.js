/* WooaDev Tool Kit — dotenv(.env) 파서/직렬화 */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var E = TK.env = TK.env || {};
  var t = function (a, b) { return TK.t(a, b); };

  /**
   * 반환: {entries:[{type:'kv'|'comment'|'blank', key,value,quote,exported,comment,line,raw}], vars:[kv 항목만], issues:[{line,msg}]}
   * quote: '"' | "'" | '`' | ''
   */
  E.parse = function (text) {
    var lines = String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/), entries = [], issues = [], seen = {};
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i], ln = i + 1, s = raw.trim();
      if (!s) { entries.push({ type: 'blank', line: ln, raw: raw }); continue; }
      if (s[0] === '#') { entries.push({ type: 'comment', text: s, line: ln, raw: raw }); continue; }
      var m = /^(export\s+)?([A-Za-z_][A-Za-z0-9_.\-]*)\s*(=|:(?=\s))\s?(.*)$/.exec(raw.replace(/^\s+/, ''));
      if (!m) { issues.push({ line: ln, msg: t('KEY=VALUE 형식이 아닙니다: ' + (s.length > 40 ? s.slice(0, 40) + '…' : s), 'Not in KEY=VALUE form: ' + (s.length > 40 ? s.slice(0, 40) + '…' : s)) }); entries.push({ type: 'invalid', line: ln, raw: raw }); continue; }
      var rest = m[4], quote = '', value = '', comment = '';
      var trimmed = rest.replace(/^\s+/, '');
      var q = trimmed[0];
      if (q === '"' || q === "'" || q === '`') {
        // 닫는 따옴표까지(여러 줄 허용)
        var buf = trimmed.slice(1), startLine = ln, closed = false, acc = '';
        while (true) {
          var k = 0, found = -1;
          for (; k < buf.length; k++) {
            if (q === '"' && buf[k] === '\\') { k++; continue; }
            if (buf[k] === q) { found = k; break; }
          }
          if (found >= 0) { acc += buf.slice(0, found); var tail = buf.slice(found + 1).trim(); if (tail && tail[0] === '#') comment = tail; closed = true; break; }
          acc += buf;
          if (i + 1 >= lines.length) break;
          i++; buf = lines[i]; acc += '\n';
        }
        if (!closed) issues.push({ line: startLine, msg: t('따옴표가 닫히지 않았습니다', 'Unclosed quote') });
        quote = q;
        value = q === '"' ? acc.replace(/\\(.)/g, function (_, c) { return c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c; }) : acc;
      } else {
        var ci = trimmed.search(/\s#/);
        if (ci >= 0) { comment = trimmed.slice(ci).trim(); trimmed = trimmed.slice(0, ci); }
        value = trimmed.replace(/\s+$/, '');
      }
      var e = { type: 'kv', key: m[2], value: value, quote: quote, exported: !!m[1], comment: comment, line: ln };
      if (seen[e.key]) issues.push({ line: ln, msg: t('중복된 키 ' + e.key + ' (뒤의 값이 적용됩니다)', 'Duplicate key ' + e.key + ' (the later value wins)') });
      seen[e.key] = 1;
      entries.push(e);
    }
    return { entries: entries, vars: entries.filter(function (x) { return x.type === 'kv'; }), issues: issues };
  };

  /** 값 직렬화: 필요할 때만 큰따옴표 */
  E.quote = function (v, force) {
    v = String(v);
    if (v === '') return force ? '""' : '';
    if (force || /[\s#"'`$\\]|^\s|\s$/.test(v) || /\n/.test(v)) return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
    return v;
  };

  /** 객체 → .env 텍스트 */
  E.stringify = function (pairs, opts) {
    opts = opts || {};
    return pairs.map(function (p) { return (opts.exported ? 'export ' : '') + p[0] + '=' + E.quote(p[1], opts.always); }).join('\n');
  };

  /** 값 → 마스킹 */
  E.mask = function (v) {
    v = String(v);
    if (!v) return '';
    return v.length <= 4 ? '••••' : v.slice(0, 2) + '•'.repeat(Math.min(8, v.length - 2));
  };

  var SECRET = /(SECRET|PASSWORD|PASSWD|PWD|TOKEN|PRIVATE|CREDENTIAL|AUTH|SALT|SIGNATURE|API_?KEY|ACCESS_?KEY|_KEY$|^KEY$|DSN|CERT|JWT|COOKIE|SESSION)/i;
  E.isSecretKey = function (k) { return SECRET.test(k); };
})(typeof window !== 'undefined' ? window : globalThis);
