TK.tool('kubernetes-routing-tester', {
  inputs: [
    { id: 'in', label: ['Ingress · Service · Deployment 매니페스트 (YAML)', 'Ingress / Service / Deployment manifests (YAML)'], rows: 22, sample: 'apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: main\n  annotations:\n    nginx.ingress.kubernetes.io/rewrite-target: /$2\nspec:\n  ingressClassName: nginx\n  tls:\n    - hosts: [app.example.com]\n      secretName: app-tls\n  rules:\n    - host: app.example.com\n      http:\n        paths:\n          - path: /api(/|$)(.*)\n            pathType: ImplementationSpecific\n            backend: { service: { name: api, port: { number: 8080 } } }\n          - path: /static\n            pathType: Prefix\n            backend: { service: { name: static, port: { name: http } } }\n          - path: /static/private\n            pathType: Exact\n            backend: { service: { name: admin, port: { number: 80 } } }\n          - path: /\n            pathType: Prefix\n            backend: { service: { name: web, port: { number: 80 } } }\n    - host: "*.example.com"\n      http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend: { service: { name: wildcard, port: { number: 80 } } }\n---\napiVersion: v1\nkind: Service\nmetadata: { name: api }\nspec:\n  selector: { app: api }\n  ports: [{ port: 8080, targetPort: 3000 }]\n---\napiVersion: v1\nkind: Service\nmetadata: { name: web }\nspec:\n  selector: { app: web }\n  ports: [{ port: 80, targetPort: http }]\n---\napiVersion: v1\nkind: Service\nmetadata: { name: static }\nspec:\n  selector: { app: static }\n  ports: [{ name: http, port: 80, targetPort: 80 }]\n' },
    { id: 'urls', label: ['테스트할 요청 (한 줄에 URL 하나)', 'Requests to test (one URL per line)'], rows: 8, sample: 'https://app.example.com/\nhttps://app.example.com/api/users\nhttps://app.example.com/static/logo.png\nhttps://app.example.com/static/private\nhttps://app.example.com/static/private/x\nhttp://app.example.com/staticfile\nhttps://other.example.com/anything\nhttps://unknown.org/' }
  ],
  sampleExpectError: true,
  options: [],
  outputs: [{ id: 'table', label: ['라우팅 결과', 'Routing result'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var Y = TK.yamlx, issues = [];
    var src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('매니페스트를 입력하세요', 'Enter manifests'));
    var res; try { res = Y.parse(src); } catch (e) { throw new Error(t('YAML 문법 오류 (줄 ' + e.line + '): ', 'YAML syntax error (line ' + e.line + '): ') + e.message); }
    var objs = []; res.docs.forEach(function (d) { if (d.root && !d.error && Y.isMap(d.js)) { if (d.js.kind === 'List' && Array.isArray(d.js.items)) d.js.items.forEach(function (x) { objs.push(x); }); else objs.push(d.js); } });
    var ings = objs.filter(function (x) { return x.kind === 'Ingress'; }), svcs = objs.filter(function (x) { return x.kind === 'Service'; });
    var pods = objs.filter(function (x) { return ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Pod'].indexOf(x.kind) >= 0; });
    if (!ings.length) throw new Error(t('Ingress 리소스가 없습니다', 'There is no Ingress resource'));
    var urlLines = String(v.urls || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!urlLines.length) throw new Error(t('테스트할 URL 을 입력하세요', 'Enter URLs to test'));
    if (urlLines.length > 200) throw new Error(t('URL 은 200개까지 테스트할 수 있습니다', 'At most 200 URLs can be tested'));
    var rules = [];
    ings.forEach(function (ing) {
      var iname = (ing.metadata || {}).name || '?', ins = (ing.metadata || {}).namespace || 'default', spec = ing.spec || {}, anns = (ing.metadata || {}).annotations || {};
      (spec.rules || []).forEach(function (r) { ((r.http && r.http.paths) || []).forEach(function (p) { rules.push({ ing: iname, ns: ins, host: r.host || '', path: p.path || '/', pathType: p.pathType || (spec.apiVersion ? 'ImplementationSpecific' : 'ImplementationSpecific'), backend: p.backend, anns: anns, tls: spec.tls || [], cls: spec.ingressClassName || anns['kubernetes.io/ingress.class'] || '' }); }); });
      if (spec.defaultBackend || spec.backend) rules.push({ ing: iname, ns: ins, host: '', path: '', def: true, backend: spec.defaultBackend || spec.backend, anns: anns, tls: spec.tls || [], cls: spec.ingressClassName || '' });
      if (!spec.ingressClassName && !anns['kubernetes.io/ingress.class']) issues.push('ℹ️ ' + t('Ingress "' + iname + '" 에 ingressClassName 이 없어 기본 IngressClass 가 처리합니다', 'Ingress "' + iname + '" has no ingressClassName; the default IngressClass handles it'));
    });
    function hostMatch(rh, h) { if (!rh) return 1; rh = rh.toLowerCase(); h = h.toLowerCase(); if (rh === h) return 3; if (rh.indexOf('*.') === 0) { var suffix = rh.slice(1), first = h.indexOf('.'); return first > 0 && h.slice(first) === suffix ? 2 : 0; } return 0; }
    function pathMatch(rule, p) {
      var rp = rule.path;
      if (rule.def) return -1;
      if (rule.pathType === 'Exact') return p === rp ? rp.length + 0.5 : -1;
      if (rule.pathType === 'Prefix') { if (rp === '/') return 1; var trimmed = rp.replace(/\/+$/, ''); if (p === trimmed || p.indexOf(trimmed + '/') === 0) return trimmed.length; return -1; }
      /* ImplementationSpecific: 컨트롤러 의존 — nginx 는 접두사, use-regex 면 정규식 */
      var useRegex = rule.anns['nginx.ingress.kubernetes.io/use-regex'] === 'true' || /\$\d|[()*+?\[\]|^$]/.test(rp) && /rewrite-target/.test(Object.keys(rule.anns).join(','));
      if (useRegex || /[()*+?\[\]|^$\\]/.test(rp)) { try { var re = new RegExp('^' + rp.replace(/^\^/, '')); if (re.test(p)) return rp.length; return -1; } catch (e) { return -1; } }
      if (rp === '/') return 1; var tr = rp.replace(/\/+$/, ''); return p === tr || p.indexOf(tr + '/') === 0 ? tr.length : -1;
    }
    function findSvc(name, ns) { return svcs.filter(function (s) { var m = s.metadata || {}; return m.name === name && (m.namespace || 'default') === ns; })[0]; }
    var rows = [];
    urlLines.forEach(function (u) {
      var m = /^(https?):\/\/([^\/:?#]+)(?::(\d+))?(\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i.exec(u);
      if (!m) { var m2 = /^([A-Za-z0-9*.-]+)(\/[^?#]*)?$/.exec(u); if (!m2) { rows.push([u, '—', '—', '⛔ ' + t('URL 형식이 올바르지 않습니다 (예: https://host/path)', 'Invalid URL (e.g. https://host/path)'), '']); return; } m = [u, 'http', m2[1], '', m2[2] || '/']; }
      var scheme = m[1].toLowerCase(), host = m[2], path = m[4] || '/', best = null, bestScore = null;
      try { path = decodeURI(path); } catch (e) { /* 그대로 */ }
      rules.forEach(function (r) {
        var hs = r.def ? 0.5 : hostMatch(r.host, host); if (!hs) return;
        var ps = r.def ? 0 : pathMatch(r, path); if (ps < 0 && !r.def) return;
        var score = [hs === 3 ? 2 : hs === 2 ? 1 : r.host ? 1 : 0, r.def ? -1 : ps, r.pathType === 'Exact' ? 1 : 0];
        if (!r.def && hs === 1 && r.host === '') score[0] = 0;
        if (!best || score[0] > bestScore[0] || (score[0] === bestScore[0] && (score[1] > bestScore[1] || (score[1] === bestScore[1] && score[2] > bestScore[2])))) { best = r; bestScore = score; }
      });
      if (!best) { rows.push([u, '—', '—', '⛔ ' + t('일치하는 규칙 없음 → 404 (default backend 가 있으면 그쪽)', 'No rule matches → 404 (or the default backend)'), '']); return; }
      var b = best.backend || {}, sv = b.service || (b.serviceName ? { name: b.serviceName, port: { number: b.servicePort } } : null), target = '—', note = [];
      if (sv) {
        var svc = findSvc(sv.name, best.ns), pn = sv.port && (sv.port.number !== undefined ? sv.port.number : sv.port.name);
        target = sv.name + ':' + (pn === undefined ? '?' : pn);
        if (!svc) note.push(t('Service "' + sv.name + '" 이 이 파일에 없음', 'Service "' + sv.name + '" is not in this file'));
        else {
          var sp = ((svc.spec || {}).ports || []).filter(function (x) { return sv.port && ((sv.port.number !== undefined && x.port === sv.port.number) || (sv.port.name && x.name === sv.port.name)); })[0];
          if (!sp) note.push('⛔ ' + t('Service 에 포트 ' + pn + ' 가 없음', 'The Service has no port ' + pn));
          else { var tp = sp.targetPort !== undefined ? sp.targetPort : sp.port; target += ' → pod:' + tp; var sel = (svc.spec || {}).selector; if (sel) { var ok = pods.some(function (p) { var tl = ((((p.spec || {}).template || {}).metadata || {}).labels) || ((p.metadata || {}).labels) || {}; return Object.keys(sel).every(function (k) { return String(tl[k]) === String(sel[k]); }); }); if (!ok && pods.length) note.push('⚠️ ' + t('selector 와 일치하는 파드 없음', 'no pod matches the selector')); } }
        }
      } else if (b.resource) target = (b.resource.kind || 'resource') + '/' + b.resource.name;
      var rw = best.anns['nginx.ingress.kubernetes.io/rewrite-target'], redirect = best.anns['nginx.ingress.kubernetes.io/ssl-redirect'];
      if (rw) { var np = rw; if (/\$\d/.test(rw)) { try { var mm = new RegExp('^' + best.path.replace(/^\^/, '')).exec(path); if (mm) np = rw.replace(/\$(\d)/g, function (_, d) { return mm[+d] || ''; }); } catch (e) { np = rw; } } note.push(t('rewrite → ', 'rewrite → ') + np); }
      if (scheme === 'http') { var hasTls = best.tls.some(function (tl) { return (tl.hosts || []).some(function (h) { return hostMatch(h, host) >= 2; }); }); if (hasTls && redirect !== 'false') note.push(t('TLS 호스트라 https 로 리다이렉트(308)될 수 있음', 'a TLS host, so a redirect (308) to https is likely')); }
      rows.push([u, best.ing + ' · ' + (best.def ? 'defaultBackend' : (best.host || '*') + ' ' + best.path + ' (' + best.pathType + ')'), target, note.length ? note.join(' · ') : '✅', best.cls || '']);
    });
    /* 정적 점검 */
    var seen = {};
    rules.forEach(function (r) { if (r.def) return; var key = r.host + '|' + r.path + '|' + r.pathType; if (seen[key]) issues.push('⚠️ ' + t('같은 호스트·경로 규칙이 중복됩니다: ' + (r.host || '*') + ' ' + r.path + ' (' + seen[key] + ' 와 ' + r.ing + ')', 'Duplicate host and path rule: ' + (r.host || '*') + ' ' + r.path + ' (' + seen[key] + ' and ' + r.ing + ')')); seen[key] = r.ing; if (r.path && r.path.charAt(0) !== '/' && r.pathType !== 'ImplementationSpecific') issues.push('⛔ ' + t('path "' + r.path + '" 는 /로 시작해야 합니다', 'path "' + r.path + '" must start with /')); });
    rules.forEach(function (r) { if (r.pathType === 'ImplementationSpecific' && !r.def) { issues.push('ℹ️ ' + t('ImplementationSpecific 경로 "' + r.path + '" 의 해석은 Ingress 컨트롤러마다 다릅니다 (nginx 는 접두사, use-regex 면 정규식). 이 도구는 nginx 동작을 따릅니다', 'The meaning of the ImplementationSpecific path "' + r.path + '" depends on the controller (nginx: prefix, or regex with use-regex); this tool follows nginx')); } });
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    issues.length = 0; uniq.forEach(function (x) { issues.push(x); });
    issues.push(t('우선순위: 정확한 호스트 > 와일드카드 호스트 > 호스트 없음, 같은 호스트 안에서는 Exact > 가장 긴 Prefix 순서입니다. Prefix 는 경로 요소 단위로 비교해 /static 은 /staticfile 과 일치하지 않습니다', 'Precedence: exact host > wildcard host > no host; within a host Exact beats the longest Prefix. Prefix matches by path element, so /static does not match /staticfile'));
    var bad = rows.filter(function (r) { return /⛔/.test(r[3]); }).length;
    return { _status: { ok: bad ? false : true, msg: bad ? t('⛔ 라우팅 실패 ' + bad + '건 — 요청 ' + rows.length + '개', '⛔ ' + bad + ' routing failure(s) — ' + rows.length + ' request(s)') : t('✅ 요청 ' + rows.length + '개를 모두 라우팅했습니다', '✅ Routed all ' + rows.length + ' request(s)') }, table: { head: [['요청', 'Request'], ['일치한 규칙', 'Matched rule'], ['백엔드', 'Backend'], ['비고', 'Notes'], ['클래스', 'Class']], rows: rows }, issues: issues };
  }
});
