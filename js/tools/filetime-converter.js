TK.tool('filetime-converter', {
  inputs: [{ id: 'in', label: ['FILETIME 또는 날짜 (한 줄에 하나)', 'FILETIME or dates (one per line)'], rows: 7, placeholder: ['133700000000000000 · 0x01DB... · 0x01DB1234 0x5678ABCD · 2026-10-16T09:30:15Z', '133700000000000000 · 0x01DB... · 0x01DB1234 0x5678ABCD · 2026-10-16T09:30:15Z'],
    sample: '134052684151234567\n0x01DC4B3A12345678\n0x01DC4B3A 0x12345678\n2026-10-16T09:30:15.1234567Z\n116444736000000000' }],
  options: [],
  outputs: [{ id: 'kv', label: ['변환 결과', 'Conversion'], kind: 'kv' }, { id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, MAXFT = (1n << 64n) - 1n;
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    function conv(ln) {
      var two = /^(0x[0-9a-f]{1,8})[\s,:]+(0x[0-9a-f]{1,8})$/i.exec(ln), ft;
      if (two) ft = (BigInt(two[1]) << 32n) | BigInt(two[2]);
      else if (T.isNumeric(ln) || /^0x[0-9a-f]+$/i.test(ln)) ft = T.toBig(ln);
      else {
        var p = T.parseISO(ln) || T.parseRFC(ln);
        if (!p) return { err: t('FILETIME(정수·16진수) 또는 날짜가 아닙니다', 'Neither a FILETIME (integer/hex) nor a date') };
        ft = T.fdiv(p.ns, 100n) + T.FILETIME_AT_UNIX;
      }
      if (ft < 0n || ft > MAXFT) return { err: t('64비트 부호 없는 정수 범위를 벗어났습니다', 'Outside the unsigned 64-bit range') };
      var ns = (ft - T.FILETIME_AT_UNIX) * 100n;
      if (ns > 253402300799999999900n || ns < -11644473600000000000n) return { err: t('표시 가능한 날짜 범위(1601~9999년)를 벗어났습니다', 'Outside the displayable range (years 1601–9999)') };
      return { ft: ft, ns: ns };
    }
    var rs = lines.map(function (ln) { return { ln: ln, r: conv(ln) }; });
    function hex(ft) { return '0x' + ft.toString(16).toUpperCase().padStart(16, '0'); }
    if (rs.length === 1) {
      var r = rs[0].r;
      if (r.err) throw new Error(r.err);
      return { _status: t('✅ 변환 완료', '✅ Converted'),
        kv: [[['FILETIME (10진수)', 'FILETIME (decimal)'], r.ft.toString()], [['FILETIME (16진수)', 'FILETIME (hex)'], hex(r.ft)], [['dwHighDateTime / dwLowDateTime', 'dwHighDateTime / dwLowDateTime'], '0x' + (r.ft >> 32n).toString(16).toUpperCase().padStart(8, '0') + ' / 0x' + (r.ft & 0xffffffffn).toString(16).toUpperCase().padStart(8, '0')],
          [['UTC (ISO 8601, 100ns)', 'UTC (ISO 8601, 100 ns)'], T.iso(r.ns, 7)], [['Unix 초', 'Unix seconds'], T.fdiv(r.ns, T.NS_SEC).toString()], [['Unix 밀리초', 'Unix milliseconds'], T.fdiv(r.ns, 1000000n).toString()]] };
    }
    var bad = rs.filter(function (x) { return x.r.err; }).length;
    return { _status: bad ? { ok: 'info', msg: t('⚠️ ' + bad + '개 줄을 변환하지 못했습니다', '⚠️ ' + bad + ' line(s) failed') } : t('✅ ' + rs.length + '개 변환', '✅ Converted ' + rs.length),
      table: { head: [['입력', 'Input'], ['FILETIME', 'FILETIME'], ['16진수', 'Hex'], ['UTC (ISO 8601, 100ns)', 'UTC (ISO 8601, 100 ns)']],
        rows: rs.map(function (x) { return x.r.err ? { cls: 'r-bad', cells: [x.ln, x.r.err, '', ''] } : [x.ln, x.r.ft.toString(), hex(x.r.ft), T.iso(x.r.ns, 7)]; }) } };
  }
});
