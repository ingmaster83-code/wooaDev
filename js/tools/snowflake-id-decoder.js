TK.tool('snowflake-id-decoder', {
  inputs: [{ id: 'in', label: ['Snowflake ID (한 줄에 하나)', 'Snowflake IDs (one per line)'], rows: 7, sample: '1541815603606036480\n175928847299117063\n1543244810129002496' }],
  options: [
    { id: 'p', type: 'select', label: ['플랫폼', 'Platform'], choices: [['twitter', 'Twitter / X'], ['discord', 'Discord'], ['instagram', 'Instagram'], ['sonyflake', 'Sonyflake'], ['custom', ['사용자 정의', 'Custom']]], default: 'twitter' },
    { id: 'epoch', type: 'number', label: ['에포크(ms)', 'Epoch (ms)'], default: 1288834974657, show: function (o) { return o.p === 'custom'; } },
    { id: 'wb', type: 'number', label: ['워커 비트', 'Worker bits'], default: 10, min: 0, max: 30, show: function (o) { return o.p === 'custom'; } },
    { id: 'sb', type: 'number', label: ['시퀀스 비트', 'Sequence bits'], default: 12, min: 0, max: 30, show: function (o) { return o.p === 'custom'; } },
    { id: 'tz', type: 'text', label: ['표시 시간대', 'Display time zone'], default: 'Asia/Seoul' }
  ],
  sampleOptions: { p: 'twitter' },
  outputs: [{ id: 'table', label: ['분석 결과', 'Decoded'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, tz = (o.tz || 'UTC').trim() || 'UTC';
    if (!T.validZone(tz)) throw new Error(t('알 수 없는 시간대입니다: ' + tz + ' (예: Asia/Seoul, UTC)', 'Unknown time zone: ' + tz + ' (e.g. Asia/Seoul, UTC)'));
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [], ok = 0;
    lines.forEach(function (ln) {
      if (!/^\d{1,20}$/.test(ln)) { rows.push({ cls: 'r-bad', cells: [ln, '—', '—', t('10진수 정수가 아닙니다', 'Not a decimal integer')] }); return; }
      var id = BigInt(ln), ms, parts;
      switch (o.p) {
        case 'twitter': ms = (id >> 22n) + 1288834974657n; parts = 'datacenter ' + ((id >> 17n) & 31n) + ', worker ' + ((id >> 12n) & 31n) + ', seq ' + (id & 4095n); break;
        case 'discord': ms = (id >> 22n) + 1420070400000n; parts = 'worker ' + ((id >> 17n) & 31n) + ', process ' + ((id >> 12n) & 31n) + ', increment ' + (id & 4095n); break;
        case 'instagram': ms = (id >> 23n) + 1314220021721n; parts = 'shard ' + ((id >> 10n) & 8191n) + ', seq ' + (id & 1023n); break;
        case 'sonyflake': ms = (id >> 24n) * 10n + 1409529600000n; parts = 'machine ' + (id & 0xffffn) + ', seq ' + ((id >> 16n) & 255n); break;
        default: {
          var wb = BigInt(Math.round(o.wb)), sb = BigInt(Math.round(o.sb));
          ms = (id >> (wb + sb)) + BigInt(Math.round(o.epoch));
          parts = 'worker ' + ((id >> sb) & ((1n << wb) - 1n)) + ', seq ' + (id & ((1n << sb) - 1n));
        }
      }
      var ns = ms * 1000000n, z = T.inZone(ns, tz);
      if (ms < 0n || ms > 32503680000000n) { rows.push({ cls: 'r-bad', cells: [ln, '—', '—', t('범위를 벗어난 시간 — 플랫폼 선택을 확인하세요', 'Time out of range — check the platform')] }); return; }
      ok++;
      rows.push([ln, T.iso(ns, 3), z.text + ' (' + z.offStr + ')', parts]);
    });
    return { _status: lines.length ? t('✅ ' + ok + '개 해석', '✅ Decoded ' + ok) : '', table: { head: [['ID', 'ID'], ['생성 시각 (UTC)', 'Created (UTC)'], ['선택한 시간대', 'Selected zone'], ['구성 요소', 'Components']], rows: rows } };
  }
});
