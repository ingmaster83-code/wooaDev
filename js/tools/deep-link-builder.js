TK.tool('deep-link-builder', {
  inputs: [
    { id: 'params', label: ['쿼리 파라미터 (한 줄에 key=value)', 'Query parameters (key=value per line)'], rows: 4, sample: 'id=42\nref=email campaign\nutm_source=news', show: function (o) { return o.mode === 'build'; } },
    { id: 'parse', label: ['분석할 링크 (URL 또는 intent:// URI)', 'Link to analyse (URL or intent:// URI)'], rows: 4, sample: 'intent://product/42?ref=mail#Intent;scheme=myapp;package=com.example.shop;S.browser_fallback_url=https%3A%2F%2Fshop.example.com%2Fproduct%2F42;end', show: function (o) { return o.mode === 'parse'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['build', ['링크 만들기', 'Build links']], ['parse', ['링크 분석', 'Parse a link']]], default: 'build' },
    { id: 'scheme', type: 'text', label: ['커스텀 스킴', 'Custom scheme'], default: 'myapp', show: function (o) { return o.mode === 'build'; } },
    { id: 'host', type: 'text', label: ['호스트 / 경로 시작', 'Host / first segment'], default: 'product', show: function (o) { return o.mode === 'build'; } },
    { id: 'path', type: 'text', label: ['경로', 'Path'], default: '42', show: function (o) { return o.mode === 'build'; } },
    { id: 'web', type: 'text', label: ['웹 도메인 (유니버설/앱 링크용)', 'Web domain (universal / app links)'], default: 'shop.example.com', show: function (o) { return o.mode === 'build'; } },
    { id: 'pkg', type: 'text', label: ['Android 패키지 이름', 'Android package name'], default: 'com.example.shop', show: function (o) { return o.mode === 'build'; } },
    { id: 'fallback', type: 'text', label: ['앱이 없을 때 이동할 URL (Android)', 'Fallback URL when the app is missing (Android)'], default: 'https://play.google.com/store/apps/details?id=com.example.shop', show: function (o) { return o.mode === 'build'; } }
  ],
  outputs: [{ id: 'out', label: ['링크', 'Links'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['구성 요소', 'Components'], kind: 'table' }, { id: 'code', label: ['설정 예시', 'Configuration samples'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], rows = [];
    if (o.mode === 'parse') {
      var s = String(v.parse || '').trim(); if (!s) throw new Error(t('링크를 입력하세요', 'Enter a link'));
      if (/^intent:/i.test(s)) {
        var m = /^intent:(.*?)#Intent;(.*?);?end$/i.exec(s.replace(/;end;?$/i, ';end'));
        if (!m) throw new Error(t('intent URI 형식이 아닙니다 (intent://…#Intent;…;end)', 'Not an intent URI (intent://…#Intent;…;end)'));
        var attrs = {}; m[2].split(';').filter(Boolean).forEach(function (kv) { var j = kv.indexOf('='); attrs[j < 0 ? kv : kv.slice(0, j)] = j < 0 ? '' : decodeURIComponent(kv.slice(j + 1)); });
        rows.push(['intent', 'intent:' + m[1]]); Object.keys(attrs).forEach(function (k) { rows.push([k, attrs[k]]); });
        var url = (attrs.scheme ? attrs.scheme + ':' : '') + m[1]; rows.push([t('실제 열리는 URL', 'Resulting URL'), url]);
        if (!attrs.package) issues.push(t('package 가 없어 여러 앱이 처리할 수 있습니다 (앱 선택 창이 뜸)', 'No package, so several apps may handle it (a chooser appears)'));
        if (!attrs['S.browser_fallback_url']) issues.push(t('앱이 없을 때 이동할 S.browser_fallback_url 이 없습니다', 'No S.browser_fallback_url for when the app is missing'));
        return { _status: t('✅ intent URI 를 분석했습니다', '✅ Intent URI parsed'), out: url, table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, issues: issues };
      }
      var u; try { u = new URL(s); } catch (e) { throw new Error(t('URL 형식이 올바르지 않습니다', 'Invalid URL')); }
      rows.push(['scheme', u.protocol.replace(':', '')], ['host', u.host || '—'], ['path', u.pathname || '/'], ['hash', u.hash || '—']);
      u.searchParams.forEach(function (val, k) { rows.push(['?' + k, val]); });
      var web = /^https?:$/.test(u.protocol);
      issues.push(web ? t('웹 URL 입니다 — 유니버설 링크(iOS)/앱 링크(Android)로 앱을 열려면 도메인 연결 파일이 필요합니다', 'A web URL — to open the app (iOS universal links / Android app links) the domain needs association files') : t('커스텀 스킴입니다 — 앱이 설치되지 않았으면 열리지 않으며, 다른 앱이 같은 스킴을 가로챌 수 있습니다', 'A custom scheme — it fails when the app is not installed and another app can claim the same scheme'));
      return { _status: t('✅ 링크를 분석했습니다', '✅ Link parsed'), out: s, table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, issues: issues };
    }
    var scheme = (o.scheme || '').trim(), host = (o.host || '').trim().replace(/^\/+|\/+$/g, ''), path = (o.path || '').trim().replace(/^\/+/, ''), web2 = (o.web || '').trim(), pkg = (o.pkg || '').trim(), fb = (o.fallback || '').trim();
    if (!scheme && !web2) throw new Error(t('스킴 또는 웹 도메인을 입력하세요', 'Enter a scheme or a web domain'));
    if (scheme && !/^[a-z][a-z0-9+.-]*$/i.test(scheme)) throw new Error(t('스킴은 영문으로 시작하고 영문·숫자·+ . - 만 쓸 수 있습니다', 'A scheme starts with a letter and may contain letters, digits, + . -'));
    var qp = []; String(v.params || '').replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (ln) { var j = ln.indexOf('='); qp.push(j < 0 ? [ln, ''] : [ln.slice(0, j).trim(), ln.slice(j + 1).trim()]); });
    var query = qp.length ? '?' + qp.map(function (p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); }).join('&') : '';
    var tail = (host ? host : '') + (path ? '/' + path : '');
    var custom = scheme ? scheme + '://' + tail + query : '';
    var universal = web2 ? 'https://' + web2 + '/' + [host, path].filter(Boolean).join('/') + query : '';
    var intent = scheme ? 'intent://' + tail + query + '#Intent;scheme=' + scheme + (pkg ? ';package=' + pkg : '') + (fb ? ';S.browser_fallback_url=' + encodeURIComponent(fb) : '') + ';end' : '';
    var out = [];
    if (custom) out.push('# ' + t('커스텀 스킴 (iOS/Android)', 'Custom scheme (iOS / Android)'), custom, '');
    if (universal) out.push('# ' + t('유니버설 링크(iOS) / 앱 링크(Android)', 'Universal link (iOS) / App link (Android)'), universal, '');
    if (intent) out.push('# ' + t('Android Intent URI (Chrome 에서 앱 열기 + 대체 URL)', 'Android intent URI (open the app from Chrome + fallback URL)'), intent, '');
    out.push('# ' + t('테스트 명령', 'Test commands'));
    if (custom) { out.push('adb shell am start -a android.intent.action.VIEW -d "' + custom + '"' + (pkg ? ' ' + pkg : ''), 'xcrun simctl openurl booted "' + custom + '"'); }
    if (universal) out.push('adb shell am start -a android.intent.action.VIEW -d "' + universal + '"', 'xcrun simctl openurl booted "' + universal + '"');
    rows.push(['scheme', scheme || '—'], ['host', host || '—'], ['path', path ? '/' + path : '—'], ['query', qp.length ? qp.map(function (p) { return p[0]; }).join(', ') : '—'], ['web', web2 || '—'], ['package', pkg || '—']);
    var code = [];
    if (scheme) code.push('<!-- AndroidManifest.xml -->', '<activity android:name=".DeepLinkActivity" android:exported="true">', '  <intent-filter>', '    <action android:name="android.intent.action.VIEW" />', '    <category android:name="android.intent.category.DEFAULT" />', '    <category android:name="android.intent.category.BROWSABLE" />', '    <data android:scheme="' + scheme + '" android:host="' + (host || '*') + '" />', '  </intent-filter>' + (web2 ? '\n  <intent-filter android:autoVerify="true">\n    <action android:name="android.intent.action.VIEW" />\n    <category android:name="android.intent.category.DEFAULT" />\n    <category android:name="android.intent.category.BROWSABLE" />\n    <data android:scheme="https" android:host="' + web2 + '"' + (host ? ' android:pathPrefix="/' + host + '"' : '') + ' />\n  </intent-filter>' : ''), '</activity>', '');
    if (web2) code.push('// https://' + web2 + '/.well-known/assetlinks.json', '[{ "relation": ["delegate_permission/common.handle_all_urls"], "target": { "namespace": "android_app", "package_name": "' + (pkg || 'com.example.app') + '", "sha256_cert_fingerprints": ["AA:BB:…"] } }]', '', '// https://' + web2 + '/.well-known/apple-app-site-association  (Content-Type: application/json, ' + t('확장자 없음', 'no extension') + ')', '{ "applinks": { "details": [{ "appIDs": ["TEAMID.com.example.app"], "components": [{ "/": "/' + (host || '*') + '/*" }] }] } }', '', '// iOS: Associated Domains → applinks:' + web2);
    if (scheme) code.push('', '// iOS Info.plist (URL Types) → URL Schemes: ' + scheme);
    if (scheme) issues.push(t('커스텀 스킴은 누구나 등록할 수 있어 로그인 토큰 전달에 쓰면 가로채기 위험이 있습니다 — 중요한 흐름에는 유니버설/앱 링크를 쓰세요', 'Anyone can register a custom scheme, so do not pass login tokens through it; use universal / app links for sensitive flows'));
    if (web2 && !pkg) issues.push(t('앱 링크 검증에는 Android 패키지 이름이 필요합니다', 'Android app-link verification needs the package name'));
    if (intent && fb && !/^https:/.test(fb)) issues.push(t('S.browser_fallback_url 은 https 를 권장합니다', 'Prefer https for S.browser_fallback_url'));
    if (qp.some(function (p) { return /[^\x00-\x7f ]/.test(p[1]); })) issues.push(t('한글 값은 퍼센트 인코딩되었습니다 — 앱에서 반드시 디코딩하세요', 'Non-ASCII values were percent-encoded; decode them in the app'));
    issues.push(t('Android 12+ 는 앱 링크 검증(assetlinks.json)을 통과하지 못하면 웹 링크가 앱으로 열리지 않습니다', 'On Android 12+ web links only open the app when assetlinks.json verification passes'));
    return { _status: t('✅ 딥 링크를 만들었습니다', '✅ Deep links built'), out: out.join('\n'), table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, code: code.join('\n'), issues: issues };
  }
});
