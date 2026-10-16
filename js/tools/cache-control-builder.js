TK.tool('cache-control-builder', {
  allowEmpty: true,
  inputs: [{ id: 'in', label: ['분석할 Cache-Control 값', 'Cache-Control value to parse'], type: 'text', sample: 'public, max-age=31536000, immutable, stale-while-revalidate=600', placeholder: ['public, max-age=3600, s-maxage=86400', 'public, max-age=3600, s-maxage=86400'], show: function (o) { return o.mode === 'parse'; } }],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['build', ['헤더 만들기', 'Build a header']], ['parse', ['헤더 분석', 'Parse a header']]], default: 'build' },
    { id: 'preset', type: 'select', label: ['프리셋', 'Preset'], choices: [['custom', ['직접 설정', 'Custom']], ['static', ['해시가 붙은 정적 파일 (1년, immutable)', 'Fingerprinted static assets (1 year, immutable)']], ['html', ['HTML 문서 (매번 재검증)', 'HTML documents (always revalidate)']], ['api', ['개인 API 응답 (캐시 금지)', 'Private API responses (no caching)']], ['cdn', ['CDN 위주 (브라우저 짧게, CDN 길게)', 'CDN-centric (short browser, long CDN)']], ['swr', ['빠르게 보여주고 뒤에서 갱신(SWR)', 'Serve stale while revalidating (SWR)']]], default: 'custom', show: function (o) { return o.mode === 'build'; } },
    { id: 'vis', type: 'select', label: ['공개 범위', 'Visibility'], choices: [['', ['(지정 안 함)', '(unset)']], ['public', 'public'], ['private', 'private']], default: 'public', show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'maxage', type: 'number', label: ['max-age (초, -1=생략)', 'max-age (s, -1 = omit)'], default: 3600, min: -1, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'smaxage', type: 'number', label: ['s-maxage (초, -1=생략)', 's-maxage (s, -1 = omit)'], default: -1, min: -1, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'swr', type: 'number', label: ['stale-while-revalidate (초, -1=생략)', 'stale-while-revalidate (s, -1 = omit)'], default: -1, min: -1, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'sie', type: 'number', label: ['stale-if-error (초, -1=생략)', 'stale-if-error (s, -1 = omit)'], default: -1, min: -1, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'nocache', type: 'checkbox', label: ['no-cache', 'no-cache'], default: false, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'nostore', type: 'checkbox', label: ['no-store', 'no-store'], default: false, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'mustre', type: 'checkbox', label: ['must-revalidate', 'must-revalidate'], default: false, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'proxyre', type: 'checkbox', label: ['proxy-revalidate', 'proxy-revalidate'], default: false, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'immutable', type: 'checkbox', label: ['immutable', 'immutable'], default: false, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } },
    { id: 'notransform', type: 'checkbox', label: ['no-transform', 'no-transform'], default: false, show: function (o) { return o.mode === 'build' && o.preset === 'custom'; } }
  ],
  sampleOptions: { mode: 'parse' },
  outputs: [{ id: 'out', label: ['Cache-Control 헤더', 'Cache-Control header'], kind: 'code', ext: 'txt', download: false }, { id: 'table', label: ['지시어 설명', 'Directive explanations'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Checks'], kind: 'list' }],
  run: function (v, o, t) {
    var DIR = {
      'public': ['모든 캐시(CDN·프록시 포함)에 저장 가능', 'Any cache (CDN, proxies) may store it'], 'private': ['브라우저 같은 개인 캐시에만 저장', 'Only a private (browser) cache may store it'], 'no-cache': ['저장은 하되 사용 전 매번 서버에 재검증', 'May be stored, but must be revalidated before every use'], 'no-store': ['어떤 캐시에도 저장 금지', 'Must not be stored anywhere'],
      'max-age': ['신선한 것으로 간주하는 시간(초)', 'Seconds the response is considered fresh'], 's-maxage': ['공유 캐시(CDN)용 신선 시간(초), max-age보다 우선', 'Freshness for shared caches (CDN); overrides max-age there'], 'must-revalidate': ['만료되면 오래된 응답을 쓰지 말고 반드시 재검증', 'Once stale, must revalidate before reuse'], 'proxy-revalidate': ['must-revalidate의 공유 캐시 전용 버전', 'must-revalidate for shared caches only'],
      'immutable': ['신선한 동안 재검증 요청(새로고침 포함) 불필요', 'Will not change while fresh — skip revalidation'], 'stale-while-revalidate': ['만료 후 지정 시간 동안은 낡은 응답을 먼저 쓰고 뒤에서 갱신', 'Serve stale for N seconds while revalidating in the background'], 'stale-if-error': ['오류 시 지정 시간 동안 낡은 응답 사용 허용', 'Serve stale for N seconds if the origin errors'], 'no-transform': ['중간 캐시가 본문을 변환(압축·이미지 변환)하지 못하게 함', 'Intermediaries must not transform the body'], 'only-if-cached': ['요청용: 캐시된 응답만 원함', 'Request-only: use only a cached response'], 'max-stale': ['요청용: 만료된 응답도 허용', 'Request-only: accept stale responses'], 'min-fresh': ['요청용: 지정 시간 이상 신선한 응답만', 'Request-only: require at least N seconds of freshness'] };
    var header;
    if (o.mode === 'build') {
      var p = { vis: o.vis, maxage: o.maxage, smaxage: o.smaxage, swr: o.swr, sie: o.sie, nocache: o.nocache, nostore: o.nostore, mustre: o.mustre, proxyre: o.proxyre, immutable: o.immutable, notransform: o.notransform };
      var PRE = { static: { vis: 'public', maxage: 31536000, immutable: true }, html: { vis: 'public', maxage: 0, mustre: true, nocache: true }, api: { vis: 'private', nostore: true }, cdn: { vis: 'public', maxage: 60, smaxage: 86400, swr: 600 }, swr: { vis: 'public', maxage: 60, swr: 86400 } };
      if (o.preset !== 'custom') p = Object.assign({ vis: '', maxage: -1, smaxage: -1, swr: -1, sie: -1 }, PRE[o.preset]);
      var parts = [];
      if (p.vis) parts.push(p.vis);
      if (p.nocache) parts.push('no-cache'); if (p.nostore) parts.push('no-store');
      if (p.maxage >= 0) parts.push('max-age=' + Math.round(p.maxage)); if (p.smaxage >= 0) parts.push('s-maxage=' + Math.round(p.smaxage));
      if (p.mustre) parts.push('must-revalidate'); if (p.proxyre) parts.push('proxy-revalidate'); if (p.immutable) parts.push('immutable');
      if (p.swr >= 0) parts.push('stale-while-revalidate=' + Math.round(p.swr)); if (p.sie >= 0) parts.push('stale-if-error=' + Math.round(p.sie)); if (p.notransform) parts.push('no-transform');
      if (!parts.length) throw new Error(t('하나 이상의 지시어를 선택하세요', 'Choose at least one directive'));
      header = parts.join(', ');
    } else {
      header = String(v.in || '').trim().replace(/^cache-control\s*:\s*/i, '');
      if (!header) throw new Error(t('분석할 Cache-Control 값을 입력하세요', 'Enter a Cache-Control value'));
    }
    var dirs = header.split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { var m = /^([A-Za-z-]+)(?:\s*=\s*"?([^"]*)"?)?$/.exec(x); return m ? { n: m[1].toLowerCase(), v: m[2], raw: x } : { n: x, bad: true, raw: x }; });
    var has = function (n) { return dirs.some(function (d) { return d.n === n; }); }, val = function (n) { var d = dirs.filter(function (x) { return x.n === n; })[0]; return d && d.v !== undefined ? d.v : null; };
    var issues = [];
    function human(sec) { sec = +sec; if (sec >= 86400 * 365) return Math.round(sec / 86400 / 365 * 10) / 10 + t('년', ' yr'); if (sec >= 86400) return Math.round(sec / 86400 * 10) / 10 + t('일', ' d'); if (sec >= 3600) return Math.round(sec / 3600 * 10) / 10 + t('시간', ' h'); if (sec >= 60) return Math.round(sec / 60 * 10) / 10 + t('분', ' min'); return sec + t('초', ' s'); }
    var rows = dirs.map(function (d) {
      var base = DIR[d.n];
      if (d.bad) return { cls: 'r-bad', cells: [d.raw, '', t('해석할 수 없는 지시어', 'Unparseable directive')] };
      if (!base) return { cls: 'r-warn', cells: [d.n, d.v || '', t('알 수 없는(비표준) 지시어', 'Unknown / non-standard directive')] };
      var extra = (/^(max-age|s-maxage|stale-while-revalidate|stale-if-error|max-stale|min-fresh)$/.test(d.n) && d.v !== undefined) ? (/^\d+$/.test(d.v) ? ' → ' + human(d.v) : '') : '';
      if (/^(max-age|s-maxage|stale-while-revalidate|stale-if-error)$/.test(d.n) && !/^\d+$/.test(d.v || '')) issues.push(t(d.n + '에는 0 이상의 정수(초)가 필요합니다', d.n + ' needs a non-negative integer (seconds)'));
      return [d.n, d.v === undefined ? '' : d.v, t(base[0], base[1]) + extra];
    });
    if (has('public') && has('private')) issues.push(t('public과 private이 함께 있습니다 — 모순입니다', 'public and private are both present — contradictory'));
    if (has('no-store') && (has('max-age') || has('immutable') || has('stale-while-revalidate'))) issues.push(t('no-store가 있으면 max-age·immutable·stale-* 는 의미가 없습니다', 'With no-store, max-age / immutable / stale-* have no effect'));
    if (has('no-cache') && has('immutable')) issues.push(t('no-cache와 immutable은 함께 쓰지 않는 것이 좋습니다', 'no-cache and immutable do not belong together'));
    if (has('immutable') && !has('max-age')) issues.push(t('immutable은 max-age와 함께 쓸 때 의미가 있습니다', 'immutable is only useful together with max-age'));
    if (has('max-age') && val('max-age') === '0' && !has('must-revalidate') && !has('no-cache')) issues.push(t('max-age=0 은 no-cache 또는 must-revalidate와 함께 쓰면 의도가 분명해집니다', 'max-age=0 is clearer with no-cache or must-revalidate'));
    if (has('s-maxage') && has('private')) issues.push(t('private 응답에는 s-maxage(공유 캐시용)가 적용되지 않습니다', 's-maxage (shared caches) does not apply to private responses'));
    if (has('max-age') && +val('max-age') > 31536000) issues.push(t('max-age가 1년(31536000초)을 넘습니다 — 표준은 1년을 상한으로 권장합니다', 'max-age exceeds one year (31536000 s) — the spec recommends at most one year'));
    if (has('stale-while-revalidate') && !has('max-age') && !has('s-maxage')) issues.push(t('stale-while-revalidate는 max-age(또는 s-maxage)와 함께 써야 합니다', 'stale-while-revalidate needs max-age or s-maxage'));
    var summary = '';
    if (has('no-store')) summary = t('어디에도 저장되지 않습니다', 'Never stored anywhere');
    else if (has('no-cache')) summary = t('저장될 수 있지만 사용할 때마다 서버에 재검증합니다', 'May be stored but revalidated on every use');
    else if (has('max-age') || has('s-maxage')) summary = t('브라우저: ' + (has('max-age') ? human(val('max-age')) : (has('s-maxage') ? '(max-age 없음 — 휴리스틱)' : '')) + ' / 공유 캐시: ' + (has('s-maxage') ? human(val('s-maxage')) : has('max-age') ? human(val('max-age')) : ''), 'Browser: ' + (has('max-age') ? human(val('max-age')) : '(no max-age — heuristic)') + ' / Shared cache: ' + (has('s-maxage') ? human(val('s-maxage')) : has('max-age') ? human(val('max-age')) : ''));
    else summary = t('명시된 신선 시간이 없어 캐시가 휴리스틱으로 정합니다', 'No explicit freshness — caches apply heuristics');
    return { _status: issues.length ? { ok: 'info', msg: t('⚠️ ' + summary + ' — 점검할 항목 ' + issues.length + '개', '⚠️ ' + summary + ' — ' + issues.length + ' item(s) to check') } : '✅ ' + summary, out: 'Cache-Control: ' + header, table: { head: [['지시어', 'Directive'], ['값', 'Value'], ['의미', 'Meaning']], rows: rows }, issues: issues };
  }
});
