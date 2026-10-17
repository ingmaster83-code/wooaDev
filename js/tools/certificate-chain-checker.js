TK.tool('certificate-chain-checker', {
  inputs: [
    { id: 'in', label: ['인증서 번들 (PEM 여러 개)', 'Certificate bundle (several PEM blocks)'], rows: 14, sample: '-----BEGIN CERTIFICATE-----\nMIIEJjCCAw6gAwIBAgIULtv0YaivYcewDIxv3/H4E4IucsUwDQYJKoZIhvcNAQEL\nBQAwTzELMAkGA1UEBhMCS1IxFzAVBgNVBAoMDldvb2FIb3VzZSBUZXN0MScwJQYD\nVQQDDB5Xb29hSG91c2UgVGVzdCBJbnRlcm1lZGlhdGUgQ0EwIBcNMjYxMDE3MDI0\nOTEyWhgPMjEyMjA4MTUwMjQ5MTJaMD0xCzAJBgNVBAYTAktSMRcwFQYDVQQKDA5X\nb29hSG91c2UgVGVzdDEVMBMGA1UEAwwMdGVzdC5leGFtcGxlMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq3nB6psHqkUElGM1kqgLdMjfCUV9OigW4q2J\n4YXDtWk4Z+EGdy201BBJOnOapvcWyCaa6s0Q+dV996hH52Uc0dsMHxiD5iqOaSmr\n8avPlVScMZ9JbM2f8LYCvJ16XxNB3hlPil/PQOTJZSOQlMWERL2AQtIYeAcrXixG\n6ZjpjS9FD7XS0fL4rQP3Xw2iZbaxYJn+69hTYlH6SLaHqadNCf9VFOVzAxv3/Opx\nspA3d3rcpNSNKh6Tb9oZ9vzeVte0+nQPWw1BTnvaeqyBFmC9NkfdHxdIcRzWJ9/+\ng03v3yE/rcU6aXIp30dHiSeFiHhlU9/LqZBFqi5ZSVA3vcS9NQIDAQABo4IBCDCC\nAQQwCQYDVR0TBAIwADAOBgNVHQ8BAf8EBAMCB4AwHQYDVR0lBBYwFAYIKwYBBQUH\nAwEGCCsGAQUFBwMCMEEGA1UdEQQ6MDiCDHRlc3QuZXhhbXBsZYIOKi50ZXN0LmV4\nYW1wbGWHBMAAAgqBEmFkbWluQHRlc3QuZXhhbXBsZTAdBgNVHQ4EFgQU89AZxtFa\nncCM4XL/Me+9e91CKXEwHwYDVR0jBBgwFoAU/ytKoZx3xtnyF1ygCkv6YkYY7Agw\nMAYDVR0fBCkwJzAloCOgIYYfaHR0cDovL2NybC50ZXN0LmV4YW1wbGUvaW50LmNy\nbDATBgNVHSAEDDAKMAgGBmeBDAECATANBgkqhkiG9w0BAQsFAAOCAQEArSHrun0l\n8m3CsM4IHX0WpfCKVMSJPwJv6qkAYVpKpr0WJL/9RMV/KwKZ4EE58xLxqxkaki/U\nzAnx7BZ2crikSpzxFqUM5DP7fsEZgNM/CdIE2f8+/ruw+lrb318F1hk/QP769+j2\ncb+qr495Eqzl9GwwvqjzagOBbnZ6lBG9EcXO6yepHUQ3S1ZrxMX+REzGtZAn2VO7\nWObL3evqoJb+xMFKJ5hZFWfaxn3YmOr68CY6gOBeZWE9aS+fl3XczmK79xnNdF6O\neSR9JScH99w4wnWCZYUteyOyD2xTGjMkluSfJRWHIJfYHq9CkAmiZFsawFLRjx6S\nDSZp05JhEnRelw==\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIDMTCCAtigAwIBAgIUBI0TBEzFHXmQA3uTIZwcgE8mr1QwCgYIKoZIzj0EAwIw\nRzELMAkGA1UEBhMCS1IxFzAVBgNVBAoMDldvb2FIb3VzZSBUZXN0MR8wHQYDVQQD\nDBZXb29hSG91c2UgVGVzdCBSb290IENBMCAXDTI2MTAxNzAyNDkxMloYDzIxMjUw\nNTExMDI0OTEyWjBPMQswCQYDVQQGEwJLUjEXMBUGA1UECgwOV29vYUhvdXNlIFRl\nc3QxJzAlBgNVBAMMHldvb2FIb3VzZSBUZXN0IEludGVybWVkaWF0ZSBDQTCCASIw\nDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALgp7Cl+KIcAteiiXH2bdurK5mix\nLgKTae3aUshTnxnkhZm7WI5QuyvUbCZSG/NWY3xhB+hJqqfEORCgsIWNbCf9TBxK\nUc+h9V5AqkrODlDuFx1efyfx7kH5E9+fkV9LR7lkHcUrwIfQ4DGHKFqyFWPGRbFj\neuvAETIGEk2FEFpsGN7tecYxq1LDTToB+KMVMKjNK+G6LwinH+8+tvmfRLhFrhah\nlHmAKMx1OlW+JNlYthsxU3xKehAtIVA4AIDvkajhLzDKR3xK0t2EWHPbqW4gnNIV\nZv/Vrj8c3xLu2oMYkyAy5anXboCtAYS/rMrZdGSQKuixZoGSIpmtx47mlHMCAwEA\nAaOBzDCByTASBgNVHRMBAf8ECDAGAQH/AgEAMA4GA1UdDwEB/wQEAwIBBjAdBgNV\nHQ4EFgQU/ytKoZx3xtnyF1ygCkv6YkYY7AgwHwYDVR0jBBgwFoAUS6aTJ5/r0YwY\nbubWrtxNcAgEME0wYwYIKwYBBQUHAQEEVzBVMCUGCCsGAQUFBzABhhlodHRwOi8v\nb2NzcC50ZXN0LmV4YW1wbGUvMCwGCCsGAQUFBzAChiBodHRwOi8vcGtpLnRlc3Qu\nZXhhbXBsZS9yb290LmNydDAKBggqhkjOPQQDAgNHADBEAiBvOHJ80e+EyeCxEjIT\nu+V8UAqK6SHvivMeDYG1o972+AIgAkfAG/6rqWhDpSffUlBuOwVfcZv5dBZBBfS7\nzbgGJus=\n-----END CERTIFICATE-----', show: function (o) { return o.mode !== 'file'; } },
    { id: 'file', type: 'file', buffer: true, label: ['파일 선택 (.pem .crt .ca-bundle)', 'Choose a file (.pem .crt .ca-bundle)'], show: function (o) { return o.mode === 'file'; } }
  ],
  options: [
    { id: 'host', type: 'text', label: ['리프 인증서와 일치 확인할 호스트 (선택)', 'Hostname to check against the leaf (optional)'], default: '' },
    { id: 'at', type: 'text', label: ['기준 시각 (비우면 지금)', 'Reference time (empty = now)'], default: '' },
    TK.binin.modeOption()
  ],
  outputs: [{ id: 'table', label: ['체인', 'Chain'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var X = TK.x509, issues = [], texts;
    if (o.mode === 'file') { var f = v.file; if (!f || !f.buf) throw new Error(t('파일을 선택하세요', 'Choose a file')); texts = new TextDecoder().decode(new Uint8Array(f.buf)); }
    else texts = String(v['in'] || '');
    if (!texts.trim()) throw new Error(t('인증서 번들을 입력하세요', 'Enter a certificate bundle'));
    var blocks = X.pemBlocks(texts).filter(function (b) { return /CERTIFICATE/.test(b.label) && !/REQUEST/.test(b.label) && b.der; });
    if (!blocks.length) throw new Error(t('PEM 인증서 블록을 찾지 못했습니다 (-----BEGIN CERTIFICATE-----)', 'No PEM certificate block found (-----BEGIN CERTIFICATE-----)'));
    if (blocks.length > 30) throw new Error(t('인증서는 30개까지 검사할 수 있습니다', 'At most 30 certificates can be checked'));
    var now = o.at && String(o.at).trim() ? new Date(String(o.at).trim()) : new Date();
    if (isNaN(now)) throw new Error(t('기준 시각 형식이 올바르지 않습니다', 'Invalid reference time'));
    var certs = blocks.map(function (b, i) { try { var c = X.parseCert(b.der); c.pos = i + 1; return c; } catch (e) { throw new Error(t('인증서 ' + (i + 1) + ' 해석 실패: ', 'Certificate ' + (i + 1) + ' failed: ') + e.message); } });
    /* 중복 제거 */
    return Promise.all(certs.map(function (c) { return X.digest('SHA-256', c.der); })).then(function (fps) {
      certs.forEach(function (c, i) { c.fp = fps[i]; });
      var seen = {}, uniq = [];
      certs.forEach(function (c) { if (seen[c.fp]) issues.push('ℹ️ ' + t('인증서 ' + c.pos + ' 는 인증서 ' + seen[c.fp] + ' 와 같은 중복입니다', 'Certificate ' + c.pos + ' duplicates certificate ' + seen[c.fp])); else { seen[c.fp] = c.pos; uniq.push(c); } });
      /* 리프 선택: 다른 인증서의 발급자가 아닌 것 중 비-CA 우선, 번들 순서상 첫 번째 */
      var isIssuerOfOther = function (c) { return uniq.some(function (d) { return d !== c && d.issuer.key === c.subject.key && !d.selfIssued; }); };
      var leafCands = uniq.filter(function (c) { return !isIssuerOfOther(c); });
      var leaf = leafCands.filter(function (c) { var bc = c.ext('2.5.29.19'); return !(bc && bc.ca); })[0] || leafCands[0] || uniq[0];
      var chain = [leaf], used = [leaf];
      var cur = leaf;
      while (!cur.selfIssued && chain.length < 12) {
        var akiExt = cur.ext('2.5.29.35'), aki = akiExt && akiExt.text.replace('keyid:', '');
        var cands = uniq.filter(function (d) { return used.indexOf(d) < 0 && d.subject.key === cur.issuer.key; });
        if (cands.length > 1 && aki) { var byKey = cands.filter(function (d) { var s = d.ext('2.5.29.14'); return s && s.text === aki; }); if (byKey.length) cands = byKey; }
        if (!cands.length) break;
        cur = cands[0]; chain.push(cur); used.push(cur);
      }
      var extra = uniq.filter(function (c) { return used.indexOf(c) < 0; });
      var jobs = chain.map(function (c, i) {
        var issuer = c.selfIssued ? c : chain[i + 1];
        return issuer ? X.verify(c, issuer) : Promise.resolve({ ok: null, reason: t('발급자 인증서가 번들에 없습니다', 'Issuer certificate is not in the bundle') });
      });
      return Promise.all(jobs).then(function (vr) {
        var rows = [], last = chain[chain.length - 1], complete = last.selfIssued;
        chain.forEach(function (c, i) {
          var bc = c.ext('2.5.29.19'), isCA = !!(bc && bc.ca), na = new Date(c.notAfter), nb = new Date(c.notBefore), days = Math.floor((na - now) / 86400000);
          var role = i === 0 ? (isCA ? t('리프(CA 로 표시됨)', 'Leaf (marked as CA)') : t('리프', 'Leaf')) : c.selfIssued ? t('루트', 'Root') : t('중간 CA', 'Intermediate');
          var state = now < nb ? '⛔ ' + t('아직 유효하지 않음', 'not yet valid') : days < 0 ? '⛔ ' + t('만료됨', 'expired') : days <= 30 ? '⚠️ ' + days + t('일 남음', ' days left') : '✅ ' + days + t('일 남음', ' days left');
          var sig = vr[i].ok === true ? '✅ ' + (c.selfIssued ? t('자체 서명 일치', 'self-signature OK') : t('발급자 서명 일치', 'issuer signature OK')) : vr[i].ok === false ? '⛔ ' + vr[i].reason : '❔ ' + vr[i].reason;
          rows.push([String(i + 1), role + ' (' + t('번들 ', 'bundle #') + c.pos + ')', c.subject.str, c.issuer.str, state, sig]);
          var P = t('[' + (i + 1) + '번 ' + role + '] ', '[#' + (i + 1) + ' ' + role + '] ');
          if (now < nb) issues.push('⛔ ' + P + t('아직 유효하지 않습니다', 'not yet valid'));
          else if (days < 0) issues.push('⛔ ' + P + t('만료되었습니다', 'expired'));
          else if (days <= 30) issues.push('⚠️ ' + P + t('만료까지 ' + days + '일', 'expires in ' + days + ' days'));
          if (vr[i].ok === false) issues.push('⛔ ' + P + vr[i].reason);
          if (i > 0) {
            var ku = c.ext('2.5.29.15');
            if (!isCA) issues.push('⛔ ' + P + t('Basic Constraints 의 CA 가 TRUE 가 아니라 다른 인증서를 발급할 수 없습니다', 'Basic Constraints CA is not TRUE, so it cannot issue certificates'));
            if (ku && ku.usages.indexOf('keyCertSign') < 0) issues.push('⛔ ' + P + t('Key Usage 에 keyCertSign 이 없습니다', 'Key Usage lacks keyCertSign'));
            if (bc && bc.pathLen != null) { var below = i - 1; if (!chain[i - 1].selfIssued && below > bc.pathLen) issues.push('⛔ ' + P + t('pathlen:' + bc.pathLen + ' 제한을 넘는 하위 CA 가 있습니다', 'more subordinate CAs than pathlen:' + bc.pathLen + ' allows')); }
          }
          if (/md5|md2|sha1/i.test(c.sigAlg) && !c.selfIssued) issues.push('⚠️ ' + P + t('약한 서명 알고리즘(' + c.sigAlg + ')', 'weak signature algorithm (' + c.sigAlg + ')'));
          if (c.key.alg === 'RSA' && c.key.bits < 2048) issues.push('⚠️ ' + P + t('RSA ' + c.key.bits + '비트 키', 'RSA ' + c.key.bits + '-bit key'));
        });
        if (!complete) issues.push(chain.length === 1 ? '⚠️ ' + t('발급자 "' + last.issuer.str + '" 인증서가 번들에 없습니다. 서버가 중간 CA 를 함께 보내지 않으면 일부 클라이언트(안드로이드, 자바, curl 등)가 연결을 거부합니다', 'The issuer "' + last.issuer.str + '" is not in the bundle. If the server does not send its intermediate CA, some clients (Android, Java, curl …) refuse the connection') : 'ℹ️ ' + t('번들이 루트 없이 끝납니다 (서버 번들로는 정상). 마지막 인증서의 발급자 "' + last.issuer.str + '" 가 클라이언트의 신뢰 저장소에 있어야 합니다', 'The bundle ends without a root, which is normal for a server bundle. The issuer "' + last.issuer.str + '" of the last certificate must be in the client trust store'));
        else if (chain.length > 1) issues.push('ℹ️ ' + t('번들에 루트 인증서가 포함되어 있습니다. 서버는 루트를 보낼 필요가 없습니다 (클라이언트의 신뢰 저장소에 있음)', 'The bundle includes the root; servers do not need to send it (clients have it in their trust store)'));
        if (complete && chain.length > 1) issues.push('ℹ️ ' + t('루트가 신뢰 저장소에 있는지는 이 도구가 확인하지 않습니다 (서명 체인만 검증)', 'This tool does not check that the root is in a trust store (it verifies the signature chain only)'));
        if (extra.length) issues.push('⚠️ ' + t('체인에 속하지 않는 인증서 ' + extra.length + '개(번들 ' + extra.map(function (c) { return c.pos; }).join(', ') + '번)가 있습니다', extra.length + ' certificate(s) not part of the chain (bundle #' + extra.map(function (c) { return c.pos; }).join(', ') + ')'));
        /* 번들 순서: 리프 → 발급자 순이어야 함 */
        var order = chain.map(function (c) { return c.pos; }), inOrder = order.every(function (p, i) { return i === 0 || p > order[i - 1]; });
        if (!inOrder) issues.push('⚠️ ' + t('번들의 순서가 리프 → 중간 CA → 루트 순이 아닙니다 (현재 ' + order.join(' → ') + '). 일부 클라이언트는 순서가 틀리면 연결을 거부합니다', 'The bundle is not ordered leaf → intermediate → root (found ' + order.join(' → ') + '); some clients reject a misordered chain'));
        if (o.host && String(o.host).trim()) {
          var host = String(o.host).trim().toLowerCase(), san = leaf.ext('2.5.29.17'), hit = null;
          (san ? san.names : []).forEach(function (n) { if (hit || n.type !== 'DNS') return; var p = n.value.toLowerCase(); if (p === host || (p.indexOf('*.') === 0 && host.split('.').length === p.split('.').length && host.slice(host.indexOf('.')) === p.slice(1))) hit = n.value; });
          issues.push(hit ? '✅ ' + t('리프의 SAN "' + hit + '" 이(가) 호스트 "' + host + '" 와 일치합니다', 'Leaf SAN "' + hit + '" matches host "' + host + '"') : '⛔ ' + t('리프 인증서의 SAN 중 호스트 "' + host + '" 와 일치하는 항목이 없습니다', 'No SAN of the leaf matches host "' + host + '"'));
        }
        var bad = issues.filter(function (x) { return x.indexOf('⛔') === 0; }).length, warn = issues.filter(function (x) { return x.indexOf('⚠️') === 0; }).length;
        return { _status: { ok: bad ? false : true, msg: bad ? t('⛔ 문제 ' + bad + '건 — 체인 ' + chain.length + '단계', '⛔ ' + bad + ' problem(s) — chain of ' + chain.length) : t('✅ 체인 ' + chain.length + '단계 검증 완료' + (warn ? ' (경고 ' + warn + '건)' : ''), '✅ Chain of ' + chain.length + ' verified' + (warn ? ' (' + warn + ' warning(s))' : '')) }, table: { head: [['#', '#'], ['역할', 'Role'], ['주체', 'Subject'], ['발급자', 'Issuer'], ['유효 기간', 'Validity'], ['서명 검증', 'Signature']], rows: rows }, issues: issues };
      });
    });
  }
});
