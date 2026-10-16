TK.tool('shell-escape', {
  inputs: [{ id: 'in', label: ['이스케이프할 문자열 (한 줄 = 인수 하나, 줄바꿈 포함 인수는 아래 옵션 사용)', 'Strings to escape (one argument per line; use the option below for a single multi-line argument)'], rows: 6, sample: "It's a \"quoted\" $HOME `value`\nplain-word\nC:\\Program Files\\App\nhello world; rm -rf /\nsingle\\backslash" }],
  options: [
    { id: 'whole', type: 'checkbox', label: ['전체를 하나의 인수로 취급 (줄바꿈 포함)', 'Treat the whole text as one argument (keeps newlines)'], default: false },
    { id: 'cmd', type: 'text', label: ['명령어 앞부분 (선택, 예: echo)', 'Command prefix (optional, e.g. echo)'], default: 'echo' },
    { id: 'target', type: 'select', label: ['대상 셸', 'Target shell'], choices: [['all', ['모두 보기', 'Show all']], ['posix', 'POSIX sh / bash / zsh (\'…\')'], ['ansi', 'Bash $\'…\''], ['dq', 'POSIX "…"'], ['fish', 'fish'], ['pwsh', "PowerShell '…'"], ['pwshdq', 'PowerShell "…"'], ['cmd', 'cmd.exe'], ['json', 'JSON string']], default: 'all' }
  ],
  outputs: [{ id: 'out', label: ['이스케이프 결과', 'Escaped output'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['주의', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var raw = String(v.in).replace(/\r\n/g, '\n'), args = o.whole ? [raw.replace(/\n$/, '')] : raw.split('\n').filter(function (l, i, a) { return l !== '' || a.length === 1; });
    if (!args.length || (args.length === 1 && args[0] === '' && !o.whole)) throw new Error(t('문자열을 입력하세요', 'Enter a string'));
    var SAFE = /^[A-Za-z0-9_@%+=:,.\/-]+$/;
    function posix(s) { return s === '' ? "''" : SAFE.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'"; }
    function ansi(s) { if (SAFE.test(s) && s !== '') return s; return "$'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, function (c) { return '\\x' + ('0' + c.charCodeAt(0).toString(16)).slice(-2); }) + "'"; }
    function dq(s) { return '"' + s.replace(/([\\"$`])/g, '\\$1').replace(/!/g, '\\!') + '"'; }
    function fish(s) { return s === '' ? "''" : SAFE.test(s) ? s : "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
    function pwsh(s) { return "'" + s.replace(/[\u2018\u2019\u201a\u201b']/g, function (c) { return c + c; }) + "'"; }
    function pwshdq(s) { return '"' + s.replace(/[`"$\u201c\u201d\u201e]/g, function (c) { return '`' + c; }).replace(/\n/g, '`n').replace(/\r/g, '`r').replace(/\t/g, '`t') + '"'; }
    function cmdx(s) { if (s === '') return '""'; if (SAFE.test(s)) return s; return '"' + s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1').replace(/%/g, '"^%"').replace(/([&|<>^()!])/g, '^$1') + '"'; }
    var F = { posix: ['POSIX sh / bash / zsh', posix], ansi: ["Bash $'…'", ansi], dq: ['POSIX "…"', dq], fish: ['fish', fish], pwsh: ["PowerShell '…'", pwsh], pwshdq: ['PowerShell "…"', pwshdq], cmd: ['cmd.exe', cmdx], json: ['JSON', function (s) { return JSON.stringify(s); }] };
    var keys = o.target === 'all' ? ['posix', 'ansi', 'dq', 'fish', 'pwsh', 'pwshdq', 'cmd', 'json'] : [o.target], out = [], issues = [], pre = (o.cmd || '').trim();
    keys.forEach(function (k) {
      var f = F[k][1];
      out.push('# ' + F[k][0]);
      args.forEach(function (a) { out.push(pre ? pre + ' ' + f(a) : f(a)); });
      out.push('');
    });
    if (args.some(function (a) { return a.indexOf('\0') >= 0; })) issues.push(t('🚨 NUL(\\0) 문자는 어떤 셸의 인수로도 전달할 수 없습니다', '🚨 A NUL (\\0) character cannot be passed as an argument in any shell'));
    if (args.some(function (a) { return /\n/.test(a); })) issues.push(t('줄바꿈이 있는 인수는 POSIX \'…\' 와 $\'…\' 에서만 안전하게 표현됩니다. cmd.exe 는 줄바꿈을 인수에 넣을 수 없습니다', 'Arguments with newlines are safe only in POSIX \'…\' and $\'…\'. cmd.exe cannot hold a newline in an argument'));
    if (args.some(function (a) { return /[`$!\\]/.test(a); }) && keys.indexOf('dq') >= 0) issues.push(t('큰따옴표 안에서는 $ ` \\ " ! 가 특수하게 해석됩니다 — 변수 치환을 원하지 않으면 작은따옴표 방식을 쓰세요', 'Inside double quotes $ ` \\ " ! are still special — prefer the single-quote form when you do not want expansion'));
    issues.push(t('이스케이프는 "문자열을 하나의 인수로 안전하게 전달"하는 용도입니다. 사용자 입력으로 셸 명령 문자열을 조립하는 대신, exec 계열 API 에 인수 배열을 넘기세요 (shell=False)', 'Escaping makes a string a single safe argument. Never build shell command strings from user input — pass an argument array to an exec-style API (shell=False)'));
    issues.push(t('cmd.exe 의 규칙은 프로그램마다 다릅니다(CommandLineToArgvW 기준). % 와 ^ 처리는 .bat 파일 안/밖에서 달라질 수 있습니다', 'cmd.exe rules vary by program (CommandLineToArgvW). % and ^ behave differently inside and outside .bat files'));
    return { _status: t('✅ 인수 ' + args.length + '개를 이스케이프했습니다', '✅ Escaped ' + args.length + ' argument(s)'), out: out.join('\n').trim(), issues: issues };
  }
});
