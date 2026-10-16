TK.tool('env-example-generator', {
  inputs: [{ id: 'in', label: ['.env 입력', '.env input'], rows: 13, sample: '# Server\nNODE_ENV=production\nPORT=8080\n\n# Database\nDATABASE_URL=postgres://app:s3cret@db.internal:5432/app\nREDIS_URL=redis://localhost:6379\n\n# Secrets\nJWT_SECRET=9f8d7c6b5a\nSTRIPE_API_KEY=sk_live_abcdef\nFEATURE_FLAG=true' }],
  options: [
    { id: 'style', type: 'select', label: ['값 채우기', 'Placeholder style'], choices: [['empty', ['비워 두기 (KEY=)', 'Leave empty (KEY=)']], ['your', ['your_key_here', 'your_key_here']], ['angle', ['<KEY>', '<KEY>']], ['xxx', ['xxx', 'xxx']]], default: 'empty' },
    { id: 'safe', type: 'checkbox', label: ['민감하지 않은 기본값은 유지', 'Keep non-secret defaults'], default: true },
    { id: 'comments', type: 'checkbox', label: ['주석·빈 줄 유지', 'Keep comments & blank lines'], default: true },
    { id: 'hint', type: 'checkbox', label: ['민감한 키에 # secret 표시', 'Mark secret keys with # secret'], default: false }
  ],
  outputs: [
    { id: 'out', label: ['.env.example', '.env.example'], kind: 'code', ext: 'example', mime: 'text/plain' },
    { id: 'table', label: ['처리 내역', 'What happened'], kind: 'table' }
  ],
  run: function (v, o, t) {
    var r = TK.env.parse(v.in), E = TK.env, rows = [], lines = [], blanked = 0, kept = 0;
    function placeholder(k) {
      if (o.style === 'your') return 'your_' + k.toLowerCase() + '_here';
      if (o.style === 'angle') return '<' + k + '>';
      if (o.style === 'xxx') return 'xxx';
      return '';
    }
    function isSafe(k, val) {
      if (E.isSecretKey(k)) return false;
      if (/:\/\/[^\/\s]*:[^\/\s]*@/.test(val)) return false;           // user:pass@host
      if (/^[a-z][a-z0-9+.\-]*:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/\S*)?$/i.test(val)) return true;
      if (/^(true|false|yes|no|on|off|\d{1,5}|development|production|test|staging|debug|info|warn|error|localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(val)) return true;
      return val.length === 0;
    }
    r.entries.forEach(function (e) {
      if (e.type === 'blank') { if (o.comments) lines.push(''); return; }
      if (e.type === 'comment') { if (o.comments) lines.push(e.text); return; }
      if (e.type === 'invalid') { lines.push(e.raw); return; }
      var keep = o.safe && isSafe(e.key, e.value), val = keep ? e.value : placeholder(e.key);
      if (keep) kept++; else blanked++;
      lines.push((e.exported ? 'export ' : '') + e.key + '=' + E.quote(val) + (o.hint && E.isSecretKey(e.key) ? '  # secret' : ''));
      rows.push({ cls: keep ? '' : 'r-chg', cells: [e.key, keep ? t('값 유지', 'Kept') : (val === '' ? t('비움', 'Blanked') : t('대체', 'Replaced')), keep ? e.value : (val === '' ? '' : val)] });
    });
    var out = lines.join('\n').replace(/\n+$/, '') + '\n';
    return {
      _status: t('✅ 변수 ' + r.vars.length + '개 — 값 유지 ' + kept + ' · 비움/대체 ' + blanked + '. 커밋 전에 한 번 더 확인하세요.', '✅ ' + r.vars.length + ' variable(s) — kept ' + kept + ' · blanked/replaced ' + blanked + '. Double-check before committing.'),
      out: out,
      table: { head: [['변수', 'Variable'], ['처리', 'Action'], ['예시 파일의 값', 'Value in example']], rows: rows }
    };
  }
});
