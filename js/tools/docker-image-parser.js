TK.tool('docker-image-parser', {
  inputs: [{ id: 'refs', label: ['Docker 이미지 참조 (한 줄에 하나)', 'Docker image references (one per line)'], rows: 8, sample: 'nginx\nubuntu:22.04\nbitnami/redis:7.2\nghcr.io/owner/app:v1.4.2\nlocalhost:5000/my/app@sha256:3d6d3a1c5f0b9c4d5b3c1e2f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b\n123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/web:latest' }],
  options: [{ id: 'registry', type: 'text', label: ['기본 레지스트리', 'Default registry'], default: 'docker.io' }],
  outputs: [{ id: 'table', label: ['구성 요소', 'Components'], kind: 'table' }, { id: 'out', label: ['정규화된 참조', 'Normalised references'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var list = String(v.refs).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!list.length) throw new Error(t('이미지 참조를 입력하세요', 'Enter an image reference'));
    var DEF = (o.registry || 'docker.io').trim() || 'docker.io', rows = [], canon = [], issues = [], bad = 0, latest = 0, nodig = 0;
    var CLOUD = [[/\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com$/, 'Amazon ECR'], [/^ghcr\.io$/, 'GitHub Container Registry'], [/^quay\.io$/, 'Quay.io'], [/^(gcr\.io|[a-z-]+\.gcr\.io)$/, 'Google Container Registry'], [/-docker\.pkg\.dev$/, 'Google Artifact Registry'], [/^mcr\.microsoft\.com$/, 'Microsoft Container Registry'], [/\.azurecr\.io$/, 'Azure Container Registry'], [/^registry\.gitlab\.com$/, 'GitLab Registry'], [/^(docker\.io|index\.docker\.io|registry-1\.docker\.io)$/, 'Docker Hub'], [/^public\.ecr\.aws$/, 'Amazon ECR Public'], [/^registry\.k8s\.io$/, 'Kubernetes registry'], [/^(localhost|127\.0\.0\.1)(:\d+)?$/, 'local']];
    list.forEach(function (raw) {
      var s = raw, problems = [], digest = '', tag = '', reg = '', path;
      var di = s.indexOf('@'); if (di >= 0) { digest = s.slice(di + 1); s = s.slice(0, di); if (!/^[a-z][a-z0-9]*(?:[+._-][a-z][a-z0-9]*)*:[0-9a-fA-F]{32,}$/.test(digest)) problems.push(t('digest 형식이 올바르지 않습니다 (sha256:<64자리 16진수>)', 'Invalid digest format (sha256:<64 hex chars>)')); else if (/^sha256:/.test(digest) && digest.length !== 71) problems.push(t('sha256 digest 는 64자리여야 합니다', 'A sha256 digest must have 64 hex chars')); }
      var slash = s.indexOf('/'), first = slash >= 0 ? s.slice(0, slash) : '';
      if (slash >= 0 && (first.indexOf('.') >= 0 || first.indexOf(':') >= 0 || first === 'localhost')) { reg = first; path = s.slice(slash + 1); } else path = s;
      var ci = path.lastIndexOf(':'); if (ci >= 0 && path.indexOf('/', ci) < 0) { tag = path.slice(ci + 1); path = path.slice(0, ci); if (!tag) problems.push(t('태그가 비었습니다 (콜론 뒤)', 'Empty tag after the colon')); }
      if (!path) problems.push(t('저장소 이름이 비었습니다', 'Empty repository name'));
      var hubLike = !reg || /^(docker\.io|index\.docker\.io|registry-1\.docker\.io)$/.test(reg), regN = reg || DEF;
      if (regN === 'index.docker.io' || regN === 'registry-1.docker.io') regN = 'docker.io';
      var repo = path;
      if (hubLike && path && path.indexOf('/') < 0) repo = 'library/' + path;
      if (path) {
        path.split('/').forEach(function (c) { if (!/^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/.test(c)) { if (/[A-Z]/.test(c)) problems.push(t('저장소 이름에 대문자를 쓸 수 없습니다: "' + c + '" → "' + c.toLowerCase() + '"', 'Repository names must be lowercase: "' + c + '" → "' + c.toLowerCase() + '"')); else problems.push(t('저장소 구성 요소 "' + c + '" 에 허용되지 않는 문자/형식이 있습니다', 'Repository component "' + c + '" has disallowed characters or format')); } });
        if (repo.length > 255) problems.push(t('저장소 경로가 255자를 넘습니다', 'Repository path exceeds 255 chars'));
      }
      if (tag && !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(tag)) problems.push(t('태그 형식이 올바르지 않습니다 (영문·숫자·_ . - , 최대 128자, 첫 글자는 . - 불가)', 'Invalid tag (letters, digits, _ . - ; max 128 chars; cannot start with . or -)'));
      var effTag = tag || (digest ? '' : 'latest');
      if (!problems.length) {
        if (!digest && (!tag || tag === 'latest')) { latest++; }
        if (!digest) nodig++;
        var cl = ''; CLOUD.forEach(function (c) { if (!cl && c[0].test(regN)) cl = c[1]; });
        var full = regN + '/' + repo + (effTag ? ':' + effTag : '') + (digest ? '@' + digest : '');
        canon.push(full);
        rows.push([raw, regN + (cl ? ' (' + cl + ')' : ''), repo + (hubLike && path.indexOf('/') < 0 ? t('  ← 공식 이미지', '  ← official image') : ''), tag || (digest ? '—' : 'latest ' + t('(기본값)', '(default)')), digest ? digest.slice(0, 19) + '…' : '—']);
      } else { bad++; rows.push([raw, '❌', problems.join(' · '), '', '']); }
    });
    if (latest) issues.push(t(latest + '개가 latest(또는 태그 없음)입니다 — 빌드할 때마다 다른 이미지가 받아질 수 있습니다. 버전 태그나 digest 로 고정하세요', latest + ' reference(s) use latest (or no tag) — builds may pull different images over time. Pin a version tag or digest'));
    if (nodig && !latest) issues.push(t('digest(@sha256:…)로 고정하면 태그가 덮어씌워져도 같은 이미지를 보장합니다', 'Pinning by digest (@sha256:…) guarantees the same image even if a tag is overwritten'));
    issues.push(t('태그와 digest 를 함께 쓰면 digest 가 우선하고 태그는 무시됩니다 (사람이 읽기 위한 표시)', 'When both a tag and a digest are given, the digest wins and the tag is only a human hint'));
    issues.push(t('첫 구성 요소에 . 이나 : 가 있거나 localhost 면 레지스트리로 해석됩니다. 그렇지 않으면 Docker Hub 의 사용자/조직 이름입니다', 'The first component is treated as a registry only if it contains . or : or is localhost; otherwise it is a Docker Hub user / organisation'));
    return { _status: bad ? { ok: false, msg: t('❌ ' + list.length + '개 중 ' + bad + '개가 올바르지 않습니다', '❌ ' + bad + ' of ' + list.length + ' reference(s) are invalid') } : t('✅ ' + list.length + '개 이미지 참조를 분석했습니다', '✅ Parsed ' + list.length + ' image reference(s)'), table: { head: [['입력', 'Input'], ['레지스트리', 'Registry'], ['저장소', 'Repository'], ['태그', 'Tag'], ['Digest', 'Digest']], rows: rows }, out: canon.join('\n'), issues: issues };
  }
});
