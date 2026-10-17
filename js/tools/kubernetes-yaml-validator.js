TK.tool('kubernetes-yaml-validator', {
  inputs: [{ id: 'in', label: ['쿠버네티스 매니페스트 (YAML, --- 로 여러 개)', 'Kubernetes manifests (YAML, several with ---)'], rows: 26, sample: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: webapp\n    spec:\n      containers:\n        - name: web\n          image: nginx\n          ports:\n            - containerPort: 80\n              name: http\n          env:\n            - name: DB_PASS\n              valueFrom:\n                secretKeyRef:\n                  name: db-secret\n                  key: password\n          resources:\n            limits:\n              memory: 128Mi\n            requests:\n              memory: 256Mi\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: web\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: https\n---\napiVersion: extensions/v1beta1\nkind: Ingress\nmetadata:\n  name: web\nspec:\n  rules:\n    - host: example.com\n      http:\n        paths:\n          - path: /\n            backend:\n              serviceName: web\n              servicePort: 80\n' }],
  sampleExpectError: true,
  options: [{ id: 'hints', type: 'checkbox', label: ['보안·운영 권고(ℹ️)도 표시', 'Also show security and operations hints (ℹ️)'], default: true }],
  outputs: [{ id: 'table', label: ['리소스 목록', 'Resources'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var Y = TK.yamlx, issues = [];
    var src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('매니페스트를 입력하세요', 'Enter manifests'));
    var res; try { res = Y.parse(src); } catch (e) { throw new Error(t('YAML 문법 오류 (줄 ' + e.line + '): ', 'YAML syntax error (line ' + e.line + '): ') + e.message); }
    var docs = res.docs.filter(function (d) { return d.root; });
    if (!docs.length) throw new Error(t('내용이 비어 있습니다', 'The file is empty'));
    function add(sev, line, msg) { issues.push({ sev: sev, line: line, msg: msg }); }
    var API = { Pod: ['v1'], Service: ['v1'], ConfigMap: ['v1'], Secret: ['v1'], Namespace: ['v1'], PersistentVolumeClaim: ['v1'], PersistentVolume: ['v1'], ServiceAccount: ['v1'], ResourceQuota: ['v1'], LimitRange: ['v1'], Endpoints: ['v1'], Deployment: ['apps/v1'], StatefulSet: ['apps/v1'], DaemonSet: ['apps/v1'], ReplicaSet: ['apps/v1'], Job: ['batch/v1'], CronJob: ['batch/v1'], Ingress: ['networking.k8s.io/v1'], IngressClass: ['networking.k8s.io/v1'], NetworkPolicy: ['networking.k8s.io/v1'], HorizontalPodAutoscaler: ['autoscaling/v2', 'autoscaling/v1'], PodDisruptionBudget: ['policy/v1'], Role: ['rbac.authorization.k8s.io/v1'], ClusterRole: ['rbac.authorization.k8s.io/v1'], RoleBinding: ['rbac.authorization.k8s.io/v1'], ClusterRoleBinding: ['rbac.authorization.k8s.io/v1'], StorageClass: ['storage.k8s.io/v1'], CustomResourceDefinition: ['apiextensions.k8s.io/v1'] };
    var REMOVED = { 'extensions/v1beta1': '1.22', 'apps/v1beta1': '1.16', 'apps/v1beta2': '1.16', 'networking.k8s.io/v1beta1': '1.22', 'batch/v1beta1': '1.25', 'autoscaling/v2beta1': '1.25', 'autoscaling/v2beta2': '1.26', 'policy/v1beta1': '1.25', 'rbac.authorization.k8s.io/v1beta1': '1.22', 'apiextensions.k8s.io/v1beta1': '1.22', 'admissionregistration.k8s.io/v1beta1': '1.22', 'scheduling.k8s.io/v1beta1': '1.22', 'storage.k8s.io/v1beta1': '1.27' };
    var DNS1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/, LABELNAME = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    function qty(s, kind) { if (typeof s === 'number') return kind === 'cpu' ? s : s; var m = /^([0-9]*\.?[0-9]+)([a-zA-Z]*)$/.exec(String(s)); if (!m) return NaN; var n = parseFloat(m[1]), u = m[2]; if (kind === 'cpu') return u === 'm' ? n / 1000 : u === '' ? n : NaN; var f = { '': 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18, Ki: 1024, Mi: 1048576, Gi: 1073741824, Ti: 1099511627776, Pi: 1125899906842624, Ei: 1152921504606846976, m: 0.001 }[u]; return f === undefined ? NaN : n * f; }
    var res2 = [], rows = [], seenIds = {};
    docs.forEach(function (d) {
      var js = d.js, root = Y.deref(d.root);
      if (d.error) { add('error', d.root.line, d.error.message); return; }
      d.dups.forEach(function (x) { add('error', x.line, t('키 "' + x.key + '" 가 중복되었습니다 (첫 정의: 줄 ' + x.first + ')', 'Duplicate key "' + x.key + '" (first at line ' + x.first + ')')); });
      if (!Y.isMap(js)) { add('error', root.line, t('문서가 매핑이 아닙니다', 'The document is not a mapping')); return; }
      if (js.kind === 'List' && Array.isArray(js.items)) { js.items.forEach(function (it, i) { res2.push({ js: it, root: Y.get(root, ['items', i]) || root, doc: d }); }); return; }
      res2.push({ js: js, root: root, doc: d });
    });
    var byKind = {};
    res2.forEach(function (r) { var k = r.js.kind; (byKind[k] = byKind[k] || []).push(r); });
    function find(kind, name, ns) { return (byKind[kind] || []).filter(function (r) { var m = r.js.metadata || {}; return m.name === name && ((m.namespace || 'default') === (ns || 'default')); })[0]; }
    function podOf(r) { var js = r.js, spec = js.spec || {}, k = js.kind; if (k === 'Pod') return { spec: spec, path: ['spec'], labels: (js.metadata || {}).labels || {}, labelsPath: ['metadata', 'labels'] }; if (k === 'CronJob') { var jt = (spec.jobTemplate || {}).spec || {}; return { spec: (jt.template || {}).spec, path: ['spec', 'jobTemplate', 'spec', 'template', 'spec'], labels: ((jt.template || {}).metadata || {}).labels || {}, labelsPath: ['spec', 'jobTemplate', 'spec', 'template', 'metadata', 'labels'] }; } if (['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job'].indexOf(k) >= 0) return { spec: (spec.template || {}).spec, path: ['spec', 'template', 'spec'], labels: ((spec.template || {}).metadata || {}).labels || {}, labelsPath: ['spec', 'template', 'metadata', 'labels'] }; return null; }
    var pods = res2.map(function (r) { var p = podOf(r); return p ? { r: r, p: p } : null; }).filter(Boolean);
    res2.forEach(function (r) {
      var js = r.js, root = r.root, meta = js.metadata || {}, kind = js.kind, ns = meta.namespace || 'default', line = root ? root.line : 1;
      if (!Y.isMap(js)) { add('error', line, t('리소스가 매핑이 아닙니다', 'The resource is not a mapping')); return; }
      var mnode = Y.get(root, ['metadata']), nline = mnode ? Y.keyLine(root, 'metadata') : line;
      if (!js.apiVersion) add('error', line, t('apiVersion 이 없습니다', 'Missing apiVersion'));
      if (!kind) { add('error', line, t('kind 가 없습니다', 'Missing kind')); return; }
      var av = String(js.apiVersion || '');
      if (REMOVED[av]) add('error', Y.keyLine(root, 'apiVersion'), t(av + ' 는 쿠버네티스 ' + REMOVED[av] + ' 에서 제거되었습니다' + (API[kind] ? '. ' + API[kind][0] + ' 로 바꾸세요' : ''), av + ' was removed in Kubernetes ' + REMOVED[av] + (API[kind] ? '; use ' + API[kind][0] : '')));
      else if (API[kind] && av && API[kind].indexOf(av) < 0) add('error', Y.keyLine(root, 'apiVersion'), t(kind + ' 의 apiVersion 은 ' + API[kind].join(' 또는 ') + ' 이어야 합니다 (현재 ' + av + ')', kind + ' needs apiVersion ' + API[kind].join(' or ') + ' (found ' + av + ')'));
      else if (!API[kind] && o.hints) add('info', line, t('kind ' + kind + ' 는 내장 리소스가 아니라(CRD 가능) 상세 검사를 건너뜁니다', 'Kind ' + kind + ' is not built in (maybe a CRD), so detailed checks are skipped'));
      if (!meta.name && !meta.generateName && kind !== 'List') add('error', nline, t('metadata.name 이 없습니다', 'Missing metadata.name'));
      var name = meta.name ? String(meta.name) : '';
      if (name) {
        var isLabel = ['Service', 'Namespace'].indexOf(kind) >= 0 || (kind === 'Pod' && false);
        if (name.length > (isLabel ? 63 : 253) || !(isLabel ? LABELNAME : DNS1123).test(name)) add('error', Y.keyLine(mnode, 'name'), t(kind + ' 이름 "' + name + '" 이 DNS 규칙에 맞지 않습니다 (소문자·숫자·-' + (isLabel ? '' : '·.') + ', 최대 ' + (isLabel ? 63 : 253) + '자)', kind + ' name "' + name + '" breaks DNS naming (lower case, digits, -' + (isLabel ? '' : ' and .') + ', max ' + (isLabel ? 63 : 253) + ')'));
        var id = kind + '/' + ns + '/' + name; if (seenIds[id]) add('error', nline, t(kind + ' "' + name + '" (네임스페이스 ' + ns + ') 가 줄 ' + seenIds[id] + ' 와 중복됩니다', kind + ' "' + name + '" (namespace ' + ns + ') duplicates line ' + seenIds[id])); else seenIds[id] = line;
      }
      Object.keys(meta.labels || {}).forEach(function (k) { var val = String(meta.labels[k]); if (val.length > 63 || (val && !/^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/.test(val))) add('error', Y.keyLine(Y.get(mnode, ['labels']), k), t('레이블 값 "' + val + '" 이 규칙에 맞지 않습니다 (영문·숫자·-_., 최대 63자)', 'Label value "' + val + '" is invalid (letters, digits, -_. and max 63)')); });
      rows.push([kind, name || '—', ns, av || '—', String(line)]);
      /* 워크로드 */
      var P = podOf(r), spec = js.spec || {};
      if (['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet'].indexOf(kind) >= 0) {
        if (!spec.selector || !Y.isMap(spec.selector.matchLabels) && !Array.isArray(spec.selector.matchExpressions)) add('error', Y.keyLine(root, 'spec'), t(kind + ' 에는 spec.selector 가 필요합니다', kind + ' needs spec.selector'));
        else if (Y.isMap(spec.selector.matchLabels)) { var miss = Object.keys(spec.selector.matchLabels).filter(function (k) { return String((P.labels || {})[k]) !== String(spec.selector.matchLabels[k]); }); if (miss.length) add('error', Y.keyLine(Y.get(root, ['spec', 'selector']), 'matchLabels'), t('selector.matchLabels 가 파드 템플릿 레이블과 맞지 않습니다 (' + miss.map(function (k) { return k + '=' + spec.selector.matchLabels[k] + ' ↔ ' + ((P.labels || {})[k] === undefined ? '없음' : (P.labels || {})[k]); }).join(', ') + '). 배포가 거부됩니다', 'selector.matchLabels does not match the pod template labels (' + miss.map(function (k) { return k + '=' + spec.selector.matchLabels[k] + ' vs ' + ((P.labels || {})[k] === undefined ? 'missing' : (P.labels || {})[k]); }).join(', ') + '); the API server rejects it')); }
        if (!Y.isMap(spec.template) ) add('error', Y.keyLine(root, 'spec'), t('spec.template 이 없습니다', 'Missing spec.template'));
      }
      if (kind === 'StatefulSet' && !spec.serviceName) add('error', Y.keyLine(root, 'spec'), t('StatefulSet 에는 spec.serviceName 이 필요합니다', 'StatefulSet needs spec.serviceName'));
      if (kind === 'Deployment' && o.hints && spec.replicas === 1) add('info', Y.keyLine(Y.get(root, ['spec']), 'replicas'), t('replicas: 1 은 롤링 업데이트·노드 장애 때 중단이 생깁니다. 운영에서는 2 이상을 고려하세요', 'replicas: 1 causes downtime during rollouts and node failures; consider 2 or more in production'));
      if (kind === 'CronJob' && spec.schedule && String(spec.schedule).trim().split(/\s+/).length !== 5 && !/^@/.test(spec.schedule)) add('error', Y.keyLine(Y.get(root, ['spec']), 'schedule'), t('CronJob schedule "' + spec.schedule + '" 은 5개 필드여야 합니다', 'CronJob schedule "' + spec.schedule + '" needs 5 fields'));
      if (P) {
        var ps = P.spec, pnode = Y.get(root, P.path), pline = pnode ? pnode.line : line;
        if (!Y.isMap(ps)) { add('error', line, t('파드 spec 이 없습니다', 'Missing pod spec')); return; }
        var containers = Array.isArray(ps.containers) ? ps.containers : [];
        if (!containers.length) add('error', pline, t('containers 가 비어 있습니다', 'containers is empty'));
        var cnames = {}, volumes = Array.isArray(ps.volumes) ? ps.volumes : [], volNames = volumes.map(function (x) { return x && x.name; }), usedVols = {};
        if (ps.hostNetwork || ps.hostPID || ps.hostIPC) add('warn', Y.keyLine(pnode, ps.hostNetwork ? 'hostNetwork' : ps.hostPID ? 'hostPID' : 'hostIPC'), t('호스트 네임스페이스(hostNetwork/hostPID/hostIPC)를 공유하면 격리가 약해집니다', 'Sharing the host namespace (hostNetwork / hostPID / hostIPC) weakens isolation'));
        volumes.forEach(function (vol, vi) {
          if (vol && vol.hostPath) add('warn', Y.get(pnode, ['volumes', vi]) ? Y.get(pnode, ['volumes', vi]).line : pline, t('hostPath 볼륨 "' + vol.name + '" 은 노드 파일 시스템에 접근합니다', 'hostPath volume "' + vol.name + '" accesses the node file system'));
          if (vol && vol.configMap && vol.configMap.name && !find('ConfigMap', vol.configMap.name, ns) && o.hints) add('info', pline, t('볼륨 "' + vol.name + '" 이 ConfigMap "' + vol.configMap.name + '" 을 참조하지만 이 파일에는 없습니다', 'Volume "' + vol.name + '" references ConfigMap "' + vol.configMap.name + '" which is not in this file'));
          if (vol && vol.secret && vol.secret.secretName && !find('Secret', vol.secret.secretName, ns) && o.hints) add('info', pline, t('볼륨 "' + vol.name + '" 이 Secret "' + vol.secret.secretName + '" 을 참조하지만 이 파일에는 없습니다', 'Volume "' + vol.name + '" references Secret "' + vol.secret.secretName + '" which is not in this file'));
          if (vol && vol.persistentVolumeClaim && vol.persistentVolumeClaim.claimName && !find('PersistentVolumeClaim', vol.persistentVolumeClaim.claimName, ns) && o.hints) add('info', pline, t('볼륨 "' + vol.name + '" 이 PVC "' + vol.persistentVolumeClaim.claimName + '" 을 참조하지만 이 파일에는 없습니다', 'Volume "' + vol.name + '" references PVC "' + vol.persistentVolumeClaim.claimName + '" which is not in this file'));
        });
        if (ps.serviceAccountName && !find('ServiceAccount', ps.serviceAccountName, ns) && o.hints && ps.serviceAccountName !== 'default') add('info', Y.keyLine(pnode, 'serviceAccountName'), t('ServiceAccount "' + ps.serviceAccountName + '" 이 이 파일에 정의되어 있지 않습니다', 'ServiceAccount "' + ps.serviceAccountName + '" is not defined in this file'));
        (containers.concat((Array.isArray(ps.initContainers) ? ps.initContainers : []).map(function (c) { c.__init = true; return c; }))).forEach(function (c, ci) {
          if (!Y.isMap(c)) return;
          var cn = c.__init ? Y.get(pnode, ['initContainers', ci - containers.length]) : Y.get(pnode, ['containers', ci]), cl = cn ? cn.line : pline, cname = c.name ? String(c.name) : '#' + (ci + 1);
          if (!c.name) add('error', cl, t('컨테이너에 name 이 필요합니다', 'A container needs a name')); else if (!LABELNAME.test(c.name) || c.name.length > 63) add('error', cl, t('컨테이너 이름 "' + c.name + '" 이 DNS 레이블 규칙에 맞지 않습니다', 'Container name "' + c.name + '" breaks the DNS label rule')); else { if (cnames[c.name]) add('error', cl, t('컨테이너 이름 "' + c.name + '" 이 중복됩니다', 'Duplicate container name "' + c.name + '"')); cnames[c.name] = true; }
          if (!c.image) add('error', cl, t('컨테이너 "' + cname + '" 에 image 가 필요합니다', 'Container "' + cname + '" needs an image'));
          else { var img = String(c.image), seg = img.split('/').pop(); if (!/@sha256:/.test(img)) { if (seg.indexOf(':') < 0) add('warn', Y.keyLine(cn, 'image'), t('이미지 "' + img + '" 에 태그가 없어 latest 가 쓰입니다 (imagePullPolicy 도 Always 가 됨). 버전을 고정하세요', 'Image "' + img + '" has no tag, so latest (and pull policy Always) applies; pin a version')); else if (/:latest$/.test(seg)) add('warn', Y.keyLine(cn, 'image'), t('이미지 "' + img + '" 는 latest 태그입니다. 버전을 고정하세요', 'Image "' + img + '" uses latest; pin a version')); } }
          if (c.imagePullPolicy && ['Always', 'IfNotPresent', 'Never'].indexOf(c.imagePullPolicy) < 0) add('error', Y.keyLine(cn, 'imagePullPolicy'), t('imagePullPolicy "' + c.imagePullPolicy + '" 이 올바르지 않습니다', 'Invalid imagePullPolicy "' + c.imagePullPolicy + '"'));
          var portNames = [];
          (c.ports || []).forEach(function (pt, pi) { var pn = Y.get(cn, ['ports', pi]), ppl = pn ? pn.line : cl; if (!Number.isInteger(pt.containerPort) || pt.containerPort < 1 || pt.containerPort > 65535) add('error', ppl, t('containerPort ' + pt.containerPort + ' 가 1~65535 의 정수가 아닙니다', 'containerPort ' + pt.containerPort + ' is not an integer in 1–65535')); if (pt.name) { portNames.push(pt.name); if (String(pt.name).length > 15 || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(pt.name)) add('error', ppl, t('포트 이름 "' + pt.name + '" 은 소문자·숫자·- 로 최대 15자여야 합니다', 'Port name "' + pt.name + '" must be lower case / digits / - and at most 15 chars')); } });
          c.__portNames = portNames;
          (c.env || []).forEach(function (e, ei) {
            var en = Y.get(cn, ['env', ei]), el = en ? en.line : cl;
            if (!e.name) add('error', el, t('환경 변수에 name 이 필요합니다', 'An env var needs a name')); else if (!/^[-._a-zA-Z][-._a-zA-Z0-9]*$/.test(e.name)) add('error', el, t('환경 변수 이름 "' + e.name + '" 이 올바르지 않습니다', 'Invalid env var name "' + e.name + '"'));
            if (e.value !== undefined && e.valueFrom) add('error', el, t('환경 변수 ' + e.name + ' 에 value 와 valueFrom 을 함께 쓸 수 없습니다', 'Env var ' + e.name + ' cannot have both value and valueFrom'));
            if (e.value !== undefined && typeof e.value !== 'string') add('error', el, t('환경 변수 ' + e.name + ' 의 value 는 문자열이어야 합니다 (숫자·불리언은 따옴표로 감싸세요)', 'Env var ' + e.name + ' value must be a string (quote numbers and booleans)'));
            if (e.value && /(PASSWORD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)/i.test(e.name || '') && o.hints) add('warn', el, t('환경 변수 ' + e.name + ' 에 비밀 값이 매니페스트에 그대로 있습니다. Secret 을 참조하세요', 'Env var ' + e.name + ' holds a secret in the manifest; reference a Secret'));
            var skr = e.valueFrom && e.valueFrom.secretKeyRef, ckr = e.valueFrom && e.valueFrom.configMapKeyRef;
            if (skr && skr.name) { var sec = find('Secret', skr.name, ns); if (!sec) { if (o.hints) add('info', el, t('Secret "' + skr.name + '" 이 이 파일에 없습니다 (클러스터에 따로 있어야 함)', 'Secret "' + skr.name + '" is not in this file (it must exist in the cluster)')); } else { var d = (sec.js.data || {}), sd = (sec.js.stringData || {}); if (skr.key && !(skr.key in d) && !(skr.key in sd)) add('error', el, t('Secret "' + skr.name + '" 에 키 "' + skr.key + '" 가 없습니다', 'Secret "' + skr.name + '" has no key "' + skr.key + '"')); } }
            if (ckr && ckr.name) { var cm = find('ConfigMap', ckr.name, ns); if (!cm) { if (o.hints) add('info', el, t('ConfigMap "' + ckr.name + '" 이 이 파일에 없습니다', 'ConfigMap "' + ckr.name + '" is not in this file')); } else if (ckr.key && !((cm.js.data || {}).hasOwnProperty(ckr.key)) && !((cm.js.binaryData || {}).hasOwnProperty(ckr.key))) add('error', el, t('ConfigMap "' + ckr.name + '" 에 키 "' + ckr.key + '" 가 없습니다', 'ConfigMap "' + ckr.name + '" has no key "' + ckr.key + '"')); }
          });
          (c.volumeMounts || []).forEach(function (vm, vi) { usedVols[vm.name] = true; if (volNames.indexOf(vm.name) < 0) add('error', Y.get(cn, ['volumeMounts', vi]) ? Y.get(cn, ['volumeMounts', vi]).line : cl, t('volumeMounts 의 "' + vm.name + '" 볼륨이 spec.volumes 에 없습니다', 'volumeMounts refers to "' + vm.name + '" which is not in spec.volumes')); if (!vm.mountPath) add('error', cl, t('volumeMounts 에 mountPath 가 필요합니다', 'volumeMounts needs mountPath')); });
          var rs = c.resources || {}, lim = rs.limits || {}, req = rs.requests || {};
          ['cpu', 'memory'].forEach(function (k) { if (lim[k] !== undefined && req[k] !== undefined) { var a = qty(lim[k], k), b = qty(req[k], k); if (isNaN(a) || isNaN(b)) add('error', Y.keyLine(cn, 'resources'), t('resources 의 ' + k + ' 값 형식이 올바르지 않습니다 (예: 500m, 256Mi)', 'Invalid ' + k + ' quantity in resources (e.g. 500m, 256Mi)')); else if (a < b) add('error', Y.keyLine(cn, 'resources'), t(k + ' limit(' + lim[k] + ')이 request(' + req[k] + ')보다 작습니다. 파드가 생성되지 않습니다', k + ' limit (' + lim[k] + ') is smaller than request (' + req[k] + '); the pod is rejected')); } else { var qv = lim[k] !== undefined ? lim[k] : req[k]; if (qv !== undefined && isNaN(qty(qv, k))) add('error', Y.keyLine(cn, 'resources'), t('resources 의 ' + k + ' 값 형식이 올바르지 않습니다 (예: 500m, 256Mi)', 'Invalid ' + k + ' quantity in resources (e.g. 500m, 256Mi)')); } });
          if (!c.__init && o.hints) {
            if (!rs.limits && !rs.requests) add('warn', cl, t('컨테이너 "' + cname + '" 에 resources 가 없어 스케줄링과 OOM 위험을 예측할 수 없습니다', 'Container "' + cname + '" has no resources, so scheduling and OOM risk are unpredictable'));
            else { if (!req.cpu || !req.memory) add('info', cl, t('컨테이너 "' + cname + '" 에 cpu/memory requests 를 모두 지정하세요', 'Set both cpu and memory requests for container "' + cname + '"')); if (!lim.memory) add('info', cl, t('컨테이너 "' + cname + '" 에 memory limit 이 없습니다', 'Container "' + cname + '" has no memory limit')); }
            if (!c.livenessProbe && !c.readinessProbe && kind !== 'Job' && kind !== 'CronJob') add('info', cl, t('컨테이너 "' + cname + '" 에 readiness/liveness 프로브가 없습니다', 'Container "' + cname + '" has no readiness / liveness probes'));
            var sc = c.securityContext || {};
            if (sc.privileged === true) add('warn', Y.keyLine(cn, 'securityContext'), t('컨테이너 "' + cname + '" 가 privileged 입니다', 'Container "' + cname + '" is privileged'));
            else if (sc.allowPrivilegeEscalation !== false && !(ps.securityContext && ps.securityContext.runAsNonRoot)) add('info', cl, t('컨테이너 "' + cname + '" 에 securityContext(runAsNonRoot, allowPrivilegeEscalation: false, readOnlyRootFilesystem)를 지정하는 것이 좋습니다', 'Add a securityContext (runAsNonRoot, allowPrivilegeEscalation: false, readOnlyRootFilesystem) to container "' + cname + '"'));
            if (sc.capabilities && Array.isArray(sc.capabilities.add) && sc.capabilities.add.some(function (x) { return /^(SYS_ADMIN|NET_ADMIN|ALL)$/.test(x); })) add('warn', Y.keyLine(cn, 'securityContext'), t('위험한 capabilities 추가: ' + sc.capabilities.add.join(', '), 'Dangerous capabilities added: ' + sc.capabilities.add.join(', ')));
          }
          ['livenessProbe', 'readinessProbe', 'startupProbe'].forEach(function (pk) { var pr = c[pk]; if (!pr) return; var kinds = ['httpGet', 'tcpSocket', 'exec', 'grpc'].filter(function (x) { return pr[x]; }); if (kinds.length !== 1) add('error', Y.keyLine(cn, pk), t(pk + ' 에는 httpGet, tcpSocket, exec, grpc 중 정확히 하나가 필요합니다', pk + ' needs exactly one of httpGet, tcpSocket, exec, grpc')); var pp = (pr.httpGet || pr.tcpSocket || {}).port; if (typeof pp === 'string' && portNames.indexOf(pp) < 0) add('error', Y.keyLine(cn, pk), t(pk + ' 의 포트 이름 "' + pp + '" 이 컨테이너 ports 에 없습니다', pk + ' port name "' + pp + '" is not in the container ports')); if (pk === 'livenessProbe' && pr.initialDelaySeconds === undefined && !c.startupProbe && o.hints) add('info', Y.keyLine(cn, pk), t('livenessProbe 에 initialDelaySeconds(또는 startupProbe)가 없으면 느린 시작 앱이 재시작 루프에 빠질 수 있습니다', 'Without initialDelaySeconds (or a startupProbe) a slow-starting app can fall into a restart loop')); });
        });
        volNames.forEach(function (vn, vi) { if (vn && !usedVols[vn] && o.hints) add('info', Y.get(pnode, ['volumes', vi]) ? Y.get(pnode, ['volumes', vi]).line : pline, t('볼륨 "' + vn + '" 을 마운트하는 컨테이너가 없습니다', 'No container mounts volume "' + vn + '"')); });
      }
      /* Service */
      if (kind === 'Service') {
        var stype = spec.type || 'ClusterIP';
        if (['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'].indexOf(stype) < 0) add('error', Y.keyLine(Y.get(root, ['spec']), 'type'), t('Service type "' + stype + '" 이 올바르지 않습니다', 'Invalid Service type "' + stype + '"'));
        if (stype === 'ExternalName' && !spec.externalName) add('error', Y.keyLine(root, 'spec'), t('ExternalName 서비스에는 externalName 이 필요합니다', 'An ExternalName service needs externalName'));
        var sports = Array.isArray(spec.ports) ? spec.ports : [];
        if (!sports.length && stype !== 'ExternalName' && spec.clusterIP !== 'None') add('error', Y.keyLine(root, 'spec'), t('Service 에는 ports 가 필요합니다', 'A Service needs ports'));
        var seenP = {};
        sports.forEach(function (sp, si) { var sn = Y.get(root, ['spec', 'ports', si]), spl = sn ? sn.line : line; if (!Number.isInteger(sp.port) || sp.port < 1 || sp.port > 65535) add('error', spl, t('Service port ' + sp.port + ' 가 1~65535 의 정수가 아닙니다', 'Service port ' + sp.port + ' is not an integer in 1–65535')); if (sports.length > 1 && !sp.name) add('error', spl, t('포트가 여러 개면 각 포트에 name 이 필요합니다', 'With several ports each needs a name')); var key = sp.port + '/' + (sp.protocol || 'TCP'); if (seenP[key]) add('error', spl, t('포트 ' + key + ' 가 중복됩니다', 'Duplicate port ' + key)); seenP[key] = true; if (sp.nodePort !== undefined && (sp.nodePort < 30000 || sp.nodePort > 32767)) add('error', spl, t('nodePort ' + sp.nodePort + ' 는 30000~32767 범위여야 합니다', 'nodePort ' + sp.nodePort + ' must be in 30000–32767')); if (sp.nodePort !== undefined && stype === 'ClusterIP') add('warn', spl, t('ClusterIP 서비스의 nodePort 는 무시됩니다', 'nodePort is ignored on a ClusterIP service')); });
        if (stype !== 'ExternalName' && !spec.selector && !find('Endpoints', name, ns) && spec.clusterIP !== 'None' && o.hints) add('info', Y.keyLine(root, 'spec'), t('selector 가 없고 Endpoints 도 없으면 트래픽을 보낼 대상이 없습니다', 'Without a selector or Endpoints there is nothing to route traffic to'));
        if (Y.isMap(spec.selector) && pods.length) {
          var matches = pods.filter(function (x) { var pm = x.r.js.metadata || {}; if ((pm.namespace || 'default') !== ns) return false; return Object.keys(spec.selector).every(function (k) { return String((x.p.labels || {})[k]) === String(spec.selector[k]); }); });
          if (!matches.length) add('warn', Y.keyLine(Y.get(root, ['spec']), 'selector'), t('Service selector ' + JSON.stringify(spec.selector) + ' 와 일치하는 파드 템플릿이 이 파일에 없습니다', 'No pod template in this file matches the Service selector ' + JSON.stringify(spec.selector)));
          else {
            var allC = []; matches.forEach(function (x) { ((x.p.spec && x.p.spec.containers) || []).forEach(function (c) { allC.push(c); }); });
            var declared = allC.some(function (c) { return (c.ports || []).length; });
            sports.forEach(function (sp, si) {
              var spn = Y.get(root, ['spec', 'ports', si]), sl = spn ? spn.line : line;
              if (typeof sp.targetPort === 'string') {
                var foundName = allC.some(function (c) { return (c.ports || []).some(function (pt) { return pt.name === sp.targetPort; }); });
                if (!foundName) add('error', sl, t('targetPort 이름 "' + sp.targetPort + '" 을 가진 containerPort 가 일치하는 파드에 없습니다', 'No matching pod has a containerPort named "' + sp.targetPort + '"'));
              } else {
                var tp = sp.targetPort !== undefined ? sp.targetPort : sp.port;
                var foundNum = allC.some(function (c) { return (c.ports || []).some(function (pt) { return pt.containerPort === tp; }); });
                if (!foundNum && declared && o.hints) add('info', sl, t('targetPort ' + tp + ' 를 선언한 containerPort 가 없습니다 (선언은 선택이지만 확인해 보세요)', 'No container declares port ' + tp + ' (declaring is optional, but double-check)'));
              }
            });
          }
        }
      }
      /* Ingress */
      if (kind === 'Ingress') {
        var anns = meta.annotations || {};
        if (anns['kubernetes.io/ingress.class'] && o.hints) add('info', Y.keyLine(mnode, 'annotations'), t('kubernetes.io/ingress.class 어노테이션은 폐기되었습니다. spec.ingressClassName 을 쓰세요', 'The kubernetes.io/ingress.class annotation is deprecated; use spec.ingressClassName'));
        (spec.rules || []).forEach(function (rule, ri) {
          var paths = (rule.http && rule.http.paths) || [];
          paths.forEach(function (p, pi) {
            var pn = Y.get(root, ['spec', 'rules', ri, 'http', 'paths', pi]), pl = pn ? pn.line : line;
            if (av === 'networking.k8s.io/v1') {
              if (!p.pathType) add('error', pl, t('networking.k8s.io/v1 Ingress 의 path 에는 pathType(Exact, Prefix, ImplementationSpecific)이 필요합니다', 'networking.k8s.io/v1 Ingress paths need pathType (Exact, Prefix, ImplementationSpecific)'));
              else if (['Exact', 'Prefix', 'ImplementationSpecific'].indexOf(p.pathType) < 0) add('error', pl, t('pathType "' + p.pathType + '" 이 올바르지 않습니다', 'Invalid pathType "' + p.pathType + '"'));
              if (p.backend && (p.backend.serviceName || p.backend.servicePort)) add('error', pl, t('v1 Ingress 의 backend 는 service.name / service.port 형식입니다 (serviceName/servicePort 는 v1beta1)', 'v1 Ingress backends use service.name / service.port (serviceName / servicePort are v1beta1)'));
              var bs = p.backend && p.backend.service; if (!bs) { if (!(p.backend && p.backend.resource)) add('error', pl, t('backend.service 가 없습니다', 'Missing backend.service')); }
              else { if (!bs.name) add('error', pl, t('backend.service.name 이 필요합니다', 'backend.service.name is required')); else { var svc = find('Service', bs.name, ns); if (!svc) { if (byKind.Service && o.hints) add('warn', pl, t('backend 서비스 "' + bs.name + '" 이 이 파일에 없습니다', 'Backend service "' + bs.name + '" is not in this file')); } else if (bs.port) { var ok = (svc.js.spec.ports || []).some(function (sp) { return (bs.port.number !== undefined && sp.port === bs.port.number) || (bs.port.name && sp.name === bs.port.name); }); if (!ok) add('error', pl, t('Service "' + bs.name + '" 에 backend 포트 ' + (bs.port.number || bs.port.name) + ' 가 없습니다', 'Service "' + bs.name + '" has no port ' + (bs.port.number || bs.port.name))); } } }
              if (p.path && p.path.charAt(0) !== '/' && p.pathType !== 'ImplementationSpecific') add('error', pl, t('path "' + p.path + '" 는 /로 시작해야 합니다', 'path "' + p.path + '" must start with /'));
            }
          });
        });
        (spec.tls || []).forEach(function (tl) { if (tl.secretName && !find('Secret', tl.secretName, ns) && o.hints) add('info', Y.keyLine(root, 'spec'), t('TLS Secret "' + tl.secretName + '" 이 이 파일에 없습니다 (cert-manager 등이 만들 수 있음)', 'TLS Secret "' + tl.secretName + '" is not in this file (cert-manager may create it)')); });
        if (!spec.ingressClassName && !anns['kubernetes.io/ingress.class'] && o.hints) add('info', Y.keyLine(root, 'spec'), t('ingressClassName 이 없어 기본 IngressClass 에 의존합니다', 'No ingressClassName, so the default IngressClass applies'));
      }
      /* Secret / ConfigMap */
      if (kind === 'Secret') {
        Object.keys(js.data || {}).forEach(function (k) { var val = String(js.data[k]); if (!/^[A-Za-z0-9+\/]*={0,2}$/.test(val.replace(/\s/g, '')) || val.replace(/\s/g, '').length % 4 === 1) add('error', Y.keyLine(Y.get(root, ['data']), k), t('Secret data 의 "' + k + '" 값이 올바른 Base64 가 아닙니다 (평문이면 stringData 를 쓰세요)', 'Secret data "' + k + '" is not valid Base64 (use stringData for plain text)')); });
        if (o.hints) add('info', line, t('Secret 은 Base64 일 뿐 암호화가 아닙니다. 저장소에 올리지 말고 SealedSecrets·External Secrets 등을 쓰세요', 'A Secret is only Base64, not encrypted; do not commit it, use SealedSecrets or External Secrets'));
        if (js.type === 'kubernetes.io/tls' && (!(js.data || {})['tls.crt'] || !(js.data || {})['tls.key']) && !(js.stringData || {})['tls.crt']) add('error', line, t('kubernetes.io/tls Secret 에는 tls.crt 와 tls.key 가 필요합니다', 'A kubernetes.io/tls Secret needs tls.crt and tls.key'));
      }
      if (kind === 'ConfigMap') Object.keys(js.data || {}).forEach(function (k) { if (!/^[-._a-zA-Z0-9]+$/.test(k)) add('error', Y.keyLine(Y.get(root, ['data']), k), t('ConfigMap 키 "' + k + '" 에 허용되지 않는 문자가 있습니다', 'ConfigMap key "' + k + '" has invalid characters')); else if (typeof js.data[k] !== 'string') add('error', Y.keyLine(Y.get(root, ['data']), k), t('ConfigMap data 의 값은 문자열이어야 합니다 (' + k + ')', 'ConfigMap data values must be strings (' + k + ')')); });
      if (kind === 'PersistentVolumeClaim') { if (!Array.isArray(spec.accessModes) || !spec.accessModes.length) add('error', Y.keyLine(root, 'spec'), t('PVC 에는 accessModes 가 필요합니다', 'A PVC needs accessModes')); if (!(spec.resources && spec.resources.requests && spec.resources.requests.storage)) add('error', Y.keyLine(root, 'spec'), t('PVC 에는 resources.requests.storage 가 필요합니다', 'A PVC needs resources.requests.storage')); }
      if (kind === 'HorizontalPodAutoscaler') { var ref = spec.scaleTargetRef; if (!ref || !ref.name) add('error', Y.keyLine(root, 'spec'), t('HPA 에는 scaleTargetRef 가 필요합니다', 'An HPA needs scaleTargetRef')); else if (byKind[ref.kind] && !find(ref.kind, ref.name, ns)) add('warn', Y.keyLine(root, 'spec'), t('scaleTargetRef 대상 ' + ref.kind + ' "' + ref.name + '" 이 이 파일에 없습니다', 'scaleTargetRef target ' + ref.kind + ' "' + ref.name + '" is not in this file')); if (spec.minReplicas && spec.maxReplicas && spec.minReplicas > spec.maxReplicas) add('error', Y.keyLine(root, 'spec'), t('minReplicas 가 maxReplicas 보다 큽니다', 'minReplicas is greater than maxReplicas')); }
    });
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
    var shown = issues.filter(function (x) { return o.hints || x.sev !== 'info'; }).sort(function (a, b) { return a.line - b.line; });
    var list = shown.map(function (x) { return ICON[x.sev] + ' ' + t('줄 ', 'Line ') + x.line + ': ' + x.msg; });
    var errs = issues.filter(function (x) { return x.sev === 'error'; }).length, warns = issues.filter(function (x) { return x.sev === 'warn'; }).length;
    var msg = errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — 리소스 ' + rows.length + '개', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + rows.length + ' resource(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — 리소스 ' + rows.length + '개', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + rows.length + ' resource(s)');
    return { _status: { ok: errs ? false : true, msg: msg }, table: { head: [['종류', 'Kind'], ['이름', 'Name'], ['네임스페이스', 'Namespace'], ['apiVersion', 'apiVersion'], ['줄', 'Line']], rows: rows }, issues: list };
  }
});
