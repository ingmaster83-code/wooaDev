TK.tool('aes-tool', {
  inputs: [
    { id: 'data', label: ['입력 데이터 (암호화: 평문, 복호화: 암호문)', 'Input (plaintext to encrypt, or ciphertext to decrypt)'], rows: 5, sample: 'Hello, WooaDev! 안녕하세요' },
    { id: 'key', type: 'text', label: ['키 (비우면 무작위 생성 — 암호화에서만)', 'Key (empty = random — encryption only)'], sample: '000102030405060708090a0b0c0d0e0f', placeholder: ['AES-128/192/256 → 16/24/32바이트', 'AES-128/192/256 → 16/24/32 bytes'] },
    { id: 'iv', type: 'text', label: ['IV / Nonce / 카운터 (비우면 무작위 — 암호화에서만)', 'IV / nonce / counter (empty = random — encryption only)'], sample: '0102030405060708090a0b0c', placeholder: ['GCM 12바이트, CBC·CTR 16바이트', 'GCM 12 bytes, CBC / CTR 16 bytes'] },
    { id: 'aad', type: 'text', label: ['추가 인증 데이터 AAD (GCM, 선택, UTF-8)', 'Additional authenticated data (GCM, optional, UTF-8)'], sample: '', show: function (o) { return o.mode === 'gcm'; } },
    { id: 'tag', type: 'text', label: ['인증 태그 (GCM 복호화에서 암호문과 분리했을 때, 선택)', 'Auth tag (GCM decryption, if detached from the ciphertext, optional)'], sample: '', show: function (o) { return o.mode === 'gcm' && o.dir === 'dec'; } }
  ],
  options: [
    { id: 'dir', type: 'select', label: ['동작', 'Action'], choices: [['enc', ['암호화', 'Encrypt']], ['dec', ['복호화', 'Decrypt']]], default: 'enc' },
    { id: 'mode', type: 'select', label: ['모드', 'Mode'], choices: [['gcm', 'AES-GCM'], ['cbc', 'AES-CBC (PKCS#7)'], ['ctr', 'AES-CTR']], default: 'gcm' },
    { id: 'kf', type: 'select', label: ['키·IV 표기', 'Key / IV format'], choices: [['hex', ['16진수', 'Hex']], ['b64', 'Base64'], ['utf8', ['UTF-8 문자열 (키 길이가 맞아야 함)', 'UTF-8 string (must be the exact length)']]], default: 'hex' },
    { id: 'df', type: 'select', label: ['암호문 표기', 'Ciphertext format'], choices: [['hex', ['16진수', 'Hex']], ['b64', 'Base64']], default: 'b64' },
    { id: 'pre', type: 'checkbox', label: ['암호화 결과 앞에 IV 붙이기 (IV‖암호문‖태그, 복호화 때는 앞쪽에서 IV 를 떼어냄)', 'Prepend the IV to the output (IV‖ciphertext‖tag); on decrypt, take the IV from the front'], default: false }
  ],
  sampleOptions: { dir: 'enc', mode: 'gcm', kf: 'hex', df: 'b64' },
  outputs: [{ id: 'table', label: ['결과 요약', 'Summary'], kind: 'table' }, { id: 'out', label: ['출력', 'Output'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var H = TK.hash, issues = [], subtle = (window.crypto || globalThis.crypto).subtle;
    if (!subtle) throw new Error(t('Web Crypto 를 쓸 수 없습니다. HTTPS 로 접속하세요', 'Web Crypto is unavailable; use HTTPS'));
    var rnd = function (n) { var a = new Uint8Array(n); (window.crypto || globalThis.crypto).getRandomValues(a); return a; };
    function parseBytes(s, fmt, what) {
      s = String(s || '').trim();
      if (fmt === 'utf8') return H.utf8(s);
      if (fmt === 'b64') { try { return H.fromB64(s); } catch (e) { throw new Error(t(what + ' 이(가) 올바른 Base64 가 아닙니다', what + ' is not valid Base64')); } }
      var hx = s.replace(/0x/gi, '').replace(/[\s:,\-]/g, ''); if (/[^0-9a-fA-F]/.test(hx) || hx.length % 2) throw new Error(t(what + ' 이(가) 올바른 16진수가 아닙니다 (짝수 개의 16진수 문자)', what + ' is not valid hex (an even number of hex digits)'));
      var a = new Uint8Array(hx.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(hx.substr(i * 2, 2), 16); return a;
    }
    var enc = o.dir === 'enc', mode = o.mode, ivLen = mode === 'gcm' ? 12 : 16, name = { gcm: 'AES-GCM', cbc: 'AES-CBC', ctr: 'AES-CTR' }[mode];
    var key, keyGen = false, ivGen = false;
    if (!String(v.key || '').trim()) { if (!enc) throw new Error(t('복호화에는 키가 필요합니다', 'A key is required for decryption')); key = rnd(32); keyGen = true; }
    else key = parseBytes(v.key, o.kf, t('키', 'The key'));
    if ([16, 24, 32].indexOf(key.length) < 0) throw new Error(t('AES 키는 16, 24, 32바이트여야 합니다 (현재 ' + key.length + '바이트)', 'AES keys must be 16, 24 or 32 bytes (got ' + key.length + ')'));
    var data;
    if (!String(v.data || '').length) throw new Error(t('입력 데이터를 입력하세요', 'Enter the input data'));
    if (enc) data = H.utf8(v.data); else data = parseBytes(v.data, o.df, t('암호문', 'The ciphertext'));
    var iv;
    if (!enc && o.pre && !String(v.iv || '').trim()) { if (data.length < ivLen) throw new Error(t('암호문이 IV 길이보다 짧습니다', 'The ciphertext is shorter than the IV')); iv = data.slice(0, ivLen); data = data.slice(ivLen); }
    else if (!String(v.iv || '').trim()) { if (!enc) throw new Error(t('복호화에는 IV 가 필요합니다 (또는 "IV 붙이기" 옵션)', 'Decryption needs the IV (or the "prepend IV" option)')); iv = rnd(ivLen); ivGen = true; }
    else iv = parseBytes(v.iv, o.kf, 'IV');
    if (mode !== 'gcm' && iv.length !== 16) throw new Error(t('CBC·CTR 의 IV/카운터는 16바이트여야 합니다 (현재 ' + iv.length + '바이트)', 'The CBC / CTR IV must be 16 bytes (got ' + iv.length + ')'));
    if (mode === 'gcm' && iv.length < 1) throw new Error(t('IV 가 비어 있습니다', 'The IV is empty'));
    if (mode === 'gcm' && iv.length !== 12) issues.push('⚠️ ' + t('GCM 의 권장 nonce 길이는 12바이트입니다 (현재 ' + iv.length + '바이트)', 'The recommended GCM nonce length is 12 bytes (got ' + iv.length + ')'));
    var algo = mode === 'gcm' ? { name: name, iv: iv, tagLength: 128 } : mode === 'cbc' ? { name: name, iv: iv } : { name: name, counter: iv, length: 64 };
    if (mode === 'gcm' && String(v.aad || '')) algo.additionalData = H.utf8(v.aad);
    var fmt = function (u8, f) { return f === 'b64' ? H.b64(u8) : H.hex(u8); };
    var kfmt = o.kf === 'utf8' ? 'hex' : o.kf;
    return subtle.importKey('raw', key, { name: name }, false, ['encrypt', 'decrypt']).then(function (ck) {
      if (enc) return subtle.encrypt(algo, ck, data).then(function (res) {
        var ct = new Uint8Array(res), tag = null, body = ct;
        if (mode === 'gcm') { tag = ct.slice(ct.length - 16); body = ct.slice(0, ct.length - 16); }
        var full = o.pre ? H.concat(iv, ct) : ct;
        var rows = [['AES-' + key.length * 8 + '-' + mode.toUpperCase(), ''], [t('키 (', 'Key (') + kfmt + ')', fmt(key, kfmt) + (keyGen ? '  ← ' + t('무작위 생성', 'random') : '')], ['IV', fmt(iv, kfmt) + (ivGen ? '  ← ' + t('무작위 생성', 'random') : '')], [t('암호문 길이', 'Ciphertext length'), body.length + t('바이트', ' bytes')]];
        if (tag) { rows.push([t('인증 태그 (16바이트)', 'Auth tag (16 bytes)'), fmt(tag, o.df)]); rows.push([t('암호문 (태그 제외)', 'Ciphertext (without tag)'), fmt(body, o.df)]); }
        rows.push([t('결과 (' + (o.pre ? 'IV‖' : '') + '암호문' + (tag ? '‖태그' : '') + ')', 'Result (' + (o.pre ? 'IV‖' : '') + 'ciphertext' + (tag ? '‖tag' : '') + ')'), fmt(full, o.df)]);
        if (keyGen || ivGen) issues.push('ℹ️ ' + t('무작위로 만든 키·IV 는 복호화에 꼭 필요하니 위 표에서 복사해 보관하세요', 'Keep the randomly generated key / IV from the table; decryption needs them'));
        if (mode === 'gcm') issues.push(t('같은 키로 같은 nonce 를 두 번 쓰면 GCM 의 보안이 완전히 무너집니다. 메시지마다 새 nonce 를 쓰세요', 'Reusing a nonce with the same key completely breaks GCM; use a fresh nonce for every message'));
        if (mode === 'cbc') issues.push(t('CBC 는 암호문 변조를 감지하지 못합니다 (패딩 오라클 위험). 가능하면 GCM 을 쓰세요', 'CBC does not detect tampering (padding-oracle risk); prefer GCM when possible'));
        if (mode === 'ctr') issues.push(t('CTR 도 변조를 감지하지 못합니다. 무결성이 필요하면 GCM 또는 별도 MAC 을 쓰세요. 카운터 증가는 하위 64비트 기준입니다', 'CTR does not detect tampering either; use GCM or a MAC for integrity. The counter increments over the low 64 bits'));
        issues.push(t('테스트·학습용 도구입니다. 실서비스 비밀은 서버나 KMS 에서 처리하세요. 입력은 브라우저를 떠나지 않습니다', 'A tool for testing and learning; handle production secrets in servers or a KMS. Input never leaves your browser'));
        return { _status: t('✅ 암호화 완료 (' + full.length + '바이트)', '✅ Encrypted (' + full.length + ' bytes)'), table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, out: fmt(full, o.df), issues: issues };
      });
      var inputCt = data;
      if (mode === 'gcm' && String(v.tag || '').trim()) inputCt = H.concat(data, parseBytes(v.tag, o.df === 'b64' ? 'b64' : 'hex', t('태그', 'The tag')));
      if (mode === 'gcm' && inputCt.length < 16) throw new Error(t('GCM 암호문은 16바이트 인증 태그를 포함해야 합니다', 'GCM ciphertext must include the 16-byte auth tag'));
      return subtle.decrypt(algo, ck, inputCt).then(function (res) {
        var pt = new Uint8Array(res), text = null; try { text = new TextDecoder('utf-8', { fatal: true }).decode(pt); } catch (e) { /* binary */ }
        var rows = [['AES-' + key.length * 8 + '-' + mode.toUpperCase(), ''], ['IV', fmt(iv, kfmt)], [t('평문 길이', 'Plaintext length'), pt.length + t('바이트', ' bytes')], [t('평문 (16진수)', 'Plaintext (hex)'), H.hex(pt)]];
        if (mode === 'gcm') rows.push([t('인증', 'Authentication'), t('✅ 태그 일치 — 변조되지 않았습니다', '✅ Tag valid — not tampered with')]);
        if (text === null) issues.push('ℹ️ ' + t('평문이 UTF-8 텍스트가 아니어서 16진수로 표시합니다', 'The plaintext is not UTF-8 text, so it is shown as hex'));
        return { _status: t('✅ 복호화 완료 (' + pt.length + '바이트)', '✅ Decrypted (' + pt.length + ' bytes)'), table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, out: text !== null ? text : H.hex(pt), issues: issues };
      }, function () {
        throw new Error(mode === 'gcm' ? t('복호화 실패 — 인증 태그가 맞지 않습니다. 키·IV·AAD·태그가 모두 암호화 때와 같은지, 암호문이 변조되지 않았는지 확인하세요', 'Decryption failed — the auth tag does not match. Check that key, IV, AAD and tag equal those used for encryption and that the ciphertext was not altered') : t('복호화 실패 — 키·IV 가 다르거나 암호문이 손상되었습니다 (CBC 는 패딩 검증 실패, 암호문 길이는 16의 배수여야 함)', 'Decryption failed — wrong key / IV or damaged ciphertext (CBC padding check failed; ciphertext length must be a multiple of 16)'));
      });
    });
  }
});
