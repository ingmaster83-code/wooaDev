TK.tool('json-schema-diff', {
  sampleExpectError: true,
  inputs: [
    { id: 'a', label: ['이전 스키마 (A)', 'Old schema (A)'], rows: 15, sample: '{\n  "type": "object",\n  "required": ["id", "name"],\n  "properties": {\n    "id": { "type": "integer" },\n    "name": { "type": "string", "maxLength": 50 },\n    "status": { "enum": ["active", "inactive"] },\n    "age": { "type": "integer", "minimum": 0 }\n  }\n}' },
    { id: 'b', label: ['새 스키마 (B)', 'New schema (B)'], rows: 15, sample: '{\n  "type": "object",\n  "required": ["id", "name", "email"],\n  "properties": {\n    "id": { "type": "string" },\n    "name": { "type": "string", "maxLength": 30 },\n    "email": { "type": "string", "format": "email" },\n    "status": { "enum": ["active", "inactive", "banned"] },\n    "age": { "type": "integer", "minimum": 18 }\n  }\n}' }
  ],
  options: [{ id: 'usage', type: 'select', label: ['스키마의 용도', 'What the schema describes'], choices: [['request', ['요청 (클라이언트가 보내는 데이터)', 'Request (data clients send)']], ['response', ['응답 (클라이언트가 받는 데이터)', 'Response (data clients receive)']]], default: 'request' }],
  outputs: [{ id: 'table', label: ['변경과 위험도', 'Changes & risk'], kind: 'table' }],
  run: function (v, o, t) {
    var A, B;
    try { A = TK.json.parseValue(v.a); } catch (e) { throw new Error('A: ' + e.message); }
    try { B = TK.json.parseValue(v.b); } catch (e) { throw new Error('B: ' + e.message); }
    var rows = TK.schema.diff(A, B, o.usage);
    var icon = { bad: '🔴', warn: '🟡', ok: '🟢' }, label = { bad: t('호환성 깨짐', 'Breaking'), warn: t('주의', 'Caution'), ok: t('안전', 'Safe') };
    var c = { bad: 0, warn: 0, ok: 0 };
    rows.forEach(function (r) { c[r.risk]++; });
    rows.sort(function (x, y) { var w = { bad: 0, warn: 1, ok: 2 }; return w[x.risk] - w[y.risk]; });
    return {
      _status: !rows.length ? t('✅ 두 스키마의 구조적 차이가 없습니다', '✅ No structural differences') : { ok: c.bad ? false : 'info', msg: (c.bad ? '⚠️ ' : '🔍 ') + t('호환성 깨짐 ' + c.bad + ' · 주의 ' + c.warn + ' · 안전 ' + c.ok, 'Breaking ' + c.bad + ' · Caution ' + c.warn + ' · Safe ' + c.ok) },
      table: { head: [['위험도', 'Risk'], ['경로', 'Path'], ['변경 내용', 'Change'], ['이전', 'Before'], ['이후', 'After']], rows: rows.map(function (r) { return { cls: r.risk === 'bad' ? 'r-bad' : r.risk === 'warn' ? 'r-warn' : 'r-ok', cells: [icon[r.risk] + ' ' + label[r.risk], r.path, r.what, r.before, r.after] }; }), empty: ['차이가 없습니다', 'No differences'] }
    };
  }
});
