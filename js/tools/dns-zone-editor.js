TK.tool('dns-zone-editor', {
  inputs: [{ id: 'in', label: ['BIND 존 파일', 'BIND zone file'], rows: 16, tabIndent: true,
    sample: '$ORIGIN example.com.\n$TTL 3600\n@   IN SOA ns1.example.com. admin.example.com. (\n        2026101601 ; serial\n        7200       ; refresh\n        3600       ; retry\n        1209600    ; expire\n        3600 )     ; minimum\n    IN NS  ns1.example.com.\n    IN NS  ns2.example.com.\n    IN MX  10 mail.example.com.\n@   IN A   203.0.113.10\nwww IN CNAME @\nmail IN A  203.0.113.20\n@   IN TXT "v=spf1 mx -all"\nftp IN CNAME www.example.com' }],
  options: [
    { id: 'bump', type: 'select', label: ['SOA serial', 'SOA serial'], choices: [['keep', ['그대로', 'Keep']], ['inc', ['+1 증가', 'Increment by 1']], ['date', ['오늘 날짜(YYYYMMDDnn)로 갱신', 'Set to today (YYYYMMDDnn)']]], default: 'keep' },
    { id: 'addtype', type: 'select', label: ['레코드 추가 — 종류', 'Add record — type'], choices: [['', ['(추가 안 함)', '(none)']], ['A', 'A'], ['AAAA', 'AAAA'], ['CNAME', 'CNAME'], ['MX', 'MX'], ['TXT', 'TXT'], ['NS', 'NS'], ['SRV', 'SRV'], ['CAA', 'CAA'], ['PTR', 'PTR']], default: '' },
    { id: 'addname', type: 'text', label: ['이름 (@ = 루트)', 'Name (@ = apex)'], default: '@', show: function (o) { return !!o.addtype; } },
    { id: 'addvalue', type: 'text', label: ['값 (MX는 "10 mail.example.com.")', 'Value (MX: "10 mail.example.com.")'], default: '', show: function (o) { return !!o.addtype; } },
    { id: 'addttl', type: 'text', label: ['TTL (비우면 기본)', 'TTL (empty = default)'], default: '', show: function (o) { return !!o.addtype; } }
  ],
  outputs: [{ id: 'out', label: ['정리된 존 파일', 'Formatted zone file'], kind: 'code', ext: 'zone' }, { id: 'table', label: ['레코드 목록', 'Records'], kind: 'table' }, { id: 'issues', label: ['검사 결과', 'Checks'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.net, TYPES = 'A AAAA CNAME MX NS TXT SOA SRV CAA PTR DS DNSKEY TLSA SPF NAPTR HTTPS SVCB SSHFP'.split(' ');
    // 1) 괄호 이어붙이기 + 주석 제거
    var src = String(v.in).replace(/\r\n?/g, '\n').split('\n'), logical = [], buf = null, depth = 0;
    src.forEach(function (raw, idx) {
      var line = '', inq = false;
      for (var i = 0; i < raw.length; i++) { var c = raw[i]; if (c === '"') inq = !inq; if (c === ';' && !inq) break; line += c; }
      var startsIndented = /^\s/.test(raw) && depth === 0;
      var opens = (line.match(/\(/g) || []).length, closes = (line.match(/\)/g) || []).length;
      if (buf === null) { if (!line.trim()) return; buf = { text: line.replace(/[()]/g, ' '), lineNo: idx + 1, indented: startsIndented }; depth = opens - closes; }
      else { buf.text += ' ' + line.replace(/[()]/g, ' '); depth += opens - closes; }
      if (depth <= 0) { logical.push(buf); buf = null; depth = 0; }
    });
    if (buf) logical.push(buf);
    var origin = '', ttlDef = null, lastName = '@', recs = [], issues = [];
    function absName(n) { if (n === '@') return origin || '@'; if (/\.$/.test(n)) return n; return origin ? n + '.' + origin : n; }
    function ttlSec(s) { var m = /^(\d+)([smhdw]?)$/i.exec(s); if (!m) return null; return +m[1] * ({ '': 1, s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2].toLowerCase()]); }
    function tokens(s) { var out = [], re = /"((?:[^"\\]|\\.)*)"|(\S+)/g, m; while ((m = re.exec(s))) out.push(m[1] !== undefined ? { q: true, v: m[1] } : { v: m[2] }); return out; }
    logical.forEach(function (L) {
      var tk = tokens(L.text);
      if (!tk.length) return;
      if (/^\$/.test(tk[0].v)) {
        var d = tk[0].v.toUpperCase();
        if (d === '$ORIGIN') { origin = tk[1] ? tk[1].v : ''; if (!/\.$/.test(origin)) issues.push(t('줄 ' + L.lineNo + ': $ORIGIN은 점(.)으로 끝나야 합니다', 'Line ' + L.lineNo + ': $ORIGIN should end with a dot')); }
        else if (d === '$TTL') { ttlDef = tk[1] ? tk[1].v : null; if (ttlSec(ttlDef) === null) issues.push(t('줄 ' + L.lineNo + ': $TTL 값이 올바르지 않습니다', 'Line ' + L.lineNo + ': invalid $TTL')); }
        else if (d === '$INCLUDE' || d === '$GENERATE') issues.push(t('줄 ' + L.lineNo + ': ' + d + ' 지시자는 해석하지 않고 건너뜁니다', 'Line ' + L.lineNo + ': ' + d + ' directive is skipped'));
        return;
      }
      var i = 0, name;
      if (L.indented) name = lastName; else { name = tk[0].v; i = 1; }
      var ttl = null, cls = 'IN';
      while (i < tk.length) {
        var w = tk[i].v;
        if (ttlSec(w) !== null && /^\d/.test(w) && ttl === null && TYPES.indexOf(w.toUpperCase()) < 0) { ttl = w; i++; continue; }
        if (/^(IN|CH|HS)$/i.test(w)) { cls = w.toUpperCase(); i++; continue; }
        break;
      }
      if (i >= tk.length) { issues.push(t('줄 ' + L.lineNo + ': 레코드 종류가 없습니다', 'Line ' + L.lineNo + ': missing record type')); return; }
      var type = tk[i].v.toUpperCase(), rd = tk.slice(i + 1);
      if (TYPES.indexOf(type) < 0 && !/^TYPE\d+$/.test(type)) issues.push(t('줄 ' + L.lineNo + ': 알 수 없는 레코드 종류 ' + type, 'Line ' + L.lineNo + ': unknown record type ' + type));
      lastName = name;
      recs.push({ name: name, ttl: ttl, cls: cls, type: type, rd: rd, line: L.lineNo, text: rd.map(function (x) { return x.q ? '"' + x.v + '"' : x.v; }).join(' ') });
    });
    // 2) 추가할 레코드
    if (o.addtype) {
      var val = String(o.addvalue || '').trim();
      if (!val) throw new Error(t('추가할 레코드의 값을 입력하세요', 'Enter a value for the record you want to add'));
      var rdt = tokens(o.addtype === 'TXT' && !/^"/.test(val) ? '"' + val.replace(/"/g, '\\"') + '"' : val);
      recs.push({ name: (o.addname || '@').trim() || '@', ttl: (o.addttl || '').trim() || null, cls: 'IN', type: o.addtype, rd: rdt, line: 0, text: rdt.map(function (x) { return x.q ? '"' + x.v + '"' : x.v; }).join(' '), added: true });
    }
    // 3) SOA serial
    var soa = recs.filter(function (r) { return r.type === 'SOA'; })[0];
    if (soa && o.bump !== 'keep' && soa.rd.length >= 3) {
      var cur = soa.rd[2].v, next;
      if (o.bump === 'inc') next = String(+cur + 1);
      else { var d = new Date(), base = '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); next = (String(cur).slice(0, 8) === base) ? String(+cur + 1) : base + '01'; }
      soa.rd[2] = { v: next }; soa.text = soa.rd.map(function (x) { return x.v; }).join(' ');
    }
    // 4) 검사
    var byName = {};
    recs.forEach(function (r) { var key = absName(r.name).toLowerCase(); (byName[key] = byName[key] || []).push(r); });
    if (!soa) issues.push(t('SOA 레코드가 없습니다', 'No SOA record'));
    if (recs.filter(function (r) { return r.type === 'SOA'; }).length > 1) issues.push(t('SOA 레코드가 둘 이상입니다', 'More than one SOA record'));
    if (!recs.some(function (r) { return r.type === 'NS' && (r.name === '@' || absName(r.name) === origin); })) issues.push(t('루트(@)에 NS 레코드가 없습니다', 'No NS record at the apex'));
    Object.keys(byName).forEach(function (k) {
      var list = byName[k], types = list.map(function (r) { return r.type; });
      if (types.indexOf('CNAME') >= 0 && list.length > 1) issues.push(t(k + ': CNAME은 같은 이름의 다른 레코드와 공존할 수 없습니다', k + ': a CNAME cannot coexist with other records'));
      if (types.filter(function (x) { return x === 'CNAME'; }).length > 1) issues.push(t(k + ': CNAME이 둘 이상입니다', k + ': multiple CNAME records'));
      if (origin && k === origin.toLowerCase() && types.indexOf('CNAME') >= 0) issues.push(t('루트(@)에 CNAME을 둘 수 없습니다 (ALIAS/ANAME 또는 A 사용)', 'A CNAME at the apex is not allowed (use A or ALIAS/ANAME)'));
    });
    recs.forEach(function (r) {
      var where = r.line ? t('줄 ' + r.line, 'Line ' + r.line) : t('추가한 레코드', 'Added record'), a = r.rd[0] && r.rd[0].v;
      if (r.ttl !== null && ttlSec(r.ttl) === null) issues.push(where + ': ' + t('TTL 형식 오류 ' + r.ttl, 'invalid TTL ' + r.ttl));
      if (r.type === 'A' && !(a && N.parseIPv4(a) !== null)) issues.push(where + ': ' + t('A 레코드 값이 IPv4 주소가 아닙니다 (' + (a || '') + ')', 'A record value is not an IPv4 address (' + (a || '') + ')'));
      if (r.type === 'AAAA' && !(a && N.parseIPv6(a) !== null)) issues.push(where + ': ' + t('AAAA 레코드 값이 IPv6 주소가 아닙니다 (' + (a || '') + ')', 'AAAA record value is not an IPv6 address (' + (a || '') + ')'));
      if (r.type === 'MX') { if (!/^\d+$/.test(a || '') || !r.rd[1]) issues.push(where + ': ' + t('MX는 "우선순위 호스트" 형식이어야 합니다', 'MX needs "priority host"')); }
      var target = r.type === 'CNAME' || r.type === 'NS' || r.type === 'PTR' ? a : r.type === 'MX' ? (r.rd[1] && r.rd[1].v) : null;
      if (target && target !== '@' && !/\.$/.test(target) && /\.[a-z]{2,}$/i.test(target)) issues.push(where + ': ' + t('"' + target + '"은 점(.)으로 끝나지 않아 도메인이 덧붙습니다 (' + target + '.' + (origin || '<origin>') + '). 완전한 이름이라면 끝에 .을 붙이세요', '"' + target + '" has no trailing dot, so the origin is appended (' + target + '.' + (origin || '<origin>') + ') — add a dot if it is fully qualified'));
      if (r.type === 'TXT' && r.rd.some(function (x) { return x.v.length > 255; })) issues.push(where + ': ' + t('TXT 문자열이 255바이트를 넘습니다 (여러 문자열로 나누세요)', 'A TXT string exceeds 255 bytes (split it into several strings)'));
    });
    // 5) 출력
    var out = [];
    if (origin) out.push('$ORIGIN ' + origin);
    if (ttlDef) out.push('$TTL ' + ttlDef);
    var wName = Math.min(28, Math.max.apply(null, [4].concat(recs.map(function (r) { return r.name.length; }))));
    var prevName = null;
    recs.forEach(function (r) {
      var nm = r.name; prevName = r.name;
      var body = r.type === 'SOA' && r.rd.length >= 7 ? r.rd[0].v + ' ' + r.rd[1].v + ' (\n' + ['serial', 'refresh', 'retry', 'expire', 'minimum'].map(function (lab, k) { return '        ' + r.rd[2 + k].v + ' ' + (k === 0 ? '; ' : '; ') + lab; }).join('\n') + '\n        )' : r.text;
      out.push((nm || '').padEnd(wName) + ' ' + (r.ttl || '').padEnd(6) + ' ' + r.cls + ' ' + r.type.padEnd(6) + ' ' + body);
    });
    var res = out.join('\n') + '\n';
    return { _status: issues.length ? { ok: 'info', msg: t('⚠️ 레코드 ' + recs.length + '개 — 확인할 항목 ' + issues.length + '개', '⚠️ ' + recs.length + ' records — ' + issues.length + ' item(s) to check') } : t('✅ 레코드 ' + recs.length + '개, 문제 없음', '✅ ' + recs.length + ' records, no problems found'),
      out: res, issues: issues,
      table: { head: [['이름', 'Name'], ['TTL', 'TTL'], ['종류', 'Type'], ['값', 'Value']], rows: recs.map(function (r) { return { cls: r.added ? 'r-add' : '', cells: [r.name, r.ttl || (ttlDef ? '(' + ttlDef + ')' : ''), r.type, r.text] }; }) } };
  }
});
