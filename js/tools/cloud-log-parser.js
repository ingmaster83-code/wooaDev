TK.tool('cloud-log-parser', {
  inputs: [{ id: 'log', label: ['CloudFront / ALB / NLB / S3 로그 (헤더 줄 포함 가능)', 'CloudFront / ALB / NLB / S3 log lines (header lines allowed)'], rows: 10, sample: 'http 2026-10-16T00:12:03.123456Z app/my-alb/50dc6c495c0c9188 203.0.113.5:51234 10.0.1.12:8080 0.001 0.015 0.000 200 200 154 4231 "GET https://api.example.com:443/v1/items?id=3 HTTP/1.1" "Mozilla/5.0" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2 arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/tg/6d0ecf831eec9f09 "Root=1-67-abc" "api.example.com" "arn:aws:acm:ap-northeast-2:123456789012:certificate/abc" 0 2026-10-16T00:12:03.107000Z "forward" "-" "-" "10.0.1.12:8080" "200" "-" "-"\nh2 2026-10-16T00:12:04.000000Z app/my-alb/50dc6c495c0c9188 198.51.100.9:40000 10.0.1.13:8080 0.002 0.210 0.000 502 - 120 310 "POST https://api.example.com:443/v1/orders HTTP/2.0" "okhttp/4.12" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2 arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/tg/6d0ecf831eec9f09 "Root=1-68-def" "-" "-" 1 2026-10-16T00:12:03.790000Z "forward" "-" "-" "10.0.1.13:8080" "-" "-" "-"' }],
  options: [],
  outputs: [{ id: 'table', label: ['파싱 결과', 'Parsed entries'], kind: 'table' }, { id: 'csv', label: ['CSV (전체 필드)', 'CSV (all fields)'], kind: 'code', ext: 'csv' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.log).replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) throw new Error(t('로그를 입력하세요', 'Enter some log lines'));
    var issues = [], kind = '', fields = [], recs = [];
    var ALB = ['type', 'time', 'elb', 'client_port', 'target_port', 'request_processing_time', 'target_processing_time', 'response_processing_time', 'elb_status_code', 'target_status_code', 'received_bytes', 'sent_bytes', 'request', 'user_agent', 'ssl_cipher', 'ssl_protocol', 'target_group_arn', 'trace_id', 'domain_name', 'chosen_cert_arn', 'matched_rule_priority', 'request_creation_time', 'actions_executed', 'redirect_url', 'error_reason', 'target_port_list', 'target_status_code_list', 'classification', 'classification_reason', 'conn_trace_id'];
    function splitSpace(s) { var out = [], cur = '', q = false, i; for (i = 0; i < s.length; i++) { var c = s[i]; if (c === '"') { q = !q; continue; } if (c === ' ' && !q) { out.push(cur); cur = ''; continue; } cur += c; } out.push(cur); return out; }
    lines.forEach(function (ln) {
      if (/^#Version/.test(ln)) { kind = kind || 'cloudfront'; return; }
      var fm = /^#Fields:\s*(.*)$/.exec(ln); if (fm) { fields = fm[1].split(/\s+/); kind = 'cloudfront'; return; }
      if (ln[0] === '#') return;
      var first = ln.split(/[ \t]/)[0];
      if (/^(http|https|h2|grpcs|ws|wss)$/.test(first)) { kind = kind || 'alb'; var p = splitSpace(ln); recs.push({ kind: 'alb', p: p }); }
      else if (/^(tls)$/.test(first)) { kind = kind || 'nlb'; recs.push({ kind: 'nlb', p: splitSpace(ln) }); }
      else if (/\t/.test(ln) && fields.length) recs.push({ kind: 'cloudfront', p: ln.split('\t') });
      else if (/^[0-9a-f]{20,} \S+ \[/.test(ln)) { kind = kind || 's3'; recs.push({ kind: 's3', p: ln }); }
      else issues.push(t('형식을 알 수 없는 줄: ' + ln.slice(0, 50) + '…', 'Unrecognised line: ' + ln.slice(0, 50) + '…'));
    });
    if (!recs.length) throw new Error(t('CloudFront(#Fields 헤더 + 탭 구분), ALB/NLB(공백 구분), S3 서버 액세스 로그 중 해석되는 줄이 없습니다', 'No line matched CloudFront (#Fields header + tabs), ALB / NLB (space separated) or S3 server access log'));
    var q = function (x) { x = String(x == null ? '' : x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var csv, rows = [], head;
    if (kind === 'alb') {
      csv = [ALB.join(',')].concat(recs.map(function (r) { return ALB.map(function (_, i) { return q(r.p[i]); }).join(','); })).join('\n');
      head = [['시각', 'Time'], ['클라이언트', 'Client'], ['요청', 'Request'], ['ELB 상태', 'ELB'], ['타깃 상태', 'Target'], ['처리 시간(s)', 'Total time (s)'], ['비고', 'Note']];
      recs.forEach(function (r) { var p = r.p, rt = (parseFloat(p[5]) + parseFloat(p[6]) + parseFloat(p[7])); var note = ''; if (/^5/.test(p[8])) note = '🚨 ELB ' + p[8]; if (p[8] === '502' && p[9] === '-') note = '🚨 ' + t('타깃이 응답하지 않음', 'target did not respond'); if (rt > 1) note += ' ⏱ ' + t('느림', 'slow'); rows.push([p[1], p[3], (p[12] || '').slice(0, 60), p[8], p[9], isNaN(rt) ? '—' : rt.toFixed(3), note]); });
      var e5 = recs.filter(function (r) { return /^5/.test(r.p[8]); }).length; if (e5) issues.push(t('🚨 ELB 5xx ' + e5 + '건 — 502/503/504 는 타깃 상태·타임아웃을 확인하세요', '🚨 ' + e5 + ' ELB 5xx — check target health and timeouts for 502 / 503 / 504'));
      if (recs.some(function (r) { return r.p[8] === '-' || r.p[9] === '-'; })) issues.push(t('상태가 "-" 이면 타깃에 도달하지 못했거나 응답이 없었다는 뜻입니다', 'A "-" status means the request never reached the target or no reply came'));
    } else if (kind === 'cloudfront') {
      csv = [fields.join(',')].concat(recs.map(function (r) { return fields.map(function (_, i) { return q(r.p[i]); }).join(','); })).join('\n');
      var ix = function (n) { return fields.indexOf(n); };
      head = [['시각', 'Time'], ['엣지', 'Edge'], ['클라이언트 IP', 'Client IP'], ['메서드/경로', 'Method / URI'], ['상태', 'Status'], ['결과', 'Edge result'], ['바이트', 'Bytes']];
      recs.forEach(function (r) { var p = r.p; rows.push([(p[ix('date')] || '') + ' ' + (p[ix('time')] || ''), p[ix('x-edge-location')] || '', p[ix('c-ip')] || '', (p[ix('cs-method')] || '') + ' ' + (p[ix('cs-uri-stem')] || ''), p[ix('sc-status')] || '', p[ix('x-edge-result-type')] || '', p[ix('sc-bytes')] || '']); });
      var hit = recs.filter(function (r) { return /Hit/.test(r.p[ix('x-edge-result-type')] || ''); }).length; issues.push(t('캐시 적중률(Hit/RefreshHit): ' + Math.round(hit / recs.length * 100) + '% (' + hit + '/' + recs.length + ')', 'Cache hit ratio (Hit / RefreshHit): ' + Math.round(hit / recs.length * 100) + '% (' + hit + '/' + recs.length + ')'));
      if (!fields.length) issues.push(t('#Fields 헤더가 없습니다', 'No #Fields header'));
    } else if (kind === 'nlb') {
      var NLB = ['type', 'version', 'time', 'elb', 'listener', 'client_port', 'destination_port', 'connection_time', 'tls_handshake_time', 'received_bytes', 'sent_bytes', 'incoming_tls_alert', 'chosen_cert_arn', 'chosen_cert_serial', 'tls_cipher', 'tls_protocol_version', 'tls_named_group', 'domain_name', 'alpn_fe_protocol', 'alpn_be_protocol', 'alpn_client_preference_list', 'tls_connection_creation_time'];
      csv = [NLB.join(',')].concat(recs.map(function (r) { return NLB.map(function (_, i) { return q(r.p[i]); }).join(','); })).join('\n');
      head = [['시각', 'Time'], ['클라이언트', 'Client'], ['대상', 'Destination'], ['TLS', 'TLS'], ['수신 바이트', 'Received'], ['송신 바이트', 'Sent']];
      recs.forEach(function (r) { var p = r.p; rows.push([p[2], p[5], p[6], (p[15] || '') + ' ' + (p[14] || ''), p[9], p[10]]); });
    } else {
      var S3 = ['bucket_owner', 'bucket', 'time', 'remote_ip', 'requester', 'request_id', 'operation', 'key', 'request_uri', 'http_status', 'error_code', 'bytes_sent', 'object_size', 'total_time', 'turn_around_time', 'referrer', 'user_agent', 'version_id'];
      var parsed = recs.map(function (r) { var s = r.p.replace(/\[([^\]]*)\]/, function (m, a) { return '"' + a + '"'; }); return splitSpace(s); });
      csv = [S3.join(',')].concat(parsed.map(function (p) { return S3.map(function (_, i) { return q(p[i]); }).join(','); })).join('\n');
      head = [['시각', 'Time'], ['IP', 'IP'], ['작업', 'Operation'], ['키', 'Key'], ['상태', 'Status'], ['바이트', 'Bytes']];
      parsed.forEach(function (p) { rows.push([p[2], p[3], p[6], p[7], p[9], p[11]]); });
    }
    issues.push(t('판별된 형식: ' + { alb: 'ALB', nlb: 'NLB', cloudfront: 'CloudFront', s3: 'S3 서버 액세스 로그' }[kind] + ' · ' + recs.length + '건', 'Detected format: ' + { alb: 'ALB', nlb: 'NLB', cloudfront: 'CloudFront', s3: 'S3 server access log' }[kind] + ' · ' + recs.length + ' entries'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: t('✅ ' + ({ alb: 'ALB', nlb: 'NLB', cloudfront: 'CloudFront', s3: 'S3' }[kind]) + ' 로그 ' + recs.length + '건', '✅ ' + ({ alb: 'ALB', nlb: 'NLB', cloudfront: 'CloudFront', s3: 'S3' }[kind]) + ' log: ' + recs.length + ' entries'), table: { head: head, rows: rows.slice(0, 500) }, csv: csv, issues: uniq };
  }
});
