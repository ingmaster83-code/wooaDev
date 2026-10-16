TK.tool('umask-calculator', {
  allowEmpty: true,
  inputs: [
    { id: 'umask', type: 'text', label: ['umask (8진수, 예: 022)', 'umask (octal, e.g. 022)'], sample: '027', show: function (o) { return o.mode === 'umask'; } },
    { id: 'file', type: 'text', label: ['원하는 파일 권한 (8진수 또는 rw-r--r--)', 'Desired file permission (octal or rw-r--r--)'], sample: '640', show: function (o) { return o.mode === 'perm'; } },
    { id: 'dir', type: 'text', label: ['원하는 디렉터리 권한 (8진수 또는 rwxr-x---)', 'Desired directory permission (octal or rwxr-x---)'], sample: '750', show: function (o) { return o.mode === 'perm'; } }
  ],
  options: [{ id: 'mode', type: 'select', label: ['방향', 'Direction'], choices: [['umask', ['umask → 권한', 'umask → permissions']], ['perm', ['원하는 권한 → umask', 'Permissions → umask']]], default: 'umask' }],
  outputs: [{ id: 'table', label: ['결과', 'Result'], kind: 'table' }, { id: 'out', label: ['명령어', 'Commands'], kind: 'code', ext: 'sh' }, { id: 'common', label: ['자주 쓰는 umask', 'Common umask values'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    function sym(m) { var s = ''; [6, 3, 0].forEach(function (sh) { var b = (m >> sh) & 7; s += (b & 4 ? 'r' : '-') + (b & 2 ? 'w' : '-') + (b & 1 ? 'x' : '-'); }); return s; }
    function parsePerm(s, what) {
      s = String(s).trim().replace(/^0o/, ''); if (!s) throw new Error(t(what + ' 권한을 입력하세요', 'Enter the ' + what + ' permission'));
      if (/^[0-7]{3,4}$/.test(s)) return parseInt(s.slice(-3), 8);
      if (/^[-rwx]{9}$/.test(s)) { var m = 0; for (var i = 0; i < 9; i++) if (s[i] !== '-') { if (s[i] !== 'rwx'[i % 3]) throw new Error(t('올바르지 않은 문자 배치: ' + s, 'Invalid symbolic string: ' + s)); m |= 1 << (8 - i); } return m; }
      throw new Error(t(what + ' 권한은 8진수(644) 또는 rw-r--r-- 형식이어야 합니다: ' + s, what + ' permission must be octal (644) or rw-r--r--: ' + s));
    }
    var um, f, d, issues = [], rows = [], out = [];
    if (o.mode === 'umask') {
      var s = String(v.umask || '').trim(); if (!/^[0-7]{1,4}$/.test(s)) throw new Error(t('umask 는 8진수 숫자(예: 022, 0077)여야 합니다', 'umask must be octal digits (e.g. 022, 0077)'));
      um = parseInt(s, 8) & 0o777; f = 0o666 & ~um; d = 0o777 & ~um;
    } else {
      f = parsePerm(v.file, t('파일', 'file')); d = parsePerm(v.dir, t('디렉터리', 'directory'));
      if (f & 0o111) issues.push(t('파일 권한에 실행(x) 비트가 있습니다 — 새 파일은 기본적으로 666 에서 시작하므로 umask 로는 x 를 얻을 수 없습니다. chmod 로 따로 지정하세요', 'The file permission has execute bits — new files start from 666, so umask can never grant x. Use chmod'));
      um = (~d) & 0o777;
      if (((0o666 & ~um) & 0o777) !== (f & 0o666)) issues.push(t('이 umask(' + um.toString(8).padStart(3, '0') + ')를 쓰면 새 파일은 ' + (0o666 & ~um).toString(8) + ' (' + sym(0o666 & ~um) + ') 이 됩니다 — 원하는 파일 권한(' + f.toString(8) + ')과 정확히 같게 만들 수 없는 조합입니다', 'With this umask (' + um.toString(8).padStart(3, '0') + ') new files become ' + (0o666 & ~um).toString(8) + ' (' + sym(0o666 & ~um) + '), which cannot exactly equal the requested file permission (' + f.toString(8) + ')'));
      f = 0o666 & ~um; d = 0o777 & ~um;
    }
    var us = um.toString(8).padStart(3, '0'), usym = 'u=' + ['r', 'w', 'x'].filter(function (c, i) { return !(um & (4 >> i) << 6); }).join('') + ',g=' + ['r', 'w', 'x'].filter(function (c, i) { return !((um >> 3) & (4 >> i)); }).join('') + ',o=' + ['r', 'w', 'x'].filter(function (c, i) { return !(um & (4 >> i)); }).join('');
    rows.push(['umask', us, sym(um) + ' ' + t('(마스크로 빼는 권한)', '(permissions removed)')], [t('새 파일 권한', 'New file'), f.toString(8).padStart(3, '0'), sym(f)], [t('새 디렉터리 권한', 'New directory'), d.toString(8).padStart(3, '0'), sym(d)], [t('umask 기호 표기', 'Symbolic umask'), usym, t('umask -S 가 출력하는 형식', 'the format of umask -S')]);
    out.push('umask ' + us, 'umask ' + usym, '', '# ' + t('영구 적용 위치', 'Where to make it permanent'), "echo 'umask " + us + "' >> ~/.bashrc    # " + t('사용자 셸', 'user shell'), '# /etc/login.defs → UMASK ' + us + '            # ' + t('로그인 기본값', 'login default'), '# systemd 서비스: UMask=' + us, '# Dockerfile: RUN umask ' + us + ' && …    # ' + t('해당 RUN 안에서만 유효', 'only within that RUN'));
    if (!(um & 0o002)) issues.push(t('🚨 other(기타 사용자)에게 쓰기 권한이 열립니다 — 모든 사용자가 새 파일을 수정할 수 있어 위험합니다', '🚨 Others get write permission — any user could modify new files'));
    else if (!(um & 0o004)) issues.push(t('다른 사용자도 새 파일을 읽을 수 있습니다 — 민감한 서버에서는 027 또는 077 이 안전합니다', 'Other users can read new files — 027 or 077 is safer on sensitive servers'));
    if (!(um & 0o020) && (um & 0o002)) issues.push(t('group 쓰기가 허용됩니다 — 공유 작업 디렉터리(setgid)에서 쓰는 설정입니다 (002)', 'Group write is allowed — typical for shared setgid directories (002)'));
    issues.push(t('새 파일은 666, 새 디렉터리는 777 에서 시작해 umask 비트를 뺍니다 (파일은 기본적으로 실행 권한이 붙지 않음)', 'New files start at 666 and directories at 777, then the umask bits are removed (files never get x by default)'));
    issues.push(t('umask 는 프로세스별 설정입니다. sshd·cron·systemd 서비스는 로그인 셸의 umask 를 물려받지 않습니다', 'umask is per process — sshd, cron and systemd services do not inherit your login shell\'s value'));
    issues.push(t('NFS/ACL 이 있으면 기본 ACL 이 umask 를 무시할 수 있습니다 (setfacl -d)', 'Default ACLs (setfacl -d) can override the umask'));
    var COM = [['022', t('기본값(대부분의 배포판) — 다른 사람은 읽기만', 'Default on most distros — others read-only')], ['002', t('Debian/Ubuntu 사용자 그룹 방식 — 그룹은 쓰기 가능', 'Debian/Ubuntu user-private groups — group writable')], ['027', t('서버 권장 — 그룹 읽기, 다른 사람 접근 불가', 'Recommended for servers — group read, no access for others')], ['077', t('가장 엄격 — 본인만', 'Strictest — owner only')], ['007', t('그룹 전체 허용, 다른 사람 차단', 'Full group access, others blocked')], ['0', t('제한 없음 (666/777) — 사용 금지', 'No restriction (666 / 777) — avoid')]].map(function (c) { var m = parseInt(c[0], 8); return [c[0].padStart(3, '0'), (0o666 & ~m).toString(8) + ' (' + sym(0o666 & ~m) + ')', (0o777 & ~m).toString(8) + ' (' + sym(0o777 & ~m) + ')', c[1]]; });
    return { _status: t('✅ umask ' + us + ' → 파일 ' + f.toString(8).padStart(3, '0') + ' · 디렉터리 ' + d.toString(8).padStart(3, '0'), '✅ umask ' + us + ' → file ' + f.toString(8).padStart(3, '0') + ' · directory ' + d.toString(8).padStart(3, '0')), table: { head: [['항목', 'Item'], ['값', 'Value'], ['권한', 'Permissions']], rows: rows }, out: out.join('\n'), common: { head: [['umask', 'umask'], ['파일', 'Files'], ['디렉터리', 'Directories'], ['설명', 'Notes']], rows: COM }, issues: issues };
  }
});
