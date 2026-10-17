TK.tool('package-exports-visualizer', {
  sampleExpectError: true,
  inputs: [{ id: 'in', label: ['package.json', 'package.json'], rows: 18, sample: JSON.stringify({ name: 'demo-lib', version: '1.0.0', type: 'module', main: './dist/index.cjs', module: './dist/index.js', types: './dist/index.d.ts', files: ['dist'], exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js', require: './dist/index.cjs', default: './dist/index.js' }, './feature': { import: './dist/feature.js', require: './dist/feature.cjs' }, './utils/*': './dist/utils/*.js', './internal/*': null, './legacy/': './legacy/' } }, null, 2), }],
  options: [
    { id: 'spec', type: 'text', label: ['해석해 볼 import 경로 (예: demo-lib/feature)', 'Specifier to resolve (e.g. demo-lib/feature)'], default: '', sample: 'demo-lib/utils/format' },
    { id: 'env', type: 'select', label: ['해석 환경', 'Environment'], choices: [['node-import', ['Node.js import (ESM)', 'Node.js import (ESM)']], ['node-require', ['Node.js require (CJS)', 'Node.js require (CJS)']], ['browser', ['번들러 / 브라우저 (browser, import)', 'Bundler / browser (browser, import)']], ['types', ['TypeScript (types, import)', 'TypeScript (types, import)']]], default: 'node-import' },
    { id: 'extra', type: 'text', label: ['추가 조건 (쉼표로 구분, 예: development)', 'Extra conditions (comma separated, e.g. development)'], default: '' }
  ],
  sampleOptions: { spec: 'demo-lib/utils/format' },
  outputs: [{ id: 'matrix', label: ['환경별 해석 결과', 'Resolution matrix'], kind: 'table' }, { id: 'entries', label: ['exports 항목 (조건 경로)', 'exports entries (condition paths)'], kind: 'table' }, { id: 'res', label: ['import 경로 해석', 'Specifier resolution'], kind: 'kv' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var P; try { P = JSON.parse(String(v['in'] || '')); } catch (e) { throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); }
    if (!P || typeof P !== 'object' || Array.isArray(P)) throw new Error(t('package.json 은 객체여야 합니다', 'package.json must be an object'));
    var issues = [], name = P.name || '(name)', ex = P.exports, isESM = P.type === 'module';
    function add(sev, m) { issues.push({ sev: sev, msg: m }); }
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
    if (ex === undefined) {
      add('info', t('exports 필드가 없습니다. 패키지 안의 모든 파일을 deep import 할 수 있고 main/module/browser 필드가 사용됩니다', 'No exports field: every file in the package can be deep-imported and main / module / browser are used'));
    }
    function isCond(k) { return !/^\./.test(k); }
    /* exports 정규화 */
    var map = null;
    if (ex !== undefined) {
      if (typeof ex === 'string' || Array.isArray(ex) || (ex && typeof ex === 'object' && Object.keys(ex).length && Object.keys(ex).every(isCond))) map = { '.': ex };
      else if (ex && typeof ex === 'object') {
        var ks = Object.keys(ex), nd = ks.filter(function (k) { return /^\./.test(k); }).length;
        if (nd && nd !== ks.length) add('error', t('exports 의 키가 "./경로"와 조건 이름이 섞여 있습니다 (ERR_INVALID_PACKAGE_CONFIG)', 'exports mixes "./subpath" keys and condition names (ERR_INVALID_PACKAGE_CONFIG)'));
        map = ex;
      } else if (ex === null) { add('warn', t('exports 가 null 입니다', 'exports is null')); map = {}; }
      else throw new Error(t('exports 는 문자열, 배열, 객체 중 하나여야 합니다', 'exports must be a string, array or object'));
    }
    /* 순회: 조건 경로 수집 */
    var entries = [];
    function walk(sub, node, chain, topCond) {
      if (typeof node === 'string') { entries.push({ sub: sub, chain: chain, target: node }); validateTarget(sub, chain, node); return; }
      if (node === null) { entries.push({ sub: sub, chain: chain, target: null }); return; }
      if (Array.isArray(node)) { node.forEach(function (n, i) { walk(sub, n, chain.concat('[' + i + ']'), topCond); }); return; }
      if (node && typeof node === 'object') {
        var ks = Object.keys(node);
        ks.forEach(function (k, i) {
          if (!isCond(k)) { add('error', t(sub + ' 안에 조건 대신 경로 키 "' + k + '" 가 있습니다', sub + ' contains the path key "' + k + '" where a condition is expected')); return; }
          if (k === 'default' && i !== ks.length - 1) add('warn', t(sub + ': "default" 조건이 마지막이 아니라서 그 뒤의 조건(' + ks.slice(i + 1).join(', ') + ')에는 도달하지 못합니다', sub + ': "default" is not last, so later conditions (' + ks.slice(i + 1).join(', ') + ') are unreachable'));
          if (k === 'types' && ks.slice(0, i).some(function (x) { return x === 'import' || x === 'require' || x === 'default' || x === 'node'; })) add('warn', t(sub + ': "types" 조건이 ' + ks.slice(0, i).join('/') + ' 뒤에 있습니다. TypeScript 는 먼저 일치하는 조건을 쓰므로 "types" 를 맨 앞에 두세요', sub + ': "types" comes after ' + ks.slice(0, i).join('/') + '; TypeScript takes the first match, so put "types" first'));
          walk(sub, node[k], chain.concat(k), topCond);
        });
        if (ks.length && ks.indexOf('default') < 0 && !chain.length && ks.every(function (k) { return k === 'import' || k === 'require'; })) add('info', t(sub + ': "default" 조건이 없어 import/require 외의 환경(번들러 등)에서 해석에 실패할 수 있습니다', sub + ': no "default" condition; environments other than import / require (e.g. some bundlers) may fail to resolve'));
        return;
      }
      add('error', t(sub + ': 지원하지 않는 값 형식입니다', sub + ': unsupported value type'));
    }
    function validateTarget(sub, chain, tg) {
      var where = sub + (chain.length ? ' → ' + chain.join('.') : '');
      if (!/^\.\//.test(tg)) { add('error', t(where + ': 대상 "' + tg + '" 은(는) "./" 로 시작해야 합니다 (패키지 밖/외부 패키지 불가)', where + ': target "' + tg + '" must start with "./" (no paths outside the package or bare packages)')); return; }
      if (/(^|\/)\.\.(\/|$)|node_modules/.test(tg)) add('error', t(where + ': 대상 경로에 ".." 또는 node_modules 를 쓸 수 없습니다', where + ': the target may not contain ".." or node_modules'));
      if (/\/$/.test(tg) && !/\*/.test(sub)) add('error', t(where + ': 폴더 매핑("' + tg + '")은 Node.js 17 에서 제거되었습니다. "./*" 패턴을 사용하세요', where + ': folder mapping ("' + tg + '") was removed in Node.js 17; use a "./*" pattern'));
      var ext = (/\.[a-z0-9.]+$/i.exec(tg) || [''])[0].toLowerCase(), last = chain[chain.length - 1];
      var underRequire = chain.indexOf('require') >= 0, underImport = chain.indexOf('import') >= 0, underTypes = chain.indexOf('types') >= 0;
      if (/\.d\.[cm]?ts$/.test(tg) && !underTypes && chain.indexOf('default') < 0 && chain.length && !underRequire && !underImport) add('info', t(where + ': 타입 선언 파일은 "types" 조건 아래에 두는 것이 안전합니다', where + ': put declaration files under a "types" condition'));
      if (underRequire && ext === '.mjs') add('error', t(where + ': require 조건이 ES 모듈(.mjs)을 가리킵니다 (ERR_REQUIRE_ESM 가능)', where + ': the require condition points to an ES module (.mjs), which may throw ERR_REQUIRE_ESM'));
      if (underRequire && ext === '.js' && isESM) add('warn', t(where + ': "type": "module" 패키지에서 require 조건이 .js 를 가리킵니다. 그 파일은 ESM 으로 취급됩니다 (.cjs 사용)', where + ': in a "type": "module" package, a .js file under require is treated as ESM (use .cjs)'));
      if (underImport && ext === '.cjs') add('info', t(where + ': import 조건이 CommonJS(.cjs)를 가리킵니다. named export 를 정적으로 분석하지 못할 수 있습니다', where + ': the import condition points to CommonJS (.cjs); named exports may not be statically detected'));
      if (underImport && ext === '.js' && P.type === undefined) add('warn', t(where + ': "type" 이 없는 패키지에서 import 조건이 .js 를 가리킵니다. 모듈 형식이 모호하니 "type" 을 지정하거나 .mjs 를 쓰세요', where + ': the import condition points to .js in a package without "type"; the module format is ambiguous, set "type" or use .mjs'));
    }
    var subs = [];
    if (map) { Object.keys(map).forEach(function (k) { if (!/^\./.test(k)) return; subs.push(k); walk(k, map[k], [], null); }); if (map['.'] !== undefined && subs.indexOf('.') < 0) { subs.push('.'); walk('.', map['.'], [], null); } }
    /* 해석기 (Node.js PACKAGE_EXPORTS_RESOLVE) */
    function resolveTarget(tg, star, conds) {
      if (typeof tg === 'string') return /^\.\//.test(tg) ? { path: star != null ? tg.split('*').join(star) : tg } : { invalid: tg };
      if (tg === null) return { blocked: true };
      if (Array.isArray(tg)) { for (var i = 0; i < tg.length; i++) { var r = resolveTarget(tg[i], star, conds); if (r && r.path) return r; if (r && r.blocked) return r; } return undefined; }
      if (tg && typeof tg === 'object') { var ks = Object.keys(tg); for (var j = 0; j < ks.length; j++) { var k = ks[j]; if (k === 'default' || conds.indexOf(k) >= 0) { var rr = resolveTarget(tg[k], star, conds); if (rr === undefined) continue; return rr; } } return undefined; }
      return undefined;
    }
    function resolveSub(sub, conds) {
      if (!map) return { none: true };
      if (Object.prototype.hasOwnProperty.call(map, sub) && sub.indexOf('*') < 0) return resolveTarget(map[sub], null, conds) || { nomatch: true };
      var best = null, bestStar = null;
      Object.keys(map).forEach(function (k) { var i = k.indexOf('*'); if (i < 0 || k.indexOf('*', i + 1) >= 0) return; var pre = k.slice(0, i), post = k.slice(i + 1); if (sub.length >= k.length && sub.indexOf(pre) === 0 && (post === '' || sub.slice(-post.length) === post) && sub !== pre) { if (!best || pre.length > best.indexOf('*') || (pre.length === best.indexOf('*') && k.length > best.length)) { best = k; bestStar = sub.slice(pre.length, sub.length - post.length); } } });
      if (best) return resolveTarget(map[best], bestStar, conds) || { nomatch: true };
      return { nomatch: true };
    }
    var ENV = { 'node-import': ['node', 'import'], 'node-require': ['node', 'require'], 'browser': ['browser', 'import', 'module'], 'types': ['types', 'import'] };
    var extra = String(o.extra || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    function show(r) { if (!r) return '—'; if (r.none) return t('(exports 없음 — main/module 사용)', '(no exports - main / module used)'); if (r.blocked) return t('⛔ 차단됨 (null)', '⛔ blocked (null)'); if (r.invalid) return '⛔ ' + r.invalid; if (r.nomatch) return t('✗ 일치 없음', '✗ no match'); return r.path; }
    var matrix = subs.map(function (s) {
      if (s.indexOf('*') >= 0) return [s, t('(패턴)', '(pattern)'), '', '', ''];
      var cols = ['node-import', 'node-require', 'browser', 'types'].map(function (e) { return show(resolveSub(s, ENV[e].concat(extra))); });
      var ni = resolveSub(s, ENV['node-import'].concat(extra)), nr = resolveSub(s, ENV['node-require'].concat(extra));
      if (ni && nr && ni.path && nr.path && ni.path !== nr.path) add('info', t(s + ': import 와 require 가 서로 다른 파일(' + ni.path + ' / ' + nr.path + ')을 가리킵니다. 두 형식이 한 앱에서 모두 로드되면 인스턴스가 둘이 되는 "듀얼 패키지 하자드"가 생길 수 있습니다', s + ': import and require resolve to different files (' + ni.path + ' / ' + nr.path + '); loading both in one app creates two instances (the dual-package hazard)'));
      if (ni && ni.nomatch || nr && nr.nomatch) add('warn', t(s + ': ' + (ni && ni.nomatch ? 'Node import' : 'Node require') + ' 환경에서 일치하는 조건이 없습니다', s + ': no condition matches in ' + (ni && ni.nomatch ? 'Node import' : 'Node require')));
      return [s].concat(cols);
    });
    /* 패턴·기타 점검 */
    subs.forEach(function (s) {
      if (s === './*' || /^\.\/\*$/.test(s)) add('warn', t('"./*" 패턴은 패키지의 모든 파일을 공개합니다. 공개할 폴더만 "./utils/*" 처럼 한정하세요', 'The "./*" pattern exposes every file in the package; restrict it to the folders you mean to publish, e.g. "./utils/*"'));
      if ((s.match(/\*/g) || []).length > 1) add('error', t(s + ': 경로 키에는 "*" 를 하나만 쓸 수 있습니다', s + ': a subpath key may contain only one "*"'));
    });
    if (map && subs.length > 1 && subs.indexOf('./package.json') < 0) add('info', t('"./package.json" 이 exports 에 없어 require("pkg/package.json") 이 차단됩니다. 도구(번들러, ESLint 플러그인 등)가 읽는다면 추가하세요', '"./package.json" is not exported, so require("pkg/package.json") is blocked; add it if tools read it'));
    if (map && P.main && map['.'] !== undefined) {
      var cjsRes = resolveSub('.', ['node', 'require'].concat(extra));
      if (cjsRes && cjsRes.path && cjsRes.path.replace(/^\.\//, '') !== String(P.main).replace(/^\.\//, '')) add('info', t('main("' + P.main + '")과 exports 의 require 대상("' + cjsRes.path + '")이 다릅니다. 새 Node 는 exports 를, 오래된 도구는 main 을 사용합니다', 'main ("' + P.main + '") differs from the exports require target ("' + cjsRes.path + '"); modern Node uses exports and older tools use main'));
    }
    if (map && (P.module || P.browser) && o.extra === '' ) add('info', t('module/browser 필드는 exports 가 있으면 대부분의 번들러에서 무시됩니다. 필요한 조건("module", "browser")을 exports 안에 두세요', 'module / browser fields are ignored by most bundlers when exports exists; put the needed conditions ("module", "browser") inside exports'));
    if (map && !P.types && !P.typings && subs.length && !JSON.stringify(ex).match(/types|\.d\.[cm]?ts/)) add('info', t('타입 선언 경로(types)가 없습니다. TypeScript 사용자를 위해 "types" 조건 또는 types 필드를 추가하세요', 'No type declarations found; add a "types" condition or the types field for TypeScript users'));
    /* 평탄한 types 가 ESM/CJS 를 공유 */
    var dot = map && map['.'];
    if (dot && typeof dot === 'object' && !Array.isArray(dot)) {
      var dts = dot.types, imp = dot.import, req = dot.require;
      if (typeof dts === 'string' && typeof imp === 'string' && typeof req === 'string' && imp !== req) add('info', t('. : 하나의 types 파일(' + dts + ')을 ESM/CJS 가 공유합니다. 모듈 형식이 다르면 import·require 안에 각각 types(.d.mts/.d.cts)를 중첩하는 것이 안전합니다', '. : one types file (' + dts + ') is shared by ESM and CJS; nest separate types (.d.mts / .d.cts) under import and require to be safe'));
    }
    /* files 필드와 대상 비교 */
    if (Array.isArray(P.files) && entries.length) {
      var pats = P.files.map(function (f) { return String(f).replace(/^\.\//, '').replace(/\/+$/, ''); });
      function covered(path) { var rel = path.replace(/^\.\//, ''); return pats.some(function (p) { if (p.indexOf('*') >= 0) { var rx = new RegExp('^' + p.replace(/[.+^${}()|\[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\u0001/g, '.*') + '(/.*)?$'); return rx.test(rel); } return rel === p || rel.indexOf(p + '/') === 0; }) || /^package\.json$|^(readme|license|licence|changelog)/i.test(rel) || (P.main && rel === String(P.main).replace(/^\.\//, '')); }
      var miss = {}; entries.forEach(function (e) { if (e.target && /^\.\//.test(e.target) && !/\*/.test(e.target) && !/\/$/.test(e.target) && !covered(e.target)) miss[e.target] = 1; });
      Object.keys(miss).forEach(function (m) { add('warn', t('exports 대상 ' + m + ' 이(가) files 필드에 포함되지 않아 npm 패키지에 빠질 수 있습니다', 'The exports target ' + m + ' is not covered by the files field and may be missing from the published package')); });
    }
    if (P.imports && typeof P.imports === 'object') { Object.keys(P.imports).forEach(function (k) { if (k.charAt(0) !== '#') add('error', t('imports 의 키 "' + k + '" 는 "#" 로 시작해야 합니다', 'The imports key "' + k + '" must start with "#"')); }); }
    /* import 경로 해석 */
    var resKv = [];
    var spec = String(o.spec || '').trim();
    if (spec) {
      var m = /^((?:@[^\/]+\/)?[^\/]+)(\/.*)?$/.exec(spec);
      if (!m) add('error', t('import 경로 형식이 올바르지 않습니다: ' + spec, 'Invalid specifier: ' + spec));
      else {
        var pkgName = m[1], sub = m[2] ? '.' + m[2] : '.', conds = (ENV[o.env] || ENV['node-import']).concat(extra);
        resKv.push([['입력', 'Specifier'], spec]); resKv.push([['사용한 조건', 'Conditions'], conds.concat(['default']).join(', ')]);
        if (P.name && pkgName !== P.name) add('warn', t('입력한 패키지 이름(' + pkgName + ')이 package.json 의 name(' + P.name + ')과 다릅니다', 'The specifier package (' + pkgName + ') differs from package.json name (' + P.name + ')'));
        var r = resolveSub(sub, conds);
        resKv.push([['부분 경로', 'Subpath'], sub]);
        if (r.none) { var fallback = o.env === 'types' ? (P.types || P.typings) : (o.env === 'browser' ? (P.browser && typeof P.browser === 'string' ? P.browser : P.module || P.main) : (o.env === 'node-require' ? P.main : (P.main))); resKv.push([['결과', 'Result'], sub === '.' ? (fallback || 'index.js') + t('  (exports 없음 → main 사용)', '  (no exports, so main is used)') : sub.replace(/^\.\//, '') + t('  (exports 없음 → 파일 직접 접근)', '  (no exports, so the file is accessed directly)')]); }
        else if (r.blocked) resKv.push([['결과', 'Result'], t('⛔ ERR_PACKAGE_PATH_NOT_EXPORTED — null 로 명시적으로 차단됨', '⛔ ERR_PACKAGE_PATH_NOT_EXPORTED - explicitly blocked with null')]);
        else if (r.invalid) resKv.push([['결과', 'Result'], t('⛔ 잘못된 대상: ', '⛔ Invalid target: ') + r.invalid]);
        else if (r.nomatch) resKv.push([['결과', 'Result'], t('⛔ ERR_PACKAGE_PATH_NOT_EXPORTED — 일치하는 항목/조건이 없습니다', '⛔ ERR_PACKAGE_PATH_NOT_EXPORTED - no matching entry or condition')]);
        else resKv.push([['결과', 'Result'], '✅ ' + r.path.replace(/^\.\//, '') ]);
      }
    }
    var shown = issues.slice().sort(function (a, b) { return { error: 0, warn: 1, info: 2 }[a.sev] - { error: 0, warn: 1, info: 2 }[b.sev]; });
    var seen = {}; shown = shown.filter(function (x) { if (seen[x.msg]) return false; seen[x.msg] = 1; return true; });
    var errs = shown.filter(function (x) { return x.sev === 'error'; }).length, warns = shown.filter(function (x) { return x.sev === 'warn'; }).length;
    var eRows = entries.map(function (e) { return [e.sub, e.chain.join(' → ') || '—', e.target === null ? 'null (' + t('차단', 'blocked') + ')' : e.target]; });
    return { _status: { ok: errs ? false : true, msg: errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — ' + name, '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + name) : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — ' + name + ' (경로 ' + subs.length + '개)', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + name + ' (' + subs.length + ' path(s))') }, matrix: { head: [['부분 경로', 'Subpath'], ['Node import', 'Node import'], ['Node require', 'Node require'], ['번들러/브라우저', 'Bundler / browser'], ['TypeScript', 'TypeScript']], rows: matrix, empty: ['exports 가 없습니다', 'No exports'] }, entries: { head: [['부분 경로', 'Subpath'], ['조건 경로', 'Condition path'], ['대상', 'Target']], rows: eRows }, res: resKv.length ? resKv : null, issues: shown.map(function (x) { return ICON[x.sev] + ' ' + x.msg; }) };
  }
});
