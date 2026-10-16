TK.tool('dmarc-builder', {
  allowEmpty: true,
  inputs: [
    { id: 'record', label: ['검사할 DMARC 레코드', 'DMARC record to check'], rows: 4, sample: 'v=DMARC1; p=none; rua=mailto:dmarc@example.com; pct=50; adkim=r', show: function (o) { return o.mode === 'check'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['build', ['DMARC 레코드 만들기', 'Build a DMARC record']], ['check', ['기존 레코드 분석', 'Analyse a record']]], default: 'build' },
    { id: 'domain', type: 'text', label: ['도메인', 'Domain'], default: 'example.com' },
    { id: 'p', type: 'select', label: ['정책 (p)', 'Policy (p)'], choices: [['none', ['none — 모니터링만', 'none — monitor only']], ['quarantine', ['quarantine — 스팸함으로', 'quarantine — send to spam']], ['reject', ['reject — 수신 거부', 'reject — refuse']]], default: 'none', show: function (o) { return o.mode === 'build'; } },
    { id: 'sp', type: 'select', label: ['하위 도메인 정책 (sp)', 'Subdomain policy (sp)'], choices: [['', ['p 와 동일 (생략)', 'Same as p (omit)']], ['none', 'none'], ['quarantine', 'quarantine'], ['reject', 'reject']], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'pct', type: 'number', label: ['적용 비율 (pct, %)', 'Percentage applied (pct, %)'], default: 100, min: 0, max: 100, show: function (o) { return o.mode === 'build'; } },
    { id: 'rua', type: 'text', label: ['집계 보고서 수신 (rua, 쉼표 구분)', 'Aggregate reports to (rua, comma separated)'], default: 'dmarc@example.com', show: function (o) { return o.mode === 'build'; } },
    { id: 'ruf', type: 'text', label: ['실패 보고서 수신 (ruf, 선택)', 'Forensic reports to (ruf, optional)'], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'adkim', type: 'select', label: ['DKIM 정렬 (adkim)', 'DKIM alignment (adkim)'], choices: [['r', ['relaxed (기본)', 'relaxed (default)']], ['s', 'strict']], default: 'r', show: function (o) { return o.mode === 'build'; } },
    { id: 'aspf', type: 'select', label: ['SPF 정렬 (aspf)', 'SPF alignment (aspf)'], choices: [['r', ['relaxed (기본)', 'relaxed (default)']], ['s', 'strict']], default: 'r', show: function (o) { return o.mode === 'build'; } },
    { id: 'fo', type: 'select', label: ['실패 보고 조건 (fo)', 'Failure reporting (fo)'], choices: [['', ['생략 (0)', 'Omit (0)']], ['1', ['1 — 하나라도 실패', '1 — any failure']], ['d', 'd — DKIM'], ['s', 'S — SPF']], default: '', show: function (o) { return o.mode === 'build'; } },
    { id: 'ri', type: 'number', label: ['보고 주기 (ri, 초 / 0=기본 86400)', 'Report interval (ri, seconds / 0 = default 86400)'], default: 0, min: 0, show: function (o) { return o.mode === 'build'; } }
  ],
  outputs: [{ id: 'out', label: ['DMARC TXT 값', 'DMARC TXT value'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['태그 해석', 'Tag breakdown'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var dom = (o.domain || '').trim().toLowerCase() || 'example.com', tags = [], text, issues = [], ok = true;
    function mails(s) { return String(s || '').split(/[,;\s]+/).filter(Boolean).map(function (x) { return /^mailto:/i.test(x) ? x : 'mailto:' + x; }); }
    if (o.mode === 'build') {
      tags.push(['v', 'DMARC1'], ['p', o.p]);
      if (o.sp) tags.push(['sp', o.sp]);
      var pct = Math.round(o.pct); if (isNaN(pct) || pct < 0 || pct > 100) throw new Error(t('pct 는 0~100 이어야 합니다', 'pct must be between 0 and 100'));
      if (pct !== 100) tags.push(['pct', String(pct)]);
      var rua = mails(o.rua), ruf = mails(o.ruf);
      if (rua.length) tags.push(['rua', rua.join(',')]);
      if (ruf.length) tags.push(['ruf', ruf.join(',')]);
      if (o.adkim === 's') tags.push(['adkim', 's']);
      if (o.aspf === 's') tags.push(['aspf', 's']);
      if (o.fo) tags.push(['fo', o.fo]);
      if (o.ri > 0 && o.ri !== 86400) tags.push(['ri', String(Math.round(o.ri))]);
      text = tags.map(function (x) { return x[0] + '=' + x[1]; }).join('; ');
    } else {
      text = String(v.record || '').trim().replace(/^"|"$/g, '').replace(/"\s*"/g, '');
      if (!text) throw new Error(t('DMARC 레코드를 입력하세요', 'Enter a DMARC record'));
      text.split(';').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (s) {
        var i = s.indexOf('='); if (i < 1) { issues.push(t('태그 형식이 아닙니다: ' + s, 'Not a tag=value pair: ' + s)); ok = false; return; }
        tags.push([s.slice(0, i).trim().toLowerCase(), s.slice(i + 1).trim()]);
      });
    }
    var T = {}; tags.forEach(function (x) { if (T[x[0]] !== undefined) issues.push(t('태그가 중복되었습니다: ' + x[0], 'Duplicate tag: ' + x[0])); T[x[0]] = x[1]; });
    if (!tags.length || tags[0][0] !== 'v' || tags[0][1].toUpperCase() !== 'DMARC1') { issues.push(t('🚨 첫 태그는 v=DMARC1 이어야 합니다', '🚨 The first tag must be v=DMARC1')); ok = false; }
    if (!T.p) { issues.push(t('🚨 p(정책) 태그가 없습니다 — 필수입니다', '🚨 The p (policy) tag is missing — it is required')); ok = false; }
    else if (tags[1] && tags[1][0] !== 'p' && tags[0][0] === 'v') issues.push(t('p 는 v 바로 다음에 오는 것이 규격입니다', 'p should immediately follow v per the spec'));
    var POL = ['none', 'quarantine', 'reject'];
    ['p', 'sp'].forEach(function (k) { if (T[k] !== undefined && POL.indexOf(T[k].toLowerCase()) < 0) { issues.push(t(k + ' 값이 올바르지 않습니다: ' + T[k] + ' (none / quarantine / reject)', 'Invalid ' + k + ' value: ' + T[k] + ' (none / quarantine / reject)')); ok = false; } });
    ['adkim', 'aspf'].forEach(function (k) { if (T[k] !== undefined && !/^[rs]$/i.test(T[k])) { issues.push(t(k + ' 는 r 또는 s 여야 합니다', k + ' must be r or s')); ok = false; } });
    if (T.pct !== undefined && !(/^\d+$/.test(T.pct) && +T.pct <= 100)) { issues.push(t('pct 는 0~100 정수여야 합니다', 'pct must be an integer from 0 to 100')); ok = false; }
    if (T.ri !== undefined && !/^\d+$/.test(T.ri)) { issues.push(t('ri 는 정수(초)여야 합니다', 'ri must be an integer number of seconds')); ok = false; }
    if (T.fo !== undefined && !/^[01ds](:[01ds])*$/i.test(T.fo)) { issues.push(t('fo 는 0, 1, d, s 를 : 로 이은 값이어야 합니다', 'fo must be 0, 1, d, s joined with :')); ok = false; }
    ['rua', 'ruf'].forEach(function (k) {
      if (T[k] === undefined) return;
      T[k].split(',').forEach(function (u) {
        u = u.trim(); var m = /^mailto:([^!]+)(!\d+[kmgt]?)?$/i.exec(u);
        if (!m) { issues.push(t(k + ' 는 mailto:주소 형식이어야 합니다: ' + u, k + ' must be a mailto: URI: ' + u)); ok = false; return; }
        var addr = m[1], d = (addr.split('@')[1] || '').toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { issues.push(t(k + ' 주소가 올바르지 않습니다: ' + addr, k + ' address is invalid: ' + addr)); ok = false; }
        else if (d && d !== dom && !(dom.endsWith('.' + d) || d.endsWith('.' + dom))) issues.push(t(k + ' 수신 주소가 다른 도메인(' + d + ')입니다 — 그 도메인에 ' + dom + '._report._dmarc.' + d + ' TXT(v=DMARC1) 승인 레코드가 있어야 보고서가 도착합니다', k + ' goes to another domain (' + d + ') — that domain must publish ' + dom + '._report._dmarc.' + d + ' TXT (v=DMARC1) to authorise it'));
      });
    });
    var p = (T.p || '').toLowerCase(), pct2 = T.pct !== undefined ? +T.pct : 100;
    if (p === 'none') issues.push(t('p=none 은 모니터링 단계입니다 — 보고서를 확인한 뒤 quarantine → reject 로 올리세요', 'p=none is monitoring only — raise to quarantine → reject after reviewing reports'));
    if (p === 'none' && T.pct !== undefined && pct2 < 100) issues.push(t('p=none 에서는 pct 가 의미가 없습니다', 'pct has no effect when p=none'));
    if (p && p !== 'none' && pct2 < 100) issues.push(t('pct=' + pct2 + ' — 정책이 메일의 ' + pct2 + '%에만 적용되고 나머지는 한 단계 낮은 정책으로 처리됩니다', 'pct=' + pct2 + ' — the policy applies to only ' + pct2 + '% of mail; the rest gets the next-lower policy'));
    if (!T.rua) issues.push(t('rua 가 없어 집계 보고서를 받을 수 없습니다 — 모니터링에는 필수입니다', 'No rua — you will receive no aggregate reports, which are essential for monitoring'));
    if (T.ruf !== undefined) issues.push(t('ruf(실패 보고서)는 대부분의 수신 서버가 보내지 않으며 개인정보를 포함할 수 있습니다', 'ruf (forensic reports) are sent by few receivers and may contain personal data'));
    if (T.sp && p && POL.indexOf(T.sp.toLowerCase()) > POL.indexOf(p) ) issues.push(t('sp 가 p 보다 엄격합니다 — 의도한 설정인지 확인하세요', 'sp is stricter than p — confirm that is intended'));
    var KNOWN = { v: ['버전', 'Version'], p: ['도메인 정책', 'Domain policy'], sp: ['하위 도메인 정책', 'Subdomain policy'], pct: ['정책 적용 비율(%)', 'Percentage of mail the policy applies to'], rua: ['집계 보고서 수신처', 'Aggregate report destinations'], ruf: ['실패(포렌식) 보고서 수신처', 'Forensic report destinations'], adkim: ['DKIM 정렬 (r=relaxed, s=strict)', 'DKIM alignment (r = relaxed, s = strict)'], aspf: ['SPF 정렬 (r=relaxed, s=strict)', 'SPF alignment (r = relaxed, s = strict)'], fo: ['실패 보고 조건', 'Failure reporting options'], ri: ['보고 간격(초)', 'Reporting interval (seconds)'], rf: ['보고서 형식', 'Report format'] };
    var rows = tags.map(function (x) { var k = KNOWN[x[0]]; if (!k) issues.push(t('알 수 없는 태그: ' + x[0], 'Unknown tag: ' + x[0])); return [x[0], x[1], k ? t(k[0], k[1]) : t('알 수 없음', 'Unknown')]; });
    var effSp = (T.sp || T.p || '').toLowerCase();
    var plan = [['1', 'p=none; rua=…', t('2~4주 보고서 수집, 정상 발신원 파악·SPF/DKIM 정렬', '2–4 weeks of reports; identify senders and fix SPF/DKIM alignment')], ['2', 'p=quarantine; pct=10', t('10%만 스팸 처리 — 문제 없는지 관찰', 'Quarantine 10% — watch for problems')], ['3', 'p=quarantine; pct=100', t('전체 스팸 처리', 'Quarantine everything')], ['4', 'p=reject; pct=25 → 100', t('단계적으로 거부', 'Reject gradually up to 100%')]];
    rows.push([t('실제 적용 — ' + dom, 'Effective — ' + dom), p || '—', t('이 도메인 메일에 적용', 'Applies to mail from this domain')], [t('실제 적용 — *.' + dom, 'Effective — *.' + dom), effSp || '—', T.sp ? t('sp 로 별도 지정', 'Set separately via sp') : t('sp 가 없어 p 를 상속', 'No sp, so p is inherited')]);
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    var host = '_dmarc.' + dom;
    return { _status: bad || !ok ? { ok: false, msg: t('❌ 오류 ' + (bad || 1) + '건 이상 — 점검 사항을 확인하세요', '❌ Errors found — see the findings') } : t('✅ DMARC 레코드 ' + (o.mode === 'build' ? '생성 완료' : '구문이 올바릅니다') + ' (' + host + ')', '✅ DMARC record ' + (o.mode === 'build' ? 'built' : 'is valid') + ' (' + host + ')'),
      out: text + '\n\n' + host + '.  IN  TXT  "' + text + '"', table: { head: [['태그', 'Tag'], ['값', 'Value'], ['의미', 'Meaning']], rows: rows }, issues: issues.concat(o.mode === 'build' && p === 'none' ? [t('권장 도입 순서: ' + plan.map(function (s) { return s[0] + ') ' + s[1]; }).join(' → '), 'Suggested rollout: ' + plan.map(function (s) { return s[0] + ') ' + s[1]; }).join(' → '))] : []) };
  }
});
