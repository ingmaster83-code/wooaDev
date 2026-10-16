TK.tool('pep440-version-tester', {
  inputs: [
    { id: 'versions', label: ['버전 목록 (한 줄에 하나)', 'Versions (one per line)'], rows: 9, sample: '1.0\n1.0.post1\n1.0rc1\n1.0.dev3\n1.1\n1!0.5\n2.0a1\n2.0\n2.0.1+ubuntu.1\n1.0.0\nnot.a.version' },
    { id: 'spec', type: 'text', label: ['버전 지정자 (선택, 예: >=1.0,<2.0 · ~=1.0 · ==1.*)', 'Specifier (optional, e.g. >=1.0,<2.0 · ~=1.0 · ==1.*)'], sample: '>=1.0,<2.0' }
  ],
  options: [{ id: 'pre', type: 'checkbox', label: ['프리릴리스(a/b/rc/dev)도 일치 대상에 포함', 'Include pre-releases in matches'], default: false }],
  sampleExpectError: true,
  outputs: [{ id: 'table', label: ['정규화·정렬 결과', 'Normalised & sorted'], kind: 'table' }, { id: 'out', label: ['일치하는 가장 높은 버전', 'Highest matching version'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [];
    var RE = /^\s*v?(?:(\d+)!)?(\d+(?:\.\d+)*)(?:[-_.]?(alpha|a|beta|b|preview|pre|c|rc)[-_.]?(\d+)?)?(?:(?:-(\d+))|(?:[-_.]?(post|rev|r)[-_.]?(\d+)?))?(?:[-_.]?(dev)[-_.]?(\d+)?)?(?:\+([a-z0-9]+(?:[-_.][a-z0-9]+)*))?\s*$/i;
    function parse(s) {
      var m = RE.exec(s); if (!m) return null;
      var pre = null; if (m[3]) { var l = m[3].toLowerCase(); pre = [l === 'alpha' ? 'a' : l === 'beta' ? 'b' : (l === 'c' || l === 'pre' || l === 'preview') ? 'rc' : l, +(m[4] || 0)]; }
      var post = m[5] !== undefined ? +m[5] : (m[6] ? +(m[7] || 0) : null);
      return { epoch: +(m[1] || 0), rel: m[2].split('.').map(Number), pre: pre, post: post, dev: m[8] ? +(m[9] || 0) : null, local: m[10] ? m[10].toLowerCase().split(/[-_.]/).map(function (x) { return /^\d+$/.test(x) ? +x : x; }) : null };
    }
    function norm(p) { var r = p.rel.slice(); return (p.epoch ? p.epoch + '!' : '') + r.join('.') + (p.pre ? p.pre[0] + p.pre[1] : '') + (p.post !== null ? '.post' + p.post : '') + (p.dev !== null ? '.dev' + p.dev : '') + (p.local ? '+' + p.local.join('.') : ''); }
    function trimRel(r) { var a = r.slice(); while (a.length > 1 && a[a.length - 1] === 0) a.pop(); return a; }
    function cmpArr(a, b) { var n = Math.max(a.length, b.length); for (var i = 0; i < n; i++) { var x = a[i] === undefined ? 0 : a[i], y = b[i] === undefined ? 0 : b[i]; if (x !== y) return x < y ? -1 : 1; } return 0; }
    function cmp(a, b) {
      if (a.epoch !== b.epoch) return a.epoch < b.epoch ? -1 : 1;
      var c = cmpArr(trimRel(a.rel), trimRel(b.rel)); if (c) return c;
      function pk(p) { if (!p.pre && p.post === null && p.dev !== null) return [-1, 0]; if (!p.pre) return [3, 0]; return [{ a: 0, b: 1, rc: 2 }[p.pre[0]], p.pre[1]]; }
      var pa = pk(a), pb = pk(b); if (pa[0] !== pb[0]) return pa[0] < pb[0] ? -1 : 1; if (pa[1] !== pb[1]) return pa[1] < pb[1] ? -1 : 1;
      var xa = a.post === null ? -1 : a.post, xb = b.post === null ? -1 : b.post; if (xa !== xb) return xa < xb ? -1 : 1;
      var da = a.dev === null ? Infinity : a.dev, db = b.dev === null ? Infinity : b.dev; if (da !== db) return da < db ? -1 : 1;
      if (!a.local && !b.local) return 0; if (!a.local) return -1; if (!b.local) return 1;
      for (var i = 0; i < Math.max(a.local.length, b.local.length); i++) { var x = a.local[i], y = b.local[i]; if (x === undefined) return -1; if (y === undefined) return 1; if (x === y) continue; var nx = typeof x === 'number', ny = typeof y === 'number'; if (nx && !ny) return 1; if (!nx && ny) return -1; return x < y ? -1 : 1; }
      return 0;
    }
    var lines = String(v.versions).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('버전을 입력하세요', 'Enter some versions'));
    // 지정자
    var clauses = [], specText = String(v.spec || '').trim(), mentionsPre = false;
    if (specText) {
      specText.split(',').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (c) {
        var m = /^(===|==|!=|~=|<=|>=|<|>)\s*(.+)$/.exec(c); if (!m) throw new Error(t('지정자를 해석할 수 없습니다: "' + c + '"', 'Cannot parse specifier "' + c + '"'));
        var wild = /\.\*$/.test(m[2]), base = parse(wild ? m[2].slice(0, -2) : m[2]);
        if (!base && m[1] !== '===') throw new Error(t('지정자의 버전이 올바르지 않습니다: ' + m[2], 'Invalid version in the specifier: ' + m[2]));
        if (wild && m[1] !== '==' && m[1] !== '!=') throw new Error(t('.* 는 == 와 != 에서만 쓸 수 있습니다', '.* is only allowed with == and !='));
        if (m[1] === '~=' && base && base.rel.length < 2) throw new Error(t('~= 는 버전이 최소 2자리여야 합니다 (예: ~=1.4)', '~= needs at least two release segments (e.g. ~=1.4)'));
        if (base && (base.pre || base.dev !== null)) mentionsPre = true;
        clauses.push({ op: m[1], raw: m[2], wild: wild, v: base });
      });
    }
    function inRange(p, c) {
      var x = c.v, op = c.op;
      if (op === '===') return false;
      if (op === '==' || op === '!=') {
        var r;
        if (c.wild) { var n = x.rel.length; r = p.epoch === x.epoch && cmpArr(p.rel.slice(0, n), x.rel) === 0 && p.rel.length >= n; }
        else { var pp = x.local ? p : Object.assign({}, p, { local: null }); r = cmp(pp, x) === 0; }
        return op === '==' ? r : !r;
      }
      if (op === '>=') return cmp(p, x) >= 0;
      if (op === '<=') return cmp(Object.assign({}, p, { local: null }), x) <= 0 || cmp(p, x) <= 0;
      if (op === '>') { if (cmp(p, x) <= 0) return false; if (p.post !== null && x.post === null && cmpArr(trimRel(p.rel), trimRel(x.rel)) === 0 && p.epoch === x.epoch) return false; if (p.local && !x.local && cmp(Object.assign({}, p, { local: null }), x) === 0) return false; return true; }
      if (op === '<') { if (cmp(p, x) >= 0) return false; if (!x.pre && x.dev === null && (p.pre || p.dev !== null) && cmpArr(trimRel(p.rel), trimRel(x.rel)) === 0 && p.epoch === x.epoch) return false; return true; }
      if (op === '~=') { var pref = x.rel.slice(0, -1), ge = cmp(p, x) >= 0, same = p.epoch === x.epoch && cmpArr(p.rel.slice(0, pref.length), pref) === 0 && p.rel.length >= pref.length; return ge && same; }
      return false;
    }
    var items = [], bad = 0;
    lines.forEach(function (s) { var p = parse(s); if (!p) { bad++; items.push({ raw: s, bad: true }); } else items.push({ raw: s, p: p, n: norm(p) }); });
    var good = items.filter(function (i) { return !i.bad; }).sort(function (a, b) { return cmp(a.p, b.p); });
    var best = null, rows = [];
    good.forEach(function (it) {
      var isPre = !!it.p.pre || it.p.dev !== null, m = '';
      if (clauses.length) {
        var ok = clauses.every(function (c) { return c.v ? inRange(it.p, c) : false; });
        if (ok && isPre && !o.pre && !mentionsPre) { ok = false; m = '⛔ ' + t('프리릴리스 제외', 'pre-release excluded'); } else m = ok ? '✅' : '—';
        if (ok) best = it;
      }
      var notes = [];
      if (it.raw.toLowerCase().replace(/^v/, '') !== it.n) notes.push(t('정규화됨', 'normalised'));
      if (isPre) notes.push(it.p.dev !== null && !it.p.pre ? 'dev' : 'pre'); if (it.p.post !== null) notes.push('post'); if (it.p.local) notes.push('local');
      rows.push([it.raw, it.n, notes.join(', ') || t('정식', 'final'), m]);
    });
    items.filter(function (i) { return i.bad; }).forEach(function (i) { rows.push([i.raw, '❌', t('PEP 440 형식이 아닙니다', 'Not PEP 440'), '']); });
    var eqs = {}; good.forEach(function (it) { var k = it.n + '|' + trimRel(it.p.rel).join('.'); (eqs[trimRel(it.p.rel).join('.') + (it.p.pre ? it.p.pre.join('') : '') + it.p.post + it.p.dev + it.p.epoch + (it.p.local || '')] = eqs[trimRel(it.p.rel).join('.') + (it.p.pre ? it.p.pre.join('') : '') + it.p.post + it.p.dev + it.p.epoch + (it.p.local || '')] || []).push(it.raw); });
    Object.keys(eqs).forEach(function (k) { if (eqs[k].length > 1) issues.push(t('같은 버전으로 취급됩니다: ' + eqs[k].join(' = '), 'Treated as the same version: ' + eqs[k].join(' = '))); });
    if (good.some(function (g) { return g.p.epoch; })) issues.push(t('에포크(1!)가 있으면 에포크가 낮은 모든 버전보다 항상 큽니다', 'An epoch (1!) always outranks every version with a lower epoch'));
    issues.push(t('정렬 규칙: dev < a < b < rc < 정식 < post. 로컬 버전(+…)은 같은 공개 버전 중 가장 높게 취급됩니다', 'Ordering: dev < a < b < rc < final < post. Local versions (+…) rank above the same public version'));
    if (clauses.length && !mentionsPre && !o.pre) issues.push(t('지정자가 프리릴리스를 언급하지 않으면 pip 는 기본적으로 프리릴리스를 설치하지 않습니다 (--pre 필요)', 'Unless the specifier mentions a pre-release, pip skips pre-releases by default (needs --pre)'));
    return { _status: bad ? { ok: 'info', msg: t('🔍 ' + lines.length + '개 중 ' + bad + '개가 PEP 440 형식이 아닙니다', '🔍 ' + bad + ' of ' + lines.length + ' are not PEP 440') } : t('✅ ' + lines.length + '개 정규화', '✅ Normalised ' + lines.length), table: { head: [['입력', 'Input'], ['정규화', 'Normalised'], ['종류', 'Kind'], [clauses.length ? '일치' : '', clauses.length ? 'Match' : '']], rows: rows }, out: best ? best.n : (clauses.length ? t('(일치하는 버전 없음)', '(no matching version)') : ''), issues: issues };
  }
});
