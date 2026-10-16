TK.tool('apns-token-formatter', {
  inputs: [{ id: 'in', label: ['APNs 디바이스 토큰 (16진수, <…> 형식, Base64 모두 가능 — 한 줄에 하나)', 'APNs device tokens (hex, <…> form or Base64 — one per line)'], rows: 6, sample: '<740f4707 bebcf74f 9b7c25d4 8e335894 5f6aa01d a5ddb387 462c7eaf 61bb78ad>\n740F4707BEBCF74F9B7C25D48E3358945F6AA01DA5DDB387462C7EAF61BB78AD\nc9o41ze/NiA=' }],
  options: [{ id: 'upper', type: 'checkbox', label: ['16진수를 대문자로 출력', 'Uppercase hex output'], default: false }],
  outputs: [{ id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }, { id: 'out', label: ['서버에 보낼 값 (소문자 16진수)', 'Value for your server (lowercase hex)'], kind: 'code', ext: 'txt' }, { id: 'code', label: ['앱 코드 예시', 'App code samples'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var H = TK.hash, lines = String(v.in).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('토큰을 입력하세요', 'Enter a token'));
    var rows = [], outs = [], issues = [], bad = 0;
    lines.forEach(function (ln) {
      var s = ln.replace(/^<|>$/g, ''), hex = '', kind = '';
      var compact = s.replace(/[\s-]/g, '');
      if (/^[0-9a-fA-F]+$/.test(compact) && compact.length % 2 === 0) { hex = compact.toLowerCase(); kind = /\s/.test(s) ? 'Data description <…>' : 'hex'; }
      else if (/^[A-Za-z0-9+\/_-]+=*$/.test(compact)) { try { var b = H.fromB64(compact.replace(/-/g, '+').replace(/_/g, '/')); hex = H.hex(b); kind = 'Base64'; } catch (e) { hex = ''; } }
      if (!hex) { bad++; rows.push([ln.length > 40 ? ln.slice(0, 37) + '…' : ln, '❌', '', '', t('16진수/Base64 로 해석할 수 없습니다', 'Cannot read as hex or Base64')]); return; }
      var n = hex.length / 2, probs = [];
      if (n < 32) probs.push(t(n + '바이트 — 너무 짧습니다 (보통 32바이트)', n + ' bytes — too short (normally 32)'));
      else if (n > 100) probs.push(t(n + '바이트 — 너무 깁니다 (APNs 는 최대 100바이트까지 허용)', n + ' bytes — too long (APNs allows up to 100)'));
      var shown = o.upper ? hex.toUpperCase() : hex;
      rows.push([ln.length > 40 ? ln.slice(0, 37) + '…' : ln, probs.length ? '⚠️' : '✅', kind + ' · ' + n + t('바이트', ' bytes'), shown.match(/.{1,8}/g).join(' '), H.b64(H.fromHex ? H.fromHex(hex) : new Uint8Array(hex.match(/../g).map(function (x) { return parseInt(x, 16); }))) + (probs.length ? '  ⚠ ' + probs.join(' · ') : '')]);
      outs.push(hex);
      if (probs.length) issues.push(probs[0]);
    });
    issues.push(t('토큰 길이는 바뀔 수 있으니 32바이트로 고정하지 말고 저장 컬럼을 넉넉하게(예: VARCHAR(200)) 잡으세요', 'Token length can change; do not hard-code 32 bytes and size the column generously (e.g. VARCHAR(200))'));
    issues.push(t('개발(sandbox)과 운영(production) 토큰은 서로 호환되지 않습니다. 앱을 재설치·복원하면 토큰이 바뀔 수 있으니 매 실행 시 서버에 다시 등록하세요', 'Sandbox and production tokens are not interchangeable. Reinstalling or restoring an app can change the token, so re-register at every launch'));
    var code = ['// Swift', 'func application(_ app: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {', '    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()', '}', '', '// Kotlin / Java: FCM 사용 시 APNs 토큰 대신 FCM 등록 토큰이 필요합니다', '', '// Node.js', "const hex = Buffer.from('" + (rows[0] && rows[0][4] ? String(rows[0][4]).split('  ')[0] : '') + "', 'base64').toString('hex');", '', '# Python', "bytes.fromhex('" + (outs[0] || '') + "')"].join('\n');
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: bad ? { ok: 'info', msg: t('🔍 ' + lines.length + '개 중 ' + bad + '개 오류', '🔍 ' + bad + ' of ' + lines.length + ' failed') } : t('✅ 토큰 ' + lines.length + '개 변환', '✅ Converted ' + lines.length + ' token(s)'), table: { head: [['입력', 'Input'], ['상태', 'Status'], ['형식 · 길이', 'Format · length'], ['16진수 (8자씩)', 'Hex (groups of 8)'], ['Base64', 'Base64']], rows: rows }, out: outs.join('\n'), code: code, issues: uniq };
  }
});
