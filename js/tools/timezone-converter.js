TK.tool('timezone-converter', {
  allowEmpty: true,
  inputs: [{ id: 'in', label: ['날짜·시간 (비우면 현재 시각)', 'Date & time (leave empty for now)'], type: 'text', sample: '2026-10-16 09:30', placeholder: ['2026-10-16 09:30 (비우면 지금)', '2026-10-16 09:30 (empty = now)'] }],
  options: [
    { id: 'from', type: 'text', label: ['입력 시간대 (IANA)', 'Input time zone (IANA)'], default: 'Asia/Seoul' },
    { id: 'to', type: 'text', label: ['변환할 시간대 (쉼표로 구분)', 'Target zones (comma-separated)'], default: 'UTC, Asia/Seoul, Asia/Tokyo, America/New_York, America/Los_Angeles, Europe/London, Europe/Paris, Asia/Kolkata, Australia/Sydney' }
  ],
  outputs: [{ id: 'table', label: ['시간대별 시각', 'Times by zone'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, from = (o.from || 'UTC').trim(), src = String(v.in || '').trim(), ns, note = '';
    if (!T.validZone(from)) throw new Error(t('알 수 없는 입력 시간대입니다: ' + from, 'Unknown input time zone: ' + from));
    if (!src) { ns = BigInt(Date.now()) * 1000000n; note = t('현재 시각 기준', 'Using the current time'); }
    else {
      var p = T.parseISO(src.replace(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/, function (m, y, mo, d) { return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2); }));
      if (!p) throw new Error(t('날짜를 해석할 수 없습니다. 예: 2026-10-16 09:30 또는 2026-10-16T09:30:00+09:00', 'Cannot parse the date. Example: 2026-10-16 09:30 or 2026-10-16T09:30:00+09:00'));
      if (p.offsetMin != null) { ns = p.ns; note = t('입력에 UTC 오프셋이 있어 입력 시간대는 무시했습니다', 'The input has a UTC offset, so the input zone is ignored'); }
      else {
        var f = T.fields(p.ns), z = T.zonedToNs(f.y, f.m, f.d, f.H, f.M, f.S, f.frac, from);
        ns = z.ns;
        if (z.gap) note = t('⚠️ 서머타임 전환으로 존재하지 않는 시각이라 이전 오프셋으로 해석했습니다', '⚠️ That wall-clock time does not exist (DST gap); the earlier offset was used');
        else if (z.ambiguous) note = t('⚠️ 서머타임 종료로 같은 시각이 두 번 있어, 첫 번째 시각으로 해석했습니다', '⚠️ That time occurs twice (DST end); the first occurrence was used');
      }
    }
    var names = String(o.to || '').split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (names.indexOf('UTC') < 0) names.unshift('UTC');
    var base = T.inZone(ns, from), rows = [];
    names.forEach(function (tz) {
      if (!T.validZone(tz)) { rows.push({ cls: 'r-bad', cells: [tz, t('알 수 없는 시간대', 'Unknown zone'), '', '']}); return; }
      var z = T.inZone(ns, tz), diff = z.days - base.days;
      rows.push([tz, z.text + (diff ? (diff > 0 ? ' (+' : ' (') + diff + t('일)', 'd)') : ''), z.offStr, T.DOW_KO[z.dow] + ' / ' + T.DOW[z.dow]]);
    });
    return { _status: note ? { ok: 'info', msg: note } : t('✅ 변환 완료 — ' + T.iso(ns, 0), '✅ Converted — ' + T.iso(ns, 0)),
      table: { head: [['시간대', 'Zone'], ['현지 시각', 'Local time'], ['UTC 오프셋', 'UTC offset'], ['요일', 'Weekday']], rows: rows } };
  }
});
