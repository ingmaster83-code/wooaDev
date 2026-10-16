TK.tool('reverse-dns-generator', {
  inputs: [{ id: 'in', label: ['IP 주소 또는 CIDR (한 줄에 하나)', 'IP addresses or CIDRs (one per line)'], rows: 7, placeholder: ['203.0.113.45 · 192.0.2.0/24 · 2001:db8::1 · 2001:db8::/32', '203.0.113.45 · 192.0.2.0/24 · 2001:db8::1 · 2001:db8::/32'], sample: '203.0.113.45\n192.0.2.0/24\n198.51.100.0/22\n192.0.2.64/26\n2001:db8::1\n2001:db8:abcd::/48' }],
  options: [{ id: 'dot', type: 'checkbox', label: ['끝에 점(.) 붙이기', 'Add trailing dot'], default: true }],
  outputs: [{ id: 'table', label: ['PTR / 역방향 존 이름', 'PTR / reverse zone names'], kind: 'table' }],
  run: function (v, o, t) {
    var N = TK.net, dot = o.dot ? '.' : '', lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [];
    function nibbles(n) { return n.toString(16).padStart(32, '0').split(''); }
    lines.forEach(function (ln) {
      var c = N.parseCIDR(ln); if (!c) { rows.push({ cls: 'r-bad', cells: [ln, '—', t('IP 주소 또는 CIDR 형식 오류', 'Invalid IP or CIDR'), '']}); return; }
      var hasPrefix = /\//.test(ln);
      if (c.v === 4) {
        var oct = N.fmt4(c.n).split('.');
        if (!hasPrefix || c.prefix === 32) { rows.push([ln, 'PTR', oct.slice().reverse().join('.') + '.in-addr.arpa' + dot, t('IPv4 단일 주소', 'Single IPv4 address')]); return; }
        var start = N.fmt4(c.start).split('.').map(Number), nOct = Math.floor(c.prefix / 8);
        if (c.prefix % 8 === 0) { rows.push([ln, t('존', 'Zone'), start.slice(0, nOct).reverse().join('.') + (nOct ? '.' : '') + 'in-addr.arpa' + dot, t('옥텟 경계 — 일반 위임', 'Octet boundary — normal delegation')]); return; }
        if (c.prefix < 24) {                    // 여러 개의 /24(또는 /16) 존
          var step = c.prefix < 16 ? 16 : 24, block = Math.pow(2, step - c.prefix), zones = [], per = step === 16 ? 256 * 256 : 256;
          if (block > 64) { rows.push([ln, t('존 목록', 'Zones'), t('존이 ' + block + '개로 너무 많습니다 (처음 4개만 표시)', block + ' zones — too many (first 4 shown)'), '']); }
          for (var i = 0; i < Math.min(block, c.prefix < 16 && block > 64 ? 4 : block); i++) {
            var base = Number(c.start >> BigInt(32 - step)) + i, parts = step === 16 ? [base >> 8 & 255, base & 255] : [base >> 16 & 255, base >> 8 & 255, base & 255];
            zones.push(parts.reverse().join('.') + '.in-addr.arpa' + dot);
          }
          if (block <= 64 || c.prefix >= 16) rows.push([ln, t('존 ' + block + '개', block + ' zones'), zones.join('\n'), t('옥텟 경계가 아니라 여러 존을 각각 위임', 'Not on an octet boundary — delegate each zone')]);
        } else {                                // /25 ~ /31: RFC 2317 클래스리스 위임
          var o4 = start[3], last = o4 + Math.pow(2, 32 - c.prefix) - 1, zoneBase = start.slice(0, 3).reverse().join('.');
          rows.push([ln, 'RFC 2317', o4 + '/' + c.prefix + '.' + zoneBase + '.in-addr.arpa' + dot, t('부모 /24 존에 CNAME(' + o4 + '~' + last + ' → 위 이름)을 두는 클래스리스 위임', 'Classless delegation: CNAME ' + o4 + '–' + last + ' in the parent /24 pointing at this name')]);
        }
        return;
      }
      var nb = nibbles(c.n);
      if (!hasPrefix || c.prefix === 128) { rows.push([ln, 'PTR', nb.slice().reverse().join('.') + '.ip6.arpa' + dot, t('IPv6 단일 주소', 'Single IPv6 address')]); return; }
      var nibCount = Math.floor(c.prefix / 4);
      if (c.prefix % 4 === 0) { rows.push([ln, t('존', 'Zone'), nibbles(c.start).slice(0, nibCount).reverse().join('.') + '.ip6.arpa' + dot, t('니블 경계 — 일반 위임', 'Nibble boundary — normal delegation')]); return; }
      var extra = 4 - (c.prefix % 4), cnt = Math.pow(2, extra), zs = [];
      for (var k = 0; k < cnt; k++) { var sv = c.start + (BigInt(k) << BigInt(128 - (nibCount + 1) * 4)); zs.push(nibbles(sv).slice(0, nibCount + 1).reverse().join('.') + '.ip6.arpa' + dot); }
      rows.push([ln, t('존 ' + cnt + '개', cnt + ' zones'), zs.join('\n'), t('니블 경계가 아니라 여러 존으로 나눠 위임', 'Not on a nibble boundary — delegate several zones')]);
    });
    return { _status: lines.length ? t('✅ ' + lines.length + '개 처리', '✅ Processed ' + lines.length) : '', table: { head: [['입력', 'Input'], ['종류', 'Kind'], ['역방향 이름', 'Reverse name'], ['설명', 'Notes']], rows: rows } };
  }
});
