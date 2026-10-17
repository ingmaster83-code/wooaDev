TK.tool('android-manifest-viewer', {
  sampleExpectError: true,
  inputs: [
    { id: 'in', label: ['AndroidManifest.xml (텍스트) 또는 APK 안의 바이너리 매니페스트 (16진수 / Base64)', 'AndroidManifest.xml (text) or the binary manifest from an APK (hex / Base64)'], rows: 16, sample: '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    package="com.wooahouse.demo"\n    android:versionCode="12"\n    android:versionName="1.2.0">\n\n    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />\n\n    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />\n    <uses-permission android:name="android.permission.READ_SMS" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />\n\n    <application\n        android:name=".App"\n        android:label="Wooa Demo"\n        android:debuggable="true"\n        android:usesCleartextTraffic="true">\n\n        <activity android:name=".MainActivity">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n\n        <activity android:name=".LinkActivity" android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="https" android:host="wooahouse.com" android:pathPrefix="/open" />\n            </intent-filter>\n        </activity>\n\n        <service android:name=".SyncService" android:exported="true" />\n\n        <provider\n            android:name=".DataProvider"\n            android:authorities="com.wooahouse.demo.provider"\n            android:exported="true" />\n    </application>\n</manifest>', show: function (o) { return o.mode !== 'file'; } },
    { id: 'file', type: 'file', buffer: true, label: ['AndroidManifest.xml 파일 선택 (APK 에서 꺼낸 바이너리도 가능 — 서버로 전송되지 않습니다)', 'Choose AndroidManifest.xml (the binary one extracted from an APK also works — never uploaded)'], show: function (o) { return o.mode === 'file'; } }
  ],
  options: [TK.binin.modeOption(), TK.binin.fmtOption(), { id: 'hints', type: 'checkbox', label: ['권고(ℹ️)도 표시', 'Also show hints (ℹ️)'], default: true }],
  outputs: [{ id: 'info', label: ['앱 정보', 'App info'], kind: 'table' }, { id: 'perm', label: ['권한', 'Permissions'], kind: 'table' }, { id: 'comp', label: ['컴포넌트', 'Components'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'xml', label: ['디코딩된 XML', 'Decoded XML'], kind: 'code', ext: 'xml' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [], root, binary = false;
    var NSA = 'http://schemas.android.com/apk/res/android';
    var RES = { 0x01010000: 'theme', 0x01010001: 'label', 0x01010002: 'icon', 0x01010003: 'name', 0x01010006: 'permission', 0x0101000f: 'debuggable', 0x01010010: 'exported', 0x01010018: 'authorities', 0x01010026: 'mimeType', 0x01010027: 'scheme', 0x01010028: 'host', 0x01010029: 'port', 0x0101002a: 'path', 0x0101002b: 'pathPrefix', 0x0101002c: 'pathPattern', 0x0101020c: 'minSdkVersion', 0x0101021b: 'versionCode', 0x0101021c: 'versionName', 0x01010270: 'targetSdkVersion', 0x01010271: 'maxSdkVersion', 0x01010280: 'allowBackup', 0x010104ec: 'usesCleartextTraffic', 0x010104ee: 'autoVerify', 0x0101001b: 'process', 0x01010011: 'grantUriPermissions', 0x01010012: 'readPermission', 0x01010013: 'writePermission', 0x0101001c: 'enabled', 0x010103a6: 'requestLegacyExternalStorage', 0x010102d3: 'networkSecurityConfig', 0x0101000e: 'compileSdkVersion' };
    /* ------------- 입력 ------------- */
    var bytes = null, text = null;
    if (o.mode === 'file') { var f = v.file; if (!f || !f.buf) throw new Error(t('파일을 선택하세요', 'Choose a file')); bytes = new Uint8Array(f.buf); }
    else { var s = String(v['in'] || '').trim(); if (!s) throw new Error(t('매니페스트를 입력하세요', 'Enter a manifest')); if (s.charAt(0) === '<') text = s; else bytes = N.get({ in: s }, { mode: 'text', fmt: o.fmt }).bytes; }
    if (bytes && bytes[0] === 0x3c) { text = new TextDecoder('utf-8').decode(bytes); bytes = null; }
    /* ------------- AXML 디코더 ------------- */
    function decodeAxml(u8) {
      var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), pool = [], resIds = [], stack = [], rootEl = null, nsMap = {}, uriPrefix = {};
      if (u8.length < 8 || dv.getUint16(0, true) !== 3) throw new Error(t('바이너리 XML(AXML) 형식이 아닙니다 (첫 2바이트가 03 00 이어야 합니다)', 'Not binary XML (AXML): the first 2 bytes must be 03 00'));
      var pos = dv.getUint16(2, true), end = Math.min(dv.getUint32(4, true), u8.length);
      function readLen8(p) { var l = u8[p++]; if (l & 0x80) l = ((l & 0x7f) << 8) | u8[p++]; return [l, p]; }
      function parsePool(p, size, hsz) {
        var cnt = dv.getUint32(p + 8, true), flags = dv.getUint32(p + 16, true), sstart = dv.getUint32(p + 20, true), utf8 = !!(flags & 0x100), base = p + sstart, offs = p + hsz;
        for (var i = 0; i < cnt; i++) {
          var q = base + dv.getUint32(offs + i * 4, true), str;
          if (utf8) { var a = readLen8(q), b2 = readLen8(a[1]); str = new TextDecoder('utf-8').decode(u8.subarray(b2[1], b2[1] + b2[0])); }
          else { var l = dv.getUint16(q, true), qq = q + 2; if (l & 0x8000) { l = ((l & 0x7fff) << 16) | dv.getUint16(qq, true); qq += 2; } var cs = []; for (var k = 0; k < l; k++) cs.push(dv.getUint16(qq + k * 2, true)); str = String.fromCharCode.apply(null, cs); }
          pool.push(str);
        }
      }
      function S(i) { return i === -1 || i === 0xffffffff || i == null ? null : (pool[i] !== undefined ? pool[i] : null); }
      function fmtVal(raw, type, data) {
        if (raw !== -1 && raw !== 0xffffffff && S(raw) !== null) return S(raw);
        switch (type) {
          case 0x12: return data ? 'true' : 'false';
          case 0x10: return String(data | 0);
          case 0x11: return '0x' + (data >>> 0).toString(16);
          case 0x01: return '@' + ((data >>> 0) >>> 24 === 0x01 ? 'android:' : '') + '0x' + (data >>> 0).toString(16);
          case 0x02: return '?0x' + (data >>> 0).toString(16);
          case 0x04: { var fb = new DataView(new ArrayBuffer(4)); fb.setUint32(0, data >>> 0); return String(+fb.getFloat32(0).toPrecision(7)); }
          case 0x1c: case 0x1d: case 0x1e: case 0x1f: return '#' + ('00000000' + (data >>> 0).toString(16)).slice(-(type === 0x1c || type === 0x1d ? 8 : 6)).replace(/^(..)(.{6})$/, '$1$2');
          case 0x03: return S(data) || '';
          default: return '0x' + (data >>> 0).toString(16) + ' (type 0x' + type.toString(16) + ')';
        }
      }
      while (pos + 8 <= end) {
        var ty = dv.getUint16(pos, true), hs = dv.getUint16(pos + 2, true), sz = dv.getUint32(pos + 4, true);
        if (sz < 8 || pos + sz > u8.length + 0) { if (pos + sz > u8.length) throw new Error(t('청크가 파일 끝을 넘습니다 — 파일이 잘렸습니다', 'A chunk runs past the end of the file; the file is truncated')); }
        if (ty === 0x0001) parsePool(pos, sz, hs);
        else if (ty === 0x0180) { for (var r = pos + hs; r < pos + sz; r += 4) resIds.push(dv.getUint32(r, true)); }
        else if (ty === 0x0100) { var pfx = S(dv.getInt32(pos + 16, true)), uri = S(dv.getInt32(pos + 20, true)); uriPrefix[uri] = pfx; }
        else if (ty === 0x0102) {
          var ns = dv.getInt32(pos + 16, true), nm = S(dv.getInt32(pos + 20, true)), aStart = dv.getUint16(pos + 24, true), aSize = dv.getUint16(pos + 26, true) || 20, aCnt = dv.getUint16(pos + 28, true), line = dv.getUint32(pos + 8, true);
          var el = { name: nm, attrs: [], children: [], line: line }, ap = pos + 16 + aStart;
          for (var a = 0; a < aCnt; a++, ap += aSize) {
            var ans = dv.getInt32(ap, true), anm = dv.getInt32(ap + 4, true), raw = dv.getInt32(ap + 8, true), type = u8[ap + 15], data = dv.getUint32(ap + 16, true);
            var name = S(anm); if (!name && resIds[anm] !== undefined) name = RES[resIds[anm]] || ('attr_0x' + resIds[anm].toString(16));
            var nsUri = S(ans), prefix = nsUri ? (uriPrefix[nsUri] || (nsUri === NSA ? 'android' : 'ns')) : '';
            el.attrs.push([(prefix ? prefix + ':' : '') + (name || '?'), fmtVal(raw, type, data)]);
          }
          if (stack.length) stack[stack.length - 1].children.push(el); else rootEl = el;
          stack.push(el);
        } else if (ty === 0x0103) stack.pop();
        pos += sz;
      }
      if (!rootEl) throw new Error(t('요소를 찾지 못했습니다', 'No elements found'));
      Object.keys(uriPrefix).forEach(function (u) { if (u !== NSA) rootEl.attrs.unshift(['xmlns:' + uriPrefix[u], u]); });
      if (uriPrefix[NSA] !== undefined) rootEl.attrs.unshift(['xmlns:' + uriPrefix[NSA], NSA]);
      return rootEl;
    }
    function fromText(src) {
      var d = TK.xml.parse(src);
      function conv(e) { return { name: e.name, attrs: e.attrs.map(function (a) { return [a[0], a[1]]; }), children: e.children.filter(function (c) { return c.name; }).map(conv), line: 0 }; }
      return conv(d.root);
    }
    try { if (bytes) { binary = true; root = decodeAxml(bytes); } else root = fromText(text); }
    catch (e) { if (e instanceof RangeError) throw new Error(t('바이너리 XML 이 잘못되었거나 잘렸습니다', 'The binary XML is corrupt or truncated')); throw e; }
    if (root.name !== 'manifest') throw new Error(t('루트 요소가 <manifest> 가 아닙니다 (<' + root.name + '>)', 'The root element is not <manifest> (<' + root.name + '>)'));
    /* ------------- 헬퍼 ------------- */
    function attr(el, n) { for (var i = 0; i < el.attrs.length; i++) { var k = el.attrs[i][0]; if (k === n || k === 'android:' + n || k.replace(/^[^:]+:/, '') === n) return el.attrs[i][1]; } return null; }
    function kids(el, n) { return el.children.filter(function (c) { return c.name === n; }); }
    function pretty(el, ind) {
      var pad = new Array(ind + 1).join('  '), at = el.attrs.map(function (a) { return a[0] + '="' + String(a[1]).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"'; });
      var head = pad + '<' + el.name + (at.length ? (at.length > 2 && ind ? '\n' + pad + '    ' + at.join('\n' + pad + '    ') : ' ' + at.join(' ')) : '');
      if (!el.children.length) return head + '/>';
      return head + '>\n' + el.children.map(function (c) { return pretty(c, ind + 1); }).join('\n') + '\n' + pad + '</' + el.name + '>';
    }
    var pkg = attr(root, 'package') || '', app = kids(root, 'application')[0] || { attrs: [], children: [] }, sdk = kids(root, 'uses-sdk')[0] || { attrs: [], children: [] };
    function num(x) { return x == null ? null : (/^0x/i.test(x) ? parseInt(x, 16) : /^\d+$/.test(x) ? Number(x) : null); }
    var minSdk = num(attr(sdk, 'minSdkVersion')), targetSdk = num(attr(sdk, 'targetSdkVersion')), compile = num(attr(root, 'compileSdkVersion'));
    if (targetSdk == null && minSdk != null) targetSdk = minSdk;
    var info = [[['패키지', 'Package'], pkg || '—'], [['versionName', 'versionName'], attr(root, 'versionName') || '—'], [['versionCode', 'versionCode'], attr(root, 'versionCode') || '—'], [['minSdkVersion', 'minSdkVersion'], attr(sdk, 'minSdkVersion') || '—'], [['targetSdkVersion', 'targetSdkVersion'], attr(sdk, 'targetSdkVersion') || '—'], [['compileSdkVersion', 'compileSdkVersion'], compile == null ? '—' : String(compile)], [['앱 이름 (label)', 'App label'], attr(app, 'label') || '—'], [['Application 클래스', 'Application class'], attr(app, 'name') || '—'], [['형식', 'Source'], binary ? t('바이너리 XML (AXML)', 'Binary XML (AXML)') : t('텍스트 XML', 'Text XML')]];
    function full(n) { if (!n) return n; if (n.charAt(0) === '.') return pkg + n; if (n.indexOf('.') < 0) return pkg + '.' + n; return n; }
    function boolAttr(el, n) { var x = attr(el, n); return x == null ? null : (x === 'true' || x === '1' || x === '0xffffffff' || x === 'TRUE'); }
    function add(sev, msg) { issues.push({ sev: sev, msg: msg }); }
    /* ------------- 권한 ------------- */
    var DANGER = 'CAMERA RECORD_AUDIO ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION ACCESS_BACKGROUND_LOCATION READ_CONTACTS WRITE_CONTACTS GET_ACCOUNTS READ_CALENDAR WRITE_CALENDAR READ_PHONE_STATE READ_PHONE_NUMBERS CALL_PHONE READ_CALL_LOG WRITE_CALL_LOG ADD_VOICEMAIL USE_SIP PROCESS_OUTGOING_CALLS ANSWER_PHONE_CALLS SEND_SMS RECEIVE_SMS READ_SMS RECEIVE_WAP_PUSH RECEIVE_MMS READ_EXTERNAL_STORAGE WRITE_EXTERNAL_STORAGE BODY_SENSORS BODY_SENSORS_BACKGROUND ACTIVITY_RECOGNITION READ_MEDIA_IMAGES READ_MEDIA_VIDEO READ_MEDIA_AUDIO READ_MEDIA_VISUAL_USER_SELECTED POST_NOTIFICATIONS NEARBY_WIFI_DEVICES BLUETOOTH_CONNECT BLUETOOTH_SCAN BLUETOOTH_ADVERTISE UWB_RANGING'.split(' ');
    var SPECIAL = { SYSTEM_ALERT_WINDOW: 'ALERT', WRITE_SETTINGS: 'SPECIAL', MANAGE_EXTERNAL_STORAGE: 'ALERT', REQUEST_INSTALL_PACKAGES: 'ALERT', SCHEDULE_EXACT_ALARM: 'SPECIAL', USE_EXACT_ALARM: 'SPECIAL', USE_FULL_SCREEN_INTENT: 'SPECIAL', QUERY_ALL_PACKAGES: 'ALERT', BIND_ACCESSIBILITY_SERVICE: 'ALERT', PACKAGE_USAGE_STATS: 'SPECIAL', READ_LOGS: 'ALERT', INSTALL_PACKAGES: 'ALERT', DELETE_PACKAGES: 'ALERT', WRITE_SECURE_SETTINGS: 'ALERT', MOUNT_UNMOUNT_FILESYSTEMS: 'ALERT', BIND_DEVICE_ADMIN: 'ALERT', FOREGROUND_SERVICE: 'NORMAL' };
    var permRows = [], permSeen = {};
    root.children.filter(function (c) { return /^uses-permission/.test(c.name); }).forEach(function (p) {
      var n = attr(p, 'name') || '?', short = n.replace(/^android\.permission\./, ''), lvl;
      if (permSeen[n]) add('warn', t('권한 ' + n + ' 이(가) 중복 선언되었습니다', 'Permission ' + n + ' is declared twice')); permSeen[n] = 1;
      if (/^android\.permission\./.test(n) && DANGER.indexOf(short) >= 0) lvl = t('위험 (런타임 요청)', 'dangerous (runtime)'); else if (SPECIAL[short] === 'ALERT') lvl = t('특수·민감', 'special / sensitive'); else if (SPECIAL[short] === 'SPECIAL') lvl = t('특수 접근', 'special access'); else if (/^android\.permission\./.test(n)) lvl = t('일반', 'normal'); else lvl = t('앱/서드파티', 'app / third party');
      var max = attr(p, 'maxSdkVersion'); permRows.push([n, lvl + (max ? ' · maxSdk ' + max : '') + (p.name === 'uses-permission-sdk-23' ? ' · sdk23' : '')]);
      if (SPECIAL[short] === 'ALERT' && o.hints !== false) add('warn', t('민감 권한 ' + short + ': 스토어 심사에서 사용 사유 설명이 필요할 수 있습니다', 'Sensitive permission ' + short + ': the store may require a justification'));
      if (/^(READ_SMS|SEND_SMS|RECEIVE_SMS|READ_CALL_LOG|WRITE_CALL_LOG|PROCESS_OUTGOING_CALLS)$/.test(short)) add('warn', t(short + ' 은(는) Google Play 의 SMS·통화 기록 정책 대상입니다 (기본 핸들러만 허용)', short + ' falls under the Google Play SMS / call-log policy (default handlers only)'));
      if (short === 'READ_EXTERNAL_STORAGE' && targetSdk >= 33 && o.hints !== false) add('info', t('targetSdk 33+ 에서는 READ_EXTERNAL_STORAGE 가 미디어 접근에 효과가 없습니다 (READ_MEDIA_* 사용)', 'With targetSdk 33+, READ_EXTERNAL_STORAGE no longer grants media access (use READ_MEDIA_*)'));
      if (short === 'WRITE_EXTERNAL_STORAGE' && targetSdk >= 30 && !max && o.hints !== false) add('info', t('targetSdk 30+ 에서 WRITE_EXTERNAL_STORAGE 는 사실상 무시됩니다 (scoped storage)', 'With targetSdk 30+, WRITE_EXTERNAL_STORAGE is effectively ignored (scoped storage)'));
      if (short === 'ACCESS_BACKGROUND_LOCATION') add('warn', t('백그라운드 위치는 별도 심사와 사용 사유가 필요합니다', 'Background location needs a separate review and justification'));
    });
    kids(root, 'permission').forEach(function (p) { var lv = attr(p, 'protectionLevel'); permRows.push([attr(p, 'name') + ' (' + t('정의', 'defined') + ')', t('보호 수준 ', 'protection ') + (lv || 'normal')]); if (!lv || lv === 'normal' || lv === '0x0') add('warn', t('사용자 정의 권한 ' + attr(p, 'name') + ' 의 protectionLevel 이 normal 입니다. 다른 앱이 자유롭게 받을 수 있어 보호 효과가 없습니다', 'Custom permission ' + attr(p, 'name') + ' has protectionLevel normal; any app can obtain it, so it protects nothing')); });
    /* ------------- 컴포넌트 ------------- */
    var compRows = [], launcher = false, comps = ['activity', 'activity-alias', 'service', 'receiver', 'provider'];
    function filters(c) {
      return kids(c, 'intent-filter').map(function (f) {
        var acts = kids(f, 'action').map(function (a) { return attr(a, 'name'); }), cats = kids(f, 'category').map(function (a) { return attr(a, 'name') || ''; }), data = kids(f, 'data').map(function (d) { var sc = attr(d, 'scheme'), h = attr(d, 'host'), pp = attr(d, 'pathPrefix') || attr(d, 'path') || attr(d, 'pathPattern'), mt = attr(d, 'mimeType'); return (sc ? sc + '://' : '') + (h || '') + (pp || '') + (mt ? ' ' + mt : ''); });
        return { acts: acts, cats: cats, data: data, auto: boolAttr(f, 'autoVerify'), text: acts.map(function (a) { return String(a).replace('android.intent.action.', ''); }).join(',') + (cats.length ? ' [' + cats.map(function (x) { return x.replace('android.intent.category.', ''); }).join(',') + ']' : '') + (data.length ? ' ' + data.join(' | ') : '') };
      });
    }
    app.children.filter(function (c) { return comps.indexOf(c.name) >= 0; }).forEach(function (c) {
      var nm = full(attr(c, 'name') || attr(c, 'targetActivity')) || '?', ex = boolAttr(c, 'exported'), perm = attr(c, 'permission'), fl = filters(c), has = fl.length > 0, en = boolAttr(c, 'enabled');
      var effective = ex !== null ? ex : (c.name === 'provider' ? (targetSdk != null && targetSdk <= 16) : has);
      compRows.push([c.name, nm, ex === null ? (has ? t('미지정 (필터 있음)', 'unset (has filter)') : t('미지정', 'unset')) : String(ex), perm || '—', fl.map(function (f) { return f.text; }).join(' ; ') || '—']);
      if (ex === null && has && targetSdk != null && targetSdk >= 31) add('error', t(c.name + ' ' + nm + ': targetSdk 31+ 에서 intent-filter 가 있는 컴포넌트는 android:exported 를 반드시 지정해야 합니다 (미지정 시 설치 실패)', c.name + ' ' + nm + ': with targetSdk 31+, a component with an intent-filter must declare android:exported (otherwise installation fails)'));
      if (effective && !perm && c.name !== 'activity' && c.name !== 'activity-alias') add('warn', t(c.name + ' ' + nm + ' 이(가) 외부 앱에 공개(exported)되어 있고 보호 권한이 없습니다', c.name + ' ' + nm + ' is exported without a protecting permission'));
      if (c.name === 'provider') {
        if (effective) add('warn', t('ContentProvider ' + nm + ' 이(가) 공개되어 있습니다. 데이터 유출·SQL 인젝션 경로가 될 수 있어 readPermission/writePermission 을 지정하세요', 'ContentProvider ' + nm + ' is exported; set readPermission / writePermission to avoid data leaks and injection'));
        if (boolAttr(c, 'grantUriPermissions') === true && o.hints !== false) add('info', t('provider ' + nm + ': grantUriPermissions=true 입니다. 필요한 경로만 <grant-uri-permission> 으로 한정하세요', 'provider ' + nm + ' uses grantUriPermissions=true; narrow it with <grant-uri-permission>'));
        if (attr(c, 'authorities')) compRows[compRows.length - 1][4] = 'authorities=' + attr(c, 'authorities') + (compRows[compRows.length - 1][4] !== '—' ? ' ; ' + compRows[compRows.length - 1][4] : '');
      }
      if (c.name === 'service' && attr(c, 'permission') === null && /BIND/.test(fl.map(function (f) { return f.text; }).join(''))) add('info', t('service ' + nm + ' 은(는) 시스템 바인딩 서비스처럼 보이지만 BIND_* 권한이 지정되지 않았습니다', 'service ' + nm + ' looks like a system-bound service but declares no BIND_* permission'));
      fl.forEach(function (f) {
        if (f.acts.indexOf('android.intent.action.MAIN') >= 0 && f.cats.indexOf('android.intent.category.LAUNCHER') >= 0) launcher = true;
        var browsable = f.cats.indexOf('android.intent.category.BROWSABLE') >= 0, viewA = f.acts.indexOf('android.intent.action.VIEW') >= 0;
        if (browsable && viewA && /^https?:\/\//.test(f.data.join(' ')) && !f.auto && o.hints !== false) add('info', t(nm + ': http(s) 딥링크에 android:autoVerify="true" 가 없어 앱 링크(App Links) 검증을 받지 못합니다', nm + ': http(s) deep link without android:autoVerify="true", so Android App Links are not verified'));
        if (f.acts.length === 0 && f.cats.length && !f.data.length) add('warn', t(nm + ': intent-filter 에 action 이 없습니다 (아무 Intent 도 일치하지 않음)', nm + ': intent-filter has no action, so no Intent can match'));
      });
      if (en === false) compRows[compRows.length - 1][1] += ' (disabled)';
    });
    if (!launcher) add('info', t('MAIN/LAUNCHER 액티비티가 없습니다 (라이브러리 또는 헤드리스 앱이면 정상)', 'No MAIN / LAUNCHER activity (fine for libraries or headless apps)'));
    /* ------------- application 설정 ------------- */
    if (boolAttr(app, 'debuggable') === true) add('error', t('android:debuggable="true" 입니다. 릴리스 빌드에서는 반드시 꺼야 합니다 (앱 데이터 접근·코드 주입 위험)', 'android:debuggable="true": it must be off in release builds (exposes app data and allows code injection)'));
    var ab = boolAttr(app, 'allowBackup'), cleartext = boolAttr(app, 'usesCleartextTraffic');
    if (ab !== false) add(ab === true ? 'warn' : 'info', t('allowBackup' + (ab === true ? '=true' : ' 미지정(기본 true)') + ': adb backup/클라우드 백업으로 앱 데이터가 추출될 수 있습니다. 민감 데이터가 있으면 false 로 하거나 dataExtractionRules 를 지정하세요', 'allowBackup' + (ab === true ? '=true' : ' unset (defaults to true)') + ': app data can be extracted via adb backup / cloud backup; set false or define dataExtractionRules for sensitive data'));
    if (cleartext === true) add('warn', t('usesCleartextTraffic="true": HTTP 평문 통신을 허용합니다 (도청·변조 위험)', 'usesCleartextTraffic="true" allows plain HTTP traffic (eavesdropping / tampering)'));
    else if (cleartext === null && targetSdk != null && targetSdk < 28) add('warn', t('targetSdk ' + targetSdk + ' < 28 에서는 평문 HTTP 가 기본 허용됩니다', 'With targetSdk ' + targetSdk + ' < 28, plain HTTP is allowed by default'));
    if (!attr(app, 'networkSecurityConfig') && o.hints !== false) add('info', t('networkSecurityConfig 가 없습니다. 인증서 고정·평문 예외를 관리하려면 지정하세요', 'No networkSecurityConfig; add one to manage certificate pinning and cleartext exceptions'));
    if (attr(root, 'sharedUserId')) add('warn', t('sharedUserId 는 API 29 부터 사용 중단되었습니다', 'sharedUserId is deprecated since API 29'));
    if (boolAttr(app, 'requestLegacyExternalStorage') === true && targetSdk >= 30) add('info', t('requestLegacyExternalStorage 는 targetSdk 30+ 에서 무시됩니다', 'requestLegacyExternalStorage is ignored with targetSdk 30+'));
    if (targetSdk != null && targetSdk < 33) add('warn', t('targetSdkVersion ' + targetSdk + ' 은(는) 낮습니다. Google Play 는 신규·업데이트 앱에 최신 API 수준에 가까운 targetSdk 를 요구합니다 (현재 요구 수준은 Play Console 에서 확인)', 'targetSdkVersion ' + targetSdk + ' is low. Google Play requires a recent targetSdk for new and updated apps (check the current requirement in Play Console)'));
    if (minSdk != null && minSdk < 21 && o.hints !== false) add('info', t('minSdkVersion ' + minSdk + ' < 21: 오래된 기기를 지원하려면 multidex·보안 패치 부재를 고려하세요', 'minSdkVersion ' + minSdk + ' < 21: consider multidex and missing security patches'));
    if (!sdk.attrs.length) add('warn', t('<uses-sdk> 가 없습니다 (Gradle 이 병합하는 경우 정상일 수 있음)', 'No <uses-sdk> (normal when Gradle merges it in)'));
    if (!pkg) add('error', t('package 속성이 없습니다 (Gradle 의 namespace 로 대체되는 소스 매니페스트라면 정상)', 'No package attribute (fine for a source manifest where the Gradle namespace replaces it)'));
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' }, shown = issues.filter(function (x) { return o.hints !== false || x.sev !== 'info'; });
    var order = { error: 0, warn: 1, info: 2 }; shown.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    var errs = shown.filter(function (x) { return x.sev === 'error'; }).length, warns = shown.filter(function (x) { return x.sev === 'warn'; }).length;
    return { _status: { ok: errs ? false : true, msg: errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — ' + (pkg || 'manifest'), '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + (pkg || 'manifest')) : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — ' + (pkg || 'manifest'), '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + (pkg || 'manifest')) }, info: { head: [['항목', 'Field'], ['값', 'Value']], rows: info.map(function (r) { return [t(r[0][0], r[0][1]), r[1]]; }) }, perm: { head: [['권한', 'Permission'], ['분류', 'Level']], rows: permRows }, comp: { head: [['종류', 'Type'], ['이름', 'Name'], ['exported', 'exported'], ['권한', 'Permission'], ['인텐트 필터', 'Intent filters']], rows: compRows }, issues: shown.map(function (x) { return ICON[x.sev] + ' ' + x.msg; }), xml: pretty(root, 0) };
  }
});
