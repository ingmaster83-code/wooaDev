TK.tool('modern-id-generator', {
  allowEmpty: true,
  inputs: [{ id: 'in', label: ['디코딩할 KSUID (한 줄에 하나)', 'KSUIDs to decode (one per line)'], rows: 5, sample: '0ujtsYcgvSTl8PAuAdqWYSMnLOv\n0ujsswThIGTUYm2K8FjOOfXtY1K', show: function (o) { return o.kind === 'ksuid-dec'; } }],
  options: [
    { id: 'kind', type: 'select', label: ['종류', 'Type'], choices: [['nanoid', 'Nano ID'], ['ksuid', ['KSUID 생성', 'Generate KSUID']], ['ksuid-dec', ['KSUID 해독', 'Decode KSUID']], ['uuid7', 'UUID v7'], ['typeid', 'TypeID (prefix + UUIDv7)']], default: 'nanoid' },
    { id: 'count', type: 'number', label: ['개수', 'Count'], default: 5, min: 1, max: 500, show: function (o) { return o.kind !== 'ksuid-dec'; } },
    { id: 'size', type: 'number', label: ['길이', 'Length'], default: 21, min: 1, max: 256, show: function (o) { return o.kind === 'nanoid'; } },
    { id: 'alphabet', type: 'text', label: ['문자 집합', 'Alphabet'], default: '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', show: function (o) { return o.kind === 'nanoid'; } },
    { id: 'prefix', type: 'text', label: ['TypeID 접두어', 'TypeID prefix'], default: 'user', show: function (o) { return o.kind === 'typeid'; } }
  ],
  sampleOptions: { kind: 'ksuid-dec' },
  outputs: [{ id: 'out', label: ['생성된 ID', 'Generated IDs'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['분석 결과', 'Decoded'], kind: 'table' }],
  run: function (v, o, t) {
    var B = TK.bytes, T = TK.time, n = Math.max(1, Math.min(500, Math.round(o.count) || 1)), out = [];
    var B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', KEPOCH = 1400000000n;
    function toB62(bytes) { var x = 0n; bytes.forEach(function (b) { x = (x << 8n) | BigInt(b); }); var s = ''; while (x > 0n) { s = B62[Number(x % 62n)] + s; x /= 62n; } return s.padStart(27, '0'); }
    function uuid7() {
      var b = Array.from(B.random(16)), ms = BigInt(Date.now());
      for (var i = 0; i < 6; i++) b[i] = Number((ms >> BigInt((5 - i) * 8)) & 255n);
      b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
      return b;
    }
    function hexUuid(b) { var h = B.hex(b); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20); }
    if (o.kind === 'ksuid-dec') {
      var lines = String(v.in || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [];
      lines.forEach(function (ln) {
        if (!/^[0-9A-Za-z]{27}$/.test(ln)) { rows.push({ cls: 'r-bad', cells: [ln, '—', '—', t('KSUID는 Base62 27자입니다', 'A KSUID is 27 Base62 characters')] }); return; }
        var x = 0n; for (var i = 0; i < 27; i++) x = x * 62n + BigInt(B62.indexOf(ln[i]));
        if (x >= (1n << 160n)) { rows.push({ cls: 'r-bad', cells: [ln, '—', '—', t('160비트를 넘는 값입니다', 'Exceeds 160 bits')] }); return; }
        var ts = x >> 128n, payload = x & ((1n << 128n) - 1n), unixSec = ts + KEPOCH;
        rows.push([ln, T.iso(unixSec * 1000000000n, 0), unixSec.toString(), payload.toString(16).padStart(32, '0')]);
      });
      return { _status: lines.length ? t('✅ ' + rows.length + '개 분석', '✅ Decoded ' + rows.length) : '', table: { head: [['KSUID', 'KSUID'], ['생성 시각 (UTC)', 'Time (UTC)'], ['Unix 초', 'Unix s'], ['페이로드 128비트 (hex)', 'Payload 128 bits (hex)']], rows: rows } };
    }
    if (o.kind === 'nanoid') {
      var size = Math.max(1, Math.min(256, Math.round(o.size) || 21)), al = Array.from(o.alphabet || '');
      al = al.filter(function (c, i) { return al.indexOf(c) === i; });
      if (al.length < 2 || al.length > 256) throw new Error(t('문자 집합은 서로 다른 문자 2~256개여야 합니다', 'The alphabet needs 2–256 distinct characters'));
      var mask = (2 << (31 - Math.clz32((al.length - 1) | 1))) - 1;
      for (var i = 0; i < n; i++) {
        var id = '';
        while (id.length < size) { var rb = B.random(Math.ceil(1.6 * mask * (size - id.length) / al.length) + 4); for (var j = 0; j < rb.length && id.length < size; j++) { var idx = rb[j] & mask; if (idx < al.length) id += al[idx]; } }
        out.push(id);
      }
      var bits = Math.floor(size * Math.log2(al.length));
      return { _status: t('✅ Nano ID ' + n + '개 — 약 ' + bits + '비트 엔트로피', '✅ ' + n + ' Nano ID(s) — about ' + bits + ' bits of entropy'), out: out.join('\n') };
    }
    for (var k = 0; k < n; k++) {
      if (o.kind === 'ksuid') { var ts2 = BigInt(Math.floor(Date.now() / 1000)) - KEPOCH, pl = Array.from(B.random(16)); out.push(toB62([Number((ts2 >> 24n) & 255n), Number((ts2 >> 16n) & 255n), Number((ts2 >> 8n) & 255n), Number(ts2 & 255n)].concat(pl))); }
      else if (o.kind === 'uuid7') out.push(hexUuid(uuid7()));
      else {
        var pre = String(o.prefix || '').toLowerCase();
        if (pre && !/^[a-z]([a-z_]{0,61}[a-z])?$/.test(pre)) throw new Error(t('TypeID 접두어는 소문자와 _ 로 이루어진 1~63자여야 합니다', 'A TypeID prefix is 1–63 lowercase letters/underscores'));
        var u = uuid7(), x2 = 0n; u.forEach(function (b) { x2 = (x2 << 8n) | BigInt(b); });
        var C = '0123456789abcdefghjkmnpqrstvwxyz', s = ''; for (var m = 0; m < 26; m++) { s = C[Number(x2 & 31n)] + s; x2 >>= 5n; }
        out.push((pre ? pre + '_' : '') + s);
      }
    }
    return { _status: t('✅ ' + n + '개 생성', '✅ Generated ' + n), out: out.join('\n') };
  }
});
