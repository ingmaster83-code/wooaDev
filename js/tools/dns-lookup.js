TK.tool('dns-lookup', {
  noSampleTest: true,
  auto: false,
  runLabel: ['조회', 'Look up'],
  inputs: [{ id: 'in', label: ['도메인 또는 IP (한 줄에 하나, 최대 5개)', 'Domain or IP (one per line, up to 5)'], rows: 3, sample: 'example.com' }],
  options: [
    { id: 'type', type: 'select', label: ['레코드 유형', 'Record type'], choices: [['A', 'A'], ['AAAA', 'AAAA'], ['CNAME', 'CNAME'], ['MX', 'MX'], ['TXT', 'TXT'], ['NS', 'NS'], ['SOA', 'SOA'], ['CAA', 'CAA'], ['SRV', 'SRV'], ['PTR', ['PTR (역방향 조회)', 'PTR (reverse)']], ['DS', 'DS'], ['DNSKEY', 'DNSKEY'], ['HTTPS', 'HTTPS'], ['SVCB', 'SVCB'], ['TLSA', 'TLSA'], ['NAPTR', 'NAPTR'], ['ALL', ['주요 유형 전체 (A·AAAA·CNAME·MX·NS·TXT·SOA·CAA)', 'Common types (A, AAAA, CNAME, MX, NS, TXT, SOA, CAA)']]], default: 'A' },
    { id: 'resolver', type: 'select', label: ['DoH 리졸버', 'DoH resolver'], choices: [['cloudflare', 'Cloudflare (1.1.1.1)'], ['google', 'Google (8.8.8.8)'], ['both', ['두 곳 비교', 'Compare both']]], default: 'cloudflare' },
    { id: 'dnssec', type: 'checkbox', label: ['DNSSEC 정보 요청 (DO 비트)', 'Request DNSSEC data (DO bit)'], default: false },
    { id: 'nocheck', type: 'checkbox', label: ['DNSSEC 검증 끄기 (CD 비트)', 'Disable DNSSEC validation (CD bit)'], default: false }
  ],
  outputs: [{ id: 'ans', label: ['응답 레코드', 'Answer records'], kind: 'table' }, { id: 'meta', label: ['응답 상태', 'Response status'], kind: 'table' }, { id: 'raw', label: ['원본 JSON', 'Raw JSON'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var TYPES = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 35: 'NAPTR', 43: 'DS', 46: 'RRSIG', 47: 'NSEC', 48: 'DNSKEY', 50: 'NSEC3', 52: 'TLSA', 64: 'SVCB', 65: 'HTTPS', 257: 'CAA' };
    var RCODE = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
    var RCODE_KO = { NOERROR: '정상', FORMERR: '형식 오류', SERVFAIL: '서버 실패 (DNSSEC 검증 실패 포함)', NXDOMAIN: '도메인 없음', NOTIMP: '미구현', REFUSED: '거부됨' };
    var RCODE_EN = { NOERROR: 'OK', FORMERR: 'Format error', SERVFAIL: 'Server failure (including DNSSEC validation failure)', NXDOMAIN: 'Name does not exist', NOTIMP: 'Not implemented', REFUSED: 'Refused' };
    var names = String(v['in'] || '').split(/\r?\n/).map(function (s) { return s.trim().replace(/^https?:\/\//i, '').replace(/[\/?#].*$/, '').replace(/\.$/, ''); }).filter(Boolean);
    if (!names.length) throw new Error(t('도메인 또는 IP 를 입력하세요', 'Enter a domain or IP'));
    if (names.length > 5) throw new Error(t('한 번에 최대 5개까지 조회할 수 있습니다', 'At most 5 names per lookup'));
    var F = TK._fetch || (typeof fetch === 'function' ? fetch : null);
    if (!F) throw new Error(t('이 브라우저는 fetch 를 지원하지 않습니다', 'This browser does not support fetch'));
    function arpa(ip) {
      var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
      if (m) { if ([m[1], m[2], m[3], m[4]].some(function (x) { return Number(x) > 255; })) return null; return [m[4], m[3], m[2], m[1]].join('.') + '.in-addr.arpa'; }
      if (ip.indexOf(':') >= 0) {
        var parts = ip.split('::'); if (parts.length > 2) return null;
        var head = parts[0] ? parts[0].split(':') : [], tail = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
        if (parts.length === 1 && head.length !== 8) return null;
        var fill = 8 - head.length - tail.length; if (fill < 0) return null;
        var all = head.concat(new Array(fill + 1).join('0,').split(',').slice(0, fill), tail);
        if (all.length !== 8 || all.some(function (x) { return !/^[0-9a-fA-F]{1,4}$/.test(x); })) return null;
        return all.map(function (x) { return ('0000' + x).slice(-4); }).join('').split('').reverse().join('.') + '.ip6.arpa';
      }
      return null;
    }
    var types = o.type === 'ALL' ? ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA'] : [o.type];
    var resolvers = o.resolver === 'both' ? ['cloudflare', 'google'] : [o.resolver || 'cloudflare'];
    var URLS = { cloudflare: 'https://cloudflare-dns.com/dns-query', google: 'https://dns.google/resolve' };
    var issues = [], jobs = [];
    names.forEach(function (nm) {
      var isIp = /^[\d.]+$/.test(nm) || nm.indexOf(':') >= 0;
      types.forEach(function (ty) {
        var qname = nm, qtype = ty;
        if (isIp) { var ar = arpa(nm); if (!ar) { issues.push(t('"' + nm + '" 은(는) 올바른 IP 가 아닙니다', '"' + nm + '" is not a valid IP address')); return; } qname = ar; qtype = 'PTR'; if (ty !== 'PTR' && o.type !== 'ALL') issues.push(t(nm + ' 은(는) IP 라서 PTR(역방향) 조회로 바꿨습니다', nm + ' is an IP address, so a PTR (reverse) lookup was used')); if (o.type === 'ALL' && ty !== 'A') return; }
        else if (ty === 'PTR') { issues.push(t('PTR 조회는 IP 주소를 입력해야 합니다: ' + nm, 'PTR lookups need an IP address: ' + nm)); return; }
        else { try { qname = new URL('http://' + nm + '/').hostname; } catch (e) { issues.push(t('"' + nm + '" 은(는) 올바른 도메인이 아닙니다', '"' + nm + '" is not a valid domain name')); return; } }
        resolvers.forEach(function (rs) { jobs.push({ label: nm, qname: qname, qtype: qtype, rs: rs }); });
      });
    });
    if (!jobs.length) throw new Error(issues[0] || t('조회할 항목이 없습니다', 'Nothing to look up'));
    function one(j) {
      var url = URLS[j.rs] + '?name=' + encodeURIComponent(j.qname) + '&type=' + encodeURIComponent(j.qtype) + (o.dnssec ? '&do=1' : '') + (o.nocheck ? '&cd=1' : '');
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
      return F(url, { headers: { accept: 'application/dns-json' }, signal: ctl ? ctl.signal : undefined }).then(function (r) { if (tm) clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (js) { j.res = js; return j; }, function (e) { if (tm) clearTimeout(tm); j.err = e; return j; });
    }
    return Promise.all(jobs.map(one)).then(function (done) {
      var rows = [], meta = [], raw = [], sets = {};
      function dataOf(r) {
        var ty = TYPES[r.type] || String(r.type), d = String(r.data == null ? '' : r.data);
        if (ty === 'TXT') { var parts = d.match(/"(?:[^"\\]|\\.)*"/g); if (parts && parts.length > 1) d = parts.map(function (p) { return p.slice(1, -1); }).join(''); else d = d.replace(/^"|"$/g, ''); }
        return d;
      }
      done.forEach(function (j) {
        var tag = j.label + (j.qname !== j.label ? ' (' + j.qname + ')' : '');
        if (j.err) { meta.push([tag, j.qtype, j.rs, 'ERROR', '—', '—', '—', j.err.name === 'AbortError' ? t('시간 초과 (10초)', 'Timed out (10 s)') : (j.err.message || String(j.err)) + t(' — 네트워크 또는 리졸버의 CORS 정책을 확인하세요', ' — check your network or the resolver CORS policy')]); return; }
        var r = j.res, rc = RCODE[r.Status] || String(r.Status), flags = [r.AD ? 'AD' : '', r.CD ? 'CD' : '', r.RA ? 'RA' : '', r.RD ? 'RD' : '', r.TC ? 'TC' : ''].filter(Boolean).join(' ');
        meta.push([tag, j.qtype, j.rs, rc, flags || '—', String((r.Answer || []).length), String((r.Authority || []).length), (rc === 'NOERROR' && !(r.Answer || []).length) ? t('응답은 정상이지만 해당 유형의 레코드가 없습니다 (NODATA)', 'Valid response but no records of this type (NODATA)') : t(RCODE_KO[rc] || '', RCODE_EN[rc] || '')]);
        if (r.TC) issues.push(t(tag + ': 응답이 잘렸습니다 (TC)', tag + ': the response was truncated (TC)'));
        if (r.Status === 2 && !o.nocheck) issues.push(t(tag + ': SERVFAIL — 리졸버 문제이거나 DNSSEC 검증 실패일 수 있습니다. "DNSSEC 검증 끄기" 로 다시 조회해 보세요', tag + ': SERVFAIL - a resolver problem or a DNSSEC validation failure; retry with "Disable DNSSEC validation"'));
        if (o.dnssec && r.Status === 0 && !r.AD && j.qtype !== 'DS' && j.qtype !== 'DNSKEY') issues.push(t(tag + ': AD(인증된 데이터) 플래그가 없습니다 — 도메인이 DNSSEC 서명을 쓰지 않거나 검증에 실패했습니다', tag + ': no AD (authenticated data) flag; the domain is unsigned or validation failed'));
        (r.Answer || []).forEach(function (a) { var k = j.label + '|' + j.qtype + '|' + (TYPES[a.type] || a.type) + '|' + dataOf(a); (sets[j.label + '|' + j.qtype] = sets[j.label + '|' + j.qtype] || {})[j.rs] = (sets[j.label + '|' + j.qtype][j.rs] || []).concat(TYPES[a.type] + ' ' + dataOf(a)); rows.push([a.name, TYPES[a.type] || String(a.type), String(a.TTL), dataOf(a), j.rs]); });
        (r.Authority || []).forEach(function (a) { rows.push([a.name, (TYPES[a.type] || String(a.type)) + ' (authority)', String(a.TTL), dataOf(a), j.rs]); });
        raw.push({ resolver: j.rs, query: j.qname + ' ' + j.qtype, response: r });
      });
      if (resolvers.length === 2) Object.keys(sets).forEach(function (k) { var a = (sets[k].cloudflare || []).slice().sort().join('\n'), b = (sets[k].google || []).slice().sort().join('\n'); if (a !== b) issues.push(t(k.replace('|', ' ') + ': 두 리졸버의 응답이 다릅니다 (캐시·지역 DNS 차이일 수 있음)', k.replace('|', ' ') + ': the two resolvers returned different answers (cache or geo-DNS differences)')); });
      var okN = done.filter(function (j) { return j.res && j.res.Status === 0; }).length, errN = done.filter(function (j) { return j.err; }).length;
      if (errN === done.length) throw new Error(t('모든 조회가 실패했습니다: ', 'All lookups failed: ') + (done[0].err.message || String(done[0].err)));
      return { _status: { ok: true, msg: t('✅ ' + done.length + '건 조회 · 응답 레코드 ' + rows.length + '개' + (errN ? ' · 실패 ' + errN + '건' : ''), '✅ ' + done.length + ' lookup(s) · ' + rows.length + ' record(s)' + (errN ? ' · ' + errN + ' failed' : '')) }, ans: { head: [['이름', 'Name'], ['유형', 'Type'], ['TTL(초)', 'TTL (s)'], ['값', 'Data'], ['리졸버', 'Resolver']], rows: rows, empty: ['응답 레코드가 없습니다', 'No answer records'] }, meta: { head: [['조회', 'Query'], ['유형', 'Type'], ['리졸버', 'Resolver'], ['RCODE', 'RCODE'], ['플래그', 'Flags'], ['응답', 'Answers'], ['권한', 'Authority'], ['설명', 'Note']], rows: meta }, raw: JSON.stringify(raw.length === 1 ? raw[0].response : raw, null, 2), issues: issues };
    });
  }
});
