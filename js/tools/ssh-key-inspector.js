TK.tool('ssh-key-inspector', {
  inputs: [{ id: 'in', label: ['SSH 공개키 (id_*.pub, authorized_keys, known_hosts 줄)', 'SSH public keys (id_*.pub, authorized_keys or known_hosts lines)'], rows: 8, sample: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIElPeSFv7v0CTtQdzwG/es+lRGaUdWFrRsMFrne2sch/ wooa@example\nssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCRU06Ge86huIX1JxZPirz19zmPp8EBdOLxG/1f6UlNLpP72wXWhqewKRAFgk4byH33/dRYnyr/2swr9G40e8rq+AcnR9xDYF/wpwG0VsQJU2YJH9nHDglcXPpt52MuPiID+JiKIPEl3JINn88hrfuczc/8fFlI/X/a1SYP9JYq8iF89z3TJEU/B81ojV4jY7euhc1i2WxjqZY+CoFsF9Cn9SHdWuJQ06EvlnYutmKiy2koiR6JcsIaa6yRu0tlk5Ej3F9i1swMsWLyGrAoyDLdZE85XGWzW/8lptWY+vQ/xqmfvJIcYyyhvmBQVYAMr3Yhg3KT+ymvgIIonBez0hZJ old-laptop\ncommand="/usr/bin/backup",no-pty ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBLPsgfqYQN8KYAyMGi5Y1oNR4ScgLJ7fa1qqmzp4BkNWpFqzScW2MMZVGv9GlelHe3RWWlfGysE+FkbwXxohc9U= backup@host' }],
  options: [{ id: 'pem', type: 'checkbox', label: ['PEM(SubjectPublicKeyInfo) 공개키도 출력', 'Also output PEM (SubjectPublicKeyInfo) public keys'], default: true }],
  outputs: [{ id: 'table', label: ['키 목록', 'Keys'], kind: 'table' }, { id: 'out', label: ['PEM 공개키', 'PEM public keys'], kind: 'code', ext: 'pem' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var H = TK.hash, E = TK.x509.enc, X = TK.x509, issues = [];
    var src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('공개키를 입력하세요', 'Enter a public key'));
    if (/-----BEGIN (OPENSSH|RSA|EC|DSA)? ?PRIVATE KEY-----/.test(src)) throw new Error(t('⛔ 개인키가 입력되었습니다. 개인키는 어디에도 붙여 넣거나 공유하지 마세요. 공개키(.pub 파일, ssh-keygen -y -f 키 로 추출)를 입력하세요', '⛔ A private key was entered. Never paste or share private keys; enter the public key (.pub file, or extract with ssh-keygen -y -f key)'));
    var TYPES = ['ssh-rsa', 'ssh-ed25519', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'sk-ssh-ed25519@openssh.com', 'sk-ecdsa-sha2-nistp256@openssh.com', 'ssh-rsa-cert-v01@openssh.com', 'ssh-ed25519-cert-v01@openssh.com', 'ecdsa-sha2-nistp256-cert-v01@openssh.com', 'rsa-sha2-256', 'rsa-sha2-512'];
    var lines = src.replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && l.charAt(0) !== '#'; });
    /* RFC 4716 */
    if (/^---- BEGIN SSH2 PUBLIC KEY ----/.test(lines[0] || '')) {
      var body = [], comment = ''; for (var li = 1; li < lines.length; li++) { if (/^---- END/.test(lines[li])) break; if (/^Comment:/i.test(lines[li])) comment = lines[li].replace(/^Comment:\s*/i, '').replace(/^"|"$/g, ''); else if (!/^[A-Za-z-]+:/.test(lines[li])) body.push(lines[li]); }
      var blob0 = H.fromB64(body.join('')); var dv0 = new DataView(blob0.buffer, blob0.byteOffset), tl0 = dv0.getUint32(0), tp0 = new TextDecoder().decode(blob0.subarray(4, 4 + tl0));
      lines = [tp0 + ' ' + body.join('') + (comment ? ' ' + comment : '')];
      issues.push(t('RFC 4716 형식을 OpenSSH 한 줄 형식으로 바꿔 해석했습니다', 'Converted the RFC 4716 format to the OpenSSH one-line format'));
    }
    if (lines.length > 200) { lines = lines.slice(0, 200); issues.push(t('줄은 처음 200개만 해석합니다', 'Only the first 200 lines are decoded')); }
    function rd(blob) {
      var p = 0, dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
      return { str: function () { if (p + 4 > blob.length) throw new Error(t('키 데이터가 잘렸습니다', 'Key data is truncated')); var n = dv.getUint32(p); p += 4; if (p + n > blob.length) throw new Error(t('키 데이터가 잘렸습니다', 'Key data is truncated')); var r = blob.subarray(p, p + n); p += n; return r; }, rest: function () { return blob.length - p; } };
    }
    function bitsOf(m) { var i = 0; while (i < m.length && m[i] === 0) i++; return i >= m.length ? 0 : (m.length - i - 1) * 8 + (32 - Math.clz32(m[i])); }
    var recs = [];
    lines.forEach(function (ln, idx) {
      var toks = ln.match(/"[^"]*"|\S+/g) || [], ti = -1;
      /* 따옴표 안에 공백이 있는 옵션을 고려해 키 타입 토큰 찾기 */
      for (var i = 0; i < toks.length; i++) if (TYPES.indexOf(toks[i]) >= 0) { ti = i; break; }
      if (ti < 0) throw new Error(t((idx + 1) + '번째 줄에서 키 종류(ssh-ed25519, ssh-rsa, ecdsa-sha2-… 등)를 찾지 못했습니다', 'No key type (ssh-ed25519, ssh-rsa, ecdsa-sha2-… …) found on line ' + (idx + 1)));
      var type = toks[ti], b64 = toks[ti + 1], comment = toks.slice(ti + 2).join(' '), prefix = toks.slice(0, ti).join(' ');
      if (!b64) throw new Error(t((idx + 1) + '번째 줄에 Base64 키 데이터가 없습니다', 'Line ' + (idx + 1) + ' has no Base64 key data'));
      var blob; try { blob = H.fromB64(b64); } catch (e) { throw new Error(t((idx + 1) + '번째 줄의 Base64 가 올바르지 않습니다', 'The Base64 on line ' + (idx + 1) + ' is invalid')); }
      var r = rd(blob), inner = new TextDecoder().decode(r.str());
      var rec = { n: idx + 1, type: type, inner: inner, comment: comment, prefix: prefix, blob: blob, bits: '', der: null, note: '' };
      if (inner !== type) issues.push('⚠️ ' + t((idx + 1) + '번째 줄: 앞의 종류(' + type + ')와 키 데이터 안의 종류(' + inner + ')가 다릅니다', 'Line ' + (idx + 1) + ': the leading type (' + type + ') differs from the type inside the key data (' + inner + ')'));
      if (inner === 'ssh-rsa') {
        var e = r.str(), nn = r.str(), bits = bitsOf(nn); rec.bits = 'RSA ' + bits; rec.bitsN = bits;
        var n0 = nn[0] & 0x80 ? E.cat(new Uint8Array([0]), nn) : nn, e0 = e[0] & 0x80 ? E.cat(new Uint8Array([0]), e) : e;
        rec.der = E.seq(E.seq(E.oid('1.2.840.113549.1.1.1'), E.nul()), E.bits(E.seq(E.tlv(2, n0), E.tlv(2, e0))));
        if (bits < 2048) issues.push('⚠️ ' + t((idx + 1) + '번째 줄: RSA ' + bits + '비트는 안전하지 않습니다 (최소 2048, 권장 3072 이상). 새 키로 교체하세요', 'Line ' + (idx + 1) + ': RSA ' + bits + ' bits is insecure (2048 minimum, 3072+ recommended); replace it'));
        else if (bits < 3072) issues.push('ℹ️ ' + t((idx + 1) + '번째 줄: RSA ' + bits + '비트는 아직 허용되지만 Ed25519 로 옮기는 것이 좋습니다', 'Line ' + (idx + 1) + ': RSA ' + bits + ' bits is still accepted but moving to Ed25519 is better'));
      } else if (inner === 'ssh-ed25519') {
        var k = r.str(); rec.bits = 'Ed25519 256'; if (k.length !== 32) issues.push('⛔ ' + t((idx + 1) + '번째 줄: Ed25519 키 길이가 ' + k.length + '바이트입니다 (32바이트여야 함)', 'Line ' + (idx + 1) + ': Ed25519 key is ' + k.length + ' bytes (must be 32)'));
        rec.der = E.seq(E.seq(E.oid('1.3.101.112')), E.bits(k));
      } else if (/^ecdsa-sha2-nistp(256|384|521)$/.test(inner)) {
        var cid = new TextDecoder().decode(r.str()), q = r.str(), oid = { nistp256: '1.2.840.10045.3.1.7', nistp384: '1.3.132.0.34', nistp521: '1.3.132.0.35' }[cid];
        rec.bits = 'ECDSA ' + cid.replace('nistp', 'P-'); if (!oid) issues.push('⛔ ' + t((idx + 1) + '번째 줄: 알 수 없는 곡선 ' + cid, 'Line ' + (idx + 1) + ': unknown curve ' + cid));
        else rec.der = E.seq(E.seq(E.oid('1.2.840.10045.2.1'), E.oid(oid)), E.bits(q));
        if (q[0] !== 4) issues.push('⚠️ ' + t((idx + 1) + '번째 줄: 압축되지 않은 점(0x04)이 아닙니다', 'Line ' + (idx + 1) + ': the point is not uncompressed (0x04)'));
      } else if (inner === 'ssh-dss') {
        var pdsa = r.str(); rec.bits = 'DSA ' + bitsOf(pdsa);
        issues.push('⛔ ' + t((idx + 1) + '번째 줄: DSA(ssh-dss) 키는 OpenSSH 7.0 부터 기본 비활성화되었고 1024비트로 제한되어 안전하지 않습니다. 폐기하세요', 'Line ' + (idx + 1) + ': DSA (ssh-dss) keys have been disabled by default since OpenSSH 7.0 and are limited to 1024 bits; retire them'));
      } else if (/^sk-/.test(inner)) { rec.bits = t('보안 키(FIDO) ', 'Security key (FIDO) ') + (/ed25519/.test(inner) ? 'Ed25519' : 'ECDSA P-256'); rec.note = t('하드웨어 보안 키 기반', 'hardware-backed'); }
      else if (/-cert-v01@openssh.com$/.test(inner)) { rec.bits = t('OpenSSH 인증서', 'OpenSSH certificate'); rec.note = t('인증서는 ssh-keygen -L -f 파일 로 자세히 볼 수 있습니다', 'Inspect details with ssh-keygen -L -f file'); }
      else rec.bits = inner;
      if (prefix) {
        var opts = prefix; var flags = [];
        if (/\bcommand=/.test(opts)) flags.push('command'); if (/\bfrom=/.test(opts)) flags.push('from'); if (/no-pty/.test(opts)) flags.push('no-pty'); if (/restrict/.test(opts)) flags.push('restrict'); if (/no-port-forwarding/.test(opts)) flags.push('no-port-forwarding'); if (/cert-authority/.test(opts)) flags.push('cert-authority');
        rec.note = (rec.note ? rec.note + ' · ' : '') + t('옵션/호스트: ', 'options / hosts: ') + N_short(prefix);
        if (!flags.length && !/^[\w.,*?!-]+$|^\|1\|/.test(prefix)) issues.push('ℹ️ ' + t((idx + 1) + '번째 줄 앞부분 "' + N_short(prefix) + '" 은 authorized_keys 옵션 또는 known_hosts 호스트입니다', 'Line ' + (idx + 1) + ': the leading "' + N_short(prefix) + '" is authorized_keys options or known_hosts hosts'));
        if (flags.indexOf('command') >= 0) issues.push('ℹ️ ' + t((idx + 1) + '번째 줄: command= 옵션이 있어 이 키로는 지정한 명령만 실행됩니다', 'Line ' + (idx + 1) + ': a command= option restricts this key to one command'));
        if (/cert-authority/.test(opts)) issues.push('ℹ️ ' + t((idx + 1) + '번째 줄: cert-authority 옵션 — 이 키가 서명한 인증서를 신뢰합니다', 'Line ' + (idx + 1) + ': cert-authority — certificates signed by this key are trusted'));
      }
      if (!comment) rec.noComment = true;
      recs.push(rec);
    });
    function N_short(s) { s = String(s); return s.length > 60 ? s.slice(0, 60) + '…' : s; }
    return Promise.all(recs.map(function (r) { return H.sha('SHA-256', r.blob); })).then(function (sh) {
      var rows = [], pems = [], seen = {};
      recs.forEach(function (r, i) {
        var sha = 'SHA256:' + H.b64(sh[i]).replace(/=+$/, ''), md5 = 'MD5:' + H.hex(H.md5(r.blob)).replace(/(..)(?!$)/g, '$1:');
        rows.push([String(r.n), r.type, r.bits, sha, md5, (r.comment || '—') + (r.note ? ' · ' + r.note : '')]);
        if (seen[sha]) issues.push('⚠️ ' + t(r.n + '번째 줄은 ' + seen[sha] + '번째 줄과 같은 키입니다 (중복)', 'Line ' + r.n + ' is the same key as line ' + seen[sha] + ' (duplicate)')); else seen[sha] = r.n;
        if (r.der) pems.push('# ' + r.type + ' ' + sha + (r.comment ? ' ' + r.comment : '') + '\n' + X.toPem('PUBLIC KEY', r.der));
        if (r.noComment) issues.push('ℹ️ ' + t(r.n + '번째 줄에 주석(보통 user@host)이 없어 누구의 키인지 알기 어렵습니다', 'Line ' + r.n + ' has no comment (usually user@host), so its owner is unclear'));
      });
      issues.push(t('SHA256:… 형태는 ssh-keygen -lf, GitHub, 서버 로그가 보여 주는 현재 표준 지문입니다. MD5:… 는 구버전 호환용입니다', 'SHA256:… is the current standard fingerprint shown by ssh-keygen -lf, GitHub and server logs; MD5:… is for legacy compatibility'));
      var bad = issues.filter(function (x) { return x.indexOf('⛔') === 0; }).length;
      return { _status: { ok: bad ? false : true, msg: bad ? t('⛔ 문제 ' + bad + '건 — 키 ' + recs.length + '개', '⛔ ' + bad + ' problem(s) — ' + recs.length + ' key(s)') : t('✅ 키 ' + recs.length + '개 해석 완료', '✅ ' + recs.length + ' key(s) decoded') }, table: { head: [['#', '#'], ['종류', 'Type'], ['알고리즘·크기', 'Algorithm / size'], ['SHA256 지문', 'SHA256 fingerprint'], ['MD5 지문', 'MD5 fingerprint'], ['주석', 'Comment']], rows: rows }, out: o.pem ? pems.join('\n\n') : '', issues: issues };
    });
  }
});
