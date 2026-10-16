TK.tool('git-ref-validator', {
  inputs: [{ id: 'names', label: ['브랜치·태그 이름 (한 줄에 하나)', 'Branch / tag names (one per line)'], rows: 8, sample: 'feature/login-page\nfix bug\nrelease/v1.2.0\nhotfix..urgent\n.hidden\nfeature/new.lock\nmy-branch.\n@\nfeat/add-@{x}\n-bad\nfeature//double\nUSER/Mixed_Case' }],
  options: [
    { id: 'kind', type: 'select', label: ['종류', 'Kind'], choices: [['branch', ['브랜치 이름', 'Branch name']], ['tag', ['태그 이름', 'Tag name']], ['ref', ['참조 전체(refs/…)', 'Full ref (refs/…)']]], default: 'branch' },
    { id: 'conv', type: 'checkbox', label: ['팀 규칙도 점검 (소문자·하이픈·접두사)', 'Also check team conventions (lowercase, hyphens, prefix)'], default: true }
  ],
  sampleExpectError: true,
  outputs: [{ id: 'table', label: ['검사 결과', 'Results'], kind: 'table' }, { id: 'out', label: ['고친 이름 제안', 'Suggested fixes'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var names = String(v.names).replace(/\r/g, '').split('\n').filter(function (s) { return s.length; });
    if (!names.length) throw new Error(t('이름을 입력하세요', 'Enter at least one name'));
    var rows = [], fixes = [], bad = 0;
    names.forEach(function (n) {
      var p = [], conv = [], raw = n;
      if (o.kind === 'ref' && !/^refs\//.test(n) && n !== 'HEAD') p.push(t('refs/ 로 시작해야 합니다', 'Must start with refs/'));
      if (n === '@') p.push(t('@ 한 글자는 쓸 수 없습니다 (HEAD 의 별칭)', 'A lone @ is not allowed (alias of HEAD)'));
      if (/\.\./.test(n)) p.push(t('연속된 점(..)을 쓸 수 없습니다', 'Cannot contain ..'));
      if (/[\x00-\x20\x7f]/.test(n)) p.push(t('공백이나 제어 문자를 쓸 수 없습니다', 'Cannot contain spaces or control characters'));
      if (/[~^:?*\[\\]/.test(n)) p.push(t('~ ^ : ? * [ \\ 문자를 쓸 수 없습니다', 'Cannot contain ~ ^ : ? * [ or \\'));
      if (/@\{/.test(n)) p.push(t('@{ 시퀀스를 쓸 수 없습니다', 'Cannot contain the sequence @{'));
      if (/^\/|\/$/.test(n)) p.push(t('/ 로 시작하거나 끝날 수 없습니다', 'Cannot begin or end with /'));
      if (/\/\//.test(n)) p.push(t('연속된 슬래시(//)를 쓸 수 없습니다', 'Cannot contain consecutive slashes'));
      if (/\.$/.test(n)) p.push(t('점(.)으로 끝날 수 없습니다', 'Cannot end with a dot'));
      if (n.split('/').some(function (c) { return /^\./.test(c); })) p.push(t('점(.)으로 시작하는 구성 요소가 있습니다', 'A path component starts with a dot'));
      if (n.split('/').some(function (c) { return /\.lock$/.test(c); })) p.push(t('.lock 으로 끝나는 구성 요소가 있습니다', 'A path component ends with .lock'));
      if (o.kind !== 'ref' && /^-/.test(n)) p.push(t('- 로 시작하면 명령어 옵션으로 오해됩니다', 'A leading - is mistaken for a command-line option'));
      if (!n.length) p.push(t('비어 있습니다', 'Empty'));
      if (n.length > 255 || new TextEncoder().encode(n).length > 255) p.push(t('255바이트를 넘으면 파일 시스템 한도에 걸립니다 (refs 는 파일로 저장됨)', 'Over 255 bytes hits filesystem limits (refs are stored as files)'));
      if (o.conv && !p.length) {
        if (/[A-Z]/.test(n)) conv.push(t('대문자 포함 — 대소문자 구분 안 하는 파일 시스템(Windows/macOS)에서 충돌할 수 있습니다', 'Contains uppercase — can collide on case-insensitive filesystems (Windows / macOS)'));
        if (/_/.test(n) && /-/.test(n)) conv.push(t('_ 와 - 가 섞여 있습니다', 'Mixes _ and -'));
        if (o.kind === 'branch' && n.indexOf('/') < 0 && !/^(main|master|develop|dev|staging|production|trunk)$/.test(n)) conv.push(t('접두사(feature/, fix/ 등)가 없습니다', 'No prefix (feature/, fix/ …)'));
        if (n.length > 60) conv.push(t(n.length + '자 — 너무 깁니다', n.length + ' chars — too long'));
        if (/[^\x00-\x7f]/.test(n)) conv.push(t('ASCII 가 아닌 문자가 있습니다 — 환경에 따라 문제가 될 수 있습니다', 'Non-ASCII characters — can cause problems on some systems'));
      }
      var fix = n.replace(/[\x00-\x20\x7f~^:?*\[\\]+/g, '-').replace(/@\{|\}/g, '-').replace(/\.{2,}/g, '.').replace(/\/{2,}/g, '/').replace(/^[\/.\-]+/, '').replace(/[\/.-]+$/, '').replace(/(^|\/)\./g, '$1').replace(/\.lock(\/|$)/g, '-lock$1').replace(/-{2,}/g, '-');
      if (fix === '@') fix = 'at';
      if (o.conv) fix = fix.toLowerCase();
      if (p.length) bad++;
      var ok = !p.length;
      if ((p.length || (o.conv && fix !== n && conv.length)) && fix) fixes.push(n + '  →  ' + fix);
      rows.push([JSON.stringify(raw).slice(1, -1), ok ? (conv.length ? '⚠️' : '✅') : '❌', p.concat(conv).join(' · ') || t('git check-ref-format 규칙을 모두 통과', 'Passes every git check-ref-format rule'), ok && !conv.length ? '' : (fix && fix !== n ? fix : '')]);
    });
    var issues = [t('규칙 출처: git check-ref-format. 실제 저장소에서는 git check-ref-format --branch "이름" 으로 최종 확인할 수 있습니다', 'Rules come from git check-ref-format. In a real repository confirm with git check-ref-format --branch "name"'), t('이름에 / 가 있으면 폴더처럼 저장됩니다 — feature 브랜치가 있는 상태에서 feature/x 를 만들 수 없습니다 (충돌)', 'A / makes the ref a path — you cannot create feature/x while a branch named feature exists (conflict)')];
    return { _status: bad ? { ok: false, msg: t('❌ ' + names.length + '개 중 ' + bad + '개가 Git 규칙을 위반합니다', '❌ ' + bad + ' of ' + names.length + ' name(s) violate Git rules') } : t('✅ ' + names.length + '개 이름이 모두 유효합니다', '✅ All ' + names.length + ' name(s) are valid'), table: { head: [['이름', 'Name'], ['판정', 'Verdict'], ['사유', 'Reason'], ['제안', 'Suggestion']], rows: rows }, out: fixes.join('\n'), issues: issues };
  }
});
