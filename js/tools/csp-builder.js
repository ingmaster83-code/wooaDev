TK.tool('csp-builder', {
  allowEmpty: true,
  inputs: [
    { id: 'policy', label: ['분석·테스트할 CSP', 'CSP to analyse / test'], rows: 5, sample: "default-src 'self'; script-src 'self' https://cdn.example.com 'unsafe-inline'; img-src 'self' data: https:; object-src *; frame-ancestors 'self'", show: function (o) { return o.mode !== 'build'; } },
    { id: 'tests', label: ['테스트할 요청 (한 줄에 하나: 종류 URL)', 'Requests to test (one per line: type URL)'], rows: 5, sample: 'script https://cdn.example.com/app.js\nscript https://evil.example.net/x.js\nimg https://images.example.org/a.png\nstyle inline\nconnect https://api.example.com/v1', show: function (o) { return o.mode === 'test'; } },
    { id: 'page', type: 'text', label: ['페이지 출처 (self)', 'Page origin (self)'], sample: 'https://www.example.com', show: function (o) { return o.mode === 'test'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['build', ['CSP 만들기', 'Build a CSP']], ['parse', ['CSP 분석·점검', 'Analyse & audit']], ['test', ['요청 허용 여부 테스트', 'Test whether requests are allowed']]], default: 'build' },
    { id: 'preset', type: 'select', label: ['프리셋', 'Preset'], choices: [['strict', ['엄격 (self만 허용, 인라인 금지)', 'Strict (self only, no inline)']], ['spa', ['SPA + 외부 API', 'SPA + external API']], ['wp', ['일반 사이트 (인라인·애널리틱스 허용, 느슨함)', 'Typical site (inline + analytics, loose)']], ['custom', ['직접 입력', 'Custom']]], default: 'strict', show: function (o) { return o.mode === 'build'; } },
    { id: 'scripts', type: 'text', label: ['script-src 추가 출처', 'Extra script-src sources'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'styles', type: 'text', label: ['style-src 추가 출처', 'Extra style-src sources'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'imgs', type: 'text', label: ['img-src 추가 출처', 'Extra img-src sources'], default: "data:", show: function (o) { return o.mode === 'build'; } },
    { id: 'conns', type: 'text', label: ['connect-src 추가 출처 (API)', 'Extra connect-src sources (APIs)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'frames', type: 'text', label: ['frame-src (임베드 허용)', 'frame-src (embeds allowed)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'report', type: 'text', label: ['report-uri / report-to (선택)', 'report-uri (optional)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'ro', type: 'checkbox', label: ['Report-Only 모드 (차단하지 않고 보고만)', 'Report-Only (report without blocking)'], default: false, show: function (o) { return o.mode === 'build'; } },
    { id: 'upgrade', type: 'checkbox', label: ['upgrade-insecure-requests', 'upgrade-insecure-requests'], default: true, show: function (o) { return o.mode === 'build'; } }
  ],
  sampleOptions: { mode: 'parse' },
  outputs: [{ id: 'out', label: ['CSP', 'CSP'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['지시어', 'Directives'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], policy;
    function parse(text) {
      var d = {}, order = [];
      text.split(';').forEach(function (part) { part = part.trim(); if (!part) return; var w = part.split(/\s+/), name = w[0].toLowerCase(); if (d[name]) { issues.push(t('지시어 ' + name + '이(가) 중복되었습니다 (첫 번째만 적용됨)', 'Directive ' + name + ' is duplicated (only the first applies)')); return; } d[name] = w.slice(1); order.push(name); });
      return { d: d, order: order };
    }
    if (o.mode === 'build') {
      var base = { 'default-src': ["'self'"], 'base-uri': ["'self'"], 'object-src': ["'none'"], 'form-action': ["'self'"], 'frame-ancestors': ["'self'"] };
      if (o.preset === 'strict') { base['script-src'] = ["'self'"]; base['style-src'] = ["'self'"]; base['img-src'] = ["'self'"]; base['font-src'] = ["'self'"]; base['connect-src'] = ["'self'"]; }
      else if (o.preset === 'spa') { base['script-src'] = ["'self'"]; base['style-src'] = ["'self'", "'unsafe-inline'"]; base['img-src'] = ["'self'", 'data:', 'https:']; base['font-src'] = ["'self'", 'data:']; base['connect-src'] = ["'self'", 'https:']; }
      else if (o.preset === 'wp') { base['script-src'] = ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com', 'https://pagead2.googlesyndication.com']; base['style-src'] = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']; base['img-src'] = ["'self'", 'data:', 'https:']; base['font-src'] = ["'self'", 'https://fonts.gstatic.com', 'data:']; base['connect-src'] = ["'self'", 'https://www.google-analytics.com']; base['frame-src'] = ['https://googleads.g.doubleclick.net']; base['object-src'] = ["'none'"]; }
      else { base['script-src'] = ["'self'"]; base['style-src'] = ["'self'"]; base['img-src'] = ["'self'"]; base['font-src'] = ["'self'"]; base['connect-src'] = ["'self'"]; }
      function addTo(k, text) { String(text || '').split(/[\s,]+/).filter(Boolean).forEach(function (x) { base[k] = base[k] || []; if (base[k].indexOf(x) < 0) base[k].push(x); }); }
      addTo('script-src', o.scripts); addTo('style-src', o.styles); addTo('img-src', o.imgs); addTo('connect-src', o.conns); addTo('frame-src', o.frames);
      if (o.upgrade) base['upgrade-insecure-requests'] = [];
      if (o.report && o.report.trim()) base['report-uri'] = [o.report.trim()];
      policy = Object.keys(base).map(function (k) { return [k].concat(base[k]).join(' '); }).join('; ');
    } else policy = String(v.policy || '').trim().replace(/^content-security-policy(-report-only)?\s*:\s*/i, '');
    if (!policy) throw new Error(t('CSP를 입력하세요', 'Enter a CSP'));
    var P = parse(policy), d = P.d;
    var EXPL = { 'default-src': ['다른 *-src가 없을 때의 기본 출처', 'Fallback for other fetch directives'], 'script-src': ['스크립트 출처', 'Script sources'], 'style-src': ['스타일 출처', 'Style sources'], 'img-src': ['이미지 출처', 'Image sources'], 'connect-src': ['fetch/XHR/WebSocket 대상', 'fetch / XHR / WebSocket targets'], 'font-src': ['폰트 출처', 'Font sources'], 'frame-src': ['<iframe> 출처', '<iframe> sources'], 'object-src': ['<object>/<embed> 출처', '<object>/<embed> sources'], 'media-src': ['오디오·비디오 출처', 'Audio/video sources'], 'base-uri': ['<base href> 제한', 'Restricts <base href>'], 'form-action': ['폼 전송 대상 제한', 'Restricts form targets'], 'frame-ancestors': ['이 페이지를 임베드할 수 있는 출처 (클릭재킹 방지)', 'Who may embed this page (clickjacking)'], 'upgrade-insecure-requests': ['http 요청을 https로 자동 승격', 'Upgrades http requests to https'], 'report-uri': ['위반 보고 주소', 'Violation report endpoint'], 'report-to': ['위반 보고 그룹', 'Violation report group'], 'worker-src': ['워커 출처', 'Worker sources'], 'manifest-src': ['웹 앱 매니페스트', 'Web app manifest'], 'script-src-elem': ['<script> 요소 출처', '<script> element sources'], 'style-src-elem': ['<style>/<link> 출처', '<style>/<link> sources'], 'sandbox': ['샌드박스 적용', 'Applies a sandbox'], 'require-trusted-types-for': ['Trusted Types 강제', 'Enforce Trusted Types'] };
    var rows = P.order.map(function (k) { var e = EXPL[k]; return [k, d[k].join(' ') || '—', e ? t(e[0], e[1]) : t('알 수 없는 지시어', 'Unknown directive')]; });
    // 점검
    P.order.forEach(function (k) {
      var s = d[k]; if (!(/-src|^default-src|^frame-ancestors|^form-action|^base-uri$/.test(k))) return;
      if (s.indexOf("'unsafe-inline'") >= 0 && !/^style/.test(k) && !/^img/.test(k)) issues.push(t(k + ": 'unsafe-inline' 이 있으면 XSS 방어 효과가 크게 줄어듭니다 (nonce/hash 권장)", k + ": 'unsafe-inline' largely defeats XSS protection (prefer nonces/hashes)"));
      if (s.indexOf("'unsafe-eval'") >= 0) issues.push(t(k + ": 'unsafe-eval' 은 eval()·new Function 을 허용합니다", k + ": 'unsafe-eval' allows eval() and new Function"));
      if (s.indexOf('*') >= 0 || s.indexOf('http:') >= 0 || s.indexOf('data:') >= 0 && /^script|^default|^object/.test(k)) issues.push(t(k + ': ' + (s.indexOf('*') >= 0 ? '와일드카드(*)' : s.indexOf('http:') >= 0 ? 'http:' : 'data:') + ' 출처가 너무 넓습니다', k + ': ' + (s.indexOf('*') >= 0 ? 'wildcard (*)' : s.indexOf('http:') >= 0 ? 'http:' : 'data:') + ' is too broad'));
      if (/^script/.test(k) && s.some(function (x) { return /^https:\/\/(\*\.)?(googleapis|gstatic|cloudflare|jsdelivr|unpkg|cdnjs)/.test(x); })) issues.push(t(k + ': 공용 CDN 전체를 허용하면 그 CDN에 올라간 임의 스크립트도 실행됩니다 — 정확한 경로·nonce를 쓰세요', k + ': allowing a whole public CDN permits any script hosted there — use exact paths or nonces'));
    });
    if (!d['default-src'] && !d['script-src']) issues.push(t('default-src도 script-src도 없어 스크립트가 제한되지 않습니다', 'Neither default-src nor script-src is set, so scripts are unrestricted'));
    if (!d['object-src'] && !(d['default-src'] && d['default-src'].indexOf("'none'") >= 0)) issues.push(t("object-src 'none' 이 없습니다 (플러그인 임베드 차단 권장)", "object-src 'none' is missing (block plugins)"));
    if (!d['base-uri']) issues.push(t("base-uri 가 없습니다 — <base> 태그 주입을 막으려면 'self' 또는 'none' 을 지정하세요", "base-uri is missing — set 'self' or 'none' to block <base> injection"));
    if (!d['frame-ancestors']) issues.push(t('frame-ancestors 가 없습니다 (X-Frame-Options 또는 frame-ancestors로 클릭재킹 방어)', 'frame-ancestors is missing (protect against clickjacking via it or X-Frame-Options)'));
    if (!d['form-action']) issues.push(t('form-action 이 없습니다 — 폼이 외부로 전송되는 것을 막지 못합니다', 'form-action is missing — forms can submit anywhere'));
    var hdr = (o.ro ? 'Content-Security-Policy-Report-Only: ' : 'Content-Security-Policy: ') + policy;
    if (o.mode === 'build') {
      if (d['report-uri'] === undefined && o.ro) issues.push(t('Report-Only 모드인데 report-uri가 없어 위반을 받아볼 곳이 없습니다', 'Report-Only without report-uri gives you nowhere to receive violations'));
      if (d['frame-ancestors'] || d['report-uri'] || d['sandbox']) issues.push(t('frame-ancestors·report-uri·sandbox는 <meta> 태그로는 동작하지 않으니 HTTP 헤더로 보내세요', 'frame-ancestors, report-uri and sandbox do not work in a <meta> tag — send them as an HTTP header'));
    }
    var out = hdr + '\n\n' + t('<!-- <meta> 태그 (일부 지시어 제외) -->', '<!-- <meta> tag (some directives excluded) -->') + '\n<meta http-equiv="Content-Security-Policy" content="' + policy.replace(/"/g, '&quot;') + '">\n\n# Nginx\nadd_header Content-Security-Policy "' + policy.replace(/"/g, '\\"') + '" always;\n\n# Apache\nHeader always set Content-Security-Policy "' + policy.replace(/"/g, '\\"') + '"';
    if (o.mode !== 'test') return { _status: issues.length ? { ok: 'info', msg: t('🔍 점검할 항목 ' + issues.length + '개', '🔍 ' + issues.length + ' finding(s)') } : t('✅ 기본 점검을 통과했습니다', '✅ Passed the basic checks'), out: o.mode === 'parse' ? policy : out, table: { head: [['지시어', 'Directive'], ['출처', 'Sources'], ['의미', 'Meaning']], rows: rows }, issues: issues };
    // ── 테스트 ──
    var page; try { page = new URL(String(v.page || '').trim()); } catch (e) { throw new Error(t('페이지 출처가 올바른 URL이 아닙니다 (예: https://www.example.com)', 'The page origin is not a valid URL (e.g. https://www.example.com)')); }
    var FALL = { script: 'script-src', style: 'style-src', img: 'img-src', connect: 'connect-src', font: 'font-src', frame: 'frame-src', object: 'object-src', media: 'media-src', worker: 'worker-src', 'form-action': 'form-action', 'base-uri': 'base-uri', manifest: 'manifest-src' };
    function srcMatch(list, urlStr) {
      var u; try { u = new URL(urlStr); } catch (e) { return { ok: false, why: t('URL 형식 오류', 'Invalid URL') }; }
      if (list.indexOf("'none'") >= 0 && list.length === 1) return { ok: false, why: "'none'" };
      for (var i = 0; i < list.length; i++) {
        var s = list[i], sl = s.toLowerCase();
        if (sl === "'self'") { if (u.origin === page.origin || (u.protocol === page.protocol && u.host === page.host)) return { ok: true, why: "'self'" }; continue; }
        if (sl === '*') { if (/^(https?|wss?):$/.test(u.protocol)) return { ok: true, why: '*' }; continue; }
        if (/^[a-z][a-z0-9+.-]*:$/.test(sl)) { if (u.protocol === sl || (sl === 'https:' && u.protocol === 'https:') || (sl === 'http:' && /^https?:$/.test(u.protocol)) || (sl === 'ws:' && /^wss?:$/.test(u.protocol))) return { ok: true, why: s }; continue; }
        if (/^'/.test(s)) continue;
        var m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*|\*\.[^/:]+|[^/:*]+)(?::(\*|\d+))?(\/.*)?$/i.exec(s);
        if (!m) continue;
        var sch = m[1] ? m[1].toLowerCase() + ':' : null, host = m[2].toLowerCase(), port = m[3], path = m[4];
        if (sch && sch !== u.protocol && !(sch === 'http:' && u.protocol === 'https:')) continue;
        if (!sch && !(u.protocol === 'https:' || u.protocol === page.protocol)) continue;
        var hOk = host === '*' || host === u.hostname.toLowerCase() || (/^\*\./.test(host) && u.hostname.toLowerCase().endsWith(host.slice(1)));
        if (!hOk) continue;
        if (port && port !== '*' && port !== (u.port || (u.protocol === 'https:' ? '443' : '80'))) continue;
        if (!port && u.port && u.port !== (u.protocol === 'https:' ? '443' : '80')) continue;
        if (path && path !== '/' && !(path.slice(-1) === '/' ? u.pathname.indexOf(path) === 0 : u.pathname === path)) continue;
        return { ok: true, why: s };
      }
      return { ok: false, why: t('목록에 일치하는 출처가 없음', 'No matching source') };
    }
    var res = [], blocked = 0;
    String(v.tests || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (ln) {
      var m2 = /^(\S+)\s+(.+)$/.exec(ln);
      if (!m2) { res.push({ cls: 'r-bad', cells: [ln, '—', t('"종류 URL" 형식이 아닙니다', 'Not in "type URL" form'), '']}); return; }
      var type = m2[1].toLowerCase(), target = m2[2].trim(), dirName = FALL[type];
      if (!dirName) { res.push({ cls: 'r-bad', cells: [ln, '—', t('알 수 없는 종류 (script, style, img, connect, font, frame, object, media, worker, form-action)', 'Unknown type (script, style, img, connect, font, frame, object, media, worker, form-action)'), '']}); return; }
      var eff = d[dirName] ? dirName : (/^(form-action|base-uri)$/.test(dirName) ? null : 'default-src');
      if (!eff || !d[eff]) { res.push({ cls: 'r-ok', cells: [ln, '✅', t('이 지시어에 제한이 없어 허용됨', 'No restriction for this directive — allowed'), dirName] }); return; }
      if (target.toLowerCase() === 'inline') {
        var list = d[eff], hasNonce = list.some(function (x) { return /^'(nonce|sha\d+)-/i.test(x); }), allowed = list.indexOf("'unsafe-inline'") >= 0 && !hasNonce;
        res.push({ cls: allowed ? 'r-ok' : 'r-bad', cells: [ln, allowed ? '✅' : '🚫', allowed ? "'unsafe-inline' 허용" : (hasNonce ? t('nonce/hash가 있어 일치하는 인라인만 허용됨', 'Only inline code with a matching nonce/hash is allowed') : t("'unsafe-inline' 이 없어 인라인 차단", "No 'unsafe-inline' — inline blocked")), eff] }); if (!allowed) blocked++; return;
      }
      var r = srcMatch(d[eff], target); if (!r.ok) blocked++;
      res.push({ cls: r.ok ? 'r-ok' : 'r-bad', cells: [ln, r.ok ? '✅ ' + t('허용', 'allowed') : '🚫 ' + t('차단', 'blocked'), r.ok ? t('일치: ', 'Matched: ') + r.why : r.why, eff + (eff !== dirName ? t(' (대체)', ' (fallback)') : '')] });
    });
    return { _status: t('✅ ' + res.length + '건 중 ' + blocked + '건 차단', '✅ ' + blocked + ' of ' + res.length + ' blocked'), out: policy, table: { head: [['요청', 'Request'], ['결과', 'Result'], ['이유', 'Why'], ['적용 지시어', 'Directive']], rows: res }, issues: issues };
  }
});
