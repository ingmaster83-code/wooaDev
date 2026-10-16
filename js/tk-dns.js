/* WooaDev Tool Kit — 도메인/DNS 공용: Punycode(RFC 3492), IDN 변환, 레이블 검사 */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var D = TK.dns = TK.dns || {};
  var t = function (a, b) { return TK.t(a, b); };
  var BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;

  function adapt(delta, num, first) {
    var k = 0; delta = first ? Math.floor(delta / DAMP) : delta >> 1; delta += Math.floor(delta / num);
    for (; delta > ((BASE - TMIN) * TMAX) >> 1; k += BASE) delta = Math.floor(delta / (BASE - TMIN));
    return Math.floor(k + (BASE - TMIN + 1) * delta / (delta + SKEW));
  }
  function digit(d) { return String.fromCharCode(d + 22 + 75 * (d < 26)); }
  D.punyEncode = function (input) {
    var cps = Array.from(input).map(function (c) { return c.codePointAt(0); }), out = '', n = INITIAL_N, delta = 0, bias = INITIAL_BIAS;
    cps.forEach(function (c) { if (c < 128) out += String.fromCharCode(c); });
    var b = out.length, h = b;
    if (b) out += '-';
    while (h < cps.length) {
      var m = Infinity; cps.forEach(function (c) { if (c >= n && c < m) m = c; });
      delta += (m - n) * (h + 1); n = m;
      for (var i = 0; i < cps.length; i++) {
        var c = cps[i];
        if (c < n) delta++;
        if (c === n) {
          var q = delta;
          for (var k = BASE; ; k += BASE) {
            var tt = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias);
            if (q < tt) break;
            out += digit(tt + (q - tt) % (BASE - tt)); q = Math.floor((q - tt) / (BASE - tt));
          }
          out += digit(q); bias = adapt(delta, h + 1, h === b); delta = 0; h++;
        }
      }
      delta++; n++;
    }
    return out;
  };
  D.punyDecode = function (input) {
    var out = [], bpos = input.lastIndexOf('-'); if (bpos < 0) bpos = 0;
    for (var j = 0; j < bpos; j++) { if (input.charCodeAt(j) >= 128) throw new Error(t('Punycode에 ASCII가 아닌 문자가 있습니다', 'Non-ASCII character in Punycode')); out.push(input.charCodeAt(j)); }
    var n = INITIAL_N, i = 0, bias = INITIAL_BIAS;
    for (var idx = bpos > 0 ? bpos + 1 : 0; idx < input.length;) {
      var oldi = i;
      for (var w = 1, k = BASE; ; k += BASE) {
        if (idx >= input.length) throw new Error(t('Punycode가 도중에 끝났습니다', 'Truncated Punycode'));
        var ch = input.charCodeAt(idx++), d = (ch >= 48 && ch <= 57) ? ch - 22 : (ch >= 65 && ch <= 90) ? ch - 65 : (ch >= 97 && ch <= 122) ? ch - 97 : BASE;
        if (d >= BASE) throw new Error(t('Punycode에 쓸 수 없는 문자: ' + input[idx - 1], 'Invalid Punycode character: ' + input[idx - 1]));
        i += d * w; var tt = k <= bias ? TMIN : (k >= bias + TMAX ? TMAX : k - bias);
        if (d < tt) break; w *= BASE - tt;
      }
      var len = out.length + 1; bias = adapt(i - oldi, len, oldi === 0); n += Math.floor(i / len); i %= len;
      out.splice(i++, 0, n);
    }
    return String.fromCodePoint.apply(null, out);
  };
  D.dots = /[.。．｡]/;
  D.toASCII = function (domain) {
    return domain.split(D.dots).map(function (l) {
      if (!/[^\x00-\x7f]/.test(l)) return l;
      var norm = l.normalize('NFKC').toLowerCase();
      return 'xn--' + D.punyEncode(norm);
    }).join('.');
  };
  D.toUnicode = function (domain) {
    return domain.split('.').map(function (l) { return /^xn--/i.test(l) ? D.punyDecode(l.slice(4)) : l; }).join('.');
  };
})(typeof window !== 'undefined' ? window : globalThis);
