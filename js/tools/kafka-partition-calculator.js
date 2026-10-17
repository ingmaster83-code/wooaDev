TK.tool('kafka-partition-calculator', {
  inputs: [{ id: 'keys', label: ['메시지 키 (한 줄에 하나)', 'Message keys (one per line)'], rows: 8, sample: 'user-1001\nuser-1002\norder-77\n21\nfoobar\na-little-bit-long-string' }],
  options: [
    { id: 'n', type: 'number', label: ['파티션 수', 'Number of partitions'], default: 6, min: 1, max: 100000 },
    { id: 'enc', type: 'select', label: ['키 해석', 'Key encoding'], choices: [['utf8', ['UTF-8 문자열 (StringSerializer)', 'UTF-8 string (StringSerializer)']], ['hex', ['16진수 바이트', 'Hex bytes']], ['b64', 'Base64']], default: 'utf8' },
    { id: 'trim', type: 'checkbox', label: ['각 줄 앞뒤 공백 제거', 'Trim each line'], default: false }
  ],
  outputs: [{ id: 'table', label: ['키별 파티션', 'Partition per key'], kind: 'table' }, { id: 'dist', label: ['파티션 분포', 'Partition distribution'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [], n = Math.round(o.n);
    if (!(n >= 1)) throw new Error(t('파티션 수는 1 이상이어야 합니다', 'Partitions must be at least 1'));
    var lines = String(v.keys || '').replace(/\r\n/g, '\n').split('\n');
    if (o.trim) lines = lines.map(function (x) { return x.trim(); });
    var keys = lines.filter(function (x, i) { return x !== '' || (i < lines.length - 1 && false); });
    if (!keys.length) throw new Error(t('키를 한 줄에 하나씩 입력하세요', 'Enter keys, one per line'));
    if (keys.length > 20000) throw new Error(t('키는 20,000개까지 계산할 수 있습니다', 'Up to 20,000 keys are supported'));
    function murmur2(data) {
      var len = data.length, m = 0x5bd1e995, r = 24, h = (0x9747b28c ^ len) | 0, l4 = len >> 2;
      for (var i = 0; i < l4; i++) {
        var i4 = i * 4, k = (data[i4] & 0xff) + ((data[i4 + 1] & 0xff) << 8) + ((data[i4 + 2] & 0xff) << 16) + ((data[i4 + 3] & 0xff) << 24);
        k = Math.imul(k, m); k ^= k >>> r; k = Math.imul(k, m);
        h = Math.imul(h, m); h ^= k;
      }
      var rem = len & 3, base = len & ~3;
      if (rem === 3) h ^= (data[base + 2] & 0xff) << 16;
      if (rem >= 2) h ^= (data[base + 1] & 0xff) << 8;
      if (rem >= 1) { h ^= data[base] & 0xff; h = Math.imul(h, m); }
      h ^= h >>> 13; h = Math.imul(h, m); h ^= h >>> 15;
      return h | 0;
    }
    var rows = [], counts = new Array(Math.min(n, 2000)).fill(0), bad = 0, emptyKeys = 0;
    keys.forEach(function (k, idx) {
      var bytes;
      try {
        if (o.enc === 'hex') { var hx = k.replace(/0x/gi, '').replace(/[\s:,\-]/g, ''); if (!/^([0-9a-fA-F]{2})*$/.test(hx)) throw 0; bytes = new Uint8Array(hx.length / 2); for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(hx.substr(i * 2, 2), 16); }
        else if (o.enc === 'b64') bytes = N.fromB64(k);
        else bytes = new TextEncoder().encode(k);
      } catch (e) { bad++; rows.push([String(idx + 1), N.short(k, 40), '—', '—', '—', '⚠️ ' + t('해석 실패', 'cannot decode')]); return; }
      var h = murmur2(bytes), pos = h & 0x7fffffff, part = pos % n;
      if (part < counts.length) counts[part]++;
      rows.push([String(idx + 1), N.short(k, 40), String(h), '0x' + ('00000000' + (h >>> 0).toString(16)).slice(-8), String(pos), String(part)]);
    });
    var total = keys.length - bad;
    var dist = counts.map(function (c, i) { return [String(i), String(c), total ? (c / total * 100).toFixed(1) + '%' : '-', new Array(Math.round(c / Math.max.apply(null, counts) * 20) + 1).join('█')]; });
    if (n > counts.length) issues.push(t('분포표는 처음 2000개 파티션만 보여 줍니다', 'The distribution shows only the first 2000 partitions'));
    issues.push(t('Kafka 기본 파티셔너: partition = (murmur2(키 바이트) & 0x7fffffff) % 파티션 수 — 키가 있을 때만 적용됩니다. 키가 null 이면 sticky 파티셔닝(배치 단위로 한 파티션)이 쓰입니다', 'Kafka default partitioner: partition = (murmur2(key bytes) & 0x7fffffff) % partitions — only for non-null keys; null keys use sticky partitioning (one partition per batch)'));
    issues.push(t('파티션 수를 늘리면 같은 키가 다른 파티션으로 가서 키별 순서 보장이 깨집니다', 'Increasing the partition count moves keys to different partitions and breaks per-key ordering'));
    issues.push(t('Java 클라이언트와 같은 결과입니다. librdkafka 기반 클라이언트(Python confluent-kafka 등)의 기본 파티셔너는 consistent_random(CRC32) 이라 결과가 다를 수 있습니다', 'This matches the Java client; librdkafka-based clients (e.g. Python confluent-kafka) default to consistent_random (CRC32) and can differ'));
    if (total > 30 && n <= 2000) { var mx = Math.max.apply(null, counts), mn = Math.min.apply(null, counts); if (mn === 0 || mx > (total / n) * 2) issues.push(t('키 분포가 한쪽으로 치우쳐 있습니다 (핫 파티션 가능성)', 'The key distribution is skewed (possible hot partitions)')); }
    return { _status: t('✅ 키 ' + total + '개 → 파티션 ' + n + '개', '✅ ' + total + ' key(s) → ' + n + ' partition(s)') + (bad ? ' · ' + bad + t('개 해석 실패', ' failed') : ''), table: { head: [['#', '#'], ['키', 'Key'], ['murmur2 (부호 있음)', 'murmur2 (signed)'], ['16진수', 'Hex'], ['양수화', 'Positive'], ['파티션', 'Partition']], rows: rows.slice(0, 1000) }, dist: { head: [['파티션', 'Partition'], ['키 수', 'Keys'], ['비율', 'Share'], ['', '']], rows: dist }, issues: issues };
  }
});
