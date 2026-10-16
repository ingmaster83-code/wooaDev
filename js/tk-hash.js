/* WooaDev Tool Kit — 해시·체크섬 (MD5, SHA(WebCrypto), HMAC, CRC 카탈로그, Adler/Fletcher) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var H = TK.hash = TK.hash || {};
  var t = function (a, b) { return TK.t(a, b); };

  H.hex = function (u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += (u8[i] < 16 ? '0' : '') + u8[i].toString(16); return s; };
  H.b64 = function (u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  H.b64url = function (u8) { return H.b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  H.fromB64 = function (s) { var bin = atob(String(s).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')); var a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
  H.fromHex = function (s) {
    var c = String(s).replace(/0x/gi, '').replace(/[\s,:\-]/g, '');
    if (c.length % 2 || /[^0-9a-fA-F]/.test(c)) throw new Error(t('올바른 16진수 문자열이 아닙니다 (짝수 길이, 0-9a-f)', 'Not a valid hex string (even length, 0-9a-f)'));
    var a = new Uint8Array(c.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(c.substr(i * 2, 2), 16); return a;
  };
  H.utf8 = function (s) { return new TextEncoder().encode(String(s)); };
  H.concat = function (a, b) { var r = new Uint8Array(a.length + b.length); r.set(a, 0); r.set(b, a.length); return r; };
  var subtle = function () {
    var c = g.crypto || (typeof window !== 'undefined' ? window.crypto : null);
    if (!c || !c.subtle) throw new Error(t('이 기능은 HTTPS(보안 연결)에서만 동작합니다. 주소가 https:// 로 시작하는지 확인하세요', 'This feature needs a secure context (HTTPS). Check that the address starts with https://'));
    return c.subtle;
  };

  H.sha = function (algo, bytes) { return subtle().digest(algo, bytes).then(function (b) { return new Uint8Array(b); }); };
  var BLOCK = { 'SHA-1': 64, 'SHA-256': 64, 'SHA-384': 128, 'SHA-512': 128 };
  /** HMAC (빈 키도 허용하기 위해 직접 구성) */
  H.hmac = function (algo, key, msg) {
    var bs = BLOCK[algo];
    var kp = key.length > bs ? H.sha(algo, key) : Promise.resolve(key);
    return kp.then(function (k) {
      var ip = new Uint8Array(bs), op = new Uint8Array(bs);
      for (var i = 0; i < bs; i++) { var kb = i < k.length ? k[i] : 0; ip[i] = kb ^ 0x36; op[i] = kb ^ 0x5c; }
      return H.sha(algo, H.concat(ip, msg)).then(function (inner) { return H.sha(algo, H.concat(op, inner)); });
    });
  };

  /* ── MD5 ── */
  var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var K = []; for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  H.md5 = function (bytes) {
    var len = bytes.length, padLen = ((len + 8) >> 6) + 1, words = new Uint32Array(padLen * 16);
    for (var i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    words[len >> 2] |= 0x80 << ((len % 4) * 8);
    words[padLen * 16 - 2] = (len * 8) >>> 0; words[padLen * 16 - 1] = Math.floor(len / 536870912) >>> 0;
    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (var off = 0; off < words.length; off += 16) {
      var A = a0, B = b0, C = c0, D = d0;
      for (var j = 0; j < 64; j++) {
        var F, gi;
        if (j < 16) { F = (B & C) | (~B & D); gi = j; }
        else if (j < 32) { F = (D & B) | (~D & C); gi = (5 * j + 1) % 16; }
        else if (j < 48) { F = B ^ C ^ D; gi = (3 * j + 5) % 16; }
        else { F = C ^ (B | ~D); gi = (7 * j) % 16; }
        F = (F + A + K[j] + words[off + gi]) | 0;
        A = D; D = C; C = B; B = (B + ((F << S[j]) | (F >>> (32 - S[j])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    var out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach(function (w, k) { for (var b = 0; b < 4; b++) out[k * 4 + b] = (w >>> (b * 8)) & 255; });
    return out;
  };

  /* ── CRC (Rocksoft 모델) ── */
  function reflect(v, bits) { var r = 0; for (var i = 0; i < bits; i++) { r = (r * 2) + (v & 1); v = Math.floor(v / 2); } return r; }
  function reflectBig(v, bits) { var r = 0n; for (var i = 0; i < bits; i++) { r = (r << 1n) | (v & 1n); v >>= 1n; } return r; }
  var CRCS = [
    ['CRC-8', 8, 0x07, 0, false, false, 0, 0xF4], ['CRC-8/MAXIM (Dallas 1-Wire)', 8, 0x31, 0, true, true, 0, 0xA1], ['CRC-8/CDMA2000', 8, 0x9B, 0xFF, false, false, 0, 0xDA],
    ['CRC-16/ARC (CRC-16)', 16, 0x8005, 0, true, true, 0, 0xBB3D], ['CRC-16/MODBUS', 16, 0x8005, 0xFFFF, true, true, 0, 0x4B37], ['CRC-16/USB', 16, 0x8005, 0xFFFF, true, true, 0xFFFF, 0xB4C8],
    ['CRC-16/CCITT-FALSE', 16, 0x1021, 0xFFFF, false, false, 0, 0x29B1], ['CRC-16/XMODEM', 16, 0x1021, 0, false, false, 0, 0x31C3], ['CRC-16/KERMIT (CCITT-TRUE)', 16, 0x1021, 0, true, true, 0, 0x2189],
    ['CRC-16/X-25 (IBM-SDLC)', 16, 0x1021, 0xFFFF, true, true, 0xFFFF, 0x906E], ['CRC-16/GENIBUS', 16, 0x1021, 0xFFFF, false, false, 0xFFFF, 0xD64E], ['CRC-16/DNP', 16, 0x3D65, 0, true, true, 0xFFFF, 0xEA82],
    ['CRC-32 (ISO-HDLC, zlib, PNG, Ethernet)', 32, 0x04C11DB7, 0xFFFFFFFF, true, true, 0xFFFFFFFF, 0xCBF43926], ['CRC-32C (Castagnoli, iSCSI)', 32, 0x1EDC6F41, 0xFFFFFFFF, true, true, 0xFFFFFFFF, 0xE3069283],
    ['CRC-32/BZIP2', 32, 0x04C11DB7, 0xFFFFFFFF, false, false, 0xFFFFFFFF, 0xFC891918], ['CRC-32/MPEG-2', 32, 0x04C11DB7, 0xFFFFFFFF, false, false, 0, 0x0376E6E7], ['CRC-32/JAMCRC', 32, 0x04C11DB7, 0xFFFFFFFF, true, true, 0, 0x340BC6D9],
    ['CRC-32/XFER', 32, 0x000000AF, 0, false, false, 0, 0xBD0BE338]
  ];
  H.CRCS = CRCS.map(function (c) { return { name: c[0], width: c[1], poly: c[2], init: c[3], refin: c[4], refout: c[5], xorout: c[6], check: c[7] }; });
  H.CRCS.push({ name: 'CRC-64/XZ', width: 64, poly: 0x42F0E1EBA9EA3693n, init: 0xFFFFFFFFFFFFFFFFn, refin: true, refout: true, xorout: 0xFFFFFFFFFFFFFFFFn, check: 0x995DC9BBDF1939FAn });
  H.crc = function (p, bytes) {
    var w = p.width;
    if (w === 64) {
      var mask = (1n << 64n) - 1n, reg = p.init, top = 1n << 63n;
      for (var i = 0; i < bytes.length; i++) {
        var b = BigInt(p.refin ? reflect(bytes[i], 8) : bytes[i]);
        reg ^= b << 56n;
        for (var k = 0; k < 8; k++) reg = (reg & top) ? ((reg << 1n) ^ p.poly) & mask : (reg << 1n) & mask;
      }
      if (p.refout) reg = reflectBig(reg, 64);
      return (reg ^ p.xorout) & mask;
    }
    var m = w === 32 ? 0xFFFFFFFF : (Math.pow(2, w) - 1), topb = Math.pow(2, w - 1), reg2 = p.init >>> 0;
    if (!p._tbl) {
      var tbl = new Array(256);
      for (var d = 0; d < 256; d++) {
        var r = (d * Math.pow(2, w - 8)) % Math.pow(2, w);
        for (var q = 0; q < 8; q++) r = (r >= topb) ? ((((r - topb) * 2) ^ p.poly) >>> 0) : r * 2;
        tbl[d] = r >>> 0 === r ? r >>> 0 : r;
      }
      p._tbl = tbl.map(function (x) { return x >>> 0; });
    }
    var shift = w - 8;
    for (var n = 0; n < bytes.length; n++) {
      var byte = p.refin ? reflect(bytes[n], 8) : bytes[n];
      var idx = (Math.floor(reg2 / Math.pow(2, shift)) ^ byte) & 0xFF;
      reg2 = (((reg2 * 256) % Math.pow(2, w)) ^ p._tbl[idx]) >>> 0;
    }
    if (p.refout) reg2 = reflect(reg2, w);
    var res = (reg2 ^ p.xorout) >>> 0;
    return w === 32 ? res : (res & m);
  };
  H.adler32 = function (bytes) { var a = 1, b = 0; for (var i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; };
  H.fletcher16 = function (bytes) { var a = 0, b = 0; for (var i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 255; b = (b + a) % 255; } return (b << 8) | a; };
})(typeof window !== 'undefined' ? window : globalThis);
