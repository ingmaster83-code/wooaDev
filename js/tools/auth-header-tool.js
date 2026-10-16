TK.tool('auth-header-tool', {
  inputs: [
    { id: 'in', label: ['Authorization 헤더 또는 토큰', 'Authorization header or token'], rows: 4, sample: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYiLCJuYW1lIjoiS2ltIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.signature', show: function (o) { return o.mode === 'inspect'; } },
    { id: 'user', type: 'text', label: ['사용자 이름', 'Username'], sample: 'aladdin', show: function (o) { return o.mode === 'basic'; } },
    { id: 'pass', type: 'text', label: ['비밀번호', 'Password'], sample: 'open sesame', show: function (o) { return o.mode === 'basic'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['inspect', ['헤더·토큰 검사 (Basic 해독, Bearer/JWT)', 'Inspect header / token (Basic decode, Bearer/JWT)']], ['basic', ['Basic 헤더 만들기', 'Build a Basic header']]], default: 'inspect' },
    { id: 'now', type: 'text', label: ['기준 시각 (ISO 8601, 비우면 지금)', 'Reference time (ISO 8601, empty = now)'], default: '', show: function (o) { return o.mode === 'inspect'; } }
  ],
  sampleOptions: { mode: 'inspect', now: '2023-11-14T22:30:00Z' },
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['상세', 'Details'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var H = TK.hash, T = TK.time, issues = [], rows = [];
    function b64utf8(u8) { return new TextDecoder().decode(u8); }
    if (o.mode === 'basic') {
      if (v.user.indexOf(':') >= 0) issues.push(t('사용자 이름에 ":"가 있으면 Basic 인증에서 구분이 모호해집니다 (RFC 7617)', 'A ":" in the username makes Basic auth ambiguous (RFC 7617)'));
      var b = H.b64(H.utf8(v.user + ':' + v.pass));
      return { _status: { ok: issues.length ? 'info' : true, msg: issues.length ? '⚠️ ' + issues[0] : t('✅ Basic 헤더를 만들었습니다 — HTTPS에서만 사용하세요', '✅ Basic header built — only use it over HTTPS') }, out: 'Authorization: Basic ' + b, table: { head: [['항목', 'Item'], ['값', 'Value']], rows: [['user:pass', v.user + ':' + v.pass], ['Base64', b], ['curl', "curl -u '" + v.user + ":" + v.pass + "' https://api.example.com/"], ['curl (header)', "curl -H 'Authorization: Basic " + b + "' https://api.example.com/"]] }, issues: issues };
    }
    var raw = String(v.in || '').trim().replace(/^authorization\s*:\s*/i, ''), m = /^(\S+)\s+(.+)$/.exec(raw), scheme = m ? m[1] : '', cred = m ? m[2].trim() : raw;
    if (!raw) throw new Error(t('헤더나 토큰을 입력하세요', 'Enter a header or token'));
    var now = o.now && o.now.trim() ? (T.parseISO(o.now.trim()) || {}).ns : BigInt(Date.now()) * 1000000n;
    if (!now) throw new Error(t('기준 시각 형식이 올바르지 않습니다', 'Invalid reference time'));
    if (/^basic$/i.test(scheme)) {
      var dec; try { dec = b64utf8(H.fromB64(cred)); } catch (e) { throw new Error(t('Basic 값이 올바른 Base64가 아닙니다', 'The Basic value is not valid Base64')); }
      var i = dec.indexOf(':');
      if (i < 0) issues.push(t('디코딩 결과에 ":"가 없습니다 (user:password 형식이 아님)', 'Decoded value has no ":" (not user:password)'));
      rows = [['scheme', 'Basic'], [t('사용자', 'User'), i < 0 ? dec : dec.slice(0, i)], [t('비밀번호', 'Password'), i < 0 ? '' : dec.slice(i + 1)]];
      issues.push(t('Basic 인증은 자격 증명이 Base64(암호화 아님)로만 전달됩니다. 반드시 HTTPS에서 쓰고 로그에 남기지 마세요', 'Basic auth sends credentials only Base64-encoded (not encrypted) — use HTTPS and keep it out of logs'));
      return { _status: t('✅ Basic 인증 헤더를 해독했습니다', '✅ Basic header decoded'), out: dec, table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, issues: issues };
    }
    var token = /^bearer$/i.test(scheme) ? cred : (m ? cred : raw), parts = token.split('.');
    if (parts.length === 3 && /^[A-Za-z0-9_-]+$/.test(parts[0]) && /^[A-Za-z0-9_-]+$/.test(parts[1])) {
      var hd, pl;
      try { hd = JSON.parse(b64utf8(H.fromB64(parts[0]))); pl = JSON.parse(b64utf8(H.fromB64(parts[1]))); } catch (e) { throw new Error(t('JWT 헤더·페이로드를 JSON으로 읽을 수 없습니다', 'Cannot read the JWT header/payload as JSON')); }
      function ts(n) { return typeof n === 'number' ? T.iso(BigInt(Math.round(n)) * 1000000000n, 0) : String(n); }
      rows.push([t('알고리즘 (alg)', 'Algorithm (alg)'), String(hd.alg)], ['typ', String(hd.typ || '')]);
      if (hd.kid) rows.push(['kid', hd.kid]);
      Object.keys(pl).forEach(function (k) { var val = pl[k]; rows.push([k, (['exp', 'iat', 'nbf', 'auth_time'].indexOf(k) >= 0 ? ts(val) + '  (' + val + ')' : JSON.stringify(val))]); });
      var nowSec = Number(T.fdiv(now, T.NS_SEC));
      if (pl.exp !== undefined) { if (nowSec >= pl.exp) issues.push(t('⏰ 만료되었습니다 (' + ts(pl.exp) + ', ' + Math.round((nowSec - pl.exp) / 60) + '분 전)', '⏰ Expired (' + ts(pl.exp) + ', ' + Math.round((nowSec - pl.exp) / 60) + ' min ago)')); else issues.push(t('✅ 유효 기간 내입니다 — 만료까지 ' + Math.round((pl.exp - nowSec) / 60) + '분', '✅ Within validity — expires in ' + Math.round((pl.exp - nowSec) / 60) + ' min')); } else issues.push(t('exp(만료) 클레임이 없습니다 — 영구 토큰일 수 있습니다', 'No exp claim — the token may never expire'));
      if (pl.nbf !== undefined && nowSec < pl.nbf) issues.push(t('아직 유효하지 않습니다 (nbf ' + ts(pl.nbf) + ')', 'Not valid yet (nbf ' + ts(pl.nbf) + ')'));
      if (/^none$/i.test(hd.alg)) issues.push(t('🚨 alg=none 입니다 — 서명이 없는 토큰이므로 서버가 거부해야 합니다', '🚨 alg=none — unsigned token that a server must reject'));
      if (/^HS/.test(hd.alg)) issues.push(t('HMAC(HS*) 서명: 비밀 키를 아는 쪽만 검증·발급할 수 있습니다', 'HMAC (HS*) signature: only holders of the shared secret can issue/verify'));
      issues.push(t('이 도구는 서명을 검증하지 않습니다 — 내용은 누구나 읽을 수 있으므로 민감 정보를 넣지 마세요', 'This tool does not verify the signature — the content is readable by anyone, so keep secrets out of it'));
      return { _status: t('✅ JWT 토큰을 해석했습니다', '✅ JWT decoded'), out: JSON.stringify(hd, null, 2) + '\n\n' + JSON.stringify(pl, null, 2), table: { head: [['클레임', 'Claim'], ['값', 'Value']], rows: rows }, issues: issues };
    }
    // 불투명 토큰
    var KNOWN = [[/^ghp_[A-Za-z0-9]{36}$/, 'GitHub personal access token (classic)'], [/^github_pat_[A-Za-z0-9_]{50,}$/, 'GitHub fine-grained PAT'], [/^gho_|^ghu_|^ghs_|^ghr_/, 'GitHub OAuth/app token'], [/^xox[baprs]-/, 'Slack token'], [/^sk_(live|test)_/, 'Stripe secret key'], [/^AKIA[0-9A-Z]{16}$/, 'AWS access key ID'], [/^ya29\./, 'Google OAuth access token'], [/^AIza[0-9A-Za-z_-]{35}$/, 'Google API key'], [/^glpat-/, 'GitLab personal access token'], [/^npm_[A-Za-z0-9]{36}$/, 'npm token'], [/^[0-9a-f]{32}$/i, t('32자리 16진수 (MD5 형태 또는 API 키)', '32 hex characters (MD5-like or API key)')], [/^[0-9a-f]{40}$/i, t('40자리 16진수 (SHA-1 형태 또는 토큰)', '40 hex characters (SHA-1-like or token)')]];
    var kind = KNOWN.filter(function (k) { return k[0].test(token); })[0];
    var bits = Math.round(token.length * (/^[0-9a-fA-F]+$/.test(token) ? 4 : /^[A-Za-z0-9+/=_-]+$/.test(token) ? 6 : 6.5));
    rows = [[t('종류(추정)', 'Type (guess)'), kind ? kind[1] : t('불투명 토큰(Opaque)', 'Opaque token')], [t('길이', 'Length'), token.length + t('자', ' chars')], [t('엔트로피 상한(추정)', 'Entropy ceiling (estimate)'), '~' + bits + t('비트', ' bits')], [t('스킴', 'Scheme'), scheme || t('(없음)', '(none)')]];
    if (kind && /GitHub|Slack|Stripe|AWS|Google|GitLab|npm/.test(kind[1])) issues.push(t('🚨 서비스 자격 증명으로 보입니다. 공유·커밋했다면 즉시 폐기(revoke)하세요', '🚨 This looks like a service credential — revoke it immediately if it was shared or committed'));
    if (token.length < 20) issues.push(t('토큰이 짧습니다 — 추측 공격에 약할 수 있습니다', 'The token is short and may be guessable'));
    return { _status: t('✅ 불투명 토큰으로 분석했습니다 (JWT 형식이 아님)', '✅ Analysed as an opaque token (not a JWT)'), out: token.length > 12 ? token.slice(0, 6) + '…' + token.slice(-4) : token, table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, issues: issues };
  }
});
