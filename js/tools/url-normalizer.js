TK.tool('url-normalizer', {
  inputs: [
    { id: 'in', label: ['URL (한 줄에 하나)', 'URLs (one per line)'], rows: 8, sample: 'HTTP://WWW.Example.COM:80/a/./b/../c/?b=2&a=1&utm_source=news&utm_medium=email#top\nhttps://example.com/%7Euser/%e2%82%ac/index.html?x=%7e\n//cdn.example.com/lib.js\n../images/logo.png\nhttps://한글.kr/경로/파일' },
    { id: 'base', type: 'text', label: ['기준 URL (상대 경로를 풀 때)', 'Base URL (to resolve relative references)'], sample: 'https://example.com/docs/guide/intro.html', placeholder: ['https://example.com/docs/'] }
  ],
  options: [
    { id: 'sort', type: 'checkbox', label: ['쿼리 파라미터 정렬', 'Sort query parameters'], default: true },
    { id: 'track', type: 'checkbox', label: ['추적 파라미터 제거 (utm_*, fbclid, gclid …)', 'Remove tracking params (utm_*, fbclid, gclid …)'], default: true },
    { id: 'frag', type: 'checkbox', label: ['#fragment 제거', 'Remove #fragment'], default: true },
    { id: 'slash', type: 'select', label: ['끝의 슬래시', 'Trailing slash'], choices: [['keep', ['그대로', 'Keep']], ['remove', ['제거', 'Remove']], ['add', ['경로에 추가', 'Add']]], default: 'keep' },
    { id: 'www', type: 'checkbox', label: ['www. 제거', 'Remove www.'], default: false },
    { id: 'https', type: 'checkbox', label: ['http → https', 'Upgrade http → https'], default: false },
    { id: 'index', type: 'checkbox', label: ['index.html 등 기본 문서 제거', 'Drop index.html / index.php'], default: false },
    { id: 'idn', type: 'select', label: ['국제화 도메인', 'Internationalized names'], choices: [['ascii', ['Punycode(ASCII)로', 'Punycode (ASCII)']], ['unicode', ['유니코드로 표시', 'Show as Unicode']]], default: 'ascii' }
  ],
  outputs: [{ id: 'table', label: ['정규화 결과', 'Normalised URLs'], kind: 'table' }, { id: 'out', label: ['정규화된 URL 목록', 'Normalised list'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [], outs = [], base = (v.base || '').trim();
    var TRACK = /^(utm_[a-z_]+|fbclid|gclid|gclsrc|dclid|msclkid|yclid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|mkt_tok|ref_src|spm|si)$/i;
    if (base) { try { new URL(base); } catch (e) { throw new Error(t('기준 URL이 올바르지 않습니다', 'The base URL is invalid')); } }
    lines.forEach(function (ln) {
      var u, changes = [];
      try { u = base ? new URL(ln, base) : new URL(ln); } catch (e) { rows.push({ cls: 'r-bad', cells: [ln, t('해석할 수 없는 URL입니다' + (base ? '' : ' (상대 경로라면 기준 URL을 입력하세요)'), 'Cannot parse this URL' + (base ? '' : ' (enter a base URL for relative references)')), '']}); return; }
      if (o.https && u.protocol === 'http:') { u.protocol = 'https:'; changes.push('https'); }
      if (o.www && /^www\./i.test(u.hostname)) { u.hostname = u.hostname.replace(/^www\./i, ''); changes.push(t('www 제거', 'www removed')); }
      if (o.frag && u.hash) { u.hash = ''; changes.push(t('프래그먼트 제거', 'fragment removed')); }
      var params = Array.from(u.searchParams.entries()), kept = params.filter(function (p) { return !(o.track && TRACK.test(p[0])); });
      if (kept.length !== params.length) changes.push(t('추적 파라미터 ' + (params.length - kept.length) + '개 제거', (params.length - kept.length) + ' tracking param(s) removed'));
      if (o.sort) { var sorted = kept.slice().sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; }); if (JSON.stringify(sorted) !== JSON.stringify(kept)) changes.push(t('쿼리 정렬', 'query sorted')); kept = sorted; }
      if (params.length) { var sp = new URLSearchParams(); kept.forEach(function (p) { sp.append(p[0], p[1]); }); u.search = sp.toString() ? '?' + sp.toString() : ''; }
      var path = u.pathname;
      // 불필요한 퍼센트 인코딩 정리: 예약되지 않은 문자는 디코딩, 나머지 16진수는 대문자
      var np = path.replace(/%([0-9a-fA-F]{2})/g, function (m, h) { var c = String.fromCharCode(parseInt(h, 16)); return /[A-Za-z0-9\-._~]/.test(c) ? c : '%' + h.toUpperCase(); });
      if (np !== path) { changes.push(t('퍼센트 인코딩 정리', 'percent-encoding normalised')); u.pathname = np; path = np; }
      if (o.index && /\/index\.(html?|php|asp|aspx|jsp)$/i.test(path)) { u.pathname = path.replace(/index\.(html?|php|asp|aspx|jsp)$/i, ''); changes.push(t('기본 문서 제거', 'index document dropped')); path = u.pathname; }
      if (o.slash === 'remove' && path.length > 1 && /\/$/.test(path)) { u.pathname = path.replace(/\/+$/, '') || '/'; changes.push(t('끝 슬래시 제거', 'trailing slash removed')); }
      if (o.slash === 'add' && !/\/$/.test(path) && !/\.[A-Za-z0-9]{1,5}$/.test(path.split('/').pop())) { u.pathname = path + '/'; changes.push(t('끝 슬래시 추가', 'trailing slash added')); }
      var href = u.href;
      if (o.idn === 'unicode') { try { var host = TK.dns.toUnicode(u.hostname); if (host !== u.hostname) { href = href.replace(u.hostname, host); changes.push(t('유니코드 도메인', 'Unicode host')); } } catch (e) { /* 무시 */ } }
      if (base && !/^[a-z][a-z0-9+.-]*:/i.test(ln)) changes.unshift(t('상대 경로를 기준 URL로 해석', 'relative reference resolved against the base'));
      if (/^[A-Za-z]+:\/\/[^\/?#]*[A-Z]/.test(ln)) changes.push(t('스킴·호스트 소문자', 'scheme/host lowercased'));
      if (!changes.length && href !== ln) changes.push(t('표준 형태로 정리 (기본 포트·점 경로·인코딩)', 'canonical form (default port, dot segments, encoding)'));
      outs.push(href);
      rows.push([ln, href, changes.length ? changes.join(' · ') : t('변경 없음', 'unchanged')]);
    });
    return { _status: lines.length ? t('✅ ' + outs.length + '개 정규화' + (outs.length ? ', 중복 제거 시 ' + outs.filter(function (x, i) { return outs.indexOf(x) === i; }).length + '개' : ''), '✅ Normalised ' + outs.length + (outs.length ? ', ' + outs.filter(function (x, i) { return outs.indexOf(x) === i; }).length + ' unique' : '')) : '', table: { head: [['입력', 'Input'], ['정규화', 'Normalised'], ['변경 내용', 'Changes']], rows: rows }, out: outs.join('\n') };
  }
});
