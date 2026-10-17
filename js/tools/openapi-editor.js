TK.tool('openapi-editor', {
  sampleExpectError: true,
  inputs: [{ id: 'in', label: ['OpenAPI / Swagger 문서 (YAML 또는 JSON)', 'OpenAPI / Swagger document (YAML or JSON)'], rows: 26, sample: [
    'openapi: 3.0.3',
    'info:',
    '  title: Pet Store',
    'paths:',
    '  /pets/{petId}:',
    '    get:',
    '      operationId: getPet',
    '      parameters:',
    '        - name: limit',
    '          in: query',
    '          schema: { type: integer, minimum: 1 }',
    '      responses:',
    '        "200":',
    '          description: OK',
    '          content:',
    '            application/json:',
    '              schema: { $ref: "#/components/schemas/Pet" }',
    '        "404": { $ref: "#/components/responses/Missing" }',
    '    delete:',
    '      operationId: getPet',
    '      requestBody: { content: { application/json: { schema: { type: object } } } }',
    '      responses: {}',
    '  /pets:',
    '    post:',
    '      security: [{ apiKey: [] }]',
    '      responses:',
    '        "201": { description: Created }',
    '        "2xx": { description: Any }',
    'components:',
    '  schemas:',
    '    Pet:',
    '      type: object',
    '      required: [id, name]',
    '      properties:',
    '        id: { type: integer, format: int64 }',
    '        tags: { type: array }',
    '        age: { type: string, format: int32 }',
    '    Unused: { type: string }',
    ''].join('\n') }],
  options: [{ id: 'hints', type: 'checkbox', label: ['권고(ℹ️)도 표시', 'Also show hints (ℹ️)'], default: true }],
  outputs: [{ id: 'table', label: ['엔드포인트', 'Endpoints'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var O = TK.openapi, issues = [], L = O.load(v['in'], t('OpenAPI 문서', 'OpenAPI document')), spec = L.spec;
    function add(sev, path, msg) { issues.push({ sev: sev, line: O.line(L, path), msg: msg }); }
    L.dups.forEach(function (d) { issues.push({ sev: 'error', line: d.line, msg: t('키 "' + d.key + '" 가 중복되었습니다 (첫 정의: 줄 ' + d.first + ')', 'Duplicate key "' + d.key + '" (first at line ' + d.first + ')') }); });
    var ver = L.version;
    if (!ver) { add('error', [], t('openapi(3.x) 또는 swagger(2.0) 필드가 없거나 버전을 알 수 없습니다 (' + (L.rawVersion || '없음') + ')', 'Missing or unknown openapi (3.x) / swagger (2.0) version (' + (L.rawVersion || 'none') + ')')); ver = '3.0'; }
    var v3 = ver !== '2.0';
    if (!spec.info || !spec.info.title) add('error', ['info'], t('info.title 이 필요합니다', 'info.title is required')); if (!spec.info || !spec.info.version) add('error', ['info'], t('info.version 이 필요합니다', 'info.version is required'));
    if (!spec.paths && !(ver === '3.1' && (spec.webhooks || spec.components))) add('error', [], t('paths 가 필요합니다', 'paths is required'));
    if (v3 && Array.isArray(spec.servers)) spec.servers.forEach(function (s, i) { if (!s || !s.url) add('error', ['servers', i], t('servers[' + i + '].url 이 필요합니다', 'servers[' + i + '].url is required')); else { (String(s.url).match(/\{(\w+)\}/g) || []).forEach(function (m) { var nm = m.slice(1, -1); if (!s.variables || !s.variables[nm]) add('error', ['servers', i, 'url'], t('서버 변수 {' + nm + '} 가 variables 에 없습니다', 'Server variable {' + nm + '} is missing from variables')); }); if (/^http:\/\//.test(s.url) && o.hints && !/localhost|127\.0\.0\.1/.test(s.url)) add('info', ['servers', i, 'url'], t('http:// 서버입니다. 운영 API 는 https 를 쓰세요', 'An http:// server; use https for production APIs')); } });
    if (!v3 && !spec.host && o.hints) add('info', [], t('host 가 없으면 문서를 제공한 호스트를 기준으로 합니다', 'Without host the serving host is assumed'));
    var ops = O.operations(spec), ids = {}, rows = [], usedRefs = {}, tagsDeclared = (spec.tags || []).map(function (x) { return x && x.name; }), tagsUsed = {};
    var codeRe = /^(default|[1-5](\d\d|XX))$/;
    function checkSchema(sc, path, ctx) {
      if (!sc || typeof sc !== 'object') return;
      if (typeof sc.$ref === 'string') { refCheck(sc.$ref, path.concat('$ref')); return; }
      var type = sc.type;
      var types = Array.isArray(type) ? type : type ? [type] : [];
      if (Array.isArray(type) && !(ver === '3.1')) add('error', path.concat('type'), t('type 에 배열은 OpenAPI 3.1 에서만 쓸 수 있습니다 (3.0 은 nullable: true)', 'A type array is OpenAPI 3.1 only (use nullable: true in 3.0)'));
      types.forEach(function (ty) { if (['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'].indexOf(ty) < 0) add('error', path.concat('type'), t('알 수 없는 type "' + ty + '"', 'Unknown type "' + ty + '"')); });
      if (ver === '3.1' && sc.nullable) add('warn', path.concat('nullable'), t('nullable 은 3.1 에서 제거되었습니다. type: [x, "null"] 을 쓰세요', 'nullable was removed in 3.1; use type: [x, "null"]'));
      if (ver !== '3.1' && sc.type === 'null') add('error', path.concat('type'), t('type: null 은 3.1 에서만 가능합니다', 'type: null is valid in 3.1 only'));
      if (types.indexOf('array') >= 0 && !sc.items && !sc.prefixItems) add('error', path, t('type: array 에는 items 가 필요합니다', 'type: array needs items'));
      if (Array.isArray(sc.enum) && !sc.enum.length) add('error', path.concat('enum'), t('enum 이 비어 있습니다', 'enum is empty'));
      if (sc.required && sc.properties && Array.isArray(sc.required)) sc.required.forEach(function (r) { if (!(r in sc.properties) && !sc.allOf && !sc.additionalProperties) add('warn', path.concat('required'), t('required 의 "' + r + '" 가 properties 에 없습니다', 'required "' + r + '" is not in properties')); });
      if (sc.required && !Array.isArray(sc.required)) add('error', path.concat('required'), t('스키마의 required 는 문자열 배열이어야 합니다', 'Schema required must be an array of strings'));
      var f = sc.format, ty0 = types.filter(function (x) { return x !== 'null'; })[0];
      if (f && ty0) { var okF = { string: ['date', 'date-time', 'time', 'duration', 'password', 'byte', 'binary', 'email', 'uuid', 'uri', 'uri-reference', 'hostname', 'ipv4', 'ipv6', 'regex', 'json-pointer', 'iri', 'idn-email', 'idn-hostname', 'uri-template'], integer: ['int32', 'int64'], number: ['float', 'double', 'int32', 'int64'] }[ty0]; if (okF && okF.indexOf(f) < 0) add(ty0 === 'string' ? 'info' : 'warn', path.concat('format'), t('format "' + f + '" 은(는) type ' + ty0 + ' 와 맞지 않거나 표준 포맷이 아닙니다', 'format "' + f + '" does not fit type ' + ty0 + ' or is not a standard format')); else if (!okF && ty0 !== 'object' && ty0 !== 'array' && ty0 !== 'boolean') { /* ignore */ } else if (!okF) add('warn', path.concat('format'), t('type ' + ty0 + ' 에는 format 을 쓰지 않습니다', 'type ' + ty0 + ' does not use format')); }
      if (sc.minimum !== undefined && sc.maximum !== undefined && sc.minimum > sc.maximum) add('error', path, t('minimum 이 maximum 보다 큽니다', 'minimum is greater than maximum'));
      if (sc.minLength !== undefined && sc.maxLength !== undefined && sc.minLength > sc.maxLength) add('error', path, t('minLength 가 maxLength 보다 큽니다', 'minLength is greater than maxLength'));
      if (ver === '3.0' && typeof sc.exclusiveMinimum === 'number') add('error', path.concat('exclusiveMinimum'), t('3.0 의 exclusiveMinimum 은 불리언입니다 (숫자는 3.1)', 'exclusiveMinimum is a boolean in 3.0 (numbers are 3.1)'));
      if (ver === '3.1' && typeof sc.exclusiveMinimum === 'boolean') add('error', path.concat('exclusiveMinimum'), t('3.1 의 exclusiveMinimum 은 숫자입니다', 'exclusiveMinimum is a number in 3.1'));
      if (sc.example !== undefined && ty0) { var ex = sc.example, bad = (ty0 === 'integer' && !Number.isInteger(ex)) || (ty0 === 'number' && typeof ex !== 'number') || (ty0 === 'string' && typeof ex !== 'string') || (ty0 === 'boolean' && typeof ex !== 'boolean') || (ty0 === 'array' && !Array.isArray(ex)) || (ty0 === 'object' && (typeof ex !== 'object' || Array.isArray(ex) || ex === null)); if (bad && !(ex === null && sc.nullable)) add('warn', path.concat('example'), t('example 이 type ' + ty0 + ' 와 맞지 않습니다', 'example does not match type ' + ty0)); }
      if (sc.properties) Object.keys(sc.properties).forEach(function (k) { checkSchema(sc.properties[k], path.concat('properties', k), ctx); });
      if (sc.items) checkSchema(sc.items, path.concat('items'), ctx);
      if (sc.additionalProperties && typeof sc.additionalProperties === 'object') checkSchema(sc.additionalProperties, path.concat('additionalProperties'), ctx);
      ['allOf', 'oneOf', 'anyOf'].forEach(function (k) { if (sc[k]) { if (!Array.isArray(sc[k]) || !sc[k].length) add('error', path.concat(k), t(k + ' 는 비어 있지 않은 배열이어야 합니다', k + ' must be a non-empty array')); else sc[k].forEach(function (s, i) { checkSchema(s, path.concat(k, i), ctx); }); } });
      if (sc.discriminator && v3) { var dn = sc.discriminator.propertyName; if (!dn) add('error', path.concat('discriminator'), t('discriminator.propertyName 이 필요합니다', 'discriminator.propertyName is required')); else if (sc.properties && !(dn in sc.properties) && !sc.oneOf && !sc.anyOf && !sc.allOf) add('warn', path.concat('discriminator'), t('discriminator 속성 "' + dn + '" 가 properties 에 없습니다', 'discriminator property "' + dn + '" is not in properties')); if (sc.discriminator.mapping) Object.keys(sc.discriminator.mapping).forEach(function (mk) { var mv = sc.discriminator.mapping[mk]; if (/^#/.test(mv) && O.resolve(spec, mv) === undefined) add('error', path.concat('discriminator', 'mapping', mk), t('mapping 의 ' + mv + ' 를 찾을 수 없습니다', 'mapping target ' + mv + ' not found')); }); }
    }
    function refCheck(ref, path) { if (ref.charAt(0) === '#') { if (O.resolve(spec, ref) === undefined) add('error', path, t('$ref ' + ref + ' 대상을 찾을 수 없습니다', '$ref ' + ref + ' cannot be resolved')); else usedRefs[ref] = true; } else if (o.hints) add('info', path, t('외부 $ref(' + ref + ')는 확인하지 않습니다', 'External $ref (' + ref + ') is not checked')); }
    function scanRefs(x, path) { if (Array.isArray(x)) { x.forEach(function (e, i) { scanRefs(e, path.concat(i)); }); return; } if (!x || typeof x !== 'object') return; if (typeof x.$ref === 'string') { refCheck(x.$ref, path.concat('$ref')); return; } Object.keys(x).forEach(function (k) { scanRefs(x[k], path.concat(k)); }); }
    var schemeNames = v3 ? Object.keys((spec.components || {}).securitySchemes || {}) : Object.keys(spec.securityDefinitions || {});
    function checkSecurity(sec, path) { (sec || []).forEach(function (req, i) { Object.keys(req || {}).forEach(function (n) { if (schemeNames.indexOf(n) < 0) add('error', path.concat(i), t('security 의 "' + n + '" 가 securitySchemes 에 정의되지 않았습니다', 'security "' + n + '" is not defined in securitySchemes')); }); }); }
    if (spec.security) checkSecurity(spec.security, ['security']);
    Object.keys(spec.paths || {}).forEach(function (p) {
      if (p.charAt(0) !== '/') add('error', ['paths', p], t('경로 "' + p + '" 는 /로 시작해야 합니다', 'Path "' + p + '" must start with /'));
      var item = O.deref(spec, spec.paths[p]); if (!item || typeof item !== 'object') return;
      var tpl = (p.match(/\{([^}]+)\}/g) || []).map(function (x) { return x.slice(1, -1); });
      if (new Set(tpl).size !== tpl.length) add('error', ['paths', p], t('경로 템플릿에 같은 변수가 반복됩니다', 'The path template repeats a variable'));
      var norm = p.replace(/\{[^}]+\}/g, '{}'); Object.keys(spec.paths).forEach(function (q) { if (q !== p && q.replace(/\{[^}]+\}/g, '{}') === norm && q > p) add('error', ['paths', q], t('경로 "' + q + '" 는 "' + p + '" 와 변수 이름만 달라 모호합니다', 'Path "' + q + '" differs from "' + p + '" only in variable names (ambiguous)')); });
      O.METHODS.forEach(function (m) {
        var op = item[m]; if (!op) return; var base = ['paths', p, m];
        if (!op || typeof op !== 'object') return;
        var params = O.params(spec, { item: item, op: op });
        var declaredPath = Object.keys(params).filter(function (k) { return k.indexOf('path:') === 0; }).map(function (k) { return k.slice(5); });
        tpl.forEach(function (n) { if (declaredPath.indexOf(n) < 0) add('error', base, t(m.toUpperCase() + ' ' + p + ': 경로 변수 {' + n + '} 에 해당하는 in: path 파라미터가 없습니다', m.toUpperCase() + ' ' + p + ': no in: path parameter for {' + n + '}')); });
        declaredPath.forEach(function (n) { if (tpl.indexOf(n) < 0) add('error', base.concat('parameters'), t('경로 파라미터 "' + n + '" 가 경로 템플릿 ' + p + ' 에 없습니다', 'Path parameter "' + n + '" is not in the path template ' + p)); });
        Object.keys(params).forEach(function (k) { var pr = params[k]; if (pr.in === 'path' && pr.required !== true) add('error', base.concat('parameters'), t('경로 파라미터 "' + pr.name + '" 는 required: true 여야 합니다', 'Path parameter "' + pr.name + '" must have required: true')); if (['query', 'header', 'path', 'cookie', 'body', 'formData'].indexOf(pr.in) < 0) add('error', base.concat('parameters'), t('파라미터 "' + pr.name + '" 의 in 값 "' + pr.in + '" 이 올바르지 않습니다', 'Parameter "' + pr.name + '" has an invalid in "' + pr.in + '"')); if (pr.in === 'header' && /^(accept|content-type|authorization)$/i.test(pr.name)) add('warn', base.concat('parameters'), t('헤더 파라미터 ' + pr.name + ' 는 명세에서 무시됩니다 (content / security 로 표현)', 'Header parameter ' + pr.name + ' is ignored by the spec (express it with content / security)')); if (v3 && !pr.schema && !pr.content) add('error', base.concat('parameters'), t('파라미터 "' + pr.name + '" 에는 schema 또는 content 가 필요합니다', 'Parameter "' + pr.name + '" needs schema or content')); });
        (op.parameters || []).forEach(function (pr, i) { var d = O.deref(spec, pr); if (pr && pr.$ref) refCheck(pr.$ref, base.concat('parameters', i, '$ref')); else if (d && d.schema) checkSchema(d.schema, base.concat('parameters', i, 'schema')); });
        var seen = {}; (op.parameters || []).forEach(function (pr) { var d = O.deref(spec, pr); if (!d || !d.name) return; var k = d.in + ':' + d.name; if (seen[k]) add('error', base.concat('parameters'), t('파라미터 ' + d.in + ' "' + d.name + '" 이 중복됩니다', 'Duplicate parameter ' + d.in + ' "' + d.name + '"')); seen[k] = true; });
        if (op.operationId) { if (ids[op.operationId]) add('error', base.concat('operationId'), t('operationId "' + op.operationId + '" 가 ' + ids[op.operationId] + ' 와 중복됩니다', 'operationId "' + op.operationId + '" duplicates ' + ids[op.operationId])); else ids[op.operationId] = m.toUpperCase() + ' ' + p; if (!/^[A-Za-z_][\w.-]*$/.test(op.operationId) && o.hints) add('info', base.concat('operationId'), t('operationId 는 코드 생성기가 함수 이름으로 쓰므로 영문자·숫자·_ 로 쓰는 것이 안전합니다', 'operationId becomes a function name in code generators; letters, digits and _ are safest')); }
        else if (o.hints) add('info', base, t(m.toUpperCase() + ' ' + p + ' 에 operationId 가 없습니다 (SDK 생성 시 필요)', m.toUpperCase() + ' ' + p + ' has no operationId (needed by SDK generators)'));
        (op.tags || []).forEach(function (tg) { tagsUsed[tg] = true; if (tagsDeclared.length && tagsDeclared.indexOf(tg) < 0 && o.hints) add('info', base.concat('tags'), t('태그 "' + tg + '" 가 최상위 tags 에 선언되지 않았습니다', 'Tag "' + tg + '" is not declared in top-level tags')); });
        if (op.requestBody && ['get', 'head', 'delete'].indexOf(m) >= 0) add(m === 'delete' ? 'info' : 'warn', base.concat('requestBody'), t(m.toUpperCase() + ' 에 requestBody 는 의미가 정의되지 않았습니다 (일부 서버·프록시가 무시)', 'requestBody on ' + m.toUpperCase() + ' has undefined semantics (some servers and proxies drop it)'));
        if (op.requestBody && v3) { var rb = O.deref(spec, op.requestBody); if (op.requestBody.$ref) refCheck(op.requestBody.$ref, base.concat('requestBody', '$ref')); else if (!rb.content || !Object.keys(rb.content).length) add('error', base.concat('requestBody'), t('requestBody 에는 content 가 필요합니다', 'requestBody needs content')); else Object.keys(rb.content).forEach(function (mt) { checkSchema(rb.content[mt].schema, base.concat('requestBody', 'content', mt, 'schema')); }); }
        if (!op.responses || typeof op.responses !== 'object' || !Object.keys(op.responses).length) add('error', base, t(m.toUpperCase() + ' ' + p + ': responses 에 응답이 하나 이상 필요합니다', m.toUpperCase() + ' ' + p + ': responses needs at least one response'));
        else {
          var codes = Object.keys(op.responses), has2 = false;
          codes.forEach(function (c) { var cs = String(c); if (!codeRe.test(cs)) { add('error', base.concat('responses', cs), t('응답 코드 "' + cs + '" 가 올바르지 않습니다 (100~599, 1XX~5XX, default)', 'Invalid response code "' + cs + '" (100–599, 1XX–5XX or default)')); return; } if (/^2/.test(cs) || cs === 'default') has2 = true; if (/^[1-5]xx$/.test(cs)) add('error', base.concat('responses', cs), t('범위 코드는 대문자 XX 여야 합니다 (예: 2XX)', 'Range codes use upper-case XX (e.g. 2XX)')); var rsp = op.responses[c]; if (rsp && rsp.$ref) refCheck(rsp.$ref, base.concat('responses', cs, '$ref')); else if (rsp) { if (!rsp.description && ver !== '3.1' || (ver === '3.1' && rsp.description === undefined)) add('error', base.concat('responses', cs), t('응답 ' + cs + ' 에 description 이 필요합니다', 'Response ' + cs + ' needs a description')); if (rsp.content) Object.keys(rsp.content).forEach(function (mt) { checkSchema(rsp.content[mt].schema, base.concat('responses', cs, 'content', mt, 'schema')); }); if (rsp.schema) checkSchema(rsp.schema, base.concat('responses', cs, 'schema')); } });
          if (!has2 && o.hints) add('info', base.concat('responses'), t('성공(2XX) 응답이 정의되지 않았습니다', 'No success (2XX) response is defined'));
        }
        if (op.security) checkSecurity(op.security, base.concat('security'));
        if (o.hints && !op.summary && !op.description) add('info', base, t(m.toUpperCase() + ' ' + p + ' 에 summary/description 이 없습니다', m.toUpperCase() + ' ' + p + ' has no summary or description'));
        rows.push([m.toUpperCase(), p, op.operationId || '—', Object.keys(op.responses || {}).join(', ') || '—', (op.tags || []).join(', ') || '—', String(O.line(L, base))]);
      });
      if (item.$ref) refCheck(item.$ref, ['paths', p, '$ref']);
    });
    /* components */
    var comp = v3 ? spec.components || {} : { schemas: spec.definitions || {}, parameters: spec.parameters || {}, responses: spec.responses || {} };
    Object.keys(comp.schemas || {}).forEach(function (n) { if (!/^[A-Za-z0-9._-]+$/.test(n) && v3) add('error', ['components', 'schemas', n], t('components 이름 "' + n + '" 은 영문자·숫자·. _ - 만 쓸 수 있습니다', 'Component name "' + n + '" may only use letters, digits and . _ -')); checkSchema(comp.schemas[n], (v3 ? ['components', 'schemas', n] : ['definitions', n])); });
    scanRefs(spec.paths, ['paths']); scanRefs(spec.components, ['components']); scanRefs(spec.definitions, ['definitions']);
    if (o.hints) ['schemas', 'parameters', 'responses', 'requestBodies', 'headers'].forEach(function (kind) { Object.keys(comp[kind] || {}).forEach(function (n) { var ref = v3 ? '#/components/' + kind + '/' + n : (kind === 'schemas' ? '#/definitions/' + n : '#/' + kind + '/' + n); if (!usedRefs[ref] && !JSON.stringify(spec).includes(ref + '"')) add('info', (v3 ? ['components', kind, n] : [kind === 'schemas' ? 'definitions' : kind, n]), t(kind + ' "' + n + '" 를 참조하는 곳이 없습니다', kind + ' "' + n + '" is never referenced')); }); });
    if (v3 && schemeNames.length === 0 && ops.length && !spec.security && !ops.some(function (x) { return x.op.security; }) && o.hints) add('info', [], t('인증 방식(securitySchemes)이 정의되지 않았습니다. 공개 API 가 아니라면 추가하세요', 'No securitySchemes are defined; add one unless the API is public'));
    if (L.rawVersion && ver && /^3\.0\.[0-3]$/.test(L.rawVersion) === false && ver === '3.0' && !/^3\.0\.\d+$/.test(L.rawVersion)) add('warn', ['openapi'], t('버전 문자열 "' + L.rawVersion + '" 형식이 올바르지 않습니다', 'Version string "' + L.rawVersion + '" is malformed'));
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' }, seenK = {};
    var shown = issues.filter(function (x) { return o.hints || x.sev !== 'info'; }).sort(function (a, b) { return a.line - b.line; }).filter(function (x) { var k = x.line + x.msg; if (seenK[k]) return false; seenK[k] = 1; return true; });
    var list = shown.map(function (x) { return ICON[x.sev] + ' ' + t('줄 ', 'Line ') + x.line + ': ' + x.msg; });
    var errs = shown.filter(function (x) { return x.sev === 'error'; }).length, warns = shown.filter(function (x) { return x.sev === 'warn'; }).length;
    list.push(t('이 검사는 OpenAPI 의 구조·참조·자주 쓰는 규칙을 확인하며 JSON Schema 전체 검증(unevaluatedProperties 등)은 하지 않습니다. 배포 전에는 Spectral 이나 공식 검증기로 한 번 더 확인하세요', 'This checks OpenAPI structure, references and common rules, not full JSON Schema validation (unevaluatedProperties …); also run Spectral or an official validator before publishing'));
    var msg = errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — OpenAPI ' + L.rawVersion + ', 엔드포인트 ' + ops.length + '개', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — OpenAPI ' + L.rawVersion + ', ' + ops.length + ' endpoint(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — OpenAPI ' + L.rawVersion + ', 엔드포인트 ' + ops.length + '개', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — OpenAPI ' + L.rawVersion + ', ' + ops.length + ' endpoint(s)');
    return { _status: { ok: errs ? false : true, msg: msg }, table: { head: [['메서드', 'Method'], ['경로', 'Path'], ['operationId', 'operationId'], ['응답', 'Responses'], ['태그', 'Tags'], ['줄', 'Line']], rows: rows }, issues: list };
  }
});
