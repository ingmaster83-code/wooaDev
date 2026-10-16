/* WooaDev Tool Kit — 날짜·시간 공용 함수 (BigInt 나노초 기반, 100ns 정밀도 유지) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var T = TK.time = TK.time || {};
  var t = function (a, b) { return TK.t(a, b); };

  var NS_DAY = 86400000000000n, NS_SEC = 1000000000n, NS_MS = 1000000n;
  T.NS_DAY = NS_DAY; T.NS_SEC = NS_SEC;
  // 에포크 차이(Unix 1970-01-01 기준)
  T.TICKS_AT_UNIX = 621355968000000000n;          // .NET: 100ns 단위, 0001-01-01 → 1970-01-01
  T.FILETIME_AT_UNIX = 116444736000000000n;       // Windows: 100ns 단위, 1601-01-01 → 1970-01-01
  T.WEBKIT_US_AT_UNIX = 11644473600000000n;       // Chrome/WebKit: µs 단위, 1601-01-01 → 1970-01-01
  T.COCOA_S_AT_UNIX = 978307200n;                 // Apple Cocoa/Core Data: 초, 2001-01-01

  function fdiv(a, b) { var q = a / b; if ((a % b !== 0n) && ((a < 0n) !== (b < 0n))) q -= 1n; return q; }
  T.fdiv = fdiv;

  /** 그레고리력 → Unix 일수 (Howard Hinnant) */
  T.daysFromCivil = function (y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400), yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  };
  T.civilFromDays = function (z) {
    z += 719468;
    var era = Math.floor(z / 146097), doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var y = yoe + era * 400, doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153), d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp + (mp < 10 ? 3 : -9);
    return { y: y + (m <= 2 ? 1 : 0), m: m, d: d };
  };
  T.isLeap = function (y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; };
  T.daysInMonth = function (y, m) { return [31, T.isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; };

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  T.pad = pad;

  /** 나노초(BigInt, Unix 기준) → 필드 */
  T.fields = function (ns) {
    var days = fdiv(ns, NS_DAY), rem = ns - days * NS_DAY;
    var c = T.civilFromDays(Number(days));
    var sec = rem / NS_SEC, frac = rem % NS_SEC;
    return { y: c.y, m: c.m, d: c.d, H: Number(sec / 3600n), M: Number((sec / 60n) % 60n), S: Number(sec % 60n), frac: Number(frac), ns: frac, days: Number(days),
             dow: ((Number(days) % 7) + 11) % 7 };   // 0=일요일
  };
  T.fromFields = function (y, m, d, H, M, S, fracNs) {
    return BigInt(T.daysFromCivil(y, m, d)) * NS_DAY + BigInt(H) * 3600n * NS_SEC + BigInt(M) * 60n * NS_SEC + BigInt(S) * NS_SEC + BigInt(fracNs || 0);
  };
  T.yearStr = function (y) { return y < 0 ? '-' + pad(-y, 6) : (y > 9999 ? '+' + pad(y, 6) : pad(y, 4)); };

  /** ISO 8601 문자열 (UTC 또는 offsetMin 적용). digits: 소수 자릿수(0~9) */
  T.iso = function (ns, digits, offsetMin) {
    digits = digits == null ? 3 : digits; offsetMin = offsetMin || 0;
    var f = T.fields(ns + BigInt(offsetMin) * 60n * NS_SEC);
    var s = T.yearStr(f.y) + '-' + pad(f.m, 2) + '-' + pad(f.d, 2) + 'T' + pad(f.H, 2) + ':' + pad(f.M, 2) + ':' + pad(f.S, 2);
    if (digits > 0) s += '.' + pad(f.frac, 9).slice(0, digits);
    if (offsetMin === 0 && arguments[3] !== 'offset') return s + 'Z';
    var sign = offsetMin < 0 ? '-' : '+', a = Math.abs(offsetMin);
    return s + sign + pad(Math.floor(a / 60), 2) + ':' + pad(a % 60, 2);
  };
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  T.DOW = DOW; T.MON = MON;
  T.DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
  T.rfc2822 = function (ns, offsetMin) {
    offsetMin = offsetMin || 0;
    var f = T.fields(ns + BigInt(offsetMin) * 60n * NS_SEC), a = Math.abs(offsetMin);
    return DOW[f.dow] + ', ' + pad(f.d, 2) + ' ' + MON[f.m - 1] + ' ' + f.y + ' ' + pad(f.H, 2) + ':' + pad(f.M, 2) + ':' + pad(f.S, 2) + ' ' + (offsetMin < 0 ? '-' : '+') + pad(Math.floor(a / 60), 2) + pad(a % 60, 2);
  };
  T.httpDate = function (ns) {
    var f = T.fields(ns);
    return DOW[f.dow] + ', ' + pad(f.d, 2) + ' ' + MON[f.m - 1] + ' ' + f.y + ' ' + pad(f.H, 2) + ':' + pad(f.M, 2) + ':' + pad(f.S, 2) + ' GMT';
  };

  /** ISO 8601 / "YYYY-MM-DD HH:mm:ss" / 날짜만 파싱 → {ns, offsetMin|null, digits} */
  T.parseISO = function (str) {
    var s = String(str).trim();
    var m = /^([+-]?\d{4,6})-?(\d{2})-?(\d{2})(?:[T\s](\d{2})(?::?(\d{2}))?(?::?(\d{2}))?(?:[.,](\d{1,9}))?)?\s*(Z|z|UTC|GMT|[+-]\d{2}(?::?\d{2})?)?$/.exec(s);
    if (!m) return null;
    var y = parseInt(m[1], 10), mo = +m[2], d = +m[3], H = +(m[4] || 0), M = +(m[5] || 0), S = +(m[6] || 0);
    if (mo < 1 || mo > 12 || d < 1 || d > T.daysInMonth(y, mo) || H > 23 || M > 59 || S > 60) return null;
    var frac = m[7] ? m[7] : '', fracNs = frac ? parseInt((frac + '000000000').slice(0, 9), 10) : 0;
    var off = null;
    if (m[8]) {
      if (/^[Zz]|UTC|GMT/.test(m[8])) off = 0;
      else { var om = /^([+-])(\d{2}):?(\d{2})?$/.exec(m[8]); off = (om[1] === '-' ? -1 : 1) * (+om[2] * 60 + (+om[3] || 0)); }
    }
    var local = T.fromFields(y, mo, d, H, M, Math.min(S, 59), fracNs) + (S === 60 ? NS_SEC : 0n);
    return { ns: local - BigInt(off || 0) * 60n * NS_SEC, offsetMin: off, digits: frac.length, hasTime: m[4] != null };
  };

  /** RFC 2822 / HTTP-date (Sun, 06 Nov 1994 08:49:37 GMT), 복수 형태 */
  T.parseRFC = function (str) {
    var s = String(str).trim().replace(/\([^)]*\)/g, '').trim();
    var m = /^(?:[A-Za-z]{3},\s*)?(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*(GMT|UTC|UT|Z|[+-]\d{4})?$/.exec(s);
    if (!m) return null;
    var mo = MON.map(function (x) { return x.toLowerCase(); }).indexOf(m[2].toLowerCase()) + 1;
    if (!mo) return null;
    var y = +m[3]; if (m[3].length === 2) y += y < 70 ? 2000 : 1900;
    var off = 0;
    if (m[7] && /^[+-]/.test(m[7])) off = (m[7][0] === '-' ? -1 : 1) * (+m[7].slice(1, 3) * 60 + +m[7].slice(3, 5));
    if (+m[1] > T.daysInMonth(y, mo)) return null;
    return { ns: T.fromFields(y, mo, +m[1], +m[4], +m[5], +(m[6] || 0), 0) - BigInt(off) * 60n * NS_SEC, offsetMin: off, digits: 0, hasTime: true };
  };

  /** 숫자 문자열 → BigInt (쉼표·공백·언더스코어 제거, 0x 지원) */
  T.toBig = function (str) {
    var s = String(str).trim().replace(/[,_\s]/g, '');
    if (!/^[+-]?(0x[0-9a-f]+|\d+)$/i.test(s)) throw new Error(t('정수를 입력하세요: ' + str, 'Enter an integer: ' + str));
    var neg = s[0] === '-'; s = s.replace(/^[+-]/, '');
    var b = BigInt(s);
    return neg ? -b : b;
  };
  T.isNumeric = function (str) { return /^[+-]?(0x[0-9a-f]+|[\d,_\s]+)$/i.test(String(str).trim()) && /\d/.test(str); };

  /** 시각 → 대표 형식 kv 목록 */
  T.formatsKV = function (ns, digits, offsetMin) {
    var f = T.fields(ns), ms = fdiv(ns, NS_MS), sec = fdiv(ns, NS_SEC);
    var rows = [
      [['ISO 8601 (UTC)', 'ISO 8601 (UTC)'], T.iso(ns, digits)],
      [['Unix 초', 'Unix seconds'], sec.toString() + (f.frac ? '.' + pad(f.frac, 9).slice(0, digits || 3) : '')],
      [['Unix 밀리초', 'Unix milliseconds'], ms.toString()],
      [['RFC 2822', 'RFC 2822'], T.rfc2822(ns, 0)],
      [['HTTP 날짜', 'HTTP date'], T.httpDate(ns)]
    ];
    if (offsetMin != null && offsetMin !== 0) rows.splice(1, 0, [['ISO 8601 (' + (offsetMin < 0 ? '-' : '+') + pad(Math.floor(Math.abs(offsetMin) / 60), 2) + ':' + pad(Math.abs(offsetMin) % 60, 2) + ')', 'ISO 8601 (offset)'], T.iso(ns, digits, offsetMin, 'offset')]);
    return rows;
  };
  /* ── 시간대 (Intl 사용) ── */
  var fmtCache = {};
  function dtf(tz) {
    if (!fmtCache[tz]) fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    return fmtCache[tz];
  }
  T.validZone = function (tz) { try { dtf(tz); return true; } catch (e) { return false; } };
  /** 해당 시각(ms, Number)에서 tz 의 UTC 오프셋(분) */
  T.zoneOffsetMin = function (ms, tz) {
    var p = {}; dtf(tz).formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
  };
  /** tz 의 벽시계 시각 → UTC 나노초. 반환 {ns, ambiguous, gap} */
  T.zonedToNs = function (y, m, d, H, M, S, fracNs, tz) {
    var wall = T.fromFields(y, m, d, H, M, S, fracNs), wallMs = Number(fdiv(wall, 1000000n));
    var o1 = T.zoneOffsetMin(wallMs, tz), guess = wallMs - o1 * 60000;
    var o2 = T.zoneOffsetMin(guess, tz), ns, ambiguous = false, gap = false;
    if (o1 === o2) {
      ns = wall - BigInt(o1) * 60n * NS_SEC;
      [-3, 3].forEach(function (h) {
        var alt = T.zoneOffsetMin(guess + h * 3600000, tz);
        if (alt !== o1 && T.zoneOffsetMin(wallMs - alt * 60000, tz) === alt) ambiguous = true;
      });
    } else {
      var guess2 = wallMs - o2 * 60000;
      if (T.zoneOffsetMin(guess2, tz) === o2) ns = wall - BigInt(o2) * 60n * NS_SEC;
      else { gap = true; ns = wall - BigInt(o1) * 60n * NS_SEC; }
    }
    return { ns: ns, ambiguous: ambiguous, gap: gap };
  };
  /** 나노초 → tz 의 "YYYY-MM-DD HH:mm:ss.fff" 와 오프셋 */
  T.inZone = function (ns, tz) {
    var off = tz === 'UTC' ? 0 : T.zoneOffsetMin(Number(fdiv(ns, 1000000n)), tz), f = T.fields(ns + BigInt(off) * 60n * NS_SEC), a = Math.abs(off);
    return { text: T.yearStr(f.y) + '-' + pad(f.m, 2) + '-' + pad(f.d, 2) + ' ' + pad(f.H, 2) + ':' + pad(f.M, 2) + ':' + pad(f.S, 2), offsetMin: off,
             offStr: 'UTC' + (off < 0 ? '-' : '+') + pad(Math.floor(a / 60), 2) + ':' + pad(a % 60, 2), dow: f.dow, days: f.days };
  };
})(typeof window !== 'undefined' ? window : globalThis);
