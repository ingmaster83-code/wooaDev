TK.tool('iso8601-converter', {
  inputs: [{ id: 'in', label: ['날짜·시간 (한 줄에 하나)', 'Date-times (one per line)'], rows: 7, placeholder: ['2026-10-16T09:30:15.123456789+09:00', '2026-10-16T09:30:15.123456789+09:00'],
    sample: '2026-10-16T09:30:15.123456789+09:00\nSun, 06 Nov 1994 08:49:37 GMT\nThu, 16 Oct 2026 12:00:00 -0500\n2026-10-16' }],
  options: [{ id: 'digits', type: 'select', label: ['소수 자릿수', 'Fraction digits'], choices: [['auto', ['입력대로', 'As input']], ['3', '3'], ['6', '6'], ['9', '9']], default: 'auto' }],
  outputs: [{ id: 'kv', label: ['변환 결과', 'Conversions'], kind: 'kv' }, { id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), items = [];
    lines.forEach(function (ln) {
      var p = T.parseISO(ln), kind = 'ISO 8601';
      if (!p) { p = T.parseRFC(ln); kind = 'RFC 2822 / HTTP'; }
      items.push({ ln: ln, p: p, kind: kind });
    });
    var bad = items.filter(function (x) { return !x.p; });
    function digitsOf(p) { return o.digits === 'auto' ? Math.max(3, p.digits) : Number(o.digits); }
    if (items.length === 1) {
      var x = items[0];
      if (!x.p) throw new Error(t('인식할 수 없는 날짜 형식입니다 (ISO 8601, RFC 2822, HTTP 날짜 지원)', 'Unrecognised date format (ISO 8601, RFC 2822 and HTTP dates are supported)'));
      var rows = [[['인식한 형식', 'Detected format'], x.kind + (x.p.offsetMin == null ? t(' (시간대 없음 → UTC로 간주)', ' (no zone → treated as UTC)') : '')]].concat(T.formatsKV(x.p.ns, digitsOf(x.p), x.p.offsetMin));
      var f = T.fields(x.p.ns);
      rows.push([['요일 (UTC)', 'Weekday (UTC)'], T.DOW[f.dow] + ' / ' + T.DOW_KO[f.dow]]);
      return { _status: t('✅ 변환 완료', '✅ Converted'), kv: rows };
    }
    return {
      _status: bad.length ? { ok: 'info', msg: t('⚠️ ' + bad.length + '개 줄을 해석하지 못했습니다', '⚠️ ' + bad.length + ' line(s) could not be parsed') } : t('✅ ' + items.length + '개 변환', '✅ Converted ' + items.length),
      table: { head: [['입력', 'Input'], ['UTC (ISO 8601)', 'UTC (ISO 8601)'], ['Unix 초', 'Unix s'], ['Unix ms', 'Unix ms'], ['오프셋', 'Offset']],
        rows: items.map(function (x) {
          if (!x.p) return { cls: 'r-bad', cells: [x.ln, t('해석 실패', 'Parse error'), '', '', ''] };
          var sec = T.fdiv(x.p.ns, T.NS_SEC), ms = T.fdiv(x.p.ns, 1000000n), off = x.p.offsetMin;
          return [x.ln, T.iso(x.p.ns, digitsOf(x.p)), sec.toString(), ms.toString(), off == null ? t('없음(UTC 간주)', 'none (as UTC)') : (off < 0 ? '-' : '+') + T.pad(Math.floor(Math.abs(off) / 60), 2) + ':' + T.pad(Math.abs(off) % 60, 2)];
        }) }
    };
  }
});
