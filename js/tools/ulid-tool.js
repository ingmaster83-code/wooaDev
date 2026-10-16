TK.tool('ulid-tool', {
  allowEmpty: true,
  inputs: [{ id: 'in', label: ['ULID (한 줄에 하나)', 'ULIDs (one per line)'], rows: 6, sample: '01ARZ3NDEKTSV4RRFFQ69G5FAV\n01ARZ3NDEKTSV4RRFFQ69G5FAW\n01HZX3Q8V5K9N2M4P7R6T1W0YB', placeholder: ['디코딩할 ULID를 붙여 넣으세요', 'Paste ULIDs to decode'],
    show: function (o) { return o.mode === 'decode'; } }],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['gen', ['ULID 생성', 'Generate ULIDs']], ['decode', ['ULID 분석 · 정렬 확인', 'Decode ULIDs · check order']]], default: 'gen' },
    { id: 'count', type: 'number', label: ['개수', 'Count'], default: 5, min: 1, max: 1000, show: function (o) { return o.mode === 'gen'; } },
    { id: 'mono', type: 'checkbox', label: ['같은 밀리초 안에서는 단조 증가', 'Monotonic within the same millisecond'], default: true, show: function (o) { return o.mode === 'gen'; } },
    { id: 'lower', type: 'checkbox', label: ['소문자', 'Lowercase'], default: false, show: function (o) { return o.mode === 'gen'; } },
    { id: 'at', type: 'text', label: ['시각 지정 (ISO 8601, 비우면 현재)', 'Fixed time (ISO 8601, empty = now)'], default: '', show: function (o) { return o.mode === 'gen'; } }
  ],
  sampleOptions: { mode: 'decode' },
  outputs: [{ id: 'out', label: ['생성된 ULID', 'Generated ULIDs'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['분석 결과', 'Decoded'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    function enc(ms, rnd) {                           // ms: BigInt(48bit), rnd: 10바이트
      var s = '', x = ms;
      for (var i = 0; i < 10; i++) { s = A[Number(x & 31n)] + s; x >>= 5n; }
      var r = 0n; rnd.forEach(function (b) { r = (r << 8n) | BigInt(b); });
      var rs = ''; for (var j = 0; j < 16; j++) { rs = A[Number(r & 31n)] + rs; r >>= 5n; }
      return s + rs;
    }
    if (o.mode === 'gen') {
      var n = Math.max(1, Math.min(1000, Math.round(o.count) || 1)), ms;
      if (o.at && o.at.trim()) { var p = T.parseISO(o.at.trim()); if (!p) throw new Error(t('시각 형식이 올바르지 않습니다', 'Invalid time')); ms = T.fdiv(p.ns, 1000000n); }
      else ms = BigInt(Date.now());
      if (ms < 0n || ms >= (1n << 48n)) throw new Error(t('ULID가 표현할 수 있는 시각(1970~10889년)을 벗어났습니다', 'Time outside the ULID range (1970–10889)'));
      var out = [], last = null;
      for (var i = 0; i < n; i++) {
        var rnd = Array.from(TK.bytes.random(10));
        if (o.mono && last) {                           // 이전 난수 + 1
          var x = 0n; last.forEach(function (b) { x = (x << 8n) | BigInt(b); });
          x = (x + 1n) & ((1n << 80n) - 1n);
          rnd = []; for (var k = 9; k >= 0; k--) rnd[k] = Number((x >> BigInt((9 - k) * 8)) & 255n);
        }
        last = rnd;
        var u = enc(ms, rnd); out.push(o.lower ? u.toLowerCase() : u);
      }
      return { _status: t('✅ ULID ' + n + '개 생성 (' + T.iso(ms * 1000000n, 3) + ')', '✅ Generated ' + n + ' ULID(s) (' + T.iso(ms * 1000000n, 3) + ')'), out: out.join('\n') };
    }
    var lines = String(v.in || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [], prev = null, sorted = true, valid = [];
    lines.forEach(function (ln) {
      var u = ln.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
      if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(u)) { rows.push({ cls: 'r-bad', cells: [ln, '—', '—', t('ULID는 Crockford Base32 26자입니다', 'A ULID is 26 Crockford Base32 characters')] }); return; }
      if (u[0] > '7') { rows.push({ cls: 'r-bad', cells: [ln, '—', '—', t('첫 글자는 0~7이어야 합니다 (48비트 초과)', 'The first character must be 0–7 (48-bit overflow)')] }); return; }
      var ms2 = 0n; for (var i = 0; i < 10; i++) ms2 = (ms2 << 5n) | BigInt(A.indexOf(u[i]));
      var r = 0n; for (var j = 10; j < 26; j++) r = (r << 5n) | BigInt(A.indexOf(u[j]));
      rows.push([u, T.iso(ms2 * 1000000n, 3), ms2.toString(), r.toString(16).toUpperCase().padStart(20, '0')]);
      if (prev !== null && u < prev) sorted = false; prev = u; valid.push(u);
    });
    return { _status: lines.length ? (valid.length > 1 ? t(sorted ? '✅ 입력 순서가 ULID 정렬(생성 시각) 순서와 같습니다' : '↕️ 입력 순서가 ULID 사전순과 다릅니다 (정렬하면 시간순)', sorted ? '✅ The input order matches ULID (time) order' : '↕️ The input is not in ULID order (sorting makes it chronological)') : t('✅ 분석 완료', '✅ Decoded')) : '',
      table: { head: [['ULID', 'ULID'], ['생성 시각 (UTC)', 'Time (UTC)'], ['Unix ms', 'Unix ms'], ['무작위 80비트 (hex)', 'Random 80 bits (hex)']], rows: rows } };
  }
});
