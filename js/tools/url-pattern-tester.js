TK.tool('url-pattern-tester', {
  inputs: [
    { id: 'pattern', type: 'text', label: ['URLPattern 패턴 (전체 URL 또는 pathname)', 'URLPattern (full URL or pathname)'], sample: 'https://shop.example.com/products/:id(\\d+)/:section?' },
    { id: 'urls', label: ['테스트할 URL (한 줄에 하나)', 'URLs to test (one per line)'], rows: 8, sample: 'https://shop.example.com/products/42\nhttps://shop.example.com/products/42/reviews\nhttps://shop.example.com/products/abc\nhttps://shop.example.com/products/42/reviews/extra\nhttp://shop.example.com/products/7\nhttps://other.example.com/products/7' }
  ],
  options: [],
  outputs: [{ id: 'table', label: ['일치 결과', 'Match results'], kind: 'table' }, { id: 'parts', label: ['패턴 구성', 'Pattern components'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var pat = String(v.pattern || '').trim(), issues = [];
    if (!pat) throw new Error(t('패턴을 입력하세요', 'Enter a pattern'));
    var comps = { protocol: '*', hostname: '*', port: '*', pathname: '*', search: '*', hash: '*' };
    var full = /^[a-zA-Z*][a-zA-Z0-9+.*-]*:\/\//.test(pat);
    if (full) {
      var m = /^([^:]+):\/\/([^\/?#]*)(.*)$/.exec(pat), rest = m[3], pathPart = '', searchPart, hashPart, k = 0, depth = 0, prevTok = '';
      // '?' 는 :name / (정규식) / {그룹} 바로 뒤에서는 수식어, 그 외에는 검색 구분자
      for (; k < rest.length; k++) {
        var ch = rest[k];
        if (ch === '\\') { pathPart += ch + (rest[k + 1] || ''); k++; prevTok = 'lit'; continue; }
        if (ch === '(') depth++; if (ch === ')') depth--;
        if (!depth && ch === '#') break;
        if (!depth && ch === '?' && !(prevTok === 'name' || prevTok === 'close')) break;
        pathPart += ch;
        prevTok = depth ? 'in' : (ch === ')' || ch === '}' || ch === '*') ? 'close' : /:[\w$]+$/.test(pathPart) ? 'name' : 'lit';
      }
      var tail = rest.slice(k);
      if (tail[0] === '?') { var hi = tail.indexOf('#'); searchPart = hi < 0 ? tail.slice(1) : tail.slice(1, hi); hashPart = hi < 0 ? undefined : tail.slice(hi + 1); } else if (tail[0] === '#') hashPart = tail.slice(1);
      comps.protocol = m[1]; var hp = m[2], pi = hp.lastIndexOf(':'); if (pi > 0 && !/[)\]]$/.test(hp.slice(pi)) && /^[\d*:\w()?]+$/.test(hp.slice(pi + 1)) && hp.slice(pi + 1).indexOf(')') < 0) { comps.hostname = hp.slice(0, pi); comps.port = hp.slice(pi + 1); } else comps.hostname = hp || '*';
      comps.pathname = pathPart || '/'; comps.search = searchPart === undefined ? '*' : searchPart; comps.hash = hashPart === undefined ? '*' : hashPart;
    } else if (pat[0] === '/' || pat[0] === '*') comps.pathname = pat;
    else throw new Error(t('패턴은 https://… 형태의 전체 URL 이거나 /로 시작하는 경로여야 합니다', 'Use a full URL such as https://… or a path starting with /'));
    // 컴포넌트 패턴 → 정규식
    function compile(src, kind) {
      var names = [], re = '', i = 0, delim = kind === 'pathname' ? '/' : kind === 'hostname' ? '.' : '';
      var seg = delim ? '[^' + (delim === '/' ? '/' : '\\.') + ']+?' : '.+?';
      function mod(r, mdf, prefix, suffix) { prefix = prefix || ''; suffix = suffix || ''; var jn = delim ? '\\' + delim : ''; if (mdf === '?') return '(?:' + prefix + '(' + r + ')' + suffix + ')?'; if (mdf === '*') return '(?:' + prefix + '(' + r + '(?:' + jn + r + ')*)' + suffix + ')?'; if (mdf === '+') return prefix + '(' + r + '(?:' + jn + r + ')*)' + suffix; return prefix + '(' + r + ')' + suffix; }
      var wcN = 0;
      while (i < src.length) {
        var c = src[i];
        if (c === '\\') { re += '\\' + (src[i + 1] || ''); i += 2; continue; }
        if (c === '{') { var e = src.indexOf('}', i); if (e < 0) throw new Error(t('{ 가 닫히지 않았습니다', 'Unclosed {')); var inner = src.slice(i + 1, e), mdf = src[e + 1] && /[?*+]/.test(src[e + 1]) ? src[e + 1] : ''; re += '(?:' + compile(inner, kind).src + ')' + mdf; names = names.concat(compile(inner, kind).names); i = e + 1 + (mdf ? 1 : 0); continue; }
        if (c === ':') { var nm = /^:([A-Za-z_$][\w$]*)/.exec(src.slice(i)); if (!nm) { re += ':'; i++; continue; } i += nm[0].length; var rx = seg; if (src[i] === '(') { var d = 1, j = i + 1; while (j < src.length && d) { if (src[j] === '\\') j++; else if (src[j] === '(') d++; else if (src[j] === ')') d--; j++; } rx = src.slice(i + 1, j - 1); i = j; } var md = src[i] && /[?*+]/.test(src[i]) ? src[i++] : ''; names.push(nm[1]); var pre = ''; if (md && delim === '/' && /\\\/$/.test(re)) { re = re.replace(/\\\/$/, ''); pre = '\\/'; } re += mod(rx, md, pre); continue; }
        if (c === '(') { var d2 = 1, j2 = i + 1; while (j2 < src.length && d2) { if (src[j2] === '\\') j2++; else if (src[j2] === '(') d2++; else if (src[j2] === ')') d2--; j2++; } var rx2 = src.slice(i + 1, j2 - 1); i = j2; var md2 = src[i] && /[?*+]/.test(src[i]) ? src[i++] : ''; names.push(String(wcN++)); re += mod(rx2, md2); continue; }
        if (c === '*') { names.push(String(wcN++)); re += '(.*)'; i++; continue; }
        re += /[.+?^${}()|[\]\/]/.test(c) ? '\\' + c : c; i++;
      }
      return { src: re, names: names };
    }
    var rx = {}, allNames = [], PCT = { protocol: 1, hostname: 1 };
    Object.keys(comps).forEach(function (k) {
      var s = comps[k], c;
      if (s === '*' && k !== 'pathname') { rx[k] = null; return; }
      if (k === 'pathname' && s === '*') { rx[k] = null; return; }
      try { c = compile(s, k); rx[k] = { re: new RegExp('^' + c.src + '$', k === 'hostname' || k === 'protocol' ? 'i' : ''), names: c.names, src: s }; allNames = allNames.concat(c.names.map(function (n) { return [k, n]; })); }
      catch (e) { throw new Error(t(k + ' 패턴 오류: ' + e.message, 'Error in the ' + k + ' pattern: ' + e.message)); }
    });
    var lines = String(v.urls || '').replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean), rows = [], hit = 0;
    lines.forEach(function (ln) {
      var u; try { u = new URL(ln, full ? undefined : 'https://example.com'); } catch (e) { rows.push([ln, '❌', t('URL 형식 오류', 'invalid URL'), '']); return; }
      var parts = { protocol: u.protocol.replace(':', ''), hostname: u.hostname, port: u.port, pathname: u.pathname, search: u.search.replace(/^\?/, ''), hash: u.hash.replace(/^#/, '') }, groups = {}, ok = true, why = '';
      Object.keys(parts).forEach(function (k) {
        if (!ok || !rx[k]) return; var m = rx[k].re.exec(parts[k]);
        if (!m) { ok = false; why = k + ': "' + parts[k] + '" ≠ ' + rx[k].src; return; }
        rx[k].names.forEach(function (n, i) { if (m[i + 1] !== undefined) groups[n] = m[i + 1]; });
      });
      if (ok) hit++;
      rows.push([ln.length > 55 ? ln.slice(0, 52) + '…' : ln, ok ? '✅' : '❌', ok ? (Object.keys(groups).length ? Object.keys(groups).map(function (g) { return g + '=' + groups[g]; }).join(', ') : t('일치(캡처 없음)', 'match (no groups)')) : why, '']);
    });
    var prow = Object.keys(comps).map(function (k) { return [k, comps[k] === '*' ? '* ' + t('(모두)', '(any)') : comps[k], rx[k] ? rx[k].names.join(', ') || '—' : '—']; });
    if (typeof URLPattern !== 'undefined') { try { new URLPattern(pat); } catch (e) { issues.push('🚨 ' + t('브라우저 URLPattern 이 이 패턴을 거부합니다: ' + e.message, 'The browser URLPattern rejects this pattern: ' + e.message)); } }
    issues.push(t('URLPattern 은 정규식이 아니라 path-to-regexp 계열 문법입니다: :name, :name?, :name*, :name+, (정규식), *, {그룹}?', 'URLPattern is path-to-regexp style, not plain regex: :name, :name?, :name*, :name+, (regex), *, {group}?'));
    issues.push(t(':name 은 기본적으로 / 를 포함하지 않는 한 세그먼트와 일치합니다. 여러 세그먼트는 :name* 또는 *', ':name matches one segment by default; use :name* or * for several'));
    issues.push(t('이 도구는 브라우저의 URLPattern 구현을 단순화한 호환 구현입니다(대소문자 구분·이스케이프의 세부 차이 가능). 실제 동작은 new URLPattern(…).test(url) 로 확인하세요', 'This is a simplified compatible implementation of URLPattern (case sensitivity and escaping details may differ); confirm with new URLPattern(…).test(url)'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 패턴 문제', '❌ Pattern problem') } : t('✅ ' + lines.length + '개 중 ' + hit + '개 일치', '✅ ' + hit + ' of ' + lines.length + ' match'), table: { head: [['URL', 'URL'], ['결과', 'Result'], ['캡처 / 사유', 'Groups / reason']].concat([['', '']]).slice(0, 3), rows: rows.map(function (r) { return r.slice(0, 3); }) }, parts: { head: [['구성', 'Component'], ['패턴', 'Pattern'], ['캡처 이름', 'Group names']], rows: prow }, issues: issues };
  }
});
