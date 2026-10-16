TK.tool('ip-range-to-cidr', {
  inputs: [{ id: 'in', label: ['IP 범위 (시작 - 끝) 또는 CIDR (한 줄에 하나)', 'IP ranges (start - end) or CIDRs (one per line)'], rows: 7, placeholder: ['192.168.1.5 - 192.168.1.200', '192.168.1.5 - 192.168.1.200'], sample: '192.168.1.5 - 192.168.1.200\n10.0.0.0 - 10.0.3.255\n203.0.113.0/28\n2001:db8::1 - 2001:db8::ff' }],
  options: [],
  outputs: [{ id: 'table', label: ['변환 결과', 'Conversion'], kind: 'table' }, { id: 'out', label: ['CIDR 모음', 'All CIDRs'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var N = TK.net, lines = v.in.split(/\r?\n/).map(function (x) { return x.replace(/#.*$/, '').trim(); }).filter(Boolean), rows = [], all = [];
    lines.forEach(function (ln) {
      var rg = /^(\S+)\s*(?:[-–~]|to)\s*(\S+)$/i.exec(ln);
      if (rg) {
        var a = N.parseIP(rg[1]), b = N.parseIP(rg[2]);
        if (!a || !b) { rows.push({ cls: 'r-bad', cells: [ln, t('IP 주소 형식 오류', 'Invalid IP address'), '', '']}); return; }
        if (a.v !== b.v) { rows.push({ cls: 'r-bad', cells: [ln, t('IPv4와 IPv6를 섞을 수 없습니다', 'Cannot mix IPv4 and IPv6'), '', '']}); return; }
        if (a.n > b.n) { rows.push({ cls: 'r-bad', cells: [ln, t('시작 주소가 끝 주소보다 큽니다', 'Start is greater than end'), '', '']}); return; }
        var cs = N.rangeToCidrs(a.n, b.n, a.v).map(N.cidrStr);
        rows.push([ln, cs.length + t('개', ''), cs.join(', '), N.big(b.n - a.n + 1n)]); cs.forEach(function (c) { all.push(c); });
      } else {
        var c = N.parseCIDR(ln);
        if (!c) { rows.push({ cls: 'r-bad', cells: [ln, t('형식 오류', 'Invalid'), '', '']}); return; }
        rows.push([ln, '1', t('범위: ', 'Range: ') + N.fmt(c.v, c.start) + ' – ' + N.fmt(c.v, c.end), N.big(c.end - c.start + 1n)]);
      }
    });
    return { _status: lines.length ? t('✅ ' + lines.length + '줄 처리 — CIDR ' + all.length + '개', '✅ ' + lines.length + ' line(s) — ' + all.length + ' CIDR(s)') : '',
      table: { head: [['입력', 'Input'], ['CIDR 개수', 'CIDR count'], ['결과 (최소 CIDR 블록)', 'Result (minimal CIDR blocks)'], ['주소 수', 'Addresses']], rows: rows }, out: all.join('\n') };
  }
});
