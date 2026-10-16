TK.tool('json-schema-validator', {
  sampleExpectError: true,
  inputs: [
    { id: 'schema', label: ['JSON Schema', 'JSON Schema'], rows: 15, sample: '{\n  "type": "object",\n  "required": ["id", "email"],\n  "properties": {\n    "id": { "type": "integer", "minimum": 1 },\n    "email": { "type": "string", "format": "email" },\n    "role": { "enum": ["admin", "user"] },\n    "tags": { "type": "array", "items": { "type": "string" }, "uniqueItems": true }\n  },\n  "additionalProperties": false\n}' },
    { id: 'data', label: ['검증할 JSON 데이터', 'JSON data to validate'], rows: 15, sample: '{\n  "id": 0,\n  "email": "not-an-email",\n  "role": "guest",\n  "tags": ["a", "a"],\n  "extra": true\n}' }
  ],
  options: [
    { id: 'draft', type: 'select', label: ['스키마 버전', 'Draft'], choices: [['auto', ['자동 ($schema 기준)', 'Auto (from $schema)']], ['07', 'Draft-07'], ['2019-09', '2019-09'], ['2020-12', '2020-12']], default: 'auto' },
    { id: 'formats', type: 'checkbox', label: ['format 검사 (email, uri, date…)', 'Check formats (email, uri, date…)'], default: true },
    { id: 'strict', type: 'checkbox', label: ['엄격 모드 (알 수 없는 키워드 오류)', 'Strict mode (unknown keywords fail)'], default: false }
  ],
  outputs: [{ id: 'table', label: ['검증 오류', 'Validation errors'], kind: 'table' }],
  run: function (v, o, t) {
    if (typeof AjvLib === 'undefined') throw new Error(t('검증 라이브러리를 불러오지 못했습니다', 'Failed to load the validator library'));
    var schema, data;
    try { schema = TK.json.parseValue(v.schema); } catch (e) { throw new Error(t('스키마 JSON 오류: ', 'Schema JSON error: ') + e.message); }
    try { data = TK.json.parseValue(v.data); } catch (e) { throw new Error(t('데이터 JSON 오류: ', 'Data JSON error: ') + e.message); }
    var draft = o.draft;
    if (draft === 'auto') {
      var sid = schema && typeof schema === 'object' ? String(schema.$schema || '') : '';
      draft = /2020-12/.test(sid) ? '2020-12' : /2019-09/.test(sid) ? '2019-09' : '07';
    }
    var Cls = draft === '2020-12' ? AjvLib.Ajv2020 : draft === '2019-09' ? AjvLib.Ajv2019 : AjvLib.Ajv;
    var Ctor = Cls.default || Cls;
    var ajv = new Ctor({ allErrors: true, strict: !!o.strict, validateFormats: !!o.formats, verbose: false });
    if (o.formats) (AjvLib.addFormats.default || AjvLib.addFormats)(ajv);
    if (schema && typeof schema === 'object' && !Array.isArray(schema)) { schema = Object.assign({}, schema); delete schema.$schema; }
    var validate;
    try { validate = ajv.compile(schema); } catch (e) { throw new Error(t('스키마 자체가 올바르지 않습니다: ', 'The schema itself is invalid: ') + e.message); }
    var ok = validate(data), errs = validate.errors || [];
    if (ok) return { _status: t('✅ 검증 통과 — 데이터가 스키마를 만족합니다 (Draft ' + draft + ')', '✅ Valid — the data satisfies the schema (draft ' + draft + ')') };
    var seen = {};
    var rows = [];
    errs.forEach(function (e) {
      var detail = e.params ? Object.keys(e.params).map(function (k) { return k + '=' + JSON.stringify(e.params[k]); }).join(', ') : '';
      var key = e.instancePath + '|' + e.keyword + '|' + e.message + '|' + detail;
      if (seen[key]) return; seen[key] = 1;
      rows.push({ cls: 'r-bad', cells: [e.instancePath || '(root)', e.keyword, e.message, detail, e.schemaPath] });
    });
    return { _status: { ok: false, msg: t('❌ 검증 실패 — 오류 ' + rows.length + '건 (Draft ' + draft + ')', '❌ Invalid — ' + rows.length + ' error(s) (draft ' + draft + ')') },
      table: { head: [['데이터 위치', 'Data path'], ['키워드', 'Keyword'], ['메시지', 'Message'], ['세부', 'Details'], ['스키마 위치', 'Schema path']], rows: rows } };
  }
});
