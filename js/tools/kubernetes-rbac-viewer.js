TK.tool('kubernetes-rbac-viewer', {
  inputs: [
    { id: 'in', label: ['RBAC 매니페스트 (Role · ClusterRole · RoleBinding · ClusterRoleBinding)', 'RBAC manifests (Role, ClusterRole, RoleBinding, ClusterRoleBinding)'], rows: 22, sample: 'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata: { name: pod-reader, namespace: dev }\nrules:\n  - apiGroups: [""]\n    resources: ["pods", "pods/log"]\n    verbs: ["get", "list", "watch"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata: { name: read-pods, namespace: dev }\nsubjects:\n  - kind: User\n    name: alice\n    apiGroup: rbac.authorization.k8s.io\n  - kind: ServiceAccount\n    name: ci\n    namespace: dev\nroleRef: { kind: Role, name: pod-reader, apiGroup: rbac.authorization.k8s.io }\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole\nmetadata: { name: secret-admin }\nrules:\n  - apiGroups: [""]\n    resources: ["secrets"]\n    verbs: ["*"]\n  - apiGroups: [""]\n    resources: ["pods/exec"]\n    verbs: ["create"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRoleBinding\nmetadata: { name: ops }\nsubjects:\n  - kind: Group\n    name: ops-team\n    apiGroup: rbac.authorization.k8s.io\nroleRef: { kind: ClusterRole, name: secret-admin, apiGroup: rbac.authorization.k8s.io }\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRoleBinding\nmetadata: { name: root-ci }\nsubjects:\n  - kind: ServiceAccount\n    name: deployer\n    namespace: kube-system\nroleRef: { kind: ClusterRole, name: cluster-admin, apiGroup: rbac.authorization.k8s.io }\n' },
    { id: 'who', type: 'text', label: ['권한을 확인할 주체 (예: User:alice · Group:ops-team · ServiceAccount:dev:ci)', 'Subject to check (e.g. User:alice, Group:ops-team, ServiceAccount:dev:ci)'], sample: 'ServiceAccount:dev:ci' },
    { id: 'what', type: 'text', label: ['확인할 동작: 동사 리소스[/하위리소스] [네임스페이스]  (예: get pods dev · create pods/exec · list secrets)', 'Action to check: verb resource[/subresource] [namespace] (e.g. get pods dev, create pods/exec, list secrets)'], sample: 'list pods dev' }
  ],
  sampleExpectError: true,
  options: [],
  outputs: [{ id: 'table', label: ['주체별 권한', 'Permissions per subject'], kind: 'table' }, { id: 'can', label: ['권한 확인 결과', 'Permission check'], kind: 'table' }, { id: 'issues', label: ['위험 점검', 'Risk review'], kind: 'list' }],
  run: function (v, o, t) {
    var Y = TK.yamlx, issues = [];
    var src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('RBAC 매니페스트를 입력하세요', 'Enter RBAC manifests'));
    var res; try { res = Y.parse(src); } catch (e) { throw new Error(t('YAML 문법 오류 (줄 ' + e.line + '): ', 'YAML syntax error (line ' + e.line + '): ') + e.message); }
    var objs = [], lines = {}; res.docs.forEach(function (d) { if (d.root && !d.error && Y.isMap(d.js)) { var arr = d.js.kind === 'List' && Array.isArray(d.js.items) ? d.js.items : [d.js]; arr.forEach(function (x) { objs.push(x); if (x.metadata && x.metadata.name) lines[x.kind + '/' + (x.metadata.namespace || '') + '/' + x.metadata.name] = d.root.line; }); } });
    var roles = objs.filter(function (x) { return x.kind === 'Role'; }), croles = objs.filter(function (x) { return x.kind === 'ClusterRole'; });
    var rbs = objs.filter(function (x) { return x.kind === 'RoleBinding'; }), crbs = objs.filter(function (x) { return x.kind === 'ClusterRoleBinding'; });
    if (!roles.length && !croles.length && !rbs.length && !crbs.length) throw new Error(t('Role/ClusterRole/RoleBinding/ClusterRoleBinding 이 없습니다', 'No Role, ClusterRole, RoleBinding or ClusterRoleBinding found'));
    var BUILTIN = { 'cluster-admin': [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }, { nonResourceURLs: ['*'], verbs: ['*'] }], admin: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'], note: 'namespace admin' }], edit: [{ apiGroups: ['*'], resources: ['*'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'], note: 'edit (secrets 포함, roles/rolebindings 제외)' }], view: [{ apiGroups: ['*'], resources: ['*'], verbs: ['get', 'list', 'watch'], note: 'view (secrets 제외)' }] };
    function roleRules(kind, name, ns) {
      var r = kind === 'Role' ? roles.filter(function (x) { return x.metadata.name === name && (x.metadata.namespace || 'default') === ns; })[0] : croles.filter(function (x) { return x.metadata.name === name; })[0];
      if (r) {
        var rules = (r.rules || []).slice();
        if (kind === 'ClusterRole' && r.aggregationRule) issues.push('ℹ️ ' + t('ClusterRole "' + name + '" 은 aggregationRule 로 다른 ClusterRole 의 규칙을 합칩니다 (이 파일의 레이블 일치 ClusterRole 만 반영)', 'ClusterRole "' + name + '" aggregates rules of other ClusterRoles via aggregationRule (only label-matching ones in this file are included)'));
        if (kind === 'ClusterRole' && r.aggregationRule) { var sels = (r.aggregationRule.clusterRoleSelectors || []); croles.forEach(function (cr) { if (cr !== r && sels.some(function (s) { var ml = s.matchLabels || {}; return Object.keys(ml).every(function (k) { return ((cr.metadata || {}).labels || {})[k] === ml[k]; }); })) rules = rules.concat(cr.rules || []); }); }
        return { rules: rules, found: true };
      }
      if (kind === 'ClusterRole' && BUILTIN[name]) return { rules: BUILTIN[name], found: true, builtin: true };
      return { rules: [], found: false };
    }
    function subjKey(s, bns) { var k = s.kind; if (k === 'ServiceAccount') return 'ServiceAccount:' + (s.namespace || bns || 'default') + ':' + s.name; return k + ':' + s.name; }
    var grants = [];
    rbs.forEach(function (b) { var ns = (b.metadata || {}).namespace || 'default', ref = b.roleRef || {}; var rr = roleRules(ref.kind, ref.name, ns); if (!rr.found) issues.push('⚠️ ' + t('RoleBinding "' + b.metadata.name + '" 의 roleRef ' + ref.kind + ' "' + ref.name + '" 이 이 파일에 없습니다', 'roleRef ' + ref.kind + ' "' + ref.name + '" of RoleBinding "' + b.metadata.name + '" is not in this file')); (b.subjects || []).forEach(function (s) { grants.push({ subj: subjKey(s, ns), scope: ns, binding: 'RoleBinding/' + b.metadata.name, role: ref.kind + '/' + ref.name, rules: rr.rules, found: rr.found }); }); });
    crbs.forEach(function (b) { var ref = b.roleRef || {}; var rr = roleRules(ref.kind, ref.name, ''); if (!rr.found) issues.push('⚠️ ' + t('ClusterRoleBinding "' + b.metadata.name + '" 의 roleRef ' + ref.kind + ' "' + ref.name + '" 이 이 파일에 없습니다', 'roleRef ' + ref.kind + ' "' + ref.name + '" of ClusterRoleBinding "' + b.metadata.name + '" is not in this file')); (b.subjects || []).forEach(function (s) { grants.push({ subj: subjKey(s, ''), scope: '*', binding: 'ClusterRoleBinding/' + b.metadata.name, role: ref.kind + '/' + ref.name, rules: rr.rules, found: rr.found }); }); });
    function sumRules(rules) { return rules.map(function (r) { if (r.nonResourceURLs) return 'URL ' + r.nonResourceURLs.join(',') + ': ' + (r.verbs || []).join(','); return (r.apiGroups || ['']).map(function (g) { return g === '' ? 'core' : g; }).join('|') + '/' + (r.resources || []).join(',') + (r.resourceNames ? '[' + r.resourceNames.join(',') + ']' : '') + ': ' + (r.verbs || []).join(','); }).join(' ; '); }
    var rows = grants.map(function (g) { return [g.subj, g.scope === '*' ? t('클러스터 전체', 'cluster-wide') : t('네임스페이스 ', 'namespace ') + g.scope, g.binding, g.role, g.found ? sumRules(g.rules) : t('(규칙을 찾을 수 없음)', '(rules not found)')]; });
    /* 위험 점검 */
    var DANGER = [
      { test: function (r) { return (r.verbs || []).indexOf('*') >= 0 && (r.resources || []).indexOf('*') >= 0; }, msg: t('모든 리소스에 모든 동사(*)를 허용합니다 (사실상 관리자)', 'Allows every verb on every resource (effectively admin)') },
      { test: function (r) { return (r.resources || []).indexOf('secrets') >= 0 && hasAny(r, ['get', 'list', 'watch', '*']); }, msg: t('Secret 을 읽을 수 있습니다 (list/watch 도 값 노출)', 'Can read Secrets (list / watch also expose values)') },
      { test: function (r) { return (r.resources || []).some(function (x) { return x === 'pods/exec' || x === 'pods/attach' || x === 'pods/*'; }) && hasAny(r, ['create', 'get', '*']); }, msg: t('파드에 exec/attach 할 수 있습니다 (컨테이너 안 명령 실행·Secret 탈취 가능)', 'Can exec / attach into pods (run commands, steal secrets)') },
      { test: function (r) { return (r.resources || []).indexOf('pods') >= 0 && hasAny(r, ['create', '*']); }, msg: t('파드를 만들 수 있습니다 (hostPath·privileged 파드로 권한 상승 가능)', 'Can create pods (privilege escalation via hostPath or privileged pods)') },
      { test: function (r) { return hasAny(r, ['escalate', 'bind', 'impersonate']); }, msg: t('escalate/bind/impersonate 동사는 RBAC 권한 상승에 쓰입니다', 'The escalate / bind / impersonate verbs enable RBAC privilege escalation') },
      { test: function (r) { return (r.resources || []).some(function (x) { return /^(clusterroles|clusterrolebindings|roles|rolebindings)$/.test(x); }) && hasAny(r, ['create', 'update', 'patch', '*']); }, msg: t('Role/Binding 을 직접 수정해 스스로 권한을 올릴 수 있습니다', 'Can edit Roles / Bindings and raise its own privileges') },
      { test: function (r) { return (r.resources || []).some(function (x) { return x === 'nodes/proxy' || x === 'nodes'; }) && hasAny(r, ['get', 'create', '*']) && (r.resources || []).indexOf('nodes/proxy') >= 0; }, msg: t('nodes/proxy 는 kubelet API 로 모든 파드에 접근하는 경로입니다', 'nodes/proxy reaches every pod through the kubelet API') },
      { test: function (r) { return (r.resources || []).indexOf('serviceaccounts/token') >= 0 && hasAny(r, ['create', '*']); }, msg: t('다른 ServiceAccount 의 토큰을 발급할 수 있습니다', 'Can mint tokens for other ServiceAccounts') },
      { test: function (r) { return (r.apiGroups || []).indexOf('*') >= 0 && (r.resources || []).indexOf('*') < 0 && hasAny(r, ['*']); }, msg: t('모든 API 그룹에 와일드카드 동사를 허용합니다', 'Wildcard verbs on all API groups') }
    ];
    function hasAny(r, list) { return (r.verbs || []).some(function (x) { return list.indexOf(x) >= 0; }); }
    var seenI = {};
    grants.forEach(function (g) {
      if (/^ClusterRole\/cluster-admin$/.test(g.role)) { var key0 = g.subj + 'ca'; if (!seenI[key0]) { seenI[key0] = 1; issues.push('⛔ ' + g.subj + ': ' + t(g.scope === '*' ? 'cluster-admin 을 클러스터 전체에 바인딩했습니다' : 'cluster-admin 을 네임스페이스 ' + g.scope + ' 에 바인딩했습니다 (그 네임스페이스에서는 관리자)', g.scope === '*' ? 'cluster-admin is bound cluster-wide' : 'cluster-admin is bound in namespace ' + g.scope + ' (admin there)')); } return; }
      g.rules.forEach(function (r) { if (r.nonResourceURLs) return; DANGER.forEach(function (d, di) { if (d.test(r)) { var key = g.subj + '|' + g.role + '|' + di; if (!seenI[key]) { seenI[key] = 1; issues.push((di === 0 ? '⛔ ' : '⚠️ ') + g.subj + ' (' + g.role + (g.scope === '*' ? ', ' + t('클러스터 전체', 'cluster-wide') : ', ' + g.scope) + '): ' + d.msg); } } }); });
      if (g.subj === 'Group:system:authenticated' || g.subj === 'Group:system:unauthenticated' || g.subj === 'Group:system:serviceaccounts') issues.push('⛔ ' + g.subj + ': ' + t('넓은 그룹에 권한을 부여했습니다 (모든 인증된/익명 사용자 또는 모든 ServiceAccount)', 'Grants to a very broad group (all authenticated / anonymous users or every ServiceAccount)'));
      if (g.subj === 'ServiceAccount:default:default' || /^ServiceAccount:[^:]+:default$/.test(g.subj)) issues.push('⚠️ ' + g.subj + ': ' + t('default ServiceAccount 에 권한을 주면 그 네임스페이스의 모든 파드가 권한을 갖게 됩니다. 전용 ServiceAccount 를 만드세요', 'Granting the default ServiceAccount gives every pod in the namespace those rights; create a dedicated ServiceAccount'));
    });
    /* 권한 질의 */
    var canRows = [], who = String(v.who || '').trim(), what = String(v.what || '').trim();
    if (who && what) {
      var parts = what.split(/\s+/); if (parts.length < 2) throw new Error(t('동작은 "동사 리소스 [네임스페이스]" 형식입니다 (예: get pods dev)', 'Use "verb resource [namespace]" (e.g. get pods dev)'));
      var verb = parts[0].toLowerCase(), resFull = parts[1].toLowerCase(), qns = parts[2] || 'default', rsplit = resFull.split('/'), resBase = rsplit[0], sub = rsplit[1] || '';
      var rname = parts[3] || '';
      var matched = [];
      grants.filter(function (g) { return g.subj.toLowerCase() === who.toLowerCase() || (/^Group:/i.test(g.subj) && false); }).forEach(function (g) {
        if (g.scope !== '*' && g.scope !== qns) return;
        g.rules.forEach(function (r) {
          if (r.nonResourceURLs) return;
          var verbOk = (r.verbs || []).indexOf('*') >= 0 || (r.verbs || []).map(function (x) { return String(x).toLowerCase(); }).indexOf(verb) >= 0;
          var resOk = (r.resources || []).some(function (x) { x = String(x).toLowerCase(); if (x === '*') return true; if (x === resFull) return true; if (!sub && x === resBase) return true; if (x === resBase + '/*' && sub) return true; if (x === '*/' + sub && sub) return true; return false; });
          var nameOk = !r.resourceNames || !r.resourceNames.length || (rname && r.resourceNames.indexOf(rname) >= 0);
          if (verbOk && resOk && nameOk) matched.push(g.binding + ' → ' + g.role + (r.resourceNames ? ' [' + r.resourceNames.join(',') + ']' : ''));
        });
      });
      var groupHint = grants.some(function (g) { return /^Group:/i.test(g.subj); }) && !/^Group:/i.test(who);
      canRows.push([who, verb + ' ' + resFull + (rname ? '/' + rname : '') + ' (ns ' + qns + ')', matched.length ? '✅ ' + t('허용', 'allowed') : '⛔ ' + t('허용되지 않음', 'not allowed'), matched.length ? matched.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' ; ') : t('일치하는 규칙 없음', 'no matching rule')]);
      if (groupHint && !matched.length) issues.push('ℹ️ ' + t('주체가 속한 그룹(Group)을 통해 얻는 권한은 계산하지 않습니다. 그룹 이름 자체를 주체로 질의하세요 (예: Group:ops-team)', 'Permissions inherited through groups are not computed; query the group itself (e.g. Group:ops-team)'));
      if (parts[1] && /\*/.test(parts[1])) throw new Error(t('질의에는 와일드카드를 쓸 수 없습니다', 'Wildcards are not allowed in the query'));
    }
    var ICO = function (x) { return x.indexOf('⛔') === 0 ? 0 : x.indexOf('⚠️') === 0 ? 1 : 2; };
    issues.sort(function (a, b) { return ICO(a) - ICO(b); });
    issues.push(t('RBAC 은 허용만 있고 거부 규칙이 없습니다. 여러 바인딩의 권한이 합쳐집니다. 그룹·인증서 CN 으로 얻는 권한과 클러스터에 이미 있는 바인딩은 이 파일에 없으면 반영되지 않습니다', 'RBAC only allows (there are no deny rules) and permissions from all bindings add up. Group memberships and bindings that exist in the cluster but not in this file are not reflected'));
    var danger = issues.filter(function (x) { return x.indexOf('⛔') === 0; }).length;
    return { _status: { ok: danger ? false : true, msg: danger ? t('⛔ 위험한 권한 ' + danger + '건 — 바인딩 ' + (rbs.length + crbs.length) + '개, 주체 ' + new Set(grants.map(function (g) { return g.subj; })).size + '개', '⛔ ' + danger + ' risky grant(s) — ' + (rbs.length + crbs.length) + ' binding(s), ' + new Set(grants.map(function (g) { return g.subj; })).size + ' subject(s)') : t('✅ 심각한 위험 없음 — 바인딩 ' + (rbs.length + crbs.length) + '개', '✅ No severe risks — ' + (rbs.length + crbs.length) + ' binding(s)') }, table: { head: [['주체', 'Subject'], ['범위', 'Scope'], ['바인딩', 'Binding'], ['역할', 'Role'], ['권한 (apiGroup/리소스: 동사)', 'Rules (apiGroup/resource: verbs)']], rows: rows }, can: { head: [['주체', 'Subject'], ['동작', 'Action'], ['결과', 'Result'], ['근거', 'Granted by']], rows: canRows }, issues: issues };
  }
});
