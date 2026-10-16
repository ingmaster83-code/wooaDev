TK.tool('kubernetes-config-converter', {
  inputs: [
    { id: 'env', label: ['.env 내용 (KEY=VALUE)', '.env content (KEY=VALUE)'], rows: 9, sample: '# 앱 설정\nLOG_LEVEL=info\nAPI_URL=https://api.example.com\nDB_HOST=db.internal\nDB_PASSWORD=s3cr3t!\nJWT_SECRET="a long secret value"', show: function (o) { return o.dir === 'env2k8s'; } },
    { id: 'yaml', label: ['ConfigMap / Secret YAML', 'ConfigMap / Secret YAML'], rows: 9, sample: 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: app-secret\ndata:\n  DB_PASSWORD: czNjcjN0IQ==\n  JWT_SECRET: YSBsb25nIHNlY3JldCB2YWx1ZQ==\nstringData:\n  EXTRA: plain value', show: function (o) { return o.dir === 'k8s2env'; } }
  ],
  options: [
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['env2k8s', ['.env → ConfigMap / Secret', '.env → ConfigMap / Secret']], ['k8s2env', ['YAML → .env (Secret 해독)', 'YAML → .env (decode Secret)']]], default: 'env2k8s' },
    { id: 'name', type: 'text', label: ['리소스 이름', 'Resource name'], default: 'app-config', show: function (o) { return o.dir === 'env2k8s'; } },
    { id: 'ns', type: 'text', label: ['네임스페이스 (선택)', 'Namespace (optional)'], default: '', show: function (o) { return o.dir === 'env2k8s'; } },
    { id: 'kind', type: 'select', label: ['종류', 'Kind'], choices: [['auto', ['자동 (비밀 키는 Secret)', 'Auto (secret-looking keys → Secret)']], ['cm', 'ConfigMap'], ['secret', 'Secret']], default: 'auto', show: function (o) { return o.dir === 'env2k8s'; } },
    { id: 'string', type: 'checkbox', label: ['Secret 에 stringData 사용 (Base64 인코딩 생략)', 'Use stringData in Secrets (no Base64)'], default: false, show: function (o) { return o.dir === 'env2k8s'; } }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'yml' }, { id: 'snippet', label: ['Deployment 에서 사용하기', 'Using it in a Deployment'], kind: 'code', ext: 'yml' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], H = TK.hash;
    function b64(s) { return H.b64(H.utf8(s)); }
    function unb64(s) { try { return new TextDecoder().decode(H.fromB64(s)); } catch (e) { return null; } }
    function yq(s) { return /^[A-Za-z0-9_./-]+$/.test(s) && !/^(true|false|null|yes|no|on|off|~|\d+(\.\d+)?)$/i.test(s) ? s : JSON.stringify(s); }
    if (o.dir === 'k8s2env') {
      var lines = String(v.yaml || '').replace(/\r/g, '').split('\n'), sec = '', kind = '', out = [], n = 0;
      lines.forEach(function (ln) {
        var mk = /^kind:\s*(\S+)/.exec(ln); if (mk) kind = mk[1];
        if (/^(data|stringData|binaryData):\s*$/.test(ln)) { sec = ln.replace(':', '').trim(); return; }
        if (/^\S/.test(ln)) { if (!/^(data|stringData|binaryData):/.test(ln)) sec = ''; return; }
        var m = /^\s+([A-Za-z0-9_.-]+):\s*(.*)$/.exec(ln);
        if (sec && m) {
          var val = m[2].replace(/^(["'])(.*)\1$/, '$2');
          if (sec === 'data' && kind === 'Secret') { var d = unb64(val); if (d === null) { issues.push(t('Base64 가 아닌 값: ' + m[1], 'Not valid Base64: ' + m[1])); d = val; } val = d; }
          else if (sec === 'binaryData') { val = '<binary ' + val.length + ' b64 chars>'; }
          else if (sec === 'data' && kind === 'ConfigMap') { /* 평문 */ }
          out.push(m[1] + '=' + (/^[A-Za-z0-9_@%+=:,.\/-]*$/.test(val) ? val : JSON.stringify(val))); n++;
        }
      });
      if (!n) throw new Error(t('data / stringData 항목을 찾지 못했습니다', 'No data / stringData entries found'));
      if (kind === 'Secret') issues.push(t('🔐 Secret 값을 해독한 결과입니다 — 화면 공유·저장소 커밋에 주의하세요', '🔐 These are decoded Secret values — be careful when sharing your screen or committing'));
      issues.push(t('Base64 는 암호화가 아니라 인코딩입니다. Secret 은 etcd 암호화와 RBAC 으로 보호해야 합니다', 'Base64 is encoding, not encryption. Protect Secrets with etcd encryption and RBAC'));
      return { _status: t('✅ 변수 ' + n + '개를 추출했습니다 (' + (kind || '?') + ')', '✅ Extracted ' + n + ' variable(s) (' + (kind || '?') + ')'), out: out.join('\n'), issues: issues };
    }
    var pairs = [], seen = {};
    String(v.env || '').replace(/\r/g, '').split('\n').forEach(function (ln, i) {
      var s = ln.trim(); if (!s || s[0] === '#') return; s = s.replace(/^export\s+/, '');
      var m = /^([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/.exec(s);
      if (!m) { issues.push(t((i + 1) + '번째 줄을 해석할 수 없습니다: ' + s.slice(0, 30), 'Cannot parse line ' + (i + 1) + ': ' + s.slice(0, 30))); return; }
      var val = m[2], q = /^(["'])((?:\\.|(?!\1)[^\\])*)\1\s*(?:#.*)?$/.exec(val); val = q ? q[2] : val.replace(/\s+#.*$/, '');
      if (seen[m[1]]) issues.push(t('중복 키: ' + m[1] + ' (마지막 값 사용)', 'Duplicate key: ' + m[1] + ' (last value wins)'));
      seen[m[1]] = 1; pairs = pairs.filter(function (p) { return p[0] !== m[1]; }); pairs.push([m[1], val]);
    });
    if (!pairs.length) throw new Error(t('변수가 없습니다', 'No variables found'));
    var name = (o.name || 'app-config').trim(); if (!/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(name)) issues.push(t('🚨 리소스 이름은 소문자·숫자·-· . 이며 영문/숫자로 시작·끝나야 합니다 (DNS 서브도메인)', '🚨 The name must be lowercase letters, digits, - and . starting and ending alphanumeric (DNS subdomain)'));
    var isSecret = function (k) { return /(PASS|SECRET|TOKEN|KEY|CREDENTIAL|PRIVATE|PWD|AUTH)/i.test(k); };
    var cm = [], sc = [];
    pairs.forEach(function (p) { if (o.kind === 'secret' || (o.kind === 'auto' && isSecret(p[0]))) sc.push(p); else cm.push(p); });
    pairs.forEach(function (p) { if (!/^[-._a-zA-Z0-9]+$/.test(p[0])) issues.push(t('🚨 키 "' + p[0] + '" 는 ConfigMap/Secret 키로 쓸 수 없는 문자를 포함합니다', '🚨 Key "' + p[0] + '" has characters not allowed in ConfigMap / Secret keys')); });
    var docs = [], ns = (o.ns || '').trim();
    function head(kind, nm) { return 'apiVersion: v1\nkind: ' + kind + '\nmetadata:\n  name: ' + nm + (ns ? '\n  namespace: ' + ns : ''); }
    var cmName = name, scName = name + (cm.length && sc.length ? '-secret' : '');
    if (cm.length) docs.push(head('ConfigMap', cmName) + '\ndata:\n' + cm.map(function (p) { return '  ' + p[0] + ': ' + yq(p[1]); }).join('\n'));
    if (sc.length) docs.push(head('Secret', scName) + '\ntype: Opaque\n' + (o.string ? 'stringData:\n' + sc.map(function (p) { return '  ' + p[0] + ': ' + yq(p[1]); }).join('\n') : 'data:\n' + sc.map(function (p) { return '  ' + p[0] + ': ' + b64(p[1]); }).join('\n')));
    var snip = ['# Deployment > spec.template.spec.containers[]', '        envFrom:'];
    if (cm.length) snip.push('          - configMapRef:\n              name: ' + cmName);
    if (sc.length) snip.push('          - secretRef:\n              name: ' + scName);
    snip.push('', '# ' + t('또는 키 하나씩', 'or one key at a time'), '        env:', '          - name: ' + pairs[0][0], '            valueFrom:', '              ' + (sc.length && sc[0] === pairs[0] ? 'secretKeyRef' : 'configMapKeyRef') + ':', '                name: ' + (sc.length && sc[0] === pairs[0] ? scName : cmName), '                key: ' + pairs[0][0]);
    if (sc.length) { issues.push(t('🔐 Secret ' + sc.length + '개 키: ' + sc.map(function (p) { return p[0]; }).join(', ') + ' — 이 YAML 을 Git 에 커밋하지 마세요 (Sealed Secrets, External Secrets, SOPS 권장)', '🔐 ' + sc.length + ' Secret key(s): ' + sc.map(function (p) { return p[0]; }).join(', ') + ' — do not commit this YAML to Git (use Sealed Secrets, External Secrets or SOPS)')); issues.push(t('Base64 는 암호화가 아닙니다', 'Base64 is not encryption')); }
    if (cm.some(function (p) { return /^\d+$/.test(p[1]); })) issues.push(t('숫자·true/false 값은 따옴표로 감싸 문자열로 출력했습니다 (ConfigMap 값은 문자열만 허용)', 'Numbers and true / false are quoted because ConfigMap values must be strings'));
    var total = JSON.stringify(pairs).length; if (total > 900000) issues.push(t('🚨 ConfigMap/Secret 은 1MiB 한도가 있습니다', '🚨 ConfigMap / Secret have a 1 MiB limit'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 문제 ' + bad + '건', '❌ ' + bad + ' problem(s)') } : t('✅ ConfigMap ' + cm.length + '개 키 · Secret ' + sc.length + '개 키', '✅ ConfigMap ' + cm.length + ' key(s) · Secret ' + sc.length + ' key(s)'), out: docs.join('\n---\n'), snippet: snip.join('\n'), issues: issues };
  }
});
