TK.tool('docker-run-builder', {
  inputs: [
    { id: 'ports', label: ['포트 (한 줄에 하나: 호스트:컨테이너)', 'Ports (one per line: host:container)'], rows: 3, sample: '8080:80\n127.0.0.1:5432:5432\n53:53/udp' },
    { id: 'volumes', label: ['볼륨 (한 줄에 하나: 원본:대상[:ro])', 'Volumes (one per line: source:target[:ro])'], rows: 3, sample: './html:/usr/share/nginx/html:ro\npgdata:/var/lib/postgresql/data' },
    { id: 'env', label: ['환경 변수 (KEY=값, 한 줄에 하나)', 'Environment variables (KEY=value, one per line)'], rows: 3, sample: 'TZ=Asia/Seoul\nPOSTGRES_PASSWORD=changeme' },
    { id: 'cmd', type: 'text', label: ['실행 명령 덮어쓰기 (선택)', 'Command override (optional)'], sample: '' }
  ],
  options: [
    { id: 'image', type: 'text', label: ['이미지', 'Image'], default: 'nginx:1.27-alpine' },
    { id: 'name', type: 'text', label: ['컨테이너 이름', 'Container name'], default: 'web' },
    { id: 'detach', type: 'checkbox', label: ['백그라운드 실행 (-d)', 'Run in the background (-d)'], default: true },
    { id: 'rm', type: 'checkbox', label: ['종료 시 자동 삭제 (--rm)', 'Remove on exit (--rm)'], default: false },
    { id: 'it', type: 'checkbox', label: ['대화형 터미널 (-it)', 'Interactive terminal (-it)'], default: false },
    { id: 'restart', type: 'select', label: ['재시작 정책', 'Restart policy'], choices: [['', ['없음', 'None']], ['unless-stopped', 'unless-stopped'], ['always', 'always'], ['on-failure', 'on-failure']], default: 'unless-stopped' },
    { id: 'network', type: 'text', label: ['네트워크 (--network)', 'Network (--network)'], default: '' },
    { id: 'user', type: 'text', label: ['실행 사용자 (--user)', 'User (--user)'], default: '' },
    { id: 'workdir', type: 'text', label: ['작업 디렉터리 (-w)', 'Working directory (-w)'], default: '' },
    { id: 'memory', type: 'text', label: ['메모리 제한 (예: 512m)', 'Memory limit (e.g. 512m)'], default: '' },
    { id: 'cpus', type: 'text', label: ['CPU 제한 (예: 1.5)', 'CPU limit (e.g. 1.5)'], default: '' },
    { id: 'hostname', type: 'text', label: ['호스트 이름 (--hostname)', 'Hostname (--hostname)'], default: '' },
    { id: 'ro', type: 'checkbox', label: ['루트 파일시스템 읽기 전용 (--read-only)', 'Read-only root filesystem (--read-only)'], default: false },
    { id: 'capdrop', type: 'checkbox', label: ['모든 권한 제거 (--cap-drop ALL)', 'Drop all capabilities (--cap-drop ALL)'], default: false },
    { id: 'nonew', type: 'checkbox', label: ['권한 상승 금지 (no-new-privileges)', 'Forbid privilege escalation (no-new-privileges)'], default: false },
    { id: 'priv', type: 'checkbox', label: ['특권 모드 (--privileged) ⚠️', 'Privileged mode (--privileged) ⚠️'], default: false },
    { id: 'platform', type: 'text', label: ['플랫폼 (--platform)', 'Platform (--platform)'], default: '' }
  ],
  outputs: [{ id: 'out', label: ['docker run 명령어', 'docker run command'], kind: 'code', ext: 'sh' }, { id: 'compose', label: ['docker-compose.yml 변환', 'docker-compose.yml equivalent'], kind: 'code', ext: 'yml' }, { id: 'issues', label: ['보안·운영 점검', 'Security & ops checks'], kind: 'list' }],
  run: function (v, o, t) {
    var image = (o.image || '').trim();
    if (!image) throw new Error(t('이미지를 입력하세요', 'Enter an image'));
    function lines(s) { return String(s || '').replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
    function q(s) { return /^[A-Za-z0-9_@%+=:,.\/~^{}-]+$/.test(s) ? s : "'" + String(s).replace(/'/g, "'\\''") + "'"; }
    function y(s) { s = String(s); return /^[A-Za-z_.\/~][A-Za-z0-9_.\/:@~=,-]*$/.test(s) && !/^(true|false|null|yes|no|on|off|y|n|~)$/i.test(s) ? s : JSON.stringify(s); }
    var issues = [], args = [], comp = [], N = TK.net, svc = (o.name || '').trim() || image.split('/').pop().split(':')[0].replace(/[^a-z0-9_-]/gi, '-');
    var SENSITIVE = { 3306: 'MySQL', 5432: 'PostgreSQL', 6379: 'Redis', 27017: 'MongoDB', 9200: 'Elasticsearch', 11211: 'Memcached', 5984: 'CouchDB', 2375: 'Docker API', 1433: 'SQL Server', 9042: 'Cassandra' };
    if (/[A-Z\s]/.test(image.replace(/@.*$/, ''))) issues.push(t('이미지 이름에 대문자나 공백이 있습니다', 'The image name contains uppercase letters or spaces'));
    if (o.detach) args.push('-d'); if (o.it) args.push('-it'); if (o.rm) args.push('--rm');
    if (o.detach && o.rm) issues.push(t('-d 와 --rm 을 함께 쓰면 종료 즉시 컨테이너가 사라져 로그를 볼 수 없습니다', '-d with --rm removes the container as soon as it exits, so logs vanish'));
    if (o.detach && o.it) issues.push(t('-d 와 -it 를 함께 쓰는 경우는 드뭅니다 (백그라운드에서 터미널은 필요 없음)', '-d with -it is rarely useful (no terminal in the background)'));
    if (o.name && o.name.trim()) { if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(o.name.trim())) issues.push(t('컨테이너 이름은 영문·숫자로 시작하고 영문·숫자·_ . - 만 쓸 수 있습니다', 'Container names start with a letter/digit and may contain only letters, digits, _ . -')); args.push('--name ' + q(o.name.trim())); }
    if (o.hostname) args.push('--hostname ' + q(o.hostname.trim()));
    if (o.restart) args.push('--restart ' + o.restart);
    if (o.rm && o.restart) issues.push(t('--rm 과 --restart 는 함께 쓸 수 없습니다 (Docker 가 거부합니다)', '--rm and --restart cannot be combined (Docker rejects it)'));
    if (o.network) { args.push('--network ' + q(o.network.trim())); if (o.network.trim() === 'host') issues.push(t('--network host 는 컨테이너가 호스트의 모든 네트워크 포트에 직접 접근합니다 (-p 는 무시됨)', '--network host gives the container direct access to the host network (-p is ignored)')); }
    var compPorts = [];
    lines(v.ports).forEach(function (p) {
      var proto = '', body = p, m = /^(.*?)(?:\/(tcp|udp|sctp))?$/.exec(p); body = m[1]; proto = m[2] || '';
      var seg = body.split(':'), ip = '', host = '', cont = '';
      if (seg.length === 1) cont = seg[0]; else if (seg.length === 2) { host = seg[0]; cont = seg[1]; } else if (seg.length === 3) { ip = seg[0]; host = seg[1]; cont = seg[2]; } else { issues.push(t('포트 형식을 해석할 수 없습니다: ' + p, 'Cannot parse port mapping: ' + p)); return; }
      function okp(x) { return /^\d+(-\d+)?$/.test(x) && x.split('-').every(function (n) { return +n >= 1 && +n <= 65535; }); }
      if ((host && !okp(host)) || !okp(cont)) { issues.push(t('🚨 포트 번호가 올바르지 않습니다 (1~65535): ' + p, '🚨 Invalid port number (1–65535): ' + p)); return; }
      if (ip && N.parseIPv4(ip) === null && !/^\[.+\]$/.test(ip)) { issues.push(t('🚨 바인딩 주소가 올바르지 않습니다: ' + ip, '🚨 Invalid bind address: ' + ip)); return; }
      args.push('-p ' + q(p)); compPorts.push(p);
      var c1 = +cont.split('-')[0], h1 = host ? +host.split('-')[0] : 0;
      if (!ip && SENSITIVE[c1]) issues.push(t('🚨 ' + SENSITIVE[c1] + ' 포트(' + c1 + ')가 모든 인터페이스(0.0.0.0)에 공개됩니다 — 외부 접근이 필요 없다면 127.0.0.1:' + (host || cont) + ':' + cont + ' 로 바인딩하세요', '🚨 The ' + SENSITIVE[c1] + ' port (' + c1 + ') is published on every interface (0.0.0.0) — bind to 127.0.0.1:' + (host || cont) + ':' + cont + ' unless you need external access'));
      if (h1 && h1 < 1024) issues.push(t('호스트 포트 ' + h1 + ' 은 1024 미만이라 root 권한이 필요한 환경이 있습니다', 'Host port ' + h1 + ' is below 1024 and may need root on some setups'));
    });
    if (compPorts.length) issues.push(t('Linux 에서 -p 로 공개한 포트는 ufw/firewalld 규칙을 우회할 수 있습니다 — 공개하고 싶지 않은 포트는 127.0.0.1 로 바인딩하세요', 'On Linux, ports published with -p can bypass ufw / firewalld — bind private ports to 127.0.0.1'));
    var compVols = [], namedVols = [], usedRel = false;
    lines(v.volumes).forEach(function (vol) {
      var m = /^((?:[A-Za-z]:\\)?[^:]+):([^:]+)(?::([a-z,]+))?$/.exec(vol);
      if (!m) { issues.push(t('볼륨 형식을 해석할 수 없습니다: ' + vol + ' (원본:대상[:옵션])', 'Cannot parse volume: ' + vol + ' (source:target[:options])')); return; }
      var src = m[1], dst = m[2], opt = m[3] || '', bind = /^([\/~.]|[A-Za-z]:\\)/.test(src), shown = vol;
      if (!/^\//.test(dst)) issues.push(t('🚨 컨테이너 안 경로는 절대 경로여야 합니다: ' + dst, '🚨 The path inside the container must be absolute: ' + dst));
      if (/^\.\.?\//.test(src)) { shown = '$(pwd)/' + src.replace(/^\.\//, '') + ':' + dst + (opt ? ':' + opt : ''); usedRel = true; args.push('-v "' + shown.replace(/"/g, '\\"') + '"'); } else args.push('-v ' + q(vol));
      compVols.push(vol);
      if (!bind) namedVols.push(src);
      if (/docker\.sock/.test(src)) issues.push(t('🚨 docker.sock 마운트는 컨테이너에 호스트 전체 제어권(사실상 root)을 줍니다', '🚨 Mounting docker.sock gives the container full control of the host (effectively root)'));
      else if (bind && /^\/(etc|root|proc|sys|var\/run)?\/?$/.test(src) && src.length < 8) issues.push(t('🚨 호스트의 ' + src + ' 를 마운트합니다 — 범위가 너무 넓습니다', '🚨 Mounting host ' + src + ' — far too broad'));
      if (bind && !/\bro\b/.test(opt) && /\/(html|conf|config|static|public)\b/.test(dst)) issues.push(t(dst + ' 는 읽기만 하면 되는 경로로 보입니다 — :ro 를 붙이세요', dst + ' looks read-only in practice — add :ro'));
    });
    if (usedRel) issues.push(t('docker run 에서는 상대 경로(./)가 지원되지 않으므로 $(pwd)/… 로 바꿨습니다 (PowerShell 은 ${PWD}\\…). docker-compose 에서는 ./ 를 그대로 쓸 수 있습니다', 'docker run does not accept relative paths (./), so they became $(pwd)/… (PowerShell: ${PWD}\\…). docker-compose accepts ./ as is'));
    var envLines = lines(v.env), envMap = [];
    envLines.forEach(function (e) {
      var i = e.indexOf('='), k = i < 0 ? e : e.slice(0, i), val = i < 0 ? null : e.slice(i + 1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) { issues.push(t('환경 변수 이름이 올바르지 않습니다: ' + k, 'Invalid environment variable name: ' + k)); return; }
      args.push('-e ' + q(val === null ? k : k + '=' + val)); envMap.push([k, val]);
      if (val !== null && /(PASS|SECRET|TOKEN|KEY|PWD)/i.test(k)) issues.push(t('🔐 ' + k + ' 에 비밀 값이 직접 들어 있습니다 — 명령 기록(history)과 docker inspect 에 노출됩니다. --env-file 이나 Docker secrets 를 쓰세요', '🔐 ' + k + ' holds a secret directly — it leaks into shell history and docker inspect. Use --env-file or Docker secrets'));
    });
    if (o.user) { args.push('--user ' + q(o.user.trim())); } else issues.push(t('--user 가 없으면 컨테이너 프로세스가 root 로 실행됩니다 (이미지가 USER 를 지정하지 않은 경우)', 'Without --user the process runs as root (unless the image sets USER)'));
    if (o.workdir) args.push('-w ' + q(o.workdir.trim()));
    if (o.memory) { if (!/^\d+(\.\d+)?[bkmg]?$/i.test(o.memory.trim())) issues.push(t('메모리 형식이 올바르지 않습니다 (예: 512m, 2g)', 'Invalid memory format (e.g. 512m, 2g)')); args.push('--memory ' + q(o.memory.trim())); } else issues.push(t('메모리 제한이 없습니다 — 한 컨테이너가 호스트 메모리를 모두 쓸 수 있습니다 (--memory 512m)', 'No memory limit — one container can exhaust the host (--memory 512m)'));
    if (o.cpus) { if (!(parseFloat(o.cpus) > 0)) issues.push(t('CPU 값은 0보다 커야 합니다', 'CPU must be greater than 0')); args.push('--cpus ' + q(o.cpus.trim())); }
    if (o.ro) args.push('--read-only'); else issues.push(t('--read-only 로 루트 파일시스템을 읽기 전용으로 만들면 침해 시 피해가 줄어듭니다 (쓰기 경로는 볼륨/--tmpfs)', '--read-only limits damage if the container is compromised (use volumes / --tmpfs for writable paths)'));
    if (o.capdrop) args.push('--cap-drop ALL'); if (o.nonew) args.push('--security-opt no-new-privileges:true');
    if (o.priv) { args.push('--privileged'); issues.push(t('🚨 --privileged 는 컨테이너에 호스트 장치와 거의 모든 권한을 줍니다 — 필요한 --cap-add 만 쓰세요', '🚨 --privileged hands the container nearly every host privilege — add only the --cap-add you need')); }
    if (o.platform) args.push('--platform ' + q(o.platform.trim()));
    if (!/@sha256:/.test(image) && (!/:/.test(image.split('/').pop()) || /:latest$/.test(image))) issues.push(t('이미지 태그가 latest(또는 없음)입니다 — 재현 가능한 배포를 위해 버전 태그로 고정하세요', 'The image tag is latest (or missing) — pin a version for reproducible deployments'));
    var cmd = (v.cmd || '').trim(), run = 'docker run' + (args.length ? ' \\\n  ' + args.join(' \\\n  ') : '') + ' \\\n  ' + q(image) + (cmd ? ' ' + cmd : '');
    comp.push('services:', '  ' + svc + ':', '    image: ' + y(image));
    if (o.name && o.name.trim()) comp.push('    container_name: ' + y(o.name.trim()));
    if (o.hostname) comp.push('    hostname: ' + y(o.hostname.trim()));
    if (o.restart) comp.push('    restart: ' + o.restart);
    if (o.it) comp.push('    stdin_open: true', '    tty: true');
    if (o.user) comp.push('    user: ' + y(o.user.trim()));
    if (o.workdir) comp.push('    working_dir: ' + y(o.workdir.trim()));
    if (cmd) comp.push('    command: ' + y(cmd));
    if (compPorts.length) { comp.push('    ports:'); compPorts.forEach(function (p) { comp.push('      - ' + JSON.stringify(p)); }); }
    if (compVols.length) { comp.push('    volumes:'); compVols.forEach(function (p) { comp.push('      - ' + y(p)); }); }
    if (envMap.length) { comp.push('    environment:'); envMap.forEach(function (e) { comp.push('      ' + e[0] + ': ' + (e[1] === null ? '' : JSON.stringify(e[1]))); }); }
    if (o.network && o.network.trim() !== 'host' && o.network.trim() !== 'bridge') comp.push('    networks:', '      - ' + y(o.network.trim())); else if (o.network && o.network.trim() === 'host') comp.push('    network_mode: host');
    if (o.memory) comp.push('    mem_limit: ' + y(o.memory.trim())); if (o.cpus) comp.push('    cpus: ' + JSON.stringify(o.cpus.trim()));
    if (o.ro) comp.push('    read_only: true'); if (o.capdrop) comp.push('    cap_drop:', '      - ALL'); if (o.nonew) comp.push('    security_opt:', '      - no-new-privileges:true'); if (o.priv) comp.push('    privileged: true'); if (o.platform) comp.push('    platform: ' + y(o.platform.trim()));
    if (namedVols.length) { comp.push('', 'volumes:'); namedVols.forEach(function (n) { comp.push('  ' + y(n) + ':'); }); }
    if (o.network && !/^(host|bridge|none)$/.test(o.network.trim())) comp.push(namedVols.length ? '' : '', 'networks:', '  ' + y(o.network.trim()) + ':', '    external: true');
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: 'info', msg: t('🔍 위험 항목 ' + bad + '개 포함', '🔍 ' + bad + ' risky item(s) included') } : t('✅ docker run 명령어를 만들었습니다', '✅ docker run command built'), out: run, compose: comp.join('\n').replace(/\n{3,}/g, '\n\n'), issues: issues };
  }
});
