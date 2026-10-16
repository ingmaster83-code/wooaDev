TK.tool('github-url-converter', {
  inputs: [{ id: 'urls', label: ['GitHub 주소 (한 줄에 하나)', 'GitHub URLs (one per line)'], rows: 5, sample: 'https://github.com/vercel/next.js/blob/canary/packages/next/src/server/next.ts#L10-L20\nhttps://raw.githubusercontent.com/facebook/react/main/README.md\ngit@github.com:torvalds/linux.git\nhttps://github.com/microsoft/vscode/tree/main/src/vs' }],
  options: [
    { id: 'refParts', type: 'number', label: ['브랜치 이름의 / 개수 + 1 (feature/x 는 2)', 'Slash-separated parts in the branch name (feature/x = 2)'], default: 1, min: 1, max: 6 },
    { id: 'ref', type: 'text', label: ['참조(브랜치·태그·SHA) 바꾸기 (선택)', 'Override the ref (branch / tag / SHA, optional)'], default: '' }
  ],
  outputs: [{ id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['분석', 'Breakdown'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var urls = String(v.urls).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!urls.length) throw new Error(t('주소를 입력하세요', 'Enter at least one URL'));
    var out = [], rows = [], issues = [], np = Math.max(1, Math.round(o.refParts) || 1), failed = 0, sawBranch = false;
    function enc(p) { return p.split('/').map(function (s) { return encodeURIComponent(decodeURIComponent(s)); }).join('/'); }
    urls.forEach(function (u) {
      var owner, repo, kind = '', ref = '', path = '', hash = '', m;
      if ((m = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(u))) { owner = m[1]; repo = m[2]; kind = 'repo (ssh)'; }
      else if ((m = /^(?:ssh:\/\/)?git@github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(u))) { owner = m[1]; repo = m[2]; kind = 'repo (ssh)'; }
      else if ((m = /^(?:https?:\/\/)?raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+)$/.exec(u))) {
        owner = m[1]; repo = m[2]; var rest = m[3].split('#')[0].split('?')[0]; hash = (/#.*$/.exec(m[3]) || [''])[0];
        var rp = rest.replace(/^refs\/heads\//, '').split('/'); ref = rp.slice(0, np).join('/'); path = rp.slice(np).join('/'); kind = 'raw';
      }
      else if ((m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/#?]+)\/([^/#?]+?)(?:\.git)?(?:\/(blob|tree|raw|blame|commits|commit|releases|issues|pull|pulls|actions|wiki)(?:\/([^#?]*))?)?\/?([?#].*)?$/.exec(u))) {
        owner = m[1]; repo = m[2]; kind = m[3] || 'repo'; hash = (m[5] && m[5][0] === '#') ? m[5] : '';
        if ((kind === 'blob' || kind === 'tree' || kind === 'raw' || kind === 'blame') && m[4]) { var p2 = m[4].split('/'); ref = p2.slice(0, np).join('/'); path = p2.slice(np).join('/'); }
        else if (kind === 'commit' && m[4]) ref = m[4];
      }
      else if ((m = /^(?:https?:\/\/)?([^/.]+)\.github\.io\/?([^/]*)/.exec(u))) { owner = m[1]; repo = m[2] || m[1] + '.github.io'; kind = 'pages'; }
      if (!owner) { failed++; out.push('# ' + u + '\n# ' + t('GitHub 주소로 해석할 수 없습니다', 'Cannot parse as a GitHub URL') + '\n'); rows.push([u, '❌', '', '']); return; }
      if (o.ref && o.ref.trim()) ref = o.ref.trim();
      var isSha = /^[0-9a-f]{40}$/i.test(ref), refE = ref ? ref.split('/').map(encodeURIComponent).join('/') : '', pathE = path ? enc(path) : '', base = 'https://github.com/' + owner + '/' + repo;
      if (ref && !isSha) sawBranch = true;
      var lines = ['# ' + u], isFile = ref && path && (kind === 'blob' || kind === 'raw' || kind === 'blame'), isTree = ref && kind === 'tree';
      lines.push('Repository:     ' + base);
      lines.push('HTTPS clone:    ' + base + '.git');
      lines.push('SSH clone:      git@github.com:' + owner + '/' + repo + '.git');
      lines.push('GitHub CLI:     gh repo clone ' + owner + '/' + repo);
      if (ref) {
        lines.push('Tree (' + t('루트', 'root') + '):    ' + base + '/tree/' + refE);
        lines.push('ZIP:            ' + base + '/archive/' + (isSha ? '' : 'refs/heads/') + refE + '.zip');
      }
      if (isTree && path) {
        lines.push('Tree:           ' + base + '/tree/' + refE + '/' + pathE);
        lines.push('History:        ' + base + '/commits/' + refE + '/' + pathE);
        lines.push('GitHub API:     https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + pathE + '?ref=' + encodeURIComponent(ref));
        lines.push('github.dev:     https://github.dev/' + owner + '/' + repo + '/tree/' + refE + '/' + pathE);
      }
      if (isFile) {
        lines.push('Blob:           ' + base + '/blob/' + refE + '/' + pathE + hash);
        lines.push('Raw:            https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + refE + '/' + pathE);
        lines.push('Raw (?raw=true): ' + base + '/blob/' + refE + '/' + pathE + '?raw=true');
        lines.push('jsDelivr CDN:   https://cdn.jsdelivr.net/gh/' + owner + '/' + repo + '@' + refE + '/' + pathE);
        lines.push('GitHub API:     https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + pathE + '?ref=' + encodeURIComponent(ref));
        lines.push('github.dev:     https://github.dev/' + owner + '/' + repo + '/blob/' + refE + '/' + pathE);
        lines.push('Blame:          ' + base + '/blame/' + refE + '/' + pathE + hash);
        lines.push('History:        ' + base + '/commits/' + refE + '/' + pathE);
      }
      lines.push('GitHub Pages ' + t('(추정)', '(guess)') + ': https://' + owner.toLowerCase() + '.github.io/' + (repo.toLowerCase() === owner.toLowerCase() + '.github.io' ? '' : repo));
      out.push(lines.join('\n') + '\n');
      rows.push([u, '✅', owner + '/' + repo, [kind, ref && (isSha ? 'SHA ' : 'ref ') + ref, path].filter(Boolean).join(' · ')]);
    });
    if (sawBranch) issues.push(t('브랜치·태그 이름으로 된 링크는 내용이 바뀌면 달라집니다. 공유·인용에는 커밋 SHA(퍼마링크, GitHub 에서 y 키)를 쓰세요', 'Links that use a branch or tag name change as the repository changes — for sharing and citations use a commit SHA permalink (press y on GitHub)'));
    issues.push(t('이름에 / 가 있는 브랜치(feature/x)는 URL 만으로 경계를 알 수 없습니다 — 위의 "브랜치 이름의 / 개수" 옵션을 조정하세요', 'A branch name containing / (feature/x) is ambiguous in a URL — adjust the "slash-separated parts" option above'));
    issues.push(t('Raw 링크는 비공개 저장소에서는 토큰이 필요합니다. 공개 저장소의 CDN(jsDelivr)은 캐시되어 최신 변경이 늦게 반영될 수 있습니다', 'Raw links of private repositories need a token. jsDelivr caches public repos, so new commits may take a while to appear'));
    return { _status: failed ? { ok: 'info', msg: t('🔍 ' + urls.length + '개 중 ' + failed + '개를 해석하지 못했습니다', '🔍 ' + failed + ' of ' + urls.length + ' URL(s) could not be parsed') } : t('✅ ' + urls.length + '개 주소를 변환했습니다', '✅ Converted ' + urls.length + ' URL(s)'), out: out.join('\n').trim(), table: { head: [['입력', 'Input'], ['상태', 'Status'], ['저장소', 'Repository'], ['종류 · 참조 · 경로', 'Kind · ref · path']], rows: rows }, issues: issues };
  }
});
