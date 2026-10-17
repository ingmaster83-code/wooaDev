TK.tool('postman-converter', {
  inputs: [{ id: 'in', label: ['Postman 컬렉션(v2.x JSON) 또는 OpenAPI 문서', 'Postman collection (v2.x JSON) or OpenAPI document'], rows: 24, sample: JSON.stringify({
    info: { name: 'Pet API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    variable: [{ key: 'baseUrl', value: 'https://api.example.com/v1' }],
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
    item: [
      { name: 'Pets', item: [
        { name: 'List pets', request: { method: 'GET', url: { raw: '{{baseUrl}}/pets?limit=10', host: ['{{baseUrl}}'], path: ['pets'], query: [{ key: 'limit', value: '10', description: 'Max items' }, { key: 'debug', value: '1', disabled: true }] }, header: [], description: 'Returns pets' },
          response: [{ name: 'OK', code: 200, status: 'OK', header: [{ key: 'Content-Type', value: 'application/json' }], body: '[{"id": 1, "name": "Rex", "tags": ["dog"]}]' }] },
        { name: 'Get pet', request: { method: 'GET', url: { raw: '{{baseUrl}}/pets/:petId', host: ['{{baseUrl}}'], path: ['pets', ':petId'], variable: [{ key: 'petId', value: '1', description: 'Pet id' }] } } },
        { name: 'Add pet', request: { method: 'POST', header: [{ key: 'Content-Type', value: 'application/json' }], body: { mode: 'raw', raw: '{"name": "Rex", "age": 3, "vaccinated": true, "owner": {"email": "a@b.co"}}', options: { raw: { language: 'json' } } }, url: { raw: '{{baseUrl}}/pets', host: ['{{baseUrl}}'], path: ['pets'] } },
          response: [{ name: 'Created', code: 201, status: 'Created', header: [{ key: 'Content-Type', value: 'application/json' }], body: '{"id": 2, "name": "Rex"}' }] }
      ] }
    ]
  }, null, 2) }],
  options: [
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['auto', ['자동 판별', 'Auto-detect']], ['p2o', ['Postman → OpenAPI 3.0', 'Postman → OpenAPI 3.0']], ['o2p', ['OpenAPI → Postman v2.1', 'OpenAPI → Postman v2.1']]], default: 'auto' },
    { id: 'fmt', type: 'select', label: ['OpenAPI 출력', 'OpenAPI output'], choices: [['yaml', 'YAML'], ['json', 'JSON']], default: 'yaml', show: function (o) { return o.dir !== 'o2p'; } }
  ],
  outputs: [{ id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['요청 목록', 'Requests'], kind: 'table' }, { id: 'issues', label: ['변환 규칙·참고', 'Rules and notes'], kind: 'list' }],
  run: function (v, o, t) {
    var O = TK.openapi, issues = [], src = String(v['in'] || '').trim(); if (!src) throw new Error(t('내용을 입력하세요', 'Enter some input'));
    var dir = o.dir, data;
    if (/^\s*\{/.test(src)) { try { data = JSON.parse(src); } catch (e) { if (dir === 'p2o') throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); } }
    if (dir === 'auto') dir = data && (data.item || (data.info && /getpostman|_postman_id/.test(JSON.stringify(data.info)))) ? 'p2o' : 'o2p';
    var J = window.jsyaml || globalThis.jsyaml;
    function infer(val, name) {
      if (val === null) return { nullable: true };
      if (Array.isArray(val)) return { type: 'array', items: val.length ? infer(val[0], name) : {} };
      if (typeof val === 'object') { var props = {}, req = []; Object.keys(val).forEach(function (k) { props[k] = infer(val[k], k); req.push(k); }); return { type: 'object', properties: props, required: req }; }
      if (typeof val === 'number') return { type: Number.isInteger(val) ? 'integer' : 'number' };
      if (typeof val === 'boolean') return { type: 'boolean' };
      var s = { type: 'string' }; if (/^\d{4}-\d{2}-\d{2}T/.test(val)) s.format = 'date-time'; else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) s.format = 'date'; else if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(val)) s.format = 'email'; else if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(val)) s.format = 'uuid';
      return s;
    }
    function tryJson(s) { try { return JSON.parse(s); } catch (e) { return undefined; } }
    if (dir === 'p2o') {
      if (!data || !Array.isArray(data.item)) throw new Error(t('Postman 컬렉션(item 배열)이 아닙니다', 'Not a Postman collection (no item array)'));
      var vars = {}; (data.variable || []).forEach(function (x) { if (x.key) vars[x.key] = x.value; });
      var spec = { openapi: '3.0.3', info: { title: (data.info && data.info.name) || 'API', version: '1.0.0' }, paths: {} }, rows = [], used = {}, serverUrls = {}, schemes = {};
      if (data.info && data.info.description) spec.info.description = typeof data.info.description === 'string' ? data.info.description : data.info.description.content;
      function subst(s) { return String(s).replace(/\{\{([^}]+)\}\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : '{' + k + '}'; }); }
      function authOf(a) { if (!a || !a.type || a.type === 'noauth') return null; if (a.type === 'bearer') { schemes.bearerAuth = { type: 'http', scheme: 'bearer' }; return 'bearerAuth'; } if (a.type === 'basic') { schemes.basicAuth = { type: 'http', scheme: 'basic' }; return 'basicAuth'; } if (a.type === 'apikey') { var kv = {}; (a.apikey || []).forEach(function (x) { kv[x.key] = x.value; }); schemes.apiKeyAuth = { type: 'apiKey', name: kv.key || 'X-API-Key', in: kv.in === 'query' ? 'query' : 'header' }; return 'apiKeyAuth'; } if (a.type === 'oauth2') { schemes.oauth2 = { type: 'oauth2', flows: { authorizationCode: { authorizationUrl: 'https://example.com/oauth/authorize', tokenUrl: 'https://example.com/oauth/token', scopes: {} } } }; issues.push('⚠️ ' + t('OAuth2 URL 과 scope 는 자리표시자입니다. 직접 채우세요', 'OAuth2 URLs and scopes are placeholders; fill them in')); return 'oauth2'; } issues.push('ℹ️ ' + t('인증 방식 ' + a.type + ' 는 변환하지 않았습니다', 'Auth type ' + a.type + ' was not converted')); return null; }
      var colAuth = authOf(data.auth); if (colAuth) { var sr = {}; sr[colAuth] = []; spec.security = [sr]; }
      function camel(s) { var w = String(s).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean); if (!w.length) return 'operation'; return w.map(function (x, i) { var l = x.toLowerCase(); return i ? l.charAt(0).toUpperCase() + l.slice(1) : l; }).join(''); }
      (function walk(items, folders) {
        items.forEach(function (it) {
          if (Array.isArray(it.item)) { walk(it.item, folders.concat(it.name)); return; }
          var rq = it.request; if (!rq) return; if (typeof rq === 'string') rq = { method: 'GET', url: rq };
          var method = String(rq.method || 'GET').toLowerCase(), url = rq.url, raw = typeof url === 'string' ? url : (url && url.raw) || '', pathSegs, query = [], pvars = {};
          if (url && typeof url === 'object') { pathSegs = Array.isArray(url.path) ? url.path.map(function (x) { return typeof x === 'string' ? x : x.value; }) : String(url.path || '').split('/'); query = url.query || []; (url.variable || []).forEach(function (x) { pvars[x.key] = x; }); }
          else { var u = String(raw).replace(/^[a-z]+:\/\//i, ''); var noQ = u.split('?')[0]; pathSegs = noQ.split('/').slice(1); query = (u.split('?')[1] || '').split('&').filter(Boolean).map(function (p) { var kv = p.split('='); return { key: kv[0], value: kv[1] }; }); }
          var hostRaw = url && typeof url === 'object' ? (Array.isArray(url.host) ? url.host.join('.') : url.host || '') : String(raw).replace(/^[a-z]+:\/\//i, '').split('/')[0];
          var proto = url && url.protocol ? url.protocol + '://' : (/^https?:\/\//i.test(raw) ? raw.match(/^https?:\/\//i)[0] : '');
          var srv = subst((proto || (/\{\{/.test(hostRaw) ? '' : 'https://')) + hostRaw); if (srv && !/^\{/.test(srv.replace(/^https?:\/\//, ''))) serverUrls[srv] = (serverUrls[srv] || 0) + 1; else if (srv) serverUrls[srv] = (serverUrls[srv] || 0) + 1;
          var pathParams = [];
          var path = '/' + pathSegs.filter(function (x) { return x !== '' && x !== undefined; }).map(function (seg) { seg = String(seg); if (/^:/.test(seg)) { pathParams.push(seg.slice(1)); return '{' + seg.slice(1) + '}'; } return seg.replace(/\{\{([^}]+)\}\}/g, function (m, k) { pathParams.push(k); return '{' + k + '}'; }); }).join('/');
          if (path === '/') path = '/';
          spec.paths[path] = spec.paths[path] || {};
          if (spec.paths[path][method]) { issues.push('⚠️ ' + t(method.toUpperCase() + ' ' + path + ' 가 중복되어 마지막 요청만 남겼습니다 (' + it.name + ')', method.toUpperCase() + ' ' + path + ' is duplicated; only the last request (' + it.name + ') is kept')); }
          var op = { summary: it.name || undefined, operationId: null };
          var id = camel(it.name || method + path); if (used[id]) { var n = 2; while (used[id + n]) n++; id = id + n; } used[id] = true; op.operationId = id;
          if (folders.length) op.tags = [folders[0]];
          var desc = rq.description && (typeof rq.description === 'string' ? rq.description : rq.description.content); if (desc) op.description = desc;
          var params = [];
          pathParams.forEach(function (pn) { var pv = pvars[pn] || {}; var p = { name: pn, in: 'path', required: true, schema: { type: /^\d+$/.test(String(pv.value || '')) ? 'integer' : 'string' } }; if (pv.description) p.description = typeof pv.description === 'string' ? pv.description : pv.description.content; if (pv.value !== undefined && pv.value !== '') p.example = /^\d+$/.test(String(pv.value)) ? Number(pv.value) : pv.value; params.push(p); });
          query.forEach(function (q) { if (!q.key || q.disabled) return; var p = { name: q.key, in: 'query', schema: { type: /^\d+$/.test(String(q.value || '')) ? 'integer' : (/^(true|false)$/.test(String(q.value)) ? 'boolean' : 'string') } }; if (q.description) p.description = typeof q.description === 'string' ? q.description : q.description.content; if (q.value !== undefined && q.value !== '') p.example = p.schema.type === 'integer' ? Number(q.value) : p.schema.type === 'boolean' ? q.value === 'true' : q.value; params.push(p); });
          (rq.header || []).forEach(function (h) { if (!h.key || h.disabled || /^(content-type|accept|authorization)$/i.test(h.key)) return; params.push({ name: h.key, in: 'header', schema: { type: 'string' }, example: h.value }); });
          if (params.length) op.parameters = params;
          var body = rq.body;
          if (body && body.mode === 'raw' && body.raw) { var parsedB = tryJson(body.raw); if (parsedB !== undefined) op.requestBody = { content: { 'application/json': { schema: infer(parsedB), example: parsedB } } }; else op.requestBody = { content: { 'text/plain': { schema: { type: 'string' }, example: body.raw } } }; }
          else if (body && (body.mode === 'urlencoded' || body.mode === 'formdata')) { var props = {}; (body[body.mode] || []).forEach(function (f) { if (f.disabled) return; props[f.key] = f.type === 'file' ? { type: 'string', format: 'binary' } : { type: 'string' }; }); op.requestBody = { content: {} }; op.requestBody.content[body.mode === 'urlencoded' ? 'application/x-www-form-urlencoded' : 'multipart/form-data'] = { schema: { type: 'object', properties: props } }; }
          else if (body && body.mode === 'graphql') { op.requestBody = { content: { 'application/json': { schema: { type: 'object', properties: { query: { type: 'string' }, variables: { type: 'object' } } } } } }; }
          var responses = {};
          (it.response || []).forEach(function (r) { var code = String(r.code || 200); var ct = ((r.header || []).filter(function (h) { return /^content-type$/i.test(h.key); })[0] || {}).value || ''; var entry = { description: r.name || r.status || 'Response' }; var pj = r.body ? tryJson(r.body) : undefined; if (pj !== undefined) entry.content = { 'application/json': { schema: infer(pj), example: pj } }; else if (r.body) entry.content = { 'text/plain': { schema: { type: 'string' }, example: r.body } }; if (!responses[code]) responses[code] = entry; });
          if (!Object.keys(responses).length) { responses['200'] = { description: 'OK' }; }
          op.responses = responses;
          var itemAuth = authOf(rq.auth); if (rq.auth && rq.auth.type === 'noauth') op.security = []; else if (itemAuth) { var s2 = {}; s2[itemAuth] = []; op.security = [s2]; }
          Object.keys(op).forEach(function (k) { if (op[k] === undefined) delete op[k]; });
          spec.paths[path][method] = op;
          rows.push([method.toUpperCase(), path, it.name || '', folders.join(' / ') || '—', Object.keys(responses).join(', ')]);
        });
      })(data.item, []);
      var urls = Object.keys(serverUrls).sort(function (a, b) { return serverUrls[b] - serverUrls[a]; });
      if (urls.length) { spec.servers = urls.slice(0, 3).map(function (u) { return { url: u }; }); if (urls.length > 3) issues.push('ℹ️ ' + t('서버 주소가 ' + urls.length + '종이라 가장 많이 쓰인 3개만 servers 에 넣었습니다', 'There are ' + urls.length + ' server URLs; only the 3 most used are in servers')); }
      if (/\{[A-Za-z]/.test(JSON.stringify(spec.servers || '')) && !Object.keys(vars).length) issues.push('ℹ️ ' + t('서버 주소에 {변수} 가 남아 있습니다. 컬렉션 변수 값을 채우거나 servers 를 직접 고치세요', 'The server URL still contains a {variable}; fill the collection variable or edit servers'));
      if (Object.keys(schemes).length) spec.components = { securitySchemes: schemes };
      if (!rows.length) throw new Error(t('컬렉션에 요청이 없습니다', 'The collection has no requests'));
      var outTxt = o.fmt === 'json' ? JSON.stringify(spec, null, 2) : J.dump(spec, { lineWidth: -1, noRefs: true }).replace(/\n$/, '');
      issues.push(t('Postman 은 스키마가 아니라 예시를 저장하므로 스키마는 예시 값에서 추론했습니다(모든 키를 required 로 둠). 타입·필수 여부·enum 은 검토해 다듬으세요', 'Postman stores examples, not schemas, so schemas were inferred from the example values (every key marked required); review types, required-ness and enums'));
      issues.push(t('경로 변수(:id, {{var}})는 {id} 형식으로, 폴더 이름은 첫 단계만 태그로 옮겼습니다. 테스트 스크립트·환경 변수·사전 요청 스크립트는 변환되지 않습니다', 'Path variables (:id, {{var}}) became {id}; only the top-level folder name becomes a tag. Test scripts, environments and pre-request scripts are not converted'));
      return { _status: t('✅ 요청 ' + rows.length + '개를 OpenAPI 3.0 으로 변환했습니다', '✅ Converted ' + rows.length + ' request(s) to OpenAPI 3.0'), out: outTxt, table: { head: [['메서드', 'Method'], ['경로', 'Path'], ['이름', 'Name'], ['폴더', 'Folder'], ['응답', 'Responses']], rows: rows }, issues: issues };
    }
    /* OpenAPI → Postman */
    var L = O.load(src, t('OpenAPI 문서', 'OpenAPI document')), spec2 = L.spec, ops = O.operations(spec2);
    if (!ops.length) throw new Error(t('paths 에 엔드포인트가 없습니다', 'There are no endpoints in paths'));
    var base = spec2.servers && spec2.servers[0] ? spec2.servers[0].url : (spec2.host ? (spec2.schemes && spec2.schemes[0] || 'https') + '://' + spec2.host + (spec2.basePath || '') : 'https://api.example.com');
    var col = { info: { name: (spec2.info && spec2.info.title) || 'API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: [], variable: [{ key: 'baseUrl', value: base }] };
    if (spec2.info && spec2.info.description) col.info.description = spec2.info.description;
    var schemes2 = (spec2.components || {}).securitySchemes || spec2.securityDefinitions || {}, firstSec = ((spec2.security || [])[0] && Object.keys(spec2.security[0])[0]) || null;
    function authFor(name) { var s = schemes2[name]; if (!s) return null; if (s.type === 'http' && s.scheme === 'bearer') { col.variable.push({ key: 'token', value: '' }); return { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] }; } if (s.type === 'http' && s.scheme === 'basic' || s.type === 'basic') return { type: 'basic', basic: [{ key: 'username', value: '{{username}}', type: 'string' }, { key: 'password', value: '{{password}}', type: 'string' }] }; if (s.type === 'apiKey') return { type: 'apikey', apikey: [{ key: 'key', value: s.name, type: 'string' }, { key: 'value', value: '{{apiKey}}', type: 'string' }, { key: 'in', value: s.in, type: 'string' }] }; return null; }
    if (firstSec) { var a = authFor(firstSec); if (a) col.auth = a; }
    var folders = {}, rows2 = [], hasSec = {};
    ops.forEach(function (x) {
      var tag = (x.op.tags && x.op.tags[0]) || 'default', params = O.params(spec2, x), pvars = [], query = [], headers = [];
      var path = x.path.replace(/\{([^}]+)\}/g, function (_, n) { var pr = params['path:' + n]; pvars.push({ key: n, value: String(pr && pr.schema ? O.example(spec2, pr.schema, { useExamples: true }, n) : (pr && pr.example) || '1'), description: pr && pr.description }); return ':' + n; });
      Object.keys(params).forEach(function (k) { var pr = params[k]; var ex = pr.example !== undefined ? pr.example : pr.schema ? O.example(spec2, pr.schema, { useExamples: true }, pr.name) : ''; if (pr.in === 'query') query.push({ key: pr.name, value: String(ex), description: pr.description, disabled: !pr.required }); if (pr.in === 'header') headers.push({ key: pr.name, value: String(ex), description: pr.description, disabled: !pr.required }); });
      var segs = path.split('/').filter(Boolean);
      var request = { method: x.method.toUpperCase(), header: headers, url: { raw: '{{baseUrl}}' + path + (query.filter(function (q) { return !q.disabled; }).length ? '?' + query.filter(function (q) { return !q.disabled; }).map(function (q) { return q.key + '=' + q.value; }).join('&') : ''), host: ['{{baseUrl}}'], path: segs, query: query } };
      if (pvars.length) request.url.variable = pvars;
      var desc = x.op.description || x.op.summary; if (desc) request.description = desc;
      var rb = x.op.requestBody ? O.deref(spec2, x.op.requestBody) : null, mt;
      if (rb && rb.content) { var ks = Object.keys(rb.content); mt = ks.filter(function (k) { return /json/.test(k); })[0] || ks[0]; var ex = rb.content[mt].example !== undefined ? rb.content[mt].example : O.example(spec2, rb.content[mt].schema || {}, { useExamples: true, forRequest: true, arrayItems: 1 }, 'body'); if (/json/.test(mt)) { request.header.push({ key: 'Content-Type', value: 'application/json' }); request.body = { mode: 'raw', raw: JSON.stringify(ex, null, 2), options: { raw: { language: 'json' } } }; } else if (/x-www-form-urlencoded/.test(mt)) request.body = { mode: 'urlencoded', urlencoded: Object.keys((rb.content[mt].schema || {}).properties || {}).map(function (k) { return { key: k, value: '' }; }) }; else if (/multipart/.test(mt)) request.body = { mode: 'formdata', formdata: Object.keys((rb.content[mt].schema || {}).properties || {}).map(function (k) { return { key: k, value: '', type: 'text' }; }) }; else request.body = { mode: 'raw', raw: String(ex) }; }
      var opSec = x.op.security !== undefined ? x.op.security : null;
      if (opSec && opSec.length && !firstSec) { var a2 = authFor(Object.keys(opSec[0])[0]); if (a2) request.auth = a2; } else if (opSec && !opSec.length) request.auth = { type: 'noauth' };
      var responses = [];
      Object.keys(x.op.responses || {}).forEach(function (c) { var r = O.deref(spec2, x.op.responses[c]) || {}, cont = r.content || {}, ck = Object.keys(cont).filter(function (k) { return /json/.test(k); })[0]; var bodyEx = ck ? (cont[ck].example !== undefined ? cont[ck].example : O.example(spec2, cont[ck].schema || {}, { useExamples: true, arrayItems: 1 }, 'response')) : undefined; responses.push({ name: r.description || c, originalRequest: request, status: r.description || '', code: /^\d+$/.test(c) ? Number(c) : 200, _postman_previewlanguage: ck ? 'json' : 'text', header: ck ? [{ key: 'Content-Type', value: 'application/json' }] : [], body: bodyEx !== undefined ? JSON.stringify(bodyEx, null, 2) : '' }); });
      var item = { name: x.op.summary || x.op.operationId || x.method.toUpperCase() + ' ' + x.path, request: request, response: responses };
      (folders[tag] = folders[tag] || []).push(item);
      rows2.push([x.method.toUpperCase(), x.path, item.name, tag, Object.keys(x.op.responses || {}).join(', ')]);
    });
    var tagKeys = Object.keys(folders);
    col.item = tagKeys.length === 1 && tagKeys[0] === 'default' ? folders.default : tagKeys.map(function (k) { return { name: k, item: folders[k] }; });
    if (/\{[A-Za-z]+\}/.test(base)) issues.push('⚠️ ' + t('서버 URL 에 변수가 있습니다. baseUrl 컬렉션 변수 값을 확인하세요', 'The server URL has variables; check the baseUrl collection variable'));
    issues.push(t('컬렉션 변수 baseUrl 이 만들어졌습니다. Postman 에서 Import → Raw text 로 붙여 넣으세요', 'A baseUrl collection variable is created. In Postman use Import → Raw text and paste it'));
    issues.push(t('예시 값은 스키마의 example 이나 스키마에서 만든 값입니다. 선택 파라미터는 비활성(disabled)으로 들어갑니다. OAuth2 같은 인증은 변환하지 않습니다', 'Example values come from schema examples or are generated from the schema. Optional parameters are imported disabled. Auth such as OAuth2 is not converted'));
    return { _status: t('✅ 엔드포인트 ' + rows2.length + '개를 Postman 컬렉션으로 변환했습니다', '✅ Converted ' + rows2.length + ' endpoint(s) to a Postman collection'), out: JSON.stringify(col, null, 2), table: { head: [['메서드', 'Method'], ['경로', 'Path'], ['이름', 'Name'], ['폴더', 'Folder'], ['응답', 'Responses']], rows: rows2 }, issues: issues };
  }
});
