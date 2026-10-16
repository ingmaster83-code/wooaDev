TK.tool('objectid-tool', {
  allowEmpty: true,
  inputs: [
    { id: 'ids', label: ['ObjectId (한 줄에 하나)', 'ObjectIds (one per line)'], rows: 5, sample: '507f1f77bcf86cd799439011\n65f1a2b3c4d5e6f708192a3b\nObjectId("6512bd43d9caa6e02c990b0a")', show: function (o) { return o.mode === 'parse'; } },
    { id: 'from', type: 'text', label: ['시작 일시 (ISO 8601)', 'Start (ISO 8601)'], sample: '2026-10-01T00:00:00Z', show: function (o) { return o.mode === 'range'; } },
    { id: 'to', type: 'text', label: ['끝 일시 (ISO 8601)', 'End (ISO 8601)'], sample: '2026-10-02T00:00:00Z', show: function (o) { return o.mode === 'range'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['parse', ['ObjectId 분석', 'Parse ObjectIds']], ['gen', ['새로 생성', 'Generate']], ['range', ['날짜 범위 → ObjectId 경계', 'Date range → ObjectId bounds']]], default: 'parse' },
    { id: 'count', type: 'number', label: ['생성 개수', 'How many'], default: 5, min: 1, max: 100, show: function (o) { return o.mode === 'gen'; } },
    { id: 'tz', type: 'text', label: ['표시 시간대 (IANA)', 'Display time zone (IANA)'], default: 'Asia/Seoul', show: function (o) { return o.mode === 'parse'; } }
  ],
  outputs: [{ id: 'table', label: ['결과', 'Results'], kind: 'table' }, { id: 'out', label: ['쿼리 / 목록', 'Query / list'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var B = TK.bytes, issues = [];
    function hex8(n) { return ('00000000' + n.toString(16)).slice(-8); }
    function fmt(sec, tz) { var d = new Date(sec * 1000); try { return d.toISOString().replace('.000Z', 'Z') + '  (' + new Intl.DateTimeFormat('sv-SE', { timeZone: tz, dateStyle: 'short', timeStyle: 'medium' }).format(d) + ' ' + tz + ')'; } catch (e) { return d.toISOString(); } }
    if (o.mode === 'range') {
      var a = Date.parse(v.from), b = Date.parse(v.to);
      if (isNaN(a) || isNaN(b)) throw new Error(t('시작/끝 일시를 ISO 8601 형식으로 입력하세요 (예: 2026-10-01T00:00:00Z)', 'Enter start / end in ISO 8601 (e.g. 2026-10-01T00:00:00Z)'));
      if (b < a) throw new Error(t('끝이 시작보다 빠릅니다', 'The end is before the start'));
      var lo = hex8(Math.floor(a / 1000)) + '0000000000000000', hi = hex8(Math.floor(b / 1000)) + '0000000000000000';
      issues.push(t('경계 ObjectId 는 타임스탬프 뒤를 0으로 채운 값이라, 해당 초의 첫 ObjectId 보다 작거나 같습니다', 'Bound ObjectIds zero-fill after the timestamp, so they are ≤ the first ObjectId of that second'));
      issues.push(t('_id 범위 쿼리는 기본 인덱스를 쓰므로 createdAt 필드 없이도 빠릅니다 (단, 생성 시각 기준)', 'An _id range query uses the default index, so it is fast without a createdAt field (creation time only)'));
      return { _status: t('✅ ' + new Date(a).toISOString() + ' ~ ' + new Date(b).toISOString(), '✅ ' + new Date(a).toISOString() + ' – ' + new Date(b).toISOString()), table: { head: [['경계', 'Bound'], ['ObjectId', 'ObjectId'], ['시각', 'Time']], rows: [[t('시작 (≥)', 'start (≥)'), lo, new Date(a).toISOString()], [t('끝 (<)', 'end (<)'), hi, new Date(b).toISOString()]] }, out: 'db.collection.find({ _id: { $gte: ObjectId("' + lo + '"), $lt: ObjectId("' + hi + '") } })\n\n// mongosh / PyMongo\n{"_id": {"$gte": {"$oid": "' + lo + '"}, "$lt": {"$oid": "' + hi + '"}}}', issues: issues };
    }
    if (o.mode === 'gen') {
      var n = Math.max(1, Math.min(100, Math.round(o.count) || 1)), list = [], rnd = B.random(5), counter = (B.random(3)[0] << 16 | B.random(3)[1] << 8 | B.random(3)[2]) & 0xffffff, ts = Math.floor(Date.now() / 1000);
      for (var i = 0; i < n; i++) list.push(hex8(ts) + B.hex(Array.from(rnd)) + ('000000' + ((counter + i) & 0xffffff).toString(16)).slice(-6));
      issues.push(t('실제 드라이버처럼 [타임스탬프 4바이트][프로세스별 난수 5바이트][증가 카운터 3바이트] 구조입니다', 'Built like a real driver: [4-byte timestamp][5-byte per-process random][3-byte counter]'));
      return { _status: t('✅ ' + n + '개 생성', '✅ Generated ' + n), table: { head: [['ObjectId', 'ObjectId'], ['시각', 'Time']], rows: list.map(function (x) { return [x, new Date(parseInt(x.slice(0, 8), 16) * 1000).toISOString()]; }) }, out: list.join('\n'), issues: issues };
    }
    var lines = String(v.ids || '').replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('ObjectId 를 입력하세요', 'Enter an ObjectId'));
    var rows = [], bad = 0, sorted = [];
    lines.forEach(function (ln) {
      var m = /([0-9a-fA-F]{24})/.exec(ln.replace(/["'()]|ObjectId|\$oid|[{}:\s]/g, ''));
      if (!m || ln.replace(/[^0-9a-fA-F]/g, '').length < 24 && !m) { bad++; rows.push([ln, '❌', '', '', '']); return; }
      var h = m[1].toLowerCase(), sec = parseInt(h.slice(0, 8), 16), yr = new Date(sec * 1000).getUTCFullYear();
      if (yr < 2009 || yr > 2040) issues.push(t('시각이 비정상입니다 (' + yr + '년): ' + h + ' — ObjectId 가 아닌 임의의 24자리 값일 수 있습니다', 'Unusual time (year ' + yr + '): ' + h + ' — may be an arbitrary 24-hex value, not an ObjectId'));
      rows.push([h, '✅', fmt(sec, o.tz || 'UTC'), h.slice(8, 18) + ' (random)', parseInt(h.slice(18), 16) + ' (0x' + h.slice(18) + ')']);
      sorted.push(h);
    });
    var s2 = sorted.slice().sort();
    issues.push(t('ObjectId 는 앞 4바이트가 초 단위 시각이라 문자열 정렬 = 대략적인 생성 순서입니다 (같은 초 안에서는 카운터 순)', 'The first 4 bytes are a timestamp in seconds, so string order ≈ creation order (counter order inside the same second)'));
    return { _status: bad ? { ok: 'info', msg: t('🔍 ' + lines.length + '개 중 ' + bad + '개가 ObjectId 가 아닙니다', '🔍 ' + bad + ' of ' + lines.length + ' are not ObjectIds') } : t('✅ ' + lines.length + '개 분석', '✅ Parsed ' + lines.length), table: { head: [['ObjectId', 'ObjectId'], ['상태', 'Status'], ['생성 시각', 'Created'], ['난수(5바이트)', 'Random (5 bytes)'], ['카운터(3바이트)', 'Counter (3 bytes)']], rows: rows }, out: s2.join('\n'), issues: issues };
  }
});
