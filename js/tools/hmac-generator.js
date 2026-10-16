TK.tool('hmac-generator', {
  inputs: [
    { id: 'msg', label: ['메시지', 'Message'], rows: 5, sample: 'GET\n/api/v1/orders?id=100\n1760577000', placeholder: ['서명할 메시지(요청 본문, 문자열 등)', 'Message to sign (request body, string…)'] },
    { id: 'key', type: 'text', label: ['비밀 키', 'Secret key'], sample: 'my-secret-key' },
    { id: 'expect', type: 'text', label: ['검증할 서명 (선택)', 'Signature to verify (optional)'], sample: '', placeholder: ['받은 서명값을 붙여 넣으면 일치 여부를 확인합니다', 'Paste a received signature to check it'] }
  ],
  options: [
    { id: 'algo', type: 'select', label: ['해시 알고리즘', 'Hash algorithm'], choices: [['SHA-256', 'HMAC-SHA256'], ['SHA-1', 'HMAC-SHA1'], ['SHA-384', 'HMAC-SHA384'], ['SHA-512', 'HMAC-SHA512']], default: 'SHA-256' },
    { id: 'kf', type: 'select', label: ['키 형식', 'Key format'], choices: [['text', ['텍스트(UTF-8)', 'Text (UTF-8)']], ['hex', '16진수'], ['base64', 'Base64']], default: 'text' },
    { id: 'mf', type: 'select', label: ['메시지 형식', 'Message format'], choices: [['text', ['텍스트(UTF-8)', 'Text (UTF-8)']], ['hex', '16진수']], default: 'text' }
  ],
  outputs: [{ id: 'table', label: ['HMAC 결과', 'HMAC output'], kind: 'table' }, { id: 'out', label: ['HMAC (hex)', 'HMAC (hex)'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var H = TK.hash, key, msg;
    if (v.key === '' || v.key == null) { if (o.kf === 'text') key = new Uint8Array(0); }
    key = o.kf === 'hex' ? H.fromHex(v.key || '') : o.kf === 'base64' ? H.fromB64(v.key || '') : H.utf8(v.key || '');
    msg = o.mf === 'hex' ? H.fromHex(v.msg) : H.utf8(v.msg);
    return H.hmac(o.algo, key, msg).then(function (mac) {
      var hex = H.hex(mac), rows = [['hex', hex], ['HEX (대문자)', hex.toUpperCase()], ['Base64', H.b64(mac)], ['Base64URL', H.b64url(mac)]];
      var exp = String(v.expect || '').trim().replace(/^(sha\d+=|v\d+=)/i, ''), status = t('✅ HMAC-' + o.algo.replace('SHA-', 'SHA') + ' 계산 완료 (' + mac.length * 8 + '비트)', '✅ HMAC-' + o.algo.replace('SHA-', 'SHA') + ' computed (' + mac.length * 8 + ' bits)');
      if (exp) {
        var same = exp.toLowerCase() === hex || exp === H.b64(mac) || exp === H.b64url(mac) || exp.replace(/=+$/, '') === H.b64(mac).replace(/=+$/, '');
        status = same ? { ok: true, msg: t('✅ 서명이 일치합니다', '✅ The signature matches') } : { ok: false, msg: t('❌ 서명이 일치하지 않습니다 — 키·알고리즘·메시지(공백·줄바꿈 포함)가 정확한지 확인하세요', '❌ Signature does not match — check key, algorithm and the exact message (whitespace and newlines included)') };
      }
      if (key.length === 0 && !status.msg) status = { ok: 'info', msg: t('⚠️ 키가 비어 있습니다', '⚠️ The key is empty') };
      return { _status: status, table: { head: [['형식', 'Format'], ['값', 'Value']], rows: rows }, out: hex };
    });
  }
});
