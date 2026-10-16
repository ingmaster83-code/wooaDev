TK.tool('access-log-parser', {
  inputs: [{ id: 'log', label: ['액세스 로그 (한 줄에 한 요청)', 'Access log (one request per line)'], rows: 10, sample: '203.0.113.5 - - [16/Oct/2026:09:12:03 +0900] "GET /index.html HTTP/1.1" 200 5120 "https://www.google.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0"\n198.51.100.7 - bob [16/Oct/2026:09:12:05 +0900] "POST /api/login HTTP/1.1" 401 87 "-" "curl/8.5.0"\n203.0.113.5 - - [16/Oct/2026:09:12:09 +0900] "GET /assets/app.js HTTP/1.1" 304 0 "https://example.com/index.html" "Mozilla/5.0 Chrome/130.0"\n192.0.2.44 - - [16/Oct/2026:09:13:11 +0900] "GET /wp-login.php HTTP/1.1" 404 153 "-" "Mozilla/5.0 (compatible; Googlebot/2.1)"\n192.0.2.44 - - [16/Oct/2026:09:13:12 +0900] "GET /api/items?id=3 HTTP/2.0" 500 1290 "-" "python-requests/2.32"\nbroken line here' }],
  options: [{ id: 'top', type: 'number', label: ['순위 표시 개수', 'Top N'], default: 5, min: 1, max: 30 }],
  outputs: [{ id: 'table', label: ['파싱 결과', 'Parsed requests'], kind: 'table' }, { id: 'stats', label: ['통계', 'Statistics'], kind: 'table' }, { id: 'csv', label: ['CSV', 'CSV'], kind: 'code', ext: 'csv' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.log).replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) throw new Error(t('로그를 입력하세요', 'Enter some log lines'));
    var RE = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "((?:[^"\\]|\\.)*)" (\d{3}|-) (\d+|-)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?(?: (.*))?$/;
    var recs = [], bad = [], issues = [];
    lines.forEach(function (ln, idx) {
      var m = RE.exec(ln.trim()); if (!m) { bad.push(idx + 1); return; }
      var rq = m[5].split(' '), meth = rq[0], path = rq[1] || '', proto = rq[2] || '';
      if (!/^[A-Z]+$/.test(meth)) { meth = '-'; path = m[5]; proto = ''; }
      recs.push({ n: idx + 1, ip: m[1], user: m[3], time: m[4], method: meth, path: path, proto: proto, status: m[6] === '-' ? 0 : +m[6], bytes: m[7] === '-' ? 0 : +m[7], ref: m[8] === undefined ? '' : m[8], ua: m[9] === undefined ? '' : m[9], extra: m[10] || '' });
    });
    if (!recs.length) throw new Error(t('Nginx/Apache combined·common 형식으로 해석되는 줄이 없습니다', 'No line parsed as Nginx / Apache combined or common format'));
    var rows = recs.slice(0, 500).map(function (r) { return [String(r.n), r.ip, r.time, r.method, r.path.length > 50 ? r.path.slice(0, 47) + '…' : r.path, String(r.status), String(r.bytes), r.ua.length > 40 ? r.ua.slice(0, 37) + '…' : r.ua]; });
    function count(f) { var c = {}; recs.forEach(function (r) { var k = f(r); c[k] = (c[k] || 0) + 1; }); return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) { return [k, c[k]]; }); }
    var N = Math.max(1, Math.round(o.top) || 5), st = [], totalBytes = recs.reduce(function (a, r) { return a + r.bytes; }, 0);
    st.push([t('요청 수', 'Requests'), String(recs.length)], [t('전송 바이트', 'Bytes sent'), totalBytes.toLocaleString() + ' (' + (totalBytes / 1048576).toFixed(2) + ' MiB)']);
    var cls = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }; recs.forEach(function (r) { var k = Math.floor(r.status / 100) + 'xx'; if (cls[k] !== undefined) cls[k]++; });
    st.push([t('상태 코드 분포', 'Status classes'), Object.keys(cls).map(function (k) { return k + ' ' + cls[k] + ' (' + Math.round(cls[k] / recs.length * 100) + '%)'; }).join(' · ')]);
    st.push([t('상위 IP', 'Top IPs'), count(function (r) { return r.ip; }).slice(0, N).map(function (x) { return x[0] + ' ×' + x[1]; }).join(', ')]);
    st.push([t('상위 경로', 'Top paths'), count(function (r) { return r.path.split('?')[0]; }).slice(0, N).map(function (x) { return x[0] + ' ×' + x[1]; }).join(', ')]);
    st.push([t('메서드', 'Methods'), count(function (r) { return r.method; }).map(function (x) { return x[0] + ' ' + x[1]; }).join(', ')]);
    var errs = recs.filter(function (r) { return r.status >= 500; }); if (errs.length) st.push([t('5xx 요청', '5xx requests'), errs.slice(0, N).map(function (r) { return r.status + ' ' + r.path; }).join(', ')]);
    var times = recs.map(function (r) { var m = /(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)/.exec(r.time); return m ? m[1] + ' ' + m[2] + ' ' + m[3] + ' ' + m[4] + ':' + m[5] : ''; }).filter(Boolean);
    if (times.length) st.push([t('기간', 'Time span'), recs[0].time + ' ~ ' + recs[recs.length - 1].time]);
    var bots = recs.filter(function (r) { return /bot|crawler|spider|curl|python|wget|scrapy|httpclient/i.test(r.ua); }).length; st.push([t('봇/스크립트 추정', 'Bots / scripts (guess)'), bots + ' (' + Math.round(bots / recs.length * 100) + '%)']);
    var scans = recs.filter(function (r) { return /wp-login|wp-admin|xmlrpc|\.env|\.git\/|phpmyadmin|\/admin|\.\.\/|etc\/passwd|cgi-bin/i.test(r.path); }); if (scans.length) issues.push(t('🚨 스캐닝으로 보이는 요청 ' + scans.length + '건 (wp-login, .env, ../ 등): ' + scans.slice(0, 3).map(function (r) { return r.ip + ' ' + r.path; }).join(', '), '🚨 ' + scans.length + ' request(s) look like scanning (wp-login, .env, ../ …): ' + scans.slice(0, 3).map(function (r) { return r.ip + ' ' + r.path; }).join(', ')));
    var logins = recs.filter(function (r) { return /login|signin|auth/i.test(r.path) && (r.status === 401 || r.status === 403); }); if (logins.length >= 3) issues.push(t('로그인 실패 ' + logins.length + '건 — 무차별 대입 가능성', logins.length + ' failed logins — possible brute force'));
    if (bad.length) issues.push(t('해석하지 못한 줄 ' + bad.length + '개: ' + bad.slice(0, 5).join(', ') + '번째', bad.length + ' line(s) could not be parsed: #' + bad.slice(0, 5).join(', #')));
    if (recs.some(function (r) { return r.extra; })) issues.push(t('combined 형식 뒤에 추가 필드(응답 시간 등)가 있는 줄이 있습니다 — "extra" 열로 CSV 에 포함했습니다', 'Some lines have extra fields after the combined format (e.g. response time) — included as the "extra" CSV column'));
    issues.push(t('IP 는 개인정보에 해당할 수 있으니 공유 전에 마스킹하세요. 프록시/CDN 뒤라면 X-Forwarded-For 가 실제 방문자 IP 입니다', 'IP addresses can be personal data — mask them before sharing. Behind a proxy / CDN the real visitor IP is in X-Forwarded-For'));
    var q = function (x) { x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var csv = ['ip,user,time,method,path,protocol,status,bytes,referer,user_agent,extra'].concat(recs.map(function (r) { return [r.ip, r.user, r.time, r.method, r.path, r.proto, r.status, r.bytes, r.ref, r.ua, r.extra].map(q).join(','); })).join('\n');
    return { _status: bad.length ? { ok: 'info', msg: t('🔍 ' + recs.length + '건 파싱 · ' + bad.length + '줄 실패', '🔍 Parsed ' + recs.length + ' · ' + bad.length + ' line(s) failed') } : t('✅ ' + recs.length + '건 파싱', '✅ Parsed ' + recs.length), table: { head: [['줄', 'Line'], ['IP', 'IP'], ['시각', 'Time'], ['메서드', 'Method'], ['경로', 'Path'], ['상태', 'Status'], ['바이트', 'Bytes'], ['User-Agent', 'User-Agent']], rows: rows }, stats: { head: [['항목', 'Item'], ['값', 'Value']], rows: st }, csv: csv, issues: issues };
  }
});
