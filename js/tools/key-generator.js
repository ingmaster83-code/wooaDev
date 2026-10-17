TK.tool('key-generator', {
  inputs: [{ id: 'comment', type: 'text', label: ['SSH 공개키 주석 (선택, 예: you@host)', 'SSH public key comment (optional, e.g. you@host)'], sample: 'test@wooadev' }],
  options: [
    { id: 'kt', type: 'select', label: ['키 종류', 'Key type'], choices: [['ec256', 'ECDSA P-256'], ['ec384', 'ECDSA P-384'], ['ec521', 'ECDSA P-521'], ['ed25519', 'Ed25519'], ['rsa2048', 'RSA 2048'], ['rsa3072', ['RSA 3072', 'RSA 3072']], ['rsa4096', ['RSA 4096 (몇 초 걸림)', 'RSA 4096 (takes seconds)']]], default: 'ec256' }
  ],
  exampleOutputs: ['table', 'ssh'],
  outputs: [{ id: 'table', label: ['키 정보', 'Key info'], kind: 'table' }, { id: 'priv', label: ['개인키 (PKCS#8 PEM) — 공유 금지', 'Private key (PKCS#8 PEM) — never share'], kind: 'code', ext: 'key' }, { id: 'pub', label: ['공개키 (SPKI PEM)', 'Public key (SPKI PEM)'], kind: 'code', ext: 'pub' }, { id: 'jwk', label: ['JWK (개인키 포함 / 공개키)', 'JWK (private / public)'], kind: 'code', ext: 'json' }, { id: 'ssh', label: ['SSH 공개키 (authorized_keys 한 줄)', 'SSH public key (authorized_keys line)'], kind: 'code', ext: 'pub' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var X = TK.x509, H = TK.hash, A = TK.asn1, issues = [], subtle = (window.crypto || globalThis.crypto).subtle;
    if (!subtle) throw new Error(t('Web Crypto 를 쓸 수 없습니다. HTTPS 로 접속하세요', 'Web Crypto is unavailable; use HTTPS'));
    var kt = o.kt, isRsa = kt.indexOf('rsa') === 0, isEd = kt === 'ed25519';
    var gen = isRsa ? { name: 'RSASSA-PKCS1-v1_5', modulusLength: parseInt(kt.slice(3), 10), publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } : isEd ? { name: 'Ed25519' } : { name: 'ECDSA', namedCurve: { ec256: 'P-256', ec384: 'P-384', ec521: 'P-521' }[kt] };
    var comment = String(v.comment || '').trim().replace(/\s+/g, ' ');
    function sshStr(u8) { var r = new Uint8Array(4 + u8.length); new DataView(r.buffer).setUint32(0, u8.length); r.set(u8, 4); return r; }
    function mpint(u8) { var i = 0; while (i < u8.length - 1 && u8[i] === 0) i++; u8 = u8.subarray(i); if (u8[0] & 0x80) { var r = new Uint8Array(u8.length + 1); r.set(u8, 1); return r; } return u8; }
    return subtle.generateKey(gen, true, ['sign', 'verify']).then(function (kp) {
      return Promise.all([subtle.exportKey('pkcs8', kp.privateKey), subtle.exportKey('spki', kp.publicKey), subtle.exportKey('jwk', kp.privateKey), subtle.exportKey('jwk', kp.publicKey), subtle.exportKey('raw', kp.publicKey).catch(function () { return null; })]).then(function (ex) {
        var pk8 = new Uint8Array(ex[0]), spki = new Uint8Array(ex[1]), jp = ex[2], jq = ex[3], raw = ex[4] ? new Uint8Array(ex[4]) : null;
        function clean(j) { var c = {}; Object.keys(j).forEach(function (k) { if (['key_ops', 'ext', 'alg'].indexOf(k) < 0) c[k] = j[k]; }); return c; }
        var blob, type;
        if (isRsa) { type = 'ssh-rsa'; blob = H.concat(H.concat(sshStr(H.utf8(type)), sshStr(mpint(H.fromB64(jq.e)))), sshStr(mpint(H.fromB64(jq.n)))); }
        else if (isEd) { type = 'ssh-ed25519'; blob = H.concat(sshStr(H.utf8(type)), sshStr(raw)); }
        else { var cid = { ec256: 'nistp256', ec384: 'nistp384', ec521: 'nistp521' }[kt]; type = 'ecdsa-sha2-' + cid; blob = H.concat(H.concat(sshStr(H.utf8(type)), sshStr(H.utf8(cid))), sshStr(raw)); }
        var pubC = clean(jq), privC = clean(jp);
        return Promise.all([H.sha('SHA-256', blob), H.sha('SHA-256', H.utf8(JSON.stringify(isRsa ? { e: jq.e, kty: 'RSA', n: jq.n } : isEd ? { crv: jq.crv, kty: 'OKP', x: jq.x } : { crv: jq.crv, kty: 'EC', x: jq.x, y: jq.y })))]).then(function (fp) {
          var sshFp = 'SHA256:' + H.b64(fp[0]).replace(/=+$/, ''), tp = H.b64url(fp[1]);
          var sshLine = type + ' ' + H.b64(blob) + (comment ? ' ' + comment : '');
          var label = isRsa ? 'RSA ' + kt.slice(3) + ' bit' : isEd ? 'Ed25519' : 'ECDSA ' + { ec256: 'P-256', ec384: 'P-384', ec521: 'P-521' }[kt];
          issues.push(t('⛔ 개인키는 이 브라우저 안에서만 만들어졌고 전송되지 않습니다. 하지만 화면에 나온 키는 절대 운영 환경에 쓰지 마세요 — 테스트·학습용입니다. 운영 키는 서버나 HSM·KMS 에서 직접 생성하세요', '⛔ The private key was generated only inside this browser and never sent. Still, do not use a key shown on screen in production — this is for testing and learning; generate production keys on the server or in an HSM / KMS'));
          if (isRsa && kt === 'rsa2048') issues.push('ℹ️ ' + t('RSA 2048 은 아직 안전하지만 새로 만든다면 ECDSA P-256 또는 Ed25519 가 더 짧고 빠릅니다', 'RSA 2048 is still safe, but a new key is shorter and faster as ECDSA P-256 or Ed25519'));
          issues.push(t('SSH 공개키 한 줄은 ~/.ssh/authorized_keys 에 그대로 추가합니다. 개인키를 OpenSSH 형식으로 쓰려면 이 PKCS#8 PEM 도 ssh 가 읽을 수 있습니다 (chmod 600)', 'Add the SSH line to ~/.ssh/authorized_keys as is. ssh can read this PKCS#8 PEM as a private key (chmod 600)'));
          if (isEd) issues.push('ℹ️ ' + t('Ed25519 는 오래된 브라우저에서 만들 수 없을 수 있습니다 (Chrome 137+, Firefox 129+, Safari 17+)', 'Ed25519 generation may be unavailable in older browsers (Chrome 137+, Firefox 129+, Safari 17+)'));
          return { _status: t('✅ ' + label + ' 키 쌍을 만들었습니다', '✅ Generated a ' + label + ' key pair'), table: { head: [['항목', 'Item'], ['값', 'Value']], rows: [[t('종류', 'Type'), label], [t('SSH 지문', 'SSH fingerprint'), sshFp], [t('JWK 지문 (RFC 7638)', 'JWK thumbprint (RFC 7638)'), tp], [t('개인키 형식', 'Private key format'), 'PKCS#8 (-----BEGIN PRIVATE KEY-----)'], [t('공개키 형식', 'Public key format'), 'SubjectPublicKeyInfo (-----BEGIN PUBLIC KEY-----)']] }, priv: X.toPem('PRIVATE KEY', pk8), pub: X.toPem('PUBLIC KEY', spki), jwk: '// ' + t('개인키 JWK (d 포함) — 공유 금지', 'private JWK (contains d) — never share') + '\n' + JSON.stringify(privC, null, 2) + '\n\n// ' + t('공개키 JWK (JWKS 에 게시 가능)', 'public JWK (safe to publish in a JWKS)') + '\n' + JSON.stringify(pubC, null, 2), ssh: sshLine, issues: issues };
        });
      });
    }, function (e) { throw new Error(t('키를 만들 수 없습니다: ', 'Cannot generate the key: ') + (e && e.message || e) + (isEd ? t(' (이 브라우저가 Ed25519 를 지원하지 않을 수 있습니다)', ' (this browser may not support Ed25519)') : '')); });
  }
});
