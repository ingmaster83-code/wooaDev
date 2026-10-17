TK.tool('docker-compose-editor', {
  inputs: [{ id: 'in', label: ['docker-compose.yml', 'docker-compose.yml'], rows: 20, sample: 'version: "3.8"\nservices:\n  web:\n    image: nginx:latest\n    ports:\n      - "8080:80"\n      - "127.0.0.1:9000:9000"\n    depends_on:\n      - api\n      - cache\n    networks: [front]\n  api:\n    build: ./api\n    container_name: api\n    ports:\n      - "8080:3000"\n    environment:\n      DB_URL: postgres://${DB_USER}:${DB_PASS:-secret}@db/app\n    depends_on:\n      db:\n        condition: service_healthy\n    volumes:\n      - data:/var/lib/app\n      - ./conf:/etc/app:ro\n    networks: [front, back]\n  db:\n    image: postgres:16\n    privileged: true\n    networks: [back]\n    volumes:\n      - pgdata:/var/lib/postgresql/data\nnetworks:\n  front: {}\nvolumes:\n  pgdata:\n  unused:\n' }],
  sampleExpectError: true,
  options: [],
  outputs: [{ id: 'table', label: ['서비스', 'Services'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'out', label: ['시작 순서 (depends_on 위상 정렬)', 'Start order (topological sort of depends_on)'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var Y = TK.yamlx, issues = [];
    var src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('compose 파일을 입력하세요', 'Enter a compose file'));
    var res; try { res = Y.parse(src); } catch (e) { throw new Error(t('YAML 문법 오류 (줄 ' + e.line + '): ', 'YAML syntax error (line ' + e.line + '): ') + e.message); }
    var doc = res.docs[0]; if (!doc || !doc.root) throw new Error(t('내용이 비어 있습니다', 'The file is empty'));
    if (doc.error) throw new Error(doc.error.message);
    var root = Y.deref(doc.root), js = doc.js;
    if (!Y.isMap(js)) throw new Error(t('최상위가 매핑이 아닙니다', 'The top level is not a mapping'));
    function add(sev, line, msg) { issues.push({ sev: sev, line: line, msg: msg }); }
    doc.dups.forEach(function (d) { add('error', d.line, t('키 "' + d.key + '" 가 중복되었습니다 (첫 정의: 줄 ' + d.first + ')', 'Duplicate key "' + d.key + '" (first at line ' + d.first + ')')); });
    var TOP = ['version', 'name', 'services', 'networks', 'volumes', 'configs', 'secrets', 'include'];
    Object.keys(js).forEach(function (k) { if (TOP.indexOf(k) < 0 && k.indexOf('x-') !== 0) add('error', Y.keyLine(root, k), t('최상위 키 "' + k + '" 는 compose 규격에 없습니다', 'Top-level key "' + k + '" is not part of the compose spec')); });
    if (js.version !== undefined) add('info', Y.keyLine(root, 'version'), t('version 필드는 Compose v2+ 에서 폐기(obsolete)되었으며 무시됩니다', 'The version field is obsolete in Compose v2+ and ignored'));
    if (!Y.isMap(js.services) || !Object.keys(js.services).length) throw new Error(t('services 가 없습니다', 'There are no services'));
    var svcNode = Y.get(root, ['services']);
    var SKEYS = ['image', 'build', 'command', 'entrypoint', 'container_name', 'ports', 'expose', 'environment', 'env_file', 'volumes', 'networks', 'depends_on', 'restart', 'healthcheck', 'labels', 'deploy', 'user', 'working_dir', 'hostname', 'domainname', 'privileged', 'cap_add', 'cap_drop', 'devices', 'dns', 'dns_search', 'extra_hosts', 'links', 'external_links', 'logging', 'network_mode', 'pid', 'ipc', 'init', 'ulimits', 'sysctls', 'tmpfs', 'stdin_open', 'tty', 'stop_signal', 'stop_grace_period', 'secrets', 'configs', 'profiles', 'platform', 'pull_policy', 'read_only', 'security_opt', 'shm_size', 'tmpfs', 'extends', 'mem_limit', 'memswap_limit', 'cpus', 'cpu_shares', 'cpuset', 'runtime', 'scale', 'volumes_from', 'userns_mode', 'group_add', 'isolation', 'mac_address', 'oom_score_adj', 'pids_limit', 'storage_opt', 'cgroup_parent', 'attach', 'develop', 'post_start', 'pre_stop', 'annotations', 'label_file', 'models', 'provider', 'use_api_socket', 'blkio_config', 'cap_add', 'credential_spec', 'cpu_count', 'cpu_percent', 'cpu_period', 'cpu_quota', 'cpu_rt_period', 'cpu_rt_runtime', 'device_cgroup_rules', 'gpus', 'oom_kill_disable', 'mem_reservation', 'mem_swappiness', 'uts', 'cgroup'];
    var names = Object.keys(js.services), hostPorts = {}, containerNames = {}, rows = [], usedNets = {}, usedVols = {}, envVars = {};
    var defNets = Y.isMap(js.networks) ? Object.keys(js.networks) : [], defVols = Y.isMap(js.volumes) ? Object.keys(js.volumes) : [];
    function scanVars(str, line) { var re = /\$\{([A-Za-z_][A-Za-z0-9_]*)(:?[-?+][^}]*)?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, m; while ((m = re.exec(str))) { var nm = m[1] || m[3], def = m[2]; if (!envVars[nm]) envVars[nm] = { line: line, hasDefault: false }; if (def && /^:?[-?]/.test(def) && def.indexOf('?') < 0) envVars[nm].hasDefault = true; if (def && /\?/.test(def)) envVars[nm].required = true; } }
    var deps = {};
    names.forEach(function (name) {
      var s = js.services[name], sNode = Y.get(svcNode, [name]), line = Y.keyLine(svcNode, name);
      if (!Y.isMap(s)) { add('error', line, t('서비스 "' + name + '" 정의가 매핑이 아닙니다', 'Service "' + name + '" is not a mapping')); return; }
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) add('error', line, t('서비스 이름 "' + name + '" 에 허용되지 않는 문자가 있습니다', 'Service name "' + name + '" has invalid characters'));
      Object.keys(s).forEach(function (k) { if (SKEYS.indexOf(k) < 0 && k.indexOf('x-') !== 0) add('warn', Y.keyLine(sNode, k), t('서비스 "' + name + '" 의 알 수 없는 키 "' + k + '" (오타인지 확인)', 'Unknown key "' + k + '" in service "' + name + '" (typo?)')); });
      if (!s.image && !s.build && !s.extends && !s.provider) add('error', line, t('서비스 "' + name + '" 에 image 또는 build 가 필요합니다', 'Service "' + name + '" needs image or build'));
      var img = typeof s.image === 'string' ? s.image : '';
      if (img && img.indexOf('$') < 0) { var seg = img.split('/').pop(); if (seg.indexOf(':') < 0 && img.indexOf('@sha256:') < 0) add('warn', Y.keyLine(sNode, 'image'), t('이미지 "' + img + '" 에 태그가 없어 latest 가 쓰입니다', 'Image "' + img + '" has no tag, so latest is used')); else if (/:latest$/.test(seg)) add('warn', Y.keyLine(sNode, 'image'), t('이미지 "' + img + '" 는 latest 태그입니다. 버전을 고정하세요', 'Image "' + img + '" uses latest; pin a version')); }
      if (s.privileged === true) add('warn', Y.keyLine(sNode, 'privileged'), t('서비스 "' + name + '" 가 privileged: true 입니다. 호스트 전체 권한을 가지므로 꼭 필요한 경우만 쓰세요', 'Service "' + name + '" is privileged: true, which grants host-wide power; use only when necessary'));
      if (s.network_mode === 'host') add('info', Y.keyLine(sNode, 'network_mode'), t('network_mode: host 는 포트 매핑이 무시되고 네트워크가 격리되지 않습니다', 'network_mode: host ignores port mapping and removes network isolation'));
      if (s.container_name) { if (containerNames[s.container_name]) add('error', Y.keyLine(sNode, 'container_name'), t('container_name "' + s.container_name + '" 이 서비스 "' + containerNames[s.container_name] + '" 와 중복됩니다', 'container_name "' + s.container_name + '" duplicates service "' + containerNames[s.container_name] + '"')); containerNames[s.container_name] = name; if (s.deploy && s.deploy.replicas > 1 || s.scale > 1) add('warn', Y.keyLine(sNode, 'container_name'), t('container_name 이 있으면 복제본(scale)을 늘릴 수 없습니다', 'A container_name prevents scaling replicas')); }
      /* ports */
      var pl = Array.isArray(s.ports) ? s.ports : [], portSummary = [];
      pl.forEach(function (p, idx) {
        var pn = Y.get(sNode, ['ports', idx]), pline = pn ? pn.line : line, ip = '', hp = '', cp = '', proto = 'tcp';
        if (Y.isMap(p)) { cp = String(p.target || ''); hp = p.published != null ? String(p.published) : ''; ip = p.host_ip || ''; proto = p.protocol || 'tcp'; }
        else {
          var str = String(p), pr = /\/(tcp|udp|sctp)$/i.exec(str), body = pr ? str.slice(0, pr.index) : str, v6 = /^\[([0-9a-fA-F:]+)\]:/.exec(body), pre = '';
          if (v6) { pre = '[' + v6[1] + ']'; body = body.slice(v6[0].length); }
          var segs = body.split(':'), okSeg = segs.length >= 1 && segs.length <= (v6 ? 2 : 3) && segs.every(function (x) { return /^[0-9]+(-[0-9]+)?$|^$/.test(x) && (x !== '' || false); }) && (!/^[0-9.]+$/.test(segs[0]) || segs.length < 3 || /^(\d{1,3}\.){3}\d{1,3}$/.test(segs[0]));
          if (segs.length === 3 && !v6) { pre = segs.shift(); okSeg = /^(\d{1,3}\.){3}\d{1,3}$/.test(pre) && segs.every(function (x) { return /^[0-9]+(-[0-9]+)?$/.test(x); }); }
          if (!okSeg) { add('error', pline, t('포트 "' + str + '" 형식이 올바르지 않습니다 (예: "8080:80", "127.0.0.1:8080:80/tcp")', 'Invalid port "' + str + '" (e.g. "8080:80", "127.0.0.1:8080:80/tcp")')); return; }
          ip = pre; hp = segs.length === 2 ? segs[0] : ''; cp = segs[segs.length - 1]; proto = pr ? pr[1].toLowerCase() : 'tcp';
          if (pn && pn.kind === 'scalar' && pn.style === 1 && /^\d+:\d+$/.test(str) && +str.split(':')[1] < 60) add('warn', pline, t('따옴표 없는 ' + str + ' 는 YAML 1.1 파서에서 60진수로 해석될 수 있습니다. 포트는 "' + str + '" 처럼 따옴표로 감싸세요', 'Unquoted ' + str + ' can be read as a base-60 number by YAML 1.1 parsers; quote ports like "' + str + '"'));
        }
        var ports = [cp, hp].filter(Boolean);
        ports.forEach(function (pp) { pp.split('-').forEach(function (n) { if (+n < 1 || +n > 65535) add('error', pline, t('포트 ' + n + ' 가 1~65535 범위를 벗어납니다', 'Port ' + n + ' is outside 1–65535')); }); });
        portSummary.push((ip ? ip + ':' : '') + (hp ? hp + ':' : '') + cp + (proto !== 'tcp' ? '/' + proto : ''));
        if (hp && hp.indexOf('-') < 0) { var key = proto + ' ' + hp, bind = ip || '*'; (hostPorts[key] = hostPorts[key] || []).push({ svc: name, ip: bind, line: pline }); }
        if (ip === '' && hp && o && false) { /* placeholder */ }
      });
      /* 환경 변수 보간 */
      var textDump = JSON.stringify(s); scanVars(textDump, line);
      if (Y.isMap(s.environment)) Object.keys(s.environment).forEach(function (k) { if (/(PASSWORD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)/i.test(k) && s.environment[k] && String(s.environment[k]).indexOf('$') < 0) add('warn', Y.keyLine(Y.get(sNode, ['environment']), k), t('환경 변수 ' + k + ' 에 비밀 값이 그대로 적혀 있습니다. .env 파일이나 secrets 를 쓰세요', 'Environment variable ' + k + ' holds a secret in plain text; use an .env file or secrets')); });
      if (Array.isArray(s.environment)) s.environment.forEach(function (e) { if (typeof e === 'string' && /^(\w*(PASSWORD|SECRET|TOKEN|API_?KEY)\w*)=[^$]+$/i.test(e)) add('warn', line, t('환경 변수 ' + e.split('=')[0] + ' 에 비밀 값이 그대로 적혀 있습니다', 'Environment variable ' + e.split('=')[0] + ' holds a secret in plain text')); });
      /* 네트워크·볼륨 참조 */
      var nets = Array.isArray(s.networks) ? s.networks : Y.isMap(s.networks) ? Object.keys(s.networks) : [];
      nets.forEach(function (n) { usedNets[n] = true; if (defNets.indexOf(n) < 0 && n !== 'default') add('error', Y.keyLine(sNode, 'networks'), t('서비스 "' + name + '" 가 정의되지 않은 네트워크 "' + n + '" 를 씁니다', 'Service "' + name + '" uses undefined network "' + n + '"')); });
      if (!s.networks && !s.network_mode) usedNets['default'] = true;
      (Array.isArray(s.volumes) ? s.volumes : []).forEach(function (vol, idx) {
        var src2 = Y.isMap(vol) ? (vol.type === 'volume' ? vol.source : null) : (typeof vol === 'string' ? vol.split(':')[0] : null);
        if (src2 && !/^[.\/~$]/.test(src2) && !/^[A-Za-z]:/.test(src2)) { usedVols[src2] = true; if (defVols.indexOf(src2) < 0) add('error', Y.keyLine(sNode, 'volumes'), t('서비스 "' + name + '" 가 정의되지 않은 볼륨 "' + src2 + '" 를 씁니다 (최상위 volumes 에 선언 필요)', 'Service "' + name + '" uses undefined volume "' + src2 + '" (declare it under top-level volumes)')); }
      });
      /* depends_on */
      var dl = Array.isArray(s.depends_on) ? s.depends_on : Y.isMap(s.depends_on) ? Object.keys(s.depends_on) : [];
      deps[name] = dl;
      dl.forEach(function (d) { if (names.indexOf(d) < 0 && !(s.profiles)) add('error', Y.keyLine(sNode, 'depends_on'), t('depends_on 의 "' + d + '" 서비스가 없습니다', 'depends_on refers to missing service "' + d + '"')); else if (d === name) add('error', Y.keyLine(sNode, 'depends_on'), t('서비스 "' + name + '" 가 자기 자신에 의존합니다', 'Service "' + name + '" depends on itself')); });
      if (Y.isMap(s.depends_on)) Object.keys(s.depends_on).forEach(function (d) { var c = s.depends_on[d] && s.depends_on[d].condition; if (c && ['service_started', 'service_healthy', 'service_completed_successfully'].indexOf(c) < 0) add('error', Y.keyLine(sNode, 'depends_on'), t('depends_on 조건 "' + c + '" 가 올바르지 않습니다', 'Invalid depends_on condition "' + c + '"')); if (c === 'service_healthy' && js.services[d] && Y.isMap(js.services[d]) && !js.services[d].healthcheck && !/(postgres|mysql|mariadb|redis|mongo)/.test(String(js.services[d].image || ''))) add('warn', Y.keyLine(sNode, 'depends_on'), t('"' + d + '" 에 healthcheck 가 없어 service_healthy 조건이 충족되지 않습니다', '"' + d + '" has no healthcheck, so service_healthy can never be met')); else if (c === 'service_healthy' && js.services[d] && Y.isMap(js.services[d]) && !js.services[d].healthcheck) add('info', Y.keyLine(sNode, 'depends_on'), t('"' + d + '" 의 이미지에 healthcheck 가 내장되어 있지 않다면 service_healthy 가 영원히 대기합니다. compose 에 healthcheck 를 정의하세요', 'Unless the "' + d + '" image ships a healthcheck, service_healthy waits forever; define a healthcheck in compose')); });
      if (s.restart && ['no', 'always', 'on-failure', 'unless-stopped'].indexOf(String(s.restart).split(':')[0]) < 0) add('error', Y.keyLine(sNode, 'restart'), t('restart 값 "' + s.restart + '" 이 올바르지 않습니다 (no, always, on-failure, unless-stopped)', 'Invalid restart value "' + s.restart + '" (no, always, on-failure, unless-stopped)'));
      rows.push([name, s.image ? String(s.image) : s.build ? 'build: ' + (typeof s.build === 'string' ? s.build : s.build.context || '.') : '—', portSummary.join(', ') || '—', dl.join(', ') || '—', nets.join(', ') || (s.network_mode ? 'mode:' + s.network_mode : 'default'), String(line)]);
    });
    /* 호스트 포트 충돌 */
    Object.keys(hostPorts).forEach(function (k) { var list = hostPorts[k]; for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) { var a = list[i], b = list[j]; if (a.ip === b.ip || a.ip === '*' || b.ip === '*' || a.ip === '0.0.0.0' || b.ip === '0.0.0.0') add('error', b.line, t('호스트 포트 ' + k + ' 가 서비스 "' + a.svc + '"(줄 ' + a.line + ')와 "' + b.svc + '" 에서 충돌합니다', 'Host port ' + k + ' conflicts between "' + a.svc + '" (line ' + a.line + ') and "' + b.svc + '"')); } });
    defNets.forEach(function (n) { if (!usedNets[n] && !(js.networks[n] && js.networks[n].external)) add('info', Y.keyLine(Y.get(root, ['networks']), n), t('네트워크 "' + n + '" 를 쓰는 서비스가 없습니다', 'No service uses network "' + n + '"')); });
    defVols.forEach(function (n) { if (!usedVols[n]) add('info', Y.keyLine(Y.get(root, ['volumes']), n), t('볼륨 "' + n + '" 를 쓰는 서비스가 없습니다', 'No service uses volume "' + n + '"')); });
    /* 순환 · 시작 순서 */
    var state = {}, order = [], cyc = null;
    function visit(n, path) { if (state[n] === 2) return; if (state[n] === 1) { cyc = cyc || path.slice(path.indexOf(n)).concat(n); return; } state[n] = 1; (deps[n] || []).forEach(function (d) { if (names.indexOf(d) >= 0) visit(d, path.concat(n)); }); state[n] = 2; order.push(n); }
    names.forEach(function (n) { visit(n, []); });
    if (cyc) add('error', Y.keyLine(svcNode, cyc[0]), t('depends_on 순환: ' + cyc.join(' → '), 'depends_on cycle: ' + cyc.join(' → ')));
    var vl = Object.keys(envVars); var needed = vl.filter(function (k) { return !envVars[k].hasDefault; });
    if (needed.length) add('info', 1, t('기본값 없는 환경 변수 ' + needed.join(', ') + ' 는 .env 파일이나 셸에 정의돼 있어야 합니다 (없으면 빈 문자열 경고)', 'Variables without defaults (' + needed.join(', ') + ') must be defined in an .env file or the shell (otherwise an empty-string warning)'));
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
    issues.sort(function (a, b) { return a.line - b.line; });
    var list = issues.map(function (x) { return ICON[x.sev] + ' ' + t('줄 ', 'Line ') + x.line + ': ' + x.msg; });
    var errs = issues.filter(function (x) { return x.sev === 'error'; }).length, warns = issues.filter(function (x) { return x.sev === 'warn'; }).length;
    var msg = errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — 서비스 ' + names.length + '개', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + names.length + ' service(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — 서비스 ' + names.length + '개', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + names.length + ' service(s)');
    return { _status: { ok: errs ? false : true, msg: msg }, table: { head: [['서비스', 'Service'], ['이미지/빌드', 'Image / build'], ['포트', 'Ports'], ['depends_on', 'depends_on'], ['네트워크', 'Networks'], ['줄', 'Line']], rows: rows }, issues: list, out: cyc ? t('(순환 의존성이 있어 순서를 정할 수 없습니다)', '(a dependency cycle prevents ordering)') : order.map(function (n, i) { return (i + 1) + '. ' + n; }).join('\n') };
  }
});
