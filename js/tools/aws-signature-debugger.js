TK.tool('aws-signature-debugger', {
  inputs: [
    { id: 'url', type: 'text', label: ['요청 URL', 'Request URL'], sample: 'https://example.amazonaws.com/' },
    { id: 'headers', label: ['헤더 (한 줄에 이름: 값)', 'Headers (one Name: value per line)'], rows: 4, sample: 'Host: example.amazonaws.com\nX-Amz-Date: 20150830T123600Z' },
    { id: 'body', label: ['요청 본문 (선택)', 'Request body (optional)'], rows: 3, sample: '' },
    { id: 'ak', type: 'text', label: ['Access Key ID (테스트 키만)', 'Access key ID (test keys only)'], sample: 'AKIDEXAMPLE' },
    { id: 'sk', type: 'text', label: ['Secret Access Key (테스트 키만)', 'Secret access key (test keys only)'], sample: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' },
    { id: 'token', type: 'text', label: ['세션 토큰 (임시 자격 증명일 때, 선택)', 'Session token (temporary credentials, optional)'], sample: '' },
    { id: 'expect', type: 'text', label: ['비교할 Authorization 헤더 또는 서명 (선택)', 'Authorization header or signature to compare (optional)'], sample: 'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31' }
  ],
  options: [
    { id: 'method', type: 'select', label: ['메서드', 'Method'], choices: [['GET', 'GET'], ['POST', 'POST'], ['PUT', 'PUT'], ['DELETE', 'DELETE'], ['HEAD', 'HEAD'], ['PATCH', 'PATCH']], default: 'GET' },
    { id: 'region', type: 'text', label: ['리전', 'Region'], default: 'us-east-1' },
    { id: 'service', type: 'text', label: ['서비스 이름 (서명용: s3, execute-api, dynamodb …)', 'Service name (for signing: s3, execute-api, dynamodb …)'], default: 'service' },
    { id: 'date', type: 'text', label: ['서명 시각 (비우면 X-Amz-Date 헤더, 그것도 없으면 지금) 예: 20150830T123600Z', 'Signing time (empty = X-Amz-Date header, else now) e.g. 20150830T123600Z'], default: '' },
    { id: 'mode', type: 'select', label: ['방식', 'Mode'], choices: [['header', ['Authorization 헤더', 'Authorization header']], ['presign', ['사전 서명 URL (쿼리 문자열)', 'Presigned URL (query string)']]], default: 'header' },
    { id: 'expires', type: 'number', label: ['사전 서명 만료 (초)', 'Presigned expiry (seconds)'], default: 3600, min: 1, max: 604800, show: function (o) { return o.mode === 'presign'; } },
    { id: 'payload', type: 'select', label: ['페이로드 해시', 'Payload hash'], choices: [['auto', ['본문의 SHA-256 계산', 'SHA-256 of the body']], ['unsigned', 'UNSIGNED-PAYLOAD'], ['streaming', 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD']], default: 'auto' },
    { id: 'sh', type: 'text', label: ['서명할 헤더 목록 (세미콜론 구분, 비우면 자동: host, x-amz-*, content-type, content-md5)', 'Headers to sign (semicolon separated; empty = auto: host, x-amz-*, content-type, content-md5)'], default: '' }
  ],
  outputs: [{ id: 'table', label: ['서명 단계 요약', 'Signing summary'], kind: 'table' }, { id: 'canon', label: ['① 정규 요청 (Canonical Request)', '① Canonical request'], kind: 'code', ext: 'txt' }, { id: 'sts', label: ['② 서명할 문자열 (String to Sign)', '② String to sign'], kind: 'code', ext: 'txt' }, { id: 'auth', label: ['③ 결과 (Authorization 헤더 / 사전 서명 URL)', '③ Result (Authorization header / presigned URL)'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검·비교', 'Checks and comparison'], kind: 'list' }],
  run: function (v, o, t) {
    var H = TK.hash, issues = [];
    var subtle = (window.crypto || globalThis.crypto).subtle; if (!subtle) throw new Error(t('Web Crypto 를 쓸 수 없습니다. HTTPS 로 접속하세요', 'Web Crypto is unavailable; use HTTPS'));
    var urlText = String(v.url || '').trim(); if (!urlText) throw new Error(t('요청 URL 을 입력하세요', 'Enter the request URL'));
    var u; try { u = new URL(/^[a-z]+:\/\//i.test(urlText) ? urlText : 'https://' + urlText); } catch (e) { throw new Error(t('URL 형식이 올바르지 않습니다', 'Invalid URL')); }
    var ak = String(v.ak || '').trim(), sk = String(v.sk || '').trim(); if (!ak || !sk) throw new Error(t('Access Key ID 와 Secret Access Key 를 입력하세요 (테스트용 키만 쓰세요)', 'Enter an access key ID and secret key (use test keys only)'));
    var region = String(o.region || '').trim(), service = String(o.service || '').trim(); if (!region || !service) throw new Error(t('리전과 서비스 이름이 필요합니다', 'Region and service name are required'));
    var isS3 = service === 's3';
    /* 헤더 */
    var hdr = {}, order = []; String(v.headers || '').split(/\r?\n/).forEach(function (l) { l = l.trim(); if (!l) return; var i = l.indexOf(':'); if (i < 1) throw new Error(t('헤더 "' + l + '" 는 "이름: 값" 형식이어야 합니다', 'Header "' + l + '" must be "Name: value"')); var k = l.slice(0, i).trim().toLowerCase(), val = l.slice(i + 1).trim().replace(/\s+/g, ' '); if (hdr[k] !== undefined) hdr[k] += ',' + val; else { hdr[k] = val; order.push(k); } });
    var host = u.host; if (hdr.host === undefined) { hdr.host = host; order.push('host'); issues.push('ℹ️ ' + t('Host 헤더가 없어 URL 에서 "' + host + '" 를 가져왔습니다. 실제 요청의 Host 와 같아야 합니다', 'No Host header, so "' + host + '" was taken from the URL; it must equal the real request Host')); } else if (hdr.host !== host && hdr.host !== u.hostname) issues.push('⚠️ ' + t('Host 헤더(' + hdr.host + ')가 URL 의 호스트(' + host + ')와 다릅니다', 'The Host header (' + hdr.host + ') differs from the URL host (' + host + ')'));
    var amzDate = String(o.date || '').trim() || hdr['x-amz-date'] || null;
    if (!amzDate) { var d = new Date(); amzDate = d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); issues.push('ℹ️ ' + t('서명 시각이 없어 지금(' + amzDate + ')을 썼습니다. 요청에도 같은 X-Amz-Date 를 보내야 합니다', 'No signing time given; used now (' + amzDate + '). The request must carry the same X-Amz-Date')); }
    if (!/^\d{8}T\d{6}Z$/.test(amzDate)) throw new Error(t('서명 시각은 yyyymmddThhmmssZ 형식이어야 합니다 (예: 20150830T123600Z)', 'Signing time must be yyyymmddThhmmssZ (e.g. 20150830T123600Z)'));
    var dateStamp = amzDate.slice(0, 8), scope = dateStamp + '/' + region + '/' + service + '/aws4_request';
    var skew = Math.abs(Date.now() - Date.UTC(+amzDate.slice(0, 4), +amzDate.slice(4, 6) - 1, +amzDate.slice(6, 8), +amzDate.slice(9, 11), +amzDate.slice(11, 13), +amzDate.slice(13, 15)));
    if (skew > 15 * 60 * 1000 && o.mode === 'header') issues.push('ℹ️ ' + t('서명 시각이 지금과 15분 넘게 차이 납니다. 실제 호출에 쓰면 RequestTimeTooSkewed 로 거부됩니다 (테스트 벡터라면 정상)', 'The signing time is more than 15 minutes from now; a real call would be rejected with RequestTimeTooSkewed (fine for a test vector)'));
    function enc(s) { return encodeURIComponent(s).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); }
    var rawPath = u.pathname || '/';
    var canonUri;
    if (isS3) { canonUri = rawPath.split('/').map(function (seg) { var dec; try { dec = decodeURIComponent(seg); } catch (e) { dec = seg; } return enc(dec); }).join('/'); }
    else { var norm = []; rawPath.split('/').forEach(function (seg) { if (seg === '.' ) return; if (seg === '..') { norm.pop(); return; } norm.push(seg); }); var joined = norm.join('/'); if (!/^\//.test(joined)) joined = '/' + joined; if (/\/$/.test(rawPath) && !/\/$/.test(joined)) joined += '/'; canonUri = joined.split('/').map(function (seg) { return enc(seg); }).join('/'); }
    if (!canonUri) canonUri = '/';
    var pairs = []; u.search.replace(/^\?/, '').split('&').filter(Boolean).forEach(function (p) { var i = p.indexOf('='), k = i < 0 ? p : p.slice(0, i), val = i < 0 ? '' : p.slice(i + 1); function dec(s) { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; } } pairs.push([dec(k), dec(val)]); });
    var presign = o.mode === 'presign';
    /* 페이로드 해시 */
    var bodyBytes = H.utf8(String(v.body || ''));
    return H.sha('SHA-256', bodyBytes).then(function (bh) {
      var payloadHash = presign ? 'UNSIGNED-PAYLOAD' : o.payload === 'unsigned' ? 'UNSIGNED-PAYLOAD' : o.payload === 'streaming' ? 'STREAMING-AWS4-HMAC-SHA256-PAYLOAD' : H.hex(bh);
      if (presign && o.payload !== 'unsigned') issues.push('ℹ️ ' + t('사전 서명 URL 은 페이로드 해시를 UNSIGNED-PAYLOAD 로 고정합니다', 'Presigned URLs fix the payload hash to UNSIGNED-PAYLOAD'));
      if (isS3 && !presign && hdr['x-amz-content-sha256'] === undefined) { hdr['x-amz-content-sha256'] = payloadHash; order.push('x-amz-content-sha256'); issues.push('ℹ️ ' + t('S3 는 x-amz-content-sha256 헤더가 필수라 추가했습니다 (' + payloadHash.slice(0, 16) + '…)', 'S3 requires the x-amz-content-sha256 header, so it was added (' + payloadHash.slice(0, 16) + '…)')); }
      else if (hdr['x-amz-content-sha256'] !== undefined && hdr['x-amz-content-sha256'] !== payloadHash && !presign) issues.push('⚠️ ' + t('x-amz-content-sha256 헤더 값이 계산한 페이로드 해시와 다릅니다', 'The x-amz-content-sha256 header differs from the computed payload hash'));
      var tok = String(v.token || '').trim();
      if (tok && !presign) { hdr['x-amz-security-token'] = tok; if (order.indexOf('x-amz-security-token') < 0) order.push('x-amz-security-token'); }
      if (!presign && hdr['x-amz-date'] === undefined) { hdr['x-amz-date'] = amzDate; order.push('x-amz-date'); issues.push('ℹ️ ' + t('X-Amz-Date 헤더를 추가했습니다 (' + amzDate + ')', 'Added the X-Amz-Date header (' + amzDate + ')')); }
      var sign = String(o.sh || '').trim() ? String(o.sh).split(';').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean) : order.filter(function (k) { return k === 'host' || k === 'content-type' || k === 'content-md5' || /^x-amz-/.test(k); });
      sign = sign.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
      sign.forEach(function (k) { if (hdr[k] === undefined) throw new Error(t('서명 헤더 "' + k + '" 가 요청에 없습니다', 'The signed header "' + k + '" is not in the request')); });
      if (sign.indexOf('host') < 0) issues.push('⛔ ' + t('SignedHeaders 에 host 가 반드시 있어야 합니다', 'SignedHeaders must include host'));
      if (!presign && sign.indexOf('x-amz-date') < 0 && sign.indexOf('date') < 0) issues.push('⛔ ' + t('x-amz-date(또는 date)를 서명해야 합니다', 'x-amz-date (or date) must be signed'));
      ['authorization', 'user-agent', 'connection', 'x-amzn-trace-id', 'expect', 'transfer-encoding'].forEach(function (bad) { if (sign.indexOf(bad) >= 0) issues.push('⚠️ ' + t(bad + ' 헤더는 프록시·클라이언트가 바꿀 수 있어 서명하지 않는 것이 좋습니다', 'The ' + bad + ' header may be changed by proxies and clients; avoid signing it')); });
      var credential = ak + '/' + scope, signedHeaders = sign.join(';');
      var qp = pairs.slice();
      if (presign) { qp.push(['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'], ['X-Amz-Credential', credential], ['X-Amz-Date', amzDate], ['X-Amz-Expires', String(Math.round(o.expires))], ['X-Amz-SignedHeaders', signedHeaders]); if (tok) qp.push(['X-Amz-Security-Token', tok]); }
      var canonQuery = qp.map(function (p) { return [enc(p[0]), enc(p[1])]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; }).map(function (p) { return p[0] + '=' + p[1]; }).join('&');
      var canonHeaders = sign.map(function (k) { return k + ':' + hdr[k] + '\n'; }).join('');
      var canon = o.method + '\n' + canonUri + '\n' + canonQuery + '\n' + canonHeaders + '\n' + signedHeaders + '\n' + payloadHash;
      return H.sha('SHA-256', H.utf8(canon)).then(function (ch) {
        var sts = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + scope + '\n' + H.hex(ch);
        return H.hmac('SHA-256', H.utf8('AWS4' + sk), H.utf8(dateStamp)).then(function (kDate) { return H.hmac('SHA-256', kDate, H.utf8(region)).then(function (kRegion) { return H.hmac('SHA-256', kRegion, H.utf8(service)).then(function (kService) { return H.hmac('SHA-256', kService, H.utf8('aws4_request')).then(function (kSigning) { return H.hmac('SHA-256', kSigning, H.utf8(sts)).then(function (sig) {
          var signature = H.hex(sig), result, auth = 'AWS4-HMAC-SHA256 Credential=' + credential + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
          if (presign) { var base = u.origin + u.pathname + '?' + qp.map(function (p) { return enc(p[0]) + '=' + enc(p[1]); }).join('&') + '&X-Amz-Signature=' + signature; result = base; } else result = auth;
          var rows = [[t('정규 URI', 'Canonical URI'), canonUri + (isS3 ? '' : t('  (S3 이외 서비스는 경로를 한 번 더 인코딩)', '  (non-S3 services encode the path twice)'))], [t('정규 쿼리', 'Canonical query'), canonQuery || '—'], ['SignedHeaders', signedHeaders], [t('페이로드 해시', 'Payload hash'), payloadHash], ['Credential scope', scope], ['kDate', H.hex(kDate)], ['kRegion', H.hex(kRegion)], ['kService', H.hex(kService)], ['kSigning', H.hex(kSigning)], [t('서명', 'Signature'), signature]];
          var exp = String(v.expect || '').trim();
          if (exp) {
            var es = /Signature=([0-9a-f]{64})/i.exec(exp), eh = /SignedHeaders=([^,\s]+)/i.exec(exp), ec = /Credential=([^,\s]+)/i.exec(exp), expSig = es ? es[1].toLowerCase() : /^[0-9a-f]{64}$/i.test(exp) ? exp.toLowerCase() : null;
            if (!expSig) issues.push('⚠️ ' + t('비교할 값에서 64자리 서명을 찾지 못했습니다', 'No 64-digit signature found in the comparison value'));
            else {
              if (expSig === signature) issues.push('✅ ' + t('서명이 일치합니다', 'The signature matches'));
              else {
                issues.push('⛔ ' + t('서명이 일치하지 않습니다 (계산: ' + signature.slice(0, 16) + '… ≠ 비교: ' + expSig.slice(0, 16) + '…)', 'Signature mismatch (computed ' + signature.slice(0, 16) + '… ≠ expected ' + expSig.slice(0, 16) + '…)'));
                if (eh && eh[1] !== signedHeaders) issues.push('⛔ ' + t('SignedHeaders 가 다릅니다: 비교 ' + eh[1] + ' ≠ 계산 ' + signedHeaders + ' — 같은 헤더 목록을 서명해야 합니다', 'SignedHeaders differ: expected ' + eh[1] + ' ≠ computed ' + signedHeaders + '; sign the same header list'));
                if (ec && ec[1] !== credential) { var cp = ec[1].split('/'); if (cp[0] !== ak) issues.push('⛔ ' + t('Access Key 가 다릅니다 (' + cp[0] + ')', 'The access key differs (' + cp[0] + ')')); if (cp[1] !== dateStamp) issues.push('⛔ ' + t('서명 날짜가 다릅니다 (비교 ' + cp[1] + ' ≠ ' + dateStamp + ')', 'The signing date differs (expected ' + cp[1] + ' ≠ ' + dateStamp + ')')); if (cp[2] !== region) issues.push('⛔ ' + t('리전이 다릅니다 (비교 ' + cp[2] + ' ≠ ' + region + ')', 'The region differs (expected ' + cp[2] + ' ≠ ' + region + ')')); if (cp[3] !== service) issues.push('⛔ ' + t('서비스 이름이 다릅니다 (비교 ' + cp[3] + ' ≠ ' + service + ')', 'The service differs (expected ' + cp[3] + ' ≠ ' + service + ')')); }
                if (!(eh && eh[1] !== signedHeaders) && !(ec && ec[1] !== credential)) issues.push('ℹ️ ' + t('자격 증명 범위와 헤더 목록이 같은데 서명만 다르면 본문 해시, 쿼리·경로 인코딩, 헤더 값 공백, Secret Key, 서명 시각 중 하나가 다른 경우가 대부분입니다', 'If scope and header list match but the signature differs, the usual causes are the body hash, query / path encoding, header value whitespace, the secret key or the signing time'));
              }
            }
          }
          issues.push(t('Secret Access Key 는 브라우저 밖으로 전송되지 않지만 테스트용 키만 입력하세요. 실제 키를 입력했다면 교체(rotate)하세요', 'The secret key never leaves your browser, but enter test keys only; rotate any real key you pasted'));
          if (!presign) issues.push(t('결과의 Authorization 헤더를 요청에 붙이고, 같은 Host·X-Amz-Date·x-amz-* 헤더와 본문을 그대로 보내야 서명이 유효합니다', 'Attach the Authorization header to the request and send the same Host, X-Amz-Date, x-amz-* headers and body for the signature to be valid'));
          var bad = issues.filter(function (x) { return x.indexOf('⛔') === 0; }).length;
          return { _status: { ok: bad ? false : true, msg: bad ? t('⛔ 문제 ' + bad + '건 — 서명 ' + signature.slice(0, 12) + '…', '⛔ ' + bad + ' problem(s) — signature ' + signature.slice(0, 12) + '…') : t('✅ 서명 계산 완료: ' + signature, '✅ Signature computed: ' + signature) }, table: { head: [['단계', 'Step'], ['값', 'Value']], rows: rows }, canon: canon, sts: sts, auth: result, issues: issues };
        }); }); }); }); });
      });
    });
  }
});
