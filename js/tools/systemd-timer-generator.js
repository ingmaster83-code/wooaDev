TK.tool('systemd-timer-generator', {
  inputs: [{ id: 'in', type: 'text', label: ['OnCalendar 식', 'OnCalendar expression'], sample: 'Mon..Fri *-*-* 09:00:00', placeholder: ['daily · weekly · *-*-* 02:30:00 · Mon *-*-01..07 04:00', 'daily · weekly · *-*-* 02:30:00 · Mon *-*-01..07 04:00'] }],
  options: [
    { id: 'tz', type: 'text', label: ['표시 시간대 (IANA)', 'Display time zone (IANA)'], default: 'Asia/Seoul' },
    { id: 'count', type: 'number', label: ['다음 실행 개수', 'How many runs'], default: 6, min: 1, max: 40 },
    { id: 'from', type: 'text', label: ['기준 시각 (ISO 8601, 비우면 지금)', 'Start from (ISO 8601, empty = now)'], default: '' },
    { id: 'unit', type: 'text', label: ['서비스 이름', 'Service name'], default: 'backup' },
    { id: 'cmd', type: 'text', label: ['실행할 명령 (ExecStart)', 'Command (ExecStart)'], default: '/usr/local/bin/backup.sh' },
    { id: 'persistent', type: 'checkbox', label: ['Persistent=true (꺼져 있던 동안 놓친 실행 보충)', 'Persistent=true (catch up on missed runs)'], default: true },
    { id: 'delay', type: 'text', label: ['RandomizedDelaySec (예: 5m, 비우면 없음)', 'RandomizedDelaySec (e.g. 5m, empty = none)'], default: '' }
  ],
  outputs: [{ id: 'kv', label: ['해석', 'Interpretation'], kind: 'kv' }, { id: 'table', label: ['다음 실행 시각', 'Upcoming runs'], kind: 'table' }, { id: 'out', label: ['유닛 파일', 'Unit files'], kind: 'code', ext: 'timer' }],
  run: function (v, o, t) {
    var T = TK.time, expr0 = String(v.in || '').trim();
    if (!expr0) throw new Error(t('OnCalendar 식을 입력하세요', 'Enter an OnCalendar expression'));
    var tz = (o.tz || 'UTC').trim() || 'UTC';
    if (!T.validZone(tz)) throw new Error(t('알 수 없는 시간대입니다: ' + tz, 'Unknown time zone: ' + tz));
    var SHORT = { minutely: '*-*-* *:*:00', hourly: '*-*-* *:00:00', daily: '*-*-* 00:00:00', weekly: 'Mon *-*-* 00:00:00', monthly: '*-*-01 00:00:00', quarterly: '*-01,04,07,10-01 00:00:00', semiannually: '*-01,07-01 00:00:00', yearly: '*-01-01 00:00:00', annually: '*-01-01 00:00:00' };
    var expr = SHORT[expr0.toLowerCase()] || expr0;
    var DOWS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    function comp(str, min, max, label, allowLast) {
      // 값 목록: *, a, a..b, a/n, a..b/n, 쉼표 구분
      var set = {}, all = false;
      str.split(',').forEach(function (item) {
        var m;
        if (item === '*') { all = true; return; }
        if ((m = /^\*\/(\d+)$/.exec(item))) { for (var x = min; x <= max; x += +m[1]) set[x] = 1; return; }
        if ((m = /^(\d+)\.\.(\d+)(?:\/(\d+))?$/.exec(item))) { var a = +m[1], b = +m[2], st = m[3] ? +m[3] : 1; if (a > b || a < min || b > max) throw new Error(t(label + ' 범위가 올바르지 않습니다: ' + item, 'Invalid ' + label + ' range: ' + item)); for (var y = a; y <= b; y += st) set[y] = 1; return; }
        if ((m = /^(\d+)\/(\d+)$/.exec(item))) { for (var z = +m[1]; z <= max; z += +m[2]) set[z] = 1; return; }
        if (/^\d+$/.test(item)) { if (+item < min || +item > max) throw new Error(t(label + ' 값은 ' + min + '~' + max + ' 이어야 합니다: ' + item, label + ' must be ' + min + '–' + max + ': ' + item)); set[+item] = 1; return; }
        throw new Error(t(label + ' 형식이 올바르지 않습니다: ' + item, 'Invalid ' + label + ' syntax: ' + item));
      });
      return { all: all && !Object.keys(set).length, list: Object.keys(set).map(Number).sort(function (a, b) { return a - b; }) };
    }
    // 요일 · 날짜 · 시간 분리
    var parts = expr.split(/\s+/), dowPart = null, datePart = '*-*-*', timePart = null;
    parts.forEach(function (p) {
      if (/^[A-Za-z]/.test(p)) dowPart = p; else if (/^[\d*].*-.*-/.test(p) || /^\*-/.test(p) || /^\d+-\d+$/.test(p)) datePart = p; else if (/:/.test(p) || /^[\d*]+$/.test(p) && false) timePart = p; else throw new Error(t('해석할 수 없는 부분: ' + p, 'Cannot parse: ' + p));
    });
    if (timePart === null) timePart = (datePart === '*-*-*' && !dowPart && expr !== SHORT[expr0.toLowerCase()]) ? '00:00:00' : '00:00:00';
    var dw = { all: true, list: [] };
    if (dowPart) {
      var ds = {};
      dowPart.split(',').forEach(function (item) {
        var m = /^([A-Za-z]+)(?:\.\.([A-Za-z]+))?$/.exec(item);
        if (!m) throw new Error(t('요일 형식이 올바르지 않습니다: ' + item, 'Invalid weekday: ' + item));
        var a = DOWS.indexOf(m[1].slice(0, 3).toLowerCase()), b = m[2] ? DOWS.indexOf(m[2].slice(0, 3).toLowerCase()) : a;
        if (a < 0 || b < 0) throw new Error(t('알 수 없는 요일: ' + item, 'Unknown weekday: ' + item));
        for (var x = a; ; x = (x + 1) % 7) { ds[x] = 1; if (x === b) break; }
      });
      dw = { all: false, list: Object.keys(ds).map(Number).sort() };
    }
    var dm = datePart.split('-');
    if (dm.length === 2) dm.unshift('*');
    if (dm.length !== 3) throw new Error(t('날짜는 연-월-일 형식이어야 합니다 (예: *-*-01)', 'Dates look like year-month-day (e.g. *-*-01)'));
    var Y = comp(dm[0], 1970, 2200, t('연도', 'year')), Mo = comp(dm[1], 1, 12, t('월', 'month')), D = comp(dm[2], 1, 31, t('일', 'day'));
    var tm = timePart.split(':'); if (tm.length === 2) tm.push('00');
    if (tm.length !== 3) throw new Error(t('시간은 시:분 또는 시:분:초 형식이어야 합니다', 'Time looks like HH:MM or HH:MM:SS'));
    var H = comp(tm[0], 0, 23, t('시', 'hour')), Mi = comp(tm[1], 0, 59, t('분', 'minute')), S = comp(tm[2], 0, 59, t('초', 'second'));
    function vals(c, min, max) { if (c.all) { var a = []; for (var i = min; i <= max; i++) a.push(i); return a; } return c.list; }
    var hv = vals(H, 0, 23), mv = vals(Mi, 0, 59), sv = vals(S, 0, 59);
    var from = T.parseISO(o.from || '') ? T.parseISO(o.from).ns : BigInt(Date.now()) * 1000000n;
    if (o.from && o.from.trim() && !T.parseISO(o.from.trim())) throw new Error(t('기준 시각 형식이 올바르지 않습니다', 'Invalid start time'));
    var off0 = tz === 'UTC' ? 0 : T.zoneOffsetMin(Number(T.fdiv(from, 1000000n)), tz), w0 = T.fields(from + BigInt(off0) * 60n * T.NS_SEC);
    var y = w0.y, m = w0.m, d = w0.d, out = [], count = Math.max(1, Math.min(40, Math.round(o.count) || 6)), guard = 0;
    while (out.length < count && guard++ < 366 * 30) {
      var dowNow = ((T.daysFromCivil(y, m, d) % 7) + 11) % 7;
      if ((Y.all || Y.list.indexOf(y) >= 0) && (Mo.all || Mo.list.indexOf(m) >= 0) && (D.all || D.list.indexOf(d) >= 0) && (dw.all || dw.list.indexOf(dowNow) >= 0)) {
        for (var a = 0; a < hv.length && out.length < count; a++) for (var b = 0; b < mv.length && out.length < count; b++) for (var c = 0; c < sv.length && out.length < count; c++) {
          var z = T.zonedToNs(y, m, d, hv[a], mv[b], sv[c], 0, tz);
          if (!z.gap && z.ns > from) out.push(z.ns);
        }
      }
      d++; if (d > T.daysInMonth(y, m)) { d = 1; m++; if (m > 12) { m = 1; y++; } }
    }
    function pad(n) { return ('0' + n).slice(-2); }
    var norm = (dowPart ? dowPart + ' ' : '') + (Y.all ? '*' : Y.list.join(',')) + '-' + (Mo.all ? '*' : Mo.list.map(pad).join(',')) + '-' + (D.all ? '*' : D.list.map(pad).join(',')) + ' ' + (H.all ? '*' : H.list.map(pad).join(',')) + ':' + (Mi.all ? '*' : Mi.list.map(pad).join(',')) + ':' + (S.all ? '*' : S.list.map(pad).join(','));
    var svc = (o.unit || 'backup').replace(/[^A-Za-z0-9_.@-]/g, '-');
    var unit = '# /etc/systemd/system/' + svc + '.service\n[Unit]\nDescription=' + svc + '\n\n[Service]\nType=oneshot\nExecStart=' + (o.cmd || '/bin/true') + '\n\n# /etc/systemd/system/' + svc + '.timer\n[Unit]\nDescription=Run ' + svc + ' on schedule\n\n[Timer]\nOnCalendar=' + norm + '\n' + (o.persistent ? 'Persistent=true\n' : '') + (o.delay && o.delay.trim() ? 'RandomizedDelaySec=' + o.delay.trim() + '\n' : '') + '\n[Install]\nWantedBy=timers.target\n\n# sudo systemctl enable --now ' + svc + '.timer\n# systemctl list-timers ' + svc + '.timer\n# systemd-analyze calendar "' + norm + '"';
    return { _status: t('✅ 올바른 OnCalendar 식입니다', '✅ Valid OnCalendar expression'),
      kv: [[['입력', 'Input'], expr0 + (expr !== expr0 ? '  →  ' + expr : '')], [['정규화된 형태', 'Normalised form'], norm], [['요일', 'Weekday'], dw.all ? t('모든 요일', 'every day') : dw.list.map(function (x) { return TK.LANG ? DOWS[x] : TK.cron ? '일월화수목금토'[x] : DOWS[x]; }).join(', ')]],
      table: { head: [['#', '#'], ['UTC', 'UTC'], ['선택한 시간대', 'Selected zone']], rows: out.map(function (ns, i) { var zz = T.inZone(ns, tz); return [i + 1, T.iso(ns, 0), zz.text + ' (' + zz.offStr + ')']; }), empty: ['앞으로 실행되는 시각이 없습니다', 'No upcoming runs'] }, out: unit };
  }
});
