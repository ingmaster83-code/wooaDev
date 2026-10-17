TK.tool('certificate-decoder', {
  inputs: [
    { id: 'in', label: ['인증서 (PEM 한 개 이상, 또는 16진수/Base64 DER)', 'Certificate(s) (one or more PEM blocks, or hex / Base64 DER)'], rows: 12, sample: '-----BEGIN CERTIFICATE-----\nMIIEJjCCAw6gAwIBAgIULtv0YaivYcewDIxv3/H4E4IucsUwDQYJKoZIhvcNAQEL\nBQAwTzELMAkGA1UEBhMCS1IxFzAVBgNVBAoMDldvb2FIb3VzZSBUZXN0MScwJQYD\nVQQDDB5Xb29hSG91c2UgVGVzdCBJbnRlcm1lZGlhdGUgQ0EwIBcNMjYxMDE3MDI0\nOTEyWhgPMjEyMjA4MTUwMjQ5MTJaMD0xCzAJBgNVBAYTAktSMRcwFQYDVQQKDA5X\nb29hSG91c2UgVGVzdDEVMBMGA1UEAwwMdGVzdC5leGFtcGxlMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq3nB6psHqkUElGM1kqgLdMjfCUV9OigW4q2J\n4YXDtWk4Z+EGdy201BBJOnOapvcWyCaa6s0Q+dV996hH52Uc0dsMHxiD5iqOaSmr\n8avPlVScMZ9JbM2f8LYCvJ16XxNB3hlPil/PQOTJZSOQlMWERL2AQtIYeAcrXixG\n6ZjpjS9FD7XS0fL4rQP3Xw2iZbaxYJn+69hTYlH6SLaHqadNCf9VFOVzAxv3/Opx\nspA3d3rcpNSNKh6Tb9oZ9vzeVte0+nQPWw1BTnvaeqyBFmC9NkfdHxdIcRzWJ9/+\ng03v3yE/rcU6aXIp30dHiSeFiHhlU9/LqZBFqi5ZSVA3vcS9NQIDAQABo4IBCDCC\nAQQwCQYDVR0TBAIwADAOBgNVHQ8BAf8EBAMCB4AwHQYDVR0lBBYwFAYIKwYBBQUH\nAwEGCCsGAQUFBwMCMEEGA1UdEQQ6MDiCDHRlc3QuZXhhbXBsZYIOKi50ZXN0LmV4\nYW1wbGWHBMAAAgqBEmFkbWluQHRlc3QuZXhhbXBsZTAdBgNVHQ4EFgQU89AZxtFa\nncCM4XL/Me+9e91CKXEwHwYDVR0jBBgwFoAU/ytKoZx3xtnyF1ygCkv6YkYY7Agw\nMAYDVR0fBCkwJzAloCOgIYYfaHR0cDovL2NybC50ZXN0LmV4YW1wbGUvaW50LmNy\nbDATBgNVHSAEDDAKMAgGBmeBDAECATANBgkqhkiG9w0BAQsFAAOCAQEArSHrun0l\n8m3CsM4IHX0WpfCKVMSJPwJv6qkAYVpKpr0WJL/9RMV/KwKZ4EE58xLxqxkaki/U\nzAnx7BZ2crikSpzxFqUM5DP7fsEZgNM/CdIE2f8+/ruw+lrb318F1hk/QP769+j2\ncb+qr495Eqzl9GwwvqjzagOBbnZ6lBG9EcXO6yepHUQ3S1ZrxMX+REzGtZAn2VO7\nWObL3evqoJb+xMFKJ5hZFWfaxn3YmOr68CY6gOBeZWE9aS+fl3XczmK79xnNdF6O\neSR9JScH99w4wnWCZYUteyOyD2xTGjMkluSfJRWHIJfYHq9CkAmiZFsawFLRjx6S\nDSZp05JhEnRelw==\n-----END CERTIFICATE-----', show: function (o) { return o.mode !== 'file'; } },
    { id: 'file', type: 'file', buffer: true, label: ['파일 선택 (.pem .crt .cer .der)', 'Choose a file (.pem .crt .cer .der)'], show: function (o) { return o.mode === 'file'; } }
  ],
  options: [
    { id: 'host', type: 'text', label: ['일치 확인할 호스트 이름 (선택)', 'Hostname to check against (optional)'], default: '', sample: 'www.test.example', placeholder: ['예: www.example.com', 'e.g. www.example.com'] },
    { id: 'at', type: 'text', label: ['기준 시각 (비우면 지금, 예: 2027-01-01T00:00:00Z)', 'Reference time (empty = now, e.g. 2027-01-01T00:00:00Z)'], default: '' },
    TK.binin.modeOption()
  ],
  sampleOptions: { host: 'www.test.example' },
  outputs: [{ id: 'table', label: ['인증서 내용', 'Certificate contents'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'out', label: ['JSON', 'JSON'], kind: 'code', ext: 'json' }],
  run: function (v, o, t) {
    var X = TK.x509, N = TK.binin, A = TK.asn1, H = TK.hash, issues = [];
    var ders = [];
    if (o.mode === 'file') {
      var f = v.file; if (!f || !f.buf) throw new Error(t('파일을 선택하세요', 'Choose a file'));
      var raw = new Uint8Array(f.buf), head = new TextDecoder().decode(raw.subarray(0, 60));
      if (/-----BEGIN /.test(head)) X.pemBlocks(new TextDecoder().decode(raw)).forEach(function (b) { if (b.der && /CERTIFICATE/.test(b.label)) ders.push(b.der); }); else ders.push(raw);
    } else {
      var txt = String(v['in'] || ''); if (!txt.trim()) throw new Error(t('인증서를 입력하세요', 'Enter a certificate'));
      if (/-----BEGIN /.test(txt)) {
        var blocks = X.pemBlocks(txt), skipped = blocks.filter(function (b) { return !/CERTIFICATE/.test(b.label); });
        blocks.forEach(function (b) { if (b.error) throw new Error(t('PEM 본문이 올바른 Base64 가 아닙니다', 'The PEM body is not valid Base64')); if (/CERTIFICATE/.test(b.label) && !/REQUEST/.test(b.label)) ders.push(b.der); });
        if (skipped.length) issues.push(t('인증서가 아닌 PEM 블록 ' + skipped.length + '개(' + skipped.map(function (b) { return b.label; }).join(', ') + ')는 건너뛰었습니다', skipped.length + ' non-certificate PEM block(s) skipped (' + skipped.map(function (b) { return b.label; }).join(', ') + ')'));
        if (blocks.some(function (b) { return /PRIVATE KEY/.test(b.label); })) issues.push(t('⛔ 개인키가 함께 붙여 넣어졌습니다. 개인키는 어디에도 공유하지 마세요', '⛔ A private key was pasted too. Never share private keys'));
      } else ders.push(N.get(v, { mode: 'text', fmt: o.fmt || 'auto' }).bytes);
    }
    if (!ders.length) throw new Error(t('인증서(CERTIFICATE) 블록을 찾지 못했습니다', 'No CERTIFICATE block found'));
    if (ders.length > 20) { ders = ders.slice(0, 20); issues.push(t('인증서는 처음 20개만 해석합니다', 'Only the first 20 certificates are decoded')); }
    var now = o.at && String(o.at).trim() ? new Date(String(o.at).trim()) : new Date();
    if (isNaN(now)) throw new Error(t('기준 시각 형식이 올바르지 않습니다 (예: 2027-01-01T00:00:00Z)', 'Invalid reference time (e.g. 2027-01-01T00:00:00Z)'));
    var certs = ders.map(function (d, i) { try { return X.parseCert(d); } catch (e) { throw new Error(t('인증서 ' + (i + 1) + ' 해석 실패: ', 'Certificate ' + (i + 1) + ' failed: ') + e.message); } });
    function matchHost(pattern, host) {
      pattern = pattern.toLowerCase(); host = host.toLowerCase();
      if (pattern === host) return true;
      if (pattern.indexOf('*') === 0 && pattern.charAt(1) === '.') { var suffix = pattern.slice(1); var hp = host.split('.'), pp = pattern.split('.'); return hp.length === pp.length && host.slice(host.indexOf('.')) === suffix && hp[0].length > 0 && pp.slice(1).length >= 2; }
      return false;
    }
    return Promise.all(certs.map(function (c) { return Promise.all([X.digest('SHA-256', c.der), X.digest('SHA-1', c.der)]); })).then(function (fps) {
      var rows = [], json = [];
      certs.forEach(function (c, i) {
        var tag = certs.length > 1 ? '#' + (i + 1) + ' ' : '';
        var nb = new Date(c.notBefore), na = new Date(c.notAfter), days = Math.floor((na - now) / 86400000), life = Math.round((na - nb) / 86400000);
        var san = c.ext('2.5.29.17'), bc = c.ext('2.5.29.19'), ku = c.ext('2.5.29.15'), eku = c.ext('2.5.29.37'), aia = c.ext('1.3.6.1.5.5.7.1.1'), crl = c.ext('2.5.29.31'), pol = c.ext('2.5.29.32'), ski = c.ext('2.5.29.14'), aki = c.ext('2.5.29.35'), sct = c.ext('1.3.6.1.4.1.11129.2.4.2');
        var isCA = !!(bc && bc.ca), kind = c.selfIssued ? (isCA ? t('루트(자체 서명) CA', 'Root (self-signed) CA') : t('자체 서명 인증서', 'Self-signed certificate')) : isCA ? t('중간 CA', 'Intermediate CA') : t('최종 엔티티(리프)', 'End-entity (leaf)');
        var keyDesc = c.key.alg === 'RSA' ? 'RSA ' + c.key.bits + ' bit (e=' + c.key.exponent + ')' : c.key.alg === 'EC' ? 'EC ' + (c.key.curve || '') : c.key.name;
        var R = function (k, val) { rows.push([tag + k, val]); };
        R(t('종류', 'Type'), kind);
        R(t('주체 (Subject)', 'Subject'), c.subject.str || t('(비어 있음)', '(empty)'));
        R(t('발급자 (Issuer)', 'Issuer'), c.issuer.str);
        R(t('버전', 'Version'), 'v' + c.version);
        R(t('일련번호', 'Serial'), c.serialHex);
        R(t('유효 시작', 'Not before'), c.notBefore);
        R(t('유효 종료', 'Not after'), c.notAfter + ' (' + (days >= 0 ? t(days + '일 남음', days + ' days left') : t(-days + '일 전 만료', 'expired ' + (-days) + ' days ago')) + ')');
        R(t('유효 기간', 'Validity period'), life + t('일', ' days'));
        R(t('서명 알고리즘', 'Signature algorithm'), c.sigAlg);
        R(t('공개키', 'Public key'), keyDesc);
        if (san) R('SAN', san.text); else R('SAN', t('(없음)', '(none)'));
        if (bc) R('Basic Constraints', bc.text + (bc.critical ? ' [critical]' : ''));
        if (ku) R('Key Usage', ku.text + (ku.critical ? ' [critical]' : ''));
        if (eku) R('Extended Key Usage', eku.text);
        if (ski) R('Subject Key ID', ski.text);
        if (aki) R('Authority Key ID', aki.text);
        if (crl) R('CRL ' + t('배포 지점', 'distribution points'), crl.text);
        if (aia) R('AIA', aia.text);
        if (pol) R(t('인증서 정책', 'Policies'), pol.text);
        if (sct) R('Certificate Transparency', sct.text);
        c.exts.forEach(function (e) { if (['2.5.29.17', '2.5.29.19', '2.5.29.15', '2.5.29.37', '2.5.29.14', '2.5.29.35', '2.5.29.31', '1.3.6.1.5.5.7.1.1', '2.5.29.32', '1.3.6.1.4.1.11129.2.4.2'].indexOf(e.oid) < 0) R(t('확장: ', 'Extension: ') + e.name, e.text + (e.critical ? ' [critical]' : '')); });
        R('SHA-256 ' + t('지문', 'fingerprint'), fps[i][0]);
        R('SHA-1 ' + t('지문', 'fingerprint'), fps[i][1]);
        /* 점검 */
        var P = certs.length > 1 ? t('인증서 ' + (i + 1) + ': ', 'Cert ' + (i + 1) + ': ') : '';
        if (now < nb) issues.push('⛔ ' + P + t('아직 유효하지 않습니다 (시작: ' + c.notBefore + ')', 'Not yet valid (starts ' + c.notBefore + ')'));
        else if (days < 0) issues.push('⛔ ' + P + t('만료되었습니다 (' + (-days) + '일 전)', 'Expired ' + (-days) + ' days ago'));
        else if (days <= 14) issues.push('⚠️ ' + P + t('만료까지 ' + days + '일 남았습니다', 'Expires in ' + days + ' days'));
        else if (days <= 30) issues.push('⚠️ ' + P + t('만료까지 ' + days + '일 남았습니다. 갱신을 준비하세요', 'Expires in ' + days + ' days; plan renewal'));
        if (/md5|md2|sha1/i.test(c.sigAlg) && !/^sha1$/.test(c.sigAlg)) issues.push('⚠️ ' + P + t('약한 서명 알고리즘(' + c.sigAlg + ')입니다. SHA-256 이상을 쓰세요', 'Weak signature algorithm (' + c.sigAlg + '); use SHA-256 or stronger'));
        if (c.key.alg === 'RSA' && c.key.bits < 2048) issues.push('⚠️ ' + P + t('RSA 키가 ' + c.key.bits + '비트로 짧습니다 (2048 이상 권장)', 'RSA key is only ' + c.key.bits + ' bits (2048+ recommended)'));
        if (c.sigMismatch) issues.push('⛔ ' + P + t('TBSCertificate 와 바깥 서명 알고리즘이 서로 다릅니다', 'Signature algorithm differs between TBSCertificate and the outer structure'));
        if (!isCA && !c.selfIssued) {
          if (!san) issues.push('⚠️ ' + P + t('SAN 이 없습니다. 최신 브라우저는 CN 만으로는 호스트 이름을 인정하지 않습니다', 'No SAN; modern browsers ignore the CN for hostname matching'));
          if (eku && eku.ekus.indexOf('serverAuth') < 0 && eku.ekus.indexOf('anyExtendedKeyUsage') < 0) issues.push('ℹ️ ' + P + t('serverAuth 용도가 없어 TLS 서버 인증서로는 쓸 수 없습니다', 'No serverAuth usage, so it cannot be a TLS server certificate'));
          if (life > 398) issues.push('ℹ️ ' + P + t('유효 기간이 ' + life + '일입니다. 공개 TLS 인증서는 398일을 넘을 수 없습니다 (사설 인증서면 무관)', 'Validity is ' + life + ' days; public TLS certificates are capped at 398 days (irrelevant for private CAs)'));
          if (!aia && !crl) issues.push('ℹ️ ' + P + t('OCSP/CRL 위치(AIA, CRL DP)가 없어 폐지 확인을 할 수 없습니다', 'No OCSP / CRL locations (AIA, CRL DP) for revocation checking'));
        }
        if (isCA && ku && ku.usages.indexOf('keyCertSign') < 0) issues.push('⚠️ ' + P + t('CA 인증서인데 keyCertSign 용도가 없습니다', 'CA certificate without the keyCertSign usage'));
        if (isCA && bc && !bc.critical) issues.push('ℹ️ ' + P + t('CA 의 Basic Constraints 는 critical 이어야 합니다', 'Basic Constraints of a CA should be critical'));
        if (c.selfIssued && !isCA) issues.push('ℹ️ ' + P + t('자체 서명 인증서입니다. 브라우저는 신뢰하지 않습니다 (사설 신뢰 저장소에 추가해야 함)', 'Self-signed: browsers will not trust it unless it is added to a trust store'));
        if (o.host && String(o.host).trim() && !isCA) {
          var host = String(o.host).trim(), names = san ? san.names : [], ok = false, hit = '';
          var isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || /^[0-9a-f:]+$/i.test(host) && host.indexOf(':') >= 0;
          names.forEach(function (n) { if (ok) return; if (isIp ? n.type === 'IP' && n.value.toLowerCase() === host.toLowerCase() : n.type === 'DNS' && matchHost(n.value, host)) { ok = true; hit = n.value; } });
          issues.push(ok ? '✅ ' + P + t('호스트 "' + host + '" 은(는) SAN "' + hit + '" 과(와) 일치합니다', 'Host "' + host + '" matches SAN "' + hit + '"') : '⛔ ' + P + t('호스트 "' + host + '" 와 일치하는 SAN 이 없습니다', 'No SAN matches host "' + host + '"') + (san ? '' : t(' (SAN 자체가 없음)', ' (the certificate has no SAN)')));
        }
        json.push({ subject: c.subject.str, issuer: c.issuer.str, serial: c.serialHex, notBefore: c.notBefore, notAfter: c.notAfter, daysLeft: days, signatureAlgorithm: c.sigAlg, publicKey: keyDesc, isCA: isCA, selfSigned: c.selfIssued, san: san ? san.names.map(function (n) { return n.type + ':' + n.value; }) : [], keyUsage: ku ? ku.usages : [], extendedKeyUsage: eku ? eku.ekus : [], sha256: fps[i][0], sha1: fps[i][1] });
      });
      if (certs.length > 1) issues.push(t('인증서 ' + certs.length + '개 번들입니다. 체인 순서·서명 검증은 "인증서 체인 검증" 도구에서 확인하세요', certs.length + ' certificates; check ordering and signatures in the certificate chain checker'));
      var bad = issues.filter(function (x) { return x.indexOf('⛔') === 0; }).length;
      return { _status: { ok: bad ? false : true, msg: bad ? t('⛔ 문제 ' + bad + '건 — 인증서 ' + certs.length + '개 해석', '⛔ ' + bad + ' problem(s) — ' + certs.length + ' certificate(s) decoded') : t('✅ 인증서 ' + certs.length + '개 해석 완료', '✅ ' + certs.length + ' certificate(s) decoded') }, table: { head: [['항목', 'Field'], ['값', 'Value']], rows: rows }, issues: issues, out: JSON.stringify(certs.length === 1 ? json[0] : json, null, 2) };
    });
  }
});
