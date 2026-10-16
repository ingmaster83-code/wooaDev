(function () {
  var TASKS = [
    ['commit', ['commit — 변경 저장', 'commit — record changes']], ['branch', ['branch — 브랜치 만들기·전환·삭제', 'branch — create / switch / delete']], ['merge', ['merge — 브랜치 합치기', 'merge — combine branches']], ['rebase', ['rebase — 커밋 재배치', 'rebase — replay commits']],
    ['reset', ['reset — 되돌리기', 'reset — move HEAD back']], ['revert', ['revert — 반대 커밋 만들기', 'revert — create an inverse commit']], ['cherry-pick', ['cherry-pick — 커밋 하나 가져오기', 'cherry-pick — copy one commit']], ['stash', ['stash — 작업 임시 보관', 'stash — shelve work']],
    ['log', ['log — 기록 보기', 'log — view history']], ['diff', ['diff — 차이 보기', 'diff — view differences']], ['push', ['push — 원격에 올리기', 'push — upload']], ['pull', ['pull — 가져와 합치기', 'pull — fetch and integrate']], ['fetch', ['fetch — 가져오기만', 'fetch — download only']],
    ['clone', ['clone — 저장소 복제', 'clone — copy a repository']], ['tag', ['tag — 태그', 'tag — tags']], ['restore', ['restore — 파일 복원', 'restore — restore files']], ['clean', ['clean — 추적 안 되는 파일 삭제', 'clean — delete untracked files']], ['remote', ['remote — 원격 저장소 관리', 'remote — manage remotes']]
  ];
  function on(list) { return function (o) { return list.indexOf(o.task) >= 0; }; }
  function cb(id, tasks, ko, en, def) { return { id: id, type: 'checkbox', label: [ko, en], default: !!def, show: on(tasks) }; }
  function txt(id, tasks, ko, en, def, ph) { var f = { id: id, type: 'text', label: [ko, en], default: def || '', show: on(tasks) }; if (ph) f.placeholder = ph; return f; }
  function sel(id, tasks, ko, en, choices, def) { return { id: id, type: 'select', label: [ko, en], choices: choices, default: def, show: on(tasks) }; }
  var options = [
    { id: 'task', type: 'select', label: ['작업', 'Task'], choices: TASKS.map(function (x) { return [x[0], x[1]]; }), default: 'commit' },
    sel('bact', ['branch'], '동작', 'Action', [['switchc', ['새로 만들고 이동 (switch -c)', 'Create & switch (switch -c)']], ['create', ['만들기만 (branch)', 'Create only (branch)']], ['switch', ['이동 (switch)', 'Switch (switch)']], ['delete', ['삭제 (-d, 병합된 것만)', 'Delete (-d, merged only)']], ['force', ['강제 삭제 (-D)', 'Force delete (-D)']], ['rename', ['이름 변경 (-m)', 'Rename (-m)']], ['list', ['목록 (-a)', 'List (-a)']]], 'switchc'),
    sel('rmode', ['reset'], '모드', 'Mode', [['mixed', ['--mixed (기본: 스테이징만 취소)', '--mixed (default: unstage)']], ['soft', ['--soft (커밋만 취소, 변경은 스테이징 유지)', '--soft (undo commit, keep staged)']], ['hard', ['--hard (변경까지 모두 삭제 ⚠️)', '--hard (discard everything ⚠️)']], ['keep', ['--keep (안전한 hard)', '--keep (safer hard)']]], 'mixed'),
    sel('sact', ['stash'], '동작', 'Action', [['push', 'push'], ['pop', 'pop'], ['apply', 'apply'], ['list', 'list'], ['show', 'show -p'], ['drop', 'drop'], ['clear', 'clear ⚠️']], 'push'),
    sel('tact', ['tag'], '동작', 'Action', [['light', ['가벼운 태그', 'Lightweight tag']], ['ann', ['주석 태그 (-a, 권장)', 'Annotated tag (-a, recommended)']], ['delete', ['삭제 (-d)', 'Delete (-d)']], ['list', ['목록', 'List']]], 'ann'),
    sel('ract', ['rebase'], '동작', 'Action', [['start', ['시작', 'Start']], ['continue', '--continue'], ['abort', '--abort'], ['skip', '--skip']], 'start'),
    sel('remact', ['remote'], '동작', 'Action', [['list', '-v'], ['add', 'add'], ['remove', 'remove'], ['seturl', 'set-url']], 'list'),
    txt('target', ['branch', 'merge', 'rebase', 'reset', 'revert', 'cherry-pick', 'stash', 'diff', 'push', 'pull', 'fetch', 'clone', 'tag', 'restore', 'remote', 'log'], '대상 (브랜치·커밋·URL·경로)', 'Target (branch / commit / URL / path)', '', ['예: feature/login, a1b2c3d, https://…', 'e.g. feature/login, a1b2c3d, https://…']),
    txt('target2', ['branch', 'rebase', 'push', 'pull', 'fetch', 'clone', 'tag', 'remote', 'stash'], '두 번째 인자 (원격 이름·시작점·새 이름·폴더)', 'Second argument (remote / start point / new name / folder)', 'origin'),
    txt('message', ['commit', 'stash', 'tag', 'merge'], '메시지', 'Message', 'feat(auth): add login page'),
    { id: 'num', type: 'number', label: ['개수 / 깊이 (log -n, clone --depth)', 'Count / depth (log -n, clone --depth)'], default: 0, min: 0, show: on(['log', 'clone']) },
    txt('author', ['log'], '작성자 (--author)', 'Author (--author)', ''),
    txt('since', ['log'], '기간 (--since)', 'Since (--since)', '', ['예: 2 weeks ago', 'e.g. 2 weeks ago']),
    txt('grep', ['log'], '메시지 검색 (--grep)', 'Message search (--grep)', ''),
    txt('path', ['log', 'diff', 'restore'], '경로 (-- <path>)', 'Path (-- <path>)', ''),
    cb('commitAll', ['commit'], '추적 중인 파일 전부 함께 커밋 (-a)', 'Include all tracked changes (-a)'), cb('amend', ['commit'], '직전 커밋 수정 (--amend)', 'Amend the previous commit (--amend)'), cb('noedit', ['commit', 'revert'], '메시지 편집 안 함 (--no-edit)', 'Keep the message (--no-edit)'), cb('signoff', ['commit'], 'Signed-off-by 추가 (-s)', 'Add Signed-off-by (-s)'), cb('allowEmpty', ['commit'], '빈 커밋 허용 (--allow-empty)', 'Allow an empty commit (--allow-empty)'), cb('noVerify', ['commit', 'push'], '훅 건너뛰기 (--no-verify) ⚠️', 'Skip hooks (--no-verify) ⚠️'),
    cb('noff', ['merge'], '항상 병합 커밋 (--no-ff)', 'Always create a merge commit (--no-ff)'), cb('squash', ['merge'], '하나로 합쳐 스테이징 (--squash)', 'Squash into the index (--squash)'), cb('ffonly', ['merge', 'pull'], '빨리감기만 허용 (--ff-only)', 'Fast-forward only (--ff-only)'), cb('mabort', ['merge'], '병합 중단 (--abort)', 'Abort the merge (--abort)'),
    cb('interactive', ['rebase'], '대화형 (-i)', 'Interactive (-i)'), cb('autosquash', ['rebase'], 'fixup 자동 정리 (--autosquash)', 'Auto-arrange fixups (--autosquash)'), cb('autostash', ['rebase', 'pull'], '변경 자동 보관 (--autostash)', 'Auto-stash changes (--autostash)'), cb('rmerges', ['rebase'], '병합 유지 (--rebase-merges)', 'Keep merges (--rebase-merges)'),
    cb('mainline', ['revert'], '병합 커밋 되돌리기 (-m 1)', 'Revert a merge commit (-m 1)'), cb('nocommit', ['revert', 'cherry-pick'], '커밋하지 않고 적용 (-n)', 'Apply without committing (-n)'), cb('xref', ['cherry-pick'], '원본 커밋 기록 (-x)', 'Record the original commit (-x)'),
    cb('untracked', ['stash'], '추적 안 되는 파일 포함 (-u)', 'Include untracked files (-u)'), cb('keepIndex', ['stash'], '스테이징 유지 (--keep-index)', 'Keep the index (--keep-index)'),
    cb('oneline', ['log'], '한 줄씩 (--oneline)', 'One line per commit (--oneline)', true), cb('graph', ['log'], '그래프 (--graph)', 'Graph (--graph)', true), cb('all', ['log'], '모든 브랜치 (--all)', 'All branches (--all)'), cb('stat', ['log', 'diff'], '파일별 통계 (--stat)', 'Per-file stats (--stat)'), cb('patch', ['log'], '변경 내용 (-p)', 'Show patches (-p)'), cb('follow', ['log'], '이름 변경 추적 (--follow)', 'Follow renames (--follow)'),
    cb('staged', ['diff', 'restore'], '스테이징 영역 (--staged)', 'Staged changes (--staged)'), cb('nameOnly', ['diff'], '파일 이름만 (--name-only)', 'File names only (--name-only)'),
    cb('upstream', ['push'], '추적 브랜치 설정 (-u)', 'Set upstream (-u)', true), cb('lease', ['push'], '안전한 강제 푸시 (--force-with-lease)', 'Safer force push (--force-with-lease)'), cb('force', ['push'], '강제 푸시 (--force) ⚠️', 'Force push (--force) ⚠️'), cb('tags', ['push', 'fetch'], '태그 포함 (--tags)', 'Include tags (--tags)'), cb('pdelete', ['push'], '원격 브랜치 삭제 (--delete)', 'Delete the remote branch (--delete)'), cb('dry', ['push', 'clean'], '실행 없이 확인 (-n)', 'Dry run (-n)'),
    cb('prebase', ['pull'], '합치지 않고 재배치 (--rebase)', 'Rebase instead of merge (--rebase)'), cb('prune', ['fetch'], '삭제된 원격 브랜치 정리 (--prune)', 'Prune deleted remote branches (--prune)'), cb('fall', ['fetch'], '모든 원격 (--all)', 'All remotes (--all)'),
    cb('single', ['clone'], '브랜치 하나만 (--single-branch)', 'Single branch (--single-branch)'), cb('recurse', ['clone'], '서브모듈 포함 (--recurse-submodules)', 'Include submodules (--recurse-submodules)'), cb('blobless', ['clone'], '파일 내용 나중에 받기 (--filter=blob:none)', 'Lazy file contents (--filter=blob:none)'),
    cb('cdirs', ['clean'], '폴더 포함 (-d)', 'Include directories (-d)'), cb('cforce', ['clean'], '실제 삭제 (-f) ⚠️', 'Actually delete (-f) ⚠️'), cb('cignored', ['clean'], '.gitignore 대상도 삭제 (-x) ⚠️', 'Also delete ignored files (-x) ⚠️')
  ];
  function q(s) { return /^[A-Za-z0-9_@%+=:,.\/~^{}#-]+$/.test(s) ? s : "'" + String(s).replace(/'/g, "'\\''") + "'"; }
  function dq(s) { return '"' + String(s).replace(/(["\\$`])/g, '\\$1') + '"'; }

  TK.tool('git-command-builder', {
    allowEmpty: true,
    inputs: [],
    options: options,
    sampleOptions: { task: 'push', target: 'feature/login', target2: 'origin' },
    outputs: [{ id: 'out', label: ['Git 명령어', 'Git command'], kind: 'code', ext: 'sh' }, { id: 'table', label: ['각 부분의 뜻', 'What each part does'], kind: 'table' }, { id: 'issues', label: ['주의·되돌리는 방법', 'Warnings & how to undo'], kind: 'list' }],
    run: function (v, o, t) {
      var parts = [['git', t('Git 실행', 'Run Git')]], warn = [], undo = [], tgt = (o.target || '').trim(), tgt2 = (o.target2 || '').trim(), msg = (o.message || '').trim();
      function add(tok, ko, en) { parts.push([tok, t(ko, en)]); }
      function need(val, ko, en) { if (!val) throw new Error(t(ko, en)); }
      var k = o.task;
      if (k === 'commit') {
        add('commit', '변경을 커밋으로 저장', 'Record the staged changes');
        if (o.commitAll) add('-a', '추적 중인 파일의 수정·삭제를 자동으로 스테이징', 'Auto-stage modified and deleted tracked files');
        if (o.amend) { add('--amend', '새 커밋 대신 직전 커밋을 고침', 'Rewrite the previous commit instead of adding one'); warn.push(t('--amend 는 커밋 해시를 바꿉니다. 이미 push 했다면 force push 가 필요하므로 공유 브랜치에서는 피하세요', '--amend changes the commit hash. If it was already pushed you need a force push, so avoid it on shared branches')); undo.push(t('되돌리기: git reset --soft HEAD@{1}', 'Undo: git reset --soft HEAD@{1}')); }
        if (o.noedit) add('--no-edit', '이전 메시지를 그대로 사용', 'Keep the previous message');
        if (o.signoff) add('-s', 'Signed-off-by 줄 추가', 'Add a Signed-off-by trailer');
        if (o.allowEmpty) add('--allow-empty', '변경이 없어도 커밋 (CI 트리거 등)', 'Commit even without changes (e.g. trigger CI)');
        if (o.noVerify) { add('--no-verify', 'pre-commit/commit-msg 훅 건너뜀', 'Skip pre-commit and commit-msg hooks'); warn.push(t('--no-verify 는 린트·테스트 훅을 우회합니다', '--no-verify bypasses lint and test hooks')); }
        if (msg && !(o.amend && o.noedit)) add('-m ' + dq(msg), '커밋 메시지', 'The commit message'); else if (!msg && !o.noedit) warn.push(t('-m 이 없으면 편집기가 열립니다', 'Without -m an editor opens'));
        if (!o.amend) undo.push(t('방금 커밋 취소(변경 유지): git reset --soft HEAD~1', 'Undo this commit (keep changes): git reset --soft HEAD~1'));
      } else if (k === 'branch') {
        var a = o.bact;
        if (a === 'list') { add('branch', '브랜치 명령', 'Branch command'); add('-a', '로컬 + 원격 브랜치 모두 표시', 'List local and remote branches'); }
        else {
          need(tgt, '브랜치 이름을 입력하세요', 'Enter a branch name');
          if (a === 'switchc') { add('switch', '브랜치를 전환', 'Switch branches'); add('-c', '없으면 새로 만든다', 'Create it first'); add(q(tgt), '브랜치 이름', 'Branch name'); if (tgt2) add(q(tgt2), '시작 지점 (이 브랜치/커밋에서 분기)', 'Start point (branch off from here)'); }
          else if (a === 'create') { add('branch', '브랜치 명령', 'Branch command'); add(q(tgt), '새 브랜치 이름 (이동은 하지 않음)', 'New branch name (does not switch)'); if (tgt2) add(q(tgt2), '시작 지점', 'Start point'); }
          else if (a === 'switch') { add('switch', '브랜치를 전환', 'Switch branches'); add(q(tgt), '이동할 브랜치', 'Branch to switch to'); warn.push(t('커밋하지 않은 변경이 충돌하면 전환이 거부됩니다 — stash 또는 커밋하세요', 'Switching is refused if uncommitted changes conflict — stash or commit first')); }
          else if (a === 'delete') { add('branch', '브랜치 명령', 'Branch command'); add('-d', '병합이 끝난 브랜치만 삭제 (안전)', 'Delete only if fully merged (safe)'); add(q(tgt), '삭제할 브랜치', 'Branch to delete'); undo.push(t('실수로 삭제했다면: git reflog 로 마지막 커밋 해시를 찾아 git branch ' + tgt + ' <해시>', 'If deleted by mistake: find its last commit in git reflog, then git branch ' + tgt + ' <hash>')); }
          else if (a === 'force') { add('branch', '브랜치 명령', 'Branch command'); add('-D', '병합 여부와 상관없이 강제 삭제', 'Force delete regardless of merge state'); add(q(tgt), '삭제할 브랜치', 'Branch to delete'); warn.push(t('⚠️ -D 는 병합되지 않은 커밋을 잃을 수 있습니다', '⚠️ -D may lose unmerged commits')); undo.push(t('복구: git reflog 로 해시를 찾아 git branch ' + tgt + ' <해시>', 'Recover: find the hash in git reflog, then git branch ' + tgt + ' <hash>')); }
          else if (a === 'rename') { need(tgt2, '새 이름을 두 번째 인자에 입력하세요', 'Enter the new name in the second argument'); add('branch', '브랜치 명령', 'Branch command'); add('-m', '이름 변경', 'Rename'); add(q(tgt), '현재 이름', 'Current name'); add(q(tgt2), '새 이름', 'New name'); warn.push(t('원격에 올린 브랜치라면 원격 이름은 따로 바꿔야 합니다 (새 이름 push 후 옛 이름 삭제)', 'For a pushed branch, rename the remote too (push the new name, then delete the old one)')); }
        }
      } else if (k === 'merge') {
        add('merge', '다른 브랜치를 현재 브랜치에 합침', 'Merge another branch into the current one');
        if (o.mabort) add('--abort', '진행 중인 병합(충돌)을 취소', 'Abort the in-progress merge');
        else {
          need(tgt, '합칠 브랜치를 입력하세요', 'Enter the branch to merge');
          if (o.noff) add('--no-ff', '빨리감기 가능해도 병합 커밋을 만듦 (기록 보존)', 'Always create a merge commit, even if fast-forward is possible');
          if (o.squash) add('--squash', '변경을 하나로 합쳐 스테이징만 함 (커밋은 직접)', 'Squash the changes into the index (you commit yourself)');
          if (o.ffonly) add('--ff-only', '빨리감기가 안 되면 실패', 'Fail unless it can fast-forward');
          if (o.noff && o.squash) warn.push(t('--no-ff 와 --squash 는 함께 쓸 수 없습니다', '--no-ff and --squash cannot be combined'));
          if (msg) add('-m ' + dq(msg), '병합 커밋 메시지', 'Merge commit message');
          add(q(tgt), '합칠 브랜치', 'Branch to merge');
          undo.push(t('병합 직후 취소: git reset --hard ORIG_HEAD (커밋 안 한 변경이 없을 때)', 'Undo right after merging: git reset --hard ORIG_HEAD (when you have no uncommitted work)'));
        }
      } else if (k === 'rebase') {
        add('rebase', '커밋을 다른 기준점 위로 다시 쌓음', 'Replay commits on top of another base');
        if (o.ract !== 'start') add('--' + o.ract, { continue: '충돌 해결 후 계속', abort: '중단하고 원래 상태로', skip: '이 커밋을 건너뜀' }[o.ract], { continue: 'Continue after resolving conflicts', abort: 'Abort and restore the original state', skip: 'Skip this commit' }[o.ract]);
        else {
          need(tgt, '기준 브랜치를 입력하세요 (예: main)', 'Enter the base branch (e.g. main)');
          if (o.interactive) add('-i', '커밋을 편집·합치기·삭제할 수 있는 대화형 모드', 'Interactive mode to edit, squash or drop commits');
          if (o.autosquash) add('--autosquash', 'fixup!/squash! 커밋을 자동 배치', 'Auto-arrange fixup!/squash! commits');
          if (o.autostash) add('--autostash', '시작 전 변경을 보관하고 끝나면 복원', 'Stash before and restore after');
          if (o.rmerges) add('--rebase-merges', '병합 커밋 구조를 유지', 'Keep the merge-commit topology');
          add(q(tgt), '새 기준점', 'New base');
          warn.push(t('⚠️ rebase 는 커밋 해시를 모두 바꿉니다. 이미 push 한 브랜치는 force push(--force-with-lease)가 필요하며 공유 브랜치에서는 쓰지 마세요', '⚠️ rebase rewrites every commit hash. A pushed branch then needs a force push (--force-with-lease) — do not do this on shared branches'));
          undo.push(t('실패·후회 시: git rebase --abort (진행 중) 또는 git reset --hard ORIG_HEAD (완료 후)', 'If it goes wrong: git rebase --abort (in progress) or git reset --hard ORIG_HEAD (after finishing)'));
        }
      } else if (k === 'reset') {
        var tr = tgt || 'HEAD~1';
        add('reset', 'HEAD(와 선택에 따라 스테이징·작업 폴더)를 이동', 'Move HEAD (and optionally the index and working tree)');
        var RM = { mixed: ['--mixed', '커밋 취소 + 스테이징 취소, 파일 변경은 남김', 'Undo commits and staging; keep file changes'], soft: ['--soft', '커밋만 취소, 변경은 스테이징 상태로 남김', 'Undo commits only; keep changes staged'], hard: ['--hard', '커밋·스테이징·파일 변경을 모두 폐기', 'Discard commits, staging and file changes'], keep: ['--keep', '작업 폴더의 로컬 변경은 보존하면서 이동 (충돌 시 중단)', 'Move while preserving local changes (aborts on conflict)'] }[o.rmode];
        add(RM[0], RM[1], RM[2]); add(q(tr), tgt ? '이동할 커밋' : '기본값: 한 커밋 전', tgt ? 'Commit to move to' : 'Default: one commit back');
        if (o.rmode === 'hard') warn.push(t('🚨 --hard 는 커밋하지 않은 변경을 되돌릴 수 없게 삭제합니다 (커밋된 것은 reflog 로 복구 가능)', '🚨 --hard permanently deletes uncommitted changes (committed work can be recovered via reflog)'));
        undo.push(t('직전 reset 취소: git reset --hard ORIG_HEAD 또는 git reflog 로 이전 위치 확인', 'Undo the last reset: git reset --hard ORIG_HEAD, or find the old position in git reflog'));
        warn.push(t('이미 push 한 커밋을 reset 하면 원격과 갈라집니다 — 공유 브랜치에서는 revert 를 쓰세요', 'Resetting pushed commits diverges from the remote — use revert on shared branches'));
      } else if (k === 'revert') {
        need(tgt, '되돌릴 커밋을 입력하세요', 'Enter the commit to revert');
        add('revert', '지정한 커밋의 반대 변경을 새 커밋으로 만듦 (기록 보존)', 'Create a new commit that undoes the given commit (history preserved)');
        if (o.mainline) add('-m 1', '병합 커밋을 되돌릴 때 1번 부모를 기준으로 삼음', 'For merge commits, treat parent 1 as the mainline');
        if (o.noedit) add('--no-edit', '기본 메시지 사용', 'Use the default message');
        if (o.nocommit) add('-n', '커밋하지 않고 변경만 적용', 'Apply the change without committing');
        add(q(tgt), '되돌릴 커밋', 'Commit to revert');
        undo.push(t('revert 커밋 자체를 되돌리려면 같은 명령으로 그 커밋을 revert 하세요', 'To undo the revert, revert the revert commit'));
      } else if (k === 'cherry-pick') {
        need(tgt, '가져올 커밋을 입력하세요', 'Enter the commit to pick');
        add('cherry-pick', '다른 브랜치의 커밋을 현재 브랜치로 복사', 'Copy a commit from another branch to the current one');
        if (o.xref) add('-x', '메시지에 원본 커밋 해시를 기록', 'Record the original commit hash in the message');
        if (o.nocommit) add('-n', '커밋하지 않고 변경만 적용', 'Apply without committing');
        add(q(tgt), '복사할 커밋', 'Commit to copy');
        warn.push(t('같은 변경이 두 개의 다른 해시로 존재하게 됩니다 — 나중에 병합하면 충돌할 수 있습니다', 'The same change now exists under two hashes — merging later can conflict'));
      } else if (k === 'stash') {
        add('stash', '작업 중인 변경을 임시 보관', 'Shelve work in progress');
        var sa = o.sact, ref = tgt && /^stash@/.test(tgt) ? tgt : '';
        if (sa === 'push') { add('push', '새 stash 만들기', 'Create a stash'); if (o.untracked) add('-u', '추적되지 않는 새 파일도 포함', 'Include untracked files'); if (o.keepIndex) add('--keep-index', '스테이징 상태는 유지', 'Leave staged changes in place'); if (msg) add('-m ' + dq(msg), 'stash 이름', 'Stash name'); undo.push(t('되돌리기: git stash pop', 'Restore: git stash pop')); }
        else if (sa === 'list') add('list', '보관된 stash 목록', 'List stashes');
        else if (sa === 'clear') { add('clear', '모든 stash 삭제', 'Delete every stash'); warn.push(t('🚨 clear 는 모든 stash 를 삭제합니다', '🚨 clear deletes every stash')); }
        else { add(sa === 'show' ? 'show -p' : sa, { pop: '가장 최근 stash 를 적용하고 삭제', apply: '적용만 하고 stash 는 유지', drop: 'stash 하나 삭제', show: 'stash 내용을 diff 로 보기' }[sa], { pop: 'Apply the latest stash and remove it', apply: 'Apply but keep the stash', drop: 'Delete one stash', show: 'Show the stash as a diff' }[sa]); if (ref) add(q(ref), '대상 stash', 'Target stash'); if (sa === 'drop') warn.push(t('drop 한 stash 는 reflog 에 없어 복구가 어렵습니다 (git fsck --unreachable 로 찾을 수는 있음)', 'A dropped stash is not in the reflog and is hard to recover (git fsck --unreachable can find it)')); }
      } else if (k === 'log') {
        add('log', '커밋 기록 보기', 'Show commit history');
        if (o.oneline) add('--oneline', '커밋당 한 줄', 'One line per commit'); if (o.graph) add('--graph', 'ASCII 그래프로 분기 표시', 'Draw the branch graph'); if (o.all) add('--all', '모든 브랜치·태그', 'All branches and tags'); if (o.stat) add('--stat', '파일별 변경량', 'Per-file change counts'); if (o.patch) add('-p', '각 커밋의 diff', 'Show each commit\'s diff'); if (o.follow) add('--follow', '파일 이름이 바뀌어도 추적 (단일 파일 필요)', 'Follow renames (needs a single file)');
        if (o.num > 0) add('-' + Math.round(o.num), '최근 ' + Math.round(o.num) + '개만', 'Only the latest ' + Math.round(o.num));
        if (o.author) add('--author=' + q(o.author), '작성자 필터', 'Filter by author'); if (o.since) add('--since=' + q(o.since), '기간 필터', 'Filter by date'); if (o.grep) add('--grep=' + q(o.grep), '커밋 메시지 검색', 'Search commit messages');
        if (tgt) add(q(tgt), '브랜치/범위 (예: main..feature)', 'Branch / range (e.g. main..feature)');
        if (o.path) { add('--', '여기부터는 경로', 'Paths follow'); add(q(o.path), '이 경로의 기록만', 'History of this path only'); }
        if (o.follow && !o.path) warn.push(t('--follow 는 파일 경로가 필요합니다', '--follow needs a file path'));
      } else if (k === 'diff') {
        add('diff', '변경 내용 비교', 'Compare changes');
        if (o.staged) add('--staged', '스테이징된 변경 (커밋될 내용)', 'Staged changes (what will be committed)'); if (o.stat) add('--stat', '요약 통계만', 'Summary statistics'); if (o.nameOnly) add('--name-only', '바뀐 파일 이름만', 'Only the changed file names');
        if (tgt) add(q(tgt), '비교 대상 (예: main...feature)', 'Comparison target (e.g. main...feature)');
        if (o.path) { add('--', '여기부터는 경로', 'Paths follow'); add(q(o.path), '이 경로만', 'This path only'); }
      } else if (k === 'push') {
        add('push', '로컬 커밋을 원격에 올림', 'Upload local commits');
        if (o.pdelete) add('--delete', '원격 브랜치 삭제', 'Delete the remote branch'); if (o.upstream && !o.pdelete) add('-u', '이후 git push/pull 에 이 원격 브랜치를 기본값으로 연결', 'Track this branch for future push/pull'); if (o.lease) add('--force-with-lease', '다른 사람이 올린 커밋이 없을 때만 강제 푸시 (안전)', 'Force push only if nobody else pushed (safer)'); if (o.force) { add('--force', '무조건 덮어쓰기', 'Overwrite unconditionally'); warn.push(t('🚨 --force 는 다른 사람의 커밋을 지울 수 있습니다 — --force-with-lease 를 쓰세요', '🚨 --force can erase others\' commits — prefer --force-with-lease')); } if (o.tags) add('--tags', '모든 태그도 함께', 'Push all tags too'); if (o.dry) add('-n', '실제 전송 없이 시뮬레이션', 'Simulate without sending'); if (o.noVerify) { add('--no-verify', 'pre-push 훅 건너뜀', 'Skip the pre-push hook'); warn.push(t('--no-verify 는 pre-push 검증을 우회합니다', '--no-verify bypasses pre-push checks')); }
        add(q(tgt2 || 'origin'), '원격 이름', 'Remote name'); if (tgt) add(q(tgt), o.pdelete ? '삭제할 브랜치' : '올릴 브랜치', o.pdelete ? 'Branch to delete' : 'Branch to push');
        if (/^(main|master)$/.test(tgt) && (o.force || o.lease)) warn.push(t('🚨 main/master 에 강제 푸시합니다 — 보호 브랜치라면 거부됩니다', '🚨 Force-pushing main/master — protected branches reject this'));
        if (o.pdelete) warn.push(t('원격 브랜치를 삭제합니다', 'This deletes the remote branch'));
      } else if (k === 'pull') {
        add('pull', '원격 변경을 가져와(fetch) 현재 브랜치에 합침', 'Fetch and integrate remote changes');
        if (o.prebase) add('--rebase', '병합 커밋 대신 내 커밋을 위로 재배치', 'Replay my commits instead of merging'); if (o.ffonly) add('--ff-only', '빨리감기가 안 되면 실패 (안전)', 'Fail unless it can fast-forward (safe)'); if (o.autostash) add('--autostash', '변경을 보관했다가 복원', 'Stash and restore local changes');
        if (tgt2) add(q(tgt2), '원격 이름', 'Remote name'); if (tgt) add(q(tgt), '브랜치', 'Branch');
        if (o.prebase && o.ffonly) warn.push(t('--rebase 와 --ff-only 는 함께 쓰지 않습니다', 'Do not combine --rebase and --ff-only'));
      } else if (k === 'fetch') {
        add('fetch', '원격 변경을 내려받기만 함 (합치지 않음)', 'Download remote changes without merging');
        if (o.fall) add('--all', '등록된 모든 원격', 'Every configured remote'); if (o.prune) add('--prune', '원격에서 삭제된 브랜치의 추적 참조 정리', 'Remove tracking refs of deleted remote branches'); if (o.tags) add('--tags', '태그도 모두 받기', 'Fetch all tags');
        if (tgt2 && !o.fall) add(q(tgt2), '원격 이름', 'Remote name'); if (tgt && !o.fall) add(q(tgt), '브랜치', 'Branch');
      } else if (k === 'clone') {
        need(tgt, '저장소 URL 을 입력하세요', 'Enter the repository URL');
        add('clone', '저장소 복제', 'Copy a repository');
        if (o.num > 0) add('--depth ' + Math.round(o.num), '최근 ' + Math.round(o.num) + '개 커밋만 (얕은 복제, 빠름)', 'Only the latest ' + Math.round(o.num) + ' commit(s) (shallow, fast)'); if (o.single) add('--single-branch', '한 브랜치만', 'Only one branch'); if (o.recurse) add('--recurse-submodules', '서브모듈도 함께', 'Include submodules'); if (o.blobless) add('--filter=blob:none', '파일 내용은 필요할 때 받음 (대형 저장소에 유용)', 'Fetch file contents on demand (good for huge repos)');
        add(q(tgt), '복제할 저장소 URL', 'Repository URL'); if (tgt2 && tgt2 !== 'origin') add(q(tgt2), '대상 폴더', 'Target folder');
        if (o.num > 0) warn.push(t('얕은 복제는 기록이 잘려 있어 git log·blame·병합 기준 탐색이 제한됩니다 (git fetch --unshallow 로 해제)', 'A shallow clone has truncated history, limiting log / blame / merge-base (undo with git fetch --unshallow)'));
      } else if (k === 'tag') {
        var ta = o.tact;
        add('tag', '태그', 'Tags');
        if (ta === 'list') add('-l', '태그 목록', 'List tags');
        else {
          need(tgt, '태그 이름을 입력하세요 (예: v1.0.0)', 'Enter a tag name (e.g. v1.0.0)');
          if (ta === 'delete') { add('-d', '로컬 태그 삭제', 'Delete the local tag'); add(q(tgt), '태그 이름', 'Tag name'); warn.push(t('원격 태그도 지우려면: git push origin --delete ' + tgt, 'To delete it on the remote too: git push origin --delete ' + tgt)); }
          else { if (ta === 'ann') add('-a', '주석 태그 (작성자·날짜·메시지 저장, 릴리스에 권장)', 'Annotated tag (stores tagger, date, message — recommended for releases)'); add(q(tgt), '태그 이름', 'Tag name'); if (ta === 'ann') add('-m ' + dq(msg || tgt), '태그 메시지', 'Tag message'); if (tgt2) add(q(tgt2), '태그를 붙일 커밋', 'Commit to tag'); warn.push(t('태그는 git push 로 올라가지 않습니다: git push origin ' + tgt + ' (또는 --tags)', 'Tags are not pushed by git push: git push origin ' + tgt + ' (or --tags)')); }
        }
      } else if (k === 'restore') {
        need(tgt || o.path, '복원할 파일 경로를 입력하세요', 'Enter the file path to restore');
        add('restore', '파일을 이전 상태로 복원', 'Restore files');
        if (o.staged) { add('--staged', '스테이징만 취소 (파일 내용은 그대로)', 'Unstage only (file content stays)'); } else warn.push(t('🚨 스테이징 없이 쓰면 작업 폴더의 변경을 버립니다 (되돌릴 수 없음)', '🚨 Without --staged this discards working-tree changes (irreversible)'));
        add(q(tgt || o.path), '복원할 경로', 'Path to restore');
      } else if (k === 'clean') {
        add('clean', '추적되지 않는 파일 삭제', 'Delete untracked files');
        if (o.dry || !o.cforce) add('-n', '삭제될 파일만 보여줌 (실제 삭제 안 함)', 'Show what would be deleted (no deletion)'); if (o.cforce) add('-f', '실제로 삭제', 'Actually delete'); if (o.cdirs) add('-d', '폴더도 삭제', 'Include directories'); if (o.cignored) add('-x', '.gitignore 대상(빌드 산출물·.env 등)도 삭제', 'Also delete ignored files (build output, .env …)');
        if (o.cforce && !o.dry) warn.push(t('🚨 삭제된 파일은 휴지통에 가지 않아 복구할 수 없습니다. 먼저 -n 으로 확인하세요', '🚨 Deleted files bypass the trash and cannot be recovered. Run with -n first'));
        if (o.cignored) warn.push(t('-x 는 .env 같은 로컬 설정 파일까지 지울 수 있습니다', '-x can delete local config such as .env'));
        if (o.cforce && o.dry) { parts = parts.filter(function (p) { return p[0] !== '-f'; }); }
      } else if (k === 'remote') {
        add('remote', '원격 저장소 관리', 'Manage remotes');
        var ra = o.remact;
        if (ra === 'list') add('-v', '이름과 URL 표시', 'Show names and URLs');
        else { need(tgt2 || tgt, '원격 이름을 입력하세요', 'Enter the remote name'); var nm = tgt2 || 'origin'; add(ra === 'seturl' ? 'set-url' : ra, { add: '새 원격 추가', remove: '원격 제거', seturl: '원격 URL 변경' }[ra], { add: 'Add a remote', remove: 'Remove a remote', seturl: 'Change a remote URL' }[ra]); add(q(nm), '원격 이름', 'Remote name'); if (ra !== 'remove') { need(tgt, 'URL 을 대상 칸에 입력하세요', 'Enter the URL in the target field'); add(q(tgt), '저장소 URL', 'Repository URL'); } }
      }
      var cmd = parts.map(function (p) { return p[0]; }).join(' ');
      var issues = warn.concat(undo.length ? [t('↩️ ', '↩️ ') + undo.join(' / ')] : []);
      if (!issues.length) issues.push(t('이 명령은 데이터를 잃을 위험이 낮습니다', 'This command carries little risk of data loss'));
      return { _status: warn.some(function (w) { return /^🚨/.test(w); }) ? { ok: 'info', msg: t('⚠️ 위험한 옵션이 포함되어 있습니다', '⚠️ Contains a risky option') } : t('✅ 명령어를 만들었습니다', '✅ Command built'), out: cmd, table: { head: [['부분', 'Part'], ['뜻', 'Meaning']], rows: parts }, issues: issues };
    }
  });
})();
