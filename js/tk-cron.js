/* WooaDev Tool Kit — cron 계열 파서/실행 시각 계산 (unix · Jenkins · Quartz · AWS EventBridge) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var C = TK.cron = TK.cron || {};
  var t = function (a, b) { return TK.t(a, b); };
  var MONN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var DOWN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
  C.DOW_KO = DOW_KO; C.DOWN = DOWN;

  function fail(msg) { throw new Error(msg); }

  /** Java String.hashCode + 간단한 LCG — 이름으로 H(해시)를 결정적으로 고르기 위한 용도(Jenkins 실제 값과는 다를 수 있음) */
  function nameHash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h >>> 0; }
  function pickH(seed, lo, hi, salt) { var x = (nameHash(seed + '#' + salt) * 2654435761) >>> 0; return lo + (x % (hi - lo + 1)); }

  /**
   * 필드 하나를 파싱해 {any, list, ...} 반환.
   * opts: {min,max,names,name,allowH,hseed,hsalt,quartz,dom,dow,allowQ}
   */
  function field(str, o) {
    var s = String(str).trim(), res = { any: false, list: [], L: false, W: [], LW: false, nth: [], lastDow: [], raw: s };
    if (s === '') fail(t(o.label + ' 필드가 비어 있습니다', o.label + ' field is empty'));
    if (s === '*' || (s === '?' && o.allowQ)) { res.any = true; res.q = s === '?'; return res; }
    if (s === '?') fail(t('? 는 이 형식에서 사용할 수 없습니다', '? is not allowed in this format'));
    var set = {};
    function num(x, isRange) {
      var u = x.toUpperCase();
      if (o.names) { var i = o.names.indexOf(u.slice(0, 3)); if (i >= 0 && /^[A-Z]{3}$/.test(u)) return i + (o.nameBase || 0); }
      if (!/^\d+$/.test(x)) fail(t(o.label + ' 필드의 값이 올바르지 않습니다: ' + x, 'Invalid value in ' + o.label + ': ' + x));
      return parseInt(x, 10);
    }
    function addRange(a, b, step) {
      if (a > b) fail(t(o.label + ': 범위가 거꾸로입니다 (' + a + '-' + b + ')', o.label + ': reversed range (' + a + '-' + b + ')'));
      for (var v = a; v <= b; v += step) set[v] = 1;
    }
    s.split(',').forEach(function (item) {
      item = item.trim();
      var m;
      if (o.dom && o.quartz) {
        if (item === 'L') { res.L = true; return; }
        if (item === 'LW') { res.LW = true; return; }
        if ((m = /^(\d{1,2})W$/i.exec(item))) { var d = +m[1]; if (d < 1 || d > 31) fail(t('W 앞의 날짜는 1~31이어야 합니다', 'The day before W must be 1–31')); res.W.push(d); return; }
        if ((m = /^L-(\d+)$/.exec(item))) { res.Loff = +m[1]; return; }
      }
      if (o.dow && o.quartz) {
        if ((m = /^([A-Za-z0-9]+)#(\d)$/.exec(item))) { var dv = num(m[1]); if (dv < o.min || dv > o.max) fail(t('# 앞의 요일 값이 범위를 벗어났습니다', 'Weekday before # is out of range')); if (+m[2] < 1 || +m[2] > 5) fail(t('# 뒤의 주차는 1~5입니다', 'The nth after # must be 1–5')); res.nth.push([dv, +m[2]]); return; }
        if ((m = /^([A-Za-z0-9]+)L$/.exec(item)) && item !== 'L') { var dl = num(m[1]); res.lastDow.push(dl); return; }
        if (item === 'L') { set[o.max] = 1; return; }
      }
      // H (Jenkins)
      if (o.allowH && /^H/.test(item)) {
        var hm = /^H(?:\((\d+)-(\d+)\))?(?:\/(\d+))?$/.exec(item);
        if (!hm) fail(t('H 표기가 올바르지 않습니다: ' + item, 'Invalid H notation: ' + item));
        var lo = hm[1] !== undefined ? +hm[1] : o.min, hi = hm[2] !== undefined ? +hm[2] : o.max, step = hm[3] ? +hm[3] : 0;
        if (lo < o.min || hi > o.max || lo > hi) fail(t(o.label + ': H 범위가 올바르지 않습니다', o.label + ': invalid H range'));
        res.hashed = true;
        if (step) { var off = pickH(o.hseed || '', 0, step - 1, o.label); for (var v = lo + off; v <= hi; v += step) set[v] = 1; }
        else set[pickH(o.hseed || '', lo, hi, o.label)] = 1;
        return;
      }
      if ((m = /^\*\/(\d+)$/.exec(item))) { var st = +m[1]; if (!st) fail(t('간격은 1 이상이어야 합니다', 'Step must be at least 1')); addRange(o.min, o.max, st); return; }
      if ((m = /^([A-Za-z0-9]+)-([A-Za-z0-9]+)(?:\/(\d+))?$/.exec(item))) { var a = num(m[1]), b = num(m[2]), st2 = m[3] ? +m[3] : 1; if (!st2) fail(t('간격은 1 이상이어야 합니다', 'Step must be at least 1')); if (a < o.min || b > o.max) fail(t(o.label + ' 값은 ' + o.min + '~' + o.max + ' 범위여야 합니다 (' + item + ')', o.label + ' must be ' + o.min + '–' + o.max + ' (' + item + ')')); addRange(a, b, st2); return; }
      if ((m = /^([A-Za-z0-9]+)\/(\d+)$/.exec(item))) { var a2 = num(m[1]), st3 = +m[2]; if (!st3) fail(t('간격은 1 이상이어야 합니다', 'Step must be at least 1')); if (a2 < o.min || a2 > o.max) fail(t(o.label + ' 값이 범위를 벗어났습니다: ' + item, o.label + ' out of range: ' + item)); addRange(a2, o.max, st3); return; }
      var v1 = num(item);
      if (v1 < o.min || v1 > o.max) fail(t(o.label + ' 값은 ' + o.min + '~' + o.max + ' 범위여야 합니다 (' + item + ')', o.label + ' must be ' + o.min + '–' + o.max + ' (' + item + ')'));
      set[v1] = 1;
    });
    res.list = Object.keys(set).map(Number).sort(function (x, y) { return x - y; });
    return res;
  }

  var ALIASES = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
  var JALIASES = { '@yearly': 'H H H H *', '@annually': 'H H H H *', '@monthly': 'H H H * *', '@weekly': 'H H * * H', '@daily': 'H H * * *', '@midnight': 'H H(0-2) * * *', '@hourly': 'H * * * *' };

  /** kind: unix | jenkins | quartz | aws.  반환 spec */
  C.parse = function (kind, text, opts) {
    opts = opts || {};
    var s = String(text).trim().replace(/\s+/g, ' ');
    if (kind === 'aws') {
      var m = /^cron\((.*)\)$/i.exec(s); if (m) s = m[1].trim();
    }
    if (kind === 'unix' && ALIASES[s.toLowerCase()]) s = ALIASES[s.toLowerCase()];
    if (kind === 'jenkins' && JALIASES[s.toLowerCase()]) s = JALIASES[s.toLowerCase()];
    var f = s.split(' ');
    var expect = { unix: [5], jenkins: [5], quartz: [6, 7], aws: [6] }[kind];
    if (expect.indexOf(f.length) < 0) fail(t(kind === 'quartz' ? 'Quartz cron은 6개(초 분 시 일 월 요일) 또는 7개(+연도) 필드가 필요합니다 (현재 ' + f.length + '개)' : kind === 'aws' ? 'EventBridge cron은 6개 필드(분 시 일 월 요일 연도)가 필요합니다 (현재 ' + f.length + '개)' : 'cron은 5개 필드(분 시 일 월 요일)가 필요합니다 (현재 ' + f.length + '개)',
      kind === 'quartz' ? 'Quartz cron needs 6 (sec min hour dom mon dow) or 7 (+year) fields (found ' + f.length + ')' : kind === 'aws' ? 'EventBridge cron needs 6 fields (min hour dom mon dow year); found ' + f.length : 'cron needs 5 fields (min hour dom mon dow); found ' + f.length));
    var hasSec = kind === 'quartz', i = 0, spec = { kind: kind, text: s };
    var quartzLike = kind === 'quartz' || kind === 'aws', allowH = kind === 'jenkins', seed = opts.seed || '';
    var base = { allowH: allowH, hseed: seed };
    if (hasSec) spec.sec = field(f[i++], Object.assign({ min: 0, max: 59, label: t('초', 'Second') }, base));
    spec.min = field(f[i++], Object.assign({ min: 0, max: 59, label: t('분', 'Minute') }, base));
    spec.hour = field(f[i++], Object.assign({ min: 0, max: 23, label: t('시', 'Hour') }, base));
    spec.dom = field(f[i++], Object.assign({ min: 1, max: 31, label: t('일', 'Day of month'), dom: true, quartz: quartzLike, allowQ: quartzLike }, base));
    spec.month = field(f[i++], Object.assign({ min: 1, max: 12, label: t('월', 'Month'), names: MONN, nameBase: 1 }, base));
    var dowo = quartzLike ? { min: 1, max: 7, label: t('요일', 'Day of week'), names: DOWN, nameBase: 1, dow: true, quartz: true, allowQ: true } : { min: 0, max: 7, label: t('요일', 'Day of week'), names: DOWN, nameBase: 0, dow: true };
    spec.dow = field(f[i++], Object.assign(dowo, base));
    // 요일을 0(일)~6(토)로 통일
    function normDow(v) { return quartzLike ? v - 1 : (v === 7 ? 0 : v); }
    spec.dow.list = spec.dow.list.map(normDow).filter(function (x, idx, a) { return a.indexOf(x) === idx; }).sort(function (a, b) { return a - b; });
    spec.dow.nth = spec.dow.nth.map(function (p) { return [normDow(p[0]), p[1]]; });
    spec.dow.lastDow = spec.dow.lastDow.map(normDow);
    if (kind === 'quartz' || kind === 'aws') {
      if (f.length - i >= 1) spec.year = field(f[i++], { min: 1970, max: 2199, label: t('연도', 'Year') });
      if (quartzLike) {
        var dq = spec.dom.q, wq = spec.dow.q;
        if (!dq && !wq) fail(t('일(日)과 요일 중 하나는 반드시 ? 여야 합니다 (둘 다 지정할 수 없음)', 'Either day-of-month or day-of-week must be ? (both cannot be specified)'));
        if (dq && wq) fail(t('일과 요일을 모두 ? 로 둘 수 없습니다', 'Day-of-month and day-of-week cannot both be ?'));
      }
    }
    spec.orMode = !quartzLike;
    return spec;
  };

  function lastDay(y, m) { return TK.time.daysInMonth(y, m); }
  function dowOf(y, m, d) { return ((TK.time.daysFromCivil(y, m, d) % 7) + 11) % 7; }
  function nearestWeekday(y, m, d) {
    var ld = lastDay(y, m); if (d > ld) return -1;
    var w = dowOf(y, m, d);
    if (w === 6) return d === 1 ? 3 : d - 1;
    if (w === 0) return d === ld ? d - 2 : d + 1;
    return d;
  }
  function domMatch(sp, y, m, d) {
    var f = sp.dom;
    if (f.any) return true;
    if (f.list.indexOf(d) >= 0) return true;
    var ld = lastDay(y, m);
    if (f.L && d === ld) return true;
    if (f.Loff !== undefined && d === ld - f.Loff) return true;
    if (f.LW) { var w = dowOf(y, m, ld); var target = w === 6 ? ld - 1 : w === 0 ? ld - 2 : ld; if (d === target) return true; }
    for (var i = 0; i < f.W.length; i++) if (nearestWeekday(y, m, f.W[i]) === d) return true;
    return false;
  }
  function dowMatch(sp, y, m, d) {
    var f = sp.dow;
    if (f.any) return true;
    var w = dowOf(y, m, d);
    if (f.list.indexOf(w) >= 0) return true;
    for (var i = 0; i < f.nth.length; i++) if (f.nth[i][0] === w && Math.floor((d - 1) / 7) + 1 === f.nth[i][1]) return true;
    for (var j = 0; j < f.lastDow.length; j++) if (f.lastDow[j] === w && d + 7 > lastDay(y, m)) return true;
    return false;
  }
  function dayMatch(sp, y, m, d) {
    if (sp.month.list.length && !sp.month.any && sp.month.list.indexOf(m) < 0) return false;
    if (sp.year && !sp.year.any && sp.year.list.indexOf(y) < 0) return false;
    var dm = domMatch(sp, y, m, d), wm = dowMatch(sp, y, m, d);
    if (sp.dom.any || sp.dow.any) return dm && wm;
    return sp.orMode ? (dm || wm) : (dm && wm);
  }
  function vals(f, min, max) { if (f.any) { var a = []; for (var v = min; v <= max; v++) a.push(v); return a; } return f.list; }

  /** 다음 실행 시각 목록(UTC ns, BigInt). fromNs 이후(미포함). tz: IANA 이름 */
  C.next = function (spec, fromNs, count, tz) {
    var T = TK.time, out = [], tzn = tz || 'UTC';
    var off0 = tzn === 'UTC' ? 0 : T.zoneOffsetMin(Number(T.fdiv(fromNs, 1000000n)), tzn);
    var w0 = T.fields(fromNs + BigInt(off0) * 60n * T.NS_SEC);
    var secs = spec.sec ? vals(spec.sec, 0, 59) : [0], mins = vals(spec.min, 0, 59), hours = vals(spec.hour, 0, 23);
    var y = w0.y, m = w0.m, d = w0.d, guard = 0, first = true;
    while (out.length < count && guard++ < 366 * 12) {
      if (dayMatch(spec, y, m, d)) {
        for (var hi = 0; hi < hours.length && out.length < count; hi++)
          for (var mi = 0; mi < mins.length && out.length < count; mi++)
            for (var si = 0; si < secs.length && out.length < count; si++) {
              var z = tzn === 'UTC' ? { ns: T.fromFields(y, m, d, hours[hi], mins[mi], secs[si], 0), gap: false } : T.zonedToNs(y, m, d, hours[hi], mins[mi], secs[si], 0, tzn);
              if (z.gap) continue;
              if (z.ns > fromNs) out.push(z.ns);
            }
      }
      d++; if (d > lastDay(y, m)) { d = 1; m++; if (m > 12) { m = 1; y++; } }
      first = false;
    }
    return out;
  };

  /* ── 사람이 읽는 설명 ── */
  function ranges(list) {
    var out = [], i = 0;
    while (i < list.length) { var j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++; out.push(j - i >= 2 ? list[i] + '–' + list[j] : list.slice(i, j + 1).join(', ')); i = j + 1; }
    return out.join(', ');
  }
  function step(list) { if (list.length < 3) return 0; var d = list[1] - list[0]; for (var i = 2; i < list.length; i++) if (list[i] - list[i - 1] !== d) return 0; return d; }
  C.fieldText = function (f, min, max, unitKo, unitEn, namer) {
    var ANY = { '초': '매초', '분': '매분', '시간': '매시간', '일': '매일', '월': '매월', '요일': '모든 요일' };
    if (f.any) return t(ANY[unitKo] || '매 ' + unitKo, 'every ' + unitEn);
    var parts = [];
    if (f.list.length) {
      var stp = step(f.list), full = f.list.length === max - min + 1;
      if (full) parts.push(t(ANY[unitKo] || '매 ' + unitKo, 'every ' + unitEn));
      else if (stp > 1 && f.list[0] <= min + stp - 1 && f.list[f.list.length - 1] + stp > max) parts.push(t(stp + unitKo + '마다 (' + (namer ? f.list.map(namer).join(', ') : f.list.join(', ')) + ')', 'every ' + stp + ' ' + unitEn + 's (' + (namer ? f.list.map(namer).join(', ') : f.list.join(', ')) + ')'));
      else if (namer) {
        var segs = [], i2 = 0, L = f.list;
        while (i2 < L.length) { var j2 = i2; while (j2 + 1 < L.length && L[j2 + 1] === L[j2] + 1) j2++; segs.push(j2 - i2 >= 2 ? namer(L[i2]) + '–' + namer(L[j2]) : L.slice(i2, j2 + 1).map(namer).join(', ')); i2 = j2 + 1; }
        parts.push(segs.join(', '));
      } else parts.push(ranges(f.list));
    }
    if (f.L) parts.push(t('마지막 날', 'last day'));
    if (f.Loff !== undefined) parts.push(t('마지막 날 ' + f.Loff + '일 전', f.Loff + ' day(s) before the last day'));
    if (f.LW) parts.push(t('마지막 평일', 'last weekday'));
    f.W.forEach(function (d) { parts.push(t(d + '일에 가장 가까운 평일', 'weekday nearest day ' + d)); });
    f.nth.forEach(function (p) { parts.push(t('매월 ' + p[1] + '번째 ' + DOW_KO[p[0]] + '요일', 'the ' + p[1] + 'th ' + DOWN[p[0]] + ' of the month')); });
    f.lastDow.forEach(function (w) { parts.push(t('마지막 ' + DOW_KO[w] + '요일', 'last ' + DOWN[w])); });
    return parts.join(' · ');
  };
  C.describeRows = function (spec) {
    var rows = [];
    if (spec.sec) rows.push([[ '초', 'Second' ], C.fieldText(spec.sec, 0, 59, '초', 'second')]);
    rows.push([['분', 'Minute'], C.fieldText(spec.min, 0, 59, '분', 'minute')]);
    rows.push([['시', 'Hour'], C.fieldText(spec.hour, 0, 23, '시간', 'hour')]);
    rows.push([['일', 'Day of month'], spec.dom.any ? (spec.dom.q ? t('지정 안 함(?)', 'not specified (?)') : t('매일', 'every day')) : C.fieldText(spec.dom, 1, 31, '일', 'day')]);
    rows.push([['월', 'Month'], C.fieldText(spec.month, 1, 12, '월', 'month', function (v) { return MONN[v - 1]; })]);
    rows.push([['요일', 'Day of week'], spec.dow.any ? (spec.dow.q ? t('지정 안 함(?)', 'not specified (?)') : t('모든 요일', 'every weekday')) : C.fieldText(spec.dow, 0, 6, '요일', 'weekday', function (v) { return TK.LANG ? DOWN[v] : DOW_KO[v]; })]);
    if (spec.year) rows.push([['연도', 'Year'], spec.year.any ? t('매년', 'every year') : spec.year.list.join(', ')]);
    return rows;
  };
  /** 한 문장 요약 */
  C.summary = function (spec) {
    function two(n) { return ('0' + n).slice(-2); }
    var minAll = spec.min.any, hourAll = spec.hour.any, mins = spec.min.list, hours = spec.hour.list, parts = [];
    var timeTxt;
    if (spec.sec && spec.sec.list.length && !spec.sec.any && !(spec.sec.list.length === 1 && spec.sec.list[0] === 0) && minAll && hourAll) timeTxt = t('초 필드 ' + spec.sec.raw + '에 맞춰 매분', 'at second ' + spec.sec.raw + ' of every minute');
    else if (minAll && hourAll) timeTxt = t('매분', 'every minute');
    else if (!minAll && hourAll && step(mins) > 0 && mins[0] < step(mins) && mins.length >= 3) timeTxt = t('매 ' + step(mins) + '분마다', 'every ' + step(mins) + ' minutes');
    else if (!minAll && hourAll && mins.length === 1) timeTxt = t('매시 ' + mins[0] + '분', 'at minute ' + mins[0] + ' of every hour');
    else if (!minAll && !hourAll && mins.length === 1 && hours.length <= 4) timeTxt = hours.map(function (h) { return two(h) + ':' + two(mins[0]); }).join(', ');
    else if (!minAll && !hourAll && mins.length === 1) timeTxt = t(ranges(hours) + '시의 ' + mins[0] + '분', 'minute ' + mins[0] + ' of hours ' + ranges(hours));
    else if (!minAll && !hourAll) {
      var hTxt = hours.length === 1 ? hours[0] + t('시', ':00 hour') : ranges(hours) + t('시', 'h'), mTxt = step(mins) > 0 && mins.length >= 3 ? t(step(mins) + '분마다 (' + mins.join(', ') + '분)', 'every ' + step(mins) + ' min (' + mins.join(', ') + ')') : t(mins.join(', ') + '분', 'minute ' + mins.join(', '));
      timeTxt = hTxt + ' · ' + mTxt;
    } else timeTxt = t('분 ' + (minAll ? '매분' : ranges(mins)) + ' / 시 ' + (hourAll ? '매시' : ranges(hours)), 'minutes ' + (minAll ? 'every' : ranges(mins)) + ' / hours ' + (hourAll ? 'every' : ranges(hours)));
    var dayTxt;
    var domR = !spec.dom.any, dowR = !spec.dow.any;
    if (!domR && !dowR) dayTxt = t('매일', 'every day');
    else {
      var a = domR ? C.fieldText(spec.dom, 1, 31, '일', 'day') : '', b = dowR ? C.fieldText(spec.dow, 0, 6, '요일', 'weekday', function (v) { return TK.LANG ? DOWN[v] : DOW_KO[v]; }) : '';
      dayTxt = domR && dowR ? t('매월 ' + a + ' 또는 ' + b + '요일', a + ' or ' + b) : domR ? t('매월 ' + a + (/^\d/.test(a) && !/일$/.test(a) ? '일' : ''), 'on day ' + a + ' of the month') : t('매주 ' + b + (/^[월화수목금토일]$/.test(b) ? '요일' : ''), 'every ' + b);
    }
    var monTxt = spec.month.any ? '' : t(C.fieldText(spec.month, 1, 12, '월', 'month', function (v) { return v + '월'; }).replace(/ ?, ?/g, ', ') + ' ', C.fieldText(spec.month, 1, 12, '월', 'month', function (v) { return MONN[v - 1]; }) + ': ');
    var yearTxt = spec.year && !spec.year.any ? t(spec.year.list.join(', ') + '년 ', 'in ' + spec.year.list.join(', ') + ': ') : '';
    return yearTxt + monTxt + dayTxt + ' ' + timeTxt;
  };
  /** cron 계열 도구 공통 틀: cfg = {kind, sample, placeholder, tz, presets:[[key,[ko,en],expr]], inLabel} */
  C.makeTool = function (slug, cfg) {
    var opts = [
      { id: 'preset', type: 'select', label: ['프리셋', 'Preset'], choices: [['custom', ['직접 입력', 'Custom']]].concat(cfg.presets.map(function (p) { return [p[0], p[1]]; })), default: 'custom' },
      { id: 'tz', type: 'text', label: ['표시 시간대 (IANA)', 'Display time zone (IANA)'], default: cfg.tz },
      { id: 'count', type: 'number', label: ['다음 실행 개수', 'How many runs'], default: 8, min: 1, max: 50 },
      { id: 'from', type: 'text', label: ['기준 시각 (ISO 8601, 비우면 지금)', 'Start from (ISO 8601, empty = now)'], default: '' }
    ];
    if (cfg.kind === 'jenkins') opts.splice(2, 0, { id: 'job', type: 'text', label: ['잡 이름 (H 분산 계산용)', 'Job name (for H spreading)'], default: 'my-job' });
    TK.tool(slug, {
      allowEmpty: true,
      inputs: [{ id: 'in', type: 'text', label: cfg.inLabel, sample: cfg.sample, placeholder: cfg.placeholder, show: function (o) { return o.preset === 'custom'; } }],
      options: opts,
      outputs: [{ id: 'kv', label: ['해석', 'Interpretation'], kind: 'kv' }, { id: 'table', label: ['다음 실행 시각', 'Upcoming runs'], kind: 'table' }, { id: 'out', label: ['정규화된 표현식', 'Normalised expression'], kind: 'code', download: false }],
      run: function (v, o, t) {
        var T = TK.time, expr;
        if (o.preset !== 'custom') expr = cfg.presets.filter(function (p) { return p[0] === o.preset; })[0][2];
        else expr = String(v.in || '').trim();
        if (!expr) throw new Error(t('표현식을 입력하거나 프리셋을 고르세요', 'Enter an expression or choose a preset'));
        var tz = (o.tz || 'UTC').trim() || 'UTC';
        if (!T.validZone(tz)) throw new Error(t('알 수 없는 시간대입니다: ' + tz, 'Unknown time zone: ' + tz));
        var from;
        if (o.from && o.from.trim()) { var pf = T.parseISO(o.from.trim()); if (!pf) throw new Error(t('기준 시각 형식이 올바르지 않습니다', 'Invalid start time')); from = pf.ns; } else from = BigInt(Date.now()) * 1000000n;
        var count = Math.max(1, Math.min(50, Math.round(o.count) || 8)), rows, kv, normal;
        if (cfg.kind === 'aws' && /^rate\(/i.test(expr)) {
          var m = /^rate\(\s*(\d+)\s+(minute|minutes|hour|hours|day|days)\s*\)$/i.exec(expr);
          if (!m) throw new Error(t('rate 식은 rate(값 단위) 형식이어야 합니다. 예: rate(5 minutes), rate(1 hour)', 'rate expressions look like rate(value unit), e.g. rate(5 minutes) or rate(1 hour)'));
          var val = +m[1], unit = m[2].toLowerCase().replace(/s$/, '');
          if (val < 1) throw new Error(t('값은 1 이상이어야 합니다', 'The value must be at least 1'));
          if ((val === 1) !== !/s$/i.test(m[2])) throw new Error(t('값이 1이면 단수(minute/hour/day), 1보다 크면 복수(minutes/hours/days)를 써야 합니다', 'Use the singular unit for 1 (minute/hour/day) and the plural for more'));
          var step = BigInt(val * { minute: 60, hour: 3600, day: 86400 }[unit]) * T.NS_SEC;
          rows = []; for (var i = 1; i <= count; i++) { var ns = from + step * BigInt(i); var z = T.inZone(ns, tz); rows.push([i, T.iso(ns, 0), z.text + ' (' + z.offStr + ')']); }
          kv = [[['종류', 'Type'], t('고정 간격 (rate)', 'Fixed rate')], [['간격', 'Interval'], val + ' ' + unit + (val > 1 ? 's' : '')], [['요약', 'Summary'], t('매 ' + val + { minute: '분', hour: '시간', day: '일' }[unit] + '마다', 'every ' + val + ' ' + unit + (val > 1 ? 's' : ''))]];
          normal = 'rate(' + val + ' ' + m[2].toLowerCase() + ')';
        } else {
          var spec = C.parse(cfg.kind, expr, { seed: o.job || '' }), runs = C.next(spec, from, count, tz);
          rows = runs.map(function (ns, i) { var z = T.inZone(ns, tz); return [i + 1, T.iso(ns, 0), z.text + ' (' + z.offStr + ')']; });
          kv = [[['한 줄 요약', 'Summary'], C.summary(spec)]].concat(C.describeRows(spec));
          if (spec.min.hashed || spec.hour.hashed || spec.dom.hashed || spec.month.hashed || spec.dow.hashed) kv.push([['H 안내', 'About H'], t('H는 Jenkins가 잡마다 범위 안의 값을 하나씩 고정해 부하를 분산합니다. 위 시각은 잡 이름 "' + (o.job || '') + '"로 계산한 예시이며 실제 Jenkins가 고른 값과 다를 수 있습니다.', 'H lets Jenkins pick one fixed value per job within the range. The times above are an illustration for the job name "' + (o.job || '') + '" and may differ from what Jenkins actually chooses.')]);
          normal = (cfg.kind === 'aws' ? 'cron(' + spec.text + ')' : spec.text);
          if (!rows.length) kv.push([['실행 없음', 'No runs'], t('앞으로 10년 안에 실행되는 시각이 없습니다 (달력에 없는 날짜일 수 있음)', 'No run in the next 10 years (the date may not exist in the calendar)')]);
        }
        return { _status: t('✅ 올바른 ' + cfg.label[0] + ' 표현식입니다', '✅ Valid ' + cfg.label[1] + ' expression'), kv: kv, table: { head: [['#', '#'], ['UTC', 'UTC'], ['선택한 시간대', 'Selected zone']], rows: rows }, out: normal };
      }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
