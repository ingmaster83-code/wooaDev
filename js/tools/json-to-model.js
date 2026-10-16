TK.tool('json-to-model', {
  inputs: [{ id: 'in', label: ['JSON 샘플 (API 응답 등)', 'JSON sample (e.g. an API response)'], rows: 14, placeholder: ['객체 또는 객체 배열. 여러 개를 이어 붙이면 모두 분석합니다', 'An object or an array of objects. Several samples are analysed together'],
    sample: '[\n  {\n    "id": 1,\n    "name": "Kim",\n    "email": "kim@example.com",\n    "is_active": true,\n    "score": 4.5,\n    "tags": ["admin", "dev"],\n    "address": { "city": "Seoul", "zip": "04524" },\n    "created_at": "2026-01-02T03:04:05Z"\n  },\n  {\n    "id": 2,\n    "name": "Lee",\n    "is_active": false,\n    "score": 3,\n    "tags": [],\n    "address": { "city": "Busan", "zip": null },\n    "created_at": "2026-02-03T04:05:06Z",\n    "nickname": null\n  }\n]' }],
  options: [
    { id: 'lang', type: 'select', label: ['언어', 'Language'], choices: [['rust', 'Rust (serde)'], ['csharp', 'C# (System.Text.Json)'], ['dart', 'Dart (fromJson/toJson)'], ['kotlin', 'Kotlin (data class)']], default: 'rust' },
    { id: 'root', type: 'text', label: ['최상위 타입 이름', 'Root type name'], default: 'Root' },
    { id: 'camel', type: 'checkbox', label: ['serde rename_all = camelCase', 'serde rename_all = camelCase'], default: false, show: function (o) { return o.lang === 'rust'; } },
    { id: 'record', type: 'checkbox', label: ['record 사용', 'Use records'], default: false, show: function (o) { return o.lang === 'csharp'; } },
    { id: 'nullable', type: 'checkbox', label: ['nullable 표기(?)', 'Nullable annotations (?)'], default: true, show: function (o) { return o.lang === 'csharp'; } },
    { id: 'dates', type: 'checkbox', label: ['날짜-시간은 DateTime', 'DateTime for date-time strings'], default: false, show: function (o) { return o.lang === 'csharp'; } },
    { id: 'serial', type: 'checkbox', label: ['kotlinx.serialization 어노테이션', 'kotlinx.serialization annotations'], default: true, show: function (o) { return o.lang === 'kotlin'; } },
    { id: 'dedupe', type: 'checkbox', label: ['같은 구조는 하나로', 'Reuse identical types'], default: true }
  ],
  outputs: [{ id: 'out', label: ['생성된 코드', 'Generated code'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var p = TK.codegen.prepare(v.in, o.root || 'Root', { dedupe: o.dedupe });
    return { _status: t('✅ 타입 ' + p.decls.length + '개를 만들었습니다 (샘플 ' + p.count + '개 분석)', '✅ Generated ' + p.decls.length + ' type(s) from ' + p.count + ' sample(s)'), out: TK.codegen[o.lang](p, o) };
  }
});
