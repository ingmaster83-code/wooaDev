TK.tool('webkit-timestamp-converter', {
  inputs: [{ id: 'in', label: ['타임스탬프 또는 날짜 (한 줄에 하나)', 'Timestamps or dates (one per line)'], rows: 7, placeholder: ['13400000000000000', '13400000000000000'],
    sample: '13411234567890123\n13300000000000000\n2026-10-16T09:30:15.123456Z' }],
  options: [{ id: 'kind', type: 'select', label: ['기준(에포크)', 'Epoch'], choices: [['webkit', ['Chrome·WebKit (1601-01-01, 마이크로초)', 'Chrome / WebKit (1601-01-01, µs)']], ['prtime', ['Firefox PRTime (1970-01-01, 마이크로초)', 'Firefox PRTime (1970-01-01, µs)']], ['cocoa', ['Apple Cocoa / Core Data (2001-01-01, 초)', 'Apple Cocoa / Core Data (2001-01-01, seconds)']], ['unix_us', ['Unix 마이크로초', 'Unix microseconds']]], default: 'webkit' }],
  outputs: [{ id: 'kv', label: ['변환 결과', 'Conversion'], kind: 'kv' }, { id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    // 각 기준의 "1 단위 = 몇 ns", "Unix 에포크에서의 차이(단위)"
    var K = { webkit: { unit: 1000n, at: T.WEBKIT_US_AT_UNIX }, prtime: { unit: 1000n, at: 0n }, unix_us: { unit: 1000n, at: 0n }, cocoa: { unit: 1000000000n, at: -T.COCOA_S_AT_UNIX } }[o.kind];
    function toVal(ns) { return T.fdiv(ns, K.unit) + K.at; }
    function conv(ln) {
      var ns;
      if (o.kind === 'cocoa' && /^[+-]?\d+\.\d+$/.test(ln)) {
        var neg = ln[0] === '-', parts = ln.replace(/^[+-]/, '').split('.'), frac = (parts[1] + '000000000').slice(0, 9);
        var abs = BigInt(parts[0]) * T.NS_SEC + BigInt(frac);
        return { ns: (neg ? -abs : abs) + T.COCOA_S_AT_UNIX * T.NS_SEC };
      }
      if (T.isNumeric(ln)) { var val = T.toBig(ln); return { ns: (val - K.at) * K.unit }; }
      var p = T.parseISO(ln) || T.parseRFC(ln);
      if (!p) return { err: t('숫자 또는 날짜가 아닙니다', 'Neither a number nor a date') };
      return { ns: p.ns };
    }
    var rs = lines.map(function (ln) { var r = conv(ln); if (r.ns !== undefined && (r.ns > 253402300799999999999n || r.ns < -62135596800000000000n)) r = { err: t('표시 가능한 날짜 범위를 벗어났습니다', 'Outside the displayable date range') }; return { ln: ln, r: r }; });
    var unitName = o.kind === 'cocoa' ? t('초', 's') : 'µs';
    if (rs.length === 1) {
      var r = rs[0].r; if (r.err) throw new Error(r.err);
      var cocoaSec = T.fdiv(r.ns, T.NS_SEC) - T.COCOA_S_AT_UNIX;
      return { _status: t('✅ 변환 완료', '✅ Converted'),
        kv: [[['UTC (ISO 8601, 마이크로초)', 'UTC (ISO 8601, µs)'], T.iso(r.ns, 6)], [['Chrome/WebKit (µs, 1601)', 'Chrome/WebKit (µs, 1601)'], (T.fdiv(r.ns, 1000n) + T.WEBKIT_US_AT_UNIX).toString()], [['Firefox PRTime / Unix µs', 'Firefox PRTime / Unix µs'], T.fdiv(r.ns, 1000n).toString()],
          [['Apple Cocoa (초, 2001)', 'Apple Cocoa (s, 2001)'], cocoaSec.toString()], [['Unix 초', 'Unix seconds'], T.fdiv(r.ns, T.NS_SEC).toString()], [['Unix 밀리초', 'Unix milliseconds'], T.fdiv(r.ns, 1000000n).toString()]] };
    }
    var bad = rs.filter(function (x) { return x.r.err; }).length;
    return { _status: bad ? { ok: 'info', msg: t('⚠️ ' + bad + '개 줄을 변환하지 못했습니다', '⚠️ ' + bad + ' line(s) failed') } : t('✅ ' + rs.length + '개 변환', '✅ Converted ' + rs.length),
      table: { head: [['입력', 'Input'], ['UTC (ISO 8601)', 'UTC (ISO 8601)'], ['값 (' + unitName + ')', 'Value (' + unitName + ')']],
        rows: rs.map(function (x) { return x.r.err ? { cls: 'r-bad', cells: [x.ln, x.r.err, ''] } : [x.ln, T.iso(x.r.ns, 6), toVal(x.r.ns).toString()]; }) } };
  }
});
