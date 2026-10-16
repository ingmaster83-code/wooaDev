TK.tool('protocol-uri-parser', {
  inputs: [{ id: 'in', label: ['URI (mqtt, mqtts, amqp, amqps, ws, wss, redis, postgres … — 한 줄에 하나)', 'URIs (mqtt, mqtts, amqp, amqps, ws, wss, redis, postgres … — one per line)'], rows: 8, sample: 'mqtt://user:pa%40ss@broker.example.com:1883/telemetry?clientId=dev1\nmqtts://broker.example.com\namqp://guest:guest@rabbit.local:5672/%2F\namqps://user:pw@mq.example.com/prod?heartbeat=30\nws://localhost:8080/socket\nwss://stream.example.com/v1/feed?token=abc123\nredis://:secret@cache.local:6379/2' }],
  options: [],
  outputs: [{ id: 'table', label: ['구성 요소', 'Components'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.in).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('URI 를 입력하세요', 'Enter a URI'));
    var PORT = { mqtt: 1883, mqtts: 8883, amqp: 5672, amqps: 5671, ws: 80, wss: 443, redis: 6379, rediss: 6379, postgres: 5432, postgresql: 5432, mysql: 3306, mongodb: 27017, kafka: 9092, nats: 4222, ftp: 21, sftp: 22, ssh: 22, smtp: 25, smtps: 465, imap: 143, imaps: 993, ldap: 389, ldaps: 636, rtsp: 554, coap: 5683, coaps: 5684, stomp: 61613 };
    var SECURE = { mqtts: 1, amqps: 1, wss: 1, rediss: 1, smtps: 1, imaps: 1, ldaps: 1, coaps: 1, sftp: 1, ssh: 1 }, PLAIN = { mqtt: 'mqtts', amqp: 'amqps', ws: 'wss', redis: 'rediss', smtp: 'smtps', imap: 'imaps', ldap: 'ldaps', coap: 'coaps' };
    var rows = [], issues = [], bad = 0;
    lines.forEach(function (ln, idx) {
      var p = '#' + (idx + 1) + ' ', m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(?:([^:@\/?#]*)(?::([^@\/?#]*))?@)?(\[[^\]]+\]|[^:\/?#]*)(?::(\d*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/.exec(ln);
      if (!m) { bad++; rows.push([p + t('오류', 'error'), t('scheme://[user[:pass]@]host[:port]/path 형식이 아닙니다: ', 'Not scheme://[user[:pass]@]host[:port]/path: ') + ln.slice(0, 40)]); return; }
      var sch = m[1].toLowerCase(), user = m[2], pass = m[3], host = m[4], port = m[5], path = m[6], q = m[7], hash = m[8];
      function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
      rows.push([p + 'scheme', sch + (SECURE[sch] ? ' 🔒' : '')]);
      if (user !== undefined) rows.push([p + t('사용자', 'user'), dec(user) || '—']);
      if (pass !== undefined) rows.push([p + t('비밀번호', 'password'), '•••• (' + dec(pass).length + t('자, 마스킹', ' chars, masked') + ')']);
      rows.push([p + 'host', host || '—']);
      var effPort = port ? +port : PORT[sch]; rows.push([p + 'port', (port ? port : (effPort ? effPort + ' (' + t('기본값', 'default') + ')' : '—'))]);
      if (sch === 'amqp' || sch === 'amqps') { var vh = path.length > 1 ? dec(path.slice(1)) : (path === '/' ? '' : '/'); rows.push([p + 'vhost', vh === '' ? t('(빈 문자열 vhost)', '(empty vhost)') : vh + (path === '/%2F' || path === '/%2f' ? '  (= ' + t('기본 vhost "/"', 'the default vhost "/"') + ')' : '')]); if (!path) issues.push(t('amqp 에서 경로가 없으면 기본 vhost "/" 를 씁니다', 'An amqp URI without a path uses the default vhost "/"')); if (path === '/') issues.push(t('amqp://host/ 의 경로 "/" 는 빈 이름의 vhost 입니다. 기본 vhost 는 /%2F 로 써야 합니다', 'In amqp://host/ the "/" path means an empty vhost; the default vhost must be written /%2F')); }
      else if (sch === 'mqtt' || sch === 'mqtts') rows.push([p + t('경로', 'path'), path || '—']);
      else if (sch === 'redis' || sch === 'rediss') rows.push([p + t('DB 번호', 'database'), path && path.length > 1 ? path.slice(1) : '0']);
      else rows.push([p + t('경로', 'path'), path || '/']);
      var qs = []; if (q) q.split('&').forEach(function (kv) { var j = kv.indexOf('='); var k = dec(j < 0 ? kv : kv.slice(0, j)), val = dec(j < 0 ? '' : kv.slice(j + 1)); qs.push(k); rows.push([p + '?' + k, /token|secret|password|key|sig/i.test(k) ? val.slice(0, 3) + '… (' + t('마스킹', 'masked') + ')' : val]); });
      if (hash) rows.push([p + '#', hash]);
      if (/^(ws|wss)$/.test(sch) && hash) issues.push(t('WebSocket URI 에는 프래그먼트(#)를 쓸 수 없습니다 (RFC 6455)', 'WebSocket URIs must not have a fragment (RFC 6455)'));
      if (!host) { issues.push('🚨 ' + t('호스트가 없습니다', 'No host')); bad++; }
      if (port && (+port < 1 || +port > 65535)) { issues.push('🚨 ' + t('포트가 범위(1~65535)를 벗어납니다: ' + port, 'Port out of range (1–65535): ' + port)); bad++; }
      if (pass !== undefined && !SECURE[sch]) issues.push(t('🔐 암호화되지 않은 ' + sch + ' 연결로 비밀번호를 보냅니다' + (PLAIN[sch] ? ' — ' + PLAIN[sch] + ' 사용을 권장' : ''), '🔐 Sending a password over unencrypted ' + sch + (PLAIN[sch] ? ' — prefer ' + PLAIN[sch] : '')));
      else if (PLAIN[sch] && host && !/^(localhost|127\.|\[::1\]|10\.|192\.168\.|.*\.(local|internal))/.test(host)) issues.push(t('공용 호스트(' + host + ')에 암호화 없이 연결합니다 — ' + PLAIN[sch] + ' 를 권장합니다', 'Connecting to a public host (' + host + ') without encryption — prefer ' + PLAIN[sch]));
      if (pass !== undefined && /[^A-Za-z0-9\-._~%]/.test(pass)) issues.push(t('비밀번호에 인코딩되지 않은 특수문자가 있습니다 — @ : / ? # 는 퍼센트 인코딩해야 합니다', 'The password has unencoded special characters — @ : / ? # must be percent-encoded'));
      if (qs.some(function (k) { return /token|secret|password|key|sig/i.test(k); })) issues.push(t('쿼리 문자열의 토큰·비밀은 프록시/서버 로그에 남을 수 있습니다 — 헤더나 첫 메시지로 보내세요', 'Tokens and secrets in the query string can end up in proxy / server logs — send them in a header or first message'));
      if (user === 'guest' && pass === 'guest' && host && !/^(localhost|127\.)/.test(host)) issues.push(t('🚨 RabbitMQ 기본 계정(guest/guest)은 원격에서 거부되는 것이 기본입니다', '🚨 RabbitMQ\'s default guest / guest account is refused remotely by default'));
      if (sch === 'mqtt' && effPort === 1883 && q && /clientId/i.test(q) === false) issues.push(t('clientId 를 지정하지 않으면 브로커가 임의로 할당하거나 세션이 유지되지 않을 수 있습니다', 'Without a clientId the broker may assign one or not keep the session'));
    });
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    var nflag = Math.max(bad, uniq.filter(function (x) { return /^🚨/.test(x); }).length);
    return { _status: nflag ? { ok: 'info', msg: t('🔍 문제 ' + nflag + '건', '🔍 ' + nflag + ' problem(s)') } : t('✅ URI ' + lines.length + '개 분석', '✅ Parsed ' + lines.length + ' URI(s)'), table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, issues: uniq };
  }
});
