TK.tool('email-address-tool', {
  allowEmpty: true,
  inputs: [
    { id: 'list', label: ['이메일 주소 (줄바꿈·쉼표·세미콜론으로 구분, "이름 <주소>" 형식 가능)', 'Email addresses (separated by newlines, commas or semicolons; "Name <addr>" allowed)'], rows: 7, sample: 'Kim <kim@example.com>\nlee@exmaple.com; park@gmial.com\nkim@example.com\nbad@@example.com\n"john doe"@example.org\nuser+tag@xn--bcher-kva.example\nsomeone@localhost', show: function (o) { return o.mode === 'validate'; } },
    { id: 'to', type: 'text', label: ['받는 사람 (쉼표 구분)', 'To (comma separated)'], sample: 'team@example.com, boss@example.com', show: function (o) { return o.mode === 'mailto'; } },
    { id: 'cc', type: 'text', label: ['참조 (cc)', 'Cc'], sample: 'manager@example.com', show: function (o) { return o.mode === 'mailto'; } },
    { id: 'bcc', type: 'text', label: ['숨은 참조 (bcc)', 'Bcc'], sample: '', show: function (o) { return o.mode === 'mailto'; } },
    { id: 'subject', type: 'text', label: ['제목', 'Subject'], sample: '문의 드립니다 / Inquiry', show: function (o) { return o.mode === 'mailto'; } },
    { id: 'body', label: ['본문', 'Body'], rows: 4, sample: '안녕하세요,\n견적을 요청드립니다.\n감사합니다.', show: function (o) { return o.mode === 'mailto'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['validate', ['주소 검사·정리', 'Validate & clean up addresses']], ['mailto', ['mailto 링크 만들기', 'Build a mailto link']]], default: 'validate' },
    { id: 'dedupe', type: 'checkbox', label: ['중복 제거', 'Remove duplicates'], default: true, show: function (o) { return o.mode === 'validate'; } },
    { id: 'lower', type: 'checkbox', label: ['도메인 소문자 정규화', 'Lowercase the domain'], default: true, show: function (o) { return o.mode === 'validate'; } }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['주소별 검사', 'Per-address results'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var D = TK.dns, TYPO = { 'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'naver.con': 'naver.com', 'naver.co': 'naver.com', 'nave.com': 'naver.com', 'hotmial.com': 'hotmail.com', 'hotnail.com': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'outlok.com': 'outlook.com', 'exmaple.com': 'example.com', 'daum.com': 'daum.net', 'hanmail.com': 'hanmail.net', 'kakao.con': 'kakao.com' };
    function enc(s) { return encodeURIComponent(s).replace(/%0A/g, '%0D%0A').replace(/\*/g, '%2A'); }
    if (o.mode === 'mailto') {
      function addrs(s) { return String(s || '').split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
      var to = addrs(v.to), cc = addrs(v.cc), bcc = addrs(v.bcc), bad = [];
      if (!to.length && !cc.length && !bcc.length) throw new Error(t('받는 사람을 한 명 이상 입력하세요', 'Enter at least one recipient'));
      to.concat(cc, bcc).forEach(function (a) { if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(a)) bad.push(a); });
      var q = [];
      if (cc.length) q.push('cc=' + cc.map(encodeURIComponent).join(','));
      if (bcc.length) q.push('bcc=' + bcc.map(encodeURIComponent).join(','));
      if (v.subject) q.push('subject=' + enc(v.subject));
      if (v.body) q.push('body=' + enc(String(v.body).replace(/\r\n/g, '\n')));
      var href = 'mailto:' + to.map(function (a) { return encodeURIComponent(a).replace(/%40/g, '@'); }).join(',') + (q.length ? '?' + q.join('&') : '');
      var html = '<a href="' + href.replace(/&/g, '&amp;') + '">' + t('메일 보내기', 'Send email') + '</a>';
      var notes = [];
      if (bad.length) notes.push(t('🚨 형식이 올바르지 않은 주소: ' + bad.join(', '), '🚨 Invalid address format: ' + bad.join(', ')));
      if (href.length > 2000) notes.push(t('링크가 ' + href.length + '자입니다. 2,000자를 넘으면 일부 메일 앱·브라우저에서 잘립니다', 'The link is ' + href.length + ' chars — over ~2,000 some mail apps and browsers truncate it'));
      notes.push(t('본문의 줄바꿈은 %0D%0A 로 인코딩됩니다. 공백은 + 가 아니라 %20 이어야 합니다 (RFC 6068)', 'Line breaks in the body are encoded as %0D%0A and spaces as %20, not + (RFC 6068)'));
      notes.push(t('bcc 는 메일 앱이 처리합니다 — 링크 자체에는 숨은 참조 주소가 그대로 노출됩니다', 'bcc is handled by the mail app — the link itself exposes the bcc address in plain text'));
      notes.push(t('웹페이지에 이메일 주소를 그대로 게시하면 스팸 수집 봇의 표적이 될 수 있습니다', 'Publishing an address in plain HTML can attract spam harvesters'));
      return { _status: bad.length ? { ok: false, msg: t('❌ 형식이 올바르지 않은 주소가 있습니다', '❌ Some addresses are malformed') } : t('✅ mailto 링크를 만들었습니다 (' + href.length + '자)', '✅ mailto link built (' + href.length + ' chars)'), out: href + '\n\n' + html, table: { head: [['부분', 'Part'], ['값', 'Value']], rows: [['to', to.join(', ')], ['cc', cc.join(', ')], ['bcc', bcc.join(', ')], [t('제목', 'subject'), v.subject || ''], [t('본문', 'body'), (v.body || '').replace(/\n/g, ' ⏎ ')]].filter(function (r) { return r[1]; }) }, issues: notes };
    }
    var raw = String(v.list || '').trim();
    if (!raw) throw new Error(t('이메일 주소를 입력하세요', 'Enter some email addresses'));
    // "이름 <주소>" 를 보존하며 구분자로 분리 (따옴표·꺾쇠 안의 쉼표는 유지)
    var items = [], cur = '', inQ = false, inA = false;
    for (var i = 0; i < raw.length; i++) {
      var ch = raw[i];
      if (ch === '"' && raw[i - 1] !== '\\') inQ = !inQ; else if (!inQ && ch === '<') inA = true; else if (!inQ && ch === '>') inA = false;
      if (!inQ && !inA && /[\n,;]/.test(ch)) { if (cur.trim()) items.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) items.push(cur.trim());
    var rows = [], good = [], seen = {}, nBad = 0, nDup = 0, nTypo = 0;
    var ATEXT = /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*$/;
    function withName(name, addr) { if (!name) return addr; return (/[^\w !#$%&'*+\/=?^`{|}~-]/.test(name) ? '"' + name.replace(/(["\\])/g, '\\$1') + '"' : name) + ' <' + addr + '>'; }
    items.forEach(function (it) {
      var name = '', addr = it, m = /^(.*?)\s*<([^<>]*)>\s*$/.exec(it);
      if (m) { name = m[1].replace(/^"|"$/g, '').trim(); addr = m[2].trim(); }
      var problems = [], at = addr.lastIndexOf('@'), local = at > 0 ? addr.slice(0, at) : '', domain = at > 0 ? addr.slice(at + 1) : '';
      if (at < 1) problems.push(t('@ 가 없거나 앞부분이 비었습니다', 'Missing @ or empty local part'));
      else {
        var quoted = /^"(?:[^"\\\r\n]|\\.)*"$/.test(local);
        if (!quoted && !ATEXT.test(local)) problems.push(/\.\./.test(local) ? t('로컬 파트에 연속된 점(..)이 있습니다', 'Consecutive dots (..) in the local part') : /^\.|\.$/.test(local) ? t('로컬 파트가 점(.)으로 시작하거나 끝납니다', 'Local part starts or ends with a dot') : /@/.test(local) ? t('@ 가 두 번 이상 있습니다', 'More than one @') : t('로컬 파트에 허용되지 않는 문자가 있습니다', 'Disallowed characters in the local part'));
        if (local.length > 64) problems.push(t('로컬 파트가 64자를 넘습니다', 'Local part is longer than 64 characters'));
        var ascii = domain; try { ascii = D.toASCII(domain); } catch (e) { problems.push(t('도메인을 변환할 수 없습니다', 'Cannot convert the domain')); }
        var lit = /^\[(.+)\]$/.exec(domain);
        if (lit) { if (!TK.net.parseIP(lit[1].replace(/^IPv6:/i, ''))) problems.push(t('도메인 리터럴이 올바른 IP 가 아닙니다', 'Domain literal is not a valid IP')); }
        else {
          var labels = ascii.split('.');
          if (!domain) problems.push(t('도메인이 비었습니다', 'Empty domain'));
          else if (labels.length < 2) problems.push(t('도메인에 점(.)이 없습니다 — 인터넷 주소가 아닙니다 (localhost 등)', 'No dot in the domain — not an internet address (e.g. localhost)'));
          labels.forEach(function (l) { if (!l) problems.push(t('도메인에 빈 레이블(..)이 있습니다', 'Empty label in the domain')); else if (l.length > 63) problems.push(t('레이블이 63자를 넘습니다', 'A label is longer than 63 characters')); else if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/.test(l)) problems.push(t('레이블 "' + l + '" 에 허용되지 않는 문자/하이픈 위치가 있습니다', 'Label "' + l + '" has disallowed characters or hyphen placement')); });
          if (labels.length >= 2 && /^\d+$/.test(labels[labels.length - 1])) problems.push(t('최상위 도메인이 숫자뿐입니다', 'The TLD is all digits'));
        }
        if (addr.length > 254) problems.push(t('전체 길이가 254자를 넘습니다', 'Total length exceeds 254'));
      }
      var norm = addr, note = '';
      if (!problems.length) {
        norm = o.lower ? local + '@' + domain.toLowerCase() : addr;
        var key = (local + '@' + domain).toLowerCase(), tyd = TYPO[domain.toLowerCase()];
        if (tyd) { note = t('혹시 @' + tyd + ' 아닌가요?', 'Did you mean @' + tyd + '?'); nTypo++; }
        if (/[^\x00-\x7f]/.test(domain)) note += (note ? ' · ' : '') + 'IDN → ' + D.toASCII(domain);
        if (/\+/.test(local) && !/^"/.test(local)) note += (note ? ' · ' : '') + t('+태그 주소 (기본 주소: ' + local.split('+')[0] + '@' + domain.toLowerCase() + ')', '+tag address (base: ' + local.split('+')[0] + '@' + domain.toLowerCase() + ')');
        if (seen[key]) { nDup++; note = t('중복', 'Duplicate') + (note ? ' · ' + note : ''); rows.push([it, o.dedupe ? '♻️' : '✅', norm, note]); if (!o.dedupe) good.push(withName(name, norm)); return; }
        seen[key] = 1; good.push(withName(name, norm));
        rows.push([it, '✅', norm, note || (name ? t('표시 이름: ' + name, 'Display name: ' + name) : '')]);
      } else { nBad++; rows.push([it, '❌', '', problems.join(' · ')]); }
    });
    var issues = [];
    if (nDup) issues.push(t('중복 ' + nDup + '건' + (o.dedupe ? ' 제거됨' : ' (유지됨)'), nDup + ' duplicate(s)' + (o.dedupe ? ' removed' : ' (kept)')));
    if (nTypo) issues.push(t('오타로 의심되는 도메인 ' + nTypo + '건 — 표의 안내를 확인하세요', nTypo + ' possibly mistyped domain(s) — see the notes in the table'));
    issues.push(t('이 검사는 형식만 확인합니다. 실제로 존재하는 메일함인지는 메일을 보내 확인해야 합니다', 'This checks the format only. Whether the mailbox exists can only be confirmed by sending mail'));
    return { _status: nBad ? { ok: 'info', msg: t('🔍 ' + items.length + '개 중 ' + nBad + '개가 올바르지 않습니다', '🔍 ' + nBad + ' of ' + items.length + ' address(es) are invalid') } : t('✅ ' + items.length + '개 주소가 모두 올바른 형식입니다', '✅ All ' + items.length + ' addresses are well-formed'), out: good.join('\n'), table: { head: [['입력', 'Input'], ['상태', 'Status'], ['정규화', 'Normalised'], ['비고', 'Notes']], rows: rows }, issues: issues };
  }
});
