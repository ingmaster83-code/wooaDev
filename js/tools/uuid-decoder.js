TK.tool('uuid-decoder', {
  inputs: [{ id: 'in', label: ['UUID (한 줄에 하나)', 'UUIDs (one per line)'], rows: 8, placeholder: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000'],
    sample: '018f3c5e-7b1a-7c3e-9a1b-2d4e6f8a0b1c\n6ba7b810-9dad-11d1-80b4-00c04fd430c8\n550e8400-e29b-41d4-a716-446655440000\n1ef7a5c4-3b1f-6a3e-8c11-0242ac120002\n00000000-0000-0000-0000-000000000000' }],
  options: [{ id: 'digits', type: 'select', label: ['시간 표시 정밀도', 'Time precision'], choices: [['3', ['밀리초', 'Milliseconds']], ['7', ['100나노초(v1·v6 원본)', '100 ns (native for v1/v6)']]], default: '3', num: true }],
  outputs: [{ id: 'table', label: ['분석 결과', 'Decoded'], kind: 'table' }],
  run: function (v, o, t) {
    var T = TK.time, rows = [], ok = 0, lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var VER = { 1: ['시간 기반(MAC)', 'Time-based (MAC)'], 2: ['DCE 보안', 'DCE security'], 3: ['이름 기반 MD5', 'Name-based MD5'], 4: ['무작위', 'Random'], 5: ['이름 기반 SHA-1', 'Name-based SHA-1'], 6: ['재정렬된 시간 기반', 'Reordered time-based'], 7: ['Unix 시간 + 무작위', 'Unix time + random'], 8: ['사용자 정의', 'Custom'] };
    lines.forEach(function (ln) {
      var raw = ln.replace(/^urn:uuid:/i, '').replace(/^\{|\}$/g, '').replace(/-/g, '');
      if (!/^[0-9a-fA-F]{32}$/.test(raw)) { rows.push({ cls: 'r-bad', cells: [ln, '—', '—', '—', t('UUID 형식이 아닙니다 (16진수 32자리)', 'Not a UUID (32 hex digits)')] }); return; }
      ok++;
      var h = raw.toLowerCase(), uuid = h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
      if (/^0+$/.test(h)) { rows.push([uuid, 'nil', '—', '—', t('모든 비트가 0인 Nil UUID', 'The Nil UUID (all zeros)')]); return; }
      if (/^f+$/.test(h)) { rows.push([uuid, 'max', '—', '—', t('모든 비트가 1인 Max UUID', 'The Max UUID (all ones)')]); return; }
      var ver = parseInt(h[12], 16), vb = parseInt(h[16], 16), variant;
      if ((vb & 8) === 0) variant = 'NCS'; else if ((vb & 12) === 8) variant = 'RFC 9562 (4122)'; else if ((vb & 14) === 12) variant = 'Microsoft'; else variant = t('예약됨', 'Reserved');
      var time = '—', detail = '', ns = null;
      if (ver === 1 || ver === 6) {
        var ts = ver === 1 ? (BigInt('0x' + h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8))) : (BigInt('0x' + h.slice(0, 8) + h.slice(8, 12) + h.slice(13, 16)));
        ns = ts * 100n - 12219292800n * 1000000000n;
        var node = h.slice(20), multicast = (parseInt(node.slice(0, 2), 16) & 1) === 1;
        detail = t('clock_seq ', 'clock_seq ') + parseInt(h.slice(16, 20), 16) % 16384 + ', node ' + node.replace(/(..)(?=.)/g, '$1:') + (multicast ? t(' (무작위 노드)', ' (random node)') : '');
      } else if (ver === 7) {
        ns = BigInt('0x' + h.slice(0, 12)) * 1000000n;
        detail = 'rand_a ' + h.slice(13, 16) + ', rand_b ' + h.slice(16);
      } else if (ver === 4) detail = t('122비트 무작위 값', '122 random bits');
      else if (ver === 3 || ver === 5) detail = t('네임스페이스+이름의 해시 (역산 불가)', 'Hash of namespace + name (cannot be reversed)');
      if (ns !== null) time = T.iso(ns, o.digits);
      var vname = VER[ver] ? t(VER[ver][0], VER[ver][1]) : t('알 수 없음', 'Unknown');
      rows.push([uuid, 'v' + ver + ' · ' + vname, variant, time, detail]);
    });
    return {
      _status: lines.length ? t('✅ ' + lines.length + '개 중 ' + ok + '개 해석', '✅ Decoded ' + ok + ' of ' + lines.length) : '',
      table: { head: [['UUID', 'UUID'], ['버전', 'Version'], ['변형', 'Variant'], ['시간 (UTC)', 'Time (UTC)'], ['세부 정보', 'Details']], rows: rows }
    };
  }
});
