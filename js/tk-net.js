/* WooaDev Tool Kit — IP/CIDR 공용 함수 (BigInt, IPv4·IPv6) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var N = TK.net = TK.net || {};
  var t = function (a, b) { return TK.t(a, b); };

  N.parseIPv4 = function (s) {
    s = String(s).trim();
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
    if (!m) return null;
    var n = 0n;
    for (var i = 1; i <= 4; i++) { var o = +m[i]; if (o > 255 || (m[i].length > 1 && m[i][0] === '0')) return null; n = (n << 8n) | BigInt(o); }
    return n;
  };
  N.parseIPv6 = function (s) {
    s = String(s).trim().replace(/^\[|\]$/g, '').replace(/%.+$/, '');
    if (!s || /[^0-9a-fA-F:.]/.test(s)) return null;
    var v4 = null;
    var m = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (m) { v4 = N.parseIPv4(m[2]); if (v4 === null) return null; s = m[1] + ((v4 >> 16n).toString(16)) + ':' + ((v4 & 0xffffn).toString(16)); }
    var parts = s.split('::');
    if (parts.length > 2) return null;
    var head = parts[0] ? parts[0].split(':') : [], tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
    var groups;
    if (parts.length === 2) {
      var missing = 8 - head.length - tail.length;
      if (missing < 1) return null;
      groups = head.concat(new Array(missing).fill('0'), tail);
    } else groups = head;
    if (groups.length !== 8) return null;
    var n = 0n;
    for (var i = 0; i < 8; i++) { if (!/^[0-9a-fA-F]{1,4}$/.test(groups[i])) return null; n = (n << 16n) | BigInt(parseInt(groups[i], 16)); }
    return n;
  };
  N.parseIP = function (s) {
    var a = N.parseIPv4(s); if (a !== null) return { v: 4, n: a };
    var b = N.parseIPv6(s); if (b !== null) return { v: 6, n: b };
    return null;
  };
  N.fmt4 = function (n) { return [24n, 16n, 8n, 0n].map(function (sh) { return ((n >> sh) & 255n).toString(); }).join('.'); };
  N.groups6 = function (n) { var g = []; for (var i = 7; i >= 0; i--) g.push(Number((n >> BigInt(i * 16)) & 0xffffn)); return g; };
  N.fmt6 = function (n, mode) {
    var g = N.groups6(n);
    if (mode === 'full') return g.map(function (x) { return ('0000' + x.toString(16)).slice(-4); }).join(':');
    var best = -1, bl = 0, cur = -1, cl = 0;
    for (var i = 0; i < 8; i++) {
      if (g[i] === 0) { if (cur < 0) { cur = i; cl = 0; } cl++; if (cl > bl) { bl = cl; best = cur; } } else cur = -1;
    }
    var h = g.map(function (x) { return x.toString(16); });
    if (bl >= 2) return (h.slice(0, best).join(':') + '::' + h.slice(best + bl).join(':'));
    return h.join(':');
  };
  N.fmt = function (v, n) { return v === 4 ? N.fmt4(n) : N.fmt6(n); };
  N.bits = function (v) { return v === 4 ? 32 : 128; };
  N.mask = function (v, prefix) { var b = BigInt(N.bits(v)), all = (1n << b) - 1n; return prefix === 0 ? 0n : (all << (b - BigInt(prefix))) & all; };

  /** "10.0.0.0/8", "2001:db8::/32", "1.2.3.4"(→/32) → {v, n(주어진 주소), prefix, start, end} */
  N.parseCIDR = function (str) {
    var s = String(str).trim(), m = /^(.+?)(?:\/(\d{1,3}))?$/.exec(s);
    if (!m) return null;
    var ip = N.parseIP(m[1]); if (!ip) return null;
    var bits = N.bits(ip.v), prefix = m[2] != null ? +m[2] : bits;
    if (prefix > bits) return null;
    var mask = N.mask(ip.v, prefix), start = ip.n & mask, end = start | (((1n << BigInt(bits)) - 1n) ^ mask);
    return { v: ip.v, n: ip.n, prefix: prefix, start: start, end: end, mask: mask };
  };
  /** 서브넷 마스크 문자열(255.255.255.0) → 접두어 길이, 아니면 -1 */
  N.maskToPrefix = function (s) {
    var n = N.parseIPv4(s); if (n === null) return -1;
    var bin = n.toString(2).padStart(32, '0');
    return /^1*0*$/.test(bin) ? bin.indexOf('0') === -1 ? 32 : bin.indexOf('0') : -1;
  };

  /** 범위 정렬·병합. 입력 [{start,end}] */
  N.merge = function (ranges) {
    var r = ranges.slice().sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; }), out = [];
    r.forEach(function (x) {
      var last = out[out.length - 1];
      if (last && x.start <= last.end + 1n) { if (x.end > last.end) last.end = x.end; } else out.push({ start: x.start, end: x.end });
    });
    return out;
  };
  N.intersect = function (A, B) {
    var out = [], i = 0, j = 0;
    A = N.merge(A); B = N.merge(B);
    while (i < A.length && j < B.length) {
      var s = A[i].start > B[j].start ? A[i].start : B[j].start, e = A[i].end < B[j].end ? A[i].end : B[j].end;
      if (s <= e) out.push({ start: s, end: e });
      if (A[i].end < B[j].end) i++; else j++;
    }
    return out;
  };
  N.subtract = function (A, B, max) {
    var out = [];
    B = N.merge(B);
    N.merge(A).forEach(function (a) {
      var cur = a.start;
      B.forEach(function (b) {
        if (b.end < cur || b.start > a.end) return;
        if (b.start > cur) out.push({ start: cur, end: b.start - 1n });
        cur = b.end + 1n;
      });
      if (cur <= a.end) out.push({ start: cur, end: a.end });
    });
    return out;
  };
  /** 범위 → 최소 CIDR 목록 */
  N.rangeToCidrs = function (start, end, v) {
    var bits = BigInt(N.bits(v)), out = [], limit = 1n << bits;
    while (start <= end) {
      var k = 0n;
      while (k < bits) {
        var next = 1n << (k + 1n);
        if (start % next === 0n && start + next - 1n <= end) k++; else break;
      }
      out.push({ v: v, start: start, prefix: Number(bits - k) });
      start += 1n << k;
      if (start >= limit) break;
    }
    return out;
  };
  N.cidrStr = function (c) { return N.fmt(c.v, c.start) + '/' + c.prefix; };
  N.count = function (r) { return r.end - r.start + 1n; };
  /** BigInt 를 읽기 좋게 (큰 수는 지수 표기 병기) */
  N.big = function (n) {
    var s = n.toString();
    return s.length > 15 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : Number(n).toLocaleString('en-US');
  };
})(typeof window !== 'undefined' ? window : globalThis);
