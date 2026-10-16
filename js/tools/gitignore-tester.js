TK.tool('gitignore-tester', {
  inputs: [
    { id: 'rules', label: ['.gitignore 내용', '.gitignore content'], rows: 9, sample: '# 빌드 산출물\nnode_modules/\ndist/\n*.log\n.env\n!.env.example\n/config/*.local\nbuild/**/*.map\n!important.log', placeholder: ['여러 .gitignore 를 합치지 말고 한 파일씩 테스트하세요', 'Test one .gitignore at a time'] },
    { id: 'paths', label: ['확인할 경로 (한 줄에 하나, 폴더는 끝에 /)', 'Paths to test (one per line, folders end with /)'], rows: 9, sample: 'node_modules/express/index.js\ndist/app.js\nsrc/debug.log\nimportant.log\n.env\n.env.example\nconfig/db.local\nconfig/sub/db.local\nbuild/js/main.js.map\nsrc/index.js' }
  ],
  options: [
    { id: 'icase', type: 'checkbox', label: ['대소문자 구분 안 함 (core.ignorecase)', 'Case-insensitive (core.ignorecase)'], default: false }
  ],
  outputs: [{ id: 'table', label: ['판정 결과', 'Results'], kind: 'table' }, { id: 'out', label: ['git check-ignore -v 형식', 'git check-ignore -v format'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.rules).replace(/\r/g, '').split('\n'), rules = [], issues = [];
    function conv(body, icase) {
      var re = '', i = 0;
      while (i < body.length) {
        var c = body[i];
        if (c === '*') {
          if (body[i + 1] === '*') {
            var before = i === 0 || body[i - 1] === '/', after = i + 2 >= body.length || body[i + 2] === '/';
            if (before && after) {
              if (i + 2 >= body.length) { re += '.*'; i += 2; continue; }       // 끝의 /** → 내부 전부
              re += '(?:.*/)?'; i += 3; continue;                                   // **/ → 0개 이상의 디렉터리
            }
            re += '[^/]*'; i += 2; continue;
          }
          re += '[^/]*'; i++;
        } else if (c === '?') { re += '[^/]'; i++; }
        else if (c === '[') {
          var j = i + 1, neg = false; if (body[j] === '!' || body[j] === '^') { neg = true; j++; }
          var k = j; if (body[k] === ']') k++;
          while (k < body.length && body[k] !== ']') k++;
          if (k >= body.length) { re += '\\['; i++; continue; }
          var cls = body.slice(j, k).replace(/\\/g, '\\\\').replace(/\^/g, '\\^');
          re += '[' + (neg ? '^' : '') + cls + ']'; i = k + 1;
        } else if (c === '\\' && i + 1 < body.length) { re += body[i + 1].replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); i += 2; }
        else { re += c.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); i++; }
      }
      return re;
    }
    lines.forEach(function (raw, idx) {
      var s = raw.replace(/(?<!\\)\s+$/, '');
      if (!s || s[0] === '#') return;
      var neg = false, dirOnly = false;
      if (s[0] === '!') { neg = true; s = s.slice(1); } else if (s.slice(0, 2) === '\\!' || s.slice(0, 2) === '\\#') s = s.slice(1);
      if (s.length > 1 && s.slice(-1) === '/') { dirOnly = true; s = s.slice(0, -1); }
      var anchored = s.indexOf('/') >= 0; if (s[0] === '/') s = s.slice(1);
      if (!s) return;
      var body = conv(s), re;
      try { re = new RegExp((anchored ? '^' : '(?:^|.*/)') + body + '$', o.icase ? 'i' : ''); } catch (e) { issues.push(t('줄 ' + (idx + 1) + ': 패턴을 해석할 수 없습니다 — ' + raw, 'Line ' + (idx + 1) + ': cannot parse pattern — ' + raw)); return; }
      rules.push({ line: idx + 1, text: raw.trim(), neg: neg, dirOnly: dirOnly, re: re });
      if (/\s/.test(s) && !/\\ /.test(s)) issues.push(t('줄 ' + (idx + 1) + ': 공백이 들어 있습니다 — 의도한 것인지 확인하세요', 'Line ' + (idx + 1) + ': contains a space — check that this is intended'));
    });
    if (!rules.length) throw new Error(t('유효한 규칙이 없습니다 (주석·빈 줄만 있습니다)', 'No valid rules (only comments / blank lines)'));
    function match(path, isDir) { var res = null; rules.forEach(function (r) { if (r.dirOnly && !isDir) return; if (r.re.test(path)) res = r; }); return res; }
    function test(raw) {
      var isDir = /\/$/.test(raw), path = raw.replace(/^\.?\//, '').replace(/\/+$/, ''), parts = path.split('/');
      for (var n = 1; n < parts.length; n++) {
        var par = parts.slice(0, n).join('/'), m = match(par, true);
        if (m && !m.neg) return { ignored: true, rule: m, via: par + '/' };
      }
      var f = match(path, isDir);
      if (f && !f.neg) return { ignored: true, rule: f };
      if (f && f.neg) return { ignored: false, rule: f };
      return { ignored: false, rule: null };
    }
    var paths = String(v.paths).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!paths.length) throw new Error(t('확인할 경로를 입력하세요', 'Enter paths to test'));
    var rows = [], out = [], nIgn = 0;
    paths.forEach(function (p) {
      var r = test(p), why;
      if (r.ignored) nIgn++;
      if (r.ignored && r.via) why = t('상위 폴더 ' + r.via + ' 가 무시되어 안의 파일은 모두 무시됩니다 (줄 ' + r.rule.line + ')', 'The parent folder ' + r.via + ' is ignored, so everything inside is ignored (line ' + r.rule.line + ')');
      else if (r.ignored) why = t('줄 ' + r.rule.line + ' 규칙과 일치', 'Matches the rule on line ' + r.rule.line);
      else if (r.rule) why = t('줄 ' + r.rule.line + ' 의 ! 규칙이 다시 포함시킴', 'Re-included by the ! rule on line ' + r.rule.line);
      else why = t('일치하는 규칙 없음 → 추적됨', 'No matching rule → tracked');
      rows.push([p, r.ignored ? '🚫 ' + t('무시됨', 'ignored') : '✅ ' + t('추적됨', 'tracked'), r.rule ? r.rule.line + ': ' + r.rule.text : '—', why]);
      out.push(r.ignored || r.rule ? '.gitignore:' + r.rule.line + ':' + r.rule.text + '\t' + p : '::\t' + p);
      if (r.rule && r.rule.neg && !r.ignored && /\/$/.test(p) === false) { /* noop */ }
    });
    rules.forEach(function (r) { if (r.neg) { var pre = r.text.slice(1).replace(/\/$/, ''); var par = pre.split('/').slice(0, -1).join('/'); if (par && match(par, true) && !match(par, true).neg) issues.push(t('줄 ' + r.line + ': ' + r.text + ' — 상위 폴더가 무시되어 있어 다시 포함할 수 없습니다 (Git 규칙)', 'Line ' + r.line + ': ' + r.text + ' — the parent folder is ignored, so this cannot re-include it (Git rule)')); } });
    issues.push(t('이미 커밋된 파일은 .gitignore 에 추가해도 계속 추적됩니다 — git rm --cached <파일> 로 추적을 해제하세요', 'Files already committed stay tracked even if added to .gitignore — use git rm --cached <file>'));
    issues.push(t('이 도구는 한 개의 .gitignore 만 평가합니다 (하위 폴더의 .gitignore, .git/info/exclude, 전역 ignore 는 반영하지 않습니다)', 'Only a single .gitignore is evaluated (nested .gitignore files, .git/info/exclude and the global ignore file are not applied)'));
    return { _status: t('✅ ' + paths.length + '개 중 ' + nIgn + '개가 무시됩니다', '✅ ' + nIgn + ' of ' + paths.length + ' path(s) are ignored'), table: { head: [['경로', 'Path'], ['결과', 'Result'], ['근거 규칙', 'Matching rule'], ['설명', 'Why']], rows: rows }, out: out.join('\n'), issues: issues };
  }
});
