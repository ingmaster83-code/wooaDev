TK.tool('kubernetes-manifest-generator', {
  inputs: [{ id: 'env', label: ['환경 변수 (한 줄에 KEY=값)', 'Environment variables (KEY=value per line)'], rows: 4, sample: 'LOG_LEVEL=info\nAPP_MODE=production' }],
  options: [
    { id: 'name', type: 'text', label: ['앱 이름', 'App name'], default: 'myapp' },
    { id: 'ns', type: 'text', label: ['네임스페이스 (비우면 생략)', 'Namespace (empty = omit)'], default: 'production' },
    { id: 'image', type: 'text', label: ['컨테이너 이미지', 'Container image'], default: 'ghcr.io/example/myapp:1.0.0' },
    { id: 'port', type: 'number', label: ['컨테이너 포트', 'Container port'], default: 8080, min: 1, max: 65535 },
    { id: 'replicas', type: 'number', label: ['replicas', 'replicas'], default: 2, min: 0, max: 1000 },
    { id: 'svc', type: 'select', label: ['Service 종류', 'Service type'], choices: [['ClusterIP', 'ClusterIP'], ['NodePort', 'NodePort'], ['LoadBalancer', 'LoadBalancer'], ['none', ['만들지 않음', 'None']]], default: 'ClusterIP' },
    { id: 'svcport', type: 'number', label: ['Service 포트', 'Service port'], default: 80, min: 1, max: 65535 },
    { id: 'host', type: 'text', label: ['Ingress 호스트 (비우면 Ingress 생략)', 'Ingress host (empty = no Ingress)'], default: 'myapp.example.com' },
    { id: 'tls', type: 'checkbox', label: ['Ingress TLS (Secret 이름: 이름-tls)', 'Ingress TLS (Secret name: name-tls)'], default: true },
    { id: 'cls', type: 'text', label: ['ingressClassName', 'ingressClassName'], default: 'nginx' },
    { id: 'cpuReq', type: 'text', label: ['CPU request', 'CPU request'], default: '100m' },
    { id: 'cpuLim', type: 'text', label: ['CPU limit (비우면 생략)', 'CPU limit (empty = omit)'], default: '' },
    { id: 'memReq', type: 'text', label: ['메모리 request', 'Memory request'], default: '128Mi' },
    { id: 'memLim', type: 'text', label: ['메모리 limit', 'Memory limit'], default: '256Mi' },
    { id: 'probe', type: 'text', label: ['헬스 체크 경로 (비우면 프로브 생략)', 'Health check path (empty = no probes)'], default: '/healthz' },
    { id: 'harden', type: 'checkbox', label: ['보안 강화 (non-root, 읽기 전용 루트 FS, 권한 상승 금지)', 'Hardening (non-root, read-only root FS, no privilege escalation)'], default: true },
    { id: 'hpa', type: 'checkbox', label: ['HPA 포함', 'Include an HPA'], default: false },
    { id: 'hpaMax', type: 'number', label: ['HPA 최대 replicas', 'HPA max replicas'], default: 6, min: 2, max: 1000, show: function (o) { return o.hpa; } },
    { id: 'pdb', type: 'checkbox', label: ['PodDisruptionBudget 포함', 'Include a PodDisruptionBudget'], default: true }
  ],
  outputs: [{ id: 'out', label: ['YAML', 'YAML'], kind: 'code', ext: 'yml' }, { id: 'table', label: ['만들어진 리소스', 'Generated resources'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], name = String(o.name || '').trim();
    if (!name || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name) || name.length > 63) throw new Error(t('앱 이름은 소문자·숫자·- 로 이루어진 63자 이하 DNS 레이블이어야 합니다', 'The app name must be a DNS label of at most 63 lower-case letters, digits and -'));
    var ns = String(o.ns || '').trim(); if (ns && !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(ns)) throw new Error(t('네임스페이스 형식이 올바르지 않습니다', 'Invalid namespace'));
    var image = String(o.image || '').trim(); if (!image) throw new Error(t('이미지를 입력하세요', 'Enter an image'));
    var port = Math.round(o.port), sp = Math.round(o.svcport), rep = Math.round(o.replicas);
    var host = String(o.host || '').trim(); if (host && !/^(\*\.)?([a-z0-9]([-a-z0-9]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) throw new Error(t('Ingress 호스트 형식이 올바르지 않습니다 (예: app.example.com)', 'Invalid Ingress host (e.g. app.example.com)'));
    function q(s) { s = String(s); return /^[A-Za-z0-9_.\/-][A-Za-z0-9_.\/:@-]*$/.test(s) && !/^(true|false|null|yes|no|on|off|~|[-+]?[0-9.]+(e[-+]?[0-9]+)?)$/i.test(s) && !/:$/.test(s) ? s : JSON.stringify(s); }
    var envPairs = String(v.env || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l.charAt(0) !== '#'; }).map(function (l) { var i = l.indexOf('='); if (i < 1) throw new Error(t('환경 변수 "' + l + '" 는 KEY=값 형식이어야 합니다', 'Env var "' + l + '" must be KEY=value')); var k = l.slice(0, i).trim(); if (!/^[-._a-zA-Z][-._a-zA-Z0-9]*$/.test(k)) throw new Error(t('환경 변수 이름 "' + k + '" 이 올바르지 않습니다', 'Invalid env var name "' + k + '"')); return [k, l.slice(i + 1)]; });
    envPairs.forEach(function (p) { if (/(PASSWORD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)/i.test(p[0])) issues.push('⚠️ ' + t('환경 변수 ' + p[0] + ' 는 비밀 값처럼 보입니다. 매니페스트에 넣지 말고 Secret 을 참조하세요 (valueFrom.secretKeyRef)', 'Env var ' + p[0] + ' looks secret; do not put it in the manifest, reference a Secret (valueFrom.secretKeyRef)')); });
    var seg = image.split('/').pop(); if (seg.indexOf(':') < 0 && image.indexOf('@sha256:') < 0) issues.push('⚠️ ' + t('이미지에 태그가 없어 latest 가 쓰입니다. 버전을 고정하세요', 'The image has no tag, so latest is used; pin a version')); else if (/:latest$/.test(seg)) issues.push('⚠️ ' + t('이미지가 latest 태그입니다. 버전을 고정하세요', 'The image uses latest; pin a version'));
    var meta = function (n, extra) { return 'metadata:\n  name: ' + n + '\n' + (ns ? '  namespace: ' + ns + '\n' : '') + '  labels:\n    app.kubernetes.io/name: ' + name + '\n    app.kubernetes.io/managed-by: manifest\n' + (extra || ''); };
    var docs = [], rows = [];
    var d = 'apiVersion: apps/v1\nkind: Deployment\n' + meta(name) + 'spec:\n  replicas: ' + rep + '\n  selector:\n    matchLabels:\n      app.kubernetes.io/name: ' + name + '\n  template:\n    metadata:\n      labels:\n        app.kubernetes.io/name: ' + name + '\n    spec:\n';
    if (o.harden) d += '      securityContext:\n        runAsNonRoot: true\n        seccompProfile:\n          type: RuntimeDefault\n';
    d += '      containers:\n        - name: ' + name + '\n          image: ' + q(image) + '\n          ports:\n            - name: http\n              containerPort: ' + port + '\n';
    if (envPairs.length) { d += '          env:\n'; envPairs.forEach(function (p) { d += '            - name: ' + p[0] + '\n              value: ' + JSON.stringify(p[1]) + '\n'; }); }
    var req = [], lim = [];
    if (o.cpuReq) req.push('cpu: ' + q(o.cpuReq)); if (o.memReq) req.push('memory: ' + q(o.memReq)); if (o.cpuLim) lim.push('cpu: ' + q(o.cpuLim)); if (o.memLim) lim.push('memory: ' + q(o.memLim));
    if (req.length || lim.length) { d += '          resources:\n'; if (req.length) d += '            requests:\n' + req.map(function (x) { return '              ' + x + '\n'; }).join(''); if (lim.length) d += '            limits:\n' + lim.map(function (x) { return '              ' + x + '\n'; }).join(''); }
    else issues.push('⚠️ ' + t('resources 를 지정하지 않았습니다. requests/limits 를 설정하세요', 'No resources set; add requests / limits'));
    if (o.cpuReq && o.cpuLim) { var cr = /m$/.test(o.cpuReq) ? parseFloat(o.cpuReq) / 1000 : parseFloat(o.cpuReq), cl = /m$/.test(o.cpuLim) ? parseFloat(o.cpuLim) / 1000 : parseFloat(o.cpuLim); if (cl < cr) throw new Error(t('CPU limit 이 request 보다 작습니다', 'The CPU limit is smaller than the request')); }
    var probe = String(o.probe || '').trim();
    if (probe) { if (probe.charAt(0) !== '/') throw new Error(t('헬스 체크 경로는 / 로 시작해야 합니다', 'The health check path must start with /')); d += '          readinessProbe:\n            httpGet:\n              path: ' + q(probe) + '\n              port: http\n            periodSeconds: 5\n          livenessProbe:\n            httpGet:\n              path: ' + q(probe) + '\n              port: http\n            initialDelaySeconds: 10\n            periodSeconds: 10\n'; }
    else issues.push('ℹ️ ' + t('프로브가 없으면 쿠버네티스가 앱이 준비됐는지 알 수 없어 롤링 업데이트 중 요청이 유실될 수 있습니다', 'Without probes Kubernetes cannot tell when the app is ready, so requests can be lost during rollouts'));
    if (o.harden) d += '          securityContext:\n            allowPrivilegeEscalation: false\n            readOnlyRootFilesystem: true\n            capabilities:\n              drop: ["ALL"]\n';
    if (o.harden) issues.push('ℹ️ ' + t('읽기 전용 루트 파일 시스템이면 앱이 /tmp 등에 쓸 때 오류가 납니다. 필요하면 emptyDir 볼륨을 마운트하세요', 'With a read-only root file system, writes to /tmp and similar fail; mount an emptyDir volume if the app needs to write'));
    docs.push(d); rows.push(['Deployment', name, rep + ' replicas']);
    if (o.svc !== 'none') {
      var s = 'apiVersion: v1\nkind: Service\n' + meta(name) + 'spec:\n  type: ' + o.svc + '\n  selector:\n    app.kubernetes.io/name: ' + name + '\n  ports:\n    - name: http\n      port: ' + sp + '\n      targetPort: http\n';
      docs.push(s); rows.push(['Service', name, o.svc + ' :' + sp + ' → http(' + port + ')']);
      if (o.svc === 'LoadBalancer') issues.push('ℹ️ ' + t('LoadBalancer 는 클라우드 로드밸런서(과금)를 만듭니다. HTTP 앱은 Ingress 하나로 묶는 편이 저렴합니다', 'A LoadBalancer creates a (billed) cloud load balancer; for HTTP apps a shared Ingress is cheaper'));
    } else if (host) throw new Error(t('Ingress 를 만들려면 Service 가 필요합니다', 'An Ingress needs a Service'));
    if (host) {
      var ing = 'apiVersion: networking.k8s.io/v1\nkind: Ingress\n' + meta(name) + 'spec:\n';
      if (o.cls) ing += '  ingressClassName: ' + q(o.cls) + '\n';
      if (o.tls) ing += '  tls:\n    - hosts:\n        - ' + q(host) + '\n      secretName: ' + name + '-tls\n';
      ing += '  rules:\n    - host: ' + q(host) + '\n      http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: ' + name + '\n                port:\n                  number: ' + sp + '\n';
      docs.push(ing); rows.push(['Ingress', name, host + (o.tls ? ' (TLS)' : '')]);
      if (o.tls) issues.push('ℹ️ ' + t('TLS Secret "' + name + '-tls" 은 cert-manager 같은 도구가 만들거나 직접 만들어야 합니다 (kubectl create secret tls)', 'The TLS Secret "' + name + '-tls" must be created by a tool such as cert-manager or by hand (kubectl create secret tls)'));
    }
    if (o.hpa) { docs.push('apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\n' + meta(name) + 'spec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: ' + name + '\n  minReplicas: ' + Math.max(1, rep) + '\n  maxReplicas: ' + Math.round(o.hpaMax) + '\n  metrics:\n    - type: Resource\n      resource:\n        name: cpu\n        target:\n          type: Utilization\n          averageUtilization: 70\n'); rows.push(['HorizontalPodAutoscaler', name, rep + '–' + Math.round(o.hpaMax)]); if (!o.cpuReq) issues.push('⚠️ ' + t('CPU 사용률 기반 HPA 는 CPU request 가 있어야 동작합니다', 'A CPU-utilisation HPA needs a CPU request')); if (Math.round(o.hpaMax) < rep) throw new Error(t('HPA 최대 replicas 가 replicas 보다 작습니다', 'HPA max replicas is below replicas')); issues.push('ℹ️ ' + t('HPA 를 쓰면 Deployment 의 replicas 는 HPA 가 관리하므로 매니페스트에서 빼는 것이 좋습니다', 'With an HPA the replica count is managed by the HPA, so consider removing replicas from the Deployment')); }
    if (o.pdb) { docs.push('apiVersion: policy/v1\nkind: PodDisruptionBudget\n' + meta(name) + 'spec:\n  minAvailable: ' + (rep > 1 ? 1 : 0) + '\n  selector:\n    matchLabels:\n      app.kubernetes.io/name: ' + name + '\n'); rows.push(['PodDisruptionBudget', name, 'minAvailable ' + (rep > 1 ? 1 : 0)]); if (rep <= 1) issues.push('ℹ️ ' + t('replicas 가 1 이면 PDB 가 의미 없어 minAvailable 을 0 으로 했습니다', 'With one replica a PDB is meaningless, so minAvailable is 0')); }
    if (rep === 1) issues.push('ℹ️ ' + t('replicas: 1 은 롤링 업데이트·노드 장애 때 중단이 생깁니다', 'replicas: 1 causes downtime during rollouts and node failures'));
    issues.push(t('만든 YAML 은 kubectl apply --dry-run=server -f 로 검증하고, 같은 내용을 "쿠버네티스 YAML 검증" 도구에 넣어 점검해 보세요', 'Validate the YAML with kubectl apply --dry-run=server -f, and run it through the Kubernetes YAML validator tool'));
    return { _status: t('✅ 리소스 ' + docs.length + '개를 만들었습니다', '✅ Generated ' + docs.length + ' resource(s)'), out: docs.join('---\n'), table: { head: [['종류', 'Kind'], ['이름', 'Name'], ['요약', 'Summary']], rows: rows }, issues: issues };
  }
});
