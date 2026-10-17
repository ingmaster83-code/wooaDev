/* WooaDev Tool Kit — X.509 인증서·CSR 파서, 서명 검증, DER 인코더 (tk-asn1.js, tk-hash.js 필요) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var X = TK.x509 = TK.x509 || {};
  var A = TK.asn1, H = TK.hash;
  var t = function (a, b) { return TK.t(a, b); };

  var EXTRA = {
    '1.2.840.113549.1.1.2': 'md2WithRSAEncryption', '1.2.840.113549.1.1.4': 'md5WithRSAEncryption', '1.2.840.113549.1.1.10': 'rsassaPss', '1.2.840.113549.1.1.8': 'mgf1', '1.2.840.113549.1.1.7': 'rsaesOaep',
    '1.2.840.10040.4.3': 'dsaWithSha1', '1.2.840.10045.4.1': 'ecdsa-with-SHA1', '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512', '1.2.840.10045.3.1.1': 'prime192v1 (P-192)', '1.3.132.0.10': 'secp256k1',
    '1.2.840.113549.1.9.1': 'emailAddress', '1.2.840.113549.1.9.14': 'extensionRequest', '1.2.840.113549.1.9.7': 'challengePassword', '2.5.4.9': 'streetAddress', '2.5.4.12': 'title', '2.5.4.4': 'surname', '2.5.4.42': 'givenName', '2.5.4.15': 'businessCategory', '2.5.4.17': 'postalCode', '0.9.2342.19200300.100.1.25': 'domainComponent (DC)', '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionCountry', '1.3.6.1.4.1.311.60.2.1.2': 'jurisdictionState', '1.3.6.1.4.1.311.60.2.1.1': 'jurisdictionLocality', '2.5.4.97': 'organizationIdentifier',
    '2.5.29.9': 'subjectDirectoryAttributes', '2.5.29.16': 'privateKeyUsagePeriod', '2.5.29.18': 'issuerAltName', '2.5.29.30': 'nameConstraints', '2.5.29.33': 'policyMappings', '2.5.29.36': 'policyConstraints', '2.5.29.46': 'freshestCRL', '2.5.29.54': 'inhibitAnyPolicy',
    '1.3.6.1.5.5.7.1.1': 'authorityInfoAccess', '1.3.6.1.5.5.7.1.12': 'logotype', '1.3.6.1.5.5.7.1.24': 'tlsFeature (OCSP Must-Staple)', '1.3.6.1.4.1.11129.2.4.3': 'CT poison', '1.3.6.1.5.5.7.3.8': 'timeStamping', '1.3.6.1.5.5.7.3.9': 'OCSPSigning', '2.5.29.37.0': 'anyExtendedKeyUsage', '1.3.6.1.4.1.311.10.3.4': 'EFS', '1.3.6.1.5.5.7.3.5': 'ipsecEndSystem',
    '2.23.140.1.2.1': 'CA/B DV (domain validated)', '2.23.140.1.2.2': 'CA/B OV (organization validated)', '2.23.140.1.2.3': 'CA/B IV (individual validated)', '2.23.140.1.1': 'CA/B EV (extended validation)', '2.5.29.32.0': 'anyPolicy',
    '1.3.14.3.2.26': 'sha1', '2.16.840.1.101.3.4.2.1': 'sha256', '2.16.840.1.101.3.4.2.2': 'sha384', '2.16.840.1.101.3.4.2.3': 'sha512'
  };
  Object.keys(EXTRA).forEach(function (k) { if (!A.OIDS[k]) A.OIDS[k] = EXTRA[k]; });
  var oidName = function (o) { return A.OIDS[o] || o; };

  var SHORT = { '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.5': 'serialNumber', '2.5.4.9': 'street', '1.2.840.113549.1.9.1': 'emailAddress', '0.9.2342.19200300.100.1.25': 'DC', '2.5.4.97': 'organizationIdentifier', '2.5.4.15': 'businessCategory', '2.5.4.4': 'SN', '2.5.4.42': 'GN', '2.5.4.12': 'title', '2.5.4.17': 'postalCode', '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionC', '1.3.6.1.4.1.311.60.2.1.2': 'jurisdictionST', '1.3.6.1.4.1.311.60.2.1.1': 'jurisdictionL' };
  X.short = SHORT;

  X.pemBlocks = function (text) {
    var out = [], re = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g, m;
    while ((m = re.exec(text))) {
      var body = m[2].replace(/^[A-Za-z0-9-]+:.*$/mg, '').replace(/\s+/g, '');
      try { out.push({ label: m[1], der: H.fromB64(body) }); } catch (e) { out.push({ label: m[1], der: null, error: e.message }); }
    }
    return out;
  };
  X.toPem = function (label, der) { var b = H.b64(der), l = []; for (var i = 0; i < b.length; i += 64) l.push(b.slice(i, i + 64)); return '-----BEGIN ' + label + '-----\n' + l.join('\n') + '\n-----END ' + label + '-----'; };

  /** Name 노드 → {str, parts:[[short, value]], key} */
  X.name = function (node, u8) {
    var parts = [];
    if (node && node.children) node.children.forEach(function (set) { set.children.forEach(function (atv) {
      var oid = A.oid(atv.children[0].value), val = A.str(atv.children[1]);
      parts.push([SHORT[oid] || oid, val, oid]);
    }); });
    return { str: parts.map(function (p) { return p[0] + '=' + p[1]; }).join(', '), parts: parts, key: u8 ? H.hex(u8.subarray(node.start, node.end)) : '' };
  };

  function bitString(node) { var v = node.value; return { unused: v[0], bytes: v.subarray(1) }; }
  function hexColon(u8) { return Array.prototype.map.call(u8, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(':').toUpperCase(); }
  X.hexColon = hexColon;

  function generalName(n) {
    if (n.cls !== 2) return { type: '?', value: H.hex(n.value) };
    var v = n.value;
    switch (n.tag) {
      case 1: return { type: 'email', value: new TextDecoder().decode(v) };
      case 2: return { type: 'DNS', value: new TextDecoder().decode(v) };
      case 6: return { type: 'URI', value: new TextDecoder().decode(v) };
      case 7: if (v.length === 4) return { type: 'IP', value: Array.prototype.join.call(v, '.') }; if (v.length === 16) { var parts = []; for (var i = 0; i < 16; i += 2) parts.push(((v[i] << 8) | v[i + 1]).toString(16)); return { type: 'IP', value: parts.join(':').replace(/(^|:)0(:0)+(:|$)/, '::') }; } return { type: 'IP', value: H.hex(v) };
      case 4: try { var nm = A.parse(v, 0); return { type: 'dirName', value: X.name(nm, v).str }; } catch (e) { return { type: 'dirName', value: H.hex(v) }; }
      case 0: return { type: 'otherName', value: H.hex(v) };
      case 8: return { type: 'RID', value: A.oid(v) };
      default: return { type: 'tag' + n.tag, value: H.hex(v) };
    }
  }
  X.generalNames = function (seq) { return seq.children.map(generalName); };

  var KU = ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign', 'encipherOnly', 'decipherOnly'];

  /** 확장 하나를 해석 */
  X.extension = function (oid, critical, val) {
    var r = { oid: oid, name: oidName(oid), critical: critical, text: '' }, root;
    try {
      switch (oid) {
        case '2.5.29.17': case '2.5.29.18': root = A.parse(val, 0); r.names = X.generalNames(root); r.text = r.names.map(function (n) { return n.type + ':' + n.value; }).join(', '); break;
        case '2.5.29.15': { root = A.parse(val, 0); var bs = bitString(root), on = []; for (var i = 0; i < KU.length; i++) if (bs.bytes[i >> 3] & (0x80 >> (i & 7))) on.push(KU[i]); r.usages = on; r.text = on.join(', '); break; }
        case '2.5.29.37': root = A.parse(val, 0); r.ekus = root.children.map(function (c) { return oidName(A.oid(c.value)); }); r.text = r.ekus.join(', '); break;
        case '2.5.29.19': { root = A.parse(val, 0); var ca = false, pl = null; root.children.forEach(function (c) { if (c.tag === 1) ca = !!c.value[0]; else if (c.tag === 2) pl = Number(A.int(c.value)); }); r.ca = ca; r.pathLen = pl; r.text = 'CA:' + (ca ? 'TRUE' : 'FALSE') + (pl != null ? ', pathlen:' + pl : ''); break; }
        case '2.5.29.14': root = A.parse(val, 0); r.text = hexColon(root.value); break;
        case '2.5.29.35': { root = A.parse(val, 0); var kid = root.children.filter(function (c) { return c.cls === 2 && c.tag === 0; })[0]; r.text = kid ? 'keyid:' + hexColon(kid.value) : ''; break; }
        case '2.5.29.31': { root = A.parse(val, 0); var uris = []; (function walk(n) { if (n.cls === 2 && n.tag === 6 && !n.constructed) uris.push(new TextDecoder().decode(n.value)); n.children.forEach(walk); })(root); r.uris = uris; r.text = uris.join(', '); break; }
        case '1.3.6.1.5.5.7.1.1': { root = A.parse(val, 0); r.access = root.children.map(function (c) { var gn = generalName(c.children[1]); return { method: oidName(A.oid(c.children[0].value)), uri: gn.value }; }); r.text = r.access.map(function (a) { return a.method + ' - ' + a.uri; }).join(', '); break; }
        case '2.5.29.32': { root = A.parse(val, 0); r.policies = root.children.map(function (c) { return A.oid(c.children[0].value); }); r.text = r.policies.map(function (p) { return A.OIDS[p] ? p + ' (' + A.OIDS[p] + ')' : p; }).join(', '); break; }
        case '1.3.6.1.4.1.11129.2.4.2': { root = A.parse(val, 0); var l = root.value; var n = 0, p = 2; while (p + 2 <= l.length) { var sl = (l[p] << 8) | l[p + 1]; p += 2 + sl; n++; } r.sct = n; r.text = n + ' SCT'; break; }
        case '1.3.6.1.5.5.7.1.24': r.text = 'status_request (OCSP Must-Staple)'; break;
        default: r.text = val.length + ' bytes';
      }
    } catch (e) { r.text = t('(해석 실패) ', '(parse failed) ') + e.message; r.failed = true; }
    return r;
  };

  /** 인증서 DER → 객체 */
  X.parseCert = function (der) {
    var root = A.parse(der, 0);
    if (root.tag !== 16 || root.children.length !== 3) throw new Error(t('X.509 인증서 구조(SEQUENCE 3개 요소)가 아닙니다', 'Not an X.509 certificate structure (SEQUENCE of 3)'));
    var tbs = root.children[0], sigAlg = root.children[1], sig = root.children[2], i = 0, c = tbs.children;
    var version = 1;
    if (c[0].cls === 2 && c[0].tag === 0) { version = Number(A.int(c[0].children[0].value)) + 1; i = 1; }
    var serialNode = c[i], tbsSig = c[i + 1], issuer = c[i + 2], validity = c[i + 3], subject = c[i + 4], spki = c[i + 5];
    if (!spki || !validity || validity.children.length < 2) throw new Error(t('TBSCertificate 구조가 올바르지 않습니다', 'Invalid TBSCertificate structure'));
    var cert = { der: der, version: version, serialHex: hexColon(serialNode.value), serialDec: A.int(serialNode.value).toString(), tbsBytes: der.subarray(tbs.start, tbs.end), sigAlgOid: A.oid(sigAlg.children[0].value), sigAlgNode: sigAlg, signature: bitString(sig).bytes, issuer: X.name(issuer, der), subject: X.name(subject, der), notBefore: A.time(validity.children[0]), notAfter: A.time(validity.children[1]), spkiBytes: der.subarray(spki.start, spki.end), exts: [] };
    cert.sigAlg = oidName(cert.sigAlgOid);
    if (A.oid(tbsSig.children[0].value) !== cert.sigAlgOid) cert.sigMismatch = true;
    cert.key = A.spki(cert.spkiBytes);
    cert.selfIssued = cert.issuer.key === cert.subject.key;
    for (var j = i + 6; j < c.length; j++) {
      if (c[j].cls === 2 && c[j].tag === 3) {
        c[j].children[0].children.forEach(function (e) {
          var k = 0, oid = A.oid(e.children[0].value), crit = false;
          if (e.children[1].tag === 1) { crit = !!e.children[1].value[0]; k = 1; }
          cert.exts.push(X.extension(oid, crit, e.children[1 + k].value));
        });
      }
    }
    cert.ext = function (oid) { return cert.exts.filter(function (e) { return e.oid === oid; })[0]; };
    return cert;
  };

  X.digest = function (algo, der) { return H.sha(algo, der).then(function (b) { return hexColon(b); }); };

  /* ---- 서명 검증 ---- */
  var SIG = {
    '1.2.840.113549.1.1.5': ['rsa', 'SHA-1'], '1.2.840.113549.1.1.11': ['rsa', 'SHA-256'], '1.2.840.113549.1.1.12': ['rsa', 'SHA-384'], '1.2.840.113549.1.1.13': ['rsa', 'SHA-512'],
    '1.2.840.10045.4.1': ['ec', 'SHA-1'], '1.2.840.10045.4.3.2': ['ec', 'SHA-256'], '1.2.840.10045.4.3.3': ['ec', 'SHA-384'], '1.2.840.10045.4.3.4': ['ec', 'SHA-512'], '1.3.101.112': ['ed', null]
  };
  X.sigInfo = function (oid) { return SIG[oid] || null; };
  function ecRaw(der, size) {
    var s = A.parse(der, 0); if (s.tag !== 16 || s.children.length !== 2) throw new Error('bad ECDSA signature');
    var out = new Uint8Array(size * 2);
    s.children.forEach(function (n, idx) { var v = n.value; while (v.length > size && v[0] === 0) v = v.subarray(1); if (v.length > size) throw new Error('bad ECDSA integer'); out.set(v, idx * size + size - v.length); });
    return out;
  }
  /** child 의 서명을 issuer 의 공개키로 검증 → Promise<{ok, reason}> */
  X.verify = function (child, issuer) {
    var info = SIG[child.sigAlgOid];
    if (!info) return Promise.resolve({ ok: null, reason: t('서명 알고리즘 ' + child.sigAlg + ' 은(는) 검증을 지원하지 않습니다', 'Signature algorithm ' + child.sigAlg + ' is not supported for verification') });
    var subtle = (g.crypto || window.crypto).subtle; if (!subtle) return Promise.resolve({ ok: null, reason: t('이 환경에서는 Web Crypto 를 쓸 수 없습니다 (HTTPS 필요)', 'Web Crypto is unavailable here (HTTPS required)') });
    var key = issuer.key, algo, vAlgo, sig = child.signature;
    try {
      if (info[0] === 'rsa') { if (key.alg !== 'RSA') return Promise.resolve({ ok: false, reason: t('발급자 키(' + key.alg + ')와 서명 알고리즘(RSA)이 맞지 않습니다', 'Issuer key (' + key.alg + ') does not match the RSA signature algorithm') }); algo = { name: 'RSASSA-PKCS1-v1_5', hash: info[1] }; vAlgo = algo.name; }
      else if (info[0] === 'ec') {
        if (key.alg !== 'EC') return Promise.resolve({ ok: false, reason: t('발급자 키(' + key.alg + ')와 서명 알고리즘(ECDSA)이 맞지 않습니다', 'Issuer key (' + key.alg + ') does not match the ECDSA signature algorithm') });
        var curve = /P-256/.test(key.curve) ? 'P-256' : /P-384/.test(key.curve) ? 'P-384' : /P-521/.test(key.curve) ? 'P-521' : null;
        if (!curve) return Promise.resolve({ ok: null, reason: t('곡선 ' + key.curve + ' 은(는) 지원하지 않습니다', 'Curve ' + key.curve + ' is not supported') });
        algo = { name: 'ECDSA', namedCurve: curve }; vAlgo = { name: 'ECDSA', hash: info[1] }; sig = ecRaw(sig, curve === 'P-256' ? 32 : curve === 'P-384' ? 48 : 66);
      } else { algo = { name: 'Ed25519' }; vAlgo = 'Ed25519'; }
    } catch (e) { return Promise.resolve({ ok: false, reason: e.message }); }
    return subtle.importKey('spki', issuer.spkiBytes, algo, false, ['verify']).then(function (k) { return subtle.verify(vAlgo, k, sig, child.tbsBytes); }).then(function (ok) { return { ok: ok, reason: ok ? '' : t('서명이 일치하지 않습니다', 'Signature does not match') }; }, function (e) { return { ok: null, reason: t('검증 불가: ', 'Cannot verify: ') + (e && e.message || e) }; });
  };

  /* ---- CSR ---- */
  X.parseCsr = function (der) {
    var root = A.parse(der, 0);
    if (root.tag !== 16 || root.children.length !== 3) throw new Error(t('PKCS#10 CSR 구조가 아닙니다', 'Not a PKCS#10 CSR structure'));
    var info = root.children[0], c = info.children;
    var csr = { der: der, version: Number(A.int(c[0].value)) + 1, subject: X.name(c[1], der), spkiBytes: der.subarray(c[2].start, c[2].end), key: A.spki(der.subarray(c[2].start, c[2].end)), tbsBytes: der.subarray(info.start, info.end), sigAlgOid: A.oid(root.children[1].children[0].value), signature: bitString(root.children[2]).bytes, exts: [], attrs: [] };
    csr.sigAlg = oidName(csr.sigAlgOid);
    var attrs = c[3];
    if (attrs && attrs.cls === 2 && attrs.tag === 0) attrs.children.forEach(function (a) {
      var oid = A.oid(a.children[0].value); csr.attrs.push(oidName(oid));
      if (oid === '1.2.840.113549.1.9.14') a.children[1].children[0].children.forEach(function (e) {
        var k = 0, eo = A.oid(e.children[0].value), crit = false; if (e.children[1].tag === 1) { crit = !!e.children[1].value[0]; k = 1; }
        csr.exts.push(X.extension(eo, crit, e.children[1 + k].value));
      });
    });
    csr.ext = function (oid) { return csr.exts.filter(function (e) { return e.oid === oid; })[0]; };
    return csr;
  };

  /* ---- DER 인코더 ---- */
  var E = X.enc = {};
  function lenBytes(n) { if (n < 128) return [n]; var b = []; while (n > 0) { b.unshift(n & 255); n = Math.floor(n / 256); } return [0x80 | b.length].concat(b); }
  E.tlv = function (tag, content) { var c = content instanceof Uint8Array ? content : new Uint8Array(content), l = lenBytes(c.length), r = new Uint8Array(1 + l.length + c.length); r[0] = tag; r.set(l, 1); r.set(c, 1 + l.length); return r; };
  E.cat = function () { var parts = Array.prototype.slice.call(arguments), n = parts.reduce(function (s, p) { return s + p.length; }, 0), r = new Uint8Array(n), q = 0; parts.forEach(function (p) { r.set(p, q); q += p.length; }); return r; };
  E.seq = function () { return E.tlv(0x30, E.cat.apply(null, arguments)); };
  E.set = function () { return E.tlv(0x31, E.cat.apply(null, arguments)); };
  E.int = function (n) { var b = []; if (n === 0) b = [0]; else { while (n > 0) { b.unshift(n & 255); n = Math.floor(n / 256); } if (b[0] & 0x80) b.unshift(0); } return E.tlv(2, b); };
  E.oid = function (s) { var p = s.split('.').map(Number), b = [p[0] * 40 + p[1]]; for (var i = 2; i < p.length; i++) { var x = p[i], tmp = [x & 0x7f]; x = Math.floor(x / 128); while (x > 0) { tmp.unshift((x & 0x7f) | 0x80); x = Math.floor(x / 128); } b = b.concat(tmp); } return E.tlv(6, b); };
  E.utf8 = function (s) { return E.tlv(0x0c, new TextEncoder().encode(s)); };
  E.printable = function (s) { return E.tlv(0x13, new TextEncoder().encode(s)); };
  E.ia5 = function (s) { return E.tlv(0x16, new TextEncoder().encode(s)); };
  E.bits = function (u8) { return E.tlv(3, E.cat(new Uint8Array([0]), u8)); };
  E.octet = function (u8) { return E.tlv(4, u8); };
  E.nul = function () { return new Uint8Array([5, 0]); };
  E.ctx = function (n, content, constructed) { return E.tlv((constructed === false ? 0x80 : 0xa0) | n, content); };

  /** DER ECDSA 서명(r||s → SEQUENCE) */
  E.ecSig = function (raw) {
    var h = raw.length / 2;
    function i(v) { var k = 0; while (k < v.length - 1 && v[k] === 0) k++; v = v.subarray(k); if (v[0] & 0x80) v = E.cat(new Uint8Array([0]), v); return E.tlv(2, v); }
    return E.seq(i(raw.subarray(0, h)), i(raw.subarray(h)));
  };
})(typeof window !== 'undefined' ? window : globalThis);
