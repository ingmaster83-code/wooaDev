TK.tool('ip-converter', {
  inputs: [{ id: 'in', label: ['IP 주소 또는 정수 (한 줄에 하나)', 'IP addresses or integers (one per line)'], rows: 7, placeholder: ['192.168.0.1 · 3232235521 · 0xC0A80001 · 2001:db8::1 · ::ffff:192.0.2.1', '192.168.0.1 · 3232235521 · 0xC0A80001 · 2001:db8::1 · ::ffff:192.0.2.1'],
    sample: '192.168.0.1\n3232235521\n0xC0A80001\n2001:db8::1\n::ffff:192.0.2.128' }],
  options: [{ id: 'int', type: 'select', label: ['숫자(정수) 입력은', 'A plain integer is an'], choices: [['v4', 'IPv4'], ['v6', 'IPv6']], default: 'v4' }],
  outputs: [{ id: 'kv', label: ['변환 결과', 'Conversion'], kind: 'kv' }, { id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }],
  run: function (v, o, t) {
    var N = TK.net, lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    function parse(ln) {
      var ip = N.parseIP(ln);
      if (ip) return ip;
      if (/^0x[0-9a-f]+$/i.test(ln) || /^\d+$/.test(ln)) {
        var n = BigInt(ln);
        if (o.int === 'v4' && n <= 0xffffffffn) return { v: 4, n: n };
        if (n < (1n << 128n)) return { v: 6, n: n };
      }
      if (/^0b[01]+$/i.test(ln)) { var b = BigInt(ln); return b <= 0xffffffffn && o.int === 'v4' ? { v: 4, n: b } : { v: 6, n: b }; }
      var oct = /^(0\d*|0x[0-9a-f]+)(\.(0\d*|0x[0-9a-f]+|\d+)){3}$/i.exec(ln);
      if (oct) { var p = ln.split('.').map(function (x) { return /^0x/i.test(x) ? parseInt(x, 16) : /^0\d/.test(x) ? parseInt(x, 8) : parseInt(x, 10); }); if (p.every(function (x) { return x >= 0 && x < 256; })) return { v: 4, n: BigInt(p[0]) << 24n | BigInt(p[1]) << 16n | BigInt(p[2]) << 8n | BigInt(p[3]) }; }
      return null;
    }
    function detail(ip) {
      var rows = [], n = ip.n;
      if (ip.v === 4) {
        rows.push([['IPv4 (점 표기)', 'IPv4 (dotted)'], N.fmt4(n)], [['10진 정수', 'Decimal integer'], n.toString()], [['16진수', 'Hex'], '0x' + n.toString(16).toUpperCase().padStart(8, '0')], [['2진수', 'Binary'], n.toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1.')],
          [['8진수(옥텟별)', 'Octal per octet'], N.fmt4(n).split('.').map(function (x) { return '0' + parseInt(x, 10).toString(8); }).join('.')], [['IPv4-매핑 IPv6', 'IPv4-mapped IPv6'], '::ffff:' + N.fmt4(n)],
          [['6to4 접두어', '6to4 prefix'], '2002:' + ((n >> 16n).toString(16).padStart(4, '0')) + ':' + ((n & 0xffffn).toString(16).padStart(4, '0')) + '::/48'], [['역방향 DNS', 'Reverse DNS'], N.fmt4(n).split('.').reverse().join('.') + '.in-addr.arpa']);
      } else {
        rows.push([['IPv6 (압축)', 'IPv6 (compressed)'], N.fmt6(n)], [['IPv6 (전체)', 'IPv6 (expanded)'], N.fmt6(n, 'full')], [['10진 정수', 'Decimal integer'], n.toString()], [['16진수', 'Hex'], '0x' + n.toString(16).padStart(32, '0')]);
        if ((n >> 32n) === 0xffffn) rows.push([['내장된 IPv4', 'Embedded IPv4'], N.fmt4(n & 0xffffffffn)]);
        rows.push([['역방향 DNS', 'Reverse DNS'], n.toString(16).padStart(32, '0').split('').reverse().join('.') + '.ip6.arpa']);
      }
      return rows;
    }
    var rs = lines.map(function (ln) { return { ln: ln, ip: parse(ln) }; });
    if (rs.length === 1) { if (!rs[0].ip) throw new Error(t('IP 주소나 정수로 해석할 수 없습니다', 'Cannot interpret as an IP address or integer')); return { _status: t('✅ IPv' + rs[0].ip.v + ' 주소', '✅ IPv' + rs[0].ip.v + ' address'), kv: detail(rs[0].ip) }; }
    var bad = rs.filter(function (x) { return !x.ip; }).length;
    return { _status: bad ? { ok: 'info', msg: t('⚠️ ' + bad + '개 줄을 해석하지 못했습니다', '⚠️ ' + bad + ' line(s) could not be parsed') } : t('✅ ' + rs.length + '개 변환', '✅ Converted ' + rs.length),
      table: { head: [['입력', 'Input'], ['버전', 'Version'], ['표준 표기', 'Standard form'], ['10진 정수', 'Decimal'], ['16진수', 'Hex']],
        rows: rs.map(function (x) { var ip = x.ip; return ip ? [x.ln, 'IPv' + ip.v, N.fmt(ip.v, ip.n), ip.n.toString(), '0x' + ip.n.toString(16).toUpperCase()] : { cls: 'r-bad', cells: [x.ln, t('해석 실패', 'Parse error'), '', '', ''] }; }) } };
  }
});
