TK.tool('openapi-diff', {
  sampleExpectError: true,
  inputs: [
    { id: 'a', label: ['이전 OpenAPI (YAML/JSON)', 'Old OpenAPI (YAML / JSON)'], rows: 22, sample: [
      'openapi: 3.0.3', 'info: { title: Pets, version: 1.0.0 }', 'paths:', '  /pets:', '    get:', '      operationId: listPets', '      parameters:', '        - { name: limit, in: query, schema: { type: integer } }',
      '        - { name: status, in: query, schema: { type: string, enum: [open, sold, pending] } }', '      responses:', '        "200":', '          description: OK', '          content:', '            application/json:', '              schema: { type: array, items: { $ref: "#/components/schemas/Pet" } }',
      '    post:', '      operationId: addPet', '      requestBody:', '        content: { application/json: { schema: { $ref: "#/components/schemas/NewPet" } } }', '      responses: { "201": { description: Created } }',
      '  /pets/{id}:', '    get:', '      operationId: getPet', '      parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]', '      responses: { "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/Pet" } } } }, "404": { description: Missing } }',
      '    delete:', '      operationId: deletePet', '      parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]', '      responses: { "204": { description: Gone } }',
      'components:', '  schemas:', '    Pet:', '      type: object', '      required: [id, name]', '      properties: { id: { type: integer }, name: { type: string }, tag: { type: string }, kind: { type: string, enum: [dog, cat] } }',
      '    NewPet:', '      type: object', '      required: [name]', '      properties: { name: { type: string, maxLength: 50 }, tag: { type: string } }', ''].join('\n') },
    { id: 'b', label: ['새 OpenAPI (YAML/JSON)', 'New OpenAPI (YAML / JSON)'], rows: 22, sample: [
      'openapi: 3.0.3', 'info: { title: Pets, version: 1.1.0 }', 'paths:', '  /pets:', '    get:', '      operationId: listPets', '      parameters:', '        - { name: limit, in: query, required: true, schema: { type: integer } }',
      '        - { name: status, in: query, schema: { type: string, enum: [open, sold] } }', '      responses:', '        "200":', '          description: OK', '          content:', '            application/json:', '              schema: { type: array, items: { $ref: "#/components/schemas/Pet" } }',
      '    post:', '      operationId: addPet', '      requestBody:', '        required: true', '        content: { application/json: { schema: { $ref: "#/components/schemas/NewPet" } } }', '      responses: { "201": { description: Created } }',
      '  /pets/{id}:', '    get:', '      operationId: getPet', '      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]', '      responses: { "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/Pet" } } } } }',
      '  /owners:', '    get: { operationId: listOwners, responses: { "200": { description: OK } } }',
      'components:', '  schemas:', '    Pet:', '      type: object', '      required: [id]', '      properties: { id: { type: integer }, name: { type: string }, kind: { type: string, enum: [dog, cat, bird] }, owner: { type: string } }',
      '    NewPet:', '      type: object', '      required: [name, kind]', '      properties: { name: { type: string, maxLength: 20 }, tag: { type: string }, kind: { type: string } }', ''].join('\n') }
  ],
  options: [{ id: 'show', type: 'select', label: ['표시', 'Show'], choices: [['all', ['모두', 'All']], ['breaking', ['깨짐·주의만', 'Breaking and caution only']]], default: 'all' }],
  outputs: [{ id: 'table', label: ['변경 사항', 'Changes'], kind: 'table' }, { id: 'issues', label: ['요약', 'Summary'], kind: 'list' }],
  run: function (v, o, t) {
    var O = TK.openapi, A = O.load(v.a, t('이전 문서', 'old document')), B = O.load(v.b, t('새 문서', 'new document')), sa = A.spec, sb = B.spec, rows = [], seenR = {};
    var SEV = { breaking: '⛔', warn: '⚠️', ok: '✅', info: 'ℹ️' };
    function add(sev, where, what) { var k = sev + where + what; if (seenR[k]) return; seenR[k] = 1; rows.push([SEV[sev] + ' ' + (sev === 'breaking' ? t('깨짐', 'breaking') : sev === 'warn' ? t('주의', 'caution') : sev === 'ok' ? t('호환', 'compatible') : t('참고', 'info')), where, what]); }
    var cmpKeys = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'minProperties', 'maxProperties'];
    function typeOf(s) { var ty = s.type; if (Array.isArray(ty)) ty = ty.filter(function (x) { return x !== 'null'; }).join('|'); return ty || (s.properties ? 'object' : s.items ? 'array' : ''); }
    function nullable(s) { return s.nullable === true || (Array.isArray(s.type) && s.type.indexOf('null') >= 0); }
    function schemaDiff(x, y, dir, where, depth, seen) {
      if (depth > 8) return;
      var rawX = x, rawY = y; x = O.deref(sa, x) || {}; y = O.deref(sb, y) || {};
      var key = (rawX && rawX.$ref || '') + '>' + (rawY && rawY.$ref || '');
      if (key !== '>' && seen.indexOf(key) >= 0) return; if (key !== '>') seen = seen.concat(key);
      var req = dir === 'request';
      var tx = typeOf(x), ty = typeOf(y);
      if (tx !== ty && (tx || ty)) { var widen = req && tx === 'integer' && ty === 'number'; add(widen ? 'ok' : 'breaking', where, t('타입 ' + (tx || '(없음)') + ' → ' + (ty || '(없음)'), 'type ' + (tx || '(none)') + ' → ' + (ty || '(none)'))); return; }
      if (x.format !== y.format && (x.format || y.format)) add('warn', where, t('format ' + (x.format || '—') + ' → ' + (y.format || '—'), 'format ' + (x.format || '—') + ' → ' + (y.format || '—')));
      if (nullable(x) !== nullable(y)) { var bad = req ? nullable(x) && !nullable(y) : !nullable(x) && nullable(y); add(bad ? 'breaking' : 'ok', where, t(nullable(y) ? 'null 허용으로 변경' : 'null 불허로 변경', nullable(y) ? 'now nullable' : 'no longer nullable')); }
      if (Array.isArray(x.enum) || Array.isArray(y.enum)) {
        var ex = x.enum || [], ey = y.enum || [], removed = ex.filter(function (e) { return ey.indexOf(e) < 0; }), added = ey.filter(function (e) { return ex.indexOf(e) < 0; });
        if (!x.enum && y.enum) add(req ? 'breaking' : 'ok', where, t('enum 제약 추가: ' + ey.join(', '), 'enum constraint added: ' + ey.join(', ')));
        else if (x.enum && !y.enum) add(req ? 'ok' : 'warn', where, t('enum 제약 제거', 'enum constraint removed'));
        else { if (removed.length) add(req ? 'breaking' : 'ok', where, t('enum 값 제거: ' + removed.join(', '), 'enum values removed: ' + removed.join(', '))); if (added.length) add(req ? 'ok' : 'breaking', where, t('enum 값 추가: ' + added.join(', ') + (req ? '' : ' (클라이언트가 모르는 값을 받을 수 있음)'), 'enum values added: ' + added.join(', ') + (req ? '' : ' (clients may receive unknown values)'))); }
      }
      cmpKeys.forEach(function (k) {
        if (x[k] === y[k]) return; var lower = /^min|^exclusiveMin/.test(k), tighter;
        if (x[k] === undefined) tighter = true; else if (y[k] === undefined) tighter = false; else tighter = lower ? y[k] > x[k] : y[k] < x[k];
        var bad2 = req ? tighter : !tighter;
        add(bad2 ? 'breaking' : 'ok', where, k + ' ' + (x[k] === undefined ? '—' : x[k]) + ' → ' + (y[k] === undefined ? '—' : y[k]) + (bad2 ? '' : ''));
      });
      if (x.pattern !== y.pattern && (x.pattern || y.pattern)) add(req && y.pattern ? 'breaking' : 'warn', where, 'pattern ' + (x.pattern || '—') + ' → ' + (y.pattern || '—'));
      var px = x.properties || {}, py = y.properties || {}, rx = x.required || [], ry = y.required || [];
      Object.keys(px).forEach(function (k) {
        if (!(k in py)) { add(req ? 'warn' : 'breaking', where + '.' + k, t(req ? '요청 필드 제거 (서버가 더 이상 받지 않음)' : '응답 필드 제거', req ? 'request field removed (server no longer accepts it)' : 'response field removed')); return; }
        schemaDiff(px[k], py[k], dir, where + '.' + k, depth + 1, seen);
        var wasReq = rx.indexOf(k) >= 0, isReq = ry.indexOf(k) >= 0;
        if (!wasReq && isReq) add(req ? 'breaking' : 'ok', where + '.' + k, t('필수로 변경', 'became required'));
        if (wasReq && !isReq) add(req ? 'ok' : 'breaking', where + '.' + k, t('선택으로 변경', 'became optional'));
      });
      Object.keys(py).forEach(function (k) { if (!(k in px)) { var isReq2 = ry.indexOf(k) >= 0; add(req && isReq2 ? 'breaking' : 'ok', where + '.' + k, t((req ? '요청' : '응답') + ' 필드 추가' + (isReq2 ? ' (필수)' : ''), (req ? 'request' : 'response') + ' field added' + (isReq2 ? ' (required)' : ''))); } });
      if (x.items || y.items) schemaDiff(x.items || {}, y.items || {}, dir, where + '[]', depth + 1, seen);
      ['oneOf', 'anyOf', 'allOf'].forEach(function (k) { if (x[k] || y[k]) { var jx = JSON.stringify(x[k] || []), jy = JSON.stringify(y[k] || []); if (jx !== jy) { var lx = (x[k] || []).length, ly = (y[k] || []).length; if (k === 'allOf') { (y.allOf || []).forEach(function (s, i) { if (x.allOf && x.allOf[i]) schemaDiff(x.allOf[i], s, dir, where, depth + 1, seen); }); } else add(ly < lx ? (req ? 'breaking' : 'ok') : ly > lx ? (req ? 'ok' : 'breaking') : 'warn', where, k + ' ' + t('변경 (' + lx + '개 → ' + ly + '개)', 'changed (' + lx + ' → ' + ly + ' options)')); } } });
    }
    var opsA = {}, opsB = {};
    O.operations(sa).forEach(function (x) { opsA[x.method.toUpperCase() + ' ' + x.path] = x; }); O.operations(sb).forEach(function (x) { opsB[x.method.toUpperCase() + ' ' + x.path] = x; });
    Object.keys(opsA).forEach(function (k) {
      if (!opsB[k]) { var pathStill = Object.keys(opsB).some(function (b) { return b.split(' ')[1] === k.split(' ')[1]; }); add('breaking', k, t(pathStill ? '메서드 제거' : '엔드포인트 제거', pathStill ? 'method removed' : 'endpoint removed')); return; }
      var a = opsA[k], b = opsB[k];
      if (!a.op.deprecated && b.op.deprecated) add('info', k, t('deprecated 로 표시됨', 'marked deprecated'));
      if (a.op.operationId !== b.op.operationId) add('warn', k, t('operationId ' + (a.op.operationId || '—') + ' → ' + (b.op.operationId || '—') + ' (생성된 SDK 메서드 이름이 바뀜)', 'operationId ' + (a.op.operationId || '—') + ' → ' + (b.op.operationId || '—') + ' (generated SDK method names change)'));
      /* 파라미터 */
      var pa = O.params(sa, a), pb = O.params(sb, b);
      Object.keys(pa).forEach(function (pk) { var nm = pa[pk].in + ':' + pa[pk].name; if (!pb[pk]) { add(pa[pk].required ? 'warn' : 'info', k + ' ' + nm, t('파라미터 제거', 'parameter removed')); return; } if (!pa[pk].required && pb[pk].required) add('breaking', k + ' ' + nm, t('필수로 변경', 'became required')); else if (pa[pk].required && !pb[pk].required) add('ok', k + ' ' + nm, t('선택으로 변경', 'became optional')); if (pa[pk].schema && pb[pk].schema) schemaDiff(pa[pk].schema, pb[pk].schema, 'request', k + ' ' + nm, 0, []); });
      Object.keys(pb).forEach(function (pk) { if (!pa[pk]) add(pb[pk].required ? 'breaking' : 'ok', k + ' ' + pb[pk].in + ':' + pb[pk].name, t('파라미터 추가' + (pb[pk].required ? ' (필수)' : ''), 'parameter added' + (pb[pk].required ? ' (required)' : ''))); });
      /* 요청 본문 */
      var ra = a.op.requestBody ? O.deref(sa, a.op.requestBody) : null, rb = b.op.requestBody ? O.deref(sb, b.op.requestBody) : null;
      if (!ra && rb) add(rb.required ? 'breaking' : 'ok', k + ' requestBody', t('요청 본문 추가' + (rb.required ? ' (필수)' : ''), 'request body added' + (rb.required ? ' (required)' : '')));
      else if (ra && !rb) add('warn', k + ' requestBody', t('요청 본문 제거', 'request body removed'));
      else if (ra && rb) {
        if (!ra.required && rb.required) add('breaking', k + ' requestBody', t('요청 본문이 필수로 변경', 'request body became required'));
        var ca = ra.content || {}, cb = rb.content || {};
        Object.keys(ca).forEach(function (mt) { if (!cb[mt]) add('breaking', k + ' requestBody ' + mt, t('미디어 타입 제거', 'media type removed')); else if (ca[mt].schema && cb[mt].schema) schemaDiff(ca[mt].schema, cb[mt].schema, 'request', k + ' requestBody', 0, []); });
        Object.keys(cb).forEach(function (mt) { if (!ca[mt]) add('ok', k + ' requestBody ' + mt, t('미디어 타입 추가', 'media type added')); });
      }
      /* 응답 */
      var xa = a.op.responses || {}, xb = b.op.responses || {};
      Object.keys(xa).forEach(function (c) { if (!(c in xb)) { add(/^2/.test(c) ? 'breaking' : 'warn', k + ' ' + c, t('응답 제거', 'response removed')); return; } var da = O.deref(sa, xa[c]) || {}, db = O.deref(sb, xb[c]) || {}, cA = da.content || {}, cB = db.content || {}; Object.keys(cA).forEach(function (mt) { if (!cB[mt]) add('breaking', k + ' ' + c + ' ' + mt, t('응답 미디어 타입 제거', 'response media type removed')); else if (cA[mt].schema && cB[mt].schema) schemaDiff(cA[mt].schema, cB[mt].schema, 'response', k + ' ' + c, 0, []); }); });
      Object.keys(xb).forEach(function (c) { if (!(c in xa)) add(/^2/.test(c) ? 'ok' : 'warn', k + ' ' + c, t('응답 추가' + (/^2/.test(c) ? '' : ' (클라이언트가 새 오류 코드를 처리해야 할 수 있음)'), 'response added' + (/^2/.test(c) ? '' : ' (clients may need to handle the new status)'))); });
      /* 보안 */
      var sec = function (s, op) { return JSON.stringify(op.security !== undefined ? op.security : s.security || []); };
      if (sec(sa, a.op) !== sec(sb, b.op)) { var hadSec = (a.op.security !== undefined ? a.op.security : sa.security || []).length, hasSec = (b.op.security !== undefined ? b.op.security : sb.security || []).length; add(!hadSec && hasSec ? 'breaking' : hadSec && !hasSec ? 'ok' : 'warn', k + ' security', t('인증 요구사항 변경', 'security requirements changed')); }
    });
    Object.keys(opsB).forEach(function (k) { if (!opsA[k]) add('ok', k, t('엔드포인트 추가', 'endpoint added')); });
    if ((sa.info || {}).version !== (sb.info || {}).version) add('info', 'info.version', (sa.info || {}).version + ' → ' + (sb.info || {}).version);
    var sA = JSON.stringify(sa.servers || sa.host || ''), sB = JSON.stringify(sb.servers || sb.host || ''); if (sA !== sB) add('warn', 'servers', t('서버 주소 변경', 'server URLs changed'));
    var cnt = { breaking: 0, warn: 0, ok: 0, info: 0 }; rows.forEach(function (r) { var s = r[0].indexOf('⛔') === 0 ? 'breaking' : r[0].indexOf('⚠️') === 0 ? 'warn' : r[0].indexOf('✅') === 0 ? 'ok' : 'info'; cnt[s]++; });
    var shown = o.show === 'breaking' ? rows.filter(function (r) { return r[0].indexOf('⛔') === 0 || r[0].indexOf('⚠️') === 0; }) : rows;
    var order = { '⛔': 0, '⚠️': 1, 'ℹ️': 2, '✅': 3 }; shown = shown.slice().sort(function (a, b) { return order[a[0].split(' ')[0]] - order[b[0].split(' ')[0]]; });
    var bump = cnt.breaking ? 'major' : (cnt.ok ? 'minor' : 'patch');
    var sum = [];
    sum.push((cnt.breaking ? '⛔ ' : '✅ ') + t('호환성을 깨는 변경 ' + cnt.breaking + '건 · 주의 ' + cnt.warn + '건 · 호환 변경 ' + cnt.ok + '건', cnt.breaking + ' breaking · ' + cnt.warn + ' caution · ' + cnt.ok + ' compatible change(s)'));
    sum.push(t('권장 버전 증가: ' + bump + ' (' + (bump === 'major' ? 'MAJOR — 기존 클라이언트가 깨질 수 있음' : bump === 'minor' ? 'MINOR — 호환되는 기능 추가' : 'PATCH — 호환되는 수정') + ')', 'Suggested version bump: ' + bump + ' (' + (bump === 'major' ? 'MAJOR — existing clients may break' : bump === 'minor' ? 'MINOR — backward-compatible additions' : 'PATCH — compatible fixes') + ')'));
    sum.push(t('판정 기준: 요청(클라이언트→서버)은 제약이 강해지면 깨짐, 응답(서버→클라이언트)은 보장이 약해지면 깨집니다. 문서에 쓰인 계약만 비교하며 실제 서버 동작은 알 수 없습니다', 'Rules: for requests (client → server) tighter constraints break clients; for responses (server → client) weaker guarantees break them. Only the documented contract is compared, not real server behaviour'));
    return { _status: { ok: cnt.breaking ? false : true, msg: cnt.breaking ? t('⛔ 호환성을 깨는 변경 ' + cnt.breaking + '건 → ' + bump + ' 버전', '⛔ ' + cnt.breaking + ' breaking change(s) → ' + bump + ' bump') : t('✅ 호환성을 깨는 변경 없음 → ' + bump + ' 버전', '✅ No breaking changes → ' + bump + ' bump') }, table: { head: [['판정', 'Verdict'], ['위치', 'Where'], ['변경', 'Change']], rows: shown.slice(0, 500) }, issues: sum };
  }
});
