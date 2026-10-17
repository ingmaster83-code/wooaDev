TK.tool('gitlab-ci-editor', {
  inputs: [{ id: 'in', label: ['.gitlab-ci.yml', '.gitlab-ci.yml'], rows: 22, sample: 'stages: [build, test, deploy]\n\nvariables:\n  NODE_ENV: production\n  DEBUG: true\n\n.node:\n  image: node:latest\n  before_script:\n    - npm ci\n\nbuild:\n  extends: .node\n  stage: build\n  script:\n    - npm run build\n  artifacts:\n    paths: [dist/]\n\ntest:\n  extends: .nodejs\n  stage: test\n  script: npm test\n  needs: [build, deploy]\n  only: [main]\n  rules:\n    - if: $CI_COMMIT_BRANCH == "main"\n\ndeploy:\n  stage: deploy\n  retry: 5\n  when: delayed\n  script:\n    - ./deploy.sh\n  environment: production\n' }],
  sampleExpectError: true,
  options: [{ id: 'hints', type: 'checkbox', label: ['모범 사례 권고(ℹ️)도 표시', 'Also show best-practice hints (ℹ️)'], default: true }],
  outputs: [{ id: 'table', label: ['잡 목록 (스테이지 순)', 'Jobs (stage order)'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'out', label: ['파이프라인 실행 순서', 'Pipeline order'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var Y = TK.yamlx, issues = [];
    var src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('.gitlab-ci.yml 을 입력하세요', 'Enter a .gitlab-ci.yml'));
    var res; try { res = Y.parse(src); } catch (e) { throw new Error(t('YAML 문법 오류 (줄 ' + e.line + '): ', 'YAML syntax error (line ' + e.line + '): ') + e.message); }
    var doc = res.docs[0]; if (!doc || !doc.root) throw new Error(t('내용이 비어 있습니다', 'The file is empty')); if (doc.error) throw new Error(doc.error.message);
    var root = Y.deref(doc.root), js = doc.js; if (!Y.isMap(js)) throw new Error(t('최상위가 매핑이 아닙니다', 'The top level is not a mapping'));
    function add(sev, line, msg) { issues.push({ sev: sev, line: line, msg: msg }); }
    doc.dups.forEach(function (d) { add('error', d.line, t('키 "' + d.key + '" 가 중복되었습니다 (첫 정의: 줄 ' + d.first + ')', 'Duplicate key "' + d.key + '" (first at line ' + d.first + ')')); });
    var RESERVED = ['image', 'services', 'stages', 'types', 'before_script', 'after_script', 'variables', 'cache', 'include', 'default', 'workflow', 'spec'];
    var JOBKEYS = ['after_script', 'allow_failure', 'artifacts', 'before_script', 'cache', 'coverage', 'dast_configuration', 'dependencies', 'environment', 'except', 'extends', 'identity', 'id_tokens', 'image', 'inherit', 'interruptible', 'manual_confirmation', 'needs', 'only', 'pages', 'parallel', 'release', 'resource_group', 'retry', 'rules', 'run', 'script', 'secrets', 'services', 'stage', 'start_in', 'tags', 'timeout', 'trigger', 'variables', 'when'];
    var WHEN = ['on_success', 'on_failure', 'always', 'manual', 'delayed', 'never'];
    var stages = Array.isArray(js.stages) ? js.stages.map(String) : ['.pre', 'build', 'test', 'deploy', '.post'];
    if (Array.isArray(js.stages)) { if (stages.indexOf('.pre') < 0) stages.unshift('.pre'); if (stages.indexOf('.post') < 0) stages.push('.post'); }
    var hasInclude = js.include !== undefined;
    var jobs = Object.keys(js).filter(function (k) { return RESERVED.indexOf(k) < 0 && k.charAt(0) !== '.' && Y.isMap(js[k]); });
    Object.keys(js).forEach(function (k) { if (RESERVED.indexOf(k) < 0 && !Y.isMap(js[k]) && !(k === 'pages' && false)) add('error', Y.keyLine(root, k), t('최상위 "' + k + '" 는 잡이 아닙니다 (잡은 매핑이어야 하며, 설정 키는 예약된 이름만 쓸 수 있습니다)', 'Top-level "' + k + '" is not a job (jobs must be mappings, and only reserved names are config keys)')); });
    if (Array.isArray(js.stages)) js.stages.forEach(function (s, idx) { if (js.stages.indexOf(s) !== idx) add('error', Y.keyLine(root, 'stages'), t('스테이지 "' + s + '" 가 중복되었습니다', 'Duplicate stage "' + s + '"')); });
    /* extends 해석 */
    function merged(name, seen) {
      seen = seen || [];
      var j = js[name]; if (!Y.isMap(j)) return {};
      if (seen.indexOf(name) >= 0) return j;
      var ext = j.extends == null ? [] : Array.isArray(j.extends) ? j.extends : [j.extends], base = {};
      ext.forEach(function (e) { if (js[e]) { var b = merged(e, seen.concat(name)); Object.keys(b).forEach(function (k) { if (Y.isMap(b[k]) && Y.isMap(base[k])) base[k] = Object.assign({}, base[k], b[k]); else base[k] = b[k]; }); } });
      Object.keys(j).forEach(function (k) { if (Y.isMap(j[k]) && Y.isMap(base[k]) && k !== 'artifacts' && k !== 'cache') base[k] = Object.assign({}, base[k], j[k]); else base[k] = j[k]; });
      return base;
    }
    var info = {}, graphNeeds = {};
    function checkVars(vars, node, ctxName) { if (!Y.isMap(vars)) return; Object.keys(vars).forEach(function (k) { var val = vars[k], kl = Y.keyLine(node, k); if (!/^[A-Za-z0-9_]+$/.test(k)) add('error', kl, t('변수 이름 "' + k + '" 는 영문자·숫자·_ 만 쓸 수 있습니다', 'Variable name "' + k + '" may use only letters, digits and _')); if (typeof val === 'boolean') add('error', kl, t('변수 ' + k + ' 의 값이 불리언입니다. GitLab 변수 값은 문자열이어야 하므로 따옴표로 감싸세요 ("true")', 'Variable ' + k + ' is a boolean; GitLab variable values must be strings, so quote it ("true")')); if (typeof val === 'string' && /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)/i.test(k) && val && val.indexOf('$') < 0) add('warn', kl, t('변수 ' + k + ' 에 비밀 값이 그대로 적혀 있습니다. CI/CD 변수(Masked)에 저장하세요', 'Variable ' + k + ' holds a secret in plain text; store it as a masked CI/CD variable')); }); }
    checkVars(js.variables, Y.get(root, ['variables']));
    jobs.concat(Object.keys(js).filter(function (k) { return k.charAt(0) === '.' && Y.isMap(js[k]); })).forEach(function (name) {
      var raw = js[name], jn = Y.get(root, [name]), line = Y.keyLine(root, name), hidden = name.charAt(0) === '.';
      Object.keys(raw).forEach(function (k) { if (JOBKEYS.indexOf(k) < 0) add(hidden ? 'warn' : 'error', Y.keyLine(jn, k), t((hidden ? '템플릿 ' : '잡 ') + '"' + name + '" 의 알 수 없는 키 "' + k + '"', 'Unknown key "' + k + '" in ' + (hidden ? 'template' : 'job') + ' "' + name + '"')); });
      var ext = raw.extends == null ? [] : Array.isArray(raw.extends) ? raw.extends : [raw.extends];
      ext.forEach(function (e) { if (!js[e]) add(hasInclude ? 'warn' : 'error', Y.keyLine(jn, 'extends'), t('extends 의 "' + e + '" 잡(템플릿)이 없습니다' + (hasInclude ? ' (include 로 가져오는 파일에 있을 수 있어 확인할 수 없음)' : ''), 'extends refers to missing job (template) "' + e + '"' + (hasInclude ? ' (it may come from an include, which cannot be checked)' : ''))); });
      if (hidden) { info[name] = { hidden: true }; return; }
      var m = merged(name), stage = m.stage || 'test';
      if (stages.indexOf(stage) < 0) add('error', Y.keyLine(jn, 'stage') || line, t('잡 "' + name + '" 의 stage "' + stage + '" 가 stages 에 없습니다', 'Job "' + name + '" has stage "' + stage + '" which is not in stages'));
      if (!m.script && !m.trigger && !m.run && !(name === 'pages' && m.pages)) add('error', line, t('잡 "' + name + '" 에 script 가 필요합니다 (trigger 잡 제외)', 'Job "' + name + '" needs script (except trigger jobs)'));
      if (m.trigger && m.script) add('error', line, t('trigger 잡에는 script 를 쓸 수 없습니다', 'A trigger job cannot have script'));
      if ((m.only || m.except) && m.rules) add('error', Y.keyLine(jn, 'rules') || line, t('잡 "' + name + '" 에 rules 와 only/except 를 함께 쓸 수 없습니다', 'Job "' + name + '" cannot combine rules with only / except'));
      else if ((raw.only || raw.except) && o.hints) add('info', Y.keyLine(jn, raw.only ? 'only' : 'except'), t('only/except 는 더 이상 개발되지 않습니다. rules 로 바꾸세요', 'only / except are no longer developed; switch to rules'));
      if (m.when !== undefined && WHEN.indexOf(m.when) < 0) add('error', Y.keyLine(jn, 'when'), t('when "' + m.when + '" 이 올바르지 않습니다 (' + WHEN.join(', ') + ')', 'Invalid when "' + m.when + '" (' + WHEN.join(', ') + ')'));
      if (m.when === 'delayed' && !m.start_in) add('error', Y.keyLine(jn, 'when'), t('when: delayed 에는 start_in 이 필요합니다 (예: 30 minutes)', 'when: delayed needs start_in (e.g. 30 minutes)'));
      if (m.start_in && m.when !== 'delayed') add('warn', Y.keyLine(jn, 'start_in'), t('start_in 은 when: delayed 일 때만 의미가 있습니다', 'start_in only matters with when: delayed'));
      if (m.retry !== undefined) { var rm = Y.isMap(m.retry) ? m.retry.max : m.retry; if (typeof rm !== 'number' || rm < 0 || rm > 2) add('error', Y.keyLine(jn, 'retry'), t('retry 는 0~2 사이여야 합니다 (현재 ' + rm + ')', 'retry must be 0–2 (got ' + rm + ')')); }
      if (m.allow_failure !== undefined && typeof m.allow_failure !== 'boolean' && !Y.isMap(m.allow_failure)) add('error', Y.keyLine(jn, 'allow_failure'), t('allow_failure 는 true/false 또는 exit_codes 여야 합니다', 'allow_failure must be true / false or exit_codes'));
      if (typeof m.parallel === 'number' && (m.parallel < 2 || m.parallel > 200)) add('error', Y.keyLine(jn, 'parallel'), t('parallel 은 2~200 이어야 합니다', 'parallel must be 2–200'));
      if (Array.isArray(m.rules)) m.rules.forEach(function (r, idx) {
        var rn = Y.get(jn, ['rules', idx]), rl = rn ? rn.line : line;
        if (!Y.isMap(r)) { if (!(rn && /reference/.test(rn.tag))) add('error', rl, t('rules 항목은 매핑이어야 합니다', 'A rules entry must be a mapping')); return; }
        Object.keys(r).forEach(function (k) { if (['if', 'changes', 'exists', 'when', 'allow_failure', 'variables', 'needs', 'start_in', 'interruptible'].indexOf(k) < 0) add('error', Y.keyLine(rn, k), t('rules 의 알 수 없는 키 "' + k + '"', 'Unknown key "' + k + '" in rules')); });
        if (r.when !== undefined && WHEN.indexOf(r.when) < 0) add('error', rl, t('rules 의 when "' + r.when + '" 이 올바르지 않습니다', 'Invalid when "' + r.when + '" in rules'));
        if (typeof r.if === 'string') { var q = (r.if.match(/"/g) || []).length, q2 = (r.if.match(/'/g) || []).length; if (q % 2 || q2 % 2) add('error', rl, t('rules:if 의 따옴표가 짝이 맞지 않습니다', 'Unbalanced quotes in rules:if')); if (/=~\s*["']/.test(r.if)) add('error', rl, t('=~ 의 정규식은 /패턴/ 형식이어야 합니다 (따옴표 문자열 불가)', 'The regex after =~ must be /pattern/, not a quoted string')); if (/\$[A-Z_]+\s*=\s*[^=~]/.test(r.if) && !/==|!=|=~|!~/.test(r.if)) add('warn', rl, t('rules:if 에서 = 하나는 비교가 아닙니다. == 를 쓰세요', 'A single = is not a comparison in rules:if; use ==')); }
      });
      if (m.artifacts && Y.isMap(m.artifacts)) { if (!m.artifacts.paths && !m.artifacts.reports && !m.artifacts.exclude && !m.artifacts.untracked) add('warn', Y.keyLine(jn, 'artifacts'), t('artifacts 에 paths 가 없어 아무것도 저장되지 않습니다', 'artifacts has no paths, so nothing is saved')); else if (o.hints && !m.artifacts.expire_in) add('info', Y.keyLine(jn, 'artifacts'), t('artifacts 에 expire_in 이 없으면 기본 만료(30일, 인스턴스 설정)만큼 저장 공간을 차지합니다', 'Without expire_in, artifacts use the instance default expiry (30 days) of storage')); }
      if (m.cache && Y.isMap(m.cache) && m.cache.policy && ['pull', 'push', 'pull-push'].indexOf(m.cache.policy) < 0) add('error', Y.keyLine(jn, 'cache'), t('cache:policy 는 pull, push, pull-push 중 하나여야 합니다', 'cache:policy must be pull, push or pull-push'));
      var img = typeof m.image === 'string' ? m.image : (Y.isMap(m.image) ? m.image.name : ''); if (img && img.indexOf('$') < 0) { var seg = img.split('/').pop(); if ((seg.indexOf(':') < 0 || /:latest$/.test(seg)) && !/@sha256:/.test(img)) add('warn', Y.keyLine(jn, 'image') || Y.keyLine(Y.get(root, [ext[0] || name]), 'image'), t('이미지 "' + img + '" 는 태그가 없거나 latest 입니다. 버전을 고정하세요', 'Image "' + img + '" has no tag or uses latest; pin a version')); }
      checkVars(m.variables, Y.get(jn, ['variables']));
      if (Y.isMap(m.environment) === false && typeof m.environment === 'string' && o.hints === false) { /* noop */ }
      var needs = m.needs == null ? [] : (Array.isArray(m.needs) ? m.needs : [m.needs]).map(function (n) { return Y.isMap(n) ? n.job : n; }).filter(function (x) { return typeof x === 'string'; });
      graphNeeds[name] = needs;
      info[name] = { stage: stage, image: img || '', lines: Array.isArray(m.script) ? m.script.length : (m.script ? 1 : 0), needs: needs, when: m.when || (Array.isArray(m.rules) ? 'rules' : 'on_success'), line: line, node: jn, m: m };
    });
    /* needs / dependencies 검증 */
    Object.keys(info).forEach(function (name) {
      var inf = info[name]; if (inf.hidden) return;
      inf.needs.forEach(function (n) {
        if (!info[n] || info[n].hidden) { if (!js[n] || (info[n] && info[n].hidden)) add(hasInclude && !js[n] ? 'warn' : 'error', Y.keyLine(inf.node, 'needs') || inf.line, t('needs 의 "' + n + '" 잡이 없습니다' + (info[n] && info[n].hidden ? ' (템플릿은 needs 대상이 될 수 없음)' : ''), 'needs refers to missing job "' + n + '"')); return; }
        if (n === name) add('error', Y.keyLine(inf.node, 'needs'), t('잡 "' + name + '" 가 자기 자신을 needs 합니다', 'Job "' + name + '" needs itself'));
        else if (stages.indexOf(inf.stage) >= 0 && stages.indexOf(info[n].stage) > stages.indexOf(inf.stage)) add('error', Y.keyLine(inf.node, 'needs'), t('needs "' + n + '"(' + info[n].stage + ')는 뒤 스테이지(' + inf.stage + ')보다 늦어서 기다릴 수 없습니다', 'needs "' + n + '" (' + info[n].stage + ') is in a later stage than "' + name + '" (' + inf.stage + ') and cannot be waited for'));
      });
      var deps = inf.m.dependencies; if (Array.isArray(deps)) deps.forEach(function (d) { if (!info[d] || info[d].hidden) { if (!hasInclude) add('error', Y.keyLine(inf.node, 'dependencies'), t('dependencies 의 "' + d + '" 잡이 없습니다', 'dependencies refers to missing job "' + d + '"')); } else if (stages.indexOf(inf.stage) >= 0 && stages.indexOf(info[d].stage) >= stages.indexOf(inf.stage)) add('error', Y.keyLine(inf.node, 'dependencies'), t('dependencies "' + d + '" 는 이전 스테이지의 잡이어야 합니다', 'dependencies "' + d + '" must be a job from an earlier stage')); });
    });
    var st = {}, cyc = null;
    function vis(n, path) { if (st[n] === 2 || !info[n]) return; if (st[n] === 1) { cyc = cyc || path.slice(path.indexOf(n)).concat(n); return; } st[n] = 1; (graphNeeds[n] || []).forEach(function (d) { vis(d, path.concat(n)); }); st[n] = 2; }
    Object.keys(graphNeeds).forEach(function (n) { vis(n, []); });
    if (cyc) add('error', info[cyc[0]].line, t('needs 순환: ' + cyc.join(' → '), 'needs cycle: ' + cyc.join(' → ')));
    var ext2 = {}; (function () { var s2 = {}, c2 = null; function e(n, p) { if (s2[n] === 2 || !Y.isMap(js[n])) return; if (s2[n] === 1) { c2 = c2 || p.slice(p.indexOf(n)).concat(n); return; } s2[n] = 1; var x = js[n].extends; (x == null ? [] : Array.isArray(x) ? x : [x]).forEach(function (d) { e(d, p.concat(n)); }); s2[n] = 2; } Object.keys(js).forEach(function (n) { e(n, []); }); if (c2) add('error', Y.keyLine(root, c2[0]), t('extends 순환: ' + c2.join(' → '), 'extends cycle: ' + c2.join(' → '))); })();
    var visible = Object.keys(info).filter(function (n) { return !info[n].hidden; }); if (!visible.length) add('error', 1, t('실행할 잡이 없습니다', 'There are no jobs to run'));
    visible.sort(function (a, b) { return stages.indexOf(info[a].stage) - stages.indexOf(info[b].stage) || info[a].line - info[b].line; });
    var rows = visible.map(function (n) { var i = info[n]; return [n, i.stage, i.image || '—', String(i.lines), i.needs.join(', ') || '—', String(i.when), String(i.line)]; });
    var outTxt = stages.filter(function (s) { return visible.some(function (n) { return info[n].stage === s; }); }).map(function (s) { var js2 = visible.filter(function (n) { return info[n].stage === s; }); return s + ': ' + js2.map(function (n) { return n + (info[n].needs.length ? ' (needs ' + info[n].needs.join(', ') + ')' : ''); }).join(' | '); }).join('\n↓\n');
    if (hasInclude) add('info', Y.keyLine(root, 'include'), t('include 한 파일의 잡·템플릿은 가져올 수 없어 검사에서 제외됩니다. 해당 이름은 경고로만 표시합니다', 'Jobs and templates from included files cannot be fetched and are not checked; references to them are only warnings'));
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
    var shown = issues.filter(function (x) { return o.hints || x.sev !== 'info'; }).sort(function (a, b) { return a.line - b.line; });
    var list = shown.map(function (x) { return ICON[x.sev] + ' ' + t('줄 ', 'Line ') + x.line + ': ' + x.msg; });
    var errs = issues.filter(function (x) { return x.sev === 'error'; }).length, warns = issues.filter(function (x) { return x.sev === 'warn'; }).length;
    var msg = errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — 잡 ' + visible.length + '개', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + visible.length + ' job(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — 잡 ' + visible.length + '개', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + visible.length + ' job(s)');
    return { _status: { ok: errs ? false : true, msg: msg }, table: { head: [['잡', 'Job'], ['스테이지', 'Stage'], ['이미지', 'Image'], ['script 줄', 'Script lines'], ['needs', 'needs'], ['실행 조건', 'When'], ['줄', 'Line']], rows: rows }, issues: list, out: outTxt };
  }
});
