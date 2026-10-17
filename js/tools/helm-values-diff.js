TK.tool('helm-values-diff', {
  inputs: [
    { id: 'a', label: ['이전 values.yaml', 'Old values.yaml'], rows: 14, sample: 'replicaCount: 2\nimage:\n  repository: nginx\n  tag: "1.25"\n  pullPolicy: IfNotPresent\nservice:\n  type: ClusterIP\n  port: 80\ningress:\n  enabled: false\n  hosts:\n    - host: a.example.com\nresources:\n  limits:\n    cpu: 500m\n    memory: 256Mi\nnodeSelector: {}\n' },
    { id: 'b', label: ['새 values.yaml', 'New values.yaml'], rows: 14, sample: 'replicaCount: 3\nimage:\n  repository: nginx\n  tag: "1.27"\n  pullPolicy: IfNotPresent\nservice:\n  type: LoadBalancer\n  port: "80"\ningress:\n  enabled: true\n  hosts:\n    - host: a.example.com\n    - host: b.example.com\nresources:\n  limits:\n    memory: 512Mi\nautoscaling:\n  enabled: true\n  maxReplicas: 10\n' }
  ],
  options: [
    { id: 'show', type: 'select', label: ['표시', 'Show'], choices: [['changes', ['변경된 것만', 'Changes only']], ['all', ['모두 (같은 값 포함)', 'All (including equal)']]], default: 'changes' },
    { id: 'eq', type: 'checkbox', label: ['"80" 과 80 처럼 타입만 다른 값도 변경으로 표시', 'Flag type-only changes such as "80" vs 80'], default: true }
  ],
  outputs: [{ id: 'table', label: ['차이', 'Differences'], kind: 'table' }, { id: 'set', label: ['helm --set 인자 (스칼라 변경·추가)', 'helm --set arguments (scalar changes and additions)'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var Y = TK.yamlx, issues = [];
    function load(txt, label) {
      if (!String(txt).trim()) throw new Error(t(label + ' 를 입력하세요', 'Enter the ' + label));
      var r; try { r = Y.parse(String(txt)); } catch (e) { throw new Error(label + ' ' + t('YAML 문법 오류 (줄 ', 'YAML syntax error (line ') + e.line + '): ' + e.message); }
      var d = r.docs[0]; if (!d || !d.root) return {}; if (d.error) throw new Error(d.error.message);
      if (d.js === null) return {};
      if (!Y.isMap(d.js)) throw new Error(label + ' ' + t('의 최상위가 매핑이 아닙니다', ' top level is not a mapping'));
      d.dups.forEach(function (x) { issues.push('⚠️ ' + label + ' ' + t('줄 ', 'line ') + x.line + t(': 키 "', ': duplicate key "') + x.key + t('" 중복', '"')); });
      return d.js;
    }
    var A = load(v.a, t('이전 values', 'old values')), B = load(v.b, t('새 values', 'new values'));
    function flat(x, path, out) {
      if (Array.isArray(x)) { if (!x.length) out[path] = { v: [], leaf: true }; else { out[path] = { v: x, list: true }; x.forEach(function (e, i) { flat(e, path + '[' + i + ']', out); }); } }
      else if (Y.isMap(x)) { var ks = Object.keys(x); if (!ks.length) { if (path) out[path] = { v: {}, leaf: true }; } else ks.forEach(function (k) { flat(x[k], path ? path + '.' + (/[.]/.test(k) ? k.replace(/\./g, '\\.') : k) : (/[.]/.test(k) ? k.replace(/\./g, '\\.') : k), out); }); }
      else out[path] = { v: x, leaf: true };
      return out;
    }
    var fa = flat(A, '', {}), fb = flat(B, '', {}), keys = {}; Object.keys(fa).concat(Object.keys(fb)).forEach(function (k) { keys[k] = true; });
    var rows = [], sets = [], cnt = { added: 0, removed: 0, changed: 0, type: 0, same: 0 };
    function ty(x) { return x === null ? 'null' : Array.isArray(x) ? 'list' : typeof x; }
    function sh(x) { if (x === undefined) return ''; var s = typeof x === 'string' ? JSON.stringify(x) : JSON.stringify(x); return s.length > 60 ? s.slice(0, 60) + '…' : s; }
    function setArg(path, val) { var p = path.replace(/\[(\d+)\]/g, '[$1]'); if (typeof val === 'string') { var needStr = /^(true|false|null|[-+]?[0-9.]+(e[-+]?[0-9]+)?)$/i.test(val); return needStr ? '--set-string ' + p + '=' + val : '--set ' + p + '=' + val.replace(/([,\\])/g, '\\$1'); } if (val === null) return '--set ' + p + '=null'; return '--set ' + p + '=' + val; }
    function pushSet(path, val) { if (path.indexOf('[') >= 0) { listSkipped = true; return; } sets.push(setArg(path, val)); }
    var listSkipped = false;
    Object.keys(keys).sort().forEach(function (k) {
      if (k === '') return;
      var a = fa[k], b = fb[k];
      if (a && a.list && b && b.list) { if (JSON.stringify(a.v) !== JSON.stringify(b.v)) issues.push('ℹ️ ' + t(k + ' 는 리스트입니다. Helm 은 values 병합 때 리스트를 합치지 않고 통째로 바꿉니다', k + ' is a list; Helm replaces lists wholesale instead of merging them')); return; }
      if (!a) { if (b.list) return; cnt.added++; rows.push(['➕', k, '', sh(b.v), '']); if (b.leaf && !Array.isArray(b.v) && !Y.isMap(b.v)) pushSet(k, b.v); return; }
      if (!b) { if (a.list) return; cnt.removed++; rows.push(['➖', k, sh(a.v), '', '']); return; }
      if (a.list || b.list) { if (a.list !== b.list) { cnt.type++; rows.push(['⚠️', k, sh(a.v), sh(b.v), t('리스트 ↔ 값', 'list ↔ value')]); } return; }
      var same = JSON.stringify(a.v) === JSON.stringify(b.v);
      if (same) { cnt.same++; if (o.show === 'all') rows.push(['＝', k, sh(a.v), sh(b.v), '']); return; }
      var ta = ty(a.v), tb = ty(b.v);
      if (ta !== tb) {
        if (!o.eq && String(a.v) === String(b.v)) { cnt.same++; return; }
        cnt.type++; rows.push(['⚠️', k, sh(a.v), sh(b.v), ta + ' → ' + tb]);
        if (String(a.v) === String(b.v)) issues.push('⚠️ ' + t(k + ' 의 값은 같지만 타입이 ' + ta + ' → ' + tb + ' 로 바뀌었습니다. 차트 템플릿이 타입에 민감하면 오류가 날 수 있습니다', k + ' keeps the same text but its type changed ' + ta + ' → ' + tb + '; a type-sensitive chart template may fail'));
        else if (b.leaf && !Array.isArray(b.v) && !Y.isMap(b.v)) pushSet(k, b.v);
        return;
      }
      cnt.changed++; rows.push(['✏️', k, sh(a.v), sh(b.v), '']);
      if (b.leaf && !Array.isArray(b.v) && !Y.isMap(b.v)) pushSet(k, b.v);
    });
    if (cnt.added + cnt.removed + cnt.changed + cnt.type === 0) return { _status: t('✅ 두 values 의 내용이 같습니다 (키 순서·주석 무시)', '✅ The two values files are equal (key order and comments ignored)'), table: { head: [['', ''], ['경로', 'Path'], ['이전', 'Old'], ['새 값', 'New'], ['비고', 'Note']], rows: rows }, set: '', issues: issues };
    var removedCnt = cnt.removed; if (removedCnt) issues.push('ℹ️ ' + t('삭제된 키 ' + removedCnt + '개는 차트의 기본값이 다시 적용됩니다. 의도한 삭제인지 확인하세요', removedCnt + ' removed key(s) fall back to the chart defaults; confirm that is intended'));
    Object.keys(fb).forEach(function (k) { if (/(password|secret|token|apikey|api_key|privatekey)/i.test(k) && fb[k].leaf && fb[k].v && (!fa[k] || fa[k].v !== fb[k].v)) issues.push('⚠️ ' + t(k + ' 에 비밀 값이 values 에 그대로 있습니다. helm-secrets 나 외부 Secret 을 쓰세요', k + ' holds a secret in plain values; use helm-secrets or an external Secret')); });
    if (listSkipped) issues.push('ℹ️ ' + t('리스트 안의 변경은 --set 으로 만들지 않았습니다 (인덱스 지정은 의도치 않게 리스트를 바꿀 수 있음)', 'Changes inside lists are left out of --set (indexing can reshape the list unexpectedly)'));
    issues.push(t('--set 인자는 스칼라 값의 변경·추가만 만듭니다. 리스트 항목과 삭제는 values 파일(-f)로 전달하세요', 'The --set arguments cover scalar changes and additions only; pass lists and removals through a values file (-f)'));
    return { _status: t('➕ ' + cnt.added + ' · ➖ ' + cnt.removed + ' · ✏️ ' + cnt.changed + ' · ⚠️ 타입 ' + cnt.type, '➕ ' + cnt.added + ' · ➖ ' + cnt.removed + ' · ✏️ ' + cnt.changed + ' · ⚠️ type ' + cnt.type), table: { head: [['', ''], ['경로', 'Path'], ['이전', 'Old'], ['새 값', 'New'], ['비고', 'Note']], rows: rows }, set: sets.join(' \\\n  '), issues: issues };
  }
});
