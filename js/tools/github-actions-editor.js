TK.tool('github-actions-editor', {
  inputs: [{ id: 'in', label: ['워크플로우 (.github/workflows/*.yml)', 'Workflow (.github/workflows/*.yml)'], rows: 22, sample: 'name: CI\non:\n  push:\n    branches: [main]\n  pull_request_target:\n    types: [opened]\njobs:\n  build:\n    runs-on: ubuntu-20.04\n    steps:\n      - uses: actions/checkout@v3\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Greet\n        run: echo "${{ github.event.pull_request.title }}"\n      - id: build\n        run: npm ci && npm test\n      - uses: actions/upload-artifact@main\n        with:\n          name: out\n          path: dist\n  deploy:\n    needs: [build, test]\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ${{ steps.deploy.outputs.url }}\n        uses: ./scripts/deploy\n' }],
  sampleExpectError: true,
  options: [{ id: 'hints', type: 'checkbox', label: ['보안·유지보수 권고(ℹ️)도 표시', 'Also show security and maintenance hints (ℹ️)'], default: true }],
  outputs: [{ id: 'table', label: ['잡·스텝 구조', 'Jobs and steps'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var Y = TK.yamlx, issues = [];
    var src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('워크플로우를 입력하세요', 'Enter a workflow'));
    var res; try { res = Y.parse(src); } catch (e) { throw new Error(t('YAML 문법 오류 (줄 ' + e.line + '): ', 'YAML syntax error (line ' + e.line + '): ') + e.message); }
    var doc = res.docs[0]; if (!doc || !doc.root) throw new Error(t('내용이 비어 있습니다', 'The file is empty')); if (doc.error) throw new Error(doc.error.message);
    var root = Y.deref(doc.root), js = doc.js; if (!Y.isMap(js)) throw new Error(t('최상위가 매핑이 아닙니다', 'The top level is not a mapping'));
    function add(sev, line, msg) { issues.push({ sev: sev, line: line, msg: msg }); }
    doc.dups.forEach(function (d) { add('error', d.line, t('키 "' + d.key + '" 가 중복되었습니다 (첫 정의: 줄 ' + d.first + ')', 'Duplicate key "' + d.key + '" (first at line ' + d.first + ')')); });
    var EVENTS = ['branch_protection_rule', 'check_run', 'check_suite', 'create', 'delete', 'deployment', 'deployment_status', 'discussion', 'discussion_comment', 'fork', 'gollum', 'issue_comment', 'issues', 'label', 'merge_group', 'milestone', 'page_build', 'public', 'pull_request', 'pull_request_review', 'pull_request_review_comment', 'pull_request_target', 'push', 'registry_package', 'release', 'repository_dispatch', 'schedule', 'status', 'watch', 'workflow_call', 'workflow_dispatch', 'workflow_run', 'project', 'project_card', 'project_column'];
    var TOP = ['name', 'run-name', 'on', 'permissions', 'env', 'defaults', 'concurrency', 'jobs'];
    Object.keys(js).forEach(function (k) { if (TOP.indexOf(k) < 0) add('error', Y.keyLine(root, k), t('최상위 키 "' + k + '" 는 워크플로우에 없습니다' + (k === 'true' ? ' ("on" 이 YAML 1.1 에서 true 로 바뀐 경우)' : ''), 'Unknown top-level key "' + k + '"')); });
    if (js.on === undefined && js['true'] === undefined) add('error', 1, t('on(트리거)이 없습니다', 'There is no on (trigger)'));
    var triggers = [], onVal = js.on;
    if (typeof onVal === 'string') triggers = [onVal]; else if (Array.isArray(onVal)) triggers = onVal.slice(); else if (Y.isMap(onVal)) triggers = Object.keys(onVal);
    triggers.forEach(function (e) { if (EVENTS.indexOf(e) < 0) add('error', Y.keyLine(root, 'on'), t('알 수 없는 이벤트 "' + e + '"', 'Unknown event "' + e + '"')); });
    if (Y.isMap(onVal) && onVal.schedule) { (Array.isArray(onVal.schedule) ? onVal.schedule : []).forEach(function (sc) { if (!sc || !sc.cron) add('error', Y.keyLine(Y.get(root, ['on']), 'schedule'), t('schedule 항목에 cron 이 필요합니다', 'schedule entries need cron')); else if (String(sc.cron).trim().split(/\s+/).length !== 5) add('error', Y.keyLine(Y.get(root, ['on']), 'schedule'), t('cron "' + sc.cron + '" 은 5개 필드여야 합니다', 'cron "' + sc.cron + '" must have 5 fields')); }); }
    if (Y.isMap(onVal) && onVal.push && Y.isMap(onVal.push) && onVal.push.branches && onVal.push['branches-ignore']) add('error', Y.keyLine(Y.get(root, ['on']), 'push'), t('branches 와 branches-ignore 는 함께 쓸 수 없습니다', 'branches and branches-ignore cannot be used together'));
    if (Y.isMap(onVal) && onVal.workflow_dispatch && Y.isMap(onVal.workflow_dispatch) && Y.isMap(onVal.workflow_dispatch.inputs)) Object.keys(onVal.workflow_dispatch.inputs).forEach(function (k) { var inp = onVal.workflow_dispatch.inputs[k]; if (inp && inp.type === 'choice' && !Array.isArray(inp.options)) add('error', Y.keyLine(Y.get(root, ['on', 'workflow_dispatch', 'inputs']), k), t('choice 입력 "' + k + '" 에는 options 가 필요합니다', 'choice input "' + k + '" needs options')); });
    if (js.permissions === 'write-all') add('warn', Y.keyLine(root, 'permissions'), t('permissions: write-all 은 GITHUB_TOKEN 에 모든 쓰기 권한을 줍니다. 필요한 권한만 지정하세요', 'permissions: write-all gives the GITHUB_TOKEN every write scope; list only what is needed'));
    var jobsNode = Y.get(root, ['jobs']);
    if (!Y.isMap(js.jobs) || !Object.keys(js.jobs).length) { add('error', Y.keyLine(root, 'jobs'), t('jobs 가 없거나 비어 있습니다', 'jobs is missing or empty')); }
    var JKEYS = ['name', 'permissions', 'needs', 'if', 'runs-on', 'snapshot', 'environment', 'concurrency', 'outputs', 'env', 'defaults', 'steps', 'timeout-minutes', 'strategy', 'continue-on-error', 'container', 'services', 'uses', 'with', 'secrets'];
    var SKEYS = ['id', 'if', 'name', 'uses', 'run', 'working-directory', 'shell', 'with', 'env', 'continue-on-error', 'timeout-minutes'];
    var RETIRED = { 'ubuntu-18.04': '폐지됨', 'ubuntu-20.04': '2025-04 폐지', 'macos-10.15': '폐지됨', 'macos-11': '폐지됨', 'macos-12': '폐지됨', 'windows-2016': '폐지됨', 'windows-2019': '폐지됨' };
    var MINVER = { 'actions/checkout': 4, 'actions/setup-node': 4, 'actions/setup-python': 5, 'actions/setup-java': 4, 'actions/setup-go': 5, 'actions/cache': 4, 'actions/upload-artifact': 4, 'actions/download-artifact': 4, 'actions/github-script': 7, 'docker/login-action': 3, 'docker/setup-buildx-action': 3, 'docker/build-push-action': 5, 'docker/setup-qemu-action': 3, 'actions/setup-dotnet': 4 };
    var INJ = /github\.(event\.(issue\.(title|body)|pull_request\.(title|body|head\.ref|head\.label|head\.repo\.default_branch)|comment\.body|review\.body|review_comment\.body|pages\.[^}]*page_name|commits\.[^}]*\.(message|author\.(email|name))|head_commit\.(message|author\.(email|name))|workflow_run\.(head_branch|head_commit\.message|pull_requests\.[^}]*\.head\.ref))|head_ref)/;
    var CTX = ['github', 'env', 'vars', 'job', 'jobs', 'steps', 'runner', 'secrets', 'strategy', 'matrix', 'needs', 'inputs'];
    var jobNames = Y.isMap(js.jobs) ? Object.keys(js.jobs) : [], rows = [], graph = {}, totalSteps = 0;
    function scanExpr(str, line, ctx) {
      var re = /\$\{\{([\s\S]*?)\}\}/g, m, opened = (String(str).match(/\$\{\{/g) || []).length, closed = (String(str).match(/\}\}/g) || []).length;
      if (opened !== closed) add('error', line, t('${{ }} 가 짝이 맞지 않습니다', 'Unbalanced ${{ }}'));
      while ((m = re.exec(str))) {
        var ex = m[1];
        (ex.match(/\b([a-zA-Z_][\w-]*)\./g) || []).forEach(function (c) { var nm = c.slice(0, -1); if (CTX.indexOf(nm) < 0 && !/^(contains|startsWith|endsWith|format|join|toJSON|fromJSON|hashFiles|success|failure|always|cancelled)$/.test(nm) && !/^[a-z]+$/.test('') && /^[a-z]+$/.test(nm) && ['true', 'false', 'null'].indexOf(nm) < 0 && !/\./.test(nm)) { /* 속성 이름일 수 있음 */ } });
        var top = /(?:^|[\s(!,=&|])((?:github|env|vars|job|jobs|steps|runner|secrets|strategy|matrix|needs|inputs|[a-z_]+))\.[a-zA-Z_*]/g, tm;
        while ((tm = top.exec(ex))) { var nm2 = tm[1]; if (CTX.indexOf(nm2) < 0 && !/^(true|false|null)$/.test(nm2) && ctx !== 'loose') add('warn', line, t('알 수 없는 컨텍스트 "' + nm2 + '" (사용 가능: ' + CTX.join(', ') + ')', 'Unknown context "' + nm2 + '" (available: ' + CTX.join(', ') + ')')); }
        (ex.match(/\bsecrets\.[A-Za-z_]+/g) || []).forEach(function () { });
        var sm = /\bsteps\.([A-Za-z_][\w-]*)/g, s2; while ((s2 = sm.exec(ex))) { if (ctx && ctx.stepIds && ctx.stepIds.indexOf(s2[1]) < 0) add('error', line, t('steps.' + s2[1] + ' 에 해당하는 id 를 가진 스텝이 이 잡에 없습니다', 'No step in this job has the id used in steps.' + s2[1])); }
        var nmm = /\bneeds\.([A-Za-z_][\w-]*)/g, n2; while ((n2 = nmm.exec(ex))) { if (ctx && ctx.needs && ctx.needs.indexOf(n2[1]) < 0) add('error', line, t('needs.' + n2[1] + ' 를 쓰지만 이 잡의 needs 에 "' + n2[1] + '" 가 없습니다', 'needs.' + n2[1] + ' is used but "' + n2[1] + '" is not in this job\'s needs')); }
        var mm = /\bmatrix\.([A-Za-z_][\w-]*)/g, m3; while ((m3 = mm.exec(ex))) { if (ctx && ctx.matrixKeys && ctx.matrixKeys.indexOf(m3[1]) < 0) add('warn', line, t('matrix.' + m3[1] + ' 가 strategy.matrix 에 정의되지 않았습니다', 'matrix.' + m3[1] + ' is not defined in strategy.matrix')); }
      }
    }
    var allText = [];
    jobNames.forEach(function (jid) {
      var j = js.jobs[jid], jn = Y.get(jobsNode, [jid]), jline = Y.keyLine(jobsNode, jid);
      if (!Y.isMap(j)) { add('error', jline, t('잡 "' + jid + '" 정의가 매핑이 아닙니다', 'Job "' + jid + '" is not a mapping')); return; }
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(jid)) add('error', jline, t('잡 id "' + jid + '" 는 영문자·_ 로 시작하고 영문자·숫자·-·_ 만 쓸 수 있습니다', 'Job id "' + jid + '" must start with a letter or _ and use letters, digits, - and _'));
      Object.keys(j).forEach(function (k) { if (JKEYS.indexOf(k) < 0) add('error', Y.keyLine(jn, k), t('잡 "' + jid + '" 의 알 수 없는 키 "' + k + '"', 'Unknown key "' + k + '" in job "' + jid + '"')); });
      var needs = j.needs == null ? [] : Array.isArray(j.needs) ? j.needs : [j.needs]; graph[jid] = needs;
      needs.forEach(function (n) { if (jobNames.indexOf(n) < 0) add('error', Y.keyLine(jn, 'needs'), t('needs 의 "' + n + '" 잡이 없습니다', 'needs refers to missing job "' + n + '"')); else if (n === jid) add('error', Y.keyLine(jn, 'needs'), t('잡 "' + jid + '" 가 자기 자신에 의존합니다', 'Job "' + jid + '" depends on itself')); });
      if (!j['runs-on'] && !j.uses) add('error', jline, t('잡 "' + jid + '" 에 runs-on 이 필요합니다', 'Job "' + jid + '" needs runs-on'));
      if (j['runs-on'] && j.uses) add('error', jline, t('uses(재사용 워크플로우)를 쓰는 잡에는 runs-on·steps 를 둘 수 없습니다', 'A job that uses a reusable workflow cannot have runs-on or steps'));
      var ro = j['runs-on']; (Array.isArray(ro) ? ro : typeof ro === 'string' ? [ro] : []).forEach(function (r) { if (RETIRED[r]) add('error', Y.keyLine(jn, 'runs-on'), t('러너 "' + r + '" 는 ' + RETIRED[r] + ' 되어 잡이 실행되지 않습니다. ubuntu-latest 또는 최신 버전을 쓰세요', 'Runner "' + r + '" is retired and jobs will not start; use ubuntu-latest or a current version')); });
      if (j.uses) { if (!/^(\.\/.+|[^/\s]+\/[^/\s]+\/\.github\/workflows\/[^@\s]+@\S+)$/.test(String(j.uses))) add('error', Y.keyLine(jn, 'uses'), t('재사용 워크플로우 uses 형식은 owner/repo/.github/workflows/파일.yml@ref 입니다', 'A reusable workflow uses owner/repo/.github/workflows/file.yml@ref')); }
      if (!j.uses && !Array.isArray(j.steps)) add('error', jline, t('잡 "' + jid + '" 에 steps 가 필요합니다', 'Job "' + jid + '" needs steps'));
      if (o.hints && !j['timeout-minutes'] && !j.uses) add('info', jline, t('잡 "' + jid + '" 에 timeout-minutes 가 없어 멈춘 잡이 최대 6시간 실행됩니다', 'Job "' + jid + '" has no timeout-minutes, so a hung job can run up to 6 hours'));
      var matrixKeys = null;
      if (j.strategy && Y.isMap(j.strategy.matrix)) matrixKeys = Object.keys(j.strategy.matrix).filter(function (k) { return k !== 'include' && k !== 'exclude'; }).concat((j.strategy.matrix.include || []).reduce(function (a, inc) { return a.concat(Y.isMap(inc) ? Object.keys(inc) : []); }, []));
      var steps = Array.isArray(j.steps) ? j.steps : [], stepIds = [], seenIds = {}, sNode = Y.get(jn, ['steps']);
      steps.forEach(function (st) { if (Y.isMap(st) && st.id) stepIds.push(String(st.id)); });
      var ctx = { stepIds: stepIds, needs: needs, matrixKeys: matrixKeys };
      steps.forEach(function (st, idx) {
        totalSteps++;
        var stn = Y.get(sNode, [idx]), sline = stn ? stn.line : jline;
        if (!Y.isMap(st)) { add('error', sline, t('스텝 ' + (idx + 1) + ' 이 매핑이 아닙니다', 'Step ' + (idx + 1) + ' is not a mapping')); return; }
        Object.keys(st).forEach(function (k) { if (SKEYS.indexOf(k) < 0) add('error', Y.keyLine(stn, k), t('스텝의 알 수 없는 키 "' + k + '"', 'Unknown step key "' + k + '"')); });
        if (!st.uses && !st.run) add('error', sline, t('스텝에는 uses 또는 run 이 필요합니다', 'A step needs uses or run'));
        if (st.uses && st.run) add('error', sline, t('스텝에 uses 와 run 을 함께 쓸 수 없습니다', 'A step cannot have both uses and run'));
        if (st.run && st.with) add('error', Y.keyLine(stn, 'with'), t('run 스텝에는 with 를 쓸 수 없습니다 (env 를 쓰세요)', 'A run step cannot have with (use env)'));
        if (st.shell && !st.run) add('error', Y.keyLine(stn, 'shell'), t('shell 은 run 스텝에서만 쓸 수 있습니다', 'shell is only valid on run steps'));
        if (st.shell && ['bash', 'pwsh', 'python', 'sh', 'cmd', 'powershell'].indexOf(st.shell) < 0 && String(st.shell).indexOf('{0}') < 0) add('error', Y.keyLine(stn, 'shell'), t('shell "' + st.shell + '" 은(는) 올바르지 않습니다', 'Invalid shell "' + st.shell + '"'));
        if (st.id) { if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(String(st.id))) add('error', Y.keyLine(stn, 'id'), t('스텝 id "' + st.id + '" 형식이 올바르지 않습니다', 'Invalid step id "' + st.id + '"')); if (seenIds[st.id]) add('error', Y.keyLine(stn, 'id'), t('스텝 id "' + st.id + '" 가 잡 안에서 중복됩니다', 'Step id "' + st.id + '" is duplicated within the job')); seenIds[st.id] = true; }
        if (st.uses) {
          var u = String(st.uses), um = /^([^/@\s]+\/[^/@\s]+)((?:\/[^@\s]+)?)@(\S+)$/.exec(u);
          if (/^\.\//.test(u) || /^docker:\/\//.test(u)) { /* 로컬/도커 */ }
          else if (!um) add('error', Y.keyLine(stn, 'uses'), t('uses "' + u + '" 형식이 올바르지 않습니다 (owner/repo@ref, ./경로, docker://이미지)', 'Invalid uses "' + u + '" (owner/repo@ref, ./path, docker://image)'));
          else {
            var repo = um[1], ref = um[3], mv = MINVER[repo], vmaj = /^v?(\d+)(\.|$)/.exec(ref);
            if (mv && vmaj && +vmaj[1] < mv) add('warn', Y.keyLine(stn, 'uses'), t(repo + '@' + ref + ' 는 오래된 버전입니다 (Node 런타임 폐기·기능 종료). v' + mv + ' 이상으로 올리세요', repo + '@' + ref + ' is outdated (deprecated Node runtime or shut down); upgrade to v' + mv + ' or later'));
            if (/^(main|master|HEAD|develop|dev)$/.test(ref)) add('warn', Y.keyLine(stn, 'uses'), t(u + ' 는 브랜치를 가리켜 내용이 바뀔 수 있습니다. 태그나 커밋 SHA 로 고정하세요', u + ' points to a branch whose content can change; pin a tag or commit SHA'));
            else if (o.hints && !/^[0-9a-f]{40}$/.test(ref) && !/^actions\//.test(repo)) add('info', Y.keyLine(stn, 'uses'), t('서드파티 액션 ' + repo + ' 는 커밋 SHA(40자)로 고정하면 공급망 공격을 막을 수 있습니다', 'Pin the third-party action ' + repo + ' to a full commit SHA to resist supply-chain attacks'));
          }
        }
        if (st.run) {
          var rm = /\$\{\{([\s\S]*?)\}\}/g, rx, bad = null; while ((rx = rm.exec(String(st.run)))) { var im = INJ.exec(rx[1]); if (im) { bad = im[0]; break; } }
          if (bad) add('error', Y.keyLine(stn, 'run'), t('run 스크립트에 신뢰할 수 없는 입력(' + bad + ')이 직접 들어가 스크립트 인젝션 위험이 있습니다. env 로 넘긴 뒤 "$VAR" 로 쓰세요', 'Untrusted input (' + bad + ') is interpolated into the run script, a script-injection risk; pass it through env and use "$VAR"'));
          var tok = /(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.exec(String(st.run)); if (tok) add('error', Y.keyLine(stn, 'run'), t('스크립트에 비밀 값처럼 보이는 문자열이 들어 있습니다. secrets 를 쓰세요', 'The script contains something that looks like a secret; use secrets'));
        }
        if (st.uses && /^actions\/checkout/.test(String(st.uses)) && triggers.indexOf('pull_request_target') >= 0 && st.with && /head\.(sha|ref)|github\.head_ref/.test(String(st.with.ref || ''))) add('error', Y.keyLine(stn, 'uses'), t('pull_request_target 은 비밀 값과 쓰기 권한으로 실행되는데 PR 의 head 를 체크아웃하면 외부 코드가 그 권한으로 실행됩니다', 'pull_request_target runs with secrets and write access; checking out the PR head runs outside code with those privileges'));
        if (st.if && /\$\{\{/.test(String(st.if)) && o.hints && /^\s*\$\{\{[\s\S]*\}\}\s*$/.test(String(st.if)) === false) add('warn', Y.keyLine(stn, 'if'), t('if 안에서 ${{ }} 를 문자열 일부로 쓰면 항상 참이 될 수 있습니다. 전체를 ${{ }} 로 감싸거나 모두 빼세요', 'Using ${{ }} as part of a string in if can make it always true; wrap the whole expression or drop the braces'));
        ['run', 'if', 'name', 'working-directory'].forEach(function (k) { if (typeof st[k] === 'string') scanExpr(st[k], Y.keyLine(stn, k), ctx); });
        if (Y.isMap(st.with)) Object.keys(st.with).forEach(function (k) { if (typeof st.with[k] === 'string') scanExpr(st.with[k], Y.keyLine(Y.get(stn, ['with']), k), ctx); });
        if (Y.isMap(st.env)) Object.keys(st.env).forEach(function (k) { if (typeof st.env[k] === 'string') scanExpr(st.env[k], Y.keyLine(Y.get(stn, ['env']), k), ctx); });
        rows.push([jid, String(idx + 1), st.name ? String(st.name) : (st.uses ? String(st.uses) : 'run'), st.uses ? 'uses' : 'run', st.id ? String(st.id) : '', String(sline)]);
      });
      if (typeof j.if === 'string') scanExpr(j.if, Y.keyLine(jn, 'if'), { needs: needs });
      if (o.hints && j.permissions === undefined && js.permissions === undefined) { /* 문서 수준에서 한 번만 */ }
    });
    if (o.hints && js.permissions === undefined && !jobNames.some(function (jid) { return Y.isMap(js.jobs[jid]) && js.jobs[jid].permissions; })) add('info', 1, t('permissions 가 없어 GITHUB_TOKEN 이 저장소 기본 권한을 갖습니다. permissions: contents: read 로 최소화하세요', 'No permissions block, so GITHUB_TOKEN gets the repository default; reduce it with permissions: contents: read'));
    /* 순환 */
    var st2 = {}, cyc = null;
    (function vis(n, path) { if (st2[n] === 2) return; if (st2[n] === 1) { cyc = cyc || path.slice(path.indexOf(n)).concat(n); return; } st2[n] = 1; (graph[n] || []).forEach(function (d) { if (jobNames.indexOf(d) >= 0) vis(d, path.concat(n)); }); st2[n] = 2; });
    jobNames.forEach(function (n) { (function vis(x, path) { if (st2[x] === 2) return; if (st2[x] === 1) { cyc = cyc || path.slice(path.indexOf(x)).concat(x); return; } st2[x] = 1; (graph[x] || []).forEach(function (d) { if (jobNames.indexOf(d) >= 0) vis(d, path.concat(x)); }); st2[x] = 2; })(n, []); });
    if (cyc) add('error', Y.keyLine(jobsNode, cyc[0]), t('needs 순환: ' + cyc.join(' → '), 'needs cycle: ' + cyc.join(' → ')));
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
    var shown = issues.filter(function (x) { return o.hints || x.sev !== 'info'; }).sort(function (a, b) { return a.line - b.line; });
    var list = shown.map(function (x) { return ICON[x.sev] + ' ' + t('줄 ', 'Line ') + x.line + ': ' + x.msg; });
    var errs = issues.filter(function (x) { return x.sev === 'error'; }).length, warns = issues.filter(function (x) { return x.sev === 'warn'; }).length;
    var msg = errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — 잡 ' + jobNames.length + '개, 스텝 ' + totalSteps + '개', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + jobNames.length + ' job(s), ' + totalSteps + ' step(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — 잡 ' + jobNames.length + '개, 스텝 ' + totalSteps + '개', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + jobNames.length + ' job(s), ' + totalSteps + ' step(s)');
    return { _status: { ok: errs ? false : true, msg: msg }, table: { head: [['잡', 'Job'], ['#', '#'], ['스텝', 'Step'], ['종류', 'Kind'], ['id', 'id'], ['줄', 'Line']], rows: rows }, issues: list };
  }
});
