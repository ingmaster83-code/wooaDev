TK.tool('kubernetes-label-selector', {
  inputs: [
    { id: 'selector', type: 'text', label: ['레이블 셀렉터 (kubectl -l 문법)', 'Label selector (kubectl -l syntax)'], sample: 'env=prod,tier in (frontend,backend),!deprecated,release notin (canary)' },
    { id: 'objects', label: ['테스트할 오브젝트 (한 줄에 하나: 이름: 키=값,키=값)', 'Objects to test (one per line: name: key=value,key=value)'], rows: 6, sample: 'web-1: env=prod,tier=frontend,app=shop\napi-1: env=prod,tier=backend,release=stable\napi-canary: env=prod,tier=backend,release=canary\nold-web: env=prod,tier=frontend,deprecated=true\ndb-1: env=prod,tier=data\nweb-dev: env=dev,tier=frontend' }
  ],
  options: [{ id: 'fmt', type: 'select', label: ['YAML 변환 형식', 'YAML output'], choices: [['sel', 'matchLabels / matchExpressions'], ['svc', ['Service selector (matchLabels 만)', 'Service selector (matchLabels only)']]], default: 'sel' }],
  outputs: [{ id: 'table', label: ['요구 조건', 'Requirements'], kind: 'table' }, { id: 'match', label: ['일치 여부', 'Match results'], kind: 'table' }, { id: 'manifest', label: ['YAML', 'YAML'], kind: 'code', ext: 'yml' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  allowEmpty: false,
  run: function (v, o, t) {
    var src = String(v.selector || '').trim(), issues = [];
    var NAME = /^([A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?)?$/, PFX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
    function checkKey(k) { var i = k.indexOf('/'), pre = i >= 0 ? k.slice(0, i) : '', nm = i >= 0 ? k.slice(i + 1) : k; if (!nm || nm.length > 63 || !NAME.test(nm)) return t('키 이름 "' + nm + '" 은(는) 63자 이하의 영문·숫자·- _ . 이며 영문/숫자로 시작·끝나야 합니다', 'Key name "' + nm + '" must be ≤63 chars of letters, digits, - _ . and start/end alphanumeric'); if (pre && (pre.length > 253 || !PFX.test(pre))) return t('접두사 "' + pre + '" 는 DNS 서브도메인 형식(소문자, 253자 이하)이어야 합니다', 'Prefix "' + pre + '" must be a DNS subdomain (lowercase, ≤253 chars)'); return ''; }
    function checkVal(x) { return x.length > 63 || !NAME.test(x) ? t('값 "' + x + '" 은(는) 63자 이하의 영문·숫자·- _ . 여야 합니다', 'Value "' + x + '" must be ≤63 chars of letters, digits, - _ .') : ''; }
    // 최상위 쉼표로 분리 (괄호 안 제외)
    var parts = [], depth = 0, cur = '';
    for (var i = 0; i < src.length; i++) { var ch = src[i]; if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
    parts.push(cur);
    if (depth !== 0) throw new Error(t('괄호가 짝이 맞지 않습니다', 'Unbalanced parentheses'));
    var reqs = [];
    parts.map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (p) {
      var m;
      if ((m = /^([^\s!=<>()]+)\s+(in|notin)\s*\(([^)]*)\)$/i.exec(p))) reqs.push({ k: m[1], op: m[2].toLowerCase() === 'in' ? 'in' : 'notin', vals: m[3].split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; }), raw: p });
      else if ((m = /^([^\s!=<>()]+)\s*(==|=|!=)\s*(.*)$/.exec(p))) reqs.push({ k: m[1], op: m[2] === '!=' ? 'neq' : 'eq', vals: [m[3].trim()], raw: p });
      else if ((m = /^([^\s!=<>()]+)\s*(>|<)\s*(-?\d+)$/.exec(p))) reqs.push({ k: m[1], op: m[2] === '>' ? 'gt' : 'lt', vals: [m[3]], raw: p });
      else if ((m = /^!\s*([^\s!=<>()]+)$/.exec(p))) reqs.push({ k: m[1], op: 'absent', vals: [], raw: p });
      else if ((m = /^([^\s!=<>()]+)$/.exec(p))) reqs.push({ k: m[1], op: 'exists', vals: [], raw: p });
      else throw new Error(t('해석할 수 없는 조건: "' + p + '"', 'Cannot parse requirement: "' + p + '"'));
    });
    if (!reqs.length) throw new Error(t('셀렉터가 비어 있습니다 (모든 오브젝트와 일치)', 'The selector is empty (it matches every object)'));
    var OPN = { eq: ['=', '같다', 'equals'], neq: ['!=', '다르거나 키 없음', 'differs or key missing'], in: ['in', '목록 중 하나', 'one of'], notin: ['notin', '목록에 없거나 키 없음', 'none of, or key missing'], exists: ['exists', '키가 존재', 'key exists'], absent: ['!key', '키가 없음', 'key absent'], gt: ['>', '정수로 더 큼', 'greater than (integer)'], lt: ['<', '정수로 더 작음', 'less than (integer)'] };
    var rows = reqs.map(function (r) {
      var e = checkKey(r.k); if (e) issues.push('🚨 ' + e);
      r.vals.forEach(function (x) { if (r.op !== 'gt' && r.op !== 'lt') { var ve = checkVal(x); if (ve) issues.push('🚨 ' + ve); } });
      if ((r.op === 'in' || r.op === 'notin') && !r.vals.length) issues.push('🚨 ' + t(r.k + ' ' + r.op + ' 의 값 목록이 비었습니다', r.k + ' ' + r.op + ' has an empty value list'));
      if (r.op === 'gt' || r.op === 'lt') issues.push(t('> / < 는 kubectl 과 노드 어피니티에서만 쓰고, Deployment·Service 의 selector 에는 쓸 수 없습니다', '> and < work in kubectl and node affinity only, not in Deployment / Service selectors'));
      return [r.k, OPN[r.op][0], r.vals.join(', ') || '—', t(OPN[r.op][1], OPN[r.op][2])];
    });
    // 중복 키 점검
    var seen = {}; reqs.forEach(function (r) { if (seen[r.k + r.op]) issues.push(t('같은 조건이 중복되었습니다: ' + r.raw, 'Duplicate requirement: ' + r.raw)); seen[r.k + r.op] = 1; });
    var objs = String(v.objects || '').replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).map(function (ln, idx) {
      var m = /^([^:=,]+):\s*(.*)$/.exec(ln), nm = m ? m[1].trim() : 'obj-' + (idx + 1), body = m ? m[2] : ln, labels = {};
      body.split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (kv) { var j = kv.indexOf('='); if (j < 0) labels[kv] = ''; else labels[kv.slice(0, j).trim()] = kv.slice(j + 1).trim(); });
      return { name: nm, labels: labels };
    });
    function evalReq(r, L) {
      var has = Object.prototype.hasOwnProperty.call(L, r.k), val = has ? L[r.k] : undefined;
      switch (r.op) {
        case 'eq': return has && val === r.vals[0];
        case 'neq': return !has || val !== r.vals[0];
        case 'in': return has && r.vals.indexOf(val) >= 0;
        case 'notin': return !has || r.vals.indexOf(val) < 0;
        case 'exists': return has;
        case 'absent': return !has;
        case 'gt': return has && /^-?\d+$/.test(val) && +val > +r.vals[0];
        case 'lt': return has && /^-?\d+$/.test(val) && +val < +r.vals[0];
      }
    }
    var mrows = [], nOk = 0;
    objs.forEach(function (ob) {
      var failed = reqs.filter(function (r) { return !evalReq(r, ob.labels); });
      if (!failed.length) nOk++;
      mrows.push([ob.name, failed.length ? '❌' : '✅', failed.length ? failed.map(function (r) { return r.raw + ' ' + t('(실패)', '(failed)'); }).join(' · ') : t('모든 조건 충족', 'All requirements met'), Object.keys(ob.labels).map(function (k) { return k + '=' + ob.labels[k]; }).join(', ')]);
    });
    var ml = [], me = [];
    reqs.forEach(function (r) {
      if (r.op === 'eq') ml.push([r.k, r.vals[0]]);
      else if (r.op === 'neq') me.push({ k: r.k, op: 'NotIn', vals: r.vals });
      else if (r.op === 'in') me.push({ k: r.k, op: 'In', vals: r.vals });
      else if (r.op === 'notin') me.push({ k: r.k, op: 'NotIn', vals: r.vals });
      else if (r.op === 'exists') me.push({ k: r.k, op: 'Exists', vals: [] });
      else if (r.op === 'absent') me.push({ k: r.k, op: 'DoesNotExist', vals: [] });
      else me.push({ k: r.k, op: r.op === 'gt' ? 'Gt' : 'Lt', vals: r.vals });
    });
    function yq(s) { return /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(s) && !/^(true|false|null|yes|no|on|off|y|n|\d+(\.\d+)?)$/i.test(s) ? s : JSON.stringify(s); }
    var y;
    if (o.fmt === 'svc') {
      y = 'selector:\n' + (ml.length ? ml.map(function (x) { return '  ' + yq(x[0]) + ': ' + yq(x[1]); }).join('\n') : '  {}');
      if (me.length) issues.push(t('Service 의 spec.selector 는 키=값(matchLabels)만 지원합니다. 집합 기반 조건 ' + me.length + '개는 변환되지 않았습니다', 'A Service spec.selector supports key=value only. ' + me.length + ' set-based requirement(s) were not converted'));
    } else {
      y = 'selector:';
      if (ml.length) y += '\n  matchLabels:\n' + ml.map(function (x) { return '    ' + yq(x[0]) + ': ' + yq(x[1]); }).join('\n');
      if (me.length) y += '\n  matchExpressions:\n' + me.map(function (e) { return '    - key: ' + yq(e.k) + '\n      operator: ' + e.op + (e.vals.length ? '\n      values: [' + e.vals.map(yq).join(', ') + ']' : ''); }).join('\n');
    }
    issues.push(t('!= 와 notin 은 해당 키가 아예 없는 오브젝트도 일치시킵니다', '!= and notin also match objects that do not have the key at all'));
    issues.push(t('Service/ReplicaSet 등 API 필드에서 빈 셀렉터는 "아무것도 일치하지 않음"이거나 "전부 일치"로 서로 다를 수 있습니다', 'An empty selector means "match nothing" in some API fields and "match everything" in others'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 레이블 문법 오류 ' + bad + '건', '❌ ' + bad + ' label syntax error(s)') } : objs.length ? t('✅ 조건 ' + reqs.length + '개 · ' + objs.length + '개 오브젝트 중 ' + nOk + '개 일치', '✅ ' + reqs.length + ' requirement(s) · ' + nOk + ' of ' + objs.length + ' object(s) match') : t('✅ 조건 ' + reqs.length + '개를 해석했습니다', '✅ Parsed ' + reqs.length + ' requirement(s)'), table: { head: [['키', 'Key'], ['연산자', 'Operator'], ['값', 'Values'], ['의미', 'Meaning']], rows: rows }, match: objs.length ? { head: [['오브젝트', 'Object'], ['결과', 'Result'], ['사유', 'Reason'], ['레이블', 'Labels']], rows: mrows } : null, manifest: y, issues: issues };
  }
});
