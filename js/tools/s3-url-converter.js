TK.tool('s3-url-converter', {
  inputs: [{ id: 'urls', label: ['S3 주소 (s3://, https://, ARN — 한 줄에 하나)', 'S3 addresses (s3://, https://, ARN — one per line)'], rows: 6, sample: 's3://my-bucket/photos/2026/cat.jpg\nhttps://my-bucket.s3.ap-northeast-2.amazonaws.com/photos/cat.jpg\nhttps://s3.us-west-2.amazonaws.com/data-lake/raw/2026/part-0001.parquet\nhttps://legacy-bucket.s3-eu-west-1.amazonaws.com/a/b.txt\narn:aws:s3:::my-bucket/docs/readme.md' }],
  options: [
    { id: 'region', type: 'text', label: ['기본 리전 (주소에 리전이 없을 때)', 'Default region (when the address has none)'], default: 'ap-northeast-2' },
    { id: 'dual', type: 'checkbox', label: ['듀얼스택(IPv6) 엔드포인트도 표시', 'Also show dual-stack (IPv6) endpoints'], default: false }
  ],
  outputs: [{ id: 'out', label: ['변환 결과', 'Conversions'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['분석', 'Breakdown'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.urls).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('주소를 입력하세요', 'Enter an address'));
    var out = [], rows = [], issues = [], bad = 0, dflt = (o.region || 'us-east-1').trim();
    function bucketProblems(b) {
      var p = [];
      if (b.length < 3 || b.length > 63) p.push(t('버킷 이름은 3~63자', 'bucket names are 3–63 characters'));
      if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(b)) p.push(t('소문자·숫자·.·- 만, 영문/숫자로 시작·끝', 'lowercase letters, digits, . and - only, starting and ending alphanumeric'));
      if (/\.\./.test(b)) p.push(t('연속된 점(..) 불가', 'no consecutive dots'));
      if (/^\d+\.\d+\.\d+\.\d+$/.test(b)) p.push(t('IP 주소 형식 불가', 'cannot look like an IP address'));
      if (/^(xn--|sthree-)|(-s3alias|--ol-s3)$/.test(b)) p.push(t('예약된 접두사/접미사', 'reserved prefix / suffix'));
      return p;
    }
    lines.forEach(function (ln) {
      var bucket, key = '', region = '', style = '', m;
      if ((m = /^s3a?n?:\/\/([^\/]+)\/?(.*)$/i.exec(ln))) { bucket = m[1]; key = m[2]; style = 's3:// URI'; }
      else if ((m = /^arn:aws[a-z-]*:s3:::([^\/]+)\/?(.*)$/.exec(ln))) { bucket = m[1]; key = m[2]; style = 'ARN'; }
      else if ((m = /^https?:\/\/([^\/?#]+)\/?([^?#]*)/i.exec(ln))) {
        var host = m[1].toLowerCase(), path = m[2], h;
        if ((h = /^(.+)\.s3[.-]dualstack\.([a-z0-9-]+)\.amazonaws\.com(\.cn)?$/.exec(host))) { bucket = h[1]; region = h[2]; key = path; style = 'virtual-hosted (dual-stack)'; }
        else if ((h = /^(.+)\.s3[.-]([a-z]{2}(?:-[a-z]+)+-\d)\.amazonaws\.com(\.cn)?$/.exec(host))) { bucket = h[1]; region = h[2]; key = path; style = 'virtual-hosted'; }
        else if ((h = /^(.+)\.s3\.amazonaws\.com$/.exec(host))) { bucket = h[1]; key = path; style = 'virtual-hosted (global)'; }
        else if ((h = /^s3[.-]([a-z]{2}(?:-[a-z]+)+-\d)\.amazonaws\.com(\.cn)?$/.exec(host)) || (h = /^s3\.amazonaws\.com$/.exec(host))) { region = h[1] || ''; var pp = path.split('/'); bucket = pp.shift(); key = pp.join('/'); style = 'path-style'; }
        else if ((h = /^(.+)\.s3-website[.-]([a-z0-9-]+)\.amazonaws\.com$/.exec(host))) { bucket = h[1]; region = h[2]; key = path; style = 'static website'; }
        else if ((h = /^(.+)\.s3-accelerate(\.dualstack)?\.amazonaws\.com$/.exec(host))) { bucket = h[1]; key = path; style = 'transfer acceleration'; }
      }
      if (!bucket) { bad++; out.push('# ' + ln + '\n# ' + t('S3 주소로 해석할 수 없습니다', 'Cannot parse as an S3 address') + '\n'); rows.push([ln, '❌', '', '', '']); return; }
      try { key = decodeURIComponent(key); } catch (e) { }
      var enc = key.split('/').map(function (s) { return encodeURIComponent(s).replace(/%2F/g, '/'); }).join('/'), r = region || dflt, pr = bucketProblems(bucket), dotted = bucket.indexOf('.') >= 0;
      var L = ['# ' + ln, 's3 URI:          s3://' + bucket + (key ? '/' + key : ''), 'ARN:            arn:aws:s3:::' + bucket + (key ? '/' + key : ''),
        'Virtual-hosted: https://' + bucket + '.s3.' + r + '.amazonaws.com/' + enc,
        'Path-style:     https://s3.' + r + '.amazonaws.com/' + bucket + '/' + enc];
      if (o.dual) L.push('Dual-stack:     https://' + bucket + '.s3.dualstack.' + r + '.amazonaws.com/' + enc);
      L.push('Legacy global:  https://' + bucket + '.s3.amazonaws.com/' + enc, 'AWS CLI:        aws s3 ls s3://' + bucket + '/' + (key.replace(/[^\/]*$/, '')) );
      out.push(L.join('\n') + '\n');
      rows.push([ln.length > 50 ? ln.slice(0, 47) + '…' : ln, pr.length ? '⚠️' : '✅', style, bucket + (region ? ' @ ' + region : ''), key || '—']);
      if (pr.length) issues.push(t('버킷 "' + bucket + '": ' + pr.join(', '), 'Bucket "' + bucket + '": ' + pr.join(', ')));
      if (dotted) issues.push(t('버킷 이름에 점(.)이 있으면 virtual-hosted HTTPS 에서 와일드카드 인증서(*.s3…)와 맞지 않아 인증서 경고가 납니다: ' + bucket, 'Dots in the bucket name break the wildcard certificate for virtual-hosted HTTPS: ' + bucket));
    });
    issues.push(t('2020년 이후 신규 버킷은 path-style 이 단계적으로 폐지되어 virtual-hosted 형식을 권장합니다', 'Path-style addressing is being phased out; prefer the virtual-hosted form'));
    issues.push(t('리전이 없는 주소(s3://, ARN)는 기본 리전(' + dflt + ')을 가정해 만든 주소입니다 — 버킷의 실제 리전과 다르면 301 리다이렉트가 납니다', 'Addresses without a region (s3://, ARN) assume the default region (' + dflt + '); a wrong region gives a 301 redirect'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: bad ? { ok: 'info', msg: t('🔍 ' + lines.length + '개 중 ' + bad + '개를 해석하지 못했습니다', '🔍 ' + bad + ' of ' + lines.length + ' could not be parsed') } : t('✅ ' + lines.length + '개 주소를 변환했습니다', '✅ Converted ' + lines.length + ' address(es)'), out: out.join('\n').trim(), table: { head: [['입력', 'Input'], ['상태', 'Status'], ['형식', 'Style'], ['버킷', 'Bucket'], ['키', 'Key']], rows: rows }, issues: uniq };
  }
});
