TK.tool('mac-address-tool', {
  inputs: [{ id: 'in', label: ['MAC 주소 (한 줄에 하나)', 'MAC addresses (one per line)'], rows: 7, placeholder: ['00:1A:2B:3C:4D:5E · 00-1a-2b-3c-4d-5e · 001a.2b3c.4d5e', '00:1A:2B:3C:4D:5E · 00-1a-2b-3c-4d-5e · 001a.2b3c.4d5e'], sample: '00:1A:2B:3C:4D:5E\n3c-22-fb-12-34-56\n001a.2b3c.4d5e\nFF:FF:FF:FF:FF:FF\n02:42:ac:11:00:02\nzz:00:11:22:33:44' }],
  options: [{ id: 'fmt', type: 'select', label: ['출력 형식', 'Output format'], choices: [['colon', ['콜론 (00:1A:2B:3C:4D:5E)', 'Colon (00:1A:2B:3C:4D:5E)']], ['hyphen', ['하이픈 (00-1A-2B-3C-4D-5E)', 'Hyphen (00-1A-2B-3C-4D-5E)']], ['cisco', ['Cisco (001a.2b3c.4d5e)', 'Cisco (001a.2b3c.4d5e)']], ['plain', ['구분자 없음 (001A2B3C4D5E)', 'Plain (001A2B3C4D5E)']]], default: 'colon' }, { id: 'lower', type: 'checkbox', label: ['소문자', 'Lowercase'], default: false }],
  outputs: [{ id: 'table', label: ['검증·변환 결과', 'Validation & conversion'], kind: 'table' }, { id: 'out', label: ['변환된 목록', 'Converted list'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [], outs = [];
    function fmt(h) {
      var s = h.toUpperCase(), r;
      if (o.fmt === 'colon') r = s.replace(/(..)(?=.)/g, '$1:'); else if (o.fmt === 'hyphen') r = s.replace(/(..)(?=.)/g, '$1-'); else if (o.fmt === 'cisco') r = s.replace(/(....)(?=.)/g, '$1.'); else r = s;
      return o.lower ? r.toLowerCase() : r;
    }
    lines.forEach(function (ln) {
      var h = null, m;
      if ((m = /^([0-9a-f]{2})([:\-])(?:[0-9a-f]{2}\2){4}[0-9a-f]{2}$/i.exec(ln))) h = ln.replace(/[:\-]/g, '');
      else if (/^([0-9a-f]{4}\.){2}[0-9a-f]{4}$/i.test(ln)) h = ln.replace(/\./g, '');
      else if (/^[0-9a-f]{12}$/i.test(ln)) h = ln;
      else if (/^0x[0-9a-f]{1,12}$/i.test(ln)) h = ln.slice(2).padStart(12, '0');
      if (!h) { rows.push({ cls: 'r-bad', cells: [ln, t('MAC 주소 형식이 아닙니다 (16진수 12자리)', 'Not a MAC address (12 hex digits)'), '', '', ''] }); return; }
      var b0 = parseInt(h.slice(0, 2), 16), multicast = !!(b0 & 1), local = !!(b0 & 2), bcast = /^f{12}$/i.test(h), zero = /^0{12}$/.test(h);
      var oui = h.slice(0, 6).toUpperCase().replace(/(..)(?=.)/g, '$1-');
      var by = []; for (var q = 0; q < 12; q += 2) by.push(parseInt(h.slice(q, q + 2), 16));
      var eui = [((by[0] ^ 2) << 8) | by[1], (by[2] << 8) | 0xff, (0xfe << 8) | by[3], (by[4] << 8) | by[5]].map(function (x) { return x.toString(16); }).join(':');
      var kind = bcast ? t('브로드캐스트', 'Broadcast') : zero ? t('모두 0 (미지정)', 'All zeros (unspecified)') : multicast ? t('멀티캐스트', 'Multicast') : t('유니캐스트', 'Unicast');
      var admin = local ? t('로컬 관리(LAA) — 가상·무작위 주소 가능성', 'Locally administered (LAA) — virtual/randomised') : t('범용 관리(UAA) — 제조사 할당', 'Universally administered (UAA) — vendor assigned');
      outs.push(fmt(h));
      rows.push([ln, fmt(h), kind + ' · ' + admin, 'OUI ' + oui, 'fe80::' + eui]);
    });
    return { _status: lines.length ? t('✅ ' + outs.length + '개 변환, ' + (lines.length - outs.length) + '개 오류', '✅ ' + outs.length + ' converted, ' + (lines.length - outs.length) + ' invalid') : '',
      table: { head: [['입력', 'Input'], ['변환', 'Converted'], ['성격', 'Properties'], ['제조사 식별자', 'Vendor prefix'], ['EUI-64 링크 로컬 IPv6', 'EUI-64 link-local IPv6']], rows: rows }, out: outs.join('\n') };
  }
});
