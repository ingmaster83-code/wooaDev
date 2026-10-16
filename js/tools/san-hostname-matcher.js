TK.tool('san-hostname-matcher', {
  inputs: [
    { id: 'sans', label: ['인증서의 SAN / CN 목록 (한 줄에 하나, IP는 IP: 접두사 또는 그대로)', 'Certificate SAN / CN entries (one per line; IPs bare or with IP: prefix)'], rows: 5, sample: '*.example.com\nexample.com\nIP:203.0.113.10\napi.internal.example.org\nxn--bcher-kva.example' },
    { id: 'hosts', label: ['확인할 호스트 이름 (한 줄에 하나)', 'Hostnames to check (one per line)'], rows: 8, sample: 'www.example.com\nexample.com\na.b.example.com\n*.example.com\nEXAMPLE.COM.\n203.0.113.10\napi.internal.example.org\nbücher.example\nfoo.com' }
  ],
  options: [{ id: 'mode', type: 'select', label: ['규칙', 'Rules'], choices: [['rfc6125', ['RFC 6125/9525 (브라우저와 동일)', 'RFC 6125 / 9525 (browser-like)']], ['loose', ['느슨함 (* 가 여러 레이블 허용 — 일부 오래된 클라이언트)', 'Loose (* spans labels — some old clients)']]], default: 'rfc6125' }],
  outputs: [{ id: 'table', label: ['일치 결과', 'Match results'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.net, D = TK.dns, issues = [];
    function lines(s) { return String(s).replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
    var sans = lines(v.sans).map(function (s) { var ip = /^IP(?: Address)?:\s*(.+)$/i.exec(s); return ip ? { ip: true, v: ip[1] } : (N.parseIP(s) ? { ip: true, v: s } : { ip: false, v: s.replace(/^DNS:\s*/i, '') }); });
    var hosts = lines(v.hosts);
    if (!sans.length || !hosts.length) throw new Error(t('SAN 목록과 호스트 이름을 모두 입력하세요', 'Enter both the SAN list and hostnames'));
    function norm(h) { h = h.replace(/\.$/, ''); try { return D.toASCII(h).toLowerCase(); } catch (e) { return h.toLowerCase(); } }
    sans.forEach(function (s) {
      if (s.ip) { if (!N.parseIP(s.v)) issues.push(t('🚨 IP SAN 형식 오류: ' + s.v, '🚨 Invalid IP SAN: ' + s.v)); return; }
      var p = norm(s.v);
      if (p.indexOf('*') >= 0) {
        if (p.indexOf('*') !== 0 || p[1] !== '.') issues.push(t('와일드카드는 맨 왼쪽 레이블 전체(*.example.com)에만 쓸 수 있습니다: ' + s.v, 'A wildcard may only be the whole left-most label (*.example.com): ' + s.v));
        else if (p.split('.').length < 3) issues.push(t('🚨 너무 넓은 와일드카드: ' + s.v + ' (최소 2개 레이블이 필요)', '🚨 Wildcard too broad: ' + s.v + ' (at least two labels needed)'));
        else if (/^\*\.(co|com|net|org|go|or|ac)\.(kr|uk|jp)$/.test(p)) issues.push(t('🚨 공개 접미사 아래 와일드카드: ' + s.v, '🚨 Wildcard directly under a public suffix: ' + s.v));
      }
    });
    function matchOne(host) {
      var ipH = N.parseIP(host.replace(/^\[|\]$/g, ''));
      if (ipH) {
        var hit = sans.filter(function (s) { var x = s.ip && N.parseIP(s.v); return x && x.v === ipH.v && x.n === ipH.n; });
        return hit.length ? { ok: true, by: 'IP:' + hit[0].v } : { ok: false, why: sans.some(function (s) { return !s.ip && norm(s.v) === norm(host); }) ? t('DNS SAN 에 같은 문자열이 있지만 IP 는 IP SAN 으로만 일치합니다', 'A DNS SAN has this text but IPs only match IP SANs') : t('일치하는 IP SAN 이 없습니다', 'No matching IP SAN') };
      }
      var h = norm(host);
      if (h.indexOf('*') >= 0) return { ok: false, why: t('와일드카드는 호스트 이름으로 쓸 수 없습니다 (인증서 쪽에만 사용)', 'A wildcard is not a valid hostname (it belongs in the certificate only)') };
      for (var i = 0; i < sans.length; i++) {
        var s = sans[i]; if (s.ip) continue; var p = norm(s.v);
        if (p === h) return { ok: true, by: s.v };
        if (p.indexOf('*.') === 0) {
          var suffix = p.slice(1);   // .example.com
          if (h.slice(-suffix.length) === suffix) {
            var left = h.slice(0, h.length - suffix.length);
            if (left && (o.mode === 'loose' || left.indexOf('.') < 0)) return { ok: true, by: s.v };
          }
        }
      }
      var why = t('일치하는 SAN 이 없습니다', 'No SAN matches');
      if (/^\*\./.test(h)) why = t('와일드카드 자체를 호스트로 쓸 수 없습니다', 'A wildcard is not a valid hostname');
      else for (var j = 0; j < sans.length; j++) { var q = norm(sans[j].v); if (!sans[j].ip && q.indexOf('*.') === 0 && h.slice(-(q.length - 1)) === q.slice(1) && h.slice(0, h.length - q.length + 1).indexOf('.') >= 0) { why = t('* 는 레이블 하나만 대신합니다 (' + sans[j].v + ' 는 ' + h + ' 와 일치하지 않음)', '* covers one label only (' + sans[j].v + ' does not match ' + h + ')'); break; } if (!sans[j].ip && q.indexOf('*.') === 0 && h === q.slice(2)) { why = t('와일드카드는 루트 도메인 자체를 포함하지 않습니다 — 별도 SAN 이 필요합니다', 'A wildcard does not cover the apex domain — add it as its own SAN'); break; } }
      return { ok: false, why: why };
    }
    var rows = [], okN = 0;
    hosts.forEach(function (h) { var r = matchOne(h); if (r.ok) okN++; rows.push([h, r.ok ? '✅' : '❌', r.ok ? t('일치: ', 'matched by ') + r.by : r.why]); });
    issues.push(t('최신 브라우저와 RFC 9110/9525 는 CN 을 무시하고 SAN 만 봅니다. CN 에만 있는 이름은 오류가 납니다', 'Modern browsers and RFC 9110 / 9525 ignore the CN and use SANs only; names only in the CN fail'));
    issues.push(t('한글·유니코드 호스트는 punycode(xn--)로 바꿔 비교합니다. 호스트 이름 끝의 점(.)은 무시합니다', 'Unicode hostnames are compared as punycode (xn--); a trailing dot is ignored'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: 'info', msg: t('🔍 SAN 에 위험 항목이 있습니다', '🔍 Risky SAN entries') } : t('✅ ' + hosts.length + '개 중 ' + okN + '개 일치', '✅ ' + okN + ' of ' + hosts.length + ' match'), table: { head: [['호스트', 'Host'], ['결과', 'Result'], ['근거', 'Why']], rows: rows }, issues: issues };
  }
});
