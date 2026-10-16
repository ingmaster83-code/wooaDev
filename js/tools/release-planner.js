TK.tool('release-planner', {
  inputs: [{ id: 'commits', label: ['커밋 메시지 목록 (한 줄에 하나, 해시 접두 가능)', 'Commit messages (one per line, hash prefix allowed)'], rows: 12, sample: 'a1b2c3d feat(auth): add OAuth login with PKCE\ne4f5a6b fix(api): handle empty response from /items (#214)\n7c8d9e0 perf(db): add index on orders.created_at\n1f2e3d4 docs: explain deployment steps\n5a6b7c8 refactor(core)!: drop the legacy session store\n9d0e1f2 fix: typo in error message\n3c4d5e6 chore(deps): bump express to 4.19.2\nWIP stuff\n8b9c0d1 feat(ui): dark mode toggle (closes #230)' }],
  options: [
    { id: 'cur', type: 'text', label: ['현재 버전', 'Current version'], default: '1.4.2' },
    { id: 'date', type: 'text', label: ['릴리스 날짜 (비우면 오늘)', 'Release date (empty = today)'], default: '' },
    { id: 'repo', type: 'text', label: ['저장소 URL (비교·이슈 링크용, 선택)', 'Repository URL (for compare / issue links, optional)'], default: 'https://github.com/example/app' },
    { id: 'pre', type: 'text', label: ['프리릴리스 식별자 (예: rc, beta, 비우면 정식)', 'Prerelease id (e.g. rc, beta; empty = stable)'], default: '' },
    { id: 'zero', type: 'checkbox', label: ['0.x 버전에서는 breaking → minor 로 처리', 'In 0.x treat breaking as minor'], default: true },
    { id: 'style', type: 'select', label: ['체인지로그 형식', 'Changelog style'], choices: [['conv', ['Conventional (기능/수정 분류)', 'Conventional (Features / Fixes)']], ['keep', 'Keep a Changelog (Added / Changed / Fixed)']], default: 'conv' }
  ],
  outputs: [{ id: 'out', label: ['체인지로그 (Markdown)', 'Changelog (Markdown)'], kind: 'code', ext: 'md' }, { id: 'table', label: ['커밋 분류', 'Commit classification'], kind: 'table' }, { id: 'cmd', label: ['릴리스 명령어', 'Release commands'], kind: 'code', ext: 'sh' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var cm = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(o.cur || '').trim());
    if (!cm) throw new Error(t('현재 버전이 SemVer(예: 1.4.2, 2.0.0-rc.1) 형식이 아닙니다', 'The current version is not SemVer (e.g. 1.4.2, 2.0.0-rc.1)'));
    var maj = +cm[1], min = +cm[2], pat = +cm[3], curPre = cm[4] || '';
    var lines = String(v.commits).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('커밋 메시지를 입력하세요', 'Enter commit messages'));
    var TYPES = { feat: ['✨ 새 기능', '✨ Features', 'Added'], fix: ['🐛 버그 수정', '🐛 Bug Fixes', 'Fixed'], perf: ['⚡ 성능 개선', '⚡ Performance', 'Changed'], refactor: ['♻️ 리팩터링', '♻️ Refactoring', 'Changed'], docs: ['📚 문서', '📚 Documentation', 'Changed'], revert: ['⏪ 되돌림', '⏪ Reverts', 'Removed'], build: ['📦 빌드', '📦 Build', 'Changed'], ci: ['🤖 CI', '🤖 CI', 'Changed'], test: ['✅ 테스트', '✅ Tests', 'Changed'], style: ['💄 스타일', '💄 Style', 'Changed'], chore: ['🔧 기타', '🔧 Chores', 'Changed'] };
    var HIDE = { docs: 1, build: 1, ci: 1, test: 1, style: 1, chore: 1 };
    var items = [], rows = [], skipped = [], breaking = false, feat = false, fix = false, repo = String(o.repo || '').trim().replace(/\/+$/, '').replace(/\.git$/, '');
    lines.forEach(function (ln) {
      var h = '', msg = ln, hm = /^([0-9a-f]{7,40})\s+(.*)$/.exec(ln); if (hm) { h = hm[1]; msg = hm[2]; }
      var m = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:\s+(.+)$/.exec(msg);
      if (!m || !TYPES[m[1].toLowerCase()]) { skipped.push(ln); rows.push([ln.slice(0, 70), '—', t('무시됨 (Conventional 형식 아님)', 'ignored (not Conventional)'), '']); return; }
      var type = m[1].toLowerCase(), isB = !!m[3] || /BREAKING[ -]CHANGE/.test(msg), desc = m[4];
      var ref = /\((?:closes|fixes|refs)?\s*#(\d+)\)\s*$/i.exec(desc) || /\(#(\d+)\)\s*$/.exec(desc);
      items.push({ type: type, scope: m[2] || '', desc: desc.replace(/\s*\((?:closes |fixes |refs )?#\d+\)\s*$/i, ''), brk: isB, hash: h, ref: ref ? ref[1] : '' });
      if (isB) breaking = true; if (type === 'feat') feat = true; if (type === 'fix' || type === 'perf') fix = true;
      rows.push([ln.slice(0, 70), type + (m[2] ? '(' + m[2] + ')' : ''), isB ? t('💥 호환성 파괴 → major', '💥 breaking → major') : type === 'feat' ? 'minor' : type === 'fix' || type === 'perf' ? 'patch' : t('릴리스에 영향 없음', 'no release impact'), h || '']);
    });
    if (!items.length) throw new Error(t('Conventional Commits 형식(feat:, fix: …)의 커밋이 하나도 없습니다', 'No Conventional Commits (feat:, fix: …) found'));
    var bump = breaking ? (maj === 0 && o.zero ? 'minor' : 'major') : feat ? 'minor' : fix ? 'patch' : 'none', issues = [];
    var nmaj = maj, nmin = min, npat = pat, ver, pre = String(o.pre || '').trim().replace(/[^0-9A-Za-z.-]/g, '');
    if (bump === 'none') { issues.push(t('릴리스할 변경(feat / fix / perf / breaking)이 없습니다 — docs·chore 만으로는 버전을 올리지 않는 것이 관례입니다', 'Nothing release-worthy (feat / fix / perf / breaking) — docs and chores alone usually do not bump the version')); bump = 'patch'; }
    if (curPre && pre) {
      var pm = /^(.*?)(?:\.(\d+))?$/.exec(curPre);
      if (pm[1] === pre) { ver = maj + '.' + min + '.' + pat + '-' + pre + '.' + ((+pm[2] || 0) + 1); } else ver = null;
    }
    if (!ver) {
      if (bump === 'major') { nmaj++; nmin = 0; npat = 0; } else if (bump === 'minor') { nmin++; npat = 0; } else if (!curPre || pre) npat++;
      if (curPre && !pre) { nmaj = maj; nmin = min; npat = pat; }
      ver = nmaj + '.' + nmin + '.' + npat + (pre ? '-' + pre + '.1' : '');
    }
    if (breaking && maj === 0 && o.zero) issues.push(t('0.x 규칙: 호환성 파괴가 있지만 minor 로 올립니다. 1.0.0 으로 안정 선언을 하려면 옵션을 끄세요', '0.x rule: breaking changes bump minor. Turn the option off to jump to 1.0.0'));
    if (curPre && !pre) issues.push(t('현재 버전이 프리릴리스(' + curPre + ')이므로 정식 릴리스는 같은 번호(' + maj + '.' + min + '.' + pat + ')로 확정됩니다', 'The current version is a prerelease (' + curPre + '), so the stable release finalises the same number (' + maj + '.' + min + '.' + pat + ')'));
    if (skipped.length) issues.push(t('형식이 맞지 않아 제외된 커밋 ' + skipped.length + '개: ' + skipped.slice(0, 3).map(function (s) { return '"' + s.slice(0, 30) + '"'; }).join(', ') + (skipped.length > 3 ? ' …' : ''), skipped.length + ' commit(s) skipped for not following the format: ' + skipped.slice(0, 3).map(function (s) { return '"' + s.slice(0, 30) + '"'; }).join(', ') + (skipped.length > 3 ? ' …' : '')));
    var date = String(o.date || '').trim(); if (!date) { var d = new Date(); date = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(t('날짜는 YYYY-MM-DD 형식이어야 합니다', 'The date must be YYYY-MM-DD'));
    var tag = 'v' + ver, prev = 'v' + maj + '.' + min + '.' + pat + (curPre ? '-' + curPre : '');
    function link(it) { var s = ''; if (it.ref && repo) s += ' ([#' + it.ref + '](' + repo + '/issues/' + it.ref + '))'; else if (it.ref) s += ' (#' + it.ref + ')'; if (it.hash && repo) s += ' ([' + it.hash.slice(0, 7) + '](' + repo + '/commit/' + it.hash + '))'; return s; }
    function entry(it) { return '- ' + (it.scope ? '**' + it.scope + ':** ' : '') + it.desc + link(it); }
    var md = '## ' + (repo ? '[' + ver + '](' + repo + '/compare/' + prev + '...' + tag + ')' : ver) + ' (' + date + ')\n', brk = items.filter(function (i) { return i.brk; });
    if (o.style === 'keep') {
      var order = ['Added', 'Changed', 'Fixed', 'Removed'];
      order.forEach(function (sec) {
        var xs = items.filter(function (i) { return TYPES[i.type][2] === sec && !HIDE[i.type]; }); if (!xs.length) return;
        md += '\n### ' + sec + '\n' + xs.map(entry).join('\n') + '\n';
      });
      if (brk.length) md += '\n### ' + t('⚠ Breaking changes', '⚠ Breaking changes') + '\n' + brk.map(entry).join('\n') + '\n';
    } else {
      if (brk.length) md += '\n### 💥 ' + t('호환성 파괴 (BREAKING CHANGES)', 'BREAKING CHANGES') + '\n' + brk.map(entry).join('\n') + '\n';
      Object.keys(TYPES).forEach(function (ty) {
        if (HIDE[ty]) return; var xs = items.filter(function (i) { return i.type === ty; }); if (!xs.length) return;
        md += '\n### ' + t(TYPES[ty][0], TYPES[ty][1]) + '\n' + xs.map(entry).join('\n') + '\n';
      });
    }
    var hidden = items.filter(function (i) { return HIDE[i.type]; }).length;
    if (hidden) issues.push(t('docs/chore/build/ci/test/style 커밋 ' + hidden + '개는 체인지로그 본문에서 제외했습니다', hidden + ' docs / chore / build / ci / test / style commit(s) are left out of the changelog body'));
    var cmd = ['git switch main && git pull --ff-only', 'npm version ' + ver + ' --no-git-tag-version   # ' + t('package.json 갱신 (npm 프로젝트)', 'update package.json (npm projects)'), 'git add CHANGELOG.md package.json', 'git commit -m "chore(release): ' + tag + '"', 'git tag -a ' + tag + ' -m "' + tag + '"', 'git push origin main ' + tag];
    issues.push(t('체인지로그는 자동 생성 초안입니다 — 사용자에게 의미 있는 문장으로 다듬은 뒤 릴리스하세요', 'This changelog is an automatic draft — polish it into user-facing wording before releasing'));
    var nxt = bump === 'major' ? 'major' : bump === 'minor' ? 'minor' : 'patch';
    return { _status: t('✅ ' + o.cur + ' → ' + ver + ' (' + nxt + ')', '✅ ' + o.cur + ' → ' + ver + ' (' + nxt + ')'), out: md.trim(), table: { head: [['커밋', 'Commit'], ['분류', 'Type'], ['버전 영향', 'Version impact'], ['해시', 'Hash']], rows: rows }, cmd: cmd.join('\n'), issues: issues };
  }
});
