TK.tool('schema-mock-data', {
  inputs: [{ id: 'in', label: ['JSON Schema', 'JSON Schema'], rows: 16, placeholder: ['JSON Schema를 붙여넣으세요', 'Paste a JSON Schema'],
    sample: '{\n  "type": "object",\n  "required": ["id", "name", "email", "role"],\n  "properties": {\n    "id": { "type": "integer", "minimum": 1000, "maximum": 9999 },\n    "name": { "type": "string", "minLength": 2 },\n    "email": { "type": "string", "format": "email" },\n    "role": { "enum": ["admin", "editor", "viewer"] },\n    "code": { "type": "string", "pattern": "^[A-Z]{3}-[0-9]{4}$" },\n    "score": { "type": "number", "minimum": 0, "maximum": 5, "multipleOf": 0.5 },\n    "tags": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": 3, "uniqueItems": true },\n    "created": { "type": "string", "format": "date-time" }\n  }\n}' }],
  options: [
    { id: 'count', type: 'number', label: ['생성 개수', 'How many'], default: 3, min: 1, max: 200 },
    { id: 'seed', type: 'number', label: ['시드 (같은 값 = 같은 결과)', 'Seed (same seed = same data)'], default: 1 },
    { id: 'optional', type: 'select', label: ['선택 속성', 'Optional properties'], choices: [['random', ['일부만 포함', 'Include some']], ['always', ['항상 포함', 'Always include']], ['never', ['제외', 'Skip']]], default: 'always' },
    { id: 'examples', type: 'checkbox', label: ['examples/default 값 우선 사용', 'Prefer examples/defaults'], default: false },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['0', ['압축', 'Minified']]], default: '2' }
  ],
  outputs: [{ id: 'out', label: ['모의 데이터', 'Mock data'], kind: 'code', ext: 'json', mime: 'application/json' }],
  run: function (v, o, t) {
    var schema = TK.json.parseValue(v.in);
    var n = Math.max(1, Math.min(200, Math.round(o.count) || 1)), out = [];
    var m = TK.schema.mock(schema, { seed: Math.round(o.seed), optional: o.optional, useExamples: o.examples, useDefaults: o.examples });
    for (var i = 0; i < n; i++) out.push(m.gen());
    return { _status: t('✅ ' + n + '개를 생성했습니다 (시드 ' + Math.round(o.seed) + ')', '✅ Generated ' + n + ' item(s) (seed ' + Math.round(o.seed) + ')'), out: TK.json.fmt(n === 1 ? out[0] : out, o.indent) };
  }
});
