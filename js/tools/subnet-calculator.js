TK.tool('subnet-calculator', {
  inputs: [{ id: 'in', label: ['IP/CIDR 또는 IP + 서브넷 마스크 (한 줄에 하나)', 'IP/CIDR or IP + subnet mask (one per line)'], rows: 6, placeholder: ['192.168.1.10/24, 10.0.0.0 255.255.0.0, 2001:db8::/32', '192.168.1.10/24, 10.0.0.0 255.255.0.0, 2001:db8::/32'],
    sample: '192.168.1.10/24\n10.0.0.0 255.255.0.0\n172.16.5.130/26\n203.0.113.5/31\n2001:db8:abcd::/48' }],
  options: [],
  outputs: [{ id: 'kv', label: ['계산 결과', 'Result'], kind: 'kv' }, { id: 'table', label: ['계산 결과', 'Results'], kind: 'table' }],
  run: function (v, o, t) {
    var N = TK.net, lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    function calc(ln) {
      var s = ln, m = /^(\S+)\s+(\d+\.\d+\.\d+\.\d+)$/.exec(ln);
      if (m) { var pf = N.maskToPrefix(m[2]); if (pf < 0) return { err: t('올바르지 않은 서브넷 마스크입니다 (연속된 1 다음에 0)', 'Invalid subnet mask (ones must be contiguous)') }; s = m[1] + '/' + pf; }
      var c = N.parseCIDR(s);
      if (!c) return { err: t('IP 주소 형식이 올바르지 않습니다', 'Invalid IP address format') };
      var bits = N.bits(c.v), size = c.end - c.start + 1n, f = function (x) { return N.fmt(c.v, x); };
      var r = { c: c, size: size, net: f(c.start), last: f(c.end), mask: c.v === 4 ? N.fmt4(c.mask) : null, prefix: c.prefix };
      if (c.v === 4) {
        r.wildcard = N.fmt4(~c.mask & 0xffffffffn);
        if (c.prefix >= 31) { r.firstHost = f(c.start); r.lastHost = f(c.end); r.hosts = c.prefix === 32 ? 1n : 2n; r.broadcast = c.prefix === 32 ? '—' : t('없음 (RFC 3021 점대점)', 'none (RFC 3021 point-to-point)'); }
        else { r.firstHost = f(c.start + 1n); r.lastHost = f(c.end - 1n); r.hosts = size - 2n; r.broadcast = f(c.end); }
        var a = Number(c.n >> 24n), b = Number((c.n >> 16n) & 255n);
        r.cls = a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D (멀티캐스트)' : 'E (예약)';
        var priv = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168), cgnat = a === 100 && b >= 64 && b <= 127, loop = a === 127, link = a === 169 && b === 254;
        r.kind = priv ? t('사설 (RFC 1918)', 'Private (RFC 1918)') : cgnat ? t('CGNAT (RFC 6598)', 'CGNAT (RFC 6598)') : loop ? t('루프백', 'Loopback') : link ? t('링크 로컬(APIPA)', 'Link-local (APIPA)') : a >= 224 ? t('멀티캐스트/예약', 'Multicast/Reserved') : /^(192\.0\.2|198\.51\.100|203\.0\.113)\./.test(N.fmt4(c.n)) ? t('문서용(TEST-NET)', 'Documentation (TEST-NET)') : t('공인', 'Public');
      } else {
        r.firstHost = f(c.start); r.lastHost = f(c.end); r.hosts = size;
        var g0 = Number(c.n >> 112n);
        r.kind = g0 === 0xfe80 || (g0 & 0xffc0) === 0xfe80 ? t('링크 로컬', 'Link-local') : (g0 & 0xfe00) === 0xfc00 ? t('고유 로컬(ULA)', 'Unique local (ULA)') : (g0 >> 8) === 0xff ? t('멀티캐스트', 'Multicast') : g0 === 0x2001 && ((c.n >> 96n) & 0xffffn) === 0xdb8n ? t('문서용 (2001:db8::/32)', 'Documentation (2001:db8::/32)') : c.n === 1n ? t('루프백', 'Loopback') : t('글로벌 유니캐스트', 'Global unicast');
      }
      return r;
    }
    var rs = lines.map(function (ln) { return { ln: ln, r: calc(ln) }; });
    function rows(r) {
      var out = [[['네트워크 주소', 'Network address'], r.net + '/' + r.prefix]];
      if (r.mask) out.push([['서브넷 마스크', 'Subnet mask'], r.mask], [['와일드카드 마스크', 'Wildcard mask'], r.wildcard]);
      out.push([['첫 호스트', 'First host'], r.firstHost], [['마지막 호스트', 'Last host'], r.lastHost]);
      if (r.c.v === 4) out.push([['브로드캐스트', 'Broadcast'], r.broadcast]);
      out.push([['전체 주소 수', 'Total addresses'], N.big(r.size)], [['사용 가능한 호스트 수', 'Usable hosts'], N.big(r.hosts)]);
      if (r.c.v === 4) out.push([['클래스', 'Class'], r.cls], [['입력한 주소(2진)', 'Input address (binary)'], r.c.n.toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1.')]);
      out.push([['성격', 'Type'], r.kind]);
      return out;
    }
    if (rs.length === 1) { if (rs[0].r.err) throw new Error(rs[0].r.err); return { _status: t('✅ IPv' + rs[0].r.c.v + ' /' + rs[0].r.prefix + ' 계산 완료', '✅ IPv' + rs[0].r.c.v + ' /' + rs[0].r.prefix + ' calculated'), kv: rows(rs[0].r) }; }
    var bad = rs.filter(function (x) { return x.r.err; }).length;
    return { _status: bad ? { ok: 'info', msg: t('⚠️ ' + bad + '개 줄을 계산하지 못했습니다', '⚠️ ' + bad + ' line(s) failed') } : t('✅ ' + rs.length + '개 계산', '✅ Calculated ' + rs.length),
      table: { head: [['입력', 'Input'], ['네트워크', 'Network'], ['마스크', 'Mask'], ['호스트 범위', 'Host range'], ['브로드캐스트', 'Broadcast'], ['호스트 수', 'Hosts']],
        rows: rs.map(function (x) { var r = x.r; return r.err ? { cls: 'r-bad', cells: [x.ln, r.err, '', '', '', ''] } : [x.ln, r.net + '/' + r.prefix, r.mask || '/' + r.prefix, r.firstHost + ' – ' + r.lastHost, r.c.v === 4 ? r.broadcast : '—', N.big(r.hosts)]; }) } };
  }
});
