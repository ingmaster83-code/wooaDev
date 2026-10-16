TK.tool('jsonpath-tester', {
  inputs: [
    { id: 'json', label: ['JSON 데이터', 'JSON data'], rows: 14, sample: '{\n  "store": {\n    "book": [\n      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },\n      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },\n      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 },\n      { "category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99 }\n    ],\n    "bicycle": { "color": "red", "price": 399 }\n  }\n}' },
    { id: 'expr', type: 'text', label: ['JSONPath 식', 'JSONPath expression'], sample: '$.store.book[?(@.price < 10)].title', placeholder: '$.store.book[*].author' }
  ],
  options: [{ id: 'indent', type: 'select', label: ['결과 들여쓰기', 'Result indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['0', ['압축', 'Minified']]], default: '2' }],
  outputs: [
    { id: 'table', label: ['일치 항목 (경로 + 값)', 'Matches (path + value)'], kind: 'table' },
    { id: 'values', label: ['값만 모은 JSON', 'Values as JSON'], kind: 'code', ext: 'json', mime: 'application/json' }
  ],
  run: function (v, o, t) {
    var data = TK.json.parseValue(v.json);
    var m = TK.jsonpath.query(data, v.expr);
    return {
      _status: m.length ? t('✅ ' + m.length + '개 일치', '✅ ' + m.length + ' match(es)') : { ok: 'info', msg: t('일치하는 항목이 없습니다', 'No matches') },
      table: { head: [['#', '#'], ['경로', 'Path'], ['값', 'Value']], rows: m.map(function (x, i) { return [i + 1, TK.jsonpath.normalPath(x.p), TK.json.brief(x.v, 120)]; }), empty: ['일치하는 항목이 없습니다', 'No matches'] },
      values: m.length ? TK.json.fmt(m.map(function (x) { return x.v; }), o.indent) : null
    };
  }
});
