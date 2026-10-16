TK.tool('git-diff-viewer', {
  inputs: [{ id: 'patch', label: ['git diff / 패치 (unified diff)', 'git diff / patch (unified diff)'], rows: 14, sample: 'diff --git a/src/app.js b/src/app.js\nindex 3b18e51..a9c2d4f 100644\n--- a/src/app.js\n+++ b/src/app.js\n@@ -1,5 +1,7 @@\n const express = require(\'express\');\n+const helmet = require(\'helmet\');\n const app = express();\n-app.listen(3000);\n+app.use(helmet());\n+app.listen(process.env.PORT || 3000);\n \n module.exports = app;\ndiff --git a/old-name.txt b/docs/new-name.txt\nsimilarity index 92%\nrename from old-name.txt\nrename to docs/new-name.txt\nindex 1111111..2222222 100644\n--- a/old-name.txt\n+++ b/docs/new-name.txt\n@@ -1,2 +1,2 @@\n hello\n-world\n+WooaDev\ndiff --git a/logo.png b/logo.png\nnew file mode 100644\nBinary files /dev/null and b/logo.png differ\n' }],
  options: [
    { id: 'view', type: 'select', label: ['표시', 'View'], choices: [['full', ['전체 (주변 줄 포함)', 'Full (with context)']], ['changes', ['변경된 줄만', 'Changed lines only']]], default: 'full' },
    { id: 'file', type: 'text', label: ['파일 필터 (경로 일부, 선택)', 'File filter (part of the path, optional)'], default: '' }
  ],
  outputs: [{ id: 'table', label: ['파일별 요약', 'Per-file summary'], kind: 'table' }, { id: 'diff', label: ['변경 내용', 'Changes'], kind: 'diff' }, { id: 'stat', label: ['git diff --stat 형식', 'git diff --stat format'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.patch).replace(/\r\n/g, '\n').split('\n'), files = [], cur = null, hunk = null, issues = [], i;
    function start(a, b) { cur = { a: a, b: b, status: 'modified', add: 0, del: 0, hunks: 0, binary: false, rows: [], mode: '' }; files.push(cur); hunk = null; }
    function closeHunk() { if (hunk && (hunk.oldSeen !== hunk.oldN || hunk.newSeen !== hunk.newN)) issues.push(t('🚨 ' + (cur.b || cur.a) + ' 의 헝크 "' + hunk.head + '" 줄 수가 맞지 않습니다 (선언 -' + hunk.oldN + ' +' + hunk.newN + ', 실제 -' + hunk.oldSeen + ' +' + hunk.newSeen + ') — 패치가 잘렸거나 수정되었을 수 있습니다', '🚨 Hunk "' + hunk.head + '" of ' + (cur.b || cur.a) + ' has the wrong line count (declared -' + hunk.oldN + ' +' + hunk.newN + ', actual -' + hunk.oldSeen + ' +' + hunk.newSeen + ') — the patch may be truncated or edited')); hunk = null; }
    for (i = 0; i < lines.length; i++) {
      var l = lines[i], m;
      if ((m = /^diff --git (?:"?a\/)(.+?)"? (?:"?b\/)(.+?)"?$/.exec(l))) { closeHunk(); start(m[1], m[2]); continue; }
      if (hunk && (/^[ +\-\\]/.test(l) || (l === '' && i < lines.length - 1 && (hunk.oldSeen < hunk.oldN || hunk.newSeen < hunk.newN)))) {
        if (l[0] === '\\') { cur.rows.push([' ', l.slice(0)]); continue; }
        var sign = l === '' ? ' ' : l[0], text = l.slice(1);
        if (sign === '+') { cur.add++; hunk.newSeen++; cur.rows.push(['+', pad(null, hunk.nl) + ' ' + pad(hunk.nl, hunk.nl) + ' ' + text]); hunk.nl++; }
        else if (sign === '-') { cur.del++; hunk.oldSeen++; cur.rows.push(['-', pad(hunk.ol, hunk.ol) + ' ' + pad(null) + ' ' + text]); hunk.ol++; }
        else { hunk.oldSeen++; hunk.newSeen++; cur.rows.push([' ', pad(hunk.ol, hunk.ol) + ' ' + pad(hunk.nl, hunk.nl) + ' ' + text]); hunk.ol++; hunk.nl++; }
        continue;
      }
      if ((m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(l))) {
        closeHunk(); if (!cur) start('(patch)', '(patch)');
        hunk = { ol: +m[1], nl: +m[3], oldN: m[2] === undefined ? 1 : +m[2], newN: m[4] === undefined ? 1 : +m[4], oldSeen: 0, newSeen: 0, head: l.trim() }; cur.hunks++;
        cur.rows.push([' ', '@@ ' + t('줄 ', 'lines ') + '-' + m[1] + (m[2] ? ',' + m[2] : '') + ' +' + m[3] + (m[4] ? ',' + m[4] : '') + ' @@' + m[5]]); continue;
      }
      if (/^--- /.test(l) && !hunk) { if (!cur || cur.hunks || cur.sawOld) { closeHunk(); start(l.slice(4).replace(/^a\//, '').split('\t')[0], ''); } cur.sawOld = true; if (/\/dev\/null/.test(l)) cur.status = 'added'; else cur.a = l.slice(4).replace(/^a\//, '').split('\t')[0]; continue; }
      if (/^\+\+\+ /.test(l) && !hunk) { if (!cur) start('', ''); var nb = l.slice(4).replace(/^b\//, '').split('\t')[0]; if (/\/dev\/null/.test(l)) cur.status = 'deleted'; else cur.b = nb; continue; }
      if (!cur) continue;
      if (/^new file mode/.test(l)) { cur.status = 'added'; cur.mode = l.slice(14); }
      else if (/^deleted file mode/.test(l)) cur.status = 'deleted';
      else if ((m = /^rename from (.+)/.exec(l))) { cur.status = 'renamed'; cur.a = m[1]; }
      else if ((m = /^rename to (.+)/.exec(l))) { cur.status = 'renamed'; cur.b = m[1]; }
      else if (/^copy (from|to) /.test(l)) cur.status = 'copied';
      else if ((m = /^similarity index (\d+)%/.exec(l))) cur.sim = m[1];
      else if ((m = /^old mode (\d+)/.exec(l))) cur.oldMode = m[1];
      else if ((m = /^new mode (\d+)/.exec(l))) { cur.modeChange = (cur.oldMode || '?') + ' → ' + m[1]; if (cur.status === 'modified') cur.status = 'mode'; }
      else if (/^(Binary files|GIT binary patch)/.test(l)) { cur.binary = true; if (/\/dev\/null and/.test(l)) cur.status = 'added'; else if (/ and \/dev\/null/.test(l)) cur.status = 'deleted'; }
    }
    closeHunk();
    files = files.filter(function (f) { return f.hunks || f.binary || f.status !== 'modified' || f.a || f.b; });
    if (!files.length) throw new Error(t('unified diff 형식의 변경 내용을 찾을 수 없습니다 (diff --git 또는 @@ 로 시작하는 헝크)', 'No unified diff found (expecting diff --git or @@ hunks)'));
    function pad(n, nl) { var s = n == null ? '' : String(n); return ('     ' + s).slice(-4); }
    var ST = { modified: ['M', '수정', 'modified'], added: ['A', '추가', 'added'], deleted: ['D', '삭제', 'deleted'], renamed: ['R', '이름 변경', 'renamed'], copied: ['C', '복사', 'copied'], mode: ['M', '권한 변경', 'mode change'] };
    var flt = String(o.file || '').trim().toLowerCase();
    var shown = files.filter(function (f) { return !flt || ((f.a || '') + ' ' + (f.b || '')).toLowerCase().indexOf(flt) >= 0; });
    var rows = [], diff = [], stat = [], tAdd = 0, tDel = 0, w = 0;
    shown.forEach(function (f) { var nm = f.status === 'renamed' ? f.a + ' → ' + f.b : (f.b || f.a); w = Math.max(w, nm.length); });
    shown.forEach(function (f) {
      var st = ST[f.status] || ST.modified, name = f.status === 'renamed' ? f.a + ' → ' + f.b : (f.b || f.a);
      tAdd += f.add; tDel += f.del;
      rows.push([name, st[0] + ' ' + t(st[1], st[2]) + (f.sim ? ' (' + f.sim + '%)' : ''), f.binary ? t('바이너리', 'binary') : '+' + f.add, f.binary ? '' : '−' + f.del, String(f.hunks)]);
      stat.push(' ' + name + ' '.repeat(Math.max(0, w - name.length)) + ' | ' + (f.binary ? 'Bin' : String(f.add + f.del).padStart(4) + ' ' + '+'.repeat(Math.min(f.add, 30)) + '-'.repeat(Math.min(f.del, 30))));
      diff.push([' ', '━━━━ ' + name + ' (' + t(st[1], st[2]) + (f.modeChange ? ', mode ' + f.modeChange : '') + ') ━━━━']);
      if (f.binary) diff.push([' ', t('(바이너리 파일 — 내용을 표시할 수 없습니다)', '(binary file — content cannot be shown)')]);
      f.rows.forEach(function (r) { if (o.view === 'changes' && r[0] === ' ' && !/^@@/.test(r[1])) return; diff.push(r); });
    });
    if (!shown.length) throw new Error(t('필터와 일치하는 파일이 없습니다', 'No file matches the filter'));
    stat.push(' ' + shown.length + t(' files changed, ', ' files changed, ') + tAdd + ' insertions(+), ' + tDel + ' deletions(-)');
    if (files.some(function (f) { return /(^|\/)\.env|id_rsa|\.pem$|secret|credentials/i.test(f.b || f.a); })) issues.push(t('🚨 비밀 정보로 보이는 파일(.env, 키, credentials 등)이 변경에 포함되어 있습니다 — 커밋·공유 전에 확인하세요', '🚨 The change includes files that look secret (.env, keys, credentials …) — check before committing or sharing'));
    if (tAdd + tDel > 1000) issues.push(t('변경이 ' + (tAdd + tDel).toLocaleString() + '줄로 큽니다 — 리뷰하기 쉽도록 나누는 것을 고려하세요', 'The change is ' + (tAdd + tDel).toLocaleString() + ' lines — consider splitting it for easier review'));
    if (/^[ ]+\n/.test(String(v.patch)) || / +$/m.test(files.map(function (f) { return f.rows.filter(function (r) { return r[0] === '+'; }).map(function (r) { return r[1]; }).join('\n'); }).join('\n'))) issues.push(t('추가된 줄 끝에 공백이 있습니다 (git diff --check 로 확인 가능)', 'Added lines end with whitespace (see git diff --check)'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: 'info', msg: t('🔍 ' + shown.length + '개 파일 · +' + tAdd + ' −' + tDel + ' · 확인할 항목 ' + bad + '개', '🔍 ' + shown.length + ' file(s) · +' + tAdd + ' −' + tDel + ' · ' + bad + ' item(s) to check') } : t('✅ ' + shown.length + '개 파일 · +' + tAdd + ' −' + tDel, '✅ ' + shown.length + ' file(s) · +' + tAdd + ' −' + tDel), table: { head: [['파일', 'File'], ['상태', 'Status'], ['추가', 'Added'], ['삭제', 'Removed'], ['헝크', 'Hunks']], rows: rows }, diff: diff, stat: stat.join('\n'), issues: issues };
  }
});
