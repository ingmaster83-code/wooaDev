TK.tool('pkce-generator', {
  allowEmpty: true,
  inputs: [{ id: 'verifier', type: 'text', label: ['code_verifier (비우면 새로 생성)', 'code_verifier (empty = generate)'], sample: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', placeholder: ['43~128자의 영문·숫자·-._~', '43–128 characters of A-Z a-z 0-9 -._~'] }],
  options: [
    { id: 'len', type: 'number', label: ['생성 길이 (43~128)', 'Length to generate (43–128)'], default: 64, min: 43, max: 128 },
    { id: 'method', type: 'select', label: ['code_challenge_method', 'code_challenge_method'], choices: [['S256', 'S256 (권장 / recommended)'], ['plain', 'plain']], default: 'S256' },
    { id: 'extra', type: 'checkbox', label: ['state·nonce도 함께 생성', 'Also generate state and nonce'], default: true },
    { id: 'clientId', type: 'text', label: ['예제용 client_id', 'client_id for the example'], default: 'my-client' },
    { id: 'redirect', type: 'text', label: ['예제용 redirect_uri', 'redirect_uri for the example'], default: 'https://app.example.com/callback' }
  ],
  sampleOptions: { method: 'S256', extra: false },
  outputs: [{ id: 'table', label: ['PKCE 값', 'PKCE values'], kind: 'table' }, { id: 'out', label: ['요청 예시', 'Request examples'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var H = TK.hash, B = TK.bytes, CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~', ver = String(v.verifier || '').trim();
    if (ver) { if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(ver)) throw new Error(t('code_verifier는 영문·숫자·- . _ ~ 로 이루어진 43~128자여야 합니다 (현재 ' + ver.length + '자)', 'code_verifier must be 43–128 characters from A-Z a-z 0-9 - . _ ~ (now ' + ver.length + ')')); }
    else { var n = Math.max(43, Math.min(128, Math.round(o.len) || 64)); ver = ''; for (var i = 0; i < n; i++) ver += CH[B.randInt(CH.length)]; }
    function rnd(n) { return H.b64url(B.random(n)); }
    return (o.method === 'plain' ? Promise.resolve(H.utf8(ver)) : H.sha('SHA-256', H.utf8(ver))).then(function (d) {
      var chal = o.method === 'plain' ? ver : H.b64url(d), state = o.extra ? rnd(16) : '', nonce = o.extra ? rnd(16) : '';
      var q = ['response_type=code', 'client_id=' + encodeURIComponent(o.clientId || 'my-client'), 'redirect_uri=' + encodeURIComponent(o.redirect || ''), 'scope=' + encodeURIComponent('openid profile'), 'code_challenge=' + chal, 'code_challenge_method=' + o.method];
      if (state) q.push('state=' + state); if (nonce) q.push('nonce=' + nonce);
      var auth = 'GET https://auth.example.com/authorize?' + q.join('&');
      var tok = 'POST https://auth.example.com/token\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code&code=<AUTH_CODE>&client_id=' + encodeURIComponent(o.clientId || 'my-client') + '&redirect_uri=' + encodeURIComponent(o.redirect || '') + '&code_verifier=' + ver;
      var rows = [['code_verifier', ver], ['code_challenge', chal], ['code_challenge_method', o.method], ['verifier ' + t('길이', 'length'), String(ver.length)]];
      if (state) rows.push(['state', state], ['nonce', nonce]);
      return { _status: o.method === 'plain' ? { ok: 'info', msg: t('⚠️ plain 방식은 verifier가 그대로 노출되어 보안 효과가 약합니다. 가능하면 S256을 쓰세요.', '⚠️ plain exposes the verifier itself and offers little protection — prefer S256.') } : t('✅ PKCE 값을 만들었습니다. verifier는 세션에만 보관하고 challenge만 인가 요청에 보냅니다.', '✅ PKCE values created. Keep the verifier in the session and send only the challenge in the authorization request.'),
        table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, out: '# 1) ' + t('인가 요청 (브라우저 리다이렉트)', 'Authorization request (browser redirect)') + '\n' + auth + '\n\n# 2) ' + t('토큰 교환 (서버/앱에서)', 'Token exchange (from your server/app)') + '\n' + tok };
    });
  }
});
