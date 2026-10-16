TK.tool('xml-escape', {
  inputs: [{ id: 'in', label: ['텍스트', 'Text'], rows: 8, sample: 'Tom & Jerry <"Cartoon"> it\'s 100% fun — 안녕 😀\u0007' }],
  options: [
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['esc', ['이스케이프', 'Escape']], ['unesc', ['이스케이프 해제', 'Unescape']]], default: 'esc' },
    { id: 'ctx', type: 'select', label: ['사용 위치', 'Context'], choices: [['text', ['요소 텍스트', 'Element text']], ['attr', ['속성 값 (")', 'Attribute value (")']], ['attr1', ["속성 값 (')", "Attribute value (')"]], ['cdata', 'CDATA'], ['comment', ['주석', 'Comment']]], default: 'text', show: function (o) { return o.dir === 'esc'; } },
    { id: 'num', type: 'select', label: ['ASCII 가 아닌 문자', 'Non-ASCII characters'], choices: [['keep', ['그대로 (UTF-8)', 'Keep (UTF-8)']], ['dec', ['&#10진수;', '&#decimal;']], ['hex', ['&#x16진수;', '&#xhex;']]], default: 'keep', show: function (o) { return o.dir === 'esc'; } },
    { id: 'apos', type: 'checkbox', label: ["' 도 &apos; 로 변환", "Also escape ' as &apos;"], default: false, show: function (o) { return o.dir === 'esc' && (o.ctx === 'text' || o.ctx === 'attr'); } }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'xml' }, { id: 'table', label: ['변환된 문자', 'Converted characters'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var s = String(v.in), issues = [], rows = [];
    var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (o.dir === 'unesc') {
      var n = 0, badRef = [];
      var r = s.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, function (m, e) {
        if (e[0] === '#') { var cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); if (cp > 0x10ffff || cp === 0 || (cp >= 0xd800 && cp <= 0xdfff)) { badRef.push(m); return m; } n++; rows.push([m, String.fromCodePoint(cp), t('문자 참조', 'character reference')]); return String.fromCodePoint(cp); }
        if (NAMED[e] !== undefined) { n++; rows.push([m, NAMED[e], t('XML 기본 엔티티', 'predefined XML entity')]); return NAMED[e]; }
        badRef.push(m); return m;
      });
      var strayAmp = (r.match(/&(?![A-Za-z#])/g) || []).length;
      if (badRef.length) issues.push(t('XML 에 정의되지 않은 엔티티는 그대로 두었습니다: ' + badRef.slice(0, 5).join(' ') + ' (HTML 의 &nbsp; &copy; 등은 XML 에서 DTD 정의가 필요)', 'Entities not defined in XML were left as they are: ' + badRef.slice(0, 5).join(' ') + ' (HTML names such as &nbsp; or &copy; need a DTD in XML)'));
      if (strayAmp) issues.push(t('이스케이프되지 않은 & 가 ' + strayAmp + '개 있습니다 — XML 로는 잘못된 형식입니다', strayAmp + ' unescaped & found — not well-formed XML'));
      var cd = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(s); if (cd) issues.push(t('CDATA 섹션은 해제하지 않았습니다 — 안의 내용은 이스케이프 없이 그대로입니다', 'CDATA sections were not unescaped — their content is literal'));
      return { _status: t('✅ ' + n + '개 엔티티를 풀었습니다', '✅ Unescaped ' + n + ' entities'), out: r, table: { head: [['엔티티', 'Entity'], ['문자', 'Character'], ['종류', 'Kind']], rows: rows.slice(0, 200) }, issues: issues };
    }
    // 문자 검사: XML 1.0 에서 허용되지 않는 문자
    var bad = []; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c < 0x20 && c !== 9 && c !== 10 && c !== 13) bad.push(c); else if (c >= 0xd800 && c <= 0xdbff) { var d = s.charCodeAt(i + 1); if (!(d >= 0xdc00 && d <= 0xdfff)) bad.push(c); else i++; } else if (c >= 0xdc00 && c <= 0xdfff || c === 0xfffe || c === 0xffff) bad.push(c); }
    var cleaned = s;
    if (bad.length) { issues.push('🚨 ' + t('XML 1.0 에서 허용되지 않는 문자 ' + bad.length + '개(' + bad.slice(0, 4).map(function (x) { return 'U+' + ('0000' + x.toString(16)).slice(-4).toUpperCase(); }).join(', ') + ') — 제거했습니다. 이스케이프해도 XML 1.0 에는 넣을 수 없습니다', '🚨 ' + bad.length + ' character(s) not allowed in XML 1.0 (' + bad.slice(0, 4).map(function (x) { return 'U+' + ('0000' + x.toString(16)).slice(-4).toUpperCase(); }).join(', ') + ') — removed. Escaping does not make them legal in XML 1.0')); cleaned = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, ''); }
    var out;
    function nonAscii(str) { if (o.num === 'keep') return str; return Array.from(str).map(function (ch) { var cp = ch.codePointAt(0); if (cp < 128) return ch; var rep = o.num === 'hex' ? '&#x' + cp.toString(16).toUpperCase() + ';' : '&#' + cp + ';'; rows.push([ch, rep, 'U+' + cp.toString(16).toUpperCase()]); return rep; }).join(''); }
    if (o.ctx === 'cdata') {
      out = '<![CDATA[' + cleaned.replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]>';
      if (/\]\]>/.test(cleaned)) issues.push(t('입력의 ]]> 는 CDATA 를 끝내므로 ]]]]><![CDATA[> 로 나눠 넣었습니다', 'A ]]> in the input would end the CDATA, so it was split as ]]]]><![CDATA[>'));
      issues.push(t('CDATA 안에서는 &, < 를 이스케이프하지 않습니다. 속성 값에는 쓸 수 없습니다', 'Inside CDATA & and < are literal. CDATA cannot be used in attribute values'));
    } else if (o.ctx === 'comment') {
      out = '<!-- ' + cleaned.replace(/--/g, '- -').replace(/-$/, '- ') + ' -->';
      if (/--/.test(cleaned) || /-$/.test(cleaned)) issues.push(t('주석 안에는 연속된 하이픈(--)과 끝의 - 가 올 수 없어 공백을 넣었습니다', 'A comment cannot contain -- or end with -, so spaces were inserted'));
    } else {
      var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }, q = o.ctx === 'attr1' ? "'" : '"';
      out = cleaned.replace(/[&<>]|["']/g, function (ch) {
        if (ch === '"') { if (o.ctx === 'attr') { rows.push([ch, '&quot;', 'attr']); return '&quot;'; } return ch; }
        if (ch === "'") { if (o.ctx === 'attr1' || o.apos) { rows.push([ch, '&apos;', '']); return '&apos;'; } return ch; }
        rows.push([ch, map[ch], '']); return map[ch];
      });
      if (o.ctx === 'attr' || o.ctx === 'attr1') out = out.replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
      if (o.ctx === 'attr' || o.ctx === 'attr1') issues.push(t('속성 값의 줄바꿈·탭은 파서가 공백으로 바꾸므로 &#10; 등으로 써야 보존됩니다', 'Newlines and tabs in attribute values are normalised to spaces by parsers; write &#10; etc. to keep them'));
      out = nonAscii(out);
      if (o.ctx === 'text') issues.push(t('텍스트에서는 & 와 < 만 필수이고 > 는 선택입니다(]]> 때문에 함께 변환하는 것이 안전)', 'In text only & and < are required; > is optional (escaped to be safe with ]]>)'));
    }
    var seen = {}; var agg = []; rows.forEach(function (r) { var k = r[0]; if (!seen[k]) { seen[k] = [k, r[1], r[2], 0]; agg.push(seen[k]); } seen[k][3]++; });
    issues.push(t('XML 기본 엔티티는 5개뿐입니다: &amp; &lt; &gt; &quot; &apos;. HTML 의 &nbsp; 같은 이름은 XML 에서 쓸 수 없으니 &#160; 로 쓰세요', 'XML has only five predefined entities: &amp; &lt; &gt; &quot; &apos;. HTML names like &nbsp; are not available; use &#160;'));
    var bd = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bd ? { ok: 'info', msg: t('🔍 이스케이프 완료 · 금지 문자 제거됨', '🔍 Escaped · illegal characters removed') } : t('✅ 이스케이프 완료 (' + agg.reduce(function (a, r) { return a + r[3]; }, 0) + '개 문자)', '✅ Escaped (' + agg.reduce(function (a, r) { return a + r[3]; }, 0) + ' character(s))'), out: out, table: { head: [['원본', 'Original'], ['변환', 'Escaped'], ['설명', 'Note'], ['횟수', 'Count']], rows: agg.slice(0, 200) }, issues: issues };
  }
});
