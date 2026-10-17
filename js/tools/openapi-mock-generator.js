TK.tool('openapi-mock-generator', {
  inputs: [{ id: 'in', label: ['OpenAPI 문서 (YAML 또는 JSON)', 'OpenAPI document (YAML or JSON)'], rows: 24, sample: [
    'openapi: 3.0.3', 'info: { title: Pets, version: 1.0.0 }', 'servers: [{ url: https://api.example.com/v1 }]', 'paths:', '  /pets:', '    get:', '      summary: List pets', '      parameters: [{ name: limit, in: query, schema: { type: integer } }]',
    '      responses:', '        "200":', '          description: OK', '          content:', '            application/json:', '              schema: { type: array, items: { $ref: "#/components/schemas/Pet" } }',
    '    post:', '      summary: Add a pet', '      requestBody:', '        content: { application/json: { schema: { $ref: "#/components/schemas/NewPet" } } }', '      responses:', '        "201":', '          description: Created', '          content: { application/json: { schema: { $ref: "#/components/schemas/Pet" } } }',
    '        "400": { description: Bad request, content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }',
    'components:', '  schemas:', '    Pet:', '      type: object', '      required: [id, name]',
    '      properties:', '        id: { type: integer, format: int64, readOnly: true }', '        name: { type: string, example: Rex }', '        status: { type: string, enum: [available, sold] }', '        birthday: { type: string, format: date }', '        owner: { $ref: "#/components/schemas/Owner" }', '        tags: { type: array, items: { type: string } }',
    '    NewPet:', '      type: object', '      required: [name]', '      properties: { name: { type: string }, tag: { type: string } }',
    '    Owner: { type: object, properties: { email: { type: string, format: email }, id: { type: string, format: uuid } } }',
    '    Error: { type: object, required: [code, message], properties: { code: { type: integer, example: 400 }, message: { type: string } } }', ''].join('\n') }],
  options: [
    { id: 'target', type: 'text', label: ['엔드포인트 (예: GET /pets · 비우면 첫 번째)', 'Endpoint (e.g. GET /pets; empty = first)'], default: 'GET /pets' },
    { id: 'what', type: 'select', label: ['생성 대상', 'Generate'], choices: [['response', ['응답 본문', 'Response body']], ['request', ['요청 본문', 'Request body']]], default: 'response' },
    { id: 'status', type: 'text', label: ['응답 코드 (비우면 첫 2XX)', 'Response status (empty = first 2XX)'], default: '' },
    { id: 'items', type: 'number', label: ['배열 항목 수', 'Array items'], default: 2, min: 1, max: 3 },
    { id: 'ex', type: 'checkbox', label: ['스키마의 example/default 를 우선 사용', 'Prefer example / default values from the schema'], default: true },
    { id: 'req', type: 'checkbox', label: ['필수 필드만', 'Required fields only'], default: false }
  ],
  outputs: [{ id: 'out', label: ['Mock 데이터 (JSON)', 'Mock data (JSON)'], kind: 'code', ext: 'json' }, { id: 'table', label: ['엔드포인트 목록', 'Endpoints'], kind: 'table' }, { id: 'curl', label: ['호출 예시 (curl)', 'Call example (curl)'], kind: 'code', ext: 'sh' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var O = TK.openapi, L = O.load(v['in'], t('OpenAPI 문서', 'OpenAPI document')), spec = L.spec, issues = [], ops = O.operations(spec);
    if (!ops.length) throw new Error(t('paths 에 엔드포인트가 없습니다', 'There are no endpoints in paths'));
    var want = String(o.target || '').trim().replace(/\s+/, ' ').toUpperCase(), sel;
    if (want) { var m = /^([A-Z]+)\s+(\S+)$/.exec(String(o.target).trim().replace(/\s+/, ' ')); if (m) sel = ops.filter(function (x) { return x.method.toUpperCase() === m[1].toUpperCase() && x.path === m[2]; })[0]; if (!sel) throw new Error(t('엔드포인트 "' + o.target + '" 를 찾을 수 없습니다 (예: GET /pets)', 'Endpoint "' + o.target + '" not found (e.g. GET /pets)')); } else sel = ops[0];
    var vers3 = L.version !== '2.0', rows = ops.map(function (x) { var codes = Object.keys(x.op.responses || {}); return [x.method.toUpperCase(), x.path, x.op.operationId || '—', codes.join(', ') || '—', x === sel ? '◀' : '']; });
    var opts = { useExamples: !!o.ex, arrayItems: Math.round(o.items), requiredOnly: !!o.req, forRequest: o.what === 'request' };
    var media, schema, example, title;
    function pickMedia(content) { if (!content) return null; var k = Object.keys(content), json = k.filter(function (x) { return /json/.test(x); })[0] || k[0]; return json ? { type: json, body: content[json] } : null; }
    if (o.what === 'request') {
      title = sel.method.toUpperCase() + ' ' + sel.path + ' ' + t('요청 본문', 'request body');
      var rb = sel.op.requestBody ? O.deref(spec, sel.op.requestBody) : null;
      if (!vers3) { var bp = O.params(spec, sel).hasOwnProperty('body:body') ? O.params(spec, sel)['body:body'] : null; if (bp) { schema = bp.schema; media = { type: 'application/json', body: {} }; } }
      else if (rb) media = pickMedia(rb.content);
      if (!media) throw new Error(t('이 엔드포인트에는 요청 본문이 없습니다', 'This endpoint has no request body'));
      if (media.body.example !== undefined && o.ex) example = media.body.example; else if (media.body.examples && o.ex) { var fk = Object.keys(media.body.examples)[0]; example = fk ? O.deref(spec, media.body.examples[fk]).value : undefined; }
      if (example === undefined) { schema = schema || media.body.schema; if (!schema) throw new Error(t('요청 본문에 schema 가 없습니다', 'The request body has no schema')); example = O.example(spec, schema, opts, 'body'); }
    } else {
      var codes = Object.keys(sel.op.responses || {}); if (!codes.length) throw new Error(t('responses 가 없습니다', 'There are no responses'));
      var code = String(o.status || '').trim() || codes.filter(function (c) { return /^2/.test(c); })[0] || codes[0];
      if (codes.indexOf(code) < 0) throw new Error(t('응답 코드 ' + code + ' 가 없습니다 (정의된 코드: ' + codes.join(', ') + ')', 'Response ' + code + ' is not defined (defined: ' + codes.join(', ') + ')'));
      title = sel.method.toUpperCase() + ' ' + sel.path + ' → ' + code;
      var rsp = O.deref(spec, sel.op.responses[code]) || {};
      if (!vers3) { schema = rsp.schema; media = schema ? { type: 'application/json', body: {} } : null; if (rsp.examples) { var ek = Object.keys(rsp.examples)[0]; if (ek && o.ex) example = rsp.examples[ek]; } }
      else media = pickMedia(rsp.content);
      if (!media) { example = null; issues.push('ℹ️ ' + t('응답 ' + code + ' 에는 본문이 정의되어 있지 않습니다 (' + (rsp.description || '') + ')', 'Response ' + code + ' defines no body (' + (rsp.description || '') + ')')); }
      else {
        if (media.body.example !== undefined && o.ex) { example = media.body.example; issues.push('ℹ️ ' + t('스펙에 적힌 example 을 그대로 사용했습니다', 'Used the example written in the spec')); }
        else if (media.body.examples && o.ex && Object.keys(media.body.examples).length) { var ek2 = Object.keys(media.body.examples)[0]; example = O.deref(spec, media.body.examples[ek2]).value; issues.push('ℹ️ ' + t('스펙의 examples.' + ek2 + ' 를 사용했습니다', 'Used examples.' + ek2 + ' from the spec')); }
        if (example === undefined) { schema = schema || media.body.schema; if (!schema) { example = null; issues.push('⚠️ ' + t('응답에 schema 가 없어 본문을 만들 수 없습니다', 'The response has no schema, so no body can be generated')); } else example = O.example(spec, schema, opts, 'response'); }
      }
    }
    var base = (spec.servers && spec.servers[0] && spec.servers[0].url) || (spec.host ? (spec.schemes && spec.schemes[0] || 'https') + '://' + spec.host + (spec.basePath || '') : 'https://api.example.com');
    var urlPath = sel.path.replace(/\{([^}]+)\}/g, function (_, n) { var pr = O.params(spec, sel)['path:' + n]; var sc = pr && pr.schema; var ex = sc ? O.example(spec, sc, { useExamples: true }, n) : 1; return encodeURIComponent(String(ex)); });
    var qs = Object.keys(O.params(spec, sel)).map(function (k) { return O.params(spec, sel)[k]; }).filter(function (p) { return p.in === 'query' && p.required; }).map(function (p) { return encodeURIComponent(p.name) + '=' + encodeURIComponent(String(p.schema ? O.example(spec, p.schema, { useExamples: true }, p.name) : 1)); }).join('&');
    var curl = 'curl -X ' + sel.method.toUpperCase() + ' "' + base.replace(/\/$/, '') + urlPath + (qs ? '?' + qs : '') + '"' + (sel.op.requestBody || (!vers3 && O.params(spec, sel)['body:body']) ? ' \\\n  -H "Content-Type: application/json" \\\n  -d \'' + JSON.stringify(o.what === 'request' ? example : O.example(spec, (function () { var rb2 = sel.op.requestBody ? O.deref(spec, sel.op.requestBody) : null; var mm = rb2 && pickMedia(rb2.content); return mm && mm.body.schema || {}; })(), { forRequest: true, useExamples: true, arrayItems: 1 }, 'body')) + '\'' : '');
    var out = example === null || example === undefined ? '' : JSON.stringify(example, null, 2);
    if (example !== null && typeof example !== 'object' && example !== undefined) out = JSON.stringify(example);
    issues.push(t('값은 스키마에서 결정적으로 만든 예시입니다(같은 입력이면 같은 결과). 실제 서버 데이터가 아니며 example 이 있으면 우선합니다', 'Values are deterministic samples built from the schema (same input, same output), not real server data; an example in the spec takes precedence'));
    if (o.what === 'response') issues.push(t('readOnly 필드는 응답에 포함하고 writeOnly 필드는 제외합니다', 'readOnly fields are included in responses and writeOnly fields are left out'));
    return { _status: t('✅ ' + title + ' 의 Mock 데이터를 만들었습니다', '✅ Generated mock data for ' + title), out: out, table: { head: [['메서드', 'Method'], ['경로', 'Path'], ['operationId', 'operationId'], ['응답 코드', 'Status codes'], ['', '']], rows: rows }, curl: curl, issues: issues };
  }
});
