TK.tool('dotnet-ticks-converter', {
  inputs: [{ id: 'in', label: ['Ticks 또는 날짜 (한 줄에 하나)', 'Ticks or dates (one per line)'], rows: 7, placeholder: ['638000000000000000 또는 2026-10-16T09:30:15.1234567Z', '638000000000000000 or 2026-10-16T09:30:15.1234567Z'],
    sample: '639119646151234567\n2026-10-16T09:30:15.1234567Z\n0\n621355968000000000\n3155378975999999999' }],
  options: [],
  outputs: [{ id: 'kv', label: ['변환 결과', 'Conversion'], kind: 'kv' }, { id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, MAX = 3155378975999999999n;
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    function conv(ln) {
      if (T.isNumeric(ln)) {
        var ticks = T.toBig(ln);
        if (ticks < 0n || ticks > MAX) return { err: t('Ticks 범위(0 ~ 3155378975999999999)를 벗어났습니다', 'Ticks must be between 0 and 3155378975999999999') };
        var ns = (ticks - T.TICKS_AT_UNIX) * 100n;
        return { ticks: ticks, ns: ns, dir: 'ticks→date' };
      }
      var p = T.parseISO(ln) || T.parseRFC(ln);
      if (!p) return { err: t('Ticks(정수) 또는 날짜가 아닙니다', 'Neither ticks (an integer) nor a date') };
      var tk = p.ns / 100n + T.TICKS_AT_UNIX;
      if (p.ns % 100n !== 0n) tk = T.fdiv(p.ns, 100n) + T.TICKS_AT_UNIX;
      if (tk < 0n || tk > MAX) return { err: t('.NET DateTime 범위(0001~9999년)를 벗어났습니다', 'Outside the .NET DateTime range (years 1–9999)') };
      return { ticks: tk, ns: p.ns, dir: 'date→ticks' };
    }
    var rs = lines.map(function (ln) { return { ln: ln, r: conv(ln) }; });
    if (rs.length === 1) {
      var r = rs[0].r;
      if (r.err) throw new Error(r.err);
      return { _status: t('✅ ' + (r.dir === 'ticks→date' ? 'Ticks → 날짜' : '날짜 → Ticks'), '✅ ' + (r.dir === 'ticks→date' ? 'Ticks → date' : 'Date → ticks')),
        kv: [[['Ticks', 'Ticks'], r.ticks.toString()], [['UTC (ISO 8601, 100ns)', 'UTC (ISO 8601, 100 ns)'], T.iso(r.ns, 7)], [['Unix 초', 'Unix seconds'], T.fdiv(r.ns, T.NS_SEC).toString()], [['Unix 밀리초', 'Unix milliseconds'], T.fdiv(r.ns, 1000000n).toString()],
          [['Ticks (16진수)', 'Ticks (hex)'], '0x' + r.ticks.toString(16).toUpperCase()], [['DateTime.Kind=Utc 바이너리', 'DateTime.ToBinary (Utc)'], (r.ticks | (1n << 62n)).toString()]] };
    }
    var bad = rs.filter(function (x) { return x.r.err; }).length;
    return { _status: bad ? { ok: 'info', msg: t('⚠️ ' + bad + '개 줄을 변환하지 못했습니다', '⚠️ ' + bad + ' line(s) failed') } : t('✅ ' + rs.length + '개 변환', '✅ Converted ' + rs.length),
      table: { head: [['입력', 'Input'], ['Ticks', 'Ticks'], ['UTC (ISO 8601, 100ns)', 'UTC (ISO 8601, 100 ns)'], ['Unix ms', 'Unix ms']],
        rows: rs.map(function (x) { return x.r.err ? { cls: 'r-bad', cells: [x.ln, x.r.err, '', ''] } : [x.ln, x.r.ticks.toString(), T.iso(x.r.ns, 7), T.fdiv(x.r.ns, 1000000n).toString()]; }) } };
  }
});
