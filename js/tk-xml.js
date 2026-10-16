/* WooaDev Tool Kit — 의존성 없는 XML 파서/작성기 (DOM 없이 동작, 줄·열 오류 포함) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var X = TK.xml = TK.xml || {};
  var t = function (a, b) { return TK.t(a, b); };

  var ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
  X.decode = function (s) {
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g, function (m, e) {
      if (e[0] === '#') {
        var cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(cp); } catch (x) { return m; }
      }
      return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : m;
    });
  };
  X.escText = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  X.escAttr = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;'); };
  X.validName = function (s) { return /^[A-Za-z_À-￿][\w.\-·À-￿:]*$/.test(s); };
  X.safeName = function (s) {
    var r = String(s).replace(/[^\w.\-·À-￿:]/g, '_');
    if (!r || !/^[A-Za-z_À-￿]/.test(r)) r = '_' + r;
    return r;
  };

  /** 반환: {decl:{version,encoding,standalone}|null, doctype, root:{name,attrs:[[k,v]],children:[…]}} 자식은 {text}|{cdata}|{comment}|{name,…} */
  X.parse = function (src) {
    var s = String(src), n = s.length, i = 0;
    if (s.charCodeAt(0) === 0xFEFF) i = 1;
    function lc(p) { var line = 1, col = 1; for (var k = 0; k < p && k < n; k++) { if (s.charCodeAt(k) === 10) { line++; col = 1; } else col++; } return { line: line, col: col }; }
    function fail(msg, p) {
      if (p == null) p = i;
      var q = lc(p), e = new Error(msg + ' (' + t('줄 ', 'line ') + q.line + t(', 열 ', ', col ') + q.col + ')');
      e.line = q.line; e.col = q.col; e.reason = msg; throw e;
    }
    var decl = null, doctype = null, root = null, stack = [], cur = null;
    function attrs(str, at) {
      var out = [], re = /([^\s=\/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g, m, last = 0;
      while ((m = re.exec(str))) {
        var between = str.slice(last, m.index).trim();
        if (between) fail(t('속성 형식이 올바르지 않습니다: ' + between, 'Malformed attribute: ' + between), at);
        out.push([m[1], X.decode(m[3] != null ? m[3] : m[4])]); last = re.lastIndex;
      }
      var rest = str.slice(last).trim().replace(/\/$/, '').trim();
      if (rest) fail(t('속성 값은 따옴표로 감싸야 합니다: ' + rest, 'Attribute values must be quoted: ' + rest), at);
      return out;
    }
    while (i < n) {
      var lt = s.indexOf('<', i);
      if (lt < 0) lt = n;
      if (lt > i) {
        var txt = s.slice(i, lt);
        if (cur) cur.children.push({ text: X.decode(txt) });
        else if (txt.trim()) fail(t('루트 요소 밖에 텍스트가 있습니다', 'Text outside the root element'), i + txt.search(/\S/));
        i = lt;
        if (i >= n) break;
      }
      if (s.startsWith('<!--', i)) {
        var ce = s.indexOf('-->', i + 4);
        if (ce < 0) fail(t('주석이 닫히지 않았습니다 (-->)', 'Unclosed comment (-->)'));
        if (cur) cur.children.push({ comment: s.slice(i + 4, ce) });
        i = ce + 3;
      } else if (s.startsWith('<![CDATA[', i)) {
        var de = s.indexOf(']]>', i + 9);
        if (de < 0) fail(t('CDATA가 닫히지 않았습니다 (]]>)', 'Unclosed CDATA (]]>)'));
        if (!cur) fail(t('루트 요소 밖에 CDATA가 있습니다', 'CDATA outside the root element'));
        cur.children.push({ cdata: s.slice(i + 9, de) });
        i = de + 3;
      } else if (s.startsWith('<?', i)) {
        var pe = s.indexOf('?>', i + 2);
        if (pe < 0) fail(t('처리 명령이 닫히지 않았습니다 (?>)', 'Unclosed processing instruction (?>)'));
        var body = s.slice(i + 2, pe);
        if (/^xml(\s|$)/.test(body) && !decl) {
          decl = {};
          attrs(body.slice(3), i).forEach(function (a) { decl[a[0]] = a[1]; });
        }
        i = pe + 2;
      } else if (s.startsWith('<!', i)) {
        var depth = 0, j = i;
        for (; j < n; j++) { if (s[j] === '<') depth++; else if (s[j] === '>') { depth--; if (depth === 0) break; } }
        if (j >= n) fail(t('DOCTYPE이 닫히지 않았습니다', 'Unclosed DOCTYPE'));
        doctype = s.slice(i, j + 1); i = j + 1;
      } else if (s.startsWith('</', i)) {
        var ge = s.indexOf('>', i);
        if (ge < 0) fail(t('닫는 태그가 끝나지 않았습니다', 'Unfinished closing tag'));
        var nm = s.slice(i + 2, ge).trim();
        if (!cur) fail(t('여는 태그 없이 </' + nm + '>가 있습니다', 'Closing tag </' + nm + '> without an opening tag'));
        if (cur.name !== nm) fail(t('태그가 맞지 않습니다: <' + cur.name + '>를 </' + nm + '>로 닫았습니다', 'Mismatched tag: <' + cur.name + '> closed by </' + nm + '>'));
        stack.pop(); cur = stack[stack.length - 1] || null; i = ge + 1;
      } else {
        // 여는 태그 — 속성 안의 > 를 고려해 끝을 찾는다
        var j2 = i + 1, q = null;
        for (; j2 < n; j2++) {
          var ch = s[j2];
          if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '>') break;
        }
        if (j2 >= n) fail(t('태그가 닫히지 않았습니다 (>)', 'Unclosed tag (>)'));
        var inner = s.slice(i + 1, j2), selfClose = /\/\s*$/.test(inner);
        var m2 = /^([^\s\/>]+)/.exec(inner);
        if (!m2 || !X.validName(m2[1])) fail(t('올바르지 않은 태그 이름입니다: ' + (m2 ? m2[1] : '<'), 'Invalid tag name: ' + (m2 ? m2[1] : '<')));
        var el = { name: m2[1], attrs: attrs(inner.slice(m2[1].length), i), children: [] };
        if (cur) cur.children.push(el);
        else { if (root) fail(t('루트 요소가 둘 이상입니다', 'More than one root element')); root = el; }
        if (!selfClose) { stack.push(el); cur = el; }
        i = j2 + 1;
      }
    }
    if (stack.length) fail(t('<' + stack[stack.length - 1].name + '> 태그가 닫히지 않았습니다', 'Tag <' + stack[stack.length - 1].name + '> is not closed'), n);
    if (!root) fail(t('XML 요소가 없습니다', 'No XML element found'), 0);
    return { decl: decl, doctype: doctype, root: root };
  };
})(typeof window !== 'undefined' ? window : globalThis);
