TK.tool('llm-schema-validator', {
  sampleExpectError: true,
  inputs: [{ id: 'in', label: ['JSON Schema (또는 response_format / 도구 정의 전체)', 'JSON Schema (or a whole response_format / tool definition)'], rows: 22, sample: JSON.stringify({
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      age: { type: 'integer', minimum: 0 },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['admin', 'user'] },
      address: { type: 'object', properties: { city: { type: 'string' }, zip: { type: 'string', pattern: '^\\d{5}$' } }, required: ['city'] },
      tags: { type: 'array', items: { type: 'string' }, uniqueItems: true },
      payment: { oneOf: [{ type: 'object', properties: { card: { type: 'string' } } }, { type: 'object', properties: { iban: { type: 'string' } } }] }
    },
    required: ['name', 'age']
  }, null, 2) }],
  options: [
    { id: 'prov', type: 'select', label: ['대상', 'Target'], choices: [['openai', ['OpenAI Structured Outputs (strict)', 'OpenAI Structured Outputs (strict)']], ['gemini', ['Google Gemini responseSchema', 'Google Gemini responseSchema']], ['generic', ['일반 도구 호출 (Anthropic 등)', 'General tool calling (Anthropic etc.)']]], default: 'openai' },
    { id: 'fix', type: 'checkbox', label: ['호환되도록 자동 변환한 스키마도 출력', 'Also output an automatically converted schema'], default: true }
  ],
  outputs: [{ id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'out', label: ['자동 변환된 스키마', 'Converted schema'], kind: 'code', ext: 'json' }, { id: 'table', label: ['스키마 통계', 'Schema statistics'], kind: 'table' }],
  run: function (v, o, t) {
    var src = String(v['in'] || '').trim(); if (!src) throw new Error(t('스키마를 입력하세요', 'Enter a schema'));
    var root; try { root = JSON.parse(src); } catch (e) { throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); }
    var issues = [], wrapper = null;
    /* 래퍼 풀기 */
    if (root && root.response_format) root = root.response_format;
    if (root && root.type === 'json_schema' && root.json_schema) { wrapper = { name: root.json_schema.name, strict: root.json_schema.strict }; root = root.json_schema.schema; }
    else if (root && root.json_schema && root.json_schema.schema) { wrapper = { name: root.json_schema.name, strict: root.json_schema.strict }; root = root.json_schema.schema; }
    else if (root && root.input_schema) { root = root.input_schema; wrapper = { tool: true }; }
    else if (root && root.function && root.function.parameters) { wrapper = { name: root.function.name, strict: root.function.strict, tool: true }; root = root.function.parameters; }
    else if (root && root.parameters && root.name && root.type !== 'object') { wrapper = { name: root.name, tool: true }; root = root.parameters; }
    if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error(t('스키마는 JSON 객체여야 합니다', 'The schema must be a JSON object'));
    var prov = o.prov;
    function add(sev, path, msg) { issues.push({ sev: sev, path: path, msg: msg }); }
    var stats = { objects: 0, props: 0, depth: 0, enums: 0, strLen: 0 };
    var UNSUP_OPENAI = { allOf: 1, not: 1, oneOf: 1, 'if': 1, then: 1, 'else': 1, dependentRequired: 1, dependentSchemas: 1, patternProperties: 1, unevaluatedProperties: 1, unevaluatedItems: 1, propertyNames: 1, minProperties: 1, maxProperties: 1, contains: 1, minContains: 1, maxContains: 1, uniqueItems: 1, minLength: 1, maxLength: 1, prefixItems: 1, additionalItems: 1 };
    var UNSUP_GEMINI = { allOf: 1, not: 1, oneOf: 1, 'if': 1, then: 1, 'else': 1, patternProperties: 1, dependentRequired: 1, dependentSchemas: 1, unevaluatedProperties: 1, propertyNames: 1, const: 1, uniqueItems: 1, multipleOf: 1, pattern: 1, minLength: 1, maxLength: 1, minProperties: 1, maxProperties: 1, '$schema': 1, '$id': 1, '$comment': 1 };
    var defs = root.$defs || root.definitions || {};
    var visited = [];
    function typeList(s) { return Array.isArray(s.type) ? s.type : s.type ? [s.type] : []; }
    function walk(s, path, depth, isRoot) {
      if (!s || typeof s !== 'object') return;
      if (depth > stats.depth) stats.depth = depth;
      if (typeof s.$ref === 'string') { if (prov === 'gemini' && !isRoot) add('warn', path, t('Gemini responseSchema 는 $ref 를 지원하지 않는 모델·API 버전이 있습니다. 인라인으로 펼치세요', 'Some Gemini models / API versions do not support $ref in responseSchema; inline it')); var tgt = /^#\/(\$defs|definitions)\/(.+)$/.exec(s.$ref); if (!tgt && s.$ref !== '#') add('error', path, t('$ref ' + s.$ref + ' 는 내부 참조(#/$defs/이름)만 지원합니다', '$ref ' + s.$ref + ' is unsupported; only internal refs (#/$defs/name) work')); else if (tgt && !defs[tgt[2]]) add('error', path, t('$ref 대상 ' + s.$ref + ' 를 찾을 수 없습니다', '$ref target ' + s.$ref + ' not found')); else if (tgt && visited.indexOf(tgt[2]) < 0) { visited.push(tgt[2]); walk(defs[tgt[2]], '#/$defs/' + tgt[2], depth, false); } return; }
      var types = typeList(s), tt = types.filter(function (x) { return x !== 'null'; })[0];
      if (!types.length && !s.anyOf && !s.enum && !s.const && !s.$ref && !(prov === 'generic')) add('warn', path, t('type 이 없습니다. 모든 스키마에 type(또는 anyOf/enum)을 명시하세요', 'No type; give every schema a type (or anyOf / enum)'));
      if (prov === 'openai') Object.keys(s).forEach(function (k) { if (UNSUP_OPENAI[k]) add('error', path + '.' + k, t('OpenAI strict 모드는 "' + k + '" 키워드를 지원하지 않습니다', 'OpenAI strict mode does not support the "' + k + '" keyword')); });
      if (prov === 'gemini') Object.keys(s).forEach(function (k) { if (UNSUP_GEMINI[k]) add('warn', path + '.' + k, t('Gemini responseSchema 는 "' + k + '" 를 지원하지 않거나 무시할 수 있습니다', 'Gemini responseSchema may not support or may ignore "' + k + '"')); });
      if (prov === 'gemini' && Array.isArray(s.type)) add('error', path + '.type', t('Gemini 는 type 배열 대신 nullable: true 를 씁니다', 'Gemini uses nullable: true instead of a type array'));
      if (s.enum) { stats.enums += s.enum.length; s.enum.forEach(function (e) { if (typeof e === 'string') stats.strLen += e.length; }); }
      if (s.properties) {
        stats.objects++;
        Object.keys(s.properties).forEach(function (k) { stats.props++; stats.strLen += k.length; if (prov === 'openai' && !/^[A-Za-z0-9_\-.$]+$/.test(k)) add('warn', path + '.properties.' + k, t('속성 이름 "' + k + '" 에 특수 문자가 있어 일부 모델에서 거부될 수 있습니다', 'Property name "' + k + '" has special characters and may be rejected by some models')); });
        if (prov === 'openai') {
          if (s.additionalProperties !== false) add('error', path, t('모든 object 에 additionalProperties: false 가 필요합니다' + (s.additionalProperties === true ? ' (현재 true)' : ''), 'Every object needs additionalProperties: false' + (s.additionalProperties === true ? ' (currently true)' : '')));
          var req = s.required || [], missing = Object.keys(s.properties).filter(function (k) { return req.indexOf(k) < 0; });
          if (missing.length) add('error', path, t('strict 모드는 모든 속성을 required 에 넣어야 합니다. 빠진 속성: ' + missing.join(', ') + ' (선택 값은 ["타입","null"] 로 표현)', 'Strict mode requires every property in required; missing: ' + missing.join(', ') + ' (express optional values as ["type","null"])'));
          req.forEach(function (r) { if (!(r in s.properties)) add('error', path + '.required', t('required 의 "' + r + '" 가 properties 에 없습니다', 'required "' + r + '" is not in properties')); });
        } else if (prov === 'generic') { (s.required || []).forEach(function (r) { if (!(r in s.properties)) add('warn', path + '.required', t('required 의 "' + r + '" 가 properties 에 없습니다', 'required "' + r + '" is not in properties')); }); }
        else if (prov === 'gemini') { (s.required || []).forEach(function (r) { if (!(r in s.properties)) add('error', path + '.required', t('required 의 "' + r + '" 가 properties 에 없습니다', 'required "' + r + '" is not in properties')); }); if (s.additionalProperties !== undefined) add('warn', path + '.additionalProperties', t('Gemini 는 additionalProperties 를 지원하지 않는 버전이 있습니다', 'Some Gemini versions do not support additionalProperties')); }
        Object.keys(s.properties).forEach(function (k) { walk(s.properties[k], path + '.properties.' + k, depth + 1, false); });
      } else if (tt === 'object') {
        if (prov === 'openai' && !s.anyOf) add('error', path, t('properties 가 없는 object 는 strict 모드에서 허용되지 않습니다 (자유 형식 객체 불가)', 'An object without properties is not allowed in strict mode (no free-form objects)'));
        if (prov === 'openai' && s.additionalProperties && typeof s.additionalProperties === 'object') add('error', path + '.additionalProperties', t('additionalProperties 는 false 여야 합니다 (맵 형태 불가). 배열의 {key, value} 객체로 바꾸세요', 'additionalProperties must be false (no map types); use an array of {key, value} objects'));
      }
      if (tt === 'array') { if (!s.items && prov !== 'generic') add('error', path, t('array 에는 items 가 필요합니다', 'array needs items')); if (s.items) walk(s.items, path + '.items', depth + 1, false); }
      ['anyOf', 'oneOf', 'allOf'].forEach(function (k) { if (Array.isArray(s[k])) s[k].forEach(function (x, i) { walk(x, path + '.' + k + '[' + i + ']', depth + 1, false); }); });
      if (s.description) stats.strLen += String(s.description).length;
      if (prov === 'openai' && tt === 'string' && s.format && ['date-time', 'time', 'date', 'duration', 'email', 'hostname', 'ipv4', 'ipv6', 'uuid'].indexOf(s.format) < 0) add('warn', path + '.format', t('OpenAI strict 의 지원 format 은 date-time, time, date, duration, email, hostname, ipv4, ipv6, uuid 입니다', 'OpenAI strict supports formats date-time, time, date, duration, email, hostname, ipv4, ipv6 and uuid'));
      if (prov === 'gemini' && tt === 'string' && s.format && ['enum', 'date-time'].indexOf(s.format) < 0) add('warn', path + '.format', t('Gemini string 의 지원 format 은 enum, date-time 입니다', 'Gemini supports string formats enum and date-time'));
    }
    if (prov === 'openai') {
      var rt = typeList(root)[0];
      if (rt !== 'object' && !(root.properties)) add('error', '#', t('루트는 type: object 여야 합니다' + (root.anyOf ? ' (루트를 anyOf 로 둘 수 없음)' : ''), 'The root must be type: object' + (root.anyOf ? ' (the root cannot be anyOf)' : '')));
      if (wrapper && wrapper.name && !/^[a-zA-Z0-9_-]{1,64}$/.test(wrapper.name)) add('error', '#', t('스키마 이름은 영문자·숫자·_·- 로 64자 이하여야 합니다', 'The schema name must be 1–64 letters, digits, _ or -'));
      if (wrapper && wrapper.strict === false) add('warn', '#', t('strict: false 이면 이 규칙들이 강제되지 않고 JSON 형식 보장도 약해집니다', 'With strict: false these rules are not enforced and the JSON guarantee is weaker'));
      if (wrapper && wrapper.strict === undefined) add('info', '#', t('response_format.json_schema.strict: true 를 지정해야 스키마 준수가 보장됩니다', 'Set response_format.json_schema.strict: true to guarantee schema adherence'));
    }
    walk(root, '#', 0, true);
    if (prov === 'openai') { if (stats.props > 5000) add('error', '#', t('총 속성이 5,000개를 넘습니다 (' + stats.props + ')', 'More than 5,000 properties in total (' + stats.props + ')')); if (stats.depth > 10) add('error', '#', t('중첩 깊이가 10단계를 넘습니다 (' + stats.depth + ')', 'Nesting deeper than 10 levels (' + stats.depth + ')')); if (stats.enums > 1000) add('error', '#', t('enum 값이 1,000개를 넘습니다', 'More than 1,000 enum values')); if (stats.strLen > 120000) add('error', '#', t('속성 이름·enum·설명 문자열 합계가 120,000자를 넘습니다', 'The total of names, enums and descriptions exceeds 120,000 characters')); }
    if (prov === 'openai' && stats.depth > 5) add('info', '#', t('중첩이 깊을수록 모델 정확도가 떨어집니다. 5단계 이하를 권장합니다', 'Deep nesting lowers accuracy; 5 levels or fewer is recommended'));
    if (prov === 'generic' && !wrapper && typeList(root)[0] !== 'object') add('warn', '#', t('도구 입력 스키마의 루트는 type: object 여야 합니다', 'A tool input schema should have a root of type: object'));
    var noDesc = []; (function d(s, path) { if (s && s.properties) Object.keys(s.properties).forEach(function (k) { var p = s.properties[k]; if (p && typeof p === 'object' && !p.description && !p.$ref && !p.enum) noDesc.push(k); d(p, path); }); if (s && s.items) d(s.items, path); })(root, '#');
    if (noDesc.length > 2) add('info', '#', t('description 이 없는 속성이 ' + noDesc.length + '개 있습니다. 모델은 설명을 보고 값을 채우므로 속성마다 description 을 쓰면 정확도가 올라갑니다', noDesc.length + ' properties have no description; models fill values from descriptions, so adding them improves accuracy'));
    /* 변환 */
    var outTxt = '';
    if (o.fix) {
      var copy = JSON.parse(JSON.stringify(root)), removed = {};
      (function fix(s) {
        if (!s || typeof s !== 'object') return;
        Object.keys(s).forEach(function (k) { if (prov === 'openai' && UNSUP_OPENAI[k]) { if (k === 'oneOf') { s.anyOf = s.oneOf; } removed[k] = 1; delete s[k]; } else if (prov === 'gemini' && UNSUP_GEMINI[k]) { removed[k] = 1; delete s[k]; } });
        if (s.properties) {
          if (prov === 'openai') {
            var req = s.required || [];
            Object.keys(s.properties).forEach(function (k) { var p = s.properties[k]; if (req.indexOf(k) < 0 && p && typeof p === 'object') { if (Array.isArray(p.type)) { if (p.type.indexOf('null') < 0) p.type = p.type.concat('null'); } else if (p.type) p.type = [p.type, 'null']; else if (p.anyOf) { if (!p.anyOf.some(function (x) { return x && x.type === 'null'; })) p.anyOf = p.anyOf.concat({ type: 'null' }); } else if (p.$ref) s.properties[k] = { anyOf: [p, { type: 'null' }] }; if (p.enum && p.enum.indexOf(null) < 0) p.enum = p.enum.concat(null); } });
            s.required = Object.keys(s.properties); s.additionalProperties = false;
          } else if (prov === 'gemini') { Object.keys(s.properties).forEach(function (k) { var p = s.properties[k]; if (p && Array.isArray(p.type)) { var nn = p.type.filter(function (x) { return x !== 'null'; }); if (p.type.indexOf('null') >= 0) p.nullable = true; p.type = nn[0]; } }); delete s.additionalProperties; }
          Object.keys(s.properties).forEach(function (k) { fix(s.properties[k]); });
        }
        if (s.items) fix(s.items); ['anyOf', 'allOf', 'oneOf'].forEach(function (k) { if (Array.isArray(s[k])) s[k].forEach(fix); }); if (s.$defs) Object.keys(s.$defs).forEach(function (k) { fix(s.$defs[k]); }); if (s.definitions) Object.keys(s.definitions).forEach(function (k) { fix(s.definitions[k]); });
      })(copy);
      var res = prov === 'openai' ? { type: 'json_schema', json_schema: { name: (wrapper && wrapper.name) || 'response', strict: true, schema: copy } } : copy;
      outTxt = JSON.stringify(res, null, 2);
      if (Object.keys(removed).length) add('info', '#', t('변환에서 지원하지 않는 키워드를 제거했습니다: ' + Object.keys(removed).join(', ') + ' — 제약은 프롬프트의 description 이나 후처리 검증으로 옮기세요', 'Removed unsupported keywords in the conversion: ' + Object.keys(removed).join(', ') + ' — move the constraints into descriptions or post-validation'));
      if (prov === 'openai') add('info', '#', t('선택 속성은 필수로 바꾸고 ["타입","null"] 로 null 을 허용했습니다. 모델이 값을 모르면 null 을 채웁니다', 'Optional properties became required with ["type","null"]; the model emits null when it has no value'));
    }
    if (prov === 'openai') add('info', '#', t('규칙은 공개 문서를 기준으로 하며 모델·시기에 따라 지원 범위가 넓어질 수 있습니다. 최종 확인은 실제 API 호출로 하세요', 'Rules follow the public docs and support may widen by model and over time; confirm with a real API call'));
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' }, order = { error: 0, warn: 1, info: 2 };
    var list = issues.sort(function (a, b) { return order[a.sev] - order[b.sev]; }).map(function (x) { return ICON[x.sev] + ' ' + (x.path !== '#' ? x.path + ': ' : '') + x.msg; });
    var errs = issues.filter(function (x) { return x.sev === 'error'; }).length, warns = issues.filter(function (x) { return x.sev === 'warn'; }).length;
    return { _status: { ok: errs ? false : true, msg: errs ? t('⛔ 호환되지 않는 부분 ' + errs + '건 · 경고 ' + warns + '건', '⛔ ' + errs + ' incompatibility(ies), ' + warns + ' warning(s)') : t('✅ 호환됩니다' + (warns ? ' · 경고 ' + warns + '건' : ''), '✅ Compatible' + (warns ? ' · ' + warns + ' warning(s)' : '')) }, issues: list, out: outTxt, table: { head: [['항목', 'Item'], ['값', 'Value']], rows: [[t('객체 수', 'Objects'), String(stats.objects)], [t('속성 수', 'Properties'), String(stats.props)], [t('최대 깊이', 'Max depth'), String(stats.depth)], [t('enum 값 수', 'Enum values'), String(stats.enums)]] } };
  }
});
