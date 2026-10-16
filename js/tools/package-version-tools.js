TK.tool('package-version-tools', {
  inputs: [
    { id: 'range', type: 'text', label: ['버전 제약 / 모듈 버전', 'Version constraint / module version'], sample: '^1.2.3 || ~2.0' },
    { id: 'versions', label: ['후보 버전 (한 줄에 하나)', 'Candidate versions (one per line)'], rows: 8, sample: '1.2.2\n1.2.3\n1.9.0\n2.0.0\n2.0.7\n2.1.0\n3.0.0\n1.5.0-beta.1' }
  ],
  options: [{ id: 'eco', type: 'select', label: ['생태계', 'Ecosystem'], choices: [['composer', 'Composer (PHP)'], ['cargo', 'Cargo (Rust)'], ['nuget', 'NuGet (.NET)'], ['go', 'Go modules']], default: 'composer' }],
  sampleOptions: { eco: 'composer' },
  outputs: [{ id: 'table', label: ['제약 해석', 'Constraint explained'], kind: 'table' }, { id: 'match', label: ['후보 버전 판정', 'Candidate verdicts'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var eco = o.eco, issues = [];
    function parseV(s, loose) {
      s = String(s).trim().replace(/^v/i, ''); var m = /^(\d+)(?:\.(\d+|[x*]))?(?:\.(\d+|[x*]))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(s);
      if (!m) return null;
      var parts = [+m[1]]; [m[2], m[3], m[4]].forEach(function (x) { parts.push(x === undefined ? undefined : /[x*]/.test(x) ? '*' : +x); });
      return { major: parts[0], minor: parts[1], patch: parts[2], rev: parts[3], pre: m[5] ? m[5].split('.') : null, raw: s };
    }
    function num(x) { return x === undefined || x === '*' ? 0 : x; }
    function cmpPre(a, b) { if (!a && !b) return 0; if (!a) return 1; if (!b) return -1; for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = a[i], y = b[i]; if (x === undefined) return -1; if (y === undefined) return 1; var nx = /^\d+$/.test(x), ny = /^\d+$/.test(y); if (nx && ny) { if (+x !== +y) return +x < +y ? -1 : 1; } else if (nx) return -1; else if (ny) return 1; else if (x !== y) return x < y ? -1 : 1; } return 0; }
    function cmp(a, b) { var A = [a.major, num(a.minor), num(a.patch), num(a.rev)], B = [b.major, num(b.minor), num(b.patch), num(b.rev)]; for (var i = 0; i < 4; i++) if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1; return cmpPre(a.pre, b.pre); }
    function mk(a, b, c, d) { return { major: a, minor: b, patch: c, rev: d }; }
    function show(x) { return x.major + '.' + num(x.minor) + '.' + num(x.patch) + (x.rev !== undefined && x.rev !== 0 ? '.' + x.rev : '') + (x.pre ? '-' + x.pre.join('.') : ''); }
    function caret(x) { var lo = x, hi; if (x.major > 0) hi = mk(x.major + 1, 0, 0); else if (x.minor !== undefined && x.minor !== '*' && x.minor > 0) hi = mk(0, x.minor + 1, 0); else if (x.patch !== undefined && x.patch !== '*') hi = mk(0, num(x.minor), x.patch + 1); else if (x.minor !== undefined && x.minor !== '*') hi = mk(0, x.minor + 1, 0); else hi = mk(1, 0, 0); return [{ op: '>=', v: lo }, { op: '<', v: hi }]; }
    function tilde(x) { if (eco === 'cargo' || eco === 'composer') { if (x.minor === undefined || x.minor === '*') return [{ op: '>=', v: x }, { op: '<', v: mk(x.major + 1, 0, 0) }]; if (x.patch === undefined || x.patch === '*') return eco === 'composer' ? [{ op: '>=', v: x }, { op: '<', v: mk(x.major + 1, 0, 0) }] : [{ op: '>=', v: x }, { op: '<', v: mk(x.major, x.minor + 1, 0) }]; return [{ op: '>=', v: x }, { op: '<', v: mk(x.major, x.minor + 1, 0) }]; } return [{ op: '>=', v: x }]; }
    function wild(x) { if (x.minor === undefined || x.minor === '*') return [{ op: '>=', v: mk(x.major, 0, 0) }, { op: '<', v: mk(x.major + 1, 0, 0) }]; return [{ op: '>=', v: mk(x.major, x.minor, 0) }, { op: '<', v: mk(x.major, x.minor + 1, 0) }]; }
    var text = String(v.range || '').trim(); if (!text) throw new Error(t('제약을 입력하세요', 'Enter a constraint'));
    var groups = [], rows = [], goInfo = null;
    if (eco === 'go') {
      var gm = /^v(\d+)\.(\d+)\.(\d+)(?:-((?:0\.|[0-9A-Za-z.-]*?\.0\.)?)(\d{14})-([0-9a-f]{12}))?(?:-([0-9A-Za-z.-]+))?(\+incompatible)?$/.exec(text);
      var gv = parseV(text.replace(/\+incompatible$/, '').replace(/-(?:[0-9A-Za-z.]*\.)?\d{14}-[0-9a-f]{12}$/, ''));
      if (!/^v\d/.test(text) || !gv) throw new Error(t('Go 모듈 버전은 v1.2.3 처럼 v로 시작해야 합니다', 'A Go module version starts with v, as in v1.2.3'));
      var pseudo = /^v\d+\.\d+\.\d+-(?:[0-9A-Za-z.]*\.)?0?\.?(\d{14})-([0-9a-f]{12})$/.exec(text) || /-(\d{14})-([0-9a-f]{12})$/.exec(text);
      rows.push([t('버전', 'version'), text], ['major', String(gv.major)], ['minor', String(num(gv.minor))], ['patch', String(num(gv.patch))]);
      if (pseudo) { var ts = pseudo[1]; rows.push([t('유사 버전(pseudo-version)', 'pseudo-version'), t('예 — 태그 없는 커밋', 'yes — an untagged commit')], [t('커밋 시각(UTC)', 'commit time (UTC)'), ts.slice(0, 4) + '-' + ts.slice(4, 6) + '-' + ts.slice(6, 8) + ' ' + ts.slice(8, 10) + ':' + ts.slice(10, 12) + ':' + ts.slice(12, 14)], [t('커밋 해시(12자)', 'commit hash (12)'), pseudo[2]]); }
      if (/\+incompatible$/.test(text)) { rows.push(['+incompatible', t('go.mod 없는 v2+ 저장소', 'a v2+ repository without go.mod')]); issues.push(t('+incompatible 은 모듈 경로에 /v2 접미사 없이 v2 이상을 쓰는 레거시 저장소입니다', '+incompatible marks a legacy v2+ repository used without the /v2 path suffix')); }
      if (gv.major >= 2 && !/\+incompatible$/.test(text)) rows.push([t('모듈 경로 접미사', 'module path suffix'), '/v' + gv.major + '  (module example.com/mod/v' + gv.major + ')']);
      if (gv.major === 0) issues.push(t('v0 은 안정 API 를 보장하지 않습니다', 'v0 carries no stability guarantee'));
      issues.push(t('Go 는 최소 버전 선택(MVS)을 씁니다: go.mod 의 require 는 "이 버전 이상"이며, 의존성 그래프에서 가장 높은 요구 버전이 선택됩니다', 'Go uses minimal version selection: a require line means "at least this version" and the highest required version in the graph wins'));
      groups = [[{ op: '>=', v: gv }]];
    } else {
      var orParts = text.split(/\s*\|\|?\s*/).filter(Boolean);
      if (eco === 'nuget') orParts = [text];
      orParts.forEach(function (part) {
        var comps = [];
        if (eco === 'nuget') {
          var im = /^([\[(])\s*([^,\]\)]*?)\s*(?:,\s*([^\]\)]*?)\s*)?([\])])$/.exec(part.trim());
          if (im) {
            var lo = im[2] ? parseV(im[2]) : null, hi = im[3] !== undefined ? (im[3] ? parseV(im[3]) : null) : lo, exact = im[3] === undefined;
            if ((im[2] && !lo) || (im[3] && !hi)) throw new Error(t('NuGet 구간의 버전을 해석할 수 없습니다', 'Cannot parse a version in the NuGet interval'));
            if (exact) { if (im[1] !== '[' || im[4] !== ']') throw new Error(t('단일 버전은 [1.0] 형식이어야 합니다', 'A single version must be written as [1.0]')); comps.push({ op: '=', v: lo }); }
            else { if (lo) comps.push({ op: im[1] === '[' ? '>=' : '>', v: lo }); if (hi) comps.push({ op: im[4] === ']' ? '<=' : '<', v: hi }); }
          } else { var wv = /\*/.test(part) ? parseV(part.replace(/\.?\*.*$/, '') + '.*') || null : null; var nv = parseV(part.trim().replace(/\*/g, '0')); if (/\*/.test(part)) { var base = parseV(part.trim().replace(/\.?\*$/, '')); if (!base && part.trim() !== '*') throw new Error(t('NuGet 버전을 해석할 수 없습니다: ' + part, 'Cannot parse NuGet version: ' + part)); if (part.trim() === '*') comps.push({ op: '>=', v: mk(0, 0, 0) }); else { var lv = Object.assign({}, base); comps.push({ op: '>=', v: lv }); var nb = Object.assign({}, base); var depth = base.rev !== undefined ? 3 : base.patch !== undefined ? 2 : base.minor !== undefined ? 1 : 0; if (depth === 0) comps.push({ op: '<', v: mk(base.major + 1, 0, 0) }); else if (depth === 1) comps.push({ op: '<', v: mk(base.major, base.minor + 1, 0) }); else comps.push({ op: '<', v: mk(base.major, base.minor, base.patch + 1) }); } } else { if (!nv) throw new Error(t('NuGet 버전을 해석할 수 없습니다: ' + part, 'Cannot parse NuGet version: ' + part)); comps.push({ op: '>=', v: nv }); } }
        } else {
          var toks = part.trim().replace(/\s*,\s*/g, ' ').replace(/(>=|<=|>|<|=|!=|\^|~>|~)\s+/g, '$1').split(/\s+/).filter(Boolean);
          // 하이픈 범위 (Composer)
          if (eco === 'composer' && toks.length === 3 && toks[1] === '-') { var a = parseV(toks[0]), b = parseV(toks[2]); if (!a || !b) throw new Error(t('하이픈 범위의 버전을 해석할 수 없습니다', 'Cannot parse the hyphen range')); comps.push({ op: '>=', v: a }); comps.push(b.minor === undefined || b.patch === undefined ? { op: '<', v: b.minor === undefined ? mk(b.major + 1, 0, 0) : mk(b.major, b.minor + 1, 0) } : { op: '<=', v: b }); }
          else toks.forEach(function (tk) {
            var m = /^(>=|<=|>|<|=|!=|\^|~>|~)?(.+)$/.exec(tk), op = m[1] || '', vs = m[2].replace(/@\w+$/, '');
            if (vs === '*' || vs === 'x') { comps.push({ op: '>=', v: mk(0, 0, 0) }); return; }
            var x = parseV(vs); if (!x) throw new Error(t('버전을 해석할 수 없습니다: "' + tk + '"', 'Cannot parse "' + tk + '"'));
            var isW = x.minor === '*' || x.patch === '*';
            if (op === '^') caret(x).forEach(function (c) { comps.push(c); });
            else if (op === '~' || op === '~>') tilde(x).forEach(function (c) { comps.push(c); });
            else if (isW) wild(x).forEach(function (c) { comps.push(c); });
            else if (op === '' && eco === 'cargo') caret(x).forEach(function (c) { comps.push(c); });
            else comps.push({ op: op === '' ? '=' : op, v: x });
          });
        }
        groups.push(comps);
      });
      rows = groups.map(function (g, i) { return [(groups.length > 1 ? t('조건 ', 'group ') + (i + 1) : t('조건', 'constraint')), g.map(function (c) { return c.op + show(c.v); }).join(eco === 'cargo' ? ', ' : ' ')]; });
      if (eco === 'cargo' && !/[\^~=<>*]/.test(text)) issues.push(t('Cargo 에서 접두사 없는 "1.2.3" 은 ^1.2.3 과 같습니다 (정확히 고정하려면 =1.2.3)', 'In Cargo a bare "1.2.3" means ^1.2.3 (use =1.2.3 to pin exactly)'));
      if (eco === 'nuget' && !/[\[\(]/.test(text) && !/\*/.test(text)) issues.push(t('NuGet 에서 접두사 없는 "1.0" 은 "1.0 이상"입니다. 정확히 고정하려면 [1.0]', 'In NuGet a bare "1.0" means "1.0 or higher"; pin exactly with [1.0]'));
      if (eco === 'composer' && /\|/.test(text)) issues.push(t('Composer 에서 || 와 | 는 모두 OR 입니다. 공백·쉼표는 AND 입니다', 'In Composer both || and | mean OR; spaces and commas mean AND'));
      if (eco === 'nuget' && /\*/.test(text)) issues.push(t('NuGet 부동 버전(*)은 복원 때마다 결과가 달라져 재현성이 떨어집니다 (lock 파일 사용 권장)', 'NuGet floating versions (*) make restores non-reproducible (use a lock file)'));
    }
    function ok(p, g) {
      return g.every(function (c) {
        var d = cmp(p, c.v); if (c.op === '=') return d === 0; if (c.op === '!=') return d !== 0; if (c.op === '>=') return d >= 0; if (c.op === '<=') return d <= 0; if (c.op === '>') return d > 0; if (c.op === '<') return d < 0; return false;
      });
    }
    var lines = String(v.versions || '').replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean), mrows = [], best = null;
    lines.forEach(function (s) {
      var p = parseV(s); if (!p) { mrows.push([s, '❌', t('해석 불가', 'invalid')]); return; }
      if (eco === 'go' && !/^v/.test(s)) { mrows.push([s, '❌', t('Go 버전은 v로 시작', 'a Go version starts with v')]); return; }
      var hit = groups.some(function (g) { return ok(p, g); }), pre = !!p.pre;
      if (hit && pre && !groups.some(function (g) { return g.some(function (c) { return c.v.pre; }); }) && eco !== 'go') { mrows.push([s, '⛔', t('프리릴리스는 제약에 프리릴리스가 없으면 제외됩니다 (안정 버전 우선)', 'Pre-releases are skipped unless the constraint names one')]); return; }
      mrows.push([s, hit ? '✅' : '—', hit ? t('일치', 'matches') : t('불일치', 'no match')]);
      if (hit && (!best || cmp(p, best) > 0)) best = p;
    });
    if (lines.length) issues.unshift(best ? t('일치하는 가장 높은 버전: ' + best.raw, 'Highest matching version: ' + best.raw) : t('일치하는 후보가 없습니다', 'No candidate matches'));
    return { _status: t('✅ ' + ({ composer: 'Composer', cargo: 'Cargo', nuget: 'NuGet', go: 'Go' }[eco]) + ' 제약을 해석했습니다', '✅ ' + ({ composer: 'Composer', cargo: 'Cargo', nuget: 'NuGet', go: 'Go' }[eco]) + ' constraint parsed'), table: { head: [['항목', 'Item'], ['해석', 'Meaning']], rows: rows }, match: mrows.length ? { head: [['버전', 'Version'], ['판정', 'Verdict'], ['설명', 'Note']], rows: mrows } : null, issues: issues };
  }
});
