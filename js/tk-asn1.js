/* WooaDev Tool Kit — 최소 ASN.1 DER/BER 파서 (SPKI·인증서·키 분석용) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var A = TK.asn1 = TK.asn1 || {};
  var t = function (a, b) { return TK.t(a, b); };

  var TAGS = { 1: 'BOOLEAN', 2: 'INTEGER', 3: 'BIT STRING', 4: 'OCTET STRING', 5: 'NULL', 6: 'OBJECT IDENTIFIER', 10: 'ENUMERATED', 12: 'UTF8String', 16: 'SEQUENCE', 17: 'SET', 19: 'PrintableString', 20: 'T61String', 22: 'IA5String', 23: 'UTCTime', 24: 'GeneralizedTime', 30: 'BMPString' };
  A.OIDS = {
    '1.2.840.113549.1.1.1': 'rsaEncryption', '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption', '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption', '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption', '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption', '1.2.840.113549.1.1.10': 'RSASSA-PSS',
    '1.2.840.10045.2.1': 'ecPublicKey', '1.2.840.10045.3.1.7': 'prime256v1 (P-256)', '1.3.132.0.34': 'secp384r1 (P-384)', '1.3.132.0.35': 'secp521r1 (P-521)', '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256', '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384', '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
    '1.3.101.112': 'Ed25519', '1.3.101.113': 'Ed448', '1.3.101.110': 'X25519',
    '2.5.4.3': 'commonName (CN)', '2.5.4.6': 'countryName (C)', '2.5.4.7': 'localityName (L)', '2.5.4.8': 'stateOrProvinceName (ST)', '2.5.4.10': 'organizationName (O)', '2.5.4.11': 'organizationalUnitName (OU)', '2.5.4.5': 'serialNumber', '1.2.840.113549.1.9.1': 'emailAddress',
    '2.5.29.14': 'subjectKeyIdentifier', '2.5.29.15': 'keyUsage', '2.5.29.17': 'subjectAltName', '2.5.29.19': 'basicConstraints', '2.5.29.31': 'cRLDistributionPoints', '2.5.29.32': 'certificatePolicies', '2.5.29.35': 'authorityKeyIdentifier', '2.5.29.37': 'extKeyUsage', '1.3.6.1.5.5.7.1.1': 'authorityInfoAccess',
    '1.3.6.1.5.5.7.3.1': 'serverAuth', '1.3.6.1.5.5.7.3.2': 'clientAuth', '1.3.6.1.5.5.7.3.3': 'codeSigning', '1.3.6.1.5.5.7.3.4': 'emailProtection', '1.3.6.1.5.5.7.48.1': 'OCSP', '1.3.6.1.5.5.7.48.2': 'caIssuers', '1.3.6.1.4.1.11129.2.4.2': 'SCT list (Certificate Transparency)'
  };

  /** DER/BER 한 노드 파싱. 반환 {cls, constructed, tag, name, hdr, len, start, end, value(Uint8Array), children} */
  A.parse = function (u8, off, depth) {
    off = off || 0; depth = depth || 0;
    if (off >= u8.length) throw new Error(t('ASN.1 데이터가 도중에 끝났습니다', 'Truncated ASN.1 data'));
    var b = u8[off], cls = b >> 6, constructed = !!(b & 0x20), tag = b & 0x1f, p = off + 1;
    if (tag === 0x1f) { tag = 0; do { tag = (tag << 7) | (u8[p] & 0x7f); } while (u8[p++] & 0x80); }
    var len = u8[p++], indefinite = false;
    if (len === undefined) throw new Error(t('ASN.1 길이를 읽을 수 없습니다', 'Cannot read ASN.1 length'));
    if (len & 0x80) { var n = len & 0x7f; if (n === 0) indefinite = true; else { if (n > 4) throw new Error(t('지원하지 않는 긴 길이입니다', 'Unsupported long length')); len = 0; for (var i = 0; i < n; i++) len = (len * 256) + u8[p++]; } }
    var node = { cls: cls, constructed: constructed, tag: tag, hdr: p - off, start: off, children: [] };
    if (indefinite) {
      var q = p; while (!(u8[q] === 0 && u8[q + 1] === 0)) { var c = A.parse(u8, q, depth + 1); node.children.push(c); q = c.end; if (q >= u8.length) throw new Error(t('부정 길이 객체가 끝나지 않았습니다', 'Unterminated indefinite-length object')); }
      node.end = q + 2; node.len = q - p; node.value = u8.subarray(p, q); node.name = A.name(node); return node;
    }
    node.len = len; node.end = p + len;
    if (node.end > u8.length) throw new Error(t('ASN.1 길이가 데이터 크기를 넘습니다', 'ASN.1 length exceeds the data'));
    node.value = u8.subarray(p, node.end);
    node.name = A.name(node);
    if (constructed && depth < 30) { var r = p; while (r < node.end) { var ch = A.parse(u8, r, depth + 1); node.children.push(ch); r = ch.end; } }
    return node;
  };
  A.name = function (n) {
    if (n.cls === 0) return TAGS[n.tag] || ('UNIVERSAL ' + n.tag);
    if (n.cls === 2) return '[' + n.tag + ']';
    return (n.cls === 1 ? 'APPLICATION ' : 'PRIVATE ') + n.tag;
  };
  A.oid = function (v) {
    if (!v.length) return '';
    var out = [Math.floor(v[0] / 40), v[0] % 40], x = 0;
    for (var i = 1; i < v.length; i++) { x = x * 128 + (v[i] & 0x7f); if (!(v[i] & 0x80)) { out.push(x); x = 0; } }
    return out.join('.');
  };
  A.int = function (v) { var x = 0n; for (var i = 0; i < v.length; i++) x = (x << 8n) | BigInt(v[i]); if (v.length && (v[0] & 0x80)) x -= 1n << BigInt(v.length * 8); return x; };
  A.bitLength = function (v) { var i = 0; while (i < v.length && v[i] === 0) i++; if (i >= v.length) return 0; return (v.length - i - 1) * 8 + (32 - Math.clz32(v[i])); };
  A.str = function (n) { try { return new TextDecoder(n.tag === 30 ? 'utf-16be' : 'utf-8').decode(n.value); } catch (e) { return ''; } };
  A.time = function (n) {
    var s = A.str(n), m = n.tag === 23 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?Z$/.exec(s);
    if (!m) return s; var y = +m[1]; if (n.tag === 23) y += y >= 50 ? 1900 : 2000;
    return y + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + (m[6] || '00') + 'Z';
  };

  /** SubjectPublicKeyInfo → {alg, bits, exponent, curve} */
  A.spki = function (u8) {
    var n = A.parse(u8);
    if (n.tag !== 16 || n.children.length < 2) throw new Error(t('SubjectPublicKeyInfo 구조가 아닙니다', 'Not a SubjectPublicKeyInfo structure'));
    var algo = n.children[0], oid = A.oid(algo.children[0].value), name = A.OIDS[oid] || oid, bitstr = n.children[1];
    var key = bitstr.value.subarray(1);
    if (oid === '1.2.840.113549.1.1.1') {
      var rsa = A.parse(key), modulus = rsa.children[0].value, e = A.int(rsa.children[1].value);
      return { alg: 'RSA', oid: oid, bits: A.bitLength(modulus), exponent: e.toString(), name: name };
    }
    if (oid === '1.2.840.10045.2.1') { var curveOid = algo.children[1] ? A.oid(algo.children[1].value) : ''; return { alg: 'EC', oid: oid, curve: A.OIDS[curveOid] || curveOid, bits: (key.length - 1) * 4, name: name }; }
    if (oid === '1.3.101.112') return { alg: 'Ed25519', oid: oid, bits: 256, name: name };
    return { alg: name, oid: oid, bits: key.length * 8, name: name };
  };
  A.pemToDer = function (pem) {
    var m = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(pem);
    var b64 = (m ? m[2] : pem).replace(/\s+/g, '');
    return { label: m ? m[1] : '', der: TK.hash.fromB64(b64) };
  };
})(typeof window !== 'undefined' ? window : globalThis);
