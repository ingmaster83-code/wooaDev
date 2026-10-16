TK.tool('conventional-commit-builder', {
  allowEmpty: true,
  inputs: [
    { id: 'desc', type: 'text', label: ['설명 (제목 한 줄)', 'Description (subject line)'], sample: 'add OAuth login with PKCE', show: function (o) { return o.mode === 'build'; } },
    { id: 'scope', type: 'text', label: ['범위 (scope, 선택)', 'Scope (optional)'], sample: 'auth', show: function (o) { return o.mode === 'build'; } },
    { id: 'body', label: ['본문 (선택)', 'Body (optional)'], rows: 4, sample: 'Replaces the implicit flow. Tokens are now exchanged on the server.', show: function (o) { return o.mode === 'build'; } },
    { id: 'breaking', type: 'text', label: ['BREAKING CHANGE 설명 (비우면 호환성 유지)', 'BREAKING CHANGE description (empty = backwards compatible)'], sample: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'refs', type: 'text', label: ['이슈 참조 (예: 123, 456)', 'Issue references (e.g. 123, 456)'], sample: '123', show: function (o) { return o.mode === 'build'; } },
    { id: 'msg', label: ['검사할 커밋 메시지', 'Commit message to check'], rows: 7, sample: 'Feat(Auth): Added new login page.\nthis is the body without a blank line before it', show: function (o) { return o.mode === 'check'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['build', ['메시지 만들기', 'Build a message']], ['check', ['기존 메시지 검사', 'Check a message']]], default: 'build' },
    { id: 'type', type: 'select', label: ['타입', 'Type'], choices: [['feat', ['feat — 새 기능', 'feat — new feature']], ['fix', ['fix — 버그 수정', 'fix — bug fix']], ['docs', ['docs — 문서', 'docs — documentation']], ['style', ['style — 포맷(동작 무관)', 'style — formatting only']], ['refactor', ['refactor — 구조 개선', 'refactor — restructuring']], ['perf', ['perf — 성능 개선', 'perf — performance']], ['test', ['test — 테스트', 'test — tests']], ['build', ['build — 빌드·의존성', 'build — build / dependencies']], ['ci', ['ci — CI 설정', 'ci — CI config']], ['chore', ['chore — 잡무', 'chore — misc']], ['revert', ['revert — 되돌리기', 'revert — revert']]], default: 'feat', show: function (o) { return o.mode === 'build'; } },
    { id: 'maxlen', type: 'number', label: ['제목 최대 길이', 'Max subject length'], default: 72, min: 20, max: 200 }
  ],
  outputs: [{ id: 'out', label: ['커밋 메시지', 'Commit message'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['분석', 'Analysis'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'], issues = [], msg, type, scope, desc, body = '', footers = [], breaking = false, bangMark = false;
    if (o.mode === 'build') {
      type = o.type; scope = (v.scope || '').trim(); desc = (v.desc || '').trim(); body = (v.body || '').trim();
      if (!desc) throw new Error(t('설명(제목)을 입력하세요', 'Enter a description'));
      var bc = (v.breaking || '').trim(); breaking = !!bc; bangMark = breaking;
      var refs = String(v.refs || '').split(/[,\s]+/).filter(Boolean).map(function (r) { return r.replace(/^#?/, '#'); });
      if (bc) footers.push('BREAKING CHANGE: ' + bc);
      if (refs.length) footers.push((type === 'fix' ? 'Fixes ' : 'Refs ') + refs.join(', '));
      msg = type + (scope ? '(' + scope + ')' : '') + (bangMark ? '!' : '') + ': ' + desc + (body ? '\n\n' + body : '') + (footers.length ? '\n\n' + footers.join('\n') : '');
    } else {
      msg = String(v.msg || '').replace(/\r/g, '').replace(/\s+$/, '');
      if (!msg.trim()) throw new Error(t('커밋 메시지를 입력하세요', 'Enter a commit message'));
      var lines = msg.split('\n'), header = lines[0], m = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:\s?(.*)$/.exec(header);
      if (!m) { issues.push(t('🚨 첫 줄이 "타입(범위): 설명" 형식이 아닙니다', '🚨 The first line is not in "type(scope): description" form')); }
      else { type = m[1]; scope = m[2] || ''; bangMark = !!m[3]; desc = m[4]; }
      if (lines.length > 1 && lines[1].trim() !== '') issues.push(t('제목 다음 줄은 비워야 합니다 (본문은 한 줄 띄고 시작)', 'Leave a blank line between the subject and the body'));
      var rest = lines.slice(1).join('\n');
      var fm = rest.split('\n').filter(function (l) { return /^(BREAKING[ -]CHANGE|[A-Za-z-]+)(: | #)/.test(l); });
      footers = fm; breaking = bangMark || fm.some(function (l) { return /^BREAKING[ -]CHANGE: /.test(l); });
      body = rest.split('\n').filter(function (l) { return fm.indexOf(l) < 0; }).join('\n').trim();
      if (m && !/^[a-z]+$/.test(type)) issues.push(t('타입은 소문자여야 합니다 (' + type + ' → ' + type.toLowerCase() + ')', 'The type should be lowercase (' + type + ' → ' + type.toLowerCase() + ')'));
      if (m && TYPES.indexOf(type.toLowerCase()) < 0) issues.push(t('표준 타입이 아닙니다: ' + type + ' (' + TYPES.join(', ') + ')', 'Non-standard type: ' + type + ' (' + TYPES.join(', ') + ')'));
      if (m && !desc.trim()) issues.push(t('🚨 설명이 비어 있습니다', '🚨 The description is empty'));
      if (m && /[.。]$/.test(desc)) issues.push(t('설명 끝에 마침표를 붙이지 않습니다', 'No trailing period on the description'));
      if (m && /^[A-Z]/.test(desc)) issues.push(t('설명은 소문자로 시작하는 것이 관례입니다', 'Start the description in lowercase by convention'));
      if (m && /^(added|fixed|updated|removed|changed|adds|fixes|updates)\b/i.test(desc)) issues.push(t('명령형 현재 시제를 쓰세요 (added → add, fixed → fix)', 'Use the imperative mood (added → add, fixed → fix)'));
      if (m && header[header.indexOf(':') + 1] !== ' ') issues.push(t('🚨 콜론 뒤에 공백이 필요합니다', '🚨 A space is required after the colon'));
      if (m && scope && /\s/.test(scope)) issues.push(t('범위에 공백을 쓰지 않습니다', 'No spaces in the scope'));
    }
    var maxl = Math.round(o.maxlen) || 72, head = msg.split('\n')[0];
    if (head.length > maxl) issues.push(t('제목이 ' + head.length + '자입니다 (권장 ' + maxl + '자 이하)', 'The subject is ' + head.length + ' chars (recommended ≤ ' + maxl + ')'));
    msg.split('\n').slice(2).forEach(function (l, i) { if (l.length > 100 && !/^\s*(https?:|BREAKING)/.test(l)) issues.push(t('본문 ' + (i + 3) + '번째 줄이 100자를 넘습니다', 'Body line ' + (i + 3) + ' is over 100 chars')); });
    var bump = breaking ? 'major' : type && type.toLowerCase() === 'feat' ? 'minor' : type && type.toLowerCase() === 'fix' ? 'patch' : 'none';
    var BUMP = { major: t('major (X.0.0) — 호환성이 깨지는 변경', 'major (X.0.0) — breaking change'), minor: t('minor (0.X.0) — 기능 추가', 'minor (0.X.0) — new feature'), patch: t('patch (0.0.X) — 버그 수정', 'patch (0.0.X) — bug fix'), none: t('버전 변화 없음 (릴리스 대상 아님)', 'No version bump (not release-worthy by itself)') };
    var rows = [[t('타입', 'type'), type || '—'], [t('범위', 'scope'), scope || '—'], [t('설명', 'description'), desc || '—'], [t('본문', 'body'), body ? body.split('\n')[0] + (body.indexOf('\n') > 0 ? ' …' : '') : '—'], [t('푸터', 'footers'), footers.join(' | ') || '—'], [t('호환성 파괴', 'breaking'), breaking ? t('예', 'yes') : t('아니오', 'no')], [t('SemVer 영향', 'SemVer impact'), BUMP[bump]]];
    if (o.mode === 'build' && type === 'feat' && !scope) issues.push(t('팁: scope 를 넣으면 변경 위치가 한눈에 보입니다', 'Tip: a scope shows at a glance where the change lives'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 규칙 위반이 있습니다', '❌ Convention violated') } : issues.length ? { ok: 'info', msg: t('🔍 개선할 점 ' + issues.length + '개', '🔍 ' + issues.length + ' suggestion(s)') } : t('✅ Conventional Commits 규칙을 모두 지켰습니다', '✅ Follows Conventional Commits'), out: o.mode === 'build' ? msg : (function () { var s = type ? (type.toLowerCase() + (scope ? '(' + scope + ')' : '') + (bangMark ? '!' : '') + ': ' + (desc || '').replace(/[.。]+$/, '').replace(/^[A-Z]/, function (c) { return c.toLowerCase(); })) : head; return s + (body ? '\n\n' + body : '') + (footers.length ? '\n\n' + footers.join('\n') : ''); })(), table: { head: [['항목', 'Field'], ['값', 'Value']], rows: rows }, issues: issues };
  }
});
