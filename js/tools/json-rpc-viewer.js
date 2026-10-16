TK.tool('json-rpc-viewer', {
  inputs: [{ id: 'in', label: ['JSON-RPC 메시지 (객체, 배열(배치), 또는 줄마다 하나)', 'JSON-RPC messages (object, array (batch), or one per line)'], rows: 14, sample: '[\n  {"jsonrpc":"2.0","method":"subtract","params":{"minuend":42,"subtrahend":23},"id":1},\n  {"jsonrpc":"2.0","method":"notify_hello","params":[7]},\n  {"jsonrpc":"2.0","result":19,"id":1},\n  {"jsonrpc":"2.0","method":"foo.get","params":{"name":"x"},"id":"abc"},\n  {"jsonrpc":"2.0","error":{"code":-32601,"message":"Method not found"},"id":"abc"},\n  {"method":"legacy","id":3},\n  {"jsonrpc":"2.0","method":"ping","id":4}\n]' }],
  options: [],
  sampleExpectError: true,
  outputs: [{ id: 'table', label: ['메시지', 'Messages'], kind: 'table' }, { id: 'pairs', label: ['요청 ↔ 응답 짝', 'Request ↔ response pairs'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var text = String(v.in).trim(), msgs = [], issues = [];
    if (!text) throw new Error(t('메시지를 입력하세요', 'Enter a message'));
    try { var j = JSON.parse(text); msgs = Array.isArray(j) ? j.map(function (m, i) { return { v: m, src: t('배치 ', 'batch ') + (i + 1) }; }) : [{ v: j, src: '#1' }]; if (Array.isArray(j) && !j.length) issues.push('🚨 ' + t('빈 배치는 Invalid Request(-32600) 입니다', 'An empty batch is an Invalid Request (-32600)')); }
    catch (e) { msgs = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l, i) { try { return { v: JSON.parse(l), src: '#' + (i + 1) }; } catch (e2) { return { v: undefined, src: '#' + (i + 1), err: e2.message }; } }); if (msgs.every(function (m) { return m.err; })) throw new Error(t('JSON 형식 오류: ' + e.message, 'Invalid JSON: ' + e.message)); }
    var ERR = { '-32700': 'Parse error', '-32600': 'Invalid Request', '-32601': 'Method not found', '-32602': 'Invalid params', '-32603': 'Internal error' };
    var rows = [], reqs = {}, resps = [], bad = 0;
    msgs.forEach(function (m) {
      var x = m.v, kind = '', detail = '', probs = [];
      if (m.err) { rows.push([m.src, '❌', t('JSON 오류', 'bad JSON'), m.err.slice(0, 60), '']); bad++; return; }
      if (x === null || typeof x !== 'object' || Array.isArray(x)) { rows.push([m.src, '❌', t('객체가 아님', 'not an object'), JSON.stringify(x).slice(0, 40), '']); bad++; return; }
      if (x.jsonrpc !== '2.0') probs.push(t('jsonrpc: "2.0" 이 없습니다 (JSON-RPC 1.0 이거나 오류)', 'jsonrpc: "2.0" is missing (JSON-RPC 1.0 or a mistake)'));
      var hasM = typeof x.method === 'string', hasR = 'result' in x, hasE = 'error' in x, hasId = 'id' in x;
      if (hasM) {
        kind = hasId ? t('요청', 'Request') : t('알림(Notification)', 'Notification');
        if (x.method.indexOf('rpc.') === 0) probs.push(t('"rpc." 로 시작하는 이름은 예약되어 있습니다', 'Method names starting with "rpc." are reserved'));
        if ('params' in x && (x.params === null || typeof x.params !== 'object')) probs.push(t('params 는 배열 또는 객체여야 합니다', 'params must be an array or object'));
        if (hasId && !(typeof x.id === 'string' || typeof x.id === 'number' || x.id === null)) probs.push(t('id 는 문자열·숫자·null 이어야 합니다', 'id must be a string, number or null'));
        if (hasId && x.id === null) probs.push(t('id 가 null 인 요청은 권장되지 않습니다', 'A request with id null is discouraged'));
        if (hasId && typeof x.id === 'number' && !Number.isInteger(x.id)) probs.push(t('id 에 소수는 피하세요', 'Avoid fractional ids'));
        detail = x.method + '(' + (Array.isArray(x.params) ? x.params.map(function (p) { return JSON.stringify(p); }).join(', ') : x.params ? JSON.stringify(x.params) : '') + ')';
        if (hasId) { var key = JSON.stringify(x.id); if (reqs[key]) probs.push(t('같은 id 의 요청이 이미 있습니다', 'Another request already uses this id')); reqs[key] = { m: x.method, src: m.src }; }
        if (hasR || hasE) probs.push(t('요청에 result/error 가 함께 있습니다', 'A request must not carry result / error'));
      } else if (hasR || hasE) {
        kind = hasE ? t('오류 응답', 'Error response') : t('성공 응답', 'Success response');
        if (hasR && hasE) probs.push(t('result 와 error 는 동시에 있을 수 없습니다', 'result and error cannot both be present'));
        if (!hasId) probs.push(t('응답에는 id 가 필요합니다', 'A response needs an id'));
        if (hasE) { var er = x.error; if (er === null || typeof er !== 'object' || typeof er.code !== 'number' || typeof er.message !== 'string') probs.push(t('error 는 {code(정수), message(문자열)} 이어야 합니다', 'error must be {code (integer), message (string)}')); else detail = er.code + ' ' + (ERR[String(er.code)] ? ERR[String(er.code)] : (er.code >= -32099 && er.code <= -32000 ? 'Server error' : er.code >= -32768 && er.code <= -32000 ? t('예약 범위', 'reserved range') : t('사용자 정의', 'application-defined'))) + ' — ' + er.message; }
        else detail = JSON.stringify(x.result).slice(0, 70);
        resps.push({ id: x.id, err: hasE, src: m.src, hasId: hasId });
      } else { kind = t('알 수 없음', 'Unknown'); probs.push(t('method, result, error 중 어느 것도 없습니다', 'None of method, result or error is present')); }
      if (probs.length) bad++;
      rows.push([m.src, probs.length ? '⚠️' : '✅', kind, detail.slice(0, 80), probs.join(' · ')]);
    });
    var pairs = [], matched = {};
    resps.forEach(function (r) { var key = JSON.stringify(r.id), q = reqs[key]; if (q) { matched[key] = 1; pairs.push([JSON.stringify(r.id), q.m, q.src, r.src, r.err ? '❌ ' + t('오류', 'error') : '✅']); } else pairs.push([JSON.stringify(r.id), '—', '—', r.src, '⚠️ ' + t('대응하는 요청 없음', 'no matching request')]); });
    Object.keys(reqs).forEach(function (k) { if (!matched[k]) pairs.push([k, reqs[k].m, reqs[k].src, '—', '⏳ ' + t('응답 없음', 'no response')]); });
    var ver = msgs.filter(function (m) { return m.v && m.v.jsonrpc !== '2.0' && !m.err; }).length; if (ver) issues.push(t('jsonrpc 필드가 "2.0" 이 아닌 메시지 ' + ver + '개', ver + ' message(s) without jsonrpc "2.0"'));
    if (Array.isArray(JSON.parse(text.startsWith('[') ? text : '[]'))) issues.push(t('배치 요청의 응답은 배열로 오며 순서가 보장되지 않으므로 id 로 짝을 지어야 합니다. 알림만 있는 배치는 응답이 없습니다', 'Batch responses come as an array in any order, so match them by id; a batch of only notifications gets no response'));
    issues.push(t('표준 오류 코드: -32700 Parse error, -32600 Invalid Request, -32601 Method not found, -32602 Invalid params, -32603 Internal error, -32000~-32099 서버 오류', 'Standard error codes: -32700 Parse error, -32600 Invalid Request, -32601 Method not found, -32602 Invalid params, -32603 Internal error, -32000 to -32099 server errors'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: bad ? { ok: 'info', msg: t('🔍 메시지 ' + msgs.length + '개 중 확인할 항목 ' + bad + '개', '🔍 ' + bad + ' of ' + msgs.length + ' message(s) need attention') } : t('✅ 메시지 ' + msgs.length + '개', '✅ ' + msgs.length + ' message(s)'), table: { head: [['위치', 'Where'], ['상태', 'Status'], ['종류', 'Kind'], ['내용', 'Detail'], ['문제', 'Problems']], rows: rows }, pairs: pairs.length ? { head: [['id', 'id'], ['메서드', 'Method'], ['요청', 'Request'], ['응답', 'Response'], ['상태', 'State']], rows: pairs } : null, issues: uniq };
  }
});
