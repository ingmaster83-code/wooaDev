/* WooaDev Tool Kit — 바이트/인코딩 유틸 (UTF-8 변환, Base16/32/58/85) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var B = TK.bytes = TK.bytes || {};
  var t = function (a, b) { return TK.t(a, b); };

  B.random = function (n) { var a = new Uint8Array(n); (g.crypto || window.crypto).getRandomValues(a); return a; };
  /** 0 이상 max 미만 균일 난수(BigInt 아님, max ≤ 2^32) */
  B.randInt = function (max) { var lim = Math.floor(4294967296 / max) * max, x; do { x = new Uint32Array(1); (g.crypto || window.crypto).getRandomValues(x); x = x[0]; } while (x >= lim); return x % max; };
  B.utf8 = function (s) { return Array.from(new TextEncoder().encode(String(s))); };
  B.fromUtf8 = function (arr, strict) {
    var u8 = Uint8Array.from(arr);
    try { return new TextDecoder('utf-8', { fatal: !!strict }).decode(u8); }
    catch (e) { return null; }
  };
  B.hex = function (arr, sep) { return arr.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join(sep || ''); };
  B.parseHex = function (s) {
    var c = String(s).replace(/0x/gi, '').replace(/[\s,:\-]/g, '');
    if (c.length % 2) throw new Error(t('16진수 문자열의 길이가 홀수입니다', 'The hex string has an odd length'));
    if (/[^0-9a-fA-F]/.test(c)) throw new Error(t('16진수가 아닌 문자가 있습니다: ' + /[^0-9a-fA-F]/.exec(c)[0], 'Non-hex character found: ' + /[^0-9a-fA-F]/.exec(c)[0]));
    var out = []; for (var i = 0; i < c.length; i += 2) out.push(parseInt(c.substr(i, 2), 16));
    return out;
  };

  /* Base16 */
  B.b16enc = function (arr, lower) { var h = B.hex(arr); return lower ? h : h.toUpperCase(); };
  B.b16dec = function (s) { return B.parseHex(s); };

  /* Base32 (RFC 4648) / base32hex */
  var A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', A32H = '0123456789ABCDEFGHIJKLMNOPQRSTUV', ACROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function b32enc(arr, alpha, pad) {
    var bits = 0, val = 0, out = '';
    arr.forEach(function (b) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += alpha[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; });
    if (bits) out += alpha[(val << (5 - bits)) & 31];
    if (pad) while (out.length % 8) out += '=';
    return out;
  }
  function b32dec(s, alpha) {
    var clean = String(s).replace(/[\s=]/g, '').toUpperCase(), bits = 0, val = 0, out = [];
    if (alpha === ACROCK) clean = clean.replace(/O/g, '0').replace(/[IL]/g, '1');
    for (var i = 0; i < clean.length; i++) {
      var idx = alpha.indexOf(clean[i]);
      if (idx < 0) throw new Error(t('Base32에 없는 문자 "' + clean[i] + '"', 'Invalid Base32 character "' + clean[i] + '"'));
      val = (val << 5) | idx; bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; val &= (1 << bits) - 1; }
    }
    return out;
  }
  B.b32enc = function (arr, variant, pad) { return b32enc(arr, variant === 'hex' ? A32H : variant === 'crockford' ? ACROCK : A32, pad && variant !== 'crockford'); };
  B.b32dec = function (s, variant) { return b32dec(s, variant === 'hex' ? A32H : variant === 'crockford' ? ACROCK : A32); };

  /* Base58 (Bitcoin / Flickr / Ripple 알파벳) */
  var A58 = { btc: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', flickr: '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', ripple: 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz' };
  B.b58enc = function (arr, variant) {
    var al = A58[variant] || A58.btc, zeros = 0, digits = [];
    while (zeros < arr.length && arr[zeros] === 0) zeros++;
    for (var i = zeros; i < arr.length; i++) {
      var carry = arr[i];
      for (var j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = Math.floor(carry / 58); }
      while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
    }
    var out = al[0].repeat(zeros);
    for (var k = digits.length - 1; k >= 0; k--) out += al[digits[k]];
    return out;
  };
  B.b58dec = function (s, variant) {
    var al = A58[variant] || A58.btc, str = String(s).replace(/\s/g, ''), zeros = 0, bytes = [];
    while (zeros < str.length && str[zeros] === al[0]) zeros++;
    for (var i = zeros; i < str.length; i++) {
      var v = al.indexOf(str[i]);
      if (v < 0) throw new Error(t('Base58에 없는 문자 "' + str[i] + '"', 'Invalid Base58 character "' + str[i] + '"'));
      var carry = v;
      for (var j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 255; carry >>= 8; }
      while (carry) { bytes.push(carry & 255); carry >>= 8; }
    }
    var out = []; for (var z = 0; z < zeros; z++) out.push(0);
    for (var k = bytes.length - 1; k >= 0; k--) out.push(bytes[k]);
    return out;
  };

  /* Base85: ascii85(Adobe) / z85 */
  var Z85 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
  B.b85enc = function (arr, variant, wrap) {
    var out = '', i = 0;
    var bytes = arr.slice();
    if (variant === 'z85' && bytes.length % 4) throw new Error(t('Z85는 입력 길이가 4의 배수여야 합니다 (현재 ' + bytes.length + '바이트)', 'Z85 needs a multiple of 4 bytes (got ' + bytes.length + ')'));
    for (; i < bytes.length; i += 4) {
      var chunk = bytes.slice(i, i + 4), n = chunk.length;
      while (chunk.length < 4) chunk.push(0);
      var v = ((chunk[0] * 16777216) + (chunk[1] << 16) + (chunk[2] << 8) + chunk[3]) >>> 0;
      if (variant !== 'z85' && v === 0 && n === 4) { out += 'z'; continue; }
      var d = [];
      for (var k = 0; k < 5; k++) { d.unshift(v % 85); v = Math.floor(v / 85); }
      var enc = d.map(function (x) { return variant === 'z85' ? Z85[x] : String.fromCharCode(x + 33); }).join('');
      out += n === 4 ? enc : enc.slice(0, n + 1);
    }
    if (variant === 'adobe') out = '<~' + out + '~>';
    return out;
  };
  B.b85dec = function (s, variant) {
    var str = String(s).replace(/\s/g, '');
    if (variant === 'adobe') str = str.replace(/^<~/, '').replace(/~>$/, '');
    var out = [], buf = [];
    function flush(chars, n) {
      var v = 0;
      for (var k = 0; k < 5; k++) v = v * 85 + (k < chars.length ? chars[k] : 84);
      var bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
      if (v > 4294967295) throw new Error(t('Base85 값이 범위를 벗어났습니다', 'Base85 value out of range'));
      out.push.apply(out, bytes.slice(0, n));
    }
    for (var i = 0; i < str.length; i++) {
      var c = str[i], val;
      if (variant !== 'z85' && c === 'z' && !buf.length) { out.push(0, 0, 0, 0); continue; }
      if (variant === 'z85') { val = Z85.indexOf(c); if (val < 0) throw new Error(t('Z85에 없는 문자 "' + c + '"', 'Invalid Z85 character "' + c + '"')); }
      else { val = c.charCodeAt(0) - 33; if (val < 0 || val > 84) throw new Error(t('Ascii85에 없는 문자 "' + c + '"', 'Invalid Ascii85 character "' + c + '"')); }
      buf.push(val);
      if (buf.length === 5) { flush(buf, 4); buf = []; }
    }
    if (buf.length) {
      if (buf.length === 1) throw new Error(t('Base85 입력이 도중에 끊겼습니다', 'Truncated Base85 input'));
      flush(buf, buf.length - 1);
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
