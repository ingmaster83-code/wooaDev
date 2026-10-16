TK.tool('dkim-record-parser', {
  allowEmpty: true,
  inputs: [
    { id: 'record', label: ['DKIM TXT 레코드 (따옴표로 나뉜 값도 가능)', 'DKIM TXT record (split quoted strings are fine)'], rows: 6, sample: '"v=DKIM1; k=rsa; " "p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwD7um1NI6ouII/AyCLTevnokBKlsjf2xcGgJxfxxWbPzIVfsD82zbhpejG5HjdfSSDW9pCfXJxfd+7y3R2NN/2sUg20k1z+r/GPXcL7CF2mnYEA6JsIpXJ76HRIg03TgTYQ1zAvFCD63JQfWEZ2LsmZbhpCXfQeriPaaJkUAPGqJ1yxqJHj8oXDDQMVWPRkH38lzhQJfp6k6vidOmuHrNd/AYyay+XD27oiizyYBf32VWjfXNrgqf/NXQ2SJJF5ZbGuB83PRoug6ajaLynBnmEVzBs1RejxHYsmmLEezrDM836NjYf5BHLykBDx+lUD5Aickk/srKg9FgDeq2V3wqQIDAQAB"', show: function (o) { return o.mode !== 'bimi-build'; } },
    { id: 'logo', type: 'text', label: ['로고 SVG URL (l=)', 'Logo SVG URL (l=)'], sample: 'https://www.example.com/brand/logo.svg', show: function (o) { return o.mode === 'bimi-build'; } },
    { id: 'vmc', type: 'text', label: ['인증서(VMC/CMC) PEM URL (a=, 선택)', 'Certificate (VMC/CMC) PEM URL (a=, optional)'], sample: 'https://www.example.com/brand/vmc.pem', show: function (o) { return o.mode === 'bimi-build'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['dkim', ['DKIM 레코드 분석', 'Parse a DKIM record']], ['bimi-check', ['BIMI 레코드 분석', 'Parse a BIMI record']], ['bimi-build', ['BIMI 레코드 만들기', 'Build a BIMI record']]], default: 'dkim' },
    { id: 'selector', type: 'text', label: ['셀렉터', 'Selector'], default: 'default' },
    { id: 'domain', type: 'text', label: ['도메인', 'Domain'], default: 'example.com' }
  ],
  outputs: [{ id: 'out', label: ['DNS 레코드', 'DNS record'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['태그 해석', 'Tag breakdown'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var H = TK.hash, A = TK.asn1, sel = (o.selector || 'default').trim() || 'default', dom = (o.domain || 'example.com').trim() || 'example.com', issues = [], rows = [], ok = true, host, text;
    function join(s) { var r = String(s || '').trim(); var parts = r.match(/"([^"]*)"/g); return parts ? parts.map(function (x) { return x.slice(1, -1); }).join('') : r; }
    function parseTags(s) {
      var tags = [];
      s.split(';').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (x) { var i = x.indexOf('='); if (i < 1) { issues.push(t('태그 형식이 아닙니다: ' + x.slice(0, 40), 'Not a tag=value pair: ' + x.slice(0, 40))); ok = false; return; } tags.push([x.slice(0, i).trim(), x.slice(i + 1).replace(/\s+/g, '')]); });
      return tags;
    }
    function dnsTxt(name, val) { var d = val.length > 255 ? val.match(/.{1,255}/g).map(function (x) { return '"' + x + '"'; }).join(' ') : '"' + val + '"'; return name + '.  IN  TXT  ' + d; }
    if (o.mode === 'bimi-build') {
      var logo = (v.logo || '').trim(), vmc = (v.vmc || '').trim();
      if (!logo) throw new Error(t('로고 SVG URL 을 입력하세요', 'Enter the logo SVG URL'));
      text = 'v=BIMI1; l=' + logo + (vmc ? '; a=' + vmc : '');
      host = sel + '._bimi.' + dom;
      var tg = [['v', 'BIMI1'], ['l', logo]]; if (vmc) tg.push(['a', vmc]);
      rows = tg.map(function (x) { return [x[0], x[1], { v: t('버전', 'Version'), l: t('로고 이미지(SVG Tiny PS) 위치', 'Location of the logo (SVG Tiny PS)'), a: t('로고 인증서(VMC/CMC) 위치', 'Location of the logo certificate (VMC/CMC)') }[x[0]]]; });
      bimiChecks({ l: logo, a: vmc });
      issues.push(t('BIMI 는 도메인에 DMARC 가 quarantine/reject (pct=100) 로 적용되어 있어야 동작합니다', 'BIMI only works when the domain enforces DMARC with quarantine/reject at pct=100'));
      issues.push(t('Gmail 등 대부분의 사업자는 VMC/CMC 인증서(a=)가 있어야 로고를 표시합니다', 'Gmail and most providers only show the logo when a VMC/CMC certificate (a=) is present'));
      return fin(text, host, rows);
    }
    text = join(v.record);
    if (!text) throw new Error(t('레코드를 입력하세요', 'Enter a record'));
    var tags = parseTags(text), T = {}; tags.forEach(function (x) { if (T[x[0]] !== undefined) issues.push(t('태그가 중복되었습니다: ' + x[0], 'Duplicate tag: ' + x[0])); T[x[0]] = x[1]; });
    function bimiChecks(T) {
      if (T.l !== undefined) {
        if (!/^https:\/\//i.test(T.l)) { issues.push(t('🚨 l= 은 https:// URL 이어야 합니다', '🚨 l= must be an https:// URL')); ok = false; }
        else if (!/\.svg(\?.*)?$/i.test(T.l)) issues.push(t('로고는 SVG Tiny PS 형식(.svg)이어야 합니다', 'The logo must be SVG Tiny PS (.svg)'));
      }
      if (T.a) { if (!/^https:\/\//i.test(T.a)) { issues.push(t('🚨 a= 는 https:// URL 이어야 합니다', '🚨 a= must be an https:// URL')); ok = false; } else if (!/\.pem(\?.*)?$/i.test(T.a)) issues.push(t('인증서는 보통 .pem 파일입니다', 'The certificate is normally a .pem file')); }
    }
    if (o.mode === 'bimi-check') {
      if (!tags.length || tags[0][0] !== 'v' || tags[0][1].toUpperCase() !== 'BIMI1') { issues.push(t('🚨 첫 태그는 v=BIMI1 이어야 합니다', '🚨 The first tag must be v=BIMI1')); ok = false; }
      if (T.l === undefined) { issues.push(t('🚨 l(로고 URL) 태그가 없습니다', '🚨 The l (logo URL) tag is missing')); ok = false; }
      if (T.l === '' && !T.a) issues.push(t('l= 이 비어 있어 BIMI 를 사용하지 않는다는 선언입니다', 'An empty l= declares that BIMI is not used'));
      bimiChecks(T);
      var KB = { v: ['버전', 'Version'], l: ['로고 SVG 위치', 'Logo SVG location'], a: ['인증서(VMC/CMC) 위치', 'Certificate (VMC/CMC) location'] };
      rows = tags.map(function (x) { var k = KB[x[0]]; if (!k) issues.push(t('알 수 없는 태그: ' + x[0], 'Unknown tag: ' + x[0])); return [x[0], x[1], k ? t(k[0], k[1]) : t('알 수 없음', 'Unknown')]; });
      issues.push(t('BIMI 는 DMARC 가 quarantine/reject (pct=100) 일 때만 표시됩니다', 'BIMI is only displayed when DMARC is quarantine/reject at pct=100'));
      return fin(text, sel + '._bimi.' + dom, rows);
    }
    // DKIM
    if (!tags.length || tags[0][0] !== 'v') issues.push(t('v=DKIM1 이 첫 태그로 오는 것이 권장됩니다 (생략도 허용)', 'v=DKIM1 should be the first tag (omitting it is allowed)'));
    else if (tags[0][1].toUpperCase() !== 'DKIM1') { issues.push(t('🚨 v 값은 DKIM1 이어야 합니다', '🚨 v must be DKIM1')); ok = false; }
    var kt = (T.k || 'rsa').toLowerCase(), key = null, keyRow = '';
    if (['rsa', 'ed25519'].indexOf(kt) < 0) { issues.push(t('알 수 없는 키 종류: k=' + T.k, 'Unknown key type: k=' + T.k)); ok = false; }
    if (T.p === undefined) { issues.push(t('🚨 p(공개키) 태그가 없습니다', '🚨 The p (public key) tag is missing')); ok = false; }
    else if (T.p === '') issues.push(t('p= 가 비어 있습니다 — 이 셀렉터의 키가 폐기(revoked)되었다는 뜻입니다', 'p= is empty — this selector\'s key has been revoked'));
    else {
      var der; try { der = H.fromB64(T.p); } catch (e) { der = null; }
      if (!der || !der.length) { issues.push(t('🚨 p 값이 올바른 Base64 가 아닙니다', '🚨 p is not valid Base64')); ok = false; }
      else if (kt === 'ed25519') {
        if (der.length !== 32) { issues.push(t('🚨 ed25519 공개키는 32바이트여야 합니다 (현재 ' + der.length + ')', '🚨 An ed25519 public key must be 32 bytes (got ' + der.length + ')')); ok = false; }
        else keyRow = 'Ed25519 · 256-bit';
      } else {
        try {
          var info; try { info = A.spki(der); } catch (e1) { var r = A.parse(der); if (r.tag === 16 && r.children.length === 2 && r.children[0].tag === 2) info = { alg: 'RSA', bits: A.bitLength(r.children[0].value), exponent: A.int(r.children[1].value).toString() }; else throw e1; }
          if (info.alg !== 'RSA') { issues.push(t('k=rsa 인데 키가 ' + info.alg + ' 입니다', 'k=rsa but the key is ' + info.alg)); ok = false; }
          else {
            key = info; keyRow = 'RSA · ' + info.bits + '-bit · e=' + info.exponent;
            if (info.bits < 1024) { issues.push(t('🚨 ' + info.bits + '비트 키는 안전하지 않으며 수신 서버가 거부합니다 (최소 1024, 권장 2048)', '🚨 A ' + info.bits + '-bit key is insecure and receivers reject it (minimum 1024, recommended 2048)')); ok = false; }
            else if (info.bits < 2048) issues.push(t('1024비트 키는 RFC 8301 이 최소로만 허용합니다 — 2048비트로 교체하세요', '1024-bit keys are only the bare minimum per RFC 8301 — rotate to 2048-bit'));
            else if (info.bits === 2048) issues.push(t('✅ 2048비트 RSA — 권장 길이입니다 (TXT 값이 255자를 넘으므로 문자열을 나눠 등록해야 합니다)', '✅ 2048-bit RSA — the recommended size (the TXT value exceeds 255 chars so it must be split into strings)'));
            else issues.push(t(info.bits + '비트: 안전하지만 TXT 값이 길어 일부 DNS 관리 화면에서 등록이 어렵습니다', info.bits + '-bit: secure, but the long TXT value is hard to enter in some DNS panels'));
            if (info.exponent !== '65537') issues.push(t('공개 지수 e=' + info.exponent + ' — 일반적으로 65537 을 씁니다', 'Public exponent e=' + info.exponent + ' — 65537 is the usual value'));
          }
        } catch (e2) { issues.push(t('🚨 p 를 DER 공개키로 해석할 수 없습니다: ' + e2.message, '🚨 Cannot parse p as a DER public key: ' + e2.message)); ok = false; }
      }
    }
    if (T.t !== undefined) {
      var fl = T.t.split(':'); if (fl.indexOf('y') >= 0) issues.push(t('t=y (테스트 모드) — 검증 실패를 무시하라는 신호입니다. 운영 전환 시 제거하세요', 't=y (testing mode) tells receivers to ignore failures — remove it in production'));
      if (fl.indexOf('s') >= 0) issues.push(t('t=s — 서명 도메인이 정확히 일치(서브도메인 불가)해야 합니다', 't=s — the signing domain must match exactly (no subdomains)'));
    }
    if (T.h !== undefined && T.h.toLowerCase().split(':').indexOf('sha256') < 0 && T.h) issues.push(t('h= 에 sha256 이 없습니다', 'h= does not include sha256'));
    if (T.h !== undefined && /sha1/i.test(T.h)) issues.push(t('sha1 은 폐기된 알고리즘입니다 (RFC 8301)', 'sha1 is deprecated (RFC 8301)'));
    if (T.s !== undefined && T.s !== '*' && T.s !== 'email') issues.push(t('s= 는 * 또는 email 이어야 합니다', 's= must be * or email'));
    var DK = { v: ['버전', 'Version'], k: ['키 종류', 'Key type'], p: ['공개키 (Base64)', 'Public key (Base64)'], h: ['허용 해시', 'Acceptable hash algorithms'], s: ['서비스 종류', 'Service types'], t: ['플래그 (y=테스트, s=엄격)', 'Flags (y = testing, s = strict)'], n: ['메모', 'Notes'] };
    rows = tags.map(function (x) { var k = DK[x[0]]; if (!k) issues.push(t('알 수 없는 태그: ' + x[0], 'Unknown tag: ' + x[0])); var shown = x[0] === 'p' && x[1].length > 40 ? x[1].slice(0, 30) + '…(' + x[1].length + t('자)', ' chars)') : x[1]; return [x[0], shown, k ? t(k[0], k[1]) : t('알 수 없음', 'Unknown')]; });
    if (keyRow) rows.push([t('키 분석', 'Key analysis'), keyRow, t('p 를 DER 로 해석한 결과', 'p decoded as DER')]);
    if (text.length > 255) issues.push(t('전체 길이 ' + text.length + '자 — 255자씩 나뉜 여러 문자열로 등록하세요', 'Total length ' + text.length + ' chars — publish it as several strings of at most 255 characters'));
    return fin(text, sel + '._domainkey.' + dom, rows);
    function fin(txt, h, rws) {
      var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
      return { _status: bad || !ok ? { ok: false, msg: t('❌ 문제 ' + Math.max(bad, 1) + '건 이상 — 점검 사항을 확인하세요', '❌ Problems found — see the findings') } : t('✅ ' + h + ' 레코드를 ' + (o.mode === 'bimi-build' ? '만들었습니다' : '분석했습니다'), '✅ Record for ' + h + ' ' + (o.mode === 'bimi-build' ? 'built' : 'parsed')), out: dnsTxt(h, txt), table: { head: [['태그', 'Tag'], ['값', 'Value'], ['의미', 'Meaning']], rows: rws }, issues: issues };
    }
  }
});
