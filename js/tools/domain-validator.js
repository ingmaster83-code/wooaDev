TK.tool('domain-validator', {
  inputs: [{ id: 'in', label: ['도메인·호스트 이름 (한 줄에 하나)', 'Domains / hostnames (one per line)'], rows: 8, placeholder: ['example.com · sub.example.co.kr · 한글.kr · localhost · *.example.com', 'example.com · sub.example.co.kr · 한글.kr · localhost · *.example.com'],
    sample: 'example.com\nwww.wooahouse.com\n한글도메인.한국\n-bad-start.com\nunder_score.example.com\n*.example.com\nlocalhost\n192.168.0.1\nexample..com\n' + 'a'.repeat(64) + '.com' }],
  options: [
    { id: 'mode', type: 'select', label: ['검사 규칙', 'Rule set'], choices: [['domain', ['도메인 (최상위 도메인 포함, 2개 이상 레이블)', 'Domain (with TLD, 2+ labels)']], ['hostname', ['호스트 이름 (RFC 1123, 단일 레이블 허용)', 'Hostname (RFC 1123, single label allowed)']], ['dns', ['DNS 이름 (밑줄 허용, 서비스 레코드 등)', 'DNS name (underscores allowed, e.g. SRV/DKIM)']]], default: 'domain' },
    { id: 'wild', type: 'checkbox', label: ['와일드카드(*.) 허용', 'Allow wildcard (*.)'], default: true },
    { id: 'idn', type: 'checkbox', label: ['국제화 도메인(IDN) 허용', 'Allow internationalized (IDN) names'], default: true }
  ],
  outputs: [{ id: 'table', label: ['검사 결과', 'Validation results'], kind: 'table' }, { id: 'out', label: ['유효한 항목 (정규화)', 'Valid entries (normalized)'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var D = TK.dns, lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [], valid = [];
    lines.forEach(function (ln) {
      var raw = ln.replace(/\.$/, ''), reasons = [], warns = [], name = raw, wildcard = false;
      if (o.wild && /^\*\./.test(name)) { wildcard = true; name = name.slice(2); }
      if (/[\s\/:@?#]/.test(name)) reasons.push(t('공백·/·:·@ 같은 문자가 있습니다 (URL이 아니라 이름만 입력하세요)', 'Contains spaces or / : @ — enter the name only, not a URL'));
      var nonAscii = /[^\x00-\x7f]/.test(name);
      if (nonAscii && !o.idn) reasons.push(t('ASCII가 아닌 문자가 있습니다 (IDN 비허용)', 'Non-ASCII characters (IDN not allowed)'));
      var ascii = name;
      if (nonAscii && !reasons.length) { try { ascii = D.toASCII(name); } catch (e) { reasons.push(e.message); } }
      if (/^\d+\.\d+\.\d+\.\d+$/.test(ascii)) reasons.push(t('IP 주소입니다 (도메인 이름이 아님)', 'This is an IP address, not a domain name'));
      var labels = ascii.split('.');
      if (!ascii) reasons.push(t('비어 있습니다', 'Empty'));
      if (ascii.length > 253) reasons.push(t('전체 길이 253자 초과 (' + ascii.length + ')', 'Longer than 253 characters (' + ascii.length + ')'));
      var re = o.mode === 'dns' ? /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$/i : /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;
      labels.forEach(function (l, i) {
        if (!l) { reasons.push(t('빈 레이블(연속된 점 또는 시작/끝의 점)', 'Empty label (consecutive or leading dots)')); return; }
        if (l.length > 63) reasons.push(t('레이블이 63자를 넘습니다: ' + l.slice(0, 10) + '…', 'Label over 63 characters: ' + l.slice(0, 10) + '…'));
        if (!re.test(l)) {
          if (/^-|-$/.test(l)) reasons.push(t('레이블이 하이픈으로 시작하거나 끝납니다: ' + l, 'Label starts or ends with a hyphen: ' + l));
          else if (/_/.test(l) && o.mode !== 'dns') reasons.push(t('밑줄(_)은 호스트 이름에 쓸 수 없습니다: ' + l + ' (DNS 이름 모드에서는 허용)', 'Underscore is not allowed in hostnames: ' + l + ' (allowed in DNS-name mode)'));
          else reasons.push(t('허용되지 않는 문자가 있습니다: ' + l, 'Invalid characters in label: ' + l));
        }
        if (/^..--/.test(l) && !/^xn--/i.test(l)) warns.push(t('3·4번째 글자가 "--"인 레이블은 xn--만 허용됩니다', 'Only xn-- may have "--" in positions 3–4'));
      });
      if (o.mode === 'domain' && labels.length < 2) reasons.push(t('최상위 도메인이 없습니다 (레이블이 2개 이상 필요)', 'No TLD — at least 2 labels are required'));
      var tld = labels[labels.length - 1];
      if (tld && /^\d+$/.test(tld) && !/^\d+\.\d+\.\d+\.\d+$/.test(ascii)) reasons.push(t('최상위 도메인이 숫자로만 되어 있습니다', 'The TLD is all digits'));
      if (o.mode === 'domain' && tld && tld.length < 2 && tld) reasons.push(t('최상위 도메인이 너무 짧습니다', 'TLD is too short'));
      var norm = (wildcard ? '*.' : '') + ascii.toLowerCase();
      if (!reasons.length) valid.push(norm);
      rows.push(reasons.length ? { cls: 'r-bad', cells: [ln, '❌', norm, reasons.join(' / ')] } : { cls: warns.length ? 'r-warn' : '', cells: [ln, warns.length ? '⚠️' : '✅', norm, (wildcard ? t('와일드카드 · ', 'wildcard · ') : '') + (nonAscii ? t('IDN → Punycode · ', 'IDN → Punycode · ') : '') + labels.length + t('개 레이블, ', ' label(s), ') + ascii.length + t('자', ' chars') + (warns.length ? ' · ' + warns.join(' / ') : '')] });
    });
    return { _status: lines.length ? t('✅ ' + valid.length + '개 유효 / ' + (lines.length - valid.length) + '개 오류', '✅ ' + valid.length + ' valid / ' + (lines.length - valid.length) + ' invalid') : '', table: { head: [['입력', 'Input'], ['결과', 'Result'], ['정규화', 'Normalized'], ['상세', 'Details']], rows: rows }, out: valid.join('\n') };
  }
});
