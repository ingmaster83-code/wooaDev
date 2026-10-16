TK.tool('transfer-time-calculator', {
  inputs: [
    { id: 'size', type: 'text', label: ['파일 크기 (예: 4.7 GB, 700MB, 1.5 TiB)', 'File size (e.g. 4.7 GB, 700MB, 1.5 TiB)'], sample: '4.7 GB' },
    { id: 'speed', type: 'text', label: ['전송 속도 (예: 100 Mbps, 1 Gbps, 12 MB/s)', 'Speed (e.g. 100 Mbps, 1 Gbps, 12 MB/s)'], sample: '100 Mbps' }
  ],
  options: [{ id: 'eff', type: 'number', label: ['실효 효율(%) — 프로토콜 오버헤드 등', 'Efficiency (%) — protocol overhead etc.'], default: 90, min: 1, max: 100 }],
  outputs: [{ id: 'kv', label: ['예상 소요 시간', 'Estimated time'], kind: 'kv' }, { id: 'table', label: ['속도별 비교', 'Comparison by speed'], kind: 'table' }],
  run: function (v, o, t) {
    var SZ = { b: 1, byte: 1, bytes: 1, k: 1e3, kb: 1e3, m: 1e6, mb: 1e6, g: 1e9, gb: 1e9, t: 1e12, tb: 1e12, pb: 1e15, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776, pib: 1125899906842624 };
    function size(s) {
      var m = /^([\d.,]+)\s*([A-Za-z]*)$/.exec(String(s).trim());
      if (!m) throw new Error(t('크기를 해석할 수 없습니다: ' + s + ' (예: 4.7 GB)', 'Cannot parse size: ' + s + ' (e.g. 4.7 GB)'));
      var mult = SZ[(m[2] || 'b').toLowerCase()];
      if (!mult) throw new Error(t('알 수 없는 크기 단위: ' + m[2], 'Unknown size unit: ' + m[2]));
      return parseFloat(m[1].replace(/,/g, '')) * mult;      // 바이트
    }
    function speed(s) {
      var m = /^([\d.,]+)\s*([KkMmGgTt]?)(i?)(bps|b\/s|bit\/s|bits\/s|Bps|B\/s|byte\/s|bytes\/s)$/.exec(String(s).trim());
      if (!m) throw new Error(t('속도를 해석할 수 없습니다: ' + s + ' (예: 100 Mbps, 12 MB/s)', 'Cannot parse speed: ' + s + ' (e.g. 100 Mbps, 12 MB/s)'));
      var base = m[3] ? 1024 : 1000, pow = { '': 0, k: 1, m: 2, g: 3, t: 4 }[m[2].toLowerCase()];
      var val = parseFloat(m[1].replace(/,/g, '')) * Math.pow(base, pow);
      return /^B|^byte/.test(m[4]) ? val : val / 8;           // 바이트/초 (대문자 B = 바이트)
    }
    var bytes = size(v.size), bps = speed(v.speed), eff = Math.max(1, Math.min(100, o.eff)) / 100;
    if (!(bytes > 0) || !(bps > 0)) throw new Error(t('크기와 속도는 0보다 커야 합니다', 'Size and speed must be greater than 0'));
    function fmt(sec) {
      if (sec < 1) return (sec * 1000).toFixed(0) + ' ms';
      var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = Math.round(sec % 60), out = [];
      if (d) out.push(d + t('일', 'd')); if (h) out.push(h + t('시간', 'h')); if (m) out.push(m + t('분', 'm')); if (s || !out.length) out.push(s + t('초', 's'));
      return out.join(' ');
    }
    function human(b) { var u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'], i = 0; while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; } return (Math.round(b * 100) / 100) + ' ' + u[i]; }
    var ideal = bytes / bps, real = ideal / eff;
    var rows = [['10 Mbps', 10e6 / 8], ['50 Mbps', 50e6 / 8], ['100 Mbps', 100e6 / 8], ['500 Mbps', 500e6 / 8], ['1 Gbps', 1e9 / 8], ['2.5 Gbps', 2.5e9 / 8], ['10 Gbps', 10e9 / 8], ['USB 3.0 (5 Gbps)', 5e9 / 8], ['HDD (150 MB/s)', 150e6], ['NVMe SSD (3 GB/s)', 3e9]].map(function (r) { return [r[0], fmt(bytes / r[1] / eff)]; });
    return { _status: t('✅ 약 ' + fmt(real) + ' 걸립니다', '✅ About ' + fmt(real)),
      kv: [[['파일 크기', 'File size'], human(bytes) + ' (' + Math.round(bytes).toLocaleString('en-US') + ' bytes)'], [['전송 속도', 'Speed'], (Math.round(bps * 8 / 1e6 * 100) / 100) + ' Mbps = ' + (Math.round(bps / 1e6 * 100) / 100) + ' MB/s'],
        [['이론상 시간 (효율 100%)', 'Ideal time (100% efficiency)'], fmt(ideal)], [['예상 시간 (효율 ' + Math.round(eff * 100) + '%)', 'Estimated (' + Math.round(eff * 100) + '% efficiency)'], fmt(real)]],
      table: { head: [['속도', 'Speed'], ['예상 시간', 'Estimated time']], rows: rows } };
  }
});
