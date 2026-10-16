TK.tool('security-header-builder', {
  allowEmpty: true,
  inputs: [],
  options: [
    { id: 'fmt', type: 'select', label: ['출력 형식', 'Output format'], choices: [['nginx', 'Nginx'], ['apache', 'Apache (.htaccess)'], ['caddy', 'Caddy'], ['express', 'Express (helmet)'], ['netlify', 'Netlify / Cloudflare Pages (_headers)'], ['raw', ['헤더 목록', 'Plain header list']]], default: 'nginx' },
    { id: 'preset', type: 'select', label: ['프리셋', 'Preset'], choices: [['balanced', ['권장(균형)', 'Balanced (recommended)']], ['strict', ['엄격', 'Strict']], ['minimal', ['최소', 'Minimal']]], default: 'balanced' },
    { id: 'hsts', type: 'checkbox', label: ['HSTS (Strict-Transport-Security)', 'HSTS (Strict-Transport-Security)'], default: true },
    { id: 'hstsAge', type: 'number', label: ['HSTS max-age (일)', 'HSTS max-age (days)'], default: 365, min: 1, show: function (o) { return o.hsts; } },
    { id: 'hstsSub', type: 'checkbox', label: ['includeSubDomains', 'includeSubDomains'], default: true, show: function (o) { return o.hsts; } },
    { id: 'hstsPre', type: 'checkbox', label: ['preload', 'preload'], default: false, show: function (o) { return o.hsts; } },
    { id: 'cors', type: 'checkbox', label: ['CORS 헤더 추가', 'Add CORS headers'], default: false },
    { id: 'origin', type: 'text', label: ['허용 출처 (Access-Control-Allow-Origin)', 'Allowed origin (Access-Control-Allow-Origin)'], default: 'https://app.example.com', show: function (o) { return o.cors; } },
    { id: 'methods', type: 'text', label: ['허용 메서드', 'Allowed methods'], default: 'GET, POST, OPTIONS', show: function (o) { return o.cors; } },
    { id: 'headers', type: 'text', label: ['허용 요청 헤더', 'Allowed request headers'], default: 'Content-Type, Authorization', show: function (o) { return o.cors; } },
    { id: 'creds', type: 'checkbox', label: ['자격 증명 허용 (Allow-Credentials)', 'Allow credentials'], default: false, show: function (o) { return o.cors; } },
    { id: 'isolate', type: 'checkbox', label: ['교차 출처 격리 (COOP+COEP)', 'Cross-origin isolation (COOP + COEP)'], default: false }
  ],
  outputs: [{ id: 'out', label: ['보안 헤더 설정', 'Security header configuration'], kind: 'code', ext: 'conf' }, { id: 'table', label: ['적용되는 헤더', 'Headers applied'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var h = [], issues = [], pre = o.preset;
    if (o.hsts) {
      var age = Math.round(o.hstsAge) * 86400, val = 'max-age=' + age + (o.hstsSub ? '; includeSubDomains' : '') + (o.hstsPre ? '; preload' : '');
      h.push(['Strict-Transport-Security', val, t('HTTPS만 사용하도록 브라우저에 기억시킴', 'Makes browsers remember to use HTTPS only')]);
      if (o.hstsPre && (age < 31536000 || !o.hstsSub)) issues.push(t('HSTS preload 목록 등록 조건: max-age ≥ 1년(365일), includeSubDomains, preload 모두 필요합니다', 'HSTS preload list requires max-age ≥ 1 year, includeSubDomains and preload'));
      if (o.hstsPre) issues.push(t('preload는 되돌리기 어렵습니다 — 모든 하위 도메인이 HTTPS를 지원하는지 먼저 확인하세요', 'preload is hard to undo — make sure every subdomain supports HTTPS first'));
      if (age < 15552000) issues.push(t('max-age가 6개월 미만입니다 — 충분히 길게 설정하세요', 'max-age is under 6 months — make it longer'));
    }
    h.push(['X-Content-Type-Options', 'nosniff', t('MIME 스니핑 방지', 'Disables MIME sniffing')]);
    h.push(['X-Frame-Options', pre === 'minimal' ? 'SAMEORIGIN' : 'DENY', t('클릭재킹 방지 (CSP frame-ancestors로 대체 가능)', 'Clickjacking protection (CSP frame-ancestors can replace it)')]);
    h.push(['Referrer-Policy', pre === 'strict' ? 'no-referrer' : 'strict-origin-when-cross-origin', t('Referer 헤더로 새는 정보 제한', 'Limits information leaked via the Referer header')]);
    if (pre !== 'minimal') h.push(['Permissions-Policy', pre === 'strict' ? 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' : 'camera=(), microphone=(), geolocation=(), interest-cohort=()', t('브라우저 기능 사용 제한', 'Restricts browser features')]);
    if (pre === 'strict') h.push(['Cross-Origin-Resource-Policy', 'same-origin', t('다른 출처가 이 리소스를 불러오지 못하게 함', 'Stops other origins from loading this resource')]);
    if (o.isolate) { h.push(['Cross-Origin-Opener-Policy', 'same-origin', t('창 격리(COOP)', 'Window isolation (COOP)')], ['Cross-Origin-Embedder-Policy', 'require-corp', t('임베드 리소스는 CORP/CORS 필요(COEP)', 'Embedded resources need CORP/CORS (COEP)')]); issues.push(t('COEP require-corp를 켜면 CORS/CORP 헤더가 없는 외부 이미지·스크립트가 차단됩니다', 'COEP require-corp blocks third-party images/scripts that lack CORS/CORP headers')); }
    if (o.cors) {
      var origin = (o.origin || '').trim();
      if (!origin) throw new Error(t('허용 출처를 입력하세요', 'Enter an allowed origin'));
      if (origin === '*' && o.creds) issues.push(t('🚨 Access-Control-Allow-Origin: * 와 Allow-Credentials: true 는 함께 쓸 수 없습니다 (브라우저가 거부)', '🚨 Access-Control-Allow-Origin: * cannot be combined with Allow-Credentials: true (browsers reject it)'));
      if (origin === '*') issues.push(t('모든 출처를 허용하는 *는 공개 API에만 쓰세요', 'Use * (any origin) only for public APIs'));
      h.push(['Access-Control-Allow-Origin', origin, t('요청을 허용할 출처', 'Origin allowed to call this')], ['Access-Control-Allow-Methods', o.methods, t('허용 메서드', 'Allowed methods')], ['Access-Control-Allow-Headers', o.headers, t('허용 요청 헤더', 'Allowed request headers')], ['Access-Control-Max-Age', '86400', t('프리플라이트 결과 캐시(초)', 'Preflight cache (seconds)')]);
      if (o.creds) h.push(['Access-Control-Allow-Credentials', 'true', t('쿠키·인증 정보 허용', 'Allow cookies / credentials')]);
      if (origin !== '*') h.push(['Vary', 'Origin', t('출처별로 응답이 달라짐을 캐시에 알림', 'Tells caches the response varies by Origin')]);
    }
    issues.push(t('Content-Security-Policy는 사이트마다 달라 CSP 생성기에서 따로 만드세요', 'Content-Security-Policy is site-specific — build it with the CSP Builder'));
    var out;
    function q(s) { return String(s).replace(/"/g, '\\"'); }
    if (o.fmt === 'nginx') out = '# server { … } 또는 location 블록 안에\n' + h.map(function (x) { return 'add_header ' + x[0] + ' "' + q(x[1]) + '" always;'; }).join('\n');
    else if (o.fmt === 'apache') out = '<IfModule mod_headers.c>\n' + h.map(function (x) { return '  Header always set ' + x[0] + ' "' + q(x[1]) + '"'; }).join('\n') + '\n</IfModule>';
    else if (o.fmt === 'caddy') out = 'header {\n' + h.map(function (x) { return '  ' + x[0] + ' "' + q(x[1]) + '"'; }).join('\n') + '\n}';
    else if (o.fmt === 'netlify') out = '/*\n' + h.map(function (x) { return '  ' + x[0] + ': ' + x[1]; }).join('\n');
    else if (o.fmt === 'express') {
      var hl = h.filter(function (x) { return !/^Access-Control|^Vary$/.test(x[0]); }), cors = h.filter(function (x) { return /^Access-Control/.test(x[0]); });
      out = "const helmet = require('helmet');\napp.use(helmet({\n  hsts: " + (o.hsts ? '{ maxAge: ' + Math.round(o.hstsAge) * 86400 + ', includeSubDomains: ' + !!o.hstsSub + ', preload: ' + !!o.hstsPre + ' }' : 'false') + ',\n  frameguard: { action: \'' + (pre === 'minimal' ? 'sameorigin' : 'deny') + '\' },\n  referrerPolicy: { policy: \'' + (pre === 'strict' ? 'no-referrer' : 'strict-origin-when-cross-origin') + '\' },\n  crossOriginOpenerPolicy: ' + (o.isolate ? "{ policy: 'same-origin' }" : 'false') + ',\n  crossOriginEmbedderPolicy: ' + (o.isolate ? "{ policy: 'require-corp' }" : 'false') + ',\n  contentSecurityPolicy: false // configure CSP separately\n}));' + (cors.length ? "\n\nconst cors = require('cors');\napp.use(cors({ origin: '" + (o.origin || '') + "', methods: '" + o.methods + "'.split(/,\\s*/), allowedHeaders: '" + o.headers + "'.split(/,\\s*/), credentials: " + !!o.creds + ', maxAge: 86400 }));' : '') + '\n// Permissions-Policy is not covered by helmet defaults:\n' + (pre !== 'minimal' ? "app.use((req, res, next) => { res.setHeader('Permissions-Policy', '" + h.filter(function (x) { return x[0] === 'Permissions-Policy'; })[0][1] + "'); next(); });" : '');
    } else out = h.map(function (x) { return x[0] + ': ' + x[1]; }).join('\n');
    return { _status: t('✅ 헤더 ' + h.length + '개 설정을 만들었습니다', '✅ Built ' + h.length + ' header(s)'), out: out, table: { head: [['헤더', 'Header'], ['값', 'Value'], ['의미', 'Purpose']], rows: h }, issues: issues };
  }
});
