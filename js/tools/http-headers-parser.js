TK.tool('http-headers-parser', {
  inputs: [{ id: 'in', label: ['HTTP 요청·응답 헤더 (원문 그대로)', 'HTTP request / response headers (raw)'], rows: 14,
    sample: 'HTTP/2 200\ncontent-type: text/html; charset=utf-8\ncache-control: public, max-age=3600, s-maxage=86400\nset-cookie: sid=abc123; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400\nset-cookie: theme=dark; Path=/\nstrict-transport-security: max-age=31536000; includeSubDomains\nx-content-type-options: nosniff\ncontent-encoding: br\nvary: Accept-Encoding, Cookie\ncontent-length: 18432\nserver: nginx\ndate: Fri, 16 Oct 2026 03:00:00 GMT' }],
  options: [],
  outputs: [{ id: 'kv', label: ['요약', 'Summary'], kind: 'kv' }, { id: 'table', label: ['헤더 분석', 'Header analysis'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Checks'], kind: 'list' }],
  run: function (v, o, t) {
    var raw = String(v.in).replace(/\r\n?/g, '\n').split('\n'), lines = [];
    raw.forEach(function (l) { if (/^[ \t]+\S/.test(l) && lines.length) lines[lines.length - 1] += ' ' + l.trim(); else lines.push(l); });
    lines = lines.filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) throw new Error(t('헤더를 입력하세요', 'Enter some headers'));
    var kv = [], first = lines[0], headers = [], issues = [], isResp = false, isReq = false;
    var mReq = /^([A-Z]+)\s+(\S+)\s+(HTTP\/[\d.]+)$/.exec(first), mRes = /^(HTTP\/[\d.]+)\s+(\d{3})(?:\s+(.*))?$/.exec(first);
    if (mReq) { isReq = true; kv.push([['요청 줄', 'Request line'], first], [['메서드', 'Method'], mReq[1]], [['경로', 'Target'], mReq[2]], [['프로토콜', 'Protocol'], mReq[3]]); lines.shift(); }
    else if (mRes) { isResp = true; kv.push([['상태 줄', 'Status line'], first], [['프로토콜', 'Protocol'], mRes[1]], [['상태 코드', 'Status code'], mRes[2] + (mRes[3] ? ' ' + mRes[3] : '')]); lines.shift(); }
    lines.forEach(function (l, i) {
      var m = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+)\s*:\s*(.*)$/.exec(l);
      if (!m) { issues.push(t('헤더 형식이 아닌 줄: "' + l.slice(0, 60) + '"', 'Not a header line: "' + l.slice(0, 60) + '"')); return; }
      headers.push({ name: m[1], lower: m[1].toLowerCase(), value: m[2].trim() });
    });
    var by = {}; headers.forEach(function (h) { (by[h.lower] = by[h.lower] || []).push(h.value); });
    var SINGLE = ['content-type', 'content-length', 'host', 'authorization', 'etag', 'location', 'content-encoding', 'strict-transport-security', 'user-agent'];
    SINGLE.forEach(function (k) { if (by[k] && by[k].length > 1) issues.push(t(k + ' 헤더가 ' + by[k].length + '번 중복되어 있습니다', k + ' appears ' + by[k].length + ' times')); });
    if (!isReq && !isResp && by.host) isReq = true;
    var DESC = {
      'content-type': ['본문 미디어 타입과 문자 인코딩', 'Body media type and charset'], 'content-length': ['본문 크기(바이트)', 'Body size in bytes'], 'content-encoding': ['본문 압축 방식', 'Body compression'], 'cache-control': ['캐시 정책', 'Caching policy'], 'set-cookie': ['쿠키 설정', 'Sets a cookie'], 'cookie': ['요청에 포함된 쿠키', 'Cookies sent by the client'],
      'strict-transport-security': ['HTTPS 강제(HSTS)', 'Enforce HTTPS (HSTS)'], 'x-content-type-options': ['MIME 스니핑 방지', 'Disables MIME sniffing'], 'x-frame-options': ['프레임 삽입 제어', 'Framing control'], 'content-security-policy': ['콘텐츠 보안 정책', 'Content Security Policy'], 'referrer-policy': ['Referer 전송 정책', 'Referrer policy'],
      'vary': ['캐시 키에 포함되는 요청 헤더', 'Request headers that vary the response'], 'etag': ['리소스 버전 식별자', 'Resource version identifier'], 'last-modified': ['마지막 수정 시각', 'Last modification time'], 'location': ['리다이렉트 대상', 'Redirect target'], 'server': ['서버 소프트웨어', 'Server software'], 'date': ['응답 생성 시각', 'Message date'],
      'user-agent': ['클라이언트 식별 문자열', 'Client identification'], 'accept': ['받을 수 있는 미디어 타입', 'Acceptable media types'], 'accept-language': ['선호 언어', 'Preferred languages'], 'accept-encoding': ['지원하는 압축 방식', 'Supported compressions'], 'authorization': ['인증 정보', 'Credentials'], 'host': ['요청 대상 호스트', 'Target host'], 'origin': ['요청 출처(CORS)', 'Request origin (CORS)'], 'referer': ['이전 페이지 주소', 'Referring page'],
      'access-control-allow-origin': ['CORS 허용 출처', 'CORS allowed origin'], 'content-disposition': ['다운로드/인라인 표시와 파일명', 'Inline/attachment and file name'], 'x-forwarded-for': ['프록시를 거친 클라이언트 IP', 'Client IP via proxies'], 'connection': ['연결 유지 방식', 'Connection handling'], 'transfer-encoding': ['전송 인코딩', 'Transfer encoding'], 'if-none-match': ['조건부 요청(ETag)', 'Conditional request (ETag)'], 'if-modified-since': ['조건부 요청(시각)', 'Conditional request (date)'], 'permissions-policy': ['브라우저 기능 권한', 'Browser feature permissions'], 'cross-origin-opener-policy': ['창 격리(COOP)', 'Window isolation (COOP)'], 'link': ['관련 리소스(프리로드 등)', 'Related resources (preload…)'], 'age': ['프록시 캐시에 머문 시간(초)', 'Seconds in a shared cache'], 'range': ['부분 요청 범위', 'Partial content range'], 'content-range': ['부분 응답 범위', 'Partial response range'] };
    function note(h) {
      var v = h.value, l = h.lower;
      if (l === 'content-type') { var m = /^([^;\s]+)(?:;\s*charset=([^;\s]+))?/i.exec(v); return m ? t('타입 ' + m[1] + (m[2] ? ', 문자셋 ' + m[2] : (/^text\//i.test(m[1]) ? ', 문자셋 지정 없음' : '')), 'type ' + m[1] + (m[2] ? ', charset ' + m[2] : (/^text\//i.test(m[1]) ? ', no charset' : ''))) : ''; }
      if (l === 'cache-control') return v.split(',').map(function (x) { return x.trim(); }).join(' · ');
      if (l === 'content-length') return /^\d+$/.test(v) ? (+v >= 1024 ? (Math.round(+v / 1024 * 10) / 10) + ' KB' : v + ' B') : t('숫자가 아닙니다', 'Not a number');
      if (l === 'set-cookie') { var parts = v.split(';').map(function (x) { return x.trim(); }), nm = parts[0].split('=')[0], at = parts.slice(1).map(function (x) { return x.split('=')[0].toLowerCase(); }); return t('쿠키 ' + nm + ' — ' + (at.indexOf('secure') >= 0 ? 'Secure ' : '') + (at.indexOf('httponly') >= 0 ? 'HttpOnly ' : '') + (at.filter(function (x) { return x === 'samesite'; }).length ? 'SameSite' : ''), 'cookie ' + nm + ' — ' + (at.indexOf('secure') >= 0 ? 'Secure ' : '') + (at.indexOf('httponly') >= 0 ? 'HttpOnly ' : '') + (at.filter(function (x) { return x === 'samesite'; }).length ? 'SameSite' : '')); }
      if (l === 'authorization') { var sp = v.split(' '); return t('방식 ' + sp[0] + ' (값은 가림)', 'scheme ' + sp[0] + ' (value hidden)'); }
      if (/^(accept|accept-language|accept-encoding)$/.test(l)) return v.split(',').map(function (x) { var p = x.trim().split(/;\s*q=/); return p[0] + (p[1] ? ' (q=' + p[1] + ')' : ''); }).join(' > ');
      if (l === 'strict-transport-security') { var ma = /max-age=(\d+)/i.exec(v); return ma ? t((Math.round(+ma[1] / 86400)) + '일간 HTTPS 강제' + (/includesubdomains/i.test(v) ? ' · 하위 도메인 포함' : '') + (/preload/i.test(v) ? ' · preload' : ''), (Math.round(+ma[1] / 86400)) + ' days' + (/includesubdomains/i.test(v) ? ' · incl. subdomains' : '') + (/preload/i.test(v) ? ' · preload' : '')) : ''; }
      if (l === 'date' || l === 'last-modified' || l === 'expires') { var p = TK.time && TK.time.parseRFC(v); return p ? TK.time.iso(p.ns, 0) : ''; }
      return '';
    }
    var rows = headers.map(function (h) {
      var d = DESC[h.lower], value = h.lower === 'authorization' || h.lower === 'cookie' ? h.value.slice(0, 12) + '… (' + h.value.length + t('자', ' chars') + ')' : h.value;
      return [h.name, value.length > 140 ? value.slice(0, 140) + '…' : value, (d ? t(d[0], d[1]) : (/^x-/i.test(h.name) ? t('사용자 정의(X-) 헤더', 'Custom (X-) header') : '')) + (note(h) ? (d ? ' — ' : '') + note(h) : '')];
    });
    // 점검
    if (isResp) {
      if (!by['strict-transport-security']) issues.push(t('Strict-Transport-Security(HSTS)가 없습니다 (HTTPS 사이트라면 권장)', 'No Strict-Transport-Security (recommended for HTTPS sites)'));
      if (!by['x-content-type-options']) issues.push(t('X-Content-Type-Options: nosniff 가 없습니다', 'X-Content-Type-Options: nosniff is missing'));
      if (by['content-type'] && /^text\/(html|plain)/i.test(by['content-type'][0]) && !/charset=/i.test(by['content-type'][0])) issues.push(t('Content-Type에 charset이 없습니다 (UTF-8 명시 권장)', 'Content-Type has no charset (declare UTF-8)'));
      (by['set-cookie'] || []).forEach(function (c) { var nm = c.split('=')[0], low = c.toLowerCase(); if (!/;\s*secure/.test(low)) issues.push(t('쿠키 ' + nm + ': Secure 속성이 없습니다', 'Cookie ' + nm + ': no Secure attribute')); if (!/;\s*httponly/.test(low)) issues.push(t('쿠키 ' + nm + ': HttpOnly 속성이 없습니다', 'Cookie ' + nm + ': no HttpOnly attribute')); if (!/;\s*samesite=/.test(low)) issues.push(t('쿠키 ' + nm + ': SameSite 속성이 없습니다', 'Cookie ' + nm + ': no SameSite attribute')); });
      if (by['server'] && /\/\d/.test(by['server'][0])) issues.push(t('Server 헤더가 버전을 노출합니다 (' + by['server'][0] + ')', 'The Server header exposes a version (' + by['server'][0] + ')'));
      if (by['cache-control'] && /no-store/i.test(by['cache-control'][0]) && /max-age=[1-9]/i.test(by['cache-control'][0])) issues.push(t('Cache-Control에 no-store와 max-age가 함께 있습니다 (no-store가 우선)', 'Cache-Control has both no-store and max-age (no-store wins)'));
    }
    if (isReq) { if (!by['host'] && !(mReq && /HTTP\/2|HTTP\/3/.test(mReq[3]))) issues.push(t('HTTP/1.1 요청에는 Host 헤더가 필요합니다', 'HTTP/1.1 requests require a Host header')); if (by['authorization'] && !by['x-forwarded-proto']) issues.push(t('Authorization 헤더가 있습니다 — 로그에 남기거나 공유하지 마세요', 'An Authorization header is present — do not log or share it')); }
    kv.push([['헤더 수', 'Header count'], headers.length], [['종류', 'Kind'], isResp ? t('응답', 'Response') : isReq ? t('요청', 'Request') : t('알 수 없음 (시작 줄 없음)', 'Unknown (no start line)')]);
    return { _status: issues.length ? { ok: 'info', msg: t('🔍 헤더 ' + headers.length + '개 — 확인할 점 ' + issues.length + '개', '🔍 ' + headers.length + ' headers — ' + issues.length + ' point(s) to check') } : t('✅ 헤더 ' + headers.length + '개 분석', '✅ Parsed ' + headers.length + ' headers'), kv: kv, table: { head: [['헤더', 'Header'], ['값', 'Value'], ['설명', 'Notes']], rows: rows }, issues: issues };
  }
});
