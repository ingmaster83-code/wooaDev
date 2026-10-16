TK.tool('cidr-set-calculator', {
  inputs: [
    { id: 'a', label: ['CIDR 목록 A (한 줄에 하나, 단일 IP·범위 허용)', 'CIDR list A (one per line; single IPs and ranges allowed)'], rows: 8, sample: '10.0.0.0/24\n10.0.1.0/24\n10.0.2.0/23\n192.168.0.0/16\n172.16.0.1 - 172.16.0.200' },
    { id: 'b', label: ['CIDR 목록 B (교집합·제외·포함 확인용)', 'CIDR list B (for intersect / exclude / contains)'], rows: 8, sample: '10.0.2.0/24\n192.168.10.0/24', show: function (o) { return o.op !== 'merge'; } }
  ],
  options: [{ id: 'op', type: 'select', label: ['연산', 'Operation'], choices: [['merge', ['A 병합·최적화', 'Merge / aggregate A']], ['intersect', ['A ∩ B (교집합)', 'A ∩ B (intersection)']], ['subtract', ['A − B (제외)', 'A − B (exclude)']], ['union', ['A ∪ B (합집합)', 'A ∪ B (union)']], ['contains', ['B의 각 항목이 A에 포함되는지', 'Is each B entry inside A?']]], default: 'merge' }],
  outputs: [{ id: 'out', label: ['결과 CIDR', 'Resulting CIDRs'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['포함 여부', 'Containment'], kind: 'table' }, { id: 'info', label: ['요약', 'Summary'], kind: 'kv' }],
  run: function (v, o, t) {
    var N = TK.net;
    function parseList(text, tag) {
      var res = { 4: [], 6: [] };
      String(text || '').split(/\r?\n/).forEach(function (ln, i) {
        ln = ln.replace(/#.*$/, '').trim(); if (!ln) return;
        var rg = /^(\S+)\s*[-–~]\s*(\S+)$/.exec(ln), a, b, v;
        if (rg) { a = N.parseIP(rg[1]); b = N.parseIP(rg[2]); if (!a || !b || a.v !== b.v || a.n > b.n) throw new Error(tag + t(' ' + (i + 1) + '번째 줄: 올바른 IP 범위가 아닙니다 (' + ln + ')', ' line ' + (i + 1) + ': not a valid IP range (' + ln + ')')); res[a.v].push({ start: a.n, end: b.n }); return; }
        var c = N.parseCIDR(ln);
        if (!c) throw new Error(tag + t(' ' + (i + 1) + '번째 줄: 올바른 CIDR이 아닙니다 (' + ln + ')', ' line ' + (i + 1) + ': not a valid CIDR (' + ln + ')'));
        res[c.v].push({ start: c.start, end: c.end });
      });
      return res;
    }
    var A = parseList(v.a, 'A'), B = o.op === 'merge' ? { 4: [], 6: [] } : parseList(v.b, 'B');
    function fmtRanges(rs, ver) { var out = []; rs.forEach(function (r) { N.rangeToCidrs(r.start, r.end, ver).forEach(function (c) { out.push(N.cidrStr(c)); }); }); return out; }
    var out = [], total = { 4: 0n, 6: 0n }, inCount = 0, outCount = 0;
    [4, 6].forEach(function (ver) {
      var a = A[ver], b = B[ver], res;
      inCount += a.length;
      if (o.op === 'merge') res = N.merge(a);
      else if (o.op === 'intersect') res = N.intersect(a, b);
      else if (o.op === 'subtract') res = N.subtract(a, b);
      else if (o.op === 'union') res = N.merge(a.concat(b));
      else res = N.merge(a);
      if (o.op !== 'contains') { fmtRanges(res, ver).forEach(function (s) { out.push(s); }); res.forEach(function (r) { total[ver] += N.count(r); }); }
    });
    var res = { };
    if (o.op === 'contains') {
      var rows = [];
      String(v.b || '').split(/\r?\n/).forEach(function (ln) {
        ln = ln.replace(/#.*$/, '').trim(); if (!ln) return;
        var c = N.parseCIDR(ln); if (!c) { rows.push({ cls: 'r-bad', cells: [ln, t('형식 오류', 'Invalid'), '']}); return; }
        var merged = N.merge(A[c.v]), full = merged.some(function (r) { return r.start <= c.start && c.end <= r.end; }), part = N.intersect(merged, [{ start: c.start, end: c.end }]).length > 0;
        rows.push({ cls: full ? 'r-ok' : part ? 'r-warn' : 'r-bad', cells: [ln, full ? t('전부 포함', 'Fully inside') : part ? t('일부만 겹침', 'Partly overlapping') : t('포함되지 않음', 'Not inside'), ''] });
      });
      return { _status: t('✅ ' + rows.length + '개 항목 검사', '✅ Checked ' + rows.length + ' entries'), table: { head: [['B 항목', 'B entry'], ['결과', 'Result'], ['', '']], rows: rows } };
    }
    outCount = out.length;
    var info = [[['입력 항목 수', 'Input entries'], inCount], [['결과 CIDR 수', 'Resulting CIDRs'], outCount]];
    if (total[4] > 0n) info.push([['IPv4 주소 수', 'IPv4 addresses'], N.big(total[4])]);
    if (total[6] > 0n) info.push([['IPv6 주소 수', 'IPv6 addresses'], N.big(total[6])]);
    return { _status: t('✅ ' + inCount + '개 → ' + outCount + '개 CIDR', '✅ ' + inCount + ' entries → ' + outCount + ' CIDR(s)'), out: out.join('\n'), info: info };
  }
});
