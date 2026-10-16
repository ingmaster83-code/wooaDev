TK.tool('git-history-planner', {
  allowEmpty: true,
  inputs: [],
  options: [
    { id: 'op', type: 'select', label: ['실행할 작업', 'Operation'], choices: [['merge', ['merge — 브랜치 합치기 (가능하면 빨리감기)', 'merge — combine (fast-forward when possible)']], ['noff', ['merge --no-ff — 항상 병합 커밋', 'merge --no-ff — always a merge commit']], ['squash', ['merge --squash — 하나의 커밋으로 합치기', 'merge --squash — collapse into one commit']], ['rebase', ['rebase — feature 를 main 위로 재배치', 'rebase — replay feature on top of main']], ['rebaseff', ['rebase 후 main 에 빨리감기 병합', 'rebase, then fast-forward main']], ['pick', ['cherry-pick — feature 의 마지막 커밋만 가져오기', 'cherry-pick — copy the last feature commit']]], default: 'merge' },
    { id: 'base', type: 'number', label: ['공통 커밋 수 (분기점까지)', 'Shared commits (up to the fork point)'], default: 3, min: 1, max: 6 },
    { id: 'featN', type: 'number', label: ['feature 에서 분기 후 커밋 수', 'Commits on feature after the fork'], default: 2, min: 0, max: 5 },
    { id: 'mainN', type: 'number', label: ['main 에서 분기 후 커밋 수', 'Commits on main after the fork'], default: 2, min: 0, max: 5 },
    { id: 'mainName', type: 'text', label: ['기준 브랜치 이름', 'Base branch name'], default: 'main' },
    { id: 'featName', type: 'text', label: ['작업 브랜치 이름', 'Work branch name'], default: 'feature' }
  ],
  outputs: [{ id: 'out', label: ['커밋 그래프 (작업 전 → 후)', 'Commit graph (before → after)'], kind: 'code', ext: 'txt' }, { id: 'cmd', label: ['실행할 명령어', 'Commands'], kind: 'code', ext: 'sh' }, { id: 'table', label: ['커밋별 변화', 'What happens to each commit'], kind: 'table' }, { id: 'issues', label: ['알아둘 점', 'Things to know'], kind: 'list' }],
  run: function (v, o, t) {
    var nb = Math.max(1, Math.round(o.base) || 1), nf = Math.max(0, Math.round(o.featN) || 0), nm = Math.max(0, Math.round(o.mainN) || 0), M = (o.mainName || 'main').trim() || 'main', F = (o.featName || 'feature').trim() || 'feature', L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', n = 0;
    function next() { return L[n++]; }
    var base = [], feat = [], main = [], i;
    for (i = 0; i < nb; i++) base.push(next());
    for (i = 0; i < nf; i++) feat.push(next());
    for (i = 0; i < nm; i++) main.push(next());
    var fork = base[base.length - 1], P = "'";
    function pad(k) { return new Array(Math.max(0, k) + 1).join(' '); }
    function draw(mainRow, featRow, forkIdx, mergeTo, tags) {
      var mainStr = mainRow.join('---'), featStart = 0, rows = [];
      var x = []; var c = 0; mainRow.forEach(function (lab) { x.push(c); c += lab.length + 3; });
      if (featRow.length) {
        featStart = x[forkIdx] + mainRow[forkIdx].length + 1;
        var featStr = featRow.join('---'), featEnd = featStart + featStr.length;
        rows.push(pad(featStart) + featStr);
        var slash = pad(x[forkIdx] + mainRow[forkIdx].length) + '/';
        if (mergeTo) {
          var mc = Math.max(mainStr.length + 3, featEnd + 1);
          slash += pad(featEnd - slash.length) + '\\';
          mainStr = mainStr + new Array(mc - mainStr.length + 1).join('-') + mergeTo;
        }
        rows.push(slash);
      } else if (mergeTo) mainStr += '---' + mergeTo;
      rows.push(mainStr);
      return rows.join('\n') + '\n' + tags.map(function (tg) { return '  ' + tg; }).join('\n');
    }
    var baseMainRow = base.concat(main), lastMain = baseMainRow[baseMainRow.length - 1], lastFeat = feat.length ? feat[feat.length - 1] : fork;
    var before = draw(baseMainRow, feat, base.length - 1, null, [M + ' → ' + lastMain + (o.op.indexOf('rebase') === 0 ? '' : '  (HEAD)'), F + ' → ' + lastFeat + (o.op.indexOf('rebase') === 0 ? '  (HEAD)' : '')]);
    var after, cmd = [], rows = [], issues = [], op = o.op, ff = nm === 0;
    function pr(c, st, why) { rows.push([c, st, why]); }
    if (!nf && op !== 'pick') issues.push(t('feature 에 새 커밋이 없어 합칠 것이 없습니다 ("Already up to date.")', 'feature has no new commits, so there is nothing to integrate ("Already up to date.")'));
    if (op === 'merge' || op === 'noff') {
      cmd = ['git switch ' + M, 'git merge ' + (op === 'noff' ? '--no-ff ' : '') + F];
      if (ff && op === 'merge' && nf) {
        after = draw(base.concat(feat), [], 0, null, [M + ' → ' + lastFeat + '  (HEAD)  ← ' + t('포인터만 이동 (빨리감기)', 'pointer just moves (fast-forward)'), F + ' → ' + lastFeat]);
        feat.forEach(function (c) { pr(c, t('그대로', 'unchanged'), t(M + ' 이 가리키게 됨', M + ' now points here')); });
        issues.push(t('main 에 새 커밋이 없어 병합 커밋 없이 빨리감기(fast-forward)됩니다. 병합 기록을 남기려면 --no-ff 를 쓰세요', 'main has no new commits, so this fast-forwards with no merge commit. Use --no-ff to record the merge'));
      } else {
        var mg = next();
        after = draw(baseMainRow, feat, base.length - 1, mg, [M + ' → ' + mg + '  (HEAD)', F + ' → ' + lastFeat]);
        base.concat(main, feat).forEach(function (c) { pr(c, t('그대로', 'unchanged'), ''); });
        pr(mg, t('🆕 새 병합 커밋', '🆕 new merge commit'), t('부모 2개: ' + lastMain + ' 과 ' + lastFeat, 'Two parents: ' + lastMain + ' and ' + lastFeat));
        issues.push(t('기존 커밋의 해시가 바뀌지 않아 이미 push 한 브랜치도 안전합니다', 'No existing commit hash changes, so it is safe for branches that are already pushed'));
        if (nm && nf) issues.push(t('두 브랜치가 같은 파일의 같은 부분을 바꿨다면 충돌이 납니다 → 해결 후 git commit (또는 git merge --abort)', 'If both branches touched the same lines you will get conflicts → resolve then git commit (or git merge --abort)'));
      }
    } else if (op === 'squash') {
      var sq = next();
      cmd = ['git switch ' + M, 'git merge --squash ' + F, 'git commit -m "' + F + ' squashed"'];
      after = draw(baseMainRow.concat([sq]), feat, base.length - 1, null, [M + ' → ' + sq + '  (HEAD)', F + ' → ' + lastFeat + '  ← ' + t('그대로 남음', 'left untouched')]);
      base.concat(main).forEach(function (c) { pr(c, t('그대로', 'unchanged'), ''); });
      feat.forEach(function (c) { pr(c, t('feature 에 남음', 'stays on feature'), t('main 에는 ' + sq + ' 안에 합쳐져 들어감', 'folded into ' + sq + ' on main')); });
      pr(sq, t('🆕 새 커밋 (squash)', '🆕 new squashed commit'), t('부모는 ' + lastMain + ' 하나뿐 — feature 와 연결 고리 없음', 'Single parent ' + lastMain + ' — no link back to feature'));
      issues.push(t('squash 로 합친 뒤 feature 브랜치를 계속 쓰면, 같은 변경이 다시 충돌합니다 — 합친 브랜치는 삭제하세요 (git branch -D ' + F + ')', 'If you keep using feature after squashing, the same changes conflict again — delete the branch (git branch -D ' + F + ')'));
      issues.push(t('GitHub 의 "Squash and merge" 버튼이 하는 일이 이것입니다', 'This is what the GitHub "Squash and merge" button does'));
    } else if (op === 'rebase' || op === 'rebaseff') {
      var rb = feat.map(function (c) { return c + P; });
      cmd = ['git switch ' + F, 'git rebase ' + M];
      if (!nm) { after = before; issues.push(t('main 에 새 커밋이 없어 rebase 할 것이 없습니다 ("Current branch ' + F + ' is up to date.")', 'main has no new commits, so there is nothing to rebase ("Current branch ' + F + ' is up to date.")')); }
      else {
        after = draw(baseMainRow.concat(rb), [], 0, null, [M + ' → ' + lastMain, F + ' → ' + (rb.length ? rb[rb.length - 1] : lastMain) + (op === 'rebase' ? '  (HEAD)' : '')]);
        base.concat(main).forEach(function (c) { pr(c, t('그대로', 'unchanged'), ''); });
        feat.forEach(function (c) { pr(c, t('♻️ 폐기되고 복사됨', '♻️ replaced by a copy'), t(c + P + ' 로 다시 만들어짐 (내용은 같고 부모·해시가 다름)', 'recreated as ' + c + P + ' (same changes, new parent and hash)')); });
        if (op === 'rebaseff') {
          cmd.push('git switch ' + M, 'git merge --ff-only ' + F);
          after = draw(baseMainRow.concat(rb), [], 0, null, [M + ' → ' + (rb.length ? rb[rb.length - 1] : lastMain) + '  (HEAD)', F + ' → ' + (rb.length ? rb[rb.length - 1] : lastMain)]);
          issues.push(t('rebase 후 빨리감기 병합은 병합 커밋 없이 일직선 기록을 만듭니다', 'Rebase then fast-forward gives a perfectly linear history with no merge commit'));
        }
        issues.push(t('⚠️ 재배치된 커밋(' + rb.join(', ') + ')은 해시가 새로 만들어집니다. ' + F + ' 를 이미 push 했다면 git push --force-with-lease 가 필요하고, 다른 사람이 이 브랜치를 쓰고 있으면 하지 마세요', '⚠️ The replayed commits (' + rb.join(', ') + ') get new hashes. If ' + F + ' was already pushed you need git push --force-with-lease — and do not do it if others use the branch'));
        issues.push(t('커밋마다 충돌을 해결해야 할 수 있습니다 (git rebase --continue / --abort)', 'You may have to resolve conflicts commit by commit (git rebase --continue / --abort)'));
        issues.push(t('잘못됐을 때: git reflog 로 이전 위치를 찾아 git reset --hard <해시>', 'If it goes wrong: find the old position in git reflog and git reset --hard <hash>'));
      }
    } else if (op === 'pick') {
      if (!nf) throw new Error(t('feature 에 가져올 커밋이 없습니다 — 분기 후 커밋 수를 1 이상으로 하세요', 'feature has no commit to pick — set the commits after the fork to at least 1'));
      var cp = lastFeat + P;
      cmd = ['git switch ' + M, 'git cherry-pick ' + lastFeat];
      after = draw(baseMainRow.concat([cp]), feat, base.length - 1, null, [M + ' → ' + cp + '  (HEAD)', F + ' → ' + lastFeat + '  ← ' + t('그대로', 'untouched')]);
      base.concat(main, feat).forEach(function (c) { pr(c, t('그대로', 'unchanged'), c === lastFeat ? t(cp + ' 로 복사됨', 'copied as ' + cp) : ''); });
      pr(cp, t('🆕 복사된 커밋', '🆕 copied commit'), t(lastFeat + ' 와 같은 변경, 다른 해시', 'Same change as ' + lastFeat + ', different hash'));
      if (nf > 1) issues.push(t(lastFeat + ' 가 앞선 feature 커밋(' + feat.slice(0, -1).join(', ') + ')에 의존하면 충돌하거나 동작하지 않을 수 있습니다', lastFeat + ' may conflict or break if it depends on the earlier feature commits (' + feat.slice(0, -1).join(', ') + ')'));
      issues.push(t('나중에 feature 를 병합하면 같은 변경이 두 번 있는 것으로 보여 충돌할 수 있습니다', 'Merging feature later may conflict because the change now exists twice'));
    }
    return { _status: t('✅ ' + ({ merge: 'merge', noff: 'merge --no-ff', squash: 'merge --squash', rebase: 'rebase', rebaseff: 'rebase + fast-forward', pick: 'cherry-pick' }[op]) + ' 결과를 그렸습니다', '✅ Drew the result of ' + ({ merge: 'merge', noff: 'merge --no-ff', squash: 'merge --squash', rebase: 'rebase', rebaseff: 'rebase + fast-forward', pick: 'cherry-pick' }[op])), out: t('■ 작업 전', '■ Before') + '\n' + before + '\n\n' + t('■ 작업 후', '■ After') + '\n' + after, cmd: cmd.join('\n'), table: { head: [['커밋', 'Commit'], ['변화', 'Change'], ['설명', 'Details']], rows: rows }, issues: issues };
  }
});
