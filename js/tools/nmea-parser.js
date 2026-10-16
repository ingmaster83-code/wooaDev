TK.tool('nmea-parser', {
  inputs: [{ id: 'in', label: ['NMEA 0183 문장 (한 줄에 하나)', 'NMEA 0183 sentences (one per line)'], rows: 8, sample: '$GPGGA,092750.000,5321.6802,N,00630.3372,W,1,8,1.03,61.7,M,55.2,M,,*76\n$GPRMC,092750.000,A,5321.6802,N,00630.3372,W,0.02,31.66,280511,,,A*43\n$GPGLL,5321.6802,N,00630.3372,W,092750.000,A,A*4B\n$GPVTG,31.66,T,,M,0.02,N,0.04,K,A*09\n$GPGSA,A,3,10,07,05,02,29,04,08,13,,,,,1.72,1.03,1.38*0A' }],
  options: [],
  sampleExpectError: false,
  outputs: [{ id: 'table', label: ['해석 결과', 'Decoded'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.in).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('NMEA 문장을 입력하세요', 'Enter NMEA sentences'));
    var rows = [], issues = [], bad = 0;
    function cs(body) { var x = 0; for (var i = 0; i < body.length; i++) x ^= body.charCodeAt(i); return ('0' + x.toString(16)).slice(-2).toUpperCase(); }
    function coord(v, h, deg) { if (!v) return null; var d = Math.floor(parseFloat(v) / 100), m = parseFloat(v) - d * 100, r = d + m / 60; if (h === 'S' || h === 'W') r = -r; return r; }
    function fmtC(c) { return c === null ? '—' : (Math.round(c * 1e6) / 1e6).toString(); }
    function tm(s) { return s && s.length >= 6 ? s.slice(0, 2) + ':' + s.slice(2, 4) + ':' + s.slice(4, 6) + (s.length > 6 ? s.slice(6) : '') + ' UTC' : '—'; }
    var QUAL = { 0: t('위치 고정 없음', 'no fix'), 1: 'GPS', 2: 'DGPS', 3: 'PPS', 4: 'RTK fixed', 5: 'RTK float', 6: t('추정(dead reckoning)', 'dead reckoning'), 7: 'manual', 8: 'simulation' };
    lines.forEach(function (ln) {
      var m = /^[$!]([A-Z0-9]{2})([A-Z]{3}),?(.*?)(?:\*([0-9A-Fa-f]{2}))?$/.exec(ln);
      if (!m) { bad++; rows.push([ln.slice(0, 40), '❌', t('NMEA 형식이 아닙니다', 'Not NMEA')]); return; }
      var talker = m[1], type = m[2], f = m[3].split(','), body = ln.replace(/^[$!]/, '').replace(/\*[0-9A-Fa-f]{2}$/, ''), ok = m[4] ? cs(body) === m[4].toUpperCase() : null;
      var chk = ok === null ? t('체크섬 없음', 'no checksum') : ok ? '✅ *' + m[4].toUpperCase() : '❌ ' + t('불일치 (계산 ', 'mismatch (computed ') + '*' + cs(body) + ')';
      if (ok === false) bad++;
      var TLK = { GP: 'GPS', GL: 'GLONASS', GA: 'Galileo', GB: 'BeiDou', BD: 'BeiDou', GN: 'GNSS (multi)', GQ: 'QZSS', GI: 'NavIC' };
      var head = (TLK[talker] || talker) + ' ' + type, d = [];
      if (type === 'GGA') { var lat = coord(f[1], f[2]), lon = coord(f[3], f[4]); d.push([t('시각', 'time'), tm(f[0])], [t('위도/경도', 'lat / lon'), fmtC(lat) + ', ' + fmtC(lon)], [t('고정 품질', 'fix quality'), (QUAL[f[5]] || f[5]) + ' (' + f[5] + ')'], [t('위성 수', 'satellites'), f[6]], ['HDOP', f[7]], [t('고도', 'altitude'), (f[8] || '—') + ' ' + (f[9] || '')], [t('지오이드 높이', 'geoid separation'), (f[10] || '—') + ' ' + (f[11] || '')]); if (f[5] === '0') issues.push(t('GGA: 위치 고정이 없습니다(품질 0) — 좌표를 신뢰하지 마세요', 'GGA: no fix (quality 0) — do not trust the coordinates')); if (lat !== null) d.push([t('지도', 'map'), 'https://www.openstreetmap.org/?mlat=' + fmtC(lat) + '&mlon=' + fmtC(lon) + '#map=16/' + fmtC(lat) + '/' + fmtC(lon)]); }
      else if (type === 'RMC') { var la = coord(f[2], f[3]), lo = coord(f[4], f[5]), dd = f[8] || ''; d.push([t('시각', 'time'), tm(f[0])], [t('상태', 'status'), f[1] === 'A' ? 'A ' + t('유효', 'valid') : 'V ' + t('경고(무효)', 'warning (invalid)')], [t('위도/경도', 'lat / lon'), fmtC(la) + ', ' + fmtC(lo)], [t('속도', 'speed'), f[6] ? f[6] + ' kn = ' + (parseFloat(f[6]) * 1.852).toFixed(2) + ' km/h' : '—'], [t('진행 방향', 'course'), f[7] ? f[7] + '°' : '—'], [t('날짜', 'date'), dd.length === 6 ? '20' + dd.slice(4, 6) + '-' + dd.slice(2, 4) + '-' + dd.slice(0, 2) : '—']); if (f[1] === 'V') issues.push(t('RMC: 상태 V — 수신기가 유효하지 않다고 표시한 데이터입니다', 'RMC: status V — the receiver flags the data as invalid')); }
      else if (type === 'GLL') { d.push([t('위도/경도', 'lat / lon'), fmtC(coord(f[0], f[1])) + ', ' + fmtC(coord(f[2], f[3]))], [t('시각', 'time'), tm(f[4])], [t('상태', 'status'), f[5] === 'A' ? 'A ' + t('유효', 'valid') : 'V ' + t('무효', 'invalid')]); }
      else if (type === 'VTG') { d.push([t('진북 기준 방향', 'true course'), (f[0] || '—') + '°'], [t('속도', 'speed'), (f[4] || '—') + ' kn / ' + (f[6] || '—') + ' km/h']); }
      else if (type === 'GSA') { d.push([t('모드', 'mode'), (f[0] === 'A' ? t('자동', 'auto') : t('수동', 'manual')) + ' / ' + ({ 1: t('고정 없음', 'no fix'), 2: '2D', 3: '3D' }[f[1]] || f[1])], [t('사용 위성 PRN', 'satellite PRNs'), f.slice(2, 14).filter(Boolean).join(', ') || '—'], ['PDOP / HDOP / VDOP', [f[14], f[15], (f[16] || '').split('*')[0]].join(' / ')]); }
      else if (type === 'GSV') d.push([t('메시지', 'message'), f[1] + '/' + f[0]], [t('가시 위성 수', 'satellites in view'), f[2]]);
      else d.push([t('필드', 'fields'), f.join(' | ')]);
      rows.push([head, ok === false ? '❌' : '✅', chk]);
      d.forEach(function (x) { rows.push(['  ' + x[0], '', x[1]]); });
    });
    issues.push(t('NMEA 위도·경도는 ddmm.mmmm 형식이라 도(°) = dd + mm.mmmm/60 으로 변환합니다. S, W 는 음수입니다', 'NMEA latitude / longitude are ddmm.mmmm; degrees = dd + mm.mmmm/60, and S / W are negative'));
    issues.push(t('체크섬은 $ 와 * 사이 문자의 XOR 입니다', 'The checksum is the XOR of the characters between $ and *'));
    return { _status: bad ? { ok: 'info', msg: t('🔍 문장 ' + lines.length + '개 중 문제 ' + bad + '건', '🔍 ' + bad + ' problem(s) in ' + lines.length + ' sentence(s)') } : t('✅ 문장 ' + lines.length + '개 해석', '✅ Decoded ' + lines.length + ' sentence(s)'), table: { head: [['문장 / 필드', 'Sentence / field'], ['상태', 'Status'], ['값 / 체크섬', 'Value / checksum']], rows: rows }, issues: issues };
  }
});
