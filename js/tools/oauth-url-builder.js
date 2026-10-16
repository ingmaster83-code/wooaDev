TK.tool('oauth-url-builder', {
  allowEmpty: true,
  inputs: [
    { id: 'url', label: ['분석할 인가 요청 URL', 'Authorization URL to analyse'], rows: 4, sample: 'https://accounts.example.com/oauth2/authorize?response_type=token&client_id=abc123&redirect_uri=http%3A%2F%2Fapp.example.com%2Fcb&scope=openid%20email', show: function (o) { return o.mode === 'parse'; } },
    { id: 'endpoint', type: 'text', label: ['인가 엔드포인트', 'Authorization endpoint'], sample: 'https://accounts.example.com/oauth2/authorize', show: function (o) { return o.mode === 'build'; } },
    { id: 'client', type: 'text', label: ['client_id', 'client_id'], sample: 'my-client', show: function (o) { return o.mode === 'build'; } },
    { id: 'redirect', type: 'text', label: ['redirect_uri', 'redirect_uri'], sample: 'https://app.example.com/callback', show: function (o) { return o.mode === 'build'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['build', ['URL 만들기', 'Build a URL']], ['parse', ['URL 분석·점검', 'Parse & audit a URL']]], default: 'build' },
    { id: 'rt', type: 'select', label: ['response_type', 'response_type'], choices: [['code', 'code (Authorization Code)'], ['id_token', 'id_token (OIDC implicit)'], ['code id_token', 'code id_token (hybrid)'], ['token', ['token (암시적 흐름, 비권장)', 'token (implicit, deprecated)']]], default: 'code', show: function (o) { return o.mode === 'build'; } },
    { id: 'scope', type: 'text', label: ['scope (공백 구분)', 'scope (space-separated)'], default: 'openid profile email', show: function (o) { return o.mode === 'build'; } },
    { id: 'state', type: 'text', label: ['state (비우면 자동 생성)', 'state (empty = auto)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'nonce', type: 'text', label: ['nonce (OIDC, 비우면 자동)', 'nonce (OIDC, empty = auto)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'challenge', type: 'text', label: ['code_challenge (PKCE, 선택)', 'code_challenge (PKCE, optional)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'prompt', type: 'select', label: ['prompt', 'prompt'], choices: [['', '(none)'], ['login', 'login'], ['consent', 'consent'], ['select_account', 'select_account'], ['none', 'none']], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'extra', type: 'text', label: ['추가 파라미터 (a=1&b=2)', 'Extra parameters (a=1&b=2)'], default: '', show: function (o) { return o.mode === 'build'; } }
  ],
  sampleOptions: { mode: 'parse' },
  outputs: [{ id: 'out', label: ['인가 URL', 'Authorization URL'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['파라미터 설명', 'Parameters'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var B = TK.bytes, H = TK.hash, params = [], base, issues = [];
    if (o.mode === 'build') {
      base = String(v.endpoint || '').trim();
      if (!/^https?:\/\//i.test(base)) throw new Error(t('인가 엔드포인트는 https:// 로 시작하는 URL이어야 합니다', 'The authorization endpoint must be an http(s) URL'));
      if (!v.client) throw new Error(t('client_id를 입력하세요', 'Enter a client_id'));
      var rnd = function () { return H.b64url(B.random(16)); };
      params.push(['response_type', o.rt], ['client_id', v.client]);
      if (v.redirect) params.push(['redirect_uri', v.redirect]);
      if (o.scope.trim()) params.push(['scope', o.scope.trim().replace(/\s+/g, ' ')]);
      params.push(['state', (o.state || '').trim() || rnd()]);
      if (/openid/.test(o.scope) || /id_token/.test(o.rt)) params.push(['nonce', (o.nonce || '').trim() || rnd()]);
      if (o.challenge && o.challenge.trim()) params.push(['code_challenge', o.challenge.trim()], ['code_challenge_method', 'S256']);
      if (o.prompt) params.push(['prompt', o.prompt]);
      String(o.extra || '').split('&').filter(Boolean).forEach(function (kv) { var i = kv.indexOf('='); params.push(i < 0 ? [kv, ''] : [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))]); });
    } else {
      var raw = String(v.url || '').trim(); if (!raw) throw new Error(t('인가 요청 URL을 붙여 넣으세요', 'Paste an authorization URL'));
      var u; try { u = new URL(raw); } catch (e) { throw new Error(t('URL 형식이 올바르지 않습니다', 'Invalid URL')); }
      base = u.origin + u.pathname; u.searchParams.forEach(function (val, key) { params.push([key, val]); });
    }
    var P = {}; params.forEach(function (p) { P[p[0]] = p[1]; });
    var DESC = { response_type: ['응답 유형: code=인가 코드, token/id_token=암시적 흐름', 'Response type: code = authorization code; token/id_token = implicit'], client_id: ['앱을 식별하는 ID', 'Identifies your application'], redirect_uri: ['인가 후 돌아올 주소 (사전 등록값과 정확히 일치해야 함)', 'Where to return after consent (must match the registered value exactly)'], scope: ['요청하는 권한 목록', 'Requested permissions'], state: ['CSRF 방지용 임의 값 — 콜백에서 같은지 확인', 'Random CSRF token — verify it on the callback'], nonce: ['ID 토큰 재전송 방지용 임의 값(OIDC)', 'Replay protection for the ID token (OIDC)'], code_challenge: ['PKCE 챌린지', 'PKCE challenge'], code_challenge_method: ['PKCE 방식 (S256 권장)', 'PKCE method (S256 recommended)'], prompt: ['로그인·동의 화면 표시 방식', 'How to show login / consent'], response_mode: ['응답 전달 방식 (query, fragment, form_post)', 'Response delivery (query, fragment, form_post)'], login_hint: ['미리 채울 계정 힌트', 'Account hint to pre-fill'], access_type: ['offline이면 refresh_token 요청 (Google)', 'offline requests a refresh_token (Google)'], audience: ['대상 API(Auth0 등)', 'Target API (Auth0 etc.)'] };
    var rows = params.map(function (p) { var d = DESC[p[0]]; return [p[0], p[1], d ? t(d[0], d[1]) : '']; });
    var rt = P.response_type || '';
    if (!P.response_type) issues.push(t('response_type이 없습니다 (필수)', 'response_type is missing (required)'));
    if (!P.client_id) issues.push(t('client_id가 없습니다 (필수)', 'client_id is missing (required)'));
    if (!P.state) issues.push(t('state가 없습니다 — CSRF 방어를 위해 반드시 사용하세요', 'state is missing — always use it for CSRF protection'));
    if (/(^|\s)(token)(\s|$)/.test(rt)) issues.push(t('response_type=token(암시적 흐름)은 OAuth 2.1에서 제거되었습니다. 인가 코드 + PKCE를 쓰세요', 'response_type=token (implicit flow) was removed in OAuth 2.1 — use authorization code with PKCE'));
    if (/code/.test(rt) && !P.code_challenge) issues.push(t('PKCE(code_challenge)가 없습니다 — 공개 클라이언트(SPA·모바일)에서는 필수에 가깝습니다', 'No PKCE (code_challenge) — essentially required for public clients (SPA, mobile)'));
    if (P.code_challenge && P.code_challenge_method !== 'S256') issues.push(t('code_challenge_method는 S256을 권장합니다 (기본값 plain)', 'Prefer code_challenge_method=S256 (the default is plain)'));
    if (/openid/.test(P.scope || '') && !/^code$/.test(rt) && !P.nonce) issues.push(t('OIDC에서 id_token을 받는 요청에는 nonce가 필요합니다', 'OIDC requests that return an id_token need a nonce'));
    if (/id_token/.test(rt) && !/openid/.test(P.scope || '')) issues.push(t('id_token을 요청하려면 scope에 openid가 필요합니다', 'Requesting an id_token needs openid in scope'));
    if (P.redirect_uri) {
      if (/^http:\/\//i.test(P.redirect_uri) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(P.redirect_uri)) issues.push(t('redirect_uri가 http:// 입니다 — 로컬호스트가 아니면 https를 쓰세요', 'redirect_uri uses http:// — use https unless it is localhost'));
      if (/#/.test(P.redirect_uri)) issues.push(t('redirect_uri에 #(프래그먼트)가 있으면 안 됩니다', 'redirect_uri must not contain a fragment (#)'));
      if (/\*/.test(P.redirect_uri)) issues.push(t('redirect_uri에 와일드카드(*)를 쓰면 오픈 리다이렉트 위험이 있습니다', 'A wildcard in redirect_uri risks open redirects'));
    } else issues.push(t('redirect_uri가 없습니다 (등록된 기본값을 쓰는 경우가 아니면 지정하세요)', 'redirect_uri is missing (specify it unless a registered default is used)'));
    if (/openid/.test(P.scope || '') === false && /(profile|email)/.test(P.scope || '')) issues.push(t('profile·email은 OIDC 스코프라 openid와 함께 써야 합니다', 'profile and email are OIDC scopes that go with openid'));
    var qs = params.map(function (p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]).replace(/%20/g, '%20'); }).join('&');
    return { _status: issues.length ? { ok: 'info', msg: t('🔍 점검할 항목 ' + issues.length + '개', '🔍 ' + issues.length + ' finding(s)') } : t('✅ 기본 점검을 통과했습니다', '✅ Passed the basic checks'), out: base + '?' + qs, table: { head: [['파라미터', 'Parameter'], ['값', 'Value'], ['설명', 'Meaning']], rows: rows }, issues: issues };
  }
});
