TK.tool('password-hash', {
  inputs: [
    { id: 'pw', type: 'text', label: ['비밀번호', 'Password'], sample: 'correct horse battery staple', placeholder: ['테스트용 비밀번호만 입력하세요', 'Use test passwords only'] },
    { id: 'hash', type: 'text', label: ['검증할 해시 ($2b$… / $argon2id$… / $scrypt$…)', 'Hash to verify ($2b$… / $argon2id$… / $scrypt$…)'], sample: '', show: function (o) { return o.dir === 'verify'; } },
    { id: 'salt', type: 'text', label: ['솔트 (16진수, 비우면 무작위 — 테스트 재현용)', 'Salt (hex; empty = random — for reproducible tests)'], sample: '', show: function (o) { return o.dir === 'hash'; } }
  ],
  options: [
    { id: 'dir', type: 'select', label: ['동작', 'Action'], choices: [['hash', ['해시 만들기', 'Create a hash']], ['verify', ['해시 검증', 'Verify a hash']]], default: 'hash' },
    { id: 'algo', type: 'select', label: ['알고리즘', 'Algorithm'], choices: [['argon2id', ['Argon2id (권장)', 'Argon2id (recommended)']], ['bcrypt', 'bcrypt'], ['scrypt', 'scrypt'], ['argon2i', 'Argon2i'], ['argon2d', 'Argon2d']], default: 'argon2id', show: function (o) { return o.dir === 'hash'; } },
    { id: 'mem', type: 'number', label: ['Argon2 메모리 (KiB)', 'Argon2 memory (KiB)'], default: 19456, min: 8, max: 262144, show: function (o) { return o.dir === 'hash' && /^argon2/.test(o.algo); } },
    { id: 'iter', type: 'number', label: ['Argon2 반복 횟수 (t)', 'Argon2 iterations (t)'], default: 2, min: 1, max: 20, show: function (o) { return o.dir === 'hash' && /^argon2/.test(o.algo); } },
    { id: 'par', type: 'number', label: ['병렬도 (p)', 'Parallelism (p)'], default: 1, min: 1, max: 16, show: function (o) { return o.dir === 'hash' && /^(argon2|scrypt)/.test(o.algo); } },
    { id: 'cost', type: 'number', label: ['bcrypt 비용 (2^cost 회, 4~15)', 'bcrypt cost (2^cost rounds, 4–15)'], default: 10, min: 4, max: 15, show: function (o) { return o.dir === 'hash' && o.algo === 'bcrypt'; } },
    { id: 'ln', type: 'number', label: ['scrypt N = 2^ln', 'scrypt N = 2^ln'], default: 15, min: 10, max: 20, show: function (o) { return o.dir === 'hash' && o.algo === 'scrypt'; } },
    { id: 'r', type: 'number', label: ['scrypt 블록 크기 r', 'scrypt block size r'], default: 8, min: 1, max: 32, show: function (o) { return o.dir === 'hash' && o.algo === 'scrypt'; } }
  ],
  sampleOptions: { dir: 'hash', algo: 'argon2id' },
  outputs: [{ id: 'table', label: ['결과', 'Result'], kind: 'table' }, { id: 'out', label: ['해시', 'Hash'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var P = window.TKPwHash || globalThis.TKPwHash, H = TK.hash, issues = [];
    if (!P) throw new Error(t('해시 라이브러리를 불러오지 못했습니다', 'The hashing library failed to load'));
    var pw = String(v.pw == null ? '' : v.pw);
    if (!pw && o.dir === 'hash') issues.push('⚠️ ' + t('빈 비밀번호입니다', 'The password is empty'));
    var now = function () { return (window.performance || globalThis.performance || Date).now(); };
    function b64n(u8) { return H.b64(u8).replace(/=+$/, ''); }
    function unb64(s) { return H.fromB64(s); }
    var pwBytes = H.utf8(pw);
    if (o.dir === 'verify') {
      var h = String(v.hash || '').trim(); if (!h) throw new Error(t('검증할 해시를 입력하세요', 'Enter the hash to verify'));
      var t0 = now(), p;
      if (/^\$2[abxy]\$/.test(h)) {
        if (!/^\$2[abxy]\$\d\d\$[A-Za-z0-9.\/]{53}$/.test(h)) throw new Error(t('bcrypt 해시 형식이 올바르지 않습니다 ($2b$비용$ + 53자)', 'Invalid bcrypt hash ($2b$cost$ + 53 chars)'));
        p = P.bcryptVerify({ password: pw, hash: h.replace(/^\$2[xy]\$/, '$2b$') }).then(function (ok) { return { ok: ok, algo: 'bcrypt', cost: parseInt(h.slice(4, 6), 10) }; });
      } else if (/^\$argon2(id|i|d)\$/.test(h)) {
        p = P.argon2Verify({ password: pw, hash: h }).then(function (ok) { var m = /^\$(argon2[a-z]+)\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(h) || []; return { ok: ok, algo: m[1] || 'argon2', mem: m[2], iter: m[3], par: m[4] }; });
      } else if (/^\$scrypt\$/.test(h)) {
        var m2 = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+\/]+)\$([A-Za-z0-9+\/]+)$/.exec(h);
        if (!m2) throw new Error(t('scrypt 해시 형식이 올바르지 않습니다 ($scrypt$ln=15,r=8,p=1$솔트$해시)', 'Invalid scrypt hash ($scrypt$ln=15,r=8,p=1$salt$hash)'));
        var salt = unb64(m2[4]), want = unb64(m2[5]);
        p = P.scrypt({ password: pw, salt: salt, costFactor: Math.pow(2, +m2[1]), blockSize: +m2[2], parallelism: +m2[3], hashLength: want.length, outputType: 'binary' }).then(function (got) { var d = 0; for (var i = 0; i < want.length; i++) d |= want[i] ^ got[i]; return { ok: d === 0, algo: 'scrypt', ln: m2[1], r: m2[2], par: m2[3] }; });
      } else throw new Error(t('알 수 없는 해시 형식입니다. $2b$(bcrypt), $argon2id$, $scrypt$ 로 시작해야 합니다', 'Unknown hash format; it must start with $2b$ (bcrypt), $argon2id$ or $scrypt$'));
      return p.then(function (r) {
        var ms = Math.round(now() - t0), rows = [[t('알고리즘', 'Algorithm'), r.algo], [t('결과', 'Result'), r.ok ? t('✅ 비밀번호가 일치합니다', '✅ The password matches') : t('⛔ 일치하지 않습니다', '⛔ No match')], [t('걸린 시간', 'Time taken'), ms + ' ms']];
        if (r.cost != null) { rows.push([t('비용', 'Cost'), String(r.cost)]); if (r.cost < 10) issues.push('⚠️ ' + t('bcrypt 비용 ' + r.cost + ' 는 낮습니다 (최소 10 권장)', 'bcrypt cost ' + r.cost + ' is low (10+ recommended)')); }
        if (r.mem) { rows.push([t('Argon2 매개변수', 'Argon2 parameters'), 'm=' + r.mem + ' KiB, t=' + r.iter + ', p=' + r.par]); if (+r.mem < 19456) issues.push('⚠️ ' + t('Argon2 메모리 ' + r.mem + ' KiB 는 OWASP 최소 권장(19 MiB)보다 작습니다', 'Argon2 memory ' + r.mem + ' KiB is below the OWASP minimum (19 MiB)')); }
        if (r.ln) { rows.push([t('scrypt 매개변수', 'scrypt parameters'), 'N=2^' + r.ln + ', r=' + r.r + ', p=' + r.par]); if (+r.ln < 15) issues.push('⚠️ ' + t('scrypt N=2^' + r.ln + ' 은 낮습니다 (2^17 권장)', 'scrypt N=2^' + r.ln + ' is low (2^17 recommended)')); }
        if (!r.ok) issues.push(t('비밀번호의 공백·대소문자·인코딩(UTF-8)이 해시 생성 때와 같은지 확인하세요', 'Check that the password has the same spaces, case and encoding (UTF-8) as when the hash was created'));
        return { _status: { ok: r.ok, msg: r.ok ? t('✅ 일치', '✅ Match') : t('⛔ 불일치', '⛔ No match') }, table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, out: r.ok ? 'MATCH' : 'NO MATCH', issues: issues };
      });
    }
    /* 해시 만들기 */
    var salt;
    var sh = String(v.salt || '').replace(/\s|0x/g, '');
    var need = 16;
    if (sh) { if (/[^0-9a-fA-F]/.test(sh) || sh.length % 2) throw new Error(t('솔트는 16진수여야 합니다', 'The salt must be hex')); salt = new Uint8Array(sh.length / 2); for (var i = 0; i < salt.length; i++) salt[i] = parseInt(sh.substr(i * 2, 2), 16); if (o.algo === 'bcrypt' && salt.length !== 16) throw new Error(t('bcrypt 솔트는 정확히 16바이트(16진수 32자)여야 합니다', 'The bcrypt salt must be exactly 16 bytes (32 hex digits)')); if (salt.length < 8) throw new Error(t('솔트는 8바이트 이상이어야 합니다', 'The salt must be at least 8 bytes')); }
    else { salt = new Uint8Array(need); (window.crypto || globalThis.crypto).getRandomValues(salt); }
    var t1 = now(), job, algoName = o.algo, params = '';
    var mem = Math.round(o.mem), it = Math.round(o.iter), par = Math.round(o.par);
    if (o.algo === 'bcrypt') {
      var cost = Math.round(o.cost); if (cost < 4 || cost > 15) throw new Error(t('bcrypt 비용은 4~15 사이여야 합니다', 'bcrypt cost must be 4–15'));
      if (pwBytes.length > 72) throw new Error(t('비밀번호가 ' + pwBytes.length + '바이트로 bcrypt 한도(72바이트)를 넘어 처리할 수 없습니다. 일부 구현은 72바이트 뒤를 조용히 잘라내므로, 긴 비밀번호는 SHA-256 으로 먼저 해시하거나 Argon2id 를 쓰세요', 'The password is ' + pwBytes.length + ' bytes, over the bcrypt limit of 72; some implementations silently truncate it, so pre-hash long passwords or use Argon2id'));
      if (pwBytes.indexOf(0) >= 0) issues.push('⚠️ ' + t('비밀번호에 NUL 문자가 있으면 bcrypt 구현에 따라 잘릴 수 있습니다', 'A NUL byte in the password may truncate it in some bcrypt implementations'));
      if (cost < 10) issues.push('⚠️ ' + t('bcrypt 비용 ' + cost + ' 는 낮습니다 (최소 10, 요즘은 12 권장)', 'bcrypt cost ' + cost + ' is low (10 minimum, 12 is common today)'));
      params = 'cost=' + cost;
      job = P.bcrypt({ password: pw, salt: salt, costFactor: cost, outputType: 'encoded' });
    } else if (/^argon2/.test(o.algo)) {
      if (mem < 8 * par) throw new Error(t('Argon2 메모리는 8 × 병렬도(KiB) 이상이어야 합니다', 'Argon2 memory must be at least 8 × parallelism KiB'));
      if (o.algo === 'argon2id' && mem < 19456) issues.push('⚠️ ' + t('OWASP 최소 권장은 Argon2id m=19456 KiB(19 MiB), t=2, p=1 입니다', 'The OWASP minimum is Argon2id m=19456 KiB (19 MiB), t=2, p=1'));
      if (o.algo !== 'argon2id') issues.push('ℹ️ ' + t('새 시스템에는 Argon2id 를 권장합니다 (Argon2i/Argon2d 는 특수 용도)', 'Argon2id is recommended for new systems (Argon2i / Argon2d are for special cases)'));
      params = 'm=' + mem + ', t=' + it + ', p=' + par;
      job = P[o.algo]({ password: pw, salt: salt, parallelism: par, iterations: it, memorySize: mem, hashLength: 32, outputType: 'encoded' });
    } else {
      var ln = Math.round(o.ln), rr = Math.round(o.r);
      if (ln < 15) issues.push('⚠️ ' + t('scrypt N=2^' + ln + ' 은 낮습니다 (OWASP: N=2^17, r=8, p=1)', 'scrypt N=2^' + ln + ' is low (OWASP: N=2^17, r=8, p=1)'));
      if (128 * rr * Math.pow(2, ln) > 512 * 1024 * 1024) throw new Error(t('메모리(128·N·r)가 512 MiB 를 넘어 브라우저에서 실행할 수 없습니다', 'Memory (128·N·r) exceeds 512 MiB and cannot run in a browser'));
      params = 'N=2^' + ln + ', r=' + rr + ', p=' + par;
      job = P.scrypt({ password: pw, salt: salt, costFactor: Math.pow(2, ln), blockSize: rr, parallelism: par, hashLength: 32, outputType: 'binary' }).then(function (d) { return '$scrypt$ln=' + ln + ',r=' + rr + ',p=' + par + '$' + b64n(salt) + '$' + b64n(d); });
    }
    return job.then(function (enc) {
      var ms = Math.round(now() - t1);
      if (ms < 100 && o.algo !== 'bcrypt') issues.push('ℹ️ ' + t('계산에 ' + ms + ' ms 가 걸렸습니다. 서버에서는 보통 인증 1회에 100~500 ms 가 걸리도록 비용을 맞춥니다', 'It took ' + ms + ' ms. Servers usually tune the cost to 100–500 ms per login'));
      issues.push(t('솔트는 해시 문자열 안에 함께 저장되므로 따로 보관할 필요가 없습니다. 같은 비밀번호도 솔트가 다르면 매번 다른 해시가 나옵니다', 'The salt is stored inside the hash string, so you need not keep it separately; the same password gives a different hash with each salt'));
      issues.push(t('테스트용 도구입니다. 실제 비밀번호는 입력하지 마세요. 브라우저 밖으로 전송되지는 않습니다', 'A testing tool: do not enter real passwords (nothing leaves your browser, though)'));
      return { _status: t('✅ ' + algoName + ' 해시를 만들었습니다 (' + ms + ' ms)', '✅ Created a ' + algoName + ' hash (' + ms + ' ms)'), table: { head: [['항목', 'Item'], ['값', 'Value']], rows: [[t('알고리즘', 'Algorithm'), algoName], [t('매개변수', 'Parameters'), params], [t('솔트 (16진수)', 'Salt (hex)'), H.hex(salt)], [t('걸린 시간', 'Time taken'), ms + ' ms'], [t('해시 길이', 'Hash length'), enc.length + t('자', ' chars')]] }, out: enc, issues: issues };
    });
  }
});
