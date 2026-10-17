TK.tool('xpath-tester', {
  inputs: [
    { id: 'xml', label: ['XML', 'XML'], rows: 14, sample: '<?xml version="1.0"?>\n<catalog>\n  <book id="b1" lang="en">\n    <title>XML Basics</title>\n    <author>Kim</author>\n    <price currency="USD">29.99</price>\n  </book>\n  <book id="b2" lang="ko">\n    <title>XPath 입문</title>\n    <author>Lee</author>\n    <price currency="KRW">18000</price>\n  </book>\n  <book id="b3" lang="en">\n    <title>Advanced XSLT</title>\n    <author>Kim</author>\n    <price currency="USD">45.00</price>\n  </book>\n</catalog>\n' },
    { id: 'xp', type: 'text', label: ['XPath 식', 'XPath expression'], sample: '//book[author="Kim" and price > 30]/title' }
  ],
  options: [
    { id: 'fmt', type: 'select', label: ['노드 출력', 'Node output'], choices: [['xml', ['XML 조각', 'XML fragment']], ['text', ['텍스트 값', 'String value']]], default: 'xml' }
  ],
  outputs: [{ id: 'table', label: ['일치한 노드', 'Matched nodes'], kind: 'table' }, { id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var XP = TK.xpath, issues = [], xml = String(v.xml || ''), xp = String(v.xp || '').trim();
    if (!xml.trim()) throw new Error(t('XML 을 입력하세요', 'Enter XML'));
    if (!xp) throw new Error(t('XPath 식을 입력하세요', 'Enter an XPath expression'));
    var parsed; try { parsed = TK.xml.parse(xml); } catch (e) { throw new Error(t('XML 오류: ', 'XML error: ') + e.message); }
    var doc = XP.build(parsed), ast; try { ast = XP.parse(xp); } catch (e) { throw new Error(t('XPath 구문 오류: ', 'XPath syntax error: ') + e.message); }
    var res = XP.evaluate(ast, doc), ty = XP.typeOf(res);
    if (/\bxmlns(:\w+)?\s*=/.test(xml) && !/[\w-]+:[\w-]+|local-name\(\)/.test(xp)) issues.push('ℹ️ ' + t('XML 에 네임스페이스가 있습니다. XPath 1.0 은 기본 네임스페이스의 요소를 이름만으로 고를 수 없으니 *[local-name()="item"] 처럼 쓰거나 접두사 이름(prefix:item)을 쓰세요. 이 도구는 문서에 선언된 접두사 이름을 그대로 비교합니다', 'The XML uses namespaces. XPath 1.0 cannot select default-namespace elements by name alone; use *[local-name()="item"] or the prefixed name (prefix:item). This tool compares the prefix names as written in the document'));
    if (/\b(ends-with|lower-case|upper-case|matches|replace|abs|min|max|avg|string-join|distinct-values)\s*\(/.test(xp)) issues.push('ℹ️ ' + t('XPath 2.0 함수 일부를 확장 지원합니다. 브라우저의 document.evaluate 나 xmllint(1.0)에서는 동작하지 않을 수 있습니다', 'Some XPath 2.0 functions are supported as an extension; they may fail in browser document.evaluate or xmllint (1.0)'));
    if (/^\//.test(xp) === false && !/^[.(@]|^\w+\(|^\$|^\d/.test(xp) && !/^\w/.test(xp)) issues.push('ℹ️ ' + t('상대 경로는 문서 루트에서 시작해 계산합니다', 'Relative paths start at the document root'));
    var rows = [], out;
    if (ty === 'node-set') {
      res.slice(0, 500).forEach(function (n, i) { var sval = XP.stringValue(n); rows.push([String(i + 1), n.t === 'el' ? 'element' : n.t === 'attr' ? 'attribute' : n.t === 'root' ? 'document' : n.t, XP.path(n), sval.replace(/\s+/g, ' ').trim().slice(0, 80)]); });
      if (res.length > 500) issues.push('ℹ️ ' + t('표는 처음 500개 노드만 보여 줍니다', 'The table shows only the first 500 nodes'));
      out = o.fmt === 'xml' ? res.map(function (n) { return n.t === 'text' || n.t === 'attr' || n.t === 'comment' ? (n.t === 'attr' ? n.name + '="' + n.value + '"' : n.value) : XP.serialize(n, true); }).join('\n') : res.map(function (n) { return XP.stringValue(n); }).join('\n');
      if (!res.length) issues.push('ℹ️ ' + t('일치하는 노드가 없습니다. 요소 이름의 대소문자, 속성 앞의 @, 따옴표 종류를 확인하세요', 'No nodes matched. Check element name case, @ before attributes and quote types'));
      return { _status: t('✅ 노드 ' + res.length + '개 일치', '✅ ' + res.length + ' node(s) matched'), table: { head: [['#', '#'], ['종류', 'Type'], ['경로', 'Path'], ['값', 'String value']], rows: rows }, out: out, issues: issues };
    }
    out = String(XP.toStr(res));
    return { _status: t('✅ 결과 (' + ty + '): ' + out, '✅ Result (' + ty + '): ' + out), table: { head: [['타입', 'Type'], ['값', 'Value']], rows: [[ty, out]] }, out: out, issues: issues };
  }
});
