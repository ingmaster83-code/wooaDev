TK.tool('spf-builder', {
  inputs: [
    { id: 'sources', label: ['발신 출처 (한 줄에 하나)', 'Sending sources (one per line)'], rows: 7, sample: 'mx\ninclude:_spf.google.com\nip4:203.0.113.10\nip4:198.51.100.0/24\nip6:2001:db8::/32\na:mail.example.com', placeholder: ['mx, a, include:도메인, ip4:주소, ip6:주소, exists:도메인\n단축어: google, microsoft365, sendgrid, mailgun, ses, mailchimp, zoho', 'mx, a, include:domain, ip4:addr, ip6:addr, exists:domain\nShortcuts: google, microsoft365, sendgrid, mailgun, ses, mailchimp, zoho'], show: function (o) { return o.mode === 'build'; } },
    { id: 'record', label: ['검사할 SPF 레코드', 'SPF record to check'], rows: 4, sample: 'v=spf1 mx include:_spf.google.com include:spf.protection.outlook.com ptr ip4:203.0.113.10 ?all', show: function (o) { return o.mode === 'check'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['build', ['SPF 레코드 만들기', 'Build an SPF record']], ['check', ['기존 레코드 정적 검사', 'Statically check a record']]], default: 'build' },
    { id: 'all', type: 'select', label: ['나머지 처리 (all)', 'Everything else (all)'], choices: [['-all', ['-all  거부 (엄격, 권장)', '-all  reject (strict, recommended)']], ['~all', ['~all  소프트페일 (전환 기간)', '~all  softfail (transition)']], ['?all', ['?all  중립 (보호 없음)', '?all  neutral (no protection)']]], default: '-all', show: function (o) { return o.mode === 'build'; } },
    { id: 'domain', type: 'text', label: ['도메인 (DNS 호스트 표시용)', 'Domain (for the DNS host name)'], default: 'example.com' }
  ],
  outputs: [{ id: 'out', label: ['SPF TXT 값', 'SPF TXT value'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['항목별 해석', 'Term breakdown'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.net, SHORT = { google: 'include:_spf.google.com', microsoft365: 'include:spf.protection.outlook.com', office365: 'include:spf.protection.outlook.com', sendgrid: 'include:sendgrid.net', mailgun: 'include:mailgun.org', ses: 'include:amazonses.com', mailchimp: 'include:servers.mcsv.net', zoho: 'include:zoho.com' };
    var KNOWN = { '_spf.google.com': 'Google Workspace / Gmail', 'spf.protection.outlook.com': 'Microsoft 365', 'sendgrid.net': 'SendGrid', 'mailgun.org': 'Mailgun', 'amazonses.com': 'Amazon SES', 'servers.mcsv.net': 'Mailchimp', 'zoho.com': 'Zoho Mail' };
    var text;
    if (o.mode === 'build') {
      var terms = String(v.sources || '').split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!terms.length) throw new Error(t('발신 출처를 한 줄 이상 입력하세요', 'Enter at least one sending source'));
      terms = terms.map(function (s) {
        var k = s.toLowerCase(); if (SHORT[k]) return SHORT[k];
        if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(s)) return 'ip4:' + s;
        if (/^[0-9a-f:]+:[0-9a-f:]*(\/\d{1,3})?$/i.test(s) && s.indexOf(':') >= 0 && !/^[a-z]+:/i.test(s)) return 'ip6:' + s;
        return s;
      });
      text = 'v=spf1 ' + terms.join(' ') + ' ' + o.all;
    } else {
      text = String(v.record || '').trim().replace(/^"|"$/g, '').replace(/"\s*"/g, '');
      if (!text) throw new Error(t('SPF 레코드를 입력하세요', 'Enter an SPF record'));
    }
    var parts = text.split(/\s+/).filter(Boolean), issues = [], rows = [], lookups = 0, allIdx = -1, allCount = 0, hasRedirect = false, seen = {}, ok = true;
    if (parts[0].toLowerCase() !== 'v=spf1') { issues.push(t('🚨 레코드는 반드시 v=spf1 로 시작해야 합니다', '🚨 The record must start with v=spf1')); ok = false; }
    var QN = { '+': ['Pass', '허용'], '-': ['Fail', '거부'], '~': ['SoftFail', '소프트페일'], '?': ['Neutral', '중립'] };
    parts.slice(1).forEach(function (p, idx) {
      var m = /^([+\-~?])?([a-zA-Z0-9]+)(?:([:=])(.*))?$/.exec(p), q, name, val, meaning = '', lk = 0;
      if (!m) { issues.push(t('해석할 수 없는 항목: ' + p, 'Cannot parse term: ' + p)); rows.push([p, '', t('오류', 'Error'), '']); ok = false; return; }
      q = m[1] || '+'; name = m[2].toLowerCase(); val = m[4] || '';
      var lq = QN[q], qs = t(lq[1], lq[0]), cidr = '';
      if (seen[p.toLowerCase()]) issues.push(t('중복된 항목: ' + p, 'Duplicate term: ' + p)); seen[p.toLowerCase()] = 1;
      if (m[3] === '=') {
        if (name === 'redirect') { hasRedirect = true; lk = 1; meaning = t('이 도메인의 SPF 정책을 ' + val + ' 로 위임', 'Delegates the SPF policy to ' + val); if (!val) issues.push(t('redirect= 값이 비었습니다', 'redirect= has no value')); }
        else if (name === 'exp') meaning = t('거부 사유 설명 TXT 도메인', 'Domain of the failure-explanation TXT');
        else { issues.push(t('알 수 없는 modifier: ' + p, 'Unknown modifier: ' + p)); meaning = t('알 수 없음', 'Unknown'); }
        rows.push([p, '—', meaning, String(lk)]); lookups += lk; return;
      }
      if (name === 'all') {
        allCount++; if (allIdx < 0) allIdx = idx;
        meaning = q === '-' ? t('위에 나열되지 않은 모든 서버의 메일을 거부', 'Rejects mail from every server not listed above') : q === '~' ? t('나열되지 않은 서버는 의심(스팸 처리) — 전환 기간용', 'Marks unlisted servers as suspicious — transition period') : q === '?' ? t('나열되지 않은 서버에 판단 없음 — 보호 효과 없음', 'No verdict for unlisted servers — no protection') : t('🚨 모든 서버의 발송을 허용', '🚨 Allows every server to send');
        if (q === '+') issues.push(t('🚨 +all(또는 all)은 누구나 이 도메인으로 발송할 수 있게 합니다 — 즉시 수정하세요', '🚨 +all (or bare all) lets anyone send as this domain — fix immediately'));
        else if (q === '?') issues.push(t('?all 은 SPF 보호를 사실상 끕니다 — ~all 또는 -all 을 쓰세요', '?all effectively disables SPF protection — use ~all or -all'));
        else if (q === '~') issues.push(t('~all 은 전환 기간용입니다. DMARC 적용 후 -all 로 올리는 것을 권장합니다', '~all is for a transition period — move to -all once DMARC is enforced'));
        if (idx < parts.length - 2) issues.push(t('all 뒤에 오는 항목은 평가되지 않습니다', 'Terms after all are never evaluated'));
      } else if (name === 'include') {
        lk = 1; if (!val) { issues.push(t('include: 값이 비었습니다', 'include: has no value')); ok = false; }
        meaning = t(val + ' 의 SPF 정책을 포함' + (KNOWN[val.toLowerCase()] ? ' (' + KNOWN[val.toLowerCase()] + ')' : ''), 'Includes the SPF policy of ' + val + (KNOWN[val.toLowerCase()] ? ' (' + KNOWN[val.toLowerCase()] + ')' : ''));
        if (q !== '+') issues.push(t('include 앞에 한정자(' + q + ')를 붙이는 것은 드문 설정입니다', 'A qualifier (' + q + ') on include is unusual'));
      } else if (name === 'a' || name === 'mx') {
        lk = 1; var vm = /^([^/]*)(\/(\d{1,2}))?(\/\/(\d{1,3}))?$/.exec(val); if (vm) { cidr = (vm[2] || '') + (vm[4] || ''); val = vm[1]; }
        var who = val ? val + ' 의' : '이 도메인의';
        meaning = name === 'a' ? t(who + ' A/AAAA 주소가 발신 서버', 'The A/AAAA addresses of ' + (val || 'this domain') + ' may send') : t(who + ' MX 서버가 발신 서버', 'The MX hosts of ' + (val || 'this domain') + ' may send');
        if (name === 'mx') issues.push(t('mx 는 MX 호스트별로 추가 주소 조회(최대 10개)를 일으킵니다', 'mx triggers extra address lookups per MX host (up to 10)'));
        if (cidr) meaning += ' ' + cidr;
      } else if (name === 'ptr') {
        lk = 1; meaning = t('역방향 DNS 로 검증 (RFC 7208이 사용 금지 권고)', 'Validates via reverse DNS (discouraged by RFC 7208)'); issues.push(t('ptr 은 느리고 신뢰도가 낮아 사용하지 않는 것이 좋습니다 (RFC 7208 §5.5)', 'ptr is slow and unreliable — avoid it (RFC 7208 §5.5)'));
      } else if (name === 'exists') { lk = 1; meaning = t(val + ' 의 A 레코드가 있으면 일치', 'Matches if an A record exists for ' + val); }
      else if (name === 'ip4' || name === 'ip6') {
        var c = N.parseCIDR(val), want = name === 'ip4' ? 4 : 6;
        if (!c || /\s/.test(val)) { issues.push(t('올바르지 않은 ' + name + ' 값: ' + val, 'Invalid ' + name + ' value: ' + val)); meaning = t('오류', 'Error'); ok = false; }
        else if (c.v !== want) { issues.push(t(name + ' 에 ' + (c.v === 4 ? 'IPv4' : 'IPv6') + ' 주소가 들어 있습니다: ' + val, name + ' holds an ' + (c.v === 4 ? 'IPv4' : 'IPv6') + ' address: ' + val)); meaning = t('오류', 'Error'); ok = false; }
        else {
          var cnt = c.end - c.start + 1n, cs = c.v === 6 && c.prefix < 96 ? '2^' + (128 - c.prefix) : N.big(cnt); meaning = t(val + ' 대역에서 발송 허용 (' + cs + '개 주소)', 'Sending allowed from ' + val + ' (' + cs + ' addresses)');
          if (c.prefix === 0) issues.push(t('🚨 ' + val + ' 는 전 세계 모든 주소를 허용합니다', '🚨 ' + val + ' allows the entire internet'));
          else if (name === 'ip4' && c.prefix < 16) issues.push(t(val + ' 는 매우 넓은 대역입니다 (/' + c.prefix + ')', val + ' is a very wide range (/' + c.prefix + ')'));
          if (val.indexOf('/') > 0 && c.n !== c.start) issues.push(t(val + ': 네트워크 주소가 아닌 값이 있습니다 (정규화: ' + N.fmt(c.v, c.start) + '/' + c.prefix + ')', val + ': host bits are set (normalised: ' + N.fmt(c.v, c.start) + '/' + c.prefix + ')'));
        }
      } else { issues.push(t('알 수 없는 메커니즘: ' + p, 'Unknown mechanism: ' + p)); meaning = t('알 수 없음', 'Unknown'); ok = false; }
      lookups += lk;
      rows.push([p, name === 'all' || name === 'ptr' || name === 'exists' || name === 'a' || name === 'mx' || name === 'include' || name === 'ip4' || name === 'ip6' ? qs : '', meaning, String(lk)]);
    });
    if (allCount > 1) issues.push(t('all 이 여러 개 있습니다', 'There is more than one all'));
    if (hasRedirect && allCount) issues.push(t('all 이 있으면 redirect= 는 무시됩니다 (RFC 7208 §6.1)', 'redirect= is ignored when an all mechanism is present (RFC 7208 §6.1)'));
    if (!allCount && !hasRedirect) issues.push(t('종결 항목(-all/~all 또는 redirect=)이 없어 기본값이 중립(?all)이 됩니다', 'No terminator (-all/~all or redirect=) — the default result is neutral'));
    if (lookups > 10) { issues.unshift(t('🚨 DNS 조회가 ' + lookups + '회로 한도(10회)를 넘습니다 → PermError, SPF가 실패합니다', '🚨 ' + lookups + ' DNS lookups exceed the limit of 10 → PermError and SPF fails')); ok = false; }
    else if (lookups >= 8) issues.push(t('DNS 조회가 ' + lookups + '/10 입니다. include 안의 조회도 합산되므로 한도에 가깝습니다', lookups + '/10 DNS lookups — nested includes also count, so you are close to the limit'));
    if (text.length > 255) issues.push(t('레코드가 ' + text.length + '자입니다. TXT 문자열 하나는 255자 제한이라 여러 개의 따옴표 문자열로 나눠야 합니다 (아래 DNS 값 참고)', 'The record is ' + text.length + ' chars. One TXT string is limited to 255, so split it into several quoted strings (see the DNS value below)'));
    if (text.length > 450) issues.push(t('450바이트를 넘으면 UDP 응답이 잘려 TCP 재시도가 생길 수 있습니다', 'Over ~450 bytes the DNS answer may be truncated and retried over TCP'));
    issues.push(t('include 로 포함된 정책 내부의 조회 횟수와 실제 DNS 값은 이 도구가 확인하지 않습니다 (브라우저에서 DNS 를 읽지 않음)', 'Lookups nested inside included policies and live DNS are not checked by this tool'));
    var dnsVal = text.length > 255 ? text.match(/.{1,255}/g).map(function (s) { return '"' + s + '"'; }).join(' ') : '"' + text + '"';
    var dom = (o.domain || 'example.com').trim() || 'example.com';
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('🚨 심각한 문제 ' + bad + '건 — 아래 점검 사항을 확인하세요', '🚨 ' + bad + ' serious issue(s) — see the findings') } : ok ? (o.mode === 'build' ? t('✅ SPF 레코드를 만들었습니다 (DNS 조회 ' + lookups + '/10)', '✅ SPF record built (' + lookups + '/10 DNS lookups)') : t('✅ 구문 오류가 없습니다 (DNS 조회 ' + lookups + '/10)', '✅ No syntax errors (' + lookups + '/10 DNS lookups)')) : { ok: false, msg: t('❌ 구문 오류가 있습니다', '❌ Syntax errors found') },
      out: text + '\n\n' + dom + '.  IN  TXT  ' + dnsVal, table: { head: [['항목', 'Term'], ['한정자', 'Qualifier'], ['의미', 'Meaning'], ['DNS 조회', 'Lookups']], rows: rows }, issues: issues };
  }
});
