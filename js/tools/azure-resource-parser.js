TK.tool('azure-resource-parser', {
  inputs: [{ id: 'in', label: ['Azure 리소스 ID, Blob URL 또는 연결 문자열', 'Azure resource ID, blob URL or connection string'], rows: 6, sample: '/subscriptions/00000000-1111-2222-3333-444444444444/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/web-01/extensions/AzureMonitorAgent\nhttps://mystorageacct.blob.core.windows.net/container/folder/file.txt?sv=2022-11-02&sp=r&sig=abc\nDefaultEndpointsProtocol=https;AccountName=mystorageacct;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;EndpointSuffix=core.windows.net' }],
  options: [],
  outputs: [{ id: 'table', label: ['분석', 'Analysis'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.in).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('값을 입력하세요', 'Enter a value'));
    var rows = [], issues = [], GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    lines.forEach(function (ln, idx) {
      var p = '#' + (idx + 1) + ' ';
      if (/^\/subscriptions\//i.test(ln)) {
        var segs = ln.split('/').filter(Boolean), kv = {}, i = 0, ns = '', types = [], names = [];
        rows.push([p + t('종류', 'Kind'), t('Azure 리소스 ID', 'Azure resource ID')]);
        if (segs[0].toLowerCase() === 'subscriptions') { rows.push([p + 'subscriptionId', segs[1] + (GUID.test(segs[1]) ? '' : ' ❌')]); if (!GUID.test(segs[1])) issues.push(t('🚨 구독 ID 가 GUID 형식이 아닙니다', '🚨 The subscription ID is not a GUID')); }
        var rg = segs.findIndex(function (s) { return s.toLowerCase() === 'resourcegroups'; });
        if (rg > 0) rows.push([p + 'resourceGroup', segs[rg + 1] || '—']);
        var pv = segs.findIndex(function (s) { return s.toLowerCase() === 'providers'; });
        if (pv > 0) {
          ns = segs[pv + 1] || ''; rows.push([p + 'provider', ns]);
          for (i = pv + 2; i + 1 < segs.length + 1; i += 2) { types.push(segs[i]); names.push(segs[i + 1] || ''); }
          rows.push([p + t('리소스 종류', 'resource type'), ns + '/' + types.join('/')]);
          rows.push([p + t('이름 계층', 'name path'), names.filter(Boolean).join(' › ')]);
          rows.push([p + t('최종 리소스', 'leaf resource'), (types[types.length - 1] || '') + ' = ' + (names[names.length - 1] || '')]);
          if (types.length > 1) rows.push([p + t('부모', 'parent'), types[0] + ' = ' + names[0]]);
        } else if (rg > 0) rows.push([p + t('범위', 'scope'), t('리소스 그룹', 'resource group')]);
        else rows.push([p + t('범위', 'scope'), t('구독', 'subscription')]);
        issues.push(t('리소스 ID 는 대소문자를 구분하지 않습니다. 비교할 때는 소문자로 바꿔 비교하세요', 'Resource IDs are case-insensitive; compare them in lowercase'));
      } else if (/^https?:\/\//i.test(ln)) {
        var u; try { u = new URL(ln); } catch (e) { rows.push([p + t('오류', 'Error'), t('URL 형식 오류', 'Invalid URL')]); return; }
        var m = /^([a-z0-9]+)\.(blob|file|queue|table|dfs|web)\.core\.windows\.net$/i.exec(u.hostname), parts = u.pathname.split('/').filter(Boolean);
        rows.push([p + t('종류', 'Kind'), m ? 'Azure Storage ' + m[2] : 'URL']);
        if (m) { rows.push([p + 'storageAccount', m[1]]); rows.push([p + t('컨테이너/공유', 'container / share'), parts[0] || '—']); rows.push([p + t('경로', 'path'), parts.slice(1).join('/') || '—']); }
        if (u.searchParams.get('sig') !== null) {
          rows.push([p + 'SAS ' + t('토큰', 'token'), 'sig=•••• (' + t('마스킹', 'masked') + ')']);
          ['sv', 'sp', 'st', 'se', 'spr', 'sr', 'ss', 'srt'].forEach(function (k) { if (u.searchParams.get(k)) rows.push([p + 'SAS ' + k, u.searchParams.get(k)]); });
          var se = u.searchParams.get('se'); if (se && !isNaN(Date.parse(se)) && Date.parse(se) < Date.now()) issues.push(t('🚨 SAS 토큰이 만료되었습니다 (se=' + se + ')', '🚨 The SAS token has expired (se=' + se + ')'));
          if (!se) issues.push(t('SAS 에 만료 시각(se)이 없습니다 — 저장된 액세스 정책을 쓰는 경우가 아니면 이상합니다', 'The SAS has no expiry (se) — unusual unless a stored access policy is used'));
          if (/w|d/.test(u.searchParams.get('sp') || '')) issues.push(t('SAS 권한(sp)에 쓰기/삭제가 있습니다 — 필요한 최소 권한만 부여하세요', 'The SAS permission (sp) includes write / delete — grant the minimum'));
          if (u.searchParams.get('spr') && u.searchParams.get('spr') !== 'https') issues.push(t('SAS 가 HTTP 도 허용합니다', 'The SAS also allows HTTP'));
        }
      } else if (/(AccountName|DefaultEndpointsProtocol|BlobEndpoint|SharedAccessSignature|Endpoint)=/i.test(ln)) {
        rows.push([p + t('종류', 'Kind'), t('Azure 연결 문자열', 'Azure connection string')]);
        ln.split(';').filter(Boolean).forEach(function (kvp) {
          var j = kvp.indexOf('='), k = kvp.slice(0, j), val = kvp.slice(j + 1);
          var secret = /key|sharedaccesssignature|password|secret/i.test(k);
          rows.push([p + k, secret ? val.slice(0, 4) + '…' + t(' (마스킹, ' + val.length + '자)', ' (masked, ' + val.length + ' chars)') : val]);
          if (/^AccountKey$/i.test(k)) issues.push(t('🚨 AccountKey 는 계정 전체 권한입니다 — 코드·로그에 두지 말고 Key Vault 나 관리 ID 를 쓰세요', '🚨 AccountKey grants full account access — use Key Vault or managed identity instead of keeping it in code or logs'));
          if (/^DefaultEndpointsProtocol$/i.test(k) && val.toLowerCase() === 'http') issues.push(t('프로토콜이 http 입니다', 'The protocol is http'));
        });
      } else rows.push([p + t('오류', 'Error'), t('Azure 리소스 ID(/subscriptions/…), URL, 연결 문자열이 아닙니다', 'Not an Azure resource ID (/subscriptions/…), URL or connection string') + ': ' + ln.slice(0, 40)]);
    });
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: uniq.some(function (x) { return /^🚨/.test(x); }) ? { ok: 'info', msg: t('🔍 위험 항목이 있습니다', '🔍 Risky items found') } : t('✅ ' + lines.length + '개 항목을 분석했습니다', '✅ Analysed ' + lines.length + ' item(s)'), table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, issues: uniq };
  }
});
