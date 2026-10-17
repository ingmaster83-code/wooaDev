TK.tool('csr-tool', {
  inputs: [
    { id: 'in', label: ['CSR (PEM 또는 16진수/Base64 DER)', 'CSR (PEM, or hex / Base64 DER)'], rows: 12, sample: '-----BEGIN CERTIFICATE REQUEST-----\nMIICgjCCAWoCAQAwPTELMAkGA1UEBhMCS1IxFzAVBgNVBAoMDldvb2FIb3VzZSBU\nZXN0MRUwEwYDVQQDDAx0ZXN0LmV4YW1wbGUwggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQCrecHqmweqRQSUYzWSqAt0yN8JRX06KBbirYnhhcO1aThn4QZ3\nLbTUEEk6c5qm9xbIJprqzRD51X33qEfnZRzR2wwfGIPmKo5pKavxq8+VVJwxn0ls\nzZ/wtgK8nXpfE0HeGU+KX89A5MllI5CUxYREvYBC0hh4ByteLEbpmOmNL0UPtdLR\n8vitA/dfDaJltrFgmf7r2FNiUfpItoepp00J/1UU5XMDG/f86nGykDd3etyk1I0q\nHpNv2hn2/N5W17T6dA9bDUFOe9p6rIEWYL02R90fF0hxHNYn3/6DTe/fIT+txTpp\ncinfR0eJJ4WIeGVT38upkEWqLllJUDe9xL01AgMBAAGgADANBgkqhkiG9w0BAQsF\nAAOCAQEAkEfmIkp7bBPXbBi4SJSr8QuX0QYqt3irDQdWE0XEIcSltW7AzVbd2bVD\ntYO2rXpL6fvb5jBgLK6VkSotULlgdH3GIokOHaox4yrW6W/NWbliut9HC5g3yo3P\nLr5k8VdsrVur38EdTNjHKxjOoBuMChpdUlbc8ME6GKZGWHqNaLamz7K8pujXoZkZ\nMjvd8KmNfaZgg+yqqKLhelH3NxOElPYFUi6x/xvb/dR4g0QRK4z7uGp7g/KA8Z9A\nrptDoNlr/dMUvZ8LjFzQz8zsMgfyKx4AOLCXWGmu2mJmSQj2/IVBxGIVQXGk4svT\nGfUhnVr4sRZVxpl5svRyr94WYPa8Lg==\n-----END CERTIFICATE REQUEST-----', show: function (o) { return o.dir === 'dec'; } },
    { id: 'san', label: ['SAN (한 줄에 하나: 도메인, *.도메인, IP, 이메일)', 'SAN entries (one per line: domain, *.domain, IP, email)'], rows: 4, sample: 'example.com\nwww.example.com\n*.example.com\n192.0.2.10', show: function (o) { return o.dir === 'gen'; } }
  ],
  options: [
    { id: 'dir', type: 'select', label: ['동작', 'Action'], choices: [['dec', ['CSR 해석·검증', 'Decode & verify a CSR']], ['gen', ['새 CSR + 개인키 만들기', 'Generate a CSR + private key']]], default: 'dec' },
    { id: 'cn', type: 'text', label: ['Common Name (CN)', 'Common Name (CN)'], default: 'example.com', show: function (o) { return o.dir === 'gen'; } },
    { id: 'org', type: 'text', label: ['조직 (O)', 'Organization (O)'], default: '', show: function (o) { return o.dir === 'gen'; } },
    { id: 'ou', type: 'text', label: ['부서 (OU)', 'Organizational unit (OU)'], default: '', show: function (o) { return o.dir === 'gen'; } },
    { id: 'c', type: 'text', label: ['국가 코드 (C, 2글자)', 'Country (C, 2 letters)'], default: '', show: function (o) { return o.dir === 'gen'; } },
    { id: 'st', type: 'text', label: ['시·도 (ST)', 'State / province (ST)'], default: '', show: function (o) { return o.dir === 'gen'; } },
    { id: 'l', type: 'text', label: ['시·군·구 (L)', 'Locality (L)'], default: '', show: function (o) { return o.dir === 'gen'; } },
    { id: 'email', type: 'text', label: ['이메일', 'Email'], default: '', show: function (o) { return o.dir === 'gen'; } },
    { id: 'kt', type: 'select', label: ['키 종류', 'Key type'], choices: [['rsa2048', 'RSA 2048'], ['rsa3072', 'RSA 3072'], ['rsa4096', ['RSA 4096 (생성에 몇 초 걸림)', 'RSA 4096 (takes a few seconds)']], ['ec256', 'ECDSA P-256'], ['ec384', 'ECDSA P-384']], default: 'ec256', show: function (o) { return o.dir === 'gen'; } }
  ],
  outputs: [{ id: 'table', label: ['CSR 내용', 'CSR contents'], kind: 'table' }, { id: 'csr', label: ['CSR (PEM)', 'CSR (PEM)'], kind: 'code', ext: 'csr' }, { id: 'key', label: ['개인키 (PKCS#8 PEM) — 절대 공유 금지', 'Private key (PKCS#8 PEM) — never share'], kind: 'code', ext: 'key' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var X = TK.x509, E = X.enc, N = TK.binin, issues = [];
    if (o.dir === 'gen') {
      var cn = String(o.cn || '').trim(); if (!cn) throw new Error(t('Common Name 을 입력하세요', 'Enter a Common Name'));
      var c2 = String(o.c || '').trim().toUpperCase(); if (c2 && !/^[A-Z]{2}$/.test(c2)) throw new Error(t('국가 코드는 영문 2글자여야 합니다 (예: KR)', 'Country must be two letters (e.g. KR)'));
      var subtle = (window.crypto || globalThis.crypto).subtle; if (!subtle) throw new Error(t('Web Crypto 를 쓸 수 없습니다. HTTPS 로 접속하세요', 'Web Crypto is unavailable; use HTTPS'));
      var sans = String(v.san || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      function ip6(s) { var h = s.split('::'); if (h.length > 2) return null; var a = h[0] ? h[0].split(':') : [], b = h.length === 2 && h[1] ? h[1].split(':') : []; var fill = 8 - a.length - b.length; if ((h.length === 1 && a.length !== 8) || fill < 0) return null; var all = a.concat(new Array(h.length === 2 ? fill : 0).fill('0')).concat(b), out = []; for (var i = 0; i < all.length; i++) { if (!/^[0-9a-fA-F]{1,4}$/.test(all[i])) return null; var x = parseInt(all[i], 16); out.push(x >> 8, x & 255); } return out.length === 16 ? out : null; }
      var gnames = sans.map(function (s) {
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) { var p = s.split('.').map(Number); if (p.some(function (x) { return x > 255; })) throw new Error(t('올바르지 않은 IP: ', 'Invalid IP: ') + s); return E.tlv(0x87, p); }
        if (s.indexOf(':') >= 0 && /^[0-9a-fA-F:]+$/.test(s)) { var b = ip6(s); if (!b) throw new Error(t('올바르지 않은 IPv6: ', 'Invalid IPv6: ') + s); return E.tlv(0x87, b); }
        if (/^[^@\s]+@[^@\s]+$/.test(s)) return E.tlv(0x81, new TextEncoder().encode(s));
        if (!/^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(s)) throw new Error(t('SAN 형식이 올바르지 않습니다: ', 'Invalid SAN entry: ') + s);
        return E.tlv(0x82, new TextEncoder().encode(s.toLowerCase()));
      });
      var kt = o.kt, isRsa = kt.indexOf('rsa') === 0, hash = kt === 'ec384' ? 'SHA-384' : 'SHA-256';
      var gen = isRsa ? { name: 'RSASSA-PKCS1-v1_5', modulusLength: parseInt(kt.slice(3), 10), publicExponent: new Uint8Array([1, 0, 1]), hash: hash } : { name: 'ECDSA', namedCurve: kt === 'ec384' ? 'P-384' : 'P-256' };
      var rdn = function (oid, val, printable) { return E.set(E.seq(E.oid(oid), printable ? E.printable(val) : E.utf8(val))); };
      var parts = [];
      if (c2) parts.push(rdn('2.5.4.6', c2, true));
      if (o.st && o.st.trim()) parts.push(rdn('2.5.4.8', o.st.trim()));
      if (o.l && o.l.trim()) parts.push(rdn('2.5.4.7', o.l.trim()));
      if (o.org && o.org.trim()) parts.push(rdn('2.5.4.10', o.org.trim()));
      if (o.ou && o.ou.trim()) parts.push(rdn('2.5.4.11', o.ou.trim()));
      parts.push(rdn('2.5.4.3', cn));
      if (o.email && o.email.trim()) parts.push(E.set(E.seq(E.oid('1.2.840.113549.1.9.1'), E.ia5(o.email.trim()))));
      var subject = E.seq.apply(null, parts);
      return subtle.generateKey(gen, true, ['sign', 'verify']).then(function (kp) {
        return Promise.all([subtle.exportKey('spki', kp.publicKey), subtle.exportKey('pkcs8', kp.privateKey)]).then(function (ex) {
          var spki = new Uint8Array(ex[0]), pkcs8 = new Uint8Array(ex[1]);
          var attrs = sans.length ? E.ctx(0, E.seq(E.oid('1.2.840.113549.1.9.14'), E.set(E.seq(E.seq(E.oid('2.5.29.17'), E.octet(E.seq.apply(null, gnames))))))) : E.ctx(0, new Uint8Array(0));
          var info = E.seq(E.int(0), subject, spki, attrs);
          var signAlg = isRsa ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'ECDSA', hash: hash };
          return subtle.sign(signAlg, kp.privateKey, info).then(function (sigBuf) {
            var sig = new Uint8Array(sigBuf);
            var algId = isRsa ? E.seq(E.oid('1.2.840.113549.1.1.11'), E.nul()) : E.seq(E.oid(kt === 'ec384' ? '1.2.840.10045.4.3.3' : '1.2.840.10045.4.3.2'));
            var csr = E.seq(info, algId, E.bits(isRsa ? sig : E.ecSig(sig)));
            var parsed = X.parseCsr(csr);
            issues.push(t('개인키는 이 브라우저 안에서 만들어졌고 어디로도 전송되지 않습니다. 이 페이지를 닫으면 사라지니 지금 복사해 안전한 곳에 보관하세요', 'The private key was generated inside this browser and never sent anywhere. It disappears when you close the page, so copy it to a safe place now'));
            issues.push(t('CSR 만 인증기관(CA)에 제출하세요. 개인키(-----BEGIN PRIVATE KEY-----)는 제출하거나 공유하면 안 됩니다', 'Submit only the CSR to the CA; never submit or share the private key (-----BEGIN PRIVATE KEY-----)'));
            if (!sans.length) issues.push(t('⚠️ SAN 이 없습니다. 최신 브라우저는 CN 만으로는 호스트를 인정하지 않으므로 도메인을 SAN 에 넣으세요', '⚠️ No SAN: modern browsers ignore the CN, so list the domains in SAN'));
            else if (!sans.some(function (s) { return s.toLowerCase() === cn.toLowerCase(); }) && /\./.test(cn)) issues.push(t('ℹ️ CN(' + cn + ')이 SAN 목록에 없습니다. 대부분의 CA 는 CN 을 SAN 에 자동 포함시키지만 직접 넣는 것이 안전합니다', 'ℹ️ The CN (' + cn + ') is not in the SAN list; most CAs add it automatically but listing it is safest'));
            return { _status: t('✅ CSR 을 만들었습니다 (' + (isRsa ? 'RSA ' + kt.slice(3) : kt === 'ec384' ? 'P-384' : 'P-256') + ')', '✅ CSR generated (' + (isRsa ? 'RSA ' + kt.slice(3) : kt === 'ec384' ? 'P-384' : 'P-256') + ')'), table: { head: [['항목', 'Field'], ['값', 'Value']], rows: [[t('주체', 'Subject'), parsed.subject.str], ['SAN', sans.join(', ') || t('(없음)', '(none)')], [t('공개키', 'Public key'), parsed.key.alg + ' ' + (parsed.key.curve || parsed.key.bits + ' bit')], [t('서명 알고리즘', 'Signature algorithm'), parsed.sigAlg]] }, csr: X.toPem('CERTIFICATE REQUEST', csr), key: X.toPem('PRIVATE KEY', pkcs8), issues: issues };
          });
        });
      });
    }
    /* 해석 */
    var txt = String(v['in'] || ''); if (!txt.trim()) throw new Error(t('CSR 을 입력하세요', 'Enter a CSR'));
    var der;
    if (/-----BEGIN /.test(txt)) {
      var bl = X.pemBlocks(txt).filter(function (b) { return /REQUEST/.test(b.label) && b.der; })[0];
      if (!bl) throw new Error(t('CERTIFICATE REQUEST PEM 블록을 찾지 못했습니다', 'No CERTIFICATE REQUEST PEM block found'));
      der = bl.der;
    } else der = N.get({ 'in': txt }, { mode: 'text', fmt: 'auto' }).bytes;
    var csr = X.parseCsr(der);
    var san = csr.ext('2.5.29.17'), ku = csr.ext('2.5.29.15'), eku = csr.ext('2.5.29.37'), bc = csr.ext('2.5.29.19');
    return Promise.all([X.verify(csr, csr), X.digest('SHA-256', csr.der)]).then(function (res) {
      var vr = res[0], keyDesc = csr.key.alg === 'RSA' ? 'RSA ' + csr.key.bits + ' bit (e=' + csr.key.exponent + ')' : csr.key.alg === 'EC' ? 'EC ' + csr.key.curve : csr.key.name;
      var rows = [[t('주체', 'Subject'), csr.subject.str || t('(비어 있음)', '(empty)')], [t('버전', 'Version'), 'v' + csr.version], [t('공개키', 'Public key'), keyDesc], [t('서명 알고리즘', 'Signature algorithm'), csr.sigAlg], [t('서명 검증', 'Signature check'), vr.ok === true ? t('✅ CSR 의 공개키로 검증됨 (개인키 소유 증명)', '✅ Verified with the CSR public key (proof of possession)') : vr.ok === false ? '⛔ ' + vr.reason : '❔ ' + vr.reason]];
      if (san) rows.push(['SAN', san.text]); else rows.push(['SAN', t('(없음)', '(none)')]);
      if (ku) rows.push(['Key Usage', ku.text]); if (eku) rows.push(['Extended Key Usage', eku.text]); if (bc) rows.push(['Basic Constraints', bc.text]);
      csr.exts.forEach(function (e) { if (['2.5.29.17', '2.5.29.15', '2.5.29.37', '2.5.29.19'].indexOf(e.oid) < 0) rows.push([t('요청 확장: ', 'Requested extension: ') + e.name, e.text]); });
      rows.push([t('요청 속성', 'Attributes'), csr.attrs.join(', ') || t('(없음)', '(none)')]); rows.push(['SHA-256 ' + t('지문', 'fingerprint'), res[1]]);
      if (vr.ok === false) issues.push('⛔ ' + t('CSR 서명이 올바르지 않습니다. CSR 이 변조됐거나 손상되었습니다', 'The CSR signature is invalid: it was altered or corrupted'));
      if (!san) issues.push('⚠️ ' + t('SAN 이 없습니다. 최신 브라우저는 CN 만으로는 호스트를 인정하지 않습니다', 'No SAN: modern browsers ignore the CN for hostname matching'));
      if (csr.key.alg === 'RSA' && csr.key.bits < 2048) issues.push('⚠️ ' + t('RSA 키가 ' + csr.key.bits + '비트입니다. 2048 이상이어야 대부분의 CA 가 발급합니다', 'RSA key is ' + csr.key.bits + ' bits; most CAs require 2048+'));
      if (/md5|sha1/i.test(csr.sigAlg) && !/^sha1$/.test(csr.sigAlg)) issues.push('⚠️ ' + t('약한 서명 알고리즘(' + csr.sigAlg + ')입니다', 'Weak signature algorithm (' + csr.sigAlg + ')'));
      if (!csr.subject.parts.some(function (p) { return p[0] === 'CN'; }) && !san) issues.push('⚠️ ' + t('CN 도 SAN 도 없어 어떤 도메인용인지 알 수 없습니다', 'Neither CN nor SAN: the target domain is unknown'));
      if (bc && bc.ca) issues.push('ℹ️ ' + t('CA 인증서를 요청하는 CSR 입니다 (Basic Constraints CA:TRUE)', 'This CSR requests a CA certificate (Basic Constraints CA:TRUE)'));
      issues.push(t('CSR 에 들어 있는 확장은 요청일 뿐이며 CA 가 무시하거나 바꿀 수 있습니다', 'Extensions in a CSR are only requests; the CA may ignore or change them'));
      var bad = vr.ok === false;
      return { _status: { ok: bad ? false : true, msg: bad ? t('⛔ CSR 서명 불일치', '⛔ CSR signature mismatch') : t('✅ CSR 해석 완료', '✅ CSR decoded') }, table: { head: [['항목', 'Field'], ['값', 'Value']], rows: rows }, csr: '', key: '', issues: issues };
    });
  }
});
