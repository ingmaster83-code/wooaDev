TK.tool('json-to-go', {
  inputs: [{ id: 'in', label: ['JSON 샘플 (API 응답 등)', 'JSON sample (e.g. an API response)'], rows: 14, placeholder: ['객체 또는 객체 배열. 여러 개를 이어 붙이면 모두 분석합니다', 'An object or an array of objects. Several samples are analysed together'],
    sample: '[\n  {\n    "id": 1,\n    "name": "Kim",\n    "email": "kim@example.com",\n    "is_active": true,\n    "score": 4.5,\n    "tags": ["admin", "dev"],\n    "address": { "city": "Seoul", "zip": "04524" },\n    "created_at": "2026-01-02T03:04:05Z"\n  },\n  {\n    "id": 2,\n    "name": "Lee",\n    "is_active": false,\n    "score": 3,\n    "tags": [],\n    "address": { "city": "Busan", "zip": null },\n    "created_at": "2026-02-03T04:05:06Z",\n    "nickname": null\n  }\n]' }],
  options: [
    { id: 'root', type: 'text', label: ['최상위 타입 이름', 'Root type name'], default: 'Root' },
    { id: 'pkg', type: 'text', label: ['package', 'package'], default: 'model' },
    { id: 'pointers', type: 'checkbox', label: ['null/선택 필드는 포인터(*T)', 'Pointers for null/optional fields (*T)'], default: true },
    { id: 'omitempty', type: 'checkbox', label: ['선택 필드에 omitempty', 'omitempty on optional fields'], default: true },
    { id: 'int64', type: 'checkbox', label: ['정수는 int64', 'Use int64 for integers'], default: true },
    { id: 'time', type: 'checkbox', label: ['날짜-시간 문자열은 time.Time', 'time.Time for date-time strings'], default: false },
    { id: 'any', type: 'checkbox', label: ['interface{} 대신 any', 'any instead of interface{}'], default: false },
    { id: 'dedupe', type: 'checkbox', label: ['같은 구조는 하나로', 'Reuse identical structs'], default: true }
  ],
  outputs: [{ id: 'out', label: ['Go 구조체', 'Go structs'], kind: 'code', ext: 'go', mime: 'text/x-go' }, { id: 'info', label: ['분석 정보', 'Analysis'], kind: 'kv' }],
  run: function (v, o, t) {
    var p = TK.codegen.prepare(v.in, o.root || 'Root', { dedupe: o.dedupe });
    return {
      _status: t('✅ 구조체 ' + p.decls.length + '개를 만들었습니다 (샘플 ' + p.count + '개 분석)', '✅ Generated ' + p.decls.length + ' struct(s) from ' + p.count + ' sample(s)'),
      out: TK.codegen.go(p, o),
      info: [[['분석한 샘플', 'Samples analysed'], p.count], [['생성된 타입', 'Generated types'], p.decls.map(function (d) { return d.name; }).join(', ')]]
    };
  }
});
