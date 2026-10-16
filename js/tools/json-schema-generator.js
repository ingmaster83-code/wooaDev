TK.tool('json-schema-generator', {
  inputs: [{ id: 'in', label: ['JSON 샘플', 'JSON sample'], rows: 14, placeholder: ['객체 또는 객체 배열. 여러 샘플을 이어 붙이면 모두 분석해 필수/선택 필드를 판단합니다', 'An object or array of objects. Multiple samples are merged to decide required vs optional fields'],
    sample: '[\n  {\n    "id": 1,\n    "name": "Kim",\n    "email": "kim@example.com",\n    "is_active": true,\n    "score": 4.5,\n    "tags": ["admin", "dev"],\n    "address": { "city": "Seoul", "zip": "04524" },\n    "created_at": "2026-01-02T03:04:05Z"\n  },\n  {\n    "id": 2,\n    "name": "Lee",\n    "is_active": false,\n    "score": 3,\n    "tags": [],\n    "address": { "city": "Busan", "zip": null },\n    "created_at": "2026-02-03T04:05:06Z"\n  }\n]' }],
  options: [
    { id: 'draft', type: 'select', label: ['스키마 버전', 'Draft'], choices: [['2020-12', '2020-12'], ['2019-09', '2019-09'], ['07', 'Draft-07']], default: '2020-12' },
    { id: 'wrap', type: 'select', label: ['입력이 배열일 때', 'If the input is an array'], choices: [['items', ['요소 스키마로 (샘플 여러 개로 취급)', 'Treat items as samples → object schema']], ['array', ['배열 스키마로', 'Make an array schema']]], default: 'items' },
    { id: 'required', type: 'checkbox', label: ['모든 샘플에 있는 키는 required', 'Keys in every sample are required'], default: true },
    { id: 'strict', type: 'checkbox', label: ['additionalProperties: false', 'additionalProperties: false'], default: false },
    { id: 'formats', type: 'checkbox', label: ['format 추정 (date-time, email, uuid…)', 'Detect formats (date-time, email, uuid…)'], default: true },
    { id: 'title', type: 'text', label: ['title (선택)', 'title (optional)'], default: '' },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['0', ['압축', 'Minified']]], default: '2' }
  ],
  outputs: [{ id: 'out', label: ['JSON Schema', 'JSON Schema'], kind: 'code', ext: 'json', mime: 'application/schema+json' }],
  run: function (v, o, t) {
    var inf = TK.inferIR(v.in, { spreadArray: o.wrap === 'items' });
    var schema = TK.schema.fromIR(inf.ir, { draft: o.draft, required: o.required, strict: o.strict, formats: o.formats, title: o.title });
    var st = TK.json.stats(schema);
    return { _status: t('✅ 샘플 ' + inf.count + '개를 분석해 스키마를 만들었습니다 (속성 정의 ' + st.objects + '개)', '✅ Built a schema from ' + inf.count + ' sample(s)'), out: TK.json.fmt(schema, o.indent) };
  }
});
