TK.tool('mobileprovision-viewer', {
  inputs: [
    { id: 'in', label: ['프로비저닝 프로파일 (plist XML 텍스트, 또는 .mobileprovision 의 Base64/16진수)', 'Provisioning profile (plist XML text, or Base64 / hex of a .mobileprovision)'], rows: 12, sample: '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n	<key>AppIDName</key>\n	<string>Wooa Demo</string>\n	<key>ApplicationIdentifierPrefix</key>\n	<array>\n		<string>ABCDE12345</string>\n	</array>\n	<key>CreationDate</key>\n	<date>2026-03-01T09:00:00Z</date>\n	<key>Platform</key>\n	<array>\n		<string>iOS</string>\n	</array>\n	<key>DeveloperCertificates</key>\n	<array>\n		<data>\n			MIIEJjCCAw6gAwIBAgIULtv0YaivYcewDIxv3/H4E4IucsUwDQYJKoZIhvcNAQELBQAwTzELMAkG\n			A1UEBhMCS1IxFzAVBgNVBAoMDldvb2FIb3VzZSBUZXN0MScwJQYDVQQDDB5Xb29hSG91c2UgVGVz\n			dCBJbnRlcm1lZGlhdGUgQ0EwIBcNMjYxMDE3MDI0OTEyWhgPMjEyMjA4MTUwMjQ5MTJaMD0xCzAJ\n			BgNVBAYTAktSMRcwFQYDVQQKDA5Xb29hSG91c2UgVGVzdDEVMBMGA1UEAwwMdGVzdC5leGFtcGxl\n			MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq3nB6psHqkUElGM1kqgLdMjfCUV9OigW\n			4q2J4YXDtWk4Z+EGdy201BBJOnOapvcWyCaa6s0Q+dV996hH52Uc0dsMHxiD5iqOaSmr8avPlVSc\n			MZ9JbM2f8LYCvJ16XxNB3hlPil/PQOTJZSOQlMWERL2AQtIYeAcrXixG6ZjpjS9FD7XS0fL4rQP3\n			Xw2iZbaxYJn+69hTYlH6SLaHqadNCf9VFOVzAxv3/OpxspA3d3rcpNSNKh6Tb9oZ9vzeVte0+nQP\n			Ww1BTnvaeqyBFmC9NkfdHxdIcRzWJ9/+g03v3yE/rcU6aXIp30dHiSeFiHhlU9/LqZBFqi5ZSVA3\n			vcS9NQIDAQABo4IBCDCCAQQwCQYDVR0TBAIwADAOBgNVHQ8BAf8EBAMCB4AwHQYDVR0lBBYwFAYI\n			KwYBBQUHAwEGCCsGAQUFBwMCMEEGA1UdEQQ6MDiCDHRlc3QuZXhhbXBsZYIOKi50ZXN0LmV4YW1w\n			bGWHBMAAAgqBEmFkbWluQHRlc3QuZXhhbXBsZTAdBgNVHQ4EFgQU89AZxtFancCM4XL/Me+9e91C\n			KXEwHwYDVR0jBBgwFoAU/ytKoZx3xtnyF1ygCkv6YkYY7AgwMAYDVR0fBCkwJzAloCOgIYYfaHR0\n			cDovL2NybC50ZXN0LmV4YW1wbGUvaW50LmNybDATBgNVHSAEDDAKMAgGBmeBDAECATANBgkqhkiG\n			9w0BAQsFAAOCAQEArSHrun0l8m3CsM4IHX0WpfCKVMSJPwJv6qkAYVpKpr0WJL/9RMV/KwKZ4EE5\n			8xLxqxkaki/UzAnx7BZ2crikSpzxFqUM5DP7fsEZgNM/CdIE2f8+/ruw+lrb318F1hk/QP769+j2\n			cb+qr495Eqzl9GwwvqjzagOBbnZ6lBG9EcXO6yepHUQ3S1ZrxMX+REzGtZAn2VO7WObL3evqoJb+\n			xMFKJ5hZFWfaxn3YmOr68CY6gOBeZWE9aS+fl3XczmK79xnNdF6OeSR9JScH99w4wnWCZYUteyOy\n			D2xTGjMkluSfJRWHIJfYHq9CkAmiZFsawFLRjx6SDSZp05JhEnRelw==\n		</data>\n	</array>\n	<key>Entitlements</key>\n	<dict>\n		<key>application-identifier</key>\n		<string>ABCDE12345.com.wooahouse.demo</string>\n		<key>com.apple.developer.team-identifier</key>\n		<string>ABCDE12345</string>\n		<key>get-task-allow</key>\n		<true/>\n		<key>aps-environment</key>\n		<string>development</string>\n		<key>keychain-access-groups</key>\n		<array>\n			<string>ABCDE12345.*</string>\n		</array>\n	</dict>\n	<key>ExpirationDate</key>\n	<date>2027-03-01T09:00:00Z</date>\n	<key>Name</key>\n	<string>Wooa Demo Development</string>\n	<key>ProvisionedDevices</key>\n	<array>\n		<string>00008110-001A2B3C4D5E6F78</string>\n		<string>00008101-000E1F2A3B4C5D6E</string>\n	</array>\n	<key>TeamIdentifier</key>\n	<array>\n		<string>ABCDE12345</string>\n	</array>\n	<key>TeamName</key>\n	<string>WooaHouse Test</string>\n	<key>TimeToLive</key>\n	<integer>365</integer>\n	<key>UUID</key>\n	<string>5B6C7D8E-1234-4ABC-9DEF-0123456789AB</string>\n	<key>Version</key>\n	<integer>1</integer>\n</dict>\n</plist>', show: function (o) { return o.mode !== 'file'; } },
    { id: 'file', type: 'file', buffer: true, label: ['파일 선택 (.mobileprovision .provisionprofile — 서버로 전송되지 않습니다)', 'Choose a file (.mobileprovision .provisionprofile — never uploaded)'], show: function (o) { return o.mode === 'file'; } }
  ],
  options: [
    TK.binin.modeOption(), TK.binin.fmtOption(),
    { id: 'at', type: 'text', label: ['기준 시각 (비우면 지금, 예: 2027-01-01T00:00:00Z)', 'Reference time (empty = now, e.g. 2027-01-01T00:00:00Z)'], default: '', sample: '2026-10-01T00:00:00Z' },
    { id: 'udid', type: 'text', label: ['등록 여부를 확인할 기기 UDID (선택)', 'Device UDID to look for (optional)'], default: '' }
  ],
  sampleOptions: { at: '2026-10-01T00:00:00Z', udid: '00008110-001A2B3C4D5E6F78' },
  outputs: [{ id: 'info', label: ['프로파일 정보', 'Profile info'], kind: 'table' }, { id: 'ent', label: ['권한(Entitlements)', 'Entitlements'], kind: 'table' }, { id: 'dev', label: ['등록 기기 (UDID)', 'Provisioned devices (UDID)'], kind: 'table' }, { id: 'certs', label: ['개발자 인증서', 'Developer certificates'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [], text, from = '';
    var raw = o.mode === 'file' ? null : String(v['in'] || '').trim();
    if (o.mode === 'file') { var f = v.file; if (!f || !f.buf) throw new Error(t('파일을 선택하세요', 'Choose a file')); text = null; var bytes = new Uint8Array(f.buf); from = f.name; }
    else {
      if (!raw) throw new Error(t('프로파일을 입력하세요', 'Enter a profile'));
      if (/^\s*(<\?xml|<!DOCTYPE|<plist)/i.test(raw)) text = raw; else var bytes = N.get({ in: raw }, { mode: 'text', fmt: o.fmt }).bytes;
    }
    if (text == null) {
      var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      var a = s.indexOf('<?xml'); if (a < 0) a = s.indexOf('<plist');
      var z = s.lastIndexOf('</plist>');
      if (a < 0 || z < 0) throw new Error(t('프로파일 안에서 plist XML 을 찾지 못했습니다. .mobileprovision 파일이 맞는지 확인하세요', 'No plist XML found inside the profile; check that this is a .mobileprovision file'));
      var seg = bytes.subarray(a, z + 8); text = new TextDecoder('utf-8').decode(seg);
      issues.push(t('CMS 서명 래퍼에서 plist 를 추출했습니다. 서명 자체는 검증하지 않습니다', 'The plist was extracted from the CMS wrapper; the signature itself is not verified'));
    }
    var P; try { P = TK.config.parsePlist(text); } catch (e) { throw new Error(t('plist 해석 실패: ', 'Could not parse the plist: ') + e.message); }
    if (!P || typeof P !== 'object' || Array.isArray(P)) throw new Error(t('프로파일 plist 의 최상위가 사전(dict)이 아닙니다', 'The top level of the profile plist is not a dict'));
    var now = o.at && String(o.at).trim() ? new Date(String(o.at).trim()) : new Date(); if (isNaN(now)) throw new Error(t('기준 시각 형식이 올바르지 않습니다', 'Invalid reference time'));
    function dt(x) { var d = new Date(x); return isNaN(d) ? null : d; }
    function iso(d) { return d ? d.toISOString().replace('.000Z', 'Z') : '—'; }
    var ent = P.Entitlements || {}, devs = Array.isArray(P.ProvisionedDevices) ? P.ProvisionedDevices : [], created = dt(P.CreationDate), expires = dt(P.ExpirationDate);
    var all = P.ProvisionsAllDevices === true, dbg = ent['get-task-allow'] === true, plat = Array.isArray(P.Platform) ? P.Platform.join(', ') : String(P.Platform || '—');
    var type = all ? t('엔터프라이즈 (In-House)', 'Enterprise (In-House)') : devs.length ? (dbg ? t('개발 (Development)', 'Development') : t('Ad Hoc', 'Ad Hoc')) : (/mac|osx/i.test(plat) && !P.ProvisionedDevices ? 'Mac App Store / Developer ID' : t('App Store 배포', 'App Store distribution'));
    var days = expires ? Math.floor((expires - now) / 86400000) : null;
    var appId = ent['application-identifier'] || ent['com.apple.application-identifier'] || '', team = (P.TeamIdentifier || [])[0] || ent['com.apple.developer.team-identifier'] || '';
    var bundle = appId && team && appId.indexOf(team + '.') === 0 ? appId.slice(team.length + 1) : appId;
    var info = [[['프로파일 이름', 'Profile name'], P.Name || '—'], [['UUID', 'UUID'], P.UUID || '—'], [['종류 (추정)', 'Type (inferred)'], type], [['앱 ID 이름', 'App ID name'], P.AppIDName || '—'], [['번들 ID', 'Bundle ID'], bundle || '—'], [['팀', 'Team'], (P.TeamName || '—') + (team ? ' (' + team + ')' : '')], [['플랫폼', 'Platform'], plat], [['생성', 'Created'], iso(created)], [['만료', 'Expires'], iso(expires) + (days !== null ? (days >= 0 ? t(' (' + days + '일 남음)', ' (' + days + ' day(s) left)') : t(' (' + (-days) + '일 전 만료)', ' (expired ' + (-days) + ' day(s) ago)')) : '')], [['유효 기간', 'Lifetime'], created && expires ? Math.round((expires - created) / 86400000) + t('일', ' days') : '—'], [['등록 기기 수', 'Devices'], all ? t('모든 기기 (ProvisionsAllDevices)', 'All devices (ProvisionsAllDevices)') : String(devs.length)], [['버전', 'Version'], String(P.Version == null ? '—' : P.Version)]];
    if (P.IsXcodeManaged) info.push([['Xcode 관리', 'Xcode managed'], t('예 (자동 서명)', 'Yes (automatic signing)')]);
    if (P.ProfileDistributionType) info.push([['배포 유형', 'Distribution type'], String(P.ProfileDistributionType)]);
    /* 점검 */
    if (expires) { if (days < 0) issues.push('⛔ ' + t('프로파일이 ' + (-days) + '일 전에 만료되었습니다. 재발급해야 설치·실행됩니다', 'The profile expired ' + (-days) + ' day(s) ago; regenerate it to install or run')); else if (days <= 30) issues.push('⚠️ ' + t('프로파일이 ' + days + '일 후 만료됩니다', 'The profile expires in ' + days + ' day(s)')); }
    if (created && created > now) issues.push('⚠️ ' + t('프로파일 생성 시각이 기준 시각보다 미래입니다', 'The profile creation time is later than the reference time'));
    if (/\*$/.test(appId)) issues.push('ℹ️ ' + t('와일드카드 앱 ID(' + appId + ')입니다. 푸시 알림·인앱 결제 등 일부 기능은 와일드카드로 쓸 수 없습니다', 'Wildcard App ID (' + appId + '); push notifications, in-app purchase and some other capabilities cannot use wildcards'));
    if (dbg && !devs.length && !all) issues.push('⚠️ ' + t('get-task-allow 가 true 인데 등록된 기기가 없습니다', 'get-task-allow is true but no devices are registered'));
    if (dbg && devs.length) issues.push('ℹ️ ' + t('디버깅이 허용된 개발용 프로파일입니다 (스토어 제출 불가)', 'A development profile that allows debugging (cannot be submitted to the store)'));
    if (!dbg && !all && !devs.length && ent['aps-environment'] === 'development') issues.push('⚠️ ' + t('배포용 프로파일인데 aps-environment 가 development 입니다', 'A distribution profile with aps-environment = development'));
    if (ent['aps-environment']) issues.push('ℹ️ ' + t('푸시 알림 환경: ' + ent['aps-environment'], 'Push notification environment: ' + ent['aps-environment']));
    if (all) issues.push('ℹ️ ' + t('엔터프라이즈 프로파일은 기기 수 제한 없이 배포할 수 있지만 App Store 에는 올릴 수 없습니다', 'Enterprise profiles install on any device but cannot be used for the App Store'));
    var u = String(o.udid || '').trim();
    if (u) { var hit = devs.some(function (d) { return String(d).toLowerCase() === u.toLowerCase(); }); issues.push(all ? 'ℹ️ ' + t('모든 기기에 허용되는 프로파일입니다', 'This profile allows all devices') : hit ? '✅ ' + t('UDID ' + u + ' 이(가) 등록되어 있습니다', 'UDID ' + u + ' is registered') : '⛔ ' + t('UDID ' + u + ' 은(는) 이 프로파일에 없습니다 — 설치할 수 없습니다', 'UDID ' + u + ' is not in this profile; the app cannot be installed on it')); }
    var seenD = {}; devs.forEach(function (d) { if (seenD[d]) issues.push('⚠️ ' + t('중복 UDID: ' + d, 'Duplicate UDID: ' + d)); seenD[d] = 1; });
    var entRows = Object.keys(ent).map(function (k) { var val = ent[k]; return [k, typeof val === 'object' ? JSON.stringify(val) : String(val)]; });
    var devRows = devs.map(function (d, i) { return [String(i + 1), String(d), /^[0-9a-f]{8}-[0-9a-f]{16}$/i.test(d) ? t('신형 (8-16)', 'new (8-16)') : /^[0-9a-f]{40}$/i.test(d) ? t('구형 (40자 16진수)', 'legacy (40 hex)') : t('형식 확인 필요', 'check format')]; });
    var certList = Array.isArray(P.DeveloperCertificates) ? P.DeveloperCertificates : [];
    function der(b64) { var bs = atob(b64.replace(/\s+/g, '')), u = new Uint8Array(bs.length); for (var i = 0; i < bs.length; i++) u[i] = bs.charCodeAt(i); return u; }
    var X = TK.x509;
    return Promise.all(certList.map(function (c) {
      try { var d = der(c), cert = X.parseCert(d); return X.digest('SHA-1', d).then(function (fp) { return { cert: cert, fp: fp }; }); } catch (e) { return Promise.resolve({ err: e.message }); }
    })).then(function (cs) {
      var certRows = cs.map(function (c) {
        if (c.err) return [t('해석 실패', 'Parse error'), c.err, '', '', ''];
        var ex = new Date(c.cert.notAfter), left = Math.floor((ex - now) / 86400000);
        if (left < 0) issues.push('⛔ ' + t('인증서 "' + c.cert.subject.str + '" 이(가) 만료되었습니다', 'Certificate "' + c.cert.subject.str + '" has expired')); else if (left <= 30) issues.push('⚠️ ' + t('인증서 "' + c.cert.subject.str + '" 이(가) ' + left + '일 후 만료됩니다', 'Certificate "' + c.cert.subject.str + '" expires in ' + left + ' day(s)'));
        var cn = (c.cert.subject.parts.filter(function (p) { return p[0] === 'CN'; })[0] || [])[1] || c.cert.subject.str;
        return [cn, c.cert.issuer.str, c.cert.notBefore + ' → ' + c.cert.notAfter + (left >= 0 ? t(' (' + left + '일 남음)', ' (' + left + ' d left)') : t(' (만료)', ' (expired)')), c.fp, c.cert.serialHex];
      });
      if (!certRows.length) issues.push('ℹ️ ' + t('DeveloperCertificates 가 없습니다', 'No DeveloperCertificates'));
      var errs = issues.filter(function (x) { return x.indexOf('⛔') === 0; }).length;
      return { _status: { ok: errs ? false : true, msg: errs ? t('⛔ 문제 ' + errs + '건 — ' + type, '⛔ ' + errs + ' problem(s) — ' + type) : t('✅ ' + (P.Name || '프로파일') + ' — ' + type + (days !== null ? ', ' + (days >= 0 ? days + '일 남음' : '만료됨') : ''), '✅ ' + (P.Name || 'Profile') + ' — ' + type + (days !== null ? ', ' + (days >= 0 ? days + ' day(s) left' : 'expired') : '')) }, info: { head: [['항목', 'Field'], ['값', 'Value']], rows: info.map(function (r) { return [t(r[0][0], r[0][1]), r[1]]; }) }, ent: { head: [['키', 'Key'], ['값', 'Value']], rows: entRows }, dev: { head: [['#', '#'], ['UDID', 'UDID'], ['형식', 'Format']], rows: devRows }, certs: { head: [['주체 CN', 'Subject CN'], ['발급자', 'Issuer'], ['유효 기간', 'Validity'], ['SHA-1 지문', 'SHA-1 fingerprint'], ['일련번호', 'Serial']], rows: certRows }, issues: issues };
    });
  }
});
