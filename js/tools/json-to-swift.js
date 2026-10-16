TK.tool('json-to-swift', {
  inputs: [{ id: 'in', label: ['JSON 샘플 (API 응답 등)', 'JSON sample (e.g. an API response)'], rows: 14, placeholder: ['객체 또는 객체 배열. 여러 개를 이어 붙이면 모두 분석합니다', 'An object or an array of objects. Several samples are analysed together'],
    sample: '[\n  {\n    "id": 1,\n    "name": "Kim",\n    "email": "kim@example.com",\n    "is_active": true,\n    "score": 4.5,\n    "tags": ["admin", "dev"],\n    "address": { "city": "Seoul", "zip": "04524" },\n    "created_at": "2026-01-02T03:04:05Z"\n  },\n  {\n    "id": 2,\n    "name": "Lee",\n    "is_active": false,\n    "score": 3,\n    "tags": [],\n    "address": { "city": "Busan", "zip": null },\n    "created_at": "2026-02-03T04:05:06Z",\n    "nickname": null\n  }\n]' }],
  options: [
    { id: 'root', type: 'text', label: ['최상위 타입 이름', 'Root type name'], default: 'Root' },
    { id: 'letvar', type: 'select', label: ['프로퍼티', 'Properties'], choices: [['let', 'let'], ['var', 'var']], default: 'let' },
    { id: 'hashable', type: 'checkbox', label: ['Hashable 추가', 'Add Hashable'], default: false },
    { id: 'dedupe', type: 'checkbox', label: ['같은 구조는 하나로', 'Reuse identical structs'], default: true }
  ],
  outputs: [{ id: 'out', label: ['Swift Codable', 'Swift Codable'], kind: 'code', ext: 'swift', mime: 'text/x-swift' }],
  run: function (v, o, t) {
    var p = TK.codegen.prepare(v.in, o.root || 'Root', { dedupe: o.dedupe });
    return { _status: t('✅ 구조체 ' + p.decls.length + '개를 만들었습니다 (샘플 ' + p.count + '개 분석)', '✅ Generated ' + p.decls.length + ' struct(s) from ' + p.count + ' sample(s)'), out: TK.codegen.swift(p, o) };
  }
});
