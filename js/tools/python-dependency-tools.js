TK.tool('python-dependency-tools', {
  inputs: [{ id: 'in', label: ['requirements.txt (또는 pyproject 의 dependencies 줄)', 'requirements.txt (or dependency lines from pyproject)'], rows: 14, sample: '# 웹\nDjango>=4.2,<5.0\nrequests[security]==2.31.0\nPyYAML\nnumpy~=1.26\nuvicorn[standard] ; python_version >= "3.9"\nflask==2.3.*\n-r dev-requirements.txt\n-e .\ngit+https://github.com/org/private-lib.git@v1.2#egg=private_lib\nsome_pkg==1.0 --hash=sha256:abc123\nrequests>=2.0\nPillow' }],
  options: [{ id: 'fmt', type: 'select', label: ['출력', 'Output'], choices: [['pyproject', 'pyproject.toml [project] dependencies'], ['req', ['정리된 requirements.txt', 'Tidied requirements.txt']], ['pipfile', 'Pipfile [packages]'], ['poetry', 'Poetry [tool.poetry.dependencies]']], default: 'pyproject' }],
  sampleExpectError: false,
  outputs: [{ id: 'table', label: ['분석', 'Analysis'], kind: 'table' }, { id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.in).replace(/\r/g, '').split('\n'), reqs = [], opts = [], issues = [], rows = [];
    var buf = ''; var joined = []; lines.forEach(function (l) { if (/\\\s*$/.test(l)) buf += l.replace(/\\\s*$/, ' '); else { joined.push(buf + l); buf = ''; } }); if (buf) joined.push(buf);
    function canon(n) { return n.toLowerCase().replace(/[-_.]+/g, '-'); }
    joined.forEach(function (raw, idx) {
      var s = raw.replace(/\s+#.*$/, '').replace(/^#.*$/, '').trim(); if (!s) return;
      if (/^-[rcf]\s|^--(requirement|constraint|index-url|extra-index-url|find-links|trusted-host|no-binary|only-binary|pre|prefer-binary)/.test(s) || /^-i\s/.test(s)) { opts.push(s); rows.push([s.slice(0, 60), '⚙️', t('pip 옵션', 'pip option'), '', '']); return; }
      if (/^-e\s|^--editable/.test(s)) { opts.push(s); rows.push([s, '✏️', t('편집 가능 설치', 'editable install'), '', '']); issues.push(t('-e 항목은 pyproject 등으로 옮길 수 없는 로컬 개발용 설치입니다: ' + s, '-e entries are local development installs that cannot move into pyproject: ' + s)); return; }
      var hashes = (s.match(/--hash=\S+/g) || []).length; s = s.replace(/\s+--hash=\S+/g, '').trim();
      var marker = ''; var mi = s.indexOf(';'); if (mi >= 0) { marker = s.slice(mi + 1).trim(); s = s.slice(0, mi).trim(); }
      var vcs = /^(git\+|hg\+|svn\+|bzr\+)|:\/\//.test(s) || /\s@\s/.test(s);
      if (vcs) { var em = /#egg=([\w.\-]+)/.exec(s) || /^([\w.\-]+)\s*@/.exec(s); reqs.push({ name: em ? em[1] : '?', vcs: s, marker: marker, extras: [], spec: '' }); rows.push([em ? em[1] : '?', canon(em ? em[1] : '?'), 'VCS/URL', s.slice(0, 50), marker]); issues.push(t('VCS/URL 의존성은 PyPI 배포 패키지의 install_requires 로 쓸 수 없고 재현성이 낮습니다: ' + s.slice(0, 50), 'VCS / URL dependencies cannot be used in published packages and are less reproducible: ' + s.slice(0, 50))); return; }
      var m = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[([^\]]*)\])?\s*(\(?\s*(?:(?:===|==|!=|~=|<=|>=|<|>)\s*[\w.*+!-]+\s*,?\s*)*\)?)\s*$/.exec(s);
      if (!m) { rows.push([s.slice(0, 50), '❌', t('PEP 508 형식이 아닙니다', 'Not PEP 508'), '', '']); issues.push('🚨 ' + t((idx + 1) + '번째 줄을 해석할 수 없습니다: ' + s.slice(0, 40), 'Cannot parse line ' + (idx + 1) + ': ' + s.slice(0, 40))); return; }
      var spec = m[3].replace(/[()\s]/g, '').replace(/,$/, ''), extras = m[2] ? m[2].split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [];
      reqs.push({ name: m[1], extras: extras, spec: spec, marker: marker, hashes: hashes });
      var kind = !spec ? t('⚠️ 제한 없음', '⚠️ unpinned') : /^(===|==)[^*,]+$/.test(spec) ? t('정확히 고정', 'pinned') : /^==.*\*$/.test(spec) ? t('와일드카드 고정', 'wildcard pin') : /~=/.test(spec) ? t('호환 릴리스', 'compatible release') : /<|<=/.test(spec) && />=|>/.test(spec) ? t('범위', 'range') : />=|>/.test(spec) ? t('하한만', 'lower bound only') : t('범위', 'range');
      rows.push([m[1] + (extras.length ? '[' + extras.join(',') + ']' : ''), canon(m[1]), (spec || '—') + (marker ? '  ; ' + marker : ''), kind, hashes ? hashes + ' hash' : '']);
    });
    if (!reqs.length && !opts.length && !rows.length) throw new Error(t('의존성을 찾지 못했습니다', 'No dependencies found'));
    var seen = {}; reqs.forEach(function (r) { var k = canon(r.name); (seen[k] = seen[k] || []).push(r); });
    Object.keys(seen).forEach(function (k) { if (seen[k].length > 1) issues.push(t('중복: ' + k + ' (' + seen[k].map(function (r) { return r.spec || '제한 없음'; }).join(' / ') + ') — pip 는 충돌하는 지정자를 모두 만족해야 합니다', 'Duplicate: ' + k + ' (' + seen[k].map(function (r) { return r.spec || 'unpinned'; }).join(' / ') + ') — pip must satisfy every specifier')); });
    reqs.forEach(function (r) { if (r.name !== canon(r.name) && !/[A-Z]/.test(r.name) === false) { } });
    var unp = reqs.filter(function (r) { return !r.vcs && !r.spec; }).length, low = reqs.filter(function (r) { return r.spec && /^>=?[^,<]*$/.test(r.spec.replace(/,/g, '')) && !/<|==|~=/.test(r.spec); }).length;
    if (unp) issues.push(t(unp + '개 패키지에 버전 제한이 없습니다 — 새 메이저 버전으로 갑자기 깨질 수 있습니다 (>=x,<y 또는 ~= 권장)', unp + ' package(s) have no version limit — a new major release can break you suddenly (prefer >=x,<y or ~=)'));
    if (low) issues.push(t(low + '개 패키지가 하한(>=)만 있습니다 — 상한을 두거나 lock 파일(pip-tools, uv, poetry)로 고정하세요', low + ' package(s) have only a lower bound — add an upper bound or pin with a lock file (pip-tools, uv, poetry)'));
    if (reqs.some(function (r) { return r.hashes; }) && reqs.some(function (r) { return !r.hashes && !r.vcs; })) issues.push(t('--hash 가 일부에만 있습니다. pip 의 해시 검사 모드는 전부 해시가 있어야 합니다', '--hash is on only some entries; pip\'s hash-checking mode needs it on all of them'));
    if (reqs.some(function (r) { return /\*/.test(r.spec) && !/==|!=/.test(r.spec); })) issues.push('🚨 ' + t('* 와일드카드는 == / != 에서만 쓸 수 있습니다', 'The * wildcard is only valid with == / !='));
    var fmt = o.fmt, out;
    function reqStr(r) { return r.vcs ? r.name + ' @ ' + r.vcs.replace(/#egg=.*$/, '').replace(/^(?=git\+)/, '') : r.name + (r.extras.length ? '[' + r.extras.join(',') + ']' : '') + r.spec + (r.marker ? '; ' + r.marker : ''); }
    var norm = reqs.slice().sort(function (a, b) { return canon(a.name) < canon(b.name) ? -1 : 1; });
    if (fmt === 'req') out = opts.join('\n') + (opts.length ? '\n' : '') + norm.map(function (r) { return r.vcs ? r.vcs : reqStr(r); }).join('\n');
    else if (fmt === 'pyproject') out = '[project]\ndependencies = [\n' + norm.map(function (r) { return '    "' + reqStr(r).replace(/"/g, '\\"') + '",'; }).join('\n') + '\n]';
    else if (fmt === 'pipfile') out = '[packages]\n' + norm.filter(function (r) { return !r.vcs; }).map(function (r) { var sp = r.spec ? r.spec.replace(/,/g, ',') : '*'; return canon(r.name) + ' = ' + (r.extras.length ? '{version = "' + sp + '", extras = [' + r.extras.map(function (e) { return '"' + e + '"'; }).join(', ') + ']}' : '"' + sp + '"'); }).join('\n') + norm.filter(function (r) { return r.vcs; }).map(function (r) { return '\n' + canon(r.name) + ' = {git = "' + r.vcs.replace(/^git\+/, '').replace(/[@#].*$/, '') + '"}'; }).join('');
    else out = '[tool.poetry.dependencies]\npython = "^3.9"\n' + norm.filter(function (r) { return !r.vcs; }).map(function (r) { var sp = r.spec ? r.spec.replace(/^~=/, '~').replace(/^==/, '').replace(/,/g, ', ') : '*'; return canon(r.name) + ' = ' + (r.extras.length ? '{version = "' + sp + '", extras = [' + r.extras.map(function (e) { return '"' + e + '"'; }).join(', ') + ']}' : '"' + sp + '"'); }).join('\n');
    if (fmt === 'poetry') issues.push(t('Poetry 의 ^ / ~ 표기와 PEP 440 은 다릅니다. ~= 는 ~ 로 바꿨으니 확인하세요', 'Poetry\'s ^ / ~ differ from PEP 440; ~= was rewritten as ~, please verify'));
    if (reqs.some(function (r) { return r.name !== canon(r.name); })) issues.push(t('패키지 이름은 PEP 503 규칙으로 소문자·하이픈으로 정규화해 비교합니다 (Django = django, PyYAML = pyyaml, some_pkg = some-pkg)', 'Package names compare in PEP 503 normalised form: lowercase with hyphens (Django = django, some_pkg = some-pkg)'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    var bad = uniq.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 오류 ' + bad + '건', '❌ ' + bad + ' error(s)') } : t('✅ 패키지 ' + reqs.length + '개 · 옵션 ' + opts.length + '개', '✅ ' + reqs.length + ' package(s) · ' + opts.length + ' option(s)'), table: { head: [['패키지', 'Package'], ['정규화 이름', 'Normalised'], ['지정자 ; 마커', 'Specifier ; marker'], ['분류', 'Kind'], ['해시', 'Hashes']], rows: rows }, out: out, issues: uniq };
  }
});
