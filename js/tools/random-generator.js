TK.tool('random-generator', {
  allowEmpty: true,
  inputs: [{ id: 'in', label: ['목록 (한 줄에 하나)', 'List (one item per line)'], rows: 6, sample: '김민준\n이서연\n박지호\n최유나\n정현우', show: function (o) { return o.kind === 'pick' || o.kind === 'shuffle'; } }],
  options: [
    { id: 'kind', type: 'select', label: ['종류', 'Type'], choices: [['string', ['랜덤 문자열', 'Random strings']], ['int', ['랜덤 정수', 'Random integers']], ['float', ['랜덤 실수', 'Random decimals']], ['pick', ['목록에서 뽑기', 'Pick from a list']], ['shuffle', ['목록 섞기', 'Shuffle a list']]], default: 'string' },
    { id: 'charset', type: 'select', label: ['문자 종류', 'Characters'], choices: [['alnum', ['영문 대소문자 + 숫자', 'Letters + digits']], ['lower', ['소문자', 'Lowercase']], ['upper', ['대문자', 'Uppercase']], ['digits', ['숫자', 'Digits']], ['hex', '16진수'], ['b64url', 'Base64url'], ['safe', ['헷갈리는 문자 제외 (0O1lI)', 'No look-alikes (0O1lI)']], ['custom', ['직접 입력', 'Custom']]], default: 'alnum', show: function (o) { return o.kind === 'string'; } },
    { id: 'custom', type: 'text', label: ['사용할 문자', 'Characters to use'], default: 'ABC123', show: function (o) { return o.kind === 'string' && o.charset === 'custom'; } },
    { id: 'len', type: 'number', label: ['길이', 'Length'], default: 16, min: 1, max: 1024, show: function (o) { return o.kind === 'string'; } },
    { id: 'min', type: 'number', label: ['최솟값', 'Minimum'], default: 1, show: function (o) { return o.kind === 'int' || o.kind === 'float'; } },
    { id: 'max', type: 'number', label: ['최댓값', 'Maximum'], default: 100, show: function (o) { return o.kind === 'int' || o.kind === 'float'; } },
    { id: 'dec', type: 'number', label: ['소수 자리', 'Decimal places'], default: 2, min: 0, max: 10, show: function (o) { return o.kind === 'float'; } },
    { id: 'n', type: 'number', label: ['개수', 'Count'], default: 5, min: 1, max: 1000, show: function (o) { return o.kind !== 'shuffle'; } },
    { id: 'uniq', type: 'checkbox', label: ['중복 없이', 'No duplicates'], default: false, show: function (o) { return o.kind === 'int' || o.kind === 'pick'; } }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var B = TK.bytes, n = Math.max(1, Math.min(1000, Math.round(o.n) || 1)), out = [];
    var rint = function (max) {                         // 0..max-1, 2^32 초과도 처리
      if (max <= 4294967296) return B.randInt(max);
      var bits = Math.ceil(Math.log2(max)), bytes = Math.ceil(bits / 8), lim = (1n << BigInt(bytes * 8)) / BigInt(max) * BigInt(max), x;
      do { x = 0n; B.random(bytes).forEach(function (b) { x = (x << 8n) | BigInt(b); }); } while (x >= lim);
      return Number(x % BigInt(max));
    };
    if (o.kind === 'string') {
      var SETS = { alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', hex: '0123456789abcdef', b64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', safe: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' };
      var set = Array.from(o.charset === 'custom' ? (o.custom || '') : SETS[o.charset]);
      set = set.filter(function (c, i) { return set.indexOf(c) === i; });
      if (set.length < 2) throw new Error(t('문자가 2종류 이상 필요합니다', 'At least 2 distinct characters are required'));
      var len = Math.max(1, Math.min(1024, Math.round(o.len) || 16));
      for (var i = 0; i < n; i++) { var s = ''; for (var j = 0; j < len; j++) s += set[B.randInt(set.length)]; out.push(s); }
      return { _status: t('✅ ' + n + '개 생성 — 문자열당 약 ' + Math.floor(len * Math.log2(set.length)) + '비트 엔트로피 (암호학적 난수)', '✅ ' + n + ' generated — about ' + Math.floor(len * Math.log2(set.length)) + ' bits of entropy each (cryptographic RNG)'), out: out.join('\n') };
    }
    if (o.kind === 'int') {
      var lo = Math.ceil(Math.min(o.min, o.max)), hi = Math.floor(Math.max(o.min, o.max)), span = hi - lo + 1;
      if (o.uniq && n > span) throw new Error(t('범위(' + span + '개)보다 많은 값을 중복 없이 뽑을 수 없습니다', 'Cannot draw ' + n + ' unique values from a range of ' + span));
      var seen = {};
      while (out.length < n) { var x = lo + rint(span); if (o.uniq) { if (seen[x]) continue; seen[x] = 1; } out.push(x); }
      return { _status: t('✅ ' + lo + ' ~ ' + hi + ' 정수 ' + n + '개', '✅ ' + n + ' integers in ' + lo + ' – ' + hi), out: out.join('\n') };
    }
    if (o.kind === 'float') {
      var a = Math.min(o.min, o.max), b = Math.max(o.min, o.max), d = Math.max(0, Math.min(10, Math.round(o.dec)));
      for (var q = 0; q < n; q++) { var r = (B.randInt(4294967296) * 4294967296 + B.randInt(4294967296)) / 18446744073709551616; out.push((a + r * (b - a)).toFixed(d)); }
      return { _status: t('✅ ' + a + ' ~ ' + b + ' 실수 ' + n + '개', '✅ ' + n + ' decimals in ' + a + ' – ' + b), out: out.join('\n') };
    }
    var items = String(v.in || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!items.length) throw new Error(t('목록을 입력하세요 (한 줄에 하나)', 'Enter a list (one item per line)'));
    if (o.kind === 'shuffle') {
      for (var z = items.length - 1; z > 0; z--) { var w = rint(z + 1), tmp = items[z]; items[z] = items[w]; items[w] = tmp; }
      return { _status: t('✅ ' + items.length + '개 항목을 섞었습니다 (Fisher–Yates)', '✅ Shuffled ' + items.length + ' items (Fisher–Yates)'), out: items.join('\n') };
    }
    if (o.uniq && n > items.length) throw new Error(t('목록(' + items.length + '개)보다 많이 중복 없이 뽑을 수 없습니다', 'Cannot pick ' + n + ' unique items from ' + items.length));
    var pool = items.slice();
    for (var c = 0; c < n; c++) { var idx = rint(pool.length); out.push(pool[idx]); if (o.uniq) pool.splice(idx, 1); }
    return { _status: t('✅ ' + n + '개 선택', '✅ Picked ' + n), out: out.join('\n') };
  }
});
