TK.tool('excel-date-converter', {
  inputs: [{ id: 'in', label: ['일련번호 또는 날짜 (한 줄에 하나)', 'Serial numbers or dates (one per line)'], rows: 7, placeholder: ['45000.5 · 2026-10-16 09:30', '45000.5 · 2026-10-16 09:30'],
    sample: '46311.395833333\n1\n59\n60\n61\n2026-10-16 09:30\n1900-03-01' }],
  options: [{ id: 'sys', type: 'select', label: ['날짜 체계', 'Date system'], choices: [['1900', ['1900 체계 (Windows 기본)', '1900 system (Windows default)']], ['1904', ['1904 체계 (구 Mac)', '1904 system (legacy Mac)']]], default: '1900' }],
  outputs: [{ id: 'kv', label: ['변환 결과', 'Conversion'], kind: 'kv' }, { id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, sys1900 = o.sys === '1900', lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    // 일련번호 → Unix 일수(소수 포함)
    function serialToUnixDays(sn) {
      if (!sys1900) return sn - 24107;
      if (sn >= 61) return sn - 25569;
      return sn - 25568;                       // 1 ≤ sn < 60 (1900-01-01 = 1)
    }
    function unixDaysToSerial(d) {
      if (!sys1900) return d + 24107;
      return d >= -25508 ? d + 25569 : d + 25568;   // 1900-03-01(= -25508) 이후는 +25569
    }
    function conv(ln) {
      if (/^[+-]?\d+(\.\d+)?$/.test(ln)) {
        var sn = parseFloat(ln);
        if (sys1900 && sn >= 60 && sn < 61) return { sn: sn, fake: true };
        if (sn < (sys1900 ? 1 : 0) || sn > 2958465.99999) return { err: t('지원 범위(' + (sys1900 ? '1' : '0') + ' ~ 2958465)를 벗어났습니다', 'Outside the supported range (' + (sys1900 ? '1' : '0') + ' – 2958465)') };
        var days = serialToUnixDays(sn), whole = Math.floor(days), fracDay = days - whole;
        var ms = Math.round(fracDay * 86400000);
        return { sn: sn, ns: (BigInt(whole) * 86400000n + BigInt(ms)) * 1000000n };
      }
      var p = T.parseISO(ln) || T.parseRFC(ln);
      if (!p) return { err: t('숫자 또는 날짜가 아닙니다', 'Neither a number nor a date') };
      var f = T.fields(p.ns), dayPart = T.daysFromCivil(f.y, f.m, f.d);
      var sn2 = unixDaysToSerial(dayPart) + (f.H * 3600 + f.M * 60 + f.S + f.frac / 1e9) / 86400;
      if (sn2 < (sys1900 ? 1 : 0)) return { err: t('Excel이 표현할 수 없는 이른 날짜입니다', 'Date is earlier than Excel can represent') };
      return { sn: Math.round(sn2 * 1e9) / 1e9, ns: p.ns };
    }
    var rs = lines.map(function (ln) { return { ln: ln, r: conv(ln) }; });
    function dateText(r) { return r.fake ? t('1900-02-29 (Excel 1900 윤년 버그로 존재하지 않는 날짜)', '1900-02-29 (does not exist — Excel 1900 leap-year bug)') : T.iso(r.ns, 3).replace('T', ' ').replace('Z', ''); }
    if (rs.length === 1) {
      var r = rs[0].r; if (r.err) throw new Error(r.err);
      var kv = [[['일련번호', 'Serial number'], String(r.sn)], [['날짜·시간', 'Date & time'], dateText(r)]];
      if (!r.fake) kv.push([['Unix 초', 'Unix seconds'], T.fdiv(r.ns, T.NS_SEC).toString()], [['요일', 'Weekday'], T.DOW_KO[T.fields(r.ns).dow] + ' / ' + T.DOW[T.fields(r.ns).dow]]);
      return { _status: r.fake ? { ok: 'info', msg: t('⚠️ 60은 Excel이 윤년으로 잘못 취급한 1900-02-29입니다', '⚠️ 60 is the non-existent 1900-02-29 that Excel treats as a leap day') } : t('✅ 변환 완료', '✅ Converted'), kv: kv };
    }
    var bad = rs.filter(function (x) { return x.r.err; }).length;
    return { _status: bad ? { ok: 'info', msg: t('⚠️ ' + bad + '개 줄을 변환하지 못했습니다', '⚠️ ' + bad + ' line(s) failed') } : t('✅ ' + rs.length + '개 변환', '✅ Converted ' + rs.length),
      table: { head: [['입력', 'Input'], ['일련번호', 'Serial'], ['날짜·시간 (UTC 기준 표기)', 'Date & time']], rows: rs.map(function (x) { return x.r.err ? { cls: 'r-bad', cells: [x.ln, x.r.err, ''] } : [x.ln, String(x.r.sn), dateText(x.r)]; }) } };
  }
});
