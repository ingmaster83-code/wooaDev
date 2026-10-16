TK.tool('linux-capability-decoder', {
  inputs: [{ id: 'in', label: ['capability 값 (16진수 마스크 또는 CAP_ 이름 목록)', 'Capability value (hex mask or list of CAP_ names)'], rows: 4, sample: '00000000a80425fb', placeholder: ['예: 0000003fffffffff, 0xa80425fb, 또는 CAP_NET_ADMIN CAP_SYS_TIME', 'e.g. 0000003fffffffff, 0xa80425fb, or CAP_NET_ADMIN CAP_SYS_TIME'] }],
  options: [{ id: 'cmp', type: 'checkbox', label: ['Docker 기본 capability 와 비교', 'Compare with the Docker default set'], default: true }],
  outputs: [{ id: 'table', label: ['capability 목록', 'Capabilities'], kind: 'table' }, { id: 'out', label: ['변환 결과', 'Converted values'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var CAPS = [
      ['CHOWN', '파일 소유자(uid/gid)를 임의로 변경', 'Change file owner (uid/gid) arbitrarily', 0], ['DAC_OVERRIDE', '파일 읽기·쓰기·실행 권한 검사를 무시', 'Bypass file read / write / execute permission checks', 2], ['DAC_READ_SEARCH', '파일 읽기와 디렉터리 탐색 권한 검사를 무시', 'Bypass file read and directory search checks', 2], ['FOWNER', '파일 소유자만 가능한 작업(chmod 등)을 수행', 'Perform owner-only operations (chmod …) on any file', 1], ['FSETID', 'setuid/setgid 비트 유지', 'Keep set-user-ID / set-group-ID bits', 1], ['KILL', '다른 사용자 프로세스에 시그널 전송', 'Send signals to other users\' processes', 1], ['SETGID', 'GID 를 임의로 변경', 'Change GID arbitrarily', 2], ['SETUID', 'UID 를 임의로 변경 (root 로 전환 가능)', 'Change UID arbitrarily (can become root)', 3], ['SETPCAP', '다른 프로세스의 capability 변경', 'Modify capabilities of other processes', 2], ['LINUX_IMMUTABLE', 'immutable/append-only 속성 설정', 'Set immutable and append-only file attributes', 2],
      ['NET_BIND_SERVICE', '1024 미만 포트에 바인딩', 'Bind to ports below 1024', 1], ['NET_BROADCAST', '소켓 브로드캐스트·멀티캐스트 수신', 'Socket broadcasting and multicast listening', 1], ['NET_ADMIN', '네트워크 설정 전반 (인터페이스·방화벽·라우팅)', 'Network administration (interfaces, firewall, routing)', 3], ['NET_RAW', 'RAW·PACKET 소켓 (ping, 패킷 스니핑·위조)', 'RAW and PACKET sockets (ping, sniffing, spoofing)', 2], ['IPC_LOCK', '메모리 잠금 (mlock)', 'Lock memory (mlock)', 1], ['IPC_OWNER', 'System V IPC 소유권 검사 무시', 'Bypass System V IPC ownership checks', 1], ['SYS_MODULE', '커널 모듈 적재·제거', 'Load and unload kernel modules', 4], ['SYS_RAWIO', '/dev/mem, ioperm 등 raw I/O', 'Raw I/O (/dev/mem, ioperm …)', 4], ['SYS_CHROOT', 'chroot 실행', 'Use chroot', 2], ['SYS_PTRACE', '임의 프로세스 추적·메모리 읽기', 'Trace arbitrary processes and read their memory', 3],
      ['SYS_PACCT', '프로세스 계정 on/off', 'Process accounting on / off', 1], ['SYS_ADMIN', '"새로운 root" — 마운트·namespace·수십 가지 관리 작업', 'The "new root" — mounts, namespaces and dozens of admin operations', 4], ['SYS_BOOT', '재부팅·kexec', 'Reboot and kexec', 3], ['SYS_NICE', '우선순위·스케줄링 정책 변경', 'Change priorities and scheduling policy', 1], ['SYS_RESOURCE', '리소스 한도 무시 (rlimit, 쿼터)', 'Override resource limits (rlimit, quotas)', 2], ['SYS_TIME', '시스템 시계 변경', 'Set the system clock', 2], ['SYS_TTY_CONFIG', '가상 터미널 설정', 'Configure virtual terminals', 1], ['MKNOD', '특수 파일(장치 노드) 생성', 'Create special files (device nodes)', 2], ['LEASE', '파일 lease 설정', 'Establish file leases', 1], ['AUDIT_WRITE', '커널 감사 로그에 기록', 'Write to the kernel audit log', 1],
      ['AUDIT_CONTROL', '감사 규칙 설정', 'Configure auditing', 3], ['SETFCAP', '파일에 capability 설정', 'Set file capabilities', 2], ['MAC_OVERRIDE', 'MAC(SELinux 등) 정책 우회', 'Override MAC policy (SELinux …)', 4], ['MAC_ADMIN', 'MAC 설정 변경', 'Change MAC configuration', 3], ['SYSLOG', '커널 로그(dmesg) 접근', 'Read and control the kernel log (dmesg)', 2], ['WAKE_ALARM', '시스템을 깨우는 타이머', 'Set timers that wake the system', 1], ['BLOCK_SUSPEND', '절전 모드 진입 차단', 'Block system suspend', 1], ['AUDIT_READ', '감사 로그 읽기', 'Read the audit log', 1], ['PERFMON', '성능 모니터링 (perf)', 'Performance monitoring (perf)', 2], ['BPF', 'BPF 프로그램 사용', 'Use BPF programs', 3], ['CHECKPOINT_RESTORE', '프로세스 체크포인트·복원', 'Checkpoint / restore processes', 2]
    ];
    var RISK = [t('낮음', 'low'), t('낮음', 'low'), t('중간', 'medium'), t('높음', 'high'), t('매우 높음 🚨', 'critical 🚨')];
    var DOCKER = ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'FSETID', 'KILL', 'SETGID', 'SETUID', 'SETPCAP', 'NET_BIND_SERVICE', 'NET_RAW', 'SYS_CHROOT', 'MKNOD', 'AUDIT_WRITE', 'SETFCAP'];
    var s = String(v.in).trim(), mask = 0n, issues = [], mode;
    if (!s) throw new Error(t('값을 입력하세요', 'Enter a value'));
    if (/^(0x)?[0-9a-fA-F]+$/.test(s) && !/^CAP/i.test(s)) {
      mode = 'hex'; mask = BigInt('0x' + s.replace(/^0x/i, ''));
      if (mask >> 64n) throw new Error(t('64비트(16자리 16진수)를 넘습니다', 'More than 64 bits (16 hex digits)'));
    } else {
      mode = 'names';
      s.split(/[\s,|]+/).filter(Boolean).forEach(function (n) {
        var nm = n.replace(/^CAP_/i, '').toUpperCase(), idx = -1;
        CAPS.forEach(function (c, i) { if (c[0] === nm) idx = i; });
        if (idx < 0) { if (/^ALL$/.test(nm)) { CAPS.forEach(function (c, i) { mask |= 1n << BigInt(i); }); return; } throw new Error(t('알 수 없는 capability: ' + n, 'Unknown capability: ' + n)); }
        mask |= 1n << BigInt(idx);
      });
    }
    var rows = [], names = [], unknown = [], maxRisk = 0;
    for (var i = 0; i < 64; i++) {
      if (!((mask >> BigInt(i)) & 1n)) continue;
      if (i >= CAPS.length) { unknown.push(i); continue; }
      var c = CAPS[i]; names.push(c[0]); if (c[3] > maxRisk) maxRisk = c[3];
      rows.push([i, 'CAP_' + c[0], t(c[1], c[2]), RISK[c[3]] + (DOCKER.indexOf(c[0]) >= 0 ? ' · Docker ' + t('기본', 'default') : '')]);
    }
    unknown.forEach(function (b) { rows.push([b, 'bit ' + b, t('이 도구의 목록(0~40)에 없는 비트 — 더 새로운 커널의 capability 일 수 있습니다', 'Not in this tool\'s list (0–40) — may belong to a newer kernel'), '?']); });
    var hex = mask.toString(16).padStart(16, '0'), out = [];
    out.push('CapEff/CapPrm  : ' + hex, '0x             : 0x' + mask.toString(16), t('개수           : ', 'count          : ') + names.length + (unknown.length ? ' (+' + unknown.length + ' ?)' : ''));
    out.push('', 'getpcaps / capsh : ' + (names.length ? names.map(function (n) { return 'cap_' + n.toLowerCase(); }).join(',') : '—'));
    var drop = DOCKER.filter(function (n) { return names.indexOf(n) < 0; }), add = names.filter(function (n) { return DOCKER.indexOf(n) < 0; });
    if (o.cmp) {
      out.push('', '# Docker/Podman');
      out.push('docker run ' + (names.length ? '--cap-drop ALL ' + names.map(function (n) { return '--cap-add ' + n; }).join(' ') : '--cap-drop ALL') + ' …');
      out.push('# ' + ((!add.length && !drop.length) ? t('Docker 기본 capability 14개와 동일합니다', 'Identical to the 14 capabilities of Docker\'s default set') : t('Docker 기본 대비: ', 'Compared with Docker\'s default: ') + t('추가 ', '+') + (add.join(',') || t('없음', 'none')) + ' / ' + t('제외 ', '−') + (drop.join(',') || t('없음', 'none'))));
      out.push('', '# Kubernetes securityContext', 'securityContext:', '  capabilities:', '    drop: ["ALL"]' + (names.length ? '\n    add: [' + names.map(function (n) { return '"' + n + '"'; }).join(', ') + ']' : ''));
    }
    if (names.indexOf('SYS_ADMIN') >= 0) issues.push(t('🚨 CAP_SYS_ADMIN 은 사실상 root 와 같습니다 — 컨테이너 탈출에 자주 쓰입니다', '🚨 CAP_SYS_ADMIN is effectively root — it is a common container-escape primitive'));
    ['SYS_MODULE', 'SYS_RAWIO', 'SYS_PTRACE', 'MAC_OVERRIDE', 'DAC_READ_SEARCH'].forEach(function (n) { if (names.indexOf(n) >= 0) issues.push(t('🚨 CAP_' + n + ' 은 호스트 침해로 이어질 수 있는 위험한 권한입니다', '🚨 CAP_' + n + ' is a dangerous capability that can lead to host compromise')); });
    if (names.indexOf('NET_RAW') >= 0) issues.push(t('NET_RAW 는 Docker 기본값이지만 ARP/패킷 위조에 쓰일 수 있어 불필요하면 제거하세요', 'NET_RAW is in Docker\'s default but enables packet spoofing — drop it if unneeded'));
    if (mask === (1n << 41n) - 1n) issues.push(t('모든 capability(0~40)가 켜져 있습니다 — root 의 완전한 권한입니다', 'Every capability (0–40) is set — full root'));
    if (!names.length && !unknown.length) issues.push(t('켜진 capability 가 없습니다 (일반 사용자 프로세스의 CapEff 가 보통 0 입니다)', 'No capabilities set (an unprivileged process normally has CapEff 0)'));
    if (mode === 'hex') issues.push(t('확인 방법: grep Cap /proc/<PID>/status (컨테이너 안에서는 /proc/self/status)', 'How to read it: grep Cap /proc/<PID>/status (/proc/self/status inside a container)'));
    issues.push(t('CapInh(상속)·CapPrm(허용)·CapEff(유효)·CapBnd(상한)·CapAmb(앰비언트) 5종 값이 있으며, 실제 동작은 CapEff 가 결정합니다', 'There are five sets — CapInh, CapPrm, CapEff, CapBnd, CapAmb; CapEff decides what a process can actually do'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: 'info', msg: t('⚠️ capability ' + names.length + '개 · 위험 항목 포함', '⚠️ ' + names.length + ' capabilities · includes risky ones') } : t('✅ capability ' + names.length + '개 · 최고 위험도: ' + RISK[maxRisk], '✅ ' + names.length + ' capabilities · highest risk: ' + RISK[maxRisk]), table: { head: [['비트', 'Bit'], ['이름', 'Name'], ['권한', 'What it allows'], ['위험도', 'Risk']], rows: rows }, out: out.join('\n'), issues: issues };
  }
});
