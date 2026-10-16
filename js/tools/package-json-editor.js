TK.tool('package-json-editor', {
  inputs: [{ id: 'in', label: ['package.json', 'package.json'], rows: 16, sample: '{\n  "name": "My App",\n  "version": "1.0",\n  "main": "index.js",\n  "scripts": { "start": "node index.js", "test": "echo \\"Error: no test specified\\" && exit 1", "postinstall": "node setup.js" },\n  "dependencies": { "express": "^4.18.2", "lodash": "*", "left-pad": "latest", "react": "18.2.0", "mylib": "git+https://github.com/me/mylib.git" },\n  "devDependencies": { "express": "^4.17.0", "jest": "~29.7.0", "typescript": ">=5 <6" },\n  "engines": { "node": ">=18" },\n  "license": "MIT License"\n}' }],
  sampleExpectError: true,
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['check', ['검사', 'Check']], ['sort', ['정리(키·의존성 정렬)', 'Tidy (sort keys & dependencies)']]], default: 'check' }
  ],
  outputs: [{ id: 'table', label: ['의존성', 'Dependencies'], kind: 'table' }, { id: 'out', label: ['정리된 package.json', 'Tidied package.json'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['검사 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var pkg; try { pkg = JSON.parse(v.in); } catch (e) { throw new Error(t('JSON 형식 오류: ' + e.message, 'Invalid JSON: ' + e.message)); }
    if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error(t('최상위가 객체여야 합니다', 'The top level must be an object'));
    var issues = [], rows = [];
    function err(s) { issues.push('🚨 ' + s); }
    var name = pkg.name;
    if (name === undefined) { if (!pkg.private) issues.push(t('name 이 없습니다 (private 이 아니면 게시할 수 없음)', 'No name (needed unless the package is private)')); }
    else if (typeof name !== 'string') err(t('name 은 문자열이어야 합니다', 'name must be a string'));
    else {
      if (name.length > 214) err(t('name 이 214자를 넘습니다', 'name is longer than 214 characters'));
      if (!/^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) err(t('name "' + name + '" 은 소문자·숫자·-·_·. 만 가능하고 공백·대문자는 안 됩니다 (스코프는 @scope/이름)', 'name "' + name + '" must be lowercase letters, digits, - _ . with no spaces (scopes as @scope/name)'));
      if (/^[._]/.test(name)) err(t('name 이 . 또는 _ 로 시작할 수 없습니다', 'name cannot start with . or _'));
    }
    var SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
    if (pkg.version === undefined) { if (!pkg.private) issues.push(t('version 이 없습니다', 'No version')); }
    else if (typeof pkg.version !== 'string' || !SEMVER.test(pkg.version)) err(t('version "' + pkg.version + '" 이 SemVer(X.Y.Z)가 아닙니다', 'version "' + pkg.version + '" is not SemVer (X.Y.Z)'));
    if (pkg.license !== undefined) { if (typeof pkg.license !== 'string') issues.push(t('license 는 SPDX 식별자 문자열을 권장합니다', 'license should be an SPDX identifier string')); else if (!/^(\(?[A-Za-z0-9.+-]+( (AND|OR|WITH) [A-Za-z0-9.+-]+)*\)?|UNLICENSED|SEE LICENSE IN .+)$/.test(pkg.license)) issues.push(t('license "' + pkg.license + '" 은 SPDX 식별자가 아닙니다 (예: MIT, Apache-2.0, ISC)', 'license "' + pkg.license + '" is not an SPDX identifier (e.g. MIT, Apache-2.0, ISC)')); } else if (!pkg.private) issues.push(t('license 가 없습니다', 'No license'));
    if (pkg.main && pkg.exports) issues.push(t('main 과 exports 가 모두 있습니다 — 최신 Node 는 exports 를 우선합니다', 'Both main and exports exist — modern Node prefers exports'));
    if (pkg.type !== undefined && pkg.type !== 'module' && pkg.type !== 'commonjs') err(t('type 은 "module" 또는 "commonjs" 입니다', 'type must be "module" or "commonjs"'));
    if (pkg.scripts) {
      if (typeof pkg.scripts !== 'object') err(t('scripts 는 객체여야 합니다', 'scripts must be an object'));
      else {
        if (pkg.scripts.test && /no test specified/.test(pkg.scripts.test)) issues.push(t('test 스크립트가 npm init 기본값(에러 출력)입니다', 'The test script is the npm init placeholder'));
        ['preinstall', 'install', 'postinstall', 'prepare'].forEach(function (k) { if (pkg.scripts[k]) issues.push(t('설치 훅 "' + k + '" 이 있습니다 — 의존하는 쪽에서도 실행될 수 있어 신뢰·보안에 영향을 줍니다 (' + pkg.scripts[k] + ')', 'Install hook "' + k + '" — it may run for consumers too and affects trust (' + pkg.scripts[k] + ')')); });
        Object.keys(pkg.scripts).forEach(function (k) { if (/curl|wget|\|\s*(sh|bash)/.test(pkg.scripts[k])) err(t('스크립트 "' + k + '" 가 외부 다운로드/파이프 실행을 합니다', 'Script "' + k + '" downloads or pipes into a shell')); });
      }
    }
    var groups = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'], seen = {}, nDeps = 0;
    groups.forEach(function (g) {
      var d = pkg[g]; if (d === undefined) return; if (d === null || typeof d !== 'object' || Array.isArray(d)) { err(t(g + ' 는 객체여야 합니다', g + ' must be an object')); return; }
      Object.keys(d).forEach(function (n) {
        nDeps++; var r = d[n], note = '';
        if (typeof r !== 'string') { note = '🚨 ' + t('문자열이어야 함', 'must be a string'); err(t(g + '.' + n + ' 의 값이 문자열이 아닙니다', g + '.' + n + ' is not a string')); }
        else if (r === '*' || r === '' || r === 'latest' || r === 'x') { note = '⚠️ ' + t('고정되지 않음 — 어떤 버전이든 설치됨', 'unpinned — any version installs'); issues.push(t(g + '.' + n + ': "' + r + '" 는 재현성이 없습니다. 범위(^)로 제한하세요', g + '.' + n + ': "' + r + '" is not reproducible; use a range (^)')); }
        else if (/^(git\+|git:|github:|https?:|file:|link:|[\w-]+\/[\w.-]+(#.*)?$)/.test(r)) { note = t('Git/URL/로컬 경로', 'git / URL / local path'); issues.push(t(g + '.' + n + ': 레지스트리 외 출처입니다 (' + r.slice(0, 40) + ') — 공급망 점검이 어렵습니다', g + '.' + n + ': non-registry source (' + r.slice(0, 40) + ') — hard to audit')); }
        else if (/^(npm:|workspace:|catalog:)/.test(r)) note = r.split(':')[0];
        else if (!/^([\^~]?\d|[<>=]+\s*\d|\d+\.[\dx*]|[\^~]|\d+\.\d+\.\d+\s*-\s*\d)/.test(r.trim())) { note = '⚠️ ' + t('범위 형식 확인', 'check range syntax'); issues.push(t(g + '.' + n + ': "' + r + '" 는 일반적인 SemVer 범위가 아닙니다', g + '.' + n + ': "' + r + '" is not a usual SemVer range')); }
        else if (/^\d+\.\d+\.\d+/.test(r)) note = t('정확히 고정', 'pinned exactly'); else if (/^\^/.test(r)) note = t('마이너·패치 자동 업데이트', 'minor & patch updates'); else if (/^~/.test(r)) note = t('패치만 자동 업데이트', 'patch updates only'); else note = t('범위', 'range');
        if (/^\^0\./.test(r)) note += ' · ' + t('0.x 는 ^ 가 마이너를 고정', '0.x: ^ pins the minor');
        (seen[n] = seen[n] || []).push(g);
        rows.push([n, r, g, note]);
      });
    });
    Object.keys(seen).forEach(function (n) { if (seen[n].length > 1 && !(seen[n].length === 2 && seen[n].indexOf('peerDependencies') >= 0)) issues.push(t('"' + n + '" 이 여러 곳에 있습니다: ' + seen[n].join(', ') + ' — 실제로 쓰는 한 곳에만 두세요', '"' + n + '" appears in several places: ' + seen[n].join(', ') + ' — keep it in one'));});
    if (pkg.engines && pkg.engines.node === undefined && !pkg.private) issues.push(t('engines.node 가 없습니다', 'No engines.node'));
    if (!pkg.engines && !pkg.private) issues.push(t('engines 가 없어 지원하는 Node 버전을 알 수 없습니다', 'No engines field, so supported Node versions are unknown'));
    if (pkg.files === undefined && !pkg.private && pkg.main) issues.push(t('files 가 없어 불필요한 파일까지 게시될 수 있습니다 (또는 .npmignore 사용)', 'No files field — unwanted files may be published (or use .npmignore)'));
    var ORDER = ['name', 'version', 'description', 'private', 'type', 'main', 'module', 'types', 'exports', 'bin', 'files', 'scripts', 'repository', 'keywords', 'author', 'license', 'bugs', 'homepage', 'engines', 'packageManager', 'dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies', 'overrides', 'resolutions'];
    var out = pkg;
    if (o.mode === 'sort') {
      out = {}; ORDER.forEach(function (k) { if (pkg[k] !== undefined) out[k] = pkg[k]; }); Object.keys(pkg).sort().forEach(function (k) { if (out[k] === undefined) out[k] = pkg[k]; });
      groups.concat(['overrides']).forEach(function (g) { if (out[g] && typeof out[g] === 'object' && !Array.isArray(out[g])) { var s = {}; Object.keys(out[g]).sort().forEach(function (k) { s[k] = out[g][k]; }); out[g] = s; } });
    }
    rows.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    var bad = uniq.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 오류 ' + bad + '건 · 의존성 ' + nDeps + '개', '❌ ' + bad + ' error(s) · ' + nDeps + ' dependencies') } : uniq.length ? { ok: 'info', msg: t('🔍 개선할 점 ' + uniq.length + '개 · 의존성 ' + nDeps + '개', '🔍 ' + uniq.length + ' suggestion(s) · ' + nDeps + ' dependencies') } : t('✅ 문제 없음 · 의존성 ' + nDeps + '개', '✅ No problems · ' + nDeps + ' dependencies'), table: { head: [['패키지', 'Package'], ['범위', 'Range'], ['위치', 'Section'], ['설명', 'Meaning']], rows: rows }, out: JSON.stringify(out, null, 2), issues: uniq };
  }
});
