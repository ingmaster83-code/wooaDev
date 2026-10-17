TK.tool('jwk-converter', {
  inputs: [{ id: 'in', label: ['JWK / JWKS (JSON) 또는 PEM', 'JWK / JWKS (JSON) or PEM'], rows: 12, sample: '{\n  "keys": [\n    {\n      "kty": "EC",\n      "crv": "P-256",\n      "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",\n      "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",\n      "kid": "ec-demo",\n      "use": "sig"\n    },\n    {\n      "kty": "OKP",\n      "crv": "Ed25519",\n      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",\n      "kid": "ed-demo"\n    }\n  ]\n}' }],
  options: [
    { id: 'kid', type: 'text', label: ['kid 로 한 개만 선택 (JWKS 일 때, 선택)', 'Select one key by kid (for a JWKS, optional)'], default: '' },
    { id: 'addkid', type: 'checkbox', label: ['PEM → JWK 때 kid 에 RFC 7638 지문 넣기', 'For PEM → JWK, set kid to the RFC 7638 thumbprint'], default: true },
    { id: 'use', type: 'select', label: ['PEM → JWK 때 use', 'use for PEM → JWK'], choices: [['', ['넣지 않음', 'Omit']], ['sig', 'sig'], ['enc', 'enc']], default: '' },
    { id: 'alg', type: 'text', label: ['PEM → JWK 때 alg (예: RS256, ES256, EdDSA, 선택)', 'alg for PEM → JWK (e.g. RS256, ES256, EdDSA, optional)'], default: '' }
  ],
  outputs: [{ id: 'table', label: ['키 정보', 'Key info'], kind: 'table' }, { id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var X = TK.x509, A = TK.asn1, H = TK.hash, E = X.enc, issues = [];
    var subtle = (window.crypto || globalThis.crypto).subtle; if (!subtle) throw new Error(t('Web Crypto 를 쓸 수 없습니다. HTTPS 로 접속하세요', 'Web Crypto is unavailable; use HTTPS'));
    var src = String(v['in'] || '').trim(); if (!src) throw new Error(t('JWK 또는 PEM 을 입력하세요', 'Enter a JWK or PEM'));
    function thumbInput(j) {
      if (j.kty === 'RSA') return { e: j.e, kty: 'RSA', n: j.n };
      if (j.kty === 'EC') return { crv: j.crv, kty: 'EC', x: j.x, y: j.y };
      if (j.kty === 'OKP') return { crv: j.crv, kty: 'OKP', x: j.x };
      if (j.kty === 'oct') return { k: j.k, kty: 'oct' };
      return null;
    }
    function thumb(j) { var ti = thumbInput(j); if (!ti) return Promise.resolve(''); return H.sha('SHA-256', H.utf8(JSON.stringify(ti))).then(function (d) { return H.b64url(d); }); }
    function importAlgo(j) {
      if (j.kty === 'RSA') return { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
      if (j.kty === 'EC') return { name: 'ECDSA', namedCurve: j.crv };
      if (j.kty === 'OKP') return { name: j.crv === 'X25519' ? 'X25519' : j.crv === 'Ed448' ? 'Ed448' : 'Ed25519' };
      return null;
    }
    function clean(j) { var c = {}; Object.keys(j).forEach(function (k) { if (['alg', 'use', 'key_ops', 'ext', 'kid', 'x5c', 'x5t', 'x5t#S256', 'x5u'].indexOf(k) < 0) c[k] = j[k]; }); return c; }
    function lines64(b) { var l = []; for (var i = 0; i < b.length; i += 64) l.push(b.slice(i, i + 64)); return l.join('\n'); }
    function sizeOf(j) { if (j.kty === 'RSA') return 'RSA ' + A.bitLength(H.fromB64(j.n)) + ' bit'; if (j.kty === 'EC') return 'EC ' + j.crv; if (j.kty === 'OKP') return 'OKP ' + j.crv; if (j.kty === 'oct') return 'oct ' + (H.fromB64(j.k).length * 8) + ' bit'; return j.kty; }
    var usageFor = function (j, priv) { if (j.kty === 'OKP' && j.crv === 'X25519') return priv ? ['deriveBits'] : []; return priv ? ['sign'] : ['verify']; };

    if (src.charAt(0) === '{' || src.charAt(0) === '[') {
      /* JWK / JWKS → PEM */
      var data; try { data = JSON.parse(src); } catch (e) { throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); }
      var keys = Array.isArray(data) ? data : data && Array.isArray(data.keys) ? data.keys : [data];
      if (!keys.length || !keys[0] || typeof keys[0] !== 'object') throw new Error(t('JWK 가 없습니다', 'No JWK found'));
      if (o.kid && String(o.kid).trim()) { keys = keys.filter(function (k) { return k.kid === String(o.kid).trim(); }); if (!keys.length) throw new Error(t('kid "' + o.kid + '" 인 키가 없습니다', 'No key with kid "' + o.kid + '"')); }
      if (keys.length > 50) { keys = keys.slice(0, 50); issues.push(t('키는 처음 50개만 변환합니다', 'Only the first 50 keys are converted')); }
      return Promise.all(keys.map(function (j, idx) {
        if (!j || typeof j.kty !== 'string') return Promise.resolve({ idx: idx, error: t('kty 필드가 없습니다', 'Missing kty') });
        var priv = !!j.d, algo = importAlgo(j);
        return thumb(j).then(function (tp) {
          var base = { idx: idx, j: j, kid: j.kid || '', tp: tp, size: '', priv: priv };
          try { base.size = sizeOf(j); } catch (e) { base.size = j.kty; }
          if (j.kty === 'oct') { base.note = t('대칭키(oct)는 PEM 이 없습니다. k 값은 Base64URL 입니다', 'Symmetric (oct) keys have no PEM; k is Base64URL'); return base; }
          if (!algo) { base.error = t('지원하지 않는 kty: ', 'Unsupported kty: ') + j.kty; return base; }
          var c = clean(j), pubJwk = clean(j); delete pubJwk.d; delete pubJwk.p; delete pubJwk.q; delete pubJwk.dp; delete pubJwk.dq; delete pubJwk.qi; delete pubJwk.oth;
          var tasks = [subtle.importKey('jwk', pubJwk, algo, true, usageFor(j, false)).then(function (k) { return subtle.exportKey('spki', k); }).then(function (b) { base.spki = new Uint8Array(b); })];
          if (priv) tasks.push(subtle.importKey('jwk', c, algo, true, usageFor(j, true)).then(function (k) { return subtle.exportKey('pkcs8', k); }).then(function (b) { base.pkcs8 = new Uint8Array(b); }));
          return Promise.all(tasks).then(function () { return base; }, function (e) { base.error = t('변환 실패: ', 'Conversion failed: ') + (e && e.message || e); return base; });
        });
      })).then(function (res) {
        var rows = [], out = [];
        res.forEach(function (r) {
          var j = r.j || {}, n = res.length > 1 ? '#' + (r.idx + 1) + ' ' : '';
          rows.push([String(r.idx + 1), j.kty || '?', r.size || '', j.alg || '—', j.use || '—', r.kid || '—', r.tp || '—', r.error ? '⛔ ' + r.error : r.priv ? t('🔒 개인키 포함', '🔒 private') : t('공개키', 'public')]);
          if (r.error) { issues.push('⛔ ' + n + r.error); return; }
          if (r.note) { issues.push('ℹ️ ' + n + r.note); return; }
          out.push('# ' + n + (r.kid || r.tp) + ' (' + r.size + ')\n' + X.toPem('PUBLIC KEY', r.spki));
          if (r.pkcs8) { out.push(X.toPem('PRIVATE KEY', r.pkcs8)); issues.push('⛔ ' + n + t('개인키(d)가 들어 있습니다. 개인키는 어디에도 공유하지 마세요', 'contains a private key (d); never share private keys')); }
          if (j.use === 'enc' && j.kty === 'OKP' && j.crv === 'Ed25519') issues.push('⚠️ ' + n + t('Ed25519 는 서명용입니다 (use: enc 와 맞지 않음)', 'Ed25519 is a signature key (conflicts with use: enc)'));
          if (j.kty === 'RSA' && A.bitLength(H.fromB64(j.n)) < 2048) issues.push('⚠️ ' + n + t('RSA 키가 2048비트보다 짧습니다', 'RSA key is shorter than 2048 bits'));
          if (!r.kid) issues.push('ℹ️ ' + n + t('kid 가 없습니다. JWKS 에서는 kid 로 키를 고르므로 지문(RFC 7638)을 kid 로 쓰는 것을 권장합니다', 'No kid; a JWKS selects keys by kid, so using the RFC 7638 thumbprint is recommended'));
        });
        issues.push(t('지문(thumbprint)은 RFC 7638 규칙(필수 필드를 사전순 JSON 으로 만든 SHA-256, Base64URL)으로 계산합니다', 'The thumbprint follows RFC 7638 (SHA-256 of the required members as lexicographic JSON, Base64URL)'));
        var bad = issues.filter(function (x) { return x.indexOf('⛔') === 0 && x.indexOf('개인키') < 0 && x.indexOf('private key') < 0; }).length;
        return { _status: { ok: bad ? false : true, msg: bad ? t('⛔ 변환 실패가 있습니다', '⛔ Some keys failed') : t('✅ 키 ' + res.length + '개를 PEM 으로 변환', '✅ Converted ' + res.length + ' key(s) to PEM') }, table: { head: [['#', '#'], ['kty', 'kty'], ['크기', 'Size'], ['alg', 'alg'], ['use', 'use'], ['kid', 'kid'], ['지문 (RFC 7638)', 'Thumbprint (RFC 7638)'], ['상태', 'State']], rows: rows }, out: out.join('\n\n'), issues: issues };
      });
    }
    /* PEM → JWK */
    var blocks = X.pemBlocks(src).filter(function (b) { return b.der; });
    if (!blocks.length) throw new Error(t('JSON(JWK) 도 PEM 도 아닙니다', 'Neither JSON (JWK) nor PEM'));
    function pkcs1ToSpki(der) { return E.seq(E.seq(E.oid('1.2.840.113549.1.1.1'), E.nul()), E.bits(der)); }
    function pkcs1ToPkcs8(der) { return E.seq(E.int(0), E.seq(E.oid('1.2.840.113549.1.1.1'), E.nul()), E.octet(der)); }
    function sec1ToPkcs8(der) {
      var n = A.parse(der, 0), curve = n.children.filter(function (c) { return c.cls === 2 && c.tag === 0; })[0];
      if (!curve) throw new Error(t('EC PRIVATE KEY 에 곡선 정보가 없습니다', 'EC PRIVATE KEY has no curve parameters'));
      var oidNode = curve.children[0];
      return E.seq(E.int(0), E.seq(E.oid('1.2.840.10045.2.1'), der.subarray(oidNode.start, oidNode.end)), E.octet(der));
    }
    var jobs = blocks.slice(0, 20).map(function (b) {
      var label = b.label, der = b.der, kind, spki, pkcs8;
      try {
        if (label === 'CERTIFICATE') { var cert = X.parseCert(der); spki = cert.spkiBytes; kind = t('인증서의 공개키', 'Certificate public key'); }
        else if (label === 'PUBLIC KEY') { spki = der; kind = t('공개키 (SPKI)', 'Public key (SPKI)'); }
        else if (label === 'RSA PUBLIC KEY') { spki = pkcs1ToSpki(der); kind = t('RSA 공개키 (PKCS#1)', 'RSA public key (PKCS#1)'); }
        else if (label === 'PRIVATE KEY') { pkcs8 = der; kind = t('개인키 (PKCS#8)', 'Private key (PKCS#8)'); }
        else if (label === 'RSA PRIVATE KEY') { pkcs8 = pkcs1ToPkcs8(der); kind = t('RSA 개인키 (PKCS#1)', 'RSA private key (PKCS#1)'); }
        else if (label === 'EC PRIVATE KEY') { pkcs8 = sec1ToPkcs8(der); kind = t('EC 개인키 (SEC1)', 'EC private key (SEC1)'); }
        else if (/ENCRYPTED/.test(label)) return Promise.resolve({ label: label, error: t('암호화된 개인키는 복호화 후에 변환할 수 있습니다 (openssl pkey -in key.pem -out plain.pem)', 'Encrypted private keys must be decrypted first (openssl pkey -in key.pem -out plain.pem)') });
        else return Promise.resolve({ label: label, error: t('지원하지 않는 PEM 종류', 'Unsupported PEM type') });
      } catch (e) { return Promise.resolve({ label: label, error: e.message }); }
      var info; try { info = spki ? A.spki(spki) : (function () { var r = A.parse(pkcs8, 0), ai = r.children[1], oid = A.oid(ai.children[0].value); return { oid: oid, curveOid: ai.children[1] && ai.children[1].tag === 6 ? A.oid(ai.children[1].value) : '' }; })(); } catch (e) { return Promise.resolve({ label: label, error: e.message }); }
      var oid = info.oid, curve = info.curveOid || '', algo;
      if (oid === '1.2.840.113549.1.1.1') algo = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
      else if (oid === '1.2.840.10045.2.1') { var cv = info.curve || '', cn = spki ? (/P-256/.test(cv) ? 'P-256' : /P-384/.test(cv) ? 'P-384' : /P-521/.test(cv) ? 'P-521' : null) : ({ '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521' }[curve] || null); if (!cn) return Promise.resolve({ label: label, error: t('지원하지 않는 곡선', 'Unsupported curve') + ' ' + (cv || curve) }); algo = { name: 'ECDSA', namedCurve: cn }; }
      else if (oid === '1.3.101.112') algo = { name: 'Ed25519' };
      else if (oid === '1.3.101.110') algo = { name: 'X25519' };
      else return Promise.resolve({ label: label, error: t('지원하지 않는 키 알고리즘: ', 'Unsupported key algorithm: ') + (A.OIDS[oid] || oid) });
      var isPriv = !!pkcs8, usages = isPriv ? (algo.name === 'X25519' ? ['deriveBits'] : ['sign']) : (algo.name === 'X25519' ? [] : ['verify']);
      return subtle.importKey(isPriv ? 'pkcs8' : 'spki', isPriv ? pkcs8 : spki, algo, true, usages).then(function (k) { return subtle.exportKey('jwk', k); }).then(function (jwk) {
        var j = {}; Object.keys(jwk).forEach(function (k2) { if (['key_ops', 'ext', 'alg', 'use'].indexOf(k2) < 0) j[k2] = jwk[k2]; });
        return { label: label, kind: kind, jwk: j, priv: isPriv };
      }, function (e) { return { label: label, error: t('가져오기 실패: ', 'Import failed: ') + (e && e.message || e) }; });
    });
    return Promise.all(jobs).then(function (res) {
      return Promise.all(res.map(function (r) { return r.jwk ? thumb(r.jwk) : Promise.resolve(''); })).then(function (tps) {
        var rows = [], jwks = [];
        res.forEach(function (r, i) {
          if (r.error) { rows.push([String(i + 1), r.label, '—', '—', '⛔ ' + r.error]); issues.push('⛔ ' + r.label + ': ' + r.error); return; }
          var j = r.jwk; if (o.addkid) j.kid = tps[i]; else delete j.kid;
          if (o.use) j.use = o.use; if (o.alg && String(o.alg).trim()) j.alg = String(o.alg).trim();
          var order = ['kty', 'crv', 'alg', 'use', 'kid'], j2 = {}; order.forEach(function (k) { if (j[k] !== undefined) j2[k] = j[k]; }); Object.keys(j).forEach(function (k) { if (j2[k] === undefined) j2[k] = j[k]; });
          jwks.push(j2); rows.push([String(i + 1), r.label, sizeOf(r.jwk), tps[i], r.kind + (r.priv ? ' 🔒' : '')]);
          if (r.priv) issues.push('⛔ ' + t('개인키 JWK(d 포함)가 만들어졌습니다. 공개 JWKS 에는 개인키를 넣지 말고 공개키만 게시하세요', 'A private JWK (with d) was produced; publish only public keys in a JWKS'));
        });
        if (!jwks.length) throw new Error(res.map(function (r) { return r.error; }).filter(Boolean)[0] || t('변환할 키가 없습니다', 'Nothing to convert'));
        var outTxt = jwks.length === 1 ? JSON.stringify(jwks[0], null, 2) : JSON.stringify({ keys: jwks }, null, 2);
        issues.push(t('alg·use 는 키 자체에 들어 있는 정보가 아니라 사용 방식의 선언입니다. JWT 검증 라이브러리가 alg 를 확인하므로 정확히 지정하세요', 'alg and use are declarations about usage, not part of the key; JWT libraries check alg, so set it precisely'));
        var bad = issues.filter(function (x) { return x.indexOf('⛔') === 0 && x.indexOf('개인키 JWK') < 0 && x.indexOf('private JWK') < 0; }).length;
        return { _status: { ok: bad ? false : true, msg: bad ? t('⛔ 일부 변환 실패', '⛔ Some conversions failed') : t('✅ PEM ' + jwks.length + '개를 JWK 로 변환', '✅ Converted ' + jwks.length + ' PEM block(s) to JWK') }, table: { head: [['#', '#'], ['PEM 종류', 'PEM type'], ['크기', 'Size'], ['지문 (RFC 7638)', 'Thumbprint (RFC 7638)'], ['내용', 'Contents']], rows: rows }, out: outTxt, issues: issues };
      });
    });
  }
});
