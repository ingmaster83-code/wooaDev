TK.tool('command-line-parser', {
  inputs: [
    { id: 'cmd', label: ['명령줄', 'Command line'], rows: 5, sample: "API_KEY=abc123 NODE_ENV=production curl -sS -H \"Authorization: Bearer $TOKEN\" 'https://api.example.com/v1/items?limit=10' | jq '.items[] | .name' > names.txt 2>&1 && echo \"done: $(date +%F)\"", show: function (o) { return o.mode === 'cmd'; } },
    { id: 'path', label: ['PATH 값', 'PATH value'], rows: 4, sample: '/usr/local/bin:/usr/bin:/bin:/usr/local/bin:./node_modules/.bin::~/bin:/opt/tools/', show: function (o) { return o.mode === 'path'; } },
    { id: 'env', label: ['환경 변수 (KEY=VALUE, export 가능)', 'Environment variables (KEY=VALUE, export allowed)'], rows: 8, sample: 'export NODE_ENV=production\nDATABASE_URL="postgres://user:pa ss@db:5432/app"\nAPI_TOKEN=\'abc.def\'\nPORT=3000\nPORT=8080\n# comment\n1BAD=nope\nempty=', show: function (o) { return o.mode === 'env'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['분석 대상', 'Analyse'], choices: [['cmd', ['명령줄 (인수·파이프·리디렉션)', 'Command line (arguments, pipes, redirects)']], ['path', ['PATH 변수', 'PATH variable']], ['env', ['환경 변수 목록', 'Environment variable list']]], default: 'cmd' },
    { id: 'shell', type: 'select', label: ['셸 규칙', 'Shell rules'], choices: [['posix', 'POSIX sh / bash / zsh'], ['win', ['Windows (CommandLineToArgvW)', 'Windows (CommandLineToArgvW)']]], default: 'posix', show: function (o) { return o.mode === 'cmd'; } }
  ],
  sampleExpectError: false,
  outputs: [{ id: 'table', label: ['분석 결과', 'Analysis'], kind: 'table' }, { id: 'out', label: ['정리된 출력', 'Cleaned output'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [];
    if (o.mode === 'path') {
      var raw = String(v.path || '').trim(); if (!raw) throw new Error(t('PATH 값을 입력하세요', 'Enter a PATH value'));
      var win = /;/.test(raw) || /^[A-Za-z]:\\/.test(raw), sep = win ? ';' : ':', entries = raw.split(sep), seen = {}, rows = [], clean = [], i;
      entries.forEach(function (e, idx) {
        var notes = [], key = e.replace(/[\\/]+$/, '').toLowerCase(), keep = true;
        if (e === '') { notes.push(t('🚨 빈 항목 = 현재 디렉터리(.) 를 의미합니다 — 악성 실행 파일 실행 위험', '🚨 Empty entry = current directory (.) — risk of running a malicious binary')); keep = false; }
        else if (e === '.' || e === '..' || /^\.\.?[\\/]/.test(e)) { notes.push(t('🚨 상대 경로 — 현재 위치에 따라 달라지며 보안상 위험합니다', '🚨 Relative path — changes with the working directory and is unsafe')); keep = false; }
        else if (!win && e[0] === '~') notes.push(t('~ 는 따옴표 안에서는 확장되지 않아 동작하지 않을 수 있습니다 ($HOME 사용)', '~ is not expanded inside quotes and may not work — use $HOME'));
        else if (!win && e[0] !== '/') { notes.push(t('절대 경로(/…)가 아닙니다', 'Not an absolute path (/…)')); keep = false; }
        if (/[\\/]$/.test(e) && e.length > 1) notes.push(t('끝의 슬래시는 불필요합니다', 'Trailing slash is unnecessary'));
        if (key && seen[key] !== undefined) { notes.push(t('중복 — ' + (seen[key] + 1) + '번째 항목과 같음 (뒤쪽은 의미 없음)', 'Duplicate of entry ' + (seen[key] + 1) + ' (the later one is useless)')); keep = false; } else if (key) seen[key] = idx;
        if (/\s/.test(e)) notes.push(t('공백 포함 — 일부 도구에서 문제가 됩니다', 'Contains a space — breaks some tools'));
        rows.push([String(idx + 1), e === '' ? t('(빈 항목)', '(empty)') : e, notes.join(' · ') || '✅']);
        if (keep && e) clean.push(e.replace(/[\\/]+$/, '') || e);
        if (notes.some(function (n) { return /^🚨/.test(n); })) issues.push(t('🚨 ' + (idx + 1) + '번째: ' + (e === '' ? '빈 항목' : e), '🚨 Entry ' + (idx + 1) + ': ' + (e === '' ? 'empty' : e)));
      });
      var rest = entries.length - clean.length;
      issues.push(t('앞쪽 항목이 먼저 검색됩니다 — 같은 이름의 프로그램이 여러 곳에 있으면 첫 번째가 실행됩니다 (which -a 로 확인)', 'Earlier entries win — if the same program exists in several places the first one runs (check with which -a)'));
      if (rest > 0) issues.push(t('정리하면 ' + entries.length + '개 → ' + clean.length + '개로 줄어듭니다', 'Cleaning reduces ' + entries.length + ' → ' + clean.length + ' entries'));
      return { _status: issues.some(function (x) { return /^🚨/.test(x); }) ? { ok: 'info', msg: t('🔍 위험한 항목이 있습니다', '🔍 Risky entries found') } : t('✅ PATH ' + entries.length + '개 항목을 분석했습니다', '✅ Analysed ' + entries.length + ' PATH entries'), table: { head: [['#', '#'], ['항목', 'Entry'], ['점검', 'Check']], rows: rows }, out: win ? 'set PATH=' + clean.join(';') + '\n' + '# PowerShell\n$env:Path = "' + clean.join(';') + '"' : "export PATH='" + clean.join(':') + "'", issues: issues };
    }
    if (o.mode === 'env') {
      var lines = String(v.env || '').replace(/\r/g, '').split('\n'), rows2 = [], map = {}, order = [], dup = 0, bad = 0;
      lines.forEach(function (ln, idx) {
        var s = ln.trim(); if (!s || s[0] === '#') return;
        s = s.replace(/^export\s+/, ''); var m = /^([^=\s]+)\s*=\s*(.*)$/.exec(s);
        if (!m) { bad++; rows2.push([String(idx + 1), s, '', t('❌ KEY=VALUE 형식이 아닙니다', '❌ Not KEY=VALUE')]); return; }
        var k = m[1], val = m[2], quoted = false, q = /^(["'])([\s\S]*)\1$/.exec(val); if (q) { val = q[2]; quoted = true; } else val = val.replace(/\s+#.*$/, '');
        var notes = [];
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) { bad++; rows2.push([String(idx + 1), k, val, t('❌ 이름이 올바르지 않습니다 (영문·숫자·_ , 숫자로 시작 불가)', '❌ Invalid name (letters, digits, _; cannot start with a digit)')]); return; }
        if (map[k] !== undefined) { notes.push(t('중복 — 마지막 값이 적용됩니다', 'Duplicate — the last value wins')); dup++; } else order.push(k);
        map[k] = val;
        if (/(PASS|SECRET|TOKEN|KEY|PWD|CREDENTIAL|PRIVATE)/i.test(k) && val) notes.push(t('🔐 비밀 값으로 보입니다 — 저장소에 커밋하지 마세요', '🔐 Looks like a secret — never commit it'));
        if (!quoted && /\s/.test(val)) notes.push(t('공백이 있는데 따옴표가 없습니다', 'Contains spaces but is not quoted'));
        if (quoted && /\$\(|`/.test(val) && m[2][0] === '"') notes.push(t('큰따옴표 안의 $(…) 는 실행될 수 있습니다', '$(…) inside double quotes may be executed'));
        if (!val) notes.push(t('값이 비어 있습니다', 'Empty value'));
        rows2.push([String(idx + 1), k, val, notes.join(' · ') || '✅']);
      });
      if (!rows2.length) throw new Error(t('환경 변수를 입력하세요', 'Enter environment variables'));
      var sorted = order.slice().sort(), q2 = function (s) { return /^[A-Za-z0-9_@%+=:,.\/-]+$/.test(s) ? s : "'" + String(s).replace(/'/g, "'\\''") + "'"; };
      var out = ['# export', sorted.map(function (k) { return 'export ' + k + '=' + q2(map[k]); }).join('\n'), '', '# .env', sorted.map(function (k) { return k + '=' + (/^[A-Za-z0-9_@%+=:,.\/-]*$/.test(map[k]) ? map[k] : JSON.stringify(map[k])); }).join('\n'), '', '# docker run', sorted.map(function (k) { return '-e ' + q2(k + '=' + map[k]); }).join(' '), '', '# JSON', JSON.stringify(sorted.reduce(function (a, k) { a[k] = map[k]; return a; }, {}), null, 2)];
      if (dup) issues.push(t('중복된 변수 ' + dup + '개', dup + ' duplicate variable(s)'));
      issues.push(t('환경 변수는 프로세스 목록(ps eww)·/proc/PID/environ·docker inspect 로 노출될 수 있어 비밀 값에는 파일/시크릿 매니저가 더 안전합니다', 'Environment variables can leak through ps eww, /proc/PID/environ and docker inspect — prefer files or a secret manager for secrets'));
      return { _status: bad ? { ok: 'info', msg: t('🔍 ' + order.length + '개 변수 · 오류 ' + bad + '건', '🔍 ' + order.length + ' variables · ' + bad + ' error(s)') } : t('✅ 변수 ' + order.length + '개를 정리했습니다', '✅ Parsed ' + order.length + ' variable(s)'), table: { head: [['줄', 'Line'], ['이름', 'Name'], ['값', 'Value'], ['점검', 'Check']], rows: rows2 }, out: out.join('\n'), issues: issues };
    }
    // ---- 명령줄 ----
    var s = String(v.cmd || '').replace(/\r\n/g, '\n'); if (!s.trim()) throw new Error(t('명령줄을 입력하세요', 'Enter a command line'));
    if (o.shell === 'win') {
      var args = [], cur = '', inQ = false, has = false, i2 = 0;
      while (i2 < s.length) {
        var c = s[i2];
        if (c === '\\') { var n = 0; while (s[i2] === '\\') { n++; i2++; } if (s[i2] === '"') { cur += new Array(Math.floor(n / 2) + 1).join('\\'); if (n % 2) { cur += '"'; i2++; } } else cur += new Array(n + 1).join('\\'); has = true; continue; }
        if (c === '"') { if (inQ && s[i2 + 1] === '"') { cur += '"'; i2 += 2; continue; } inQ = !inQ; has = true; i2++; continue; }
        if (/\s/.test(c) && !inQ) { if (has) { args.push(cur); cur = ''; has = false; } i2++; continue; }
        cur += c; has = true; i2++;
      }
      if (inQ) throw new Error(t('따옴표가 닫히지 않았습니다', 'Unclosed quote'));
      if (has) args.push(cur);
      args.forEach(function (a, i) { if (/%[^%]+%/.test(a)) issues.push(t('인수 ' + (i + 1) + ': %VAR% 는 cmd.exe 가 먼저 확장합니다 (파서 이전 단계)', 'Argument ' + (i + 1) + ': %VAR% is expanded by cmd.exe before parsing')); });
      issues.push(t('Windows 에서 인수 분해는 프로그램이 직접 합니다. 이 결과는 CommandLineToArgvW(대부분의 C 런타임) 규칙입니다', 'On Windows each program splits its own command line; this follows CommandLineToArgvW (most C runtimes)'));
      return { _status: t('✅ 인수 ' + args.length + '개로 분해했습니다', '✅ Split into ' + args.length + ' argument(s)'), table: { head: [['#', '#'], ['인수', 'Argument'], ['길이', 'Length']], rows: args.map(function (a, i) { return [String(i), a === '' ? t('(빈 문자열)', '(empty string)') : a, String(a.length)]; }) }, out: JSON.stringify(args, null, 2), issues: issues };
    }
    var toks = [], i = 0, L = s.length;
    function readWord() {
      var val = '', raw = '', f = { unqVar: false, qVar: false, glob: false, sub: false, tilde: false, quoted: false }, startI = i;
      while (i < L) {
        var c = s[i];
        if (/\s/.test(c)) break;
        if (/[|&;<>()]/.test(c)) break;
        if (c === '\\') { if (s[i + 1] === '\n') { i += 2; continue; } raw += c + (s[i + 1] || ''); val += s[i + 1] || ''; f.quoted = true; i += 2; continue; }
        if (c === "'") { var j = s.indexOf("'", i + 1); if (j < 0) throw new Error(t('작은따옴표가 닫히지 않았습니다 (위치 ' + (i + 1) + ')', 'Unclosed single quote (position ' + (i + 1) + ')')); raw += s.slice(i, j + 1); val += s.slice(i + 1, j); f.quoted = true; i = j + 1; continue; }
        if (c === '$' && s[i + 1] === "'") { var k = i + 2; while (k < L && s[k] !== "'") { if (s[k] === '\\') k++; k++; } if (k >= L) throw new Error(t('$\'…\' 가 닫히지 않았습니다', 'Unclosed $\'…\'')); raw += s.slice(i, k + 1); val += s.slice(i + 2, k).replace(/\\(n|t|r|\\|'|")/g, function (m, ch) { return { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' }[ch]; }); f.quoted = true; i = k + 1; continue; }
        if (c === '"') {
          var d = i + 1, inner = '';
          while (d < L && s[d] !== '"') {
            if (s[d] === '\\' && /[\\"$`\n]/.test(s[d + 1] || '')) { if (s[d + 1] !== '\n') inner += s[d + 1]; d += 2; continue; }
            if (s[d] === '$' && s[d + 1] === '(') { var dep = 0, e = d + 1; do { if (s[e] === '(') dep++; if (s[e] === ')') dep--; e++; } while (e < L && dep > 0); inner += s.slice(d, e); f.sub = true; d = e; continue; }
            if (s[d] === '`') { var e2 = s.indexOf('`', d + 1); if (e2 < 0) throw new Error(t('백틱이 닫히지 않았습니다', 'Unclosed backtick')); inner += s.slice(d, e2 + 1); f.sub = true; d = e2 + 1; continue; }
            if (s[d] === '$' && /[A-Za-z_{@*#?0-9]/.test(s[d + 1] || '')) f.qVar = true;
            inner += s[d]; d++;
          }
          if (d >= L) throw new Error(t('큰따옴표가 닫히지 않았습니다 (위치 ' + (i + 1) + ')', 'Unclosed double quote (position ' + (i + 1) + ')'));
          raw += s.slice(i, d + 1); val += inner; f.quoted = true; i = d + 1; continue;
        }
        if (c === '$' && s[i + 1] === '(') { var dep2 = 0, e3 = i + 1; do { if (s[e3] === '(') dep2++; if (s[e3] === ')') dep2--; e3++; } while (e3 < L && dep2 > 0); raw += s.slice(i, e3); val += s.slice(i, e3); f.sub = true; f.unqVar = true; i = e3; continue; }
        if (c === '`') { var e4 = s.indexOf('`', i + 1); if (e4 < 0) throw new Error(t('백틱이 닫히지 않았습니다', 'Unclosed backtick')); raw += s.slice(i, e4 + 1); val += s.slice(i, e4 + 1); f.sub = true; f.unqVar = true; i = e4 + 1; continue; }
        if (c === '$' && /[A-Za-z_{@*#?0-9]/.test(s[i + 1] || '')) f.unqVar = true;
        if (/[*?\[]/.test(c)) f.glob = true;
        if (c === '~' && i === startI) f.tilde = true;
        raw += c; val += c; i++;
      }
      return { type: 'word', value: val, raw: raw, f: f };
    }
    while (i < L) {
      var ch = s[i];
      if (ch === '\\' && s[i + 1] === '\n') { i += 2; continue; }
      if (/\s/.test(ch)) { if (ch === '\n') toks.push({ type: 'op', value: ';' , nl: true }); i++; continue; }
      if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) { while (i < L && s[i] !== '\n') i++; continue; }
      var opm = /^(&>>|&>|\|&|\|\||&&|;;|>>|[<>]&(?:\d+|-)|>&|<<<|<<-|<<|<&|<>|>\||\||&|;|>|<|\(|\))/.exec(s.slice(i));
      if (opm) { toks.push({ type: 'op', value: opm[1] }); i += opm[1].length; continue; }
      var w = readWord();
      if (/^\d+$/.test(w.value) && /^[<>]/.test(s[i] || '')) { var m2 = /^(>>|[<>]&(?:\d+|-)|>&|>\||<<<|<<|<&|<>|>|<)/.exec(s.slice(i)); toks.push({ type: 'op', value: w.value + m2[1] }); i += m2[1].length; continue; }
      toks.push(w);
    }
    var cmds = [], cur2 = { env: [], argv: [], redirs: [], flags: [] }, CTRL = { '|': 1, '||': 1, '&&': 1, ';': 1, '&': 1, '|&': 1, ';;': 1 }, REDIR = /^(\d*)(>>|>&|>\||<<<|<<-|<<|<&|<>|>|<)$|^&>>?$/;
    function push(sep) { if (cur2.argv.length || cur2.env.length || cur2.redirs.length) { cur2.sep = sep || ''; cmds.push(cur2); } cur2 = { env: [], argv: [], redirs: [], flags: [] }; }
    for (var ti = 0; ti < toks.length; ti++) {
      var tk = toks[ti];
      if (tk.type === 'op') {
        if (CTRL[tk.value]) { push(tk.nl ? '' : tk.value); continue; }
        if (tk.value === '(' || tk.value === ')') { cur2.flags.push('subshell'); continue; }
        if (/^\d*[<>]&(?:\d+|-)$/.test(tk.value)) { cur2.redirs.push([tk.value, '']); continue; }
        if (REDIR.test(tk.value)) { var tg = toks[ti + 1]; if (tg && tg.type === 'word') { cur2.redirs.push([tk.value, tg.raw]); ti++; } else throw new Error(t('리디렉션 ' + tk.value + ' 뒤에 대상이 없습니다', 'No target after redirection ' + tk.value)); continue; }
        continue;
      }
      if (!cur2.argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tk.raw)) { var eq = tk.value.indexOf('='); cur2.env.push([tk.value.slice(0, eq), tk.value.slice(eq + 1)]); continue; }
      cur2.argv.push(tk);
    }
    push('');
    if (!cmds.length) throw new Error(t('해석할 명령이 없습니다', 'No command found'));
    var rows3 = [], json = [];
    var SEPN = { '|': t('파이프 (출력 → 다음 입력)', 'pipe (stdout → next stdin)'), '|&': t('파이프 (stdout+stderr)', 'pipe (stdout + stderr)'), '&&': t('앞이 성공하면 다음 실행', 'run next only if this succeeds'), '||': t('앞이 실패하면 다음 실행', 'run next only if this fails'), ';': t('순서대로 (결과 무관)', 'sequentially (regardless)'), '&': t('백그라운드 실행', 'run in the background'), '': '—' };
    var RN = { '>': t('덮어쓰기', 'overwrite'), '>>': t('이어쓰기', 'append'), '<': t('입력 파일', 'input file'), '2>': t('stderr → 파일', 'stderr → file'), '2>&1': t('stderr → stdout', 'stderr → stdout'), '1>&2': t('stdout → stderr', 'stdout → stderr'), '>&2': t('stdout → stderr', 'stdout → stderr'), '2>&-': t('stderr 닫기', 'close stderr'), '&>': t('stdout+stderr → 파일', 'stdout+stderr → file'), '<<': 'here-doc', '<<<': 'here-string', '1>': 'stdout → file' };
    cmds.forEach(function (c, idx) {
      var prog = c.argv[0] ? c.argv[0].value : '';
      var argvVals = c.argv.map(function (a) { return a.value; });
      json.push({ env: c.env.reduce(function (a, e) { a[e[0]] = e[1]; return a; }, {}), argv: argvVals, redirects: c.redirs.map(function (r) { return r[0] + ' ' + r[1]; }), next: c.sep || null });
      rows3.push([String(idx + 1), prog || t('(변수 지정만)', '(assignments only)'), c.argv.slice(1).map(function (a) { return a.value === '' ? '""' : a.value; }).join(' ⏐ ') || '—', c.env.map(function (e) { return e[0] + '=' + e[1]; }).join(', ') || '—', c.redirs.map(function (r) { return r[0] + ' ' + r[1] + ' (' + (RN[r[0]] || '') + ')'; }).join(', ') || '—', SEPN[c.sep] || c.sep]);
      c.argv.forEach(function (a) {
        if (a.f.unqVar) issues.push(t('따옴표 없는 변수/명령 치환: ' + a.raw + ' — 공백이 있으면 여러 인수로 쪼개지고 *, ? 는 파일명으로 확장됩니다. "…" 로 감싸세요', 'Unquoted expansion: ' + a.raw + ' — spaces split it into several arguments and */? expand to filenames. Wrap it in "…"'));
        if (a.f.glob && !a.f.quoted) issues.push(t('와일드카드 ' + a.raw + ' 는 셸이 파일 목록으로 확장합니다 (일치 없으면 그대로 전달)', 'The wildcard ' + a.raw + ' is expanded by the shell into file names (passed literally if nothing matches)'));
        if (a.f.tilde) issues.push(t(a.raw + ' 의 ~ 는 셸이 홈 디렉터리로 확장합니다', 'The ~ in ' + a.raw + ' is expanded to the home directory by the shell'));
        if (a.f.sub) issues.push(t('명령 치환 ' + a.raw + ' — 안쪽 명령이 먼저 실행됩니다 (백틱보다 $(…) 권장)', 'Command substitution ' + a.raw + ' — the inner command runs first (prefer $(…) over backticks)'));
      });
      if (/^(sudo|doas)$/.test(prog)) issues.push(t('sudo: 이후 명령이 root 권한으로 실행됩니다', 'sudo: the following command runs as root'));
      if (prog === 'eval') issues.push(t('🚨 eval 은 문자열을 다시 셸 코드로 실행합니다 — 입력을 신뢰할 수 없다면 위험합니다', '🚨 eval re-executes a string as shell code — dangerous with untrusted input'));
      if (prog === 'rm' && argvVals.some(function (a) { return /^-[a-zA-Z]*[rR]/.test(a) || a === '--recursive'; })) issues.push(t('🚨 rm 재귀 삭제: 대상 경로를 다시 확인하세요' + (c.argv.some(function (a) { return a.f.unqVar; }) ? ' — 변수가 비어 있으면 의도치 않은 경로(/ 등)를 지울 수 있습니다' : ''), '🚨 Recursive rm: double-check the target' + (c.argv.some(function (a) { return a.f.unqVar; }) ? ' — an empty variable could delete an unintended path such as /' : '')));
      if (prog === 'chmod' && argvVals.some(function (a) { return /^(0?777|a\+rwx|ugo\+rwx)$/.test(a); })) issues.push(t('chmod 777 은 모든 사용자에게 읽기·쓰기·실행을 허용합니다', 'chmod 777 gives everyone read, write and execute'));
      if (c.redirs.some(function (r) { return r[0] === '>'; })) issues.push(t('> 는 대상 파일을 먼저 비운 뒤 씁니다 — 기존 내용을 지키려면 >> 를 쓰세요', '> truncates the target first — use >> to keep existing content'));
    });
    cmds.forEach(function (c, idx) { if (c.sep === '|' && idx + 1 < cmds.length) { var nx = cmds[idx + 1].argv[0] ? cmds[idx + 1].argv[0].value : ''; if (/^(sh|bash|zsh|dash|ksh|python3?|perl|ruby|node)$/.test(nx) && /^(curl|wget|fetch)$/.test(c.argv[0] ? c.argv[0].value : '')) issues.push(t('🚨 내려받은 스크립트를 바로 실행(curl | sh)합니다 — 내용을 먼저 확인하세요', '🚨 Piping a download straight into a shell (curl | sh) — inspect the script first')); } });
    var rs = s.match(/2>&1\s*>\s*\S+/); if (rs) issues.push(t('"2>&1 > 파일" 은 순서가 반대입니다 — stderr 가 파일이 아닌 터미널로 갑니다. "> 파일 2>&1" 로 쓰세요', '"2>&1 > file" is the wrong order — stderr still goes to the terminal. Write "> file 2>&1"'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: uniq.some(function (x) { return /^🚨/.test(x); }) ? { ok: 'info', msg: t('🔍 명령 ' + cmds.length + '개 · 위험 항목 포함', '🔍 ' + cmds.length + ' command(s) · risky items found') } : t('✅ 명령 ' + cmds.length + '개로 분해했습니다', '✅ Parsed into ' + cmds.length + ' command(s)'), table: { head: [['#', '#'], ['프로그램', 'Program'], ['인수 (⏐ 로 구분)', 'Arguments (separated by ⏐)'], ['앞에 붙은 환경 변수', 'Leading env vars'], ['리디렉션', 'Redirections'], ['다음 연결', 'Then']], rows: rows3 }, out: JSON.stringify(json, null, 2), issues: uniq };
  }
});
