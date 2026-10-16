TK.tool('duration-parser', {
  inputs: [{ id: 'in', label: ['기간 (한 줄에 하나)', 'Durations (one per line)'], rows: 7, placeholder: ['P1DT2H30M, 1h 30m, 01:30:00, 90s, 1.5 hours', 'P1DT2H30M, 1h 30m, 01:30:00, 90s, 1.5 hours'],
    sample: 'PT1H30M\nP1DT2H30M15.5S\n1h 30m 20s\n01:30:00.250\n2 days 3 hours\n5400000' }],
  options: [{ id: 'bare', type: 'select', label: ['단위 없는 숫자', 'Bare numbers are'], choices: [['ms', ['밀리초', 'milliseconds']], ['s', ['초', 'seconds']], ['m', ['분', 'minutes']]], default: 'ms' }],
  outputs: [{ id: 'kv', label: ['변환 결과', 'Conversions'], kind: 'kv' }, { id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }],
  run: function (v, o, t) {
    var U = { ms: 1, millisecond: 1, milliseconds: 1, msec: 1, s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000, m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000, h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000,
      d: 86400000, day: 86400000, days: 86400000, w: 604800000, wk: 604800000, week: 604800000, weeks: 604800000, '초': 1000, '분': 60000, '시간': 3600000, '일': 86400000, '주': 604800000, '밀리초': 1 };
    function parse(s) {
      var m;
      if ((m = /^([+-]?)P(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i.exec(s)) && /\d/.test(s)) {
        var n = function (x) { return x ? parseFloat(x.replace(',', '.')) : 0; };
        var ms = n(m[2]) * 365 * 864e5 + n(m[3]) * 30 * 864e5 + n(m[4]) * 7 * 864e5 + n(m[5]) * 864e5 + n(m[6]) * 36e5 + n(m[7]) * 6e4 + n(m[8]) * 1e3;
        return { ms: (m[1] === '-' ? -1 : 1) * ms, approx: !!(m[2] || m[3]), kind: 'ISO 8601' };
      }
      if ((m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?(?:[.,](\d{1,9}))?$/.exec(s))) {
        var hasS = m[3] != null, a = +m[1], b = +m[2], c = hasS ? +m[3] : 0, frac = m[4] ? parseFloat('0.' + m[4]) : 0;
        return { ms: ((hasS ? a * 3600 + b * 60 + c : a * 60 + b) + frac) * 1000, kind: hasS ? 'hh:mm:ss' : 'mm:ss' };
      }
      if (/^[+-]?\d+(\.\d+)?$/.test(s)) return { ms: parseFloat(s) * (o.bare === 'ms' ? 1 : o.bare === 's' ? 1000 : 60000), kind: t('숫자', 'number') };
      var re = /([+-]?\d+(?:\.\d+)?)\s*([A-Za-z가-힣]+)/g, total = 0, found = 0, rest = s.replace(re, function (_, num, unit) {
        var u = U[unit.toLowerCase()] || U[unit]; if (!u) { found = -1e9; return _; }
        total += parseFloat(num) * u; found++; return '';
      });
      if (found > 0 && !/[^\s,and와과]/i.test(rest.replace(/\band\b/gi, ''))) return { ms: total, kind: t('단위 표기', 'unit text') };
      return null;
    }
    function human(ms) {
      var neg = ms < 0; ms = Math.abs(ms);
      var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = (ms % 6e4) / 1000, out = [];
      if (d) out.push(d + t('일', 'd')); if (h) out.push(h + t('시간', 'h')); if (m) out.push(m + t('분', 'm')); if (s || !out.length) out.push((Math.round(s * 1000) / 1000) + t('초', 's'));
      return (neg ? '-' : '') + out.join(' ');
    }
    function iso(ms) {
      var neg = ms < 0; ms = Math.abs(ms);
      var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.round((ms % 6e4)) / 1000, str = 'P' + (d ? d + 'D' : '');
      if (h || m || s || !d) str += 'T' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + ((s || (!h && !m)) ? s + 'S' : '');
      return (neg ? '-' : '') + str;
    }
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), items = lines.map(function (ln) { return { ln: ln, r: parse(ln) }; });
    function num(x) { return (Math.round(x * 1e6) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 6 }); }
    if (items.length === 1) {
      var r = items[0].r;
      if (!r) throw new Error(t('해석할 수 없는 기간입니다. 예: PT1H30M, 1h 30m, 01:30:00', 'Cannot parse the duration. Examples: PT1H30M, 1h 30m, 01:30:00'));
      return { _status: r.approx ? { ok: 'info', msg: t('⚠️ 연·월이 포함되어 1년=365일, 1개월=30일로 계산한 근사값입니다', '⚠️ Includes years/months — approximated as 365 and 30 days') } : t('✅ ' + r.kind + ' 형식으로 해석', '✅ Parsed as ' + r.kind),
        kv: [[['밀리초', 'Milliseconds'], num(r.ms)], [['초', 'Seconds'], num(r.ms / 1000)], [['분', 'Minutes'], num(r.ms / 6e4)], [['시간', 'Hours'], num(r.ms / 36e5)], [['일', 'Days'], num(r.ms / 864e5)],
          [['ISO 8601 기간', 'ISO 8601 duration'], iso(r.ms)], [['읽기 쉬운 표기', 'Human readable'], human(r.ms)], [['hh:mm:ss', 'hh:mm:ss'], (r.ms < 0 ? '-' : '') + Math.floor(Math.abs(r.ms) / 36e5) + ':' + ('0' + Math.floor(Math.abs(r.ms) % 36e5 / 6e4)).slice(-2) + ':' + ('0' + (Math.abs(r.ms) % 6e4 / 1000).toFixed(3)).slice(-6)]] };
    }
    var bad = items.filter(function (x) { return !x.r; }).length;
    return { _status: bad ? { ok: 'info', msg: t('⚠️ ' + bad + '개 줄을 해석하지 못했습니다', '⚠️ ' + bad + ' line(s) could not be parsed') } : t('✅ ' + items.length + '개 변환', '✅ Converted ' + items.length),
      table: { head: [['입력', 'Input'], ['밀리초', 'ms'], ['초', 'Seconds'], ['ISO 8601', 'ISO 8601'], ['표기', 'Readable']],
        rows: items.map(function (x) { return x.r ? [x.ln, num(x.r.ms), num(x.r.ms / 1000), iso(x.r.ms), human(x.r.ms)] : { cls: 'r-bad', cells: [x.ln, t('해석 실패', 'Parse error'), '', '', ''] }; }) } };
  }
});
