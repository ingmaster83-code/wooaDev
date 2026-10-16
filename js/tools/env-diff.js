TK.tool('env-diff', {
  inputs: [
    { id: 'a', label: ['기준 파일 (A) — 예: .env.example', 'Reference file (A) — e.g. .env.example'], rows: 12, sample: '# app\nNODE_ENV=development\nPORT=3000\nDATABASE_URL=postgres://user:pass@localhost:5432/app\nREDIS_URL=redis://localhost:6379\nJWT_SECRET=changeme\nSENTRY_DSN=' },
    { id: 'b', label: ['비교 파일 (B) — 예: .env', 'File to check (B) — e.g. .env'], rows: 12, sample: 'NODE_ENV=production\nPORT=8080\nDATABASE_URL=postgres://app:s3cret@db.internal:5432/app\nJWT_SECRET=changeme\nSMTP_HOST=smtp.example.com\nSENTRY_DSN=' }
  ],
  options: [
    { id: 'vals', type: 'checkbox', label: ['값 변경도 비교', 'Compare values too'], default: true },
    { id: 'mask', type: 'checkbox', label: ['값 가리기', 'Mask values'], default: false },
    { id: 'only', type: 'checkbox', label: ['차이만 표시', 'Show differences only'], default: false }
  ],
  outputs: [
    { id: 'table', label: ['비교 결과', 'Comparison'], kind: 'table' },
    { id: 'missing', label: ['B에 없는 키 (붙여넣기용)', 'Keys missing in B (ready to paste)'], kind: 'code', ext: 'env', download: false },
    { id: 'issues', label: ['형식 경고', 'Format warnings'], kind: 'list' }
  ],
  run: function (v, o, t) {
    var pa = TK.env.parse(v.a), pb = TK.env.parse(v.b), E = TK.env;
    var ma = {}, mb = {}, order = [];
    pa.vars.forEach(function (x) { if (!(x.key in ma)) order.push(x.key); ma[x.key] = x.value; });
    pb.vars.forEach(function (x) { if (!(x.key in ma) && !(x.key in mb)) order.push(x.key); mb[x.key] = x.value; });
    var show = function (x) { return x === undefined ? '' : (o.mask ? E.mask(x) : x); };
    var rows = [], c = { same: 0, chg: 0, miss: 0, add: 0 };
    order.forEach(function (k) {
      var inA = k in ma, inB = k in mb, st, cls;
      if (inA && inB) { if (o.vals && ma[k] !== mb[k]) { st = t('값 다름', 'Changed'); cls = 'r-chg'; c.chg++; } else { st = t('동일', 'Same'); cls = ''; c.same++; } }
      else if (inA) { st = t('B에 누락', 'Missing in B'); cls = 'r-del'; c.miss++; }
      else { st = t('B에만 있음', 'Only in B'); cls = 'r-add'; c.add++; }
      if (o.only && st === t('동일', 'Same')) return;
      rows.push({ cls: cls, cells: [k, st, show(ma[k]), show(mb[k])] });
    });
    var missing = order.filter(function (k) { return k in ma && !(k in mb); }).map(function (k) { return k + '='; }).join('\n');
    var issues = pa.issues.map(function (x) { return 'A ' + t('줄 ', 'line ') + x.line + ': ' + x.msg; }).concat(pb.issues.map(function (x) { return 'B ' + t('줄 ', 'line ') + x.line + ': ' + x.msg; }));
    var problems = c.miss + c.chg + c.add;
    return {
      _status: problems ? { ok: 'info', msg: t('🔍 B에 누락 ' + c.miss + ' · B에만 있음 ' + c.add + ' · 값 다름 ' + c.chg + ' · 동일 ' + c.same, '🔍 Missing in B ' + c.miss + ' · Only in B ' + c.add + ' · Changed ' + c.chg + ' · Same ' + c.same) } : t('✅ 두 파일의 변수가 모두 같습니다 (' + c.same + '개)', '✅ Both files define the same variables (' + c.same + ')'),
      table: { head: [['변수', 'Variable'], ['상태', 'Status'], ['A', 'A'], ['B', 'B']], rows: rows, empty: ['표시할 변수가 없습니다', 'No variables to show'] },
      missing: missing,
      issues: issues
    };
  }
});
