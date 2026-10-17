TK.tool('xsd-validator', {
  inputs: [
    { id: 'xml', label: ['검증할 XML', 'XML to validate'], rows: 14, sample: '<?xml version="1.0"?>\n<catalog>\n  <book id="b1" pages="320">\n    <title>XML Basics</title>\n    <author>Kim</author>\n    <price currency="USD">29.99</price>\n    <published>2024-02-30</published>\n  </book>\n  <book id="b1" pages="0">\n    <title>XPath 입문</title>\n    <price currency="EUR">18000</price>\n    <isbn>123</isbn>\n  </book>\n</catalog>\n' },
    { id: 'xsd', label: ['XSD 스키마', 'XSD schema'], rows: 16, sample: '<?xml version="1.0"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n  <xs:element name="catalog">\n    <xs:complexType>\n      <xs:sequence>\n        <xs:element name="book" maxOccurs="unbounded">\n          <xs:complexType>\n            <xs:sequence>\n              <xs:element name="title" type="xs:string"/>\n              <xs:element name="author" type="xs:string" maxOccurs="3"/>\n              <xs:element name="price">\n                <xs:complexType>\n                  <xs:simpleContent>\n                    <xs:extension base="xs:decimal">\n                      <xs:attribute name="currency" use="required">\n                        <xs:simpleType>\n                          <xs:restriction base="xs:string">\n                            <xs:enumeration value="USD"/>\n                            <xs:enumeration value="KRW"/>\n                          </xs:restriction>\n                        </xs:simpleType>\n                      </xs:attribute>\n                    </xs:extension>\n                  </xs:simpleContent>\n                </xs:complexType>\n              </xs:element>\n              <xs:element name="published" type="xs:date" minOccurs="0"/>\n            </xs:sequence>\n            <xs:attribute name="id" type="xs:ID" use="required"/>\n            <xs:attribute name="pages" type="xs:positiveInteger"/>\n          </xs:complexType>\n        </xs:element>\n      </xs:sequence>\n    </xs:complexType>\n  </xs:element>\n</xs:schema>\n' }
  ],
  sampleExpectError: true,
  options: [{ id: 'max', type: 'number', label: ['표시할 최대 오류 수', 'Maximum errors to show'], default: 100, min: 1, max: 1000 }],
  outputs: [{ id: 'table', label: ['검증 오류', 'Validation errors'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], X = TK.xml, S = TK.xsd, XP = TK.xpath;
    if (!String(v.xml || '').trim()) throw new Error(t('XML 을 입력하세요', 'Enter the XML'));
    if (!String(v.xsd || '').trim()) throw new Error(t('XSD 를 입력하세요', 'Enter the XSD'));
    var model; try { model = S.load(v.xsd); } catch (e) { throw new Error(t('XSD 오류: ', 'XSD error: ') + e.message); }
    var parsed; try { parsed = X.parse(v.xml); } catch (e) { throw new Error(t('XML 오류: ', 'XML error: ') + e.message); }
    var doc = XP.build(parsed), errs = S.validate(model, doc);
    model.notes.forEach(function (n) { issues.push('ℹ️ ' + n); });
    issues.push(t('지원 범위: 요소·속성·complexType(sequence, choice, all, group, 확장/제한)·simpleType(패싯, list, union)·내장 타입·출현 횟수·ID/IDREF. 네임스페이스는 접두사를 무시하고 이름으로만 비교하며 key/unique/keyref, import/include, substitutionGroup 은 검사하지 않습니다', 'Supported: elements, attributes, complexType (sequence, choice, all, group, extension / restriction), simpleType (facets, list, union), built-in types, occurrences and ID / IDREF. Namespaces are compared by local name only; key / unique / keyref, import / include and substitutionGroup are not checked'));
    var rows = errs.slice(0, Math.round(o.max)).map(function (e, i) { return [String(i + 1), e.path, e.msg]; });
    if (errs.length > rows.length) issues.push('ℹ️ ' + t('오류가 ' + errs.length + '개라 처음 ' + rows.length + '개만 표시합니다', errs.length + ' errors; showing the first ' + rows.length));
    return { _status: { ok: errs.length ? false : true, msg: errs.length ? t('⛔ 오류 ' + errs.length + '개', '⛔ ' + errs.length + ' error(s)') : t('✅ XML 이 스키마에 유효합니다', '✅ The XML is valid against the schema') }, table: { head: [['#', '#'], ['위치', 'Path'], ['오류', 'Error']], rows: rows }, issues: issues };
  }
});
