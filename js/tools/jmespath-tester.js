TK.tool('jmespath-tester', {
  inputs: [
    { id: 'json', label: ['JSON 데이터', 'JSON data'], rows: 14, sample: '{\n  "people": [\n    { "name": "Kim", "age": 29, "state": { "name": "WA" }, "tags": ["dev", "ops"] },\n    { "name": "Lee", "age": 41, "state": { "name": "NY" }, "tags": ["dev"] },\n    { "name": "Park", "age": 35, "state": { "name": "WA" }, "tags": [] }\n  ]\n}' },
    { id: 'expr', type: 'text', label: ['JMESPath 식', 'JMESPath expression'], sample: "people[?age > `30`].{name: name, state: state.name}", placeholder: 'people[*].name' }
  ],
  options: [{ id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['0', ['압축', 'Minified']]], default: '2' }],
  outputs: [
    { id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'json', mime: 'application/json' }
  ],
  run: function (v, o, t) {
    if (typeof jmespath === 'undefined') throw new Error(t('JMESPath 라이브러리를 불러오지 못했습니다', 'Failed to load the JMESPath library'));
    var data = TK.json.parseValue(v.json), r;
    try { r = jmespath.search(data, v.expr); }
    catch (e) { throw new Error(t('JMESPath 오류: ', 'JMESPath error: ') + (e.message || e)); }
    var kind = r === null ? 'null' : Array.isArray(r) ? 'array (' + r.length + ')' : typeof r;
    return {
      _status: t('✅ 결과 타입: ', '✅ Result type: ') + kind,
      out: r === undefined ? 'null' : TK.json.fmt(r, o.indent)
    };
  }
});
