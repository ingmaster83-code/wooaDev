TK.tool('rrule-generator', {
  allowEmpty: true,
  inputs: [{ id: 'in', type: 'text', label: ['RRULE (iCalendar 반복 규칙)', 'RRULE (iCalendar recurrence rule)'], sample: 'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=6', placeholder: ['FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10', 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10'], show: function (o) { return o.mode === 'parse'; } }],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['parse', ['RRULE 분석', 'Parse an RRULE']], ['build', ['RRULE 만들기', 'Build an RRULE']]], default: 'parse' },
    { id: 'dtstart', type: 'text', label: ['시작 일시 DTSTART (ISO 8601)', 'Start DTSTART (ISO 8601)'], default: '2026-10-16T10:00:00' },
    { id: 'freq', type: 'select', label: ['반복 단위', 'Frequency'], choices: [['DAILY', ['매일', 'Daily']], ['WEEKLY', ['매주', 'Weekly']], ['MONTHLY', ['매월', 'Monthly']], ['YEARLY', ['매년', 'Yearly']], ['HOURLY', ['매시간', 'Hourly']], ['MINUTELY', ['매분', 'Minutely']]], default: 'WEEKLY', show: function (o) { return o.mode === 'build'; } },
    { id: 'interval', type: 'number', label: ['간격 (INTERVAL)', 'Interval'], default: 1, min: 1, show: function (o) { return o.mode === 'build'; } },
    { id: 'byday', type: 'text', label: ['BYDAY (예: MO,WE,FR · 1MO · -1FR)', 'BYDAY (e.g. MO,WE,FR · 1MO · -1FR)'], default: 'MO,WE,FR', show: function (o) { return o.mode === 'build'; } },
    { id: 'bymonthday', type: 'text', label: ['BYMONTHDAY (예: 1,15,-1)', 'BYMONTHDAY (e.g. 1,15,-1)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'bymonth', type: 'text', label: ['BYMONTH (예: 3,6,9,12)', 'BYMONTH (e.g. 3,6,9,12)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'bysetpos', type: 'text', label: ['BYSETPOS (예: -1)', 'BYSETPOS (e.g. -1)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'end', type: 'select', label: ['종료', 'End'], choices: [['none', ['끝없이', 'Never']], ['count', ['횟수 (COUNT)', 'After N times (COUNT)']], ['until', ['날짜 (UNTIL)', 'On a date (UNTIL)']]], default: 'count', show: function (o) { return o.mode === 'build'; } },
    { id: 'count', type: 'number', label: ['COUNT', 'COUNT'], default: 10, min: 1, show: function (o) { return o.mode === 'build' && o.end === 'count'; } },
    { id: 'until', type: 'text', label: ['UNTIL (ISO 8601)', 'UNTIL (ISO 8601)'], default: '2027-12-31T23:59:59', show: function (o) { return o.mode === 'build' && o.end === 'until'; } },
    { id: 'show', type: 'number', label: ['표시할 발생 횟수', 'Occurrences to list'], default: 12, min: 1, max: 100 }
  ],
  outputs: [{ id: 'out', label: ['RRULE', 'RRULE'], kind: 'code', ext: 'ics', download: false }, { id: 'kv', label: ['해석', 'Interpretation'], kind: 'kv' }, { id: 'table', label: ['발생 일시', 'Occurrences'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], DOWK = ['일', '월', '화', '수', '목', '금', '토'], DOWE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var text;
    if (o.mode === 'build') {
      var parts = ['FREQ=' + o.freq];
      if (o.interval > 1) parts.push('INTERVAL=' + Math.round(o.interval));
      [['BYDAY', o.byday], ['BYMONTHDAY', o.bymonthday], ['BYMONTH', o.bymonth], ['BYSETPOS', o.bysetpos]].forEach(function (p) { var x = String(p[1] || '').replace(/\s+/g, ''); if (x) parts.push(p[0] + '=' + x.toUpperCase()); });
      if (o.end === 'count') parts.push('COUNT=' + Math.round(o.count));
      if (o.end === 'until') { var u = T.parseISO(o.until || ''); if (!u) throw new Error(t('UNTIL 형식이 올바르지 않습니다', 'Invalid UNTIL')); parts.push('UNTIL=' + T.iso(u.ns, 0).replace(/[-:]/g, '').replace(/Z?$/, 'Z')); }
      text = parts.join(';');
    } else text = String(v.in || '').trim();
    if (!text) throw new Error(t('RRULE을 입력하세요', 'Enter an RRULE'));
    text = text.replace(/^[\s\S]*?(RRULE:)/i, '').replace(/^RRULE:/i, '');
    var R = {}, seen = {};
    text.split(';').filter(Boolean).forEach(function (kv) {
      var i = kv.indexOf('='); if (i < 0) throw new Error(t('KEY=VALUE 형식이 아닙니다: ' + kv, 'Not KEY=VALUE: ' + kv));
      var k = kv.slice(0, i).toUpperCase(), val = kv.slice(i + 1).toUpperCase();
      if (seen[k]) throw new Error(t(k + '이(가) 두 번 나옵니다', k + ' appears twice')); seen[k] = 1; R[k] = val;
    });
    var FREQS = ['SECONDLY', 'MINUTELY', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
    if (FREQS.indexOf(R.FREQ) < 0) throw new Error(t('FREQ가 없거나 올바르지 않습니다 (DAILY, WEEKLY, MONTHLY, YEARLY …)', 'FREQ is missing or invalid (DAILY, WEEKLY, MONTHLY, YEARLY …)'));
    if (R.COUNT && R.UNTIL) throw new Error(t('COUNT와 UNTIL은 함께 쓸 수 없습니다', 'COUNT and UNTIL cannot be used together'));
    var known = ['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'BYSETPOS', 'BYHOUR', 'BYMINUTE', 'BYSECOND', 'WKST', 'BYYEARDAY', 'BYWEEKNO'];
    Object.keys(R).forEach(function (k) { if (known.indexOf(k) < 0) throw new Error(t('알 수 없는 속성: ' + k, 'Unknown property: ' + k)); });
    if (R.BYYEARDAY || R.BYWEEKNO) throw new Error(t('BYYEARDAY·BYWEEKNO는 이 도구에서 지원하지 않습니다', 'BYYEARDAY and BYWEEKNO are not supported here'));
    function ints(s, min, max, name, allowNeg) {
      return s.split(',').map(function (x) { if (!/^[+-]?\d+$/.test(x)) throw new Error(t(name + ' 값이 올바르지 않습니다: ' + x, 'Invalid ' + name + ' value: ' + x)); var n = parseInt(x, 10); if (n === 0 || n < (allowNeg ? -max : min) || n > max) { if (!(min === 0 && n === 0)) throw new Error(t(name + ' 값이 범위를 벗어났습니다: ' + x, name + ' out of range: ' + x)); } return n; });
    }
    var interval = R.INTERVAL ? parseInt(R.INTERVAL, 10) : 1; if (!(interval >= 1)) throw new Error(t('INTERVAL은 1 이상이어야 합니다', 'INTERVAL must be at least 1'));
    var bymonth = R.BYMONTH ? ints(R.BYMONTH, 1, 12, 'BYMONTH', false) : null, bymd = R.BYMONTHDAY ? ints(R.BYMONTHDAY, 1, 31, 'BYMONTHDAY', true) : null, bysp = R.BYSETPOS ? ints(R.BYSETPOS, 1, 366, 'BYSETPOS', true) : null;
    var byhour = R.BYHOUR ? ints(R.BYHOUR, 0, 23, 'BYHOUR', false) : null, bymin = R.BYMINUTE ? ints(R.BYMINUTE, 0, 59, 'BYMINUTE', false) : null;
    var byday = null;
    if (R.BYDAY) byday = R.BYDAY.split(',').map(function (x) { var m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(x); if (!m) throw new Error(t('BYDAY 값이 올바르지 않습니다: ' + x, 'Invalid BYDAY value: ' + x)); return { n: m[1] ? parseInt(m[1], 10) : 0, d: DOW.indexOf(m[2]) }; });
    var wkst = R.WKST ? DOW.indexOf(R.WKST) : 1; if (wkst < 0) throw new Error(t('WKST가 올바르지 않습니다', 'Invalid WKST'));
    var ds = T.parseISO(String(o.dtstart || '').trim());
    if (!ds) throw new Error(t('DTSTART 형식이 올바르지 않습니다 (예: 2026-10-16T10:00:00)', 'Invalid DTSTART (e.g. 2026-10-16T10:00:00)'));
    var start = T.fields(ds.ns), until = null;
    if (R.UNTIL) { var us = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(R.UNTIL); if (!us) throw new Error(t('UNTIL 형식은 20271231T235959Z 입니다', 'UNTIL looks like 20271231T235959Z')); until = T.fromFields(+us[1], +us[2], +us[3], +(us[4] || 23), +(us[5] || 59), +(us[6] || 59), 0); }
    var maxCount = R.COUNT ? parseInt(R.COUNT, 10) : Infinity, show = Math.max(1, Math.min(100, Math.round(o.show) || 12));
    var times = [];
    var hs = byhour || [start.H], ms = bymin || [start.M];
    hs.slice().sort(function (a, b) { return a - b; }).forEach(function (h) { ms.slice().sort(function (a, b) { return a - b; }).forEach(function (mi) { times.push([h, mi, start.S]); }); });
    var F = R.FREQ, dim = T.daysInMonth;
    function dowOfD(y, m, d) { return ((T.daysFromCivil(y, m, d) % 7) + 11) % 7; }
    function matchDay(y, m, d, entry) {
      if (dowOfD(y, m, d) !== entry.d) return false;
      if (!entry.n) return true;
      if (entry.n > 0) return Math.floor((d - 1) / 7) + 1 === entry.n;
      return Math.floor((dim(y, m) - d) / 7) + 1 === -entry.n;
    }
    function monthDays(y, m) {
      var out = [], n = dim(y, m);
      for (var d = 1; d <= n; d++) {
        if (bymd && !bymd.some(function (x) { return x > 0 ? x === d : n + x + 1 === d; })) continue;
        if (byday && !byday.some(function (e) { return matchDay(y, m, d, e); })) continue;
        out.push(d);
      }
      return out;
    }
    var occ = [], total = 0, finished = false;
    function emit(y, m, d) {
      var list = [];
      times.forEach(function (tm) { list.push(T.fromFields(y, m, d, tm[0], tm[1], tm[2], 0)); });
      return list;
    }
    function push(ns) {
      if (ns < ds.ns) return true;
      if (until !== null && ns > until) { finished = true; return false; }
      total++;
      if (total > maxCount) { finished = true; return false; }
      if (occ.length < show) occ.push(ns);
      if (occ.length >= show || total >= maxCount) finished = true;
      return !finished;
    }
    function applySetPos(list) {
      if (!bysp) return list;
      var out = [];
      bysp.forEach(function (p) { var x = p > 0 ? list[p - 1] : list[list.length + p]; if (x !== undefined && out.indexOf(x) < 0) out.push(x); });
      return out.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    }
    var guard = 0;
    if (F === 'DAILY' || F === 'WEEKLY' || F === 'MONTHLY' || F === 'YEARLY') {
      var y = start.y, m = start.m, d = start.d, k = 0;
      while (!finished && guard++ < 20000) {
        var cands = [];
        if (F === 'DAILY') {
          var dd = T.civilFromDays(T.daysFromCivil(start.y, start.m, start.d) + k * interval);
          var ok = (!bymonth || bymonth.indexOf(dd.m) >= 0) && (!bymd || bymd.some(function (x) { var n = dim(dd.y, dd.m); return x > 0 ? x === dd.d : n + x + 1 === dd.d; })) && (!byday || byday.some(function (e) { return dowOfD(dd.y, dd.m, dd.d) === e.d; }));
          if (ok) cands = emit(dd.y, dd.m, dd.d);
        } else if (F === 'WEEKLY') {
          var sdays = T.daysFromCivil(start.y, start.m, start.d), sdow = dowOfD(start.y, start.m, start.d), back = (sdow - wkst + 7) % 7, wk0 = sdays - back + k * interval * 7;
          for (var i = 0; i < 7; i++) {
            var dc = T.civilFromDays(wk0 + i), wd = dowOfD(dc.y, dc.m, dc.d);
            var okw = byday ? byday.some(function (e) { return e.d === wd; }) : wd === sdow;
            if (okw && (!bymonth || bymonth.indexOf(dc.m) >= 0)) cands = cands.concat(emit(dc.y, dc.m, dc.d));
          }
        } else if (F === 'MONTHLY') {
          var mi0 = (start.y * 12 + start.m - 1) + k * interval, yy = Math.floor(mi0 / 12), mm = mi0 % 12 + 1;
          if (!bymonth || bymonth.indexOf(mm) >= 0) {
            var days = (bymd || byday) ? monthDays(yy, mm) : (start.d <= dim(yy, mm) ? [start.d] : []);
            days.forEach(function (x) { cands = cands.concat(emit(yy, mm, x)); });
          }
        } else {
          var yr = start.y + k * interval, months = bymonth || ((bymd || byday) && !bymonth && byday && byday.some(function (e) { return e.n; }) && !bymd ? null : [start.m]);
          if (months === null) { // 연 단위 서수 요일 (BYMONTH 없음)
            var all = [];
            byday.forEach(function (e) { var hits = []; for (var mo = 1; mo <= 12; mo++) for (var dy = 1; dy <= dim(yr, mo); dy++) if (dowOfD(yr, mo, dy) === e.d) hits.push([mo, dy]); var pick = e.n > 0 ? hits[e.n - 1] : hits[hits.length + e.n]; if (pick) all.push(pick); else if (!e.n) hits.forEach(function (h) { all.push(h); }); });
            all.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).forEach(function (h) { cands = cands.concat(emit(yr, h[0], h[1])); });
          } else {
            months.slice().sort(function (a, b) { return a - b; }).forEach(function (mo) {
              var days2 = (bymd || byday) ? monthDays(yr, mo) : (start.d <= dim(yr, mo) ? [start.d] : []);
              days2.forEach(function (x) { cands = cands.concat(emit(yr, mo, x)); });
            });
          }
        }
        cands.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
        applySetPos(cands).forEach(function (ns) { if (!finished) push(ns); });
        k++;
        if (until !== null && F !== 'WEEKLY') { /* until 은 push 에서 검사 */ }
        if (k > 12000) break;
      }
    } else {
      var stepNs = { HOURLY: 3600n, MINUTELY: 60n, SECONDLY: 1n }[F] * BigInt(interval) * T.NS_SEC, cur = ds.ns;
      while (!finished && guard++ < 200000) {
        var f = T.fields(cur), pass = (!bymonth || bymonth.indexOf(f.m) >= 0) && (!bymd || bymd.some(function (x) { var n = dim(f.y, f.m); return x > 0 ? x === f.d : n + x + 1 === f.d; })) && (!byday || byday.some(function (e) { return e.d === f.dow; })) && (!byhour || byhour.indexOf(f.H) >= 0) && (!bymin || bymin.indexOf(f.M) >= 0);
        if (pass) push(cur);
        cur += stepNs;
      }
    }
    // 설명
    var freqK = { SECONDLY: '초', MINUTELY: '분', HOURLY: '시간', DAILY: '일', WEEKLY: '주', MONTHLY: '개월', YEARLY: '년' }[F], freqE = { SECONDLY: 'second', MINUTELY: 'minute', HOURLY: 'hour', DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[F];
    var bits = [t(interval === 1 ? '매' + (F === 'MONTHLY' ? '월' : F === 'YEARLY' ? '년' : F === 'WEEKLY' ? '주' : F === 'DAILY' ? '일' : freqK) : interval + freqK + '마다', interval === 1 ? 'every ' + freqE : 'every ' + interval + ' ' + freqE + 's')];
    if (byday) bits.push(byday.map(function (e) { return (e.n ? (e.n > 0 ? t('제' + e.n, 'the ' + e.n + 'th ') : t('마지막' + (e.n < -1 ? ' ' + (-e.n) + '번째 전' : ''), e.n === -1 ? 'the last ' : 'the ' + (-e.n) + 'th-to-last ')) : '') + (TK.LANG ? DOWE[e.d] : DOWK[e.d] + '요일'); }).join(', '));
    if (bymd) bits.push(t(bymd.join(', ') + '일', 'on day ' + bymd.join(', ')));
    if (bymonth) bits.push(t(bymonth.join(', ') + '월', 'in month ' + bymonth.join(', ')));
    if (bysp) bits.push(t('조건에 맞는 날 중 ' + bysp.map(function (x) { return x > 0 ? x + '번째' : (x === -1 ? '마지막' : -x + '번째 전'); }).join(', '), 'taking position ' + bysp.join(', ') + ' of the matching set'));
    function pad(n) { return ('0' + n).slice(-2); }
    bits.push(times.map(function (tm) { return pad(tm[0]) + ':' + pad(tm[1]); }).join(', '));
    if (R.COUNT) bits.push(t('총 ' + R.COUNT + '회', R.COUNT + ' times in total')); if (R.UNTIL) bits.push(t(R.UNTIL + '까지', 'until ' + R.UNTIL));
    var warn = '';
    if (!R.COUNT && !R.UNTIL) warn = t(' (끝이 없는 규칙 — 앞의 ' + show + '개만 표시)', ' (open-ended rule — only the first ' + show + ' shown)');
    return { _status: t('✅ 올바른 RRULE입니다' + warn, '✅ Valid RRULE' + warn), out: 'RRULE:' + text,
      kv: [[['요약', 'Summary'], bits.join(' · ')], [['DTSTART (시작)', 'DTSTART'], T.iso(ds.ns, 0).replace('Z', '') + t(' (시간대 없는 로컬 시각)', ' (floating local time)')], [['발생 횟수(표시 한도 내)', 'Occurrences shown'], occ.length]],
      table: { head: [['#', '#'], ['일시', 'Date & time'], ['요일', 'Weekday']], rows: occ.map(function (ns, i) { var f2 = T.fields(ns); return [i + 1, T.iso(ns, 0).replace('Z', '').replace('T', ' '), TK.LANG ? DOWE[f2.dow] : DOWK[f2.dow]]; }), empty: ['조건에 맞는 발생이 없습니다', 'No occurrences match'] } };
  }
});
