TK.tool('gcp-resource-parser', {
  inputs: [{ id: 'in', label: ['GCP 리소스 이름, GCS 주소, 서비스 계정 이메일 또는 키 JSON', 'GCP resource name, GCS address, service-account email or key JSON'], rows: 8, sample: 'projects/my-project/locations/asia-northeast3/services/api\ngs://my-bucket/exports/2026/data.csv\nhttps://storage.googleapis.com/my-bucket/exports/data.csv\nbuild-bot@my-project.iam.gserviceaccount.com\n{"type":"service_account","project_id":"my-project","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n","client_email":"build-bot@my-project.iam.gserviceaccount.com","client_id":"1234567890"}' }],
  options: [],
  outputs: [{ id: 'table', label: ['분석', 'Analysis'], kind: 'table' }, { id: 'out', label: ['GCS 주소 변환', 'GCS conversions'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var text = String(v.in).replace(/\r/g, '').trim(); if (!text) throw new Error(t('값을 입력하세요', 'Enter a value'));
    var rows = [], out = [], issues = [];
    function gcs(bucket, obj, label) {
      var enc = obj.split('/').map(encodeURIComponent).join('/');
      rows.push([label, 'GCS']); rows.push(['bucket', bucket]); rows.push([t('객체', 'object'), obj || '—']);
      if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket) || /^goog|g[o0]{2}gle/.test(bucket)) issues.push(t('버킷 이름 규칙(소문자·숫자·-_. , 3~63자, goog/google 불가)에 맞지 않을 수 있습니다: ' + bucket, 'The bucket name may break the rules (lowercase, digits, -_. , 3–63 chars, no goog / google): ' + bucket));
      out.push('gs://' + bucket + (obj ? '/' + obj : ''), 'https://storage.googleapis.com/' + bucket + (obj ? '/' + enc : ''), 'https://' + bucket + '.storage.googleapis.com/' + (obj ? enc : ''), 'https://storage.cloud.google.com/' + bucket + (obj ? '/' + enc : '') + '   # ' + t('로그인 필요(브라우저)', 'requires sign-in (browser)'), 'gsutil ls gs://' + bucket + '/' + obj.replace(/[^\/]*$/, ''), '');
    }
    text.split(/\n(?=\S)/).forEach(function (blockRaw) { }); // (분할은 아래에서 직접 처리)
    var jsonStart = text.indexOf('{'), jsonPart = '', rest = text;
    if (jsonStart >= 0) { var depth = 0, endI = -1; for (var i = jsonStart; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}') { depth--; if (!depth) { endI = i; break; } } } if (endI > 0) { jsonPart = text.slice(jsonStart, endI + 1); rest = text.slice(0, jsonStart) + text.slice(endI + 1); } }
    if (jsonStart >= 0 && !jsonPart && /^\s*\{\s*"/.test(text.slice(jsonStart))) throw new Error(t('서비스 계정 JSON 이 닫히지 않았습니다 (중괄호를 확인하세요)', 'The service-account JSON is not closed (check the braces)'));
    rest.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (ln) {
      var m;
      if ((m = /^gs:\/\/([^\/]+)\/?(.*)$/.exec(ln))) gcs(m[1], m[2], 'gs:// ' + ln.slice(0, 30));
      else if ((m = /^https?:\/\/(?:storage\.googleapis\.com|storage\.cloud\.google\.com)\/([^\/?#]+)\/?([^?#]*)/.exec(ln))) gcs(m[1], decodeURIComponent(m[2]), 'https');
      else if ((m = /^https?:\/\/([a-z0-9._-]+)\.storage\.googleapis\.com\/?([^?#]*)/.exec(ln))) gcs(m[1], decodeURIComponent(m[2]), 'https');
      else if ((m = /^([a-z][a-z0-9-]{4,28}[a-z0-9])@([a-z][a-z0-9-]{4,28}[a-z0-9])\.iam\.gserviceaccount\.com$/.exec(ln)) || (m = /^(\d+-compute)@developer\.gserviceaccount\.com$/.exec(ln))) {
        rows.push([t('서비스 계정', 'service account'), ln]); rows.push([t('계정 ID', 'account id'), m[1]]); if (m[2]) rows.push(['projectId', m[2]]);
        if (/-compute$/.test(m[1])) issues.push(t('기본 Compute Engine 서비스 계정입니다 — 편집자 권한이 기본 부여되므로 전용 서비스 계정을 쓰세요', 'This is the default Compute Engine service account, which often has Editor rights — use a dedicated one'));
      } else if (/^(projects|folders|organizations|billingAccounts)\//.test(ln)) {
        var seg = ln.split('/'); rows.push([t('리소스 이름', 'resource name'), ln]);
        for (var k = 0; k + 1 < seg.length; k += 2) rows.push([seg[k], seg[k + 1]]);
        if (seg.length % 2) issues.push(t('리소스 이름은 보통 컬렉션/ID 쌍으로 끝납니다 — 마지막 세그먼트가 짝이 없습니다', 'Resource names normally end in a collection / ID pair — the last segment has no partner'));
      } else rows.push([t('알 수 없음', 'unknown'), ln.slice(0, 60)]);
    });
    if (jsonPart) {
      var j; try { j = JSON.parse(jsonPart.replace(/\\\\n/g, '\\n')); } catch (e) { try { j = JSON.parse(jsonPart); } catch (e2) { throw new Error(t('서비스 계정 JSON 을 해석할 수 없습니다: ' + e2.message, 'Cannot parse the service-account JSON: ' + e2.message)); } }
      rows.push([t('서비스 계정 키', 'service-account key'), j.type || '—']);
      ['project_id', 'client_email', 'client_id', 'private_key_id', 'token_uri'].forEach(function (k) { if (j[k]) rows.push([k, k === 'private_key_id' ? String(j[k]).slice(0, 6) + '…' : j[k]]); });
      if (j.private_key) { rows.push(['private_key', '•••• ' + t('(마스킹, ' + String(j.private_key).length + '자)', '(masked, ' + String(j.private_key).length + ' chars)')]); issues.push(t('🚨 비공개 키가 들어 있는 JSON 입니다 — 저장소·채팅·이슈에 올리지 말고, 노출됐다면 키를 즉시 삭제·재발급하세요', '🚨 This JSON contains a private key — never put it in a repo, chat or issue; if exposed, delete and rotate the key immediately')); }
      if (j.type !== 'service_account') issues.push(t('type 이 service_account 가 아닙니다', 'type is not service_account'));
      ['project_id', 'client_email', 'private_key'].forEach(function (k) { if (!j[k]) issues.push(t('필수 필드 누락: ' + k, 'Missing required field: ' + k)); });
      issues.push(t('가능하면 키 파일 대신 Workload Identity / 연결된 서비스 계정을 쓰세요', 'Prefer Workload Identity or an attached service account over key files'));
    }
    if (!rows.length) throw new Error(t('해석할 수 있는 항목이 없습니다', 'Nothing could be parsed'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: 'info', msg: t('🔍 위험 항목 ' + bad + '개', '🔍 ' + bad + ' risky item(s)') } : t('✅ 분석했습니다', '✅ Parsed'), table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, out: out.join('\n').trim(), issues: issues };
  }
});
