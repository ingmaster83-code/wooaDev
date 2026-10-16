TK.tool('sri-generator', {
  inputs: [
    { id: 'file', type: 'file', buffer: true, label: ['CSS/JS 파일 선택 (서버로 전송되지 않습니다)', 'Choose the CSS/JS file (never uploaded)'], show: function (o) { return o.mode === 'file'; } },
    { id: 'text', label: ['파일 내용 붙여넣기', 'Paste the file content'], rows: 8, sample: 'console.log("hello");\n', show: function (o) { return o.mode === 'text'; } },
    { id: 'url', type: 'text', label: ['리소스 URL (태그 예시용)', 'Resource URL (for the tag example)'], sample: 'https://cdn.example.com/lib/app.min.js' },
    { id: 'check', type: 'text', label: ['검증할 integrity 값 (선택)', 'integrity value to verify (optional)'], sample: '', placeholder: ['sha384-… (여러 개는 공백으로 구분)', 'sha384-… (separate several with spaces)'] }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['입력', 'Input'], choices: [['file', ['파일', 'File']], ['text', ['텍스트 붙여넣기', 'Pasted text']]], default: 'text' },
    { id: 'algos', type: 'select', label: ['알고리즘', 'Algorithms'], choices: [['384', ['SHA-384 (권장)', 'SHA-384 (recommended)']], ['256', 'SHA-256'], ['512', 'SHA-512'], ['all', ['세 가지 모두', 'All three']]], default: '384' },
    { id: 'cors', type: 'checkbox', label: ['crossorigin="anonymous" 포함', 'Include crossorigin="anonymous"'], default: true }
  ],
  outputs: [{ id: 'out', label: ['integrity 값', 'integrity value'], kind: 'code', ext: 'txt', download: false }, { id: 'tags', label: ['HTML 태그 예시', 'HTML tag examples'], kind: 'code', ext: 'html' }],
  run: function (v, o, t) {
    var H = TK.hash, bytes;
    if (o.mode === 'file') { if (!v.file || !v.file.buf) throw new Error(t('파일을 선택하세요', 'Choose a file')); bytes = new Uint8Array(v.file.buf); }
    else { if (!v.text) throw new Error(t('파일 내용을 입력하세요', 'Enter the file content')); bytes = H.utf8(v.text); }
    var list = o.algos === 'all' ? ['256', '384', '512'] : [o.algos];
    return Promise.all(list.map(function (a) { return H.sha('SHA-' + a, bytes); })).then(function (res) {
      var vals = list.map(function (a, i) { return 'sha' + a + '-' + H.b64(res[i]); }), integ = vals.join(' '), url = (v.url || 'https://cdn.example.com/file.js').trim(), co = o.cors ? ' crossorigin="anonymous"' : '';
      var isCss = /\.css(\?|$)/i.test(url), tag = isCss ? '<link rel="stylesheet" href="' + url + '" integrity="' + integ + '"' + co + '>' : '<script src="' + url + '" integrity="' + integ + '"' + co + '></script>';
      var status = t('✅ ' + bytes.length.toLocaleString() + '바이트의 SRI 해시를 만들었습니다', '✅ SRI hash computed for ' + bytes.length.toLocaleString() + ' bytes');
      var chk = String(v.check || '').trim();
      if (chk) {
        var wanted = chk.split(/\s+/).filter(Boolean), mine = {}; vals.forEach(function (x) { mine[x] = 1; });
        // 다른 알고리즘 값도 비교하려면 세 알고리즘 모두 계산
        return Promise.all(['256', '384', '512'].map(function (a) { return H.sha('SHA-' + a, bytes).then(function (d) { return 'sha' + a + '-' + H.b64(d); }); })).then(function (all) {
          var ok = wanted.filter(function (w) { return all.indexOf(w.split('?')[0]) >= 0; });
          status = ok.length ? { ok: true, msg: t('✅ integrity 값이 이 파일과 일치합니다 (' + ok[0].split('-')[0] + ')', '✅ The integrity value matches this file (' + ok[0].split('-')[0] + ')') } : { ok: false, msg: t('❌ integrity 값이 이 파일과 일치하지 않습니다 — 파일이 바뀌었거나 다른 버전입니다', '❌ The integrity value does not match this file — it changed or is a different version') };
          return { _status: status, out: integ, tags: tag + '\n\n<!-- ' + t('SRI는 CORS를 허용하는 서버(Access-Control-Allow-Origin)에서 제공되는 리소스에만 동작합니다 -->', 'SRI only works for resources served with CORS (Access-Control-Allow-Origin) -->') };
        });
      }
      return { _status: status, out: integ, tags: tag + '\n\n<!-- ' + t('SRI는 CORS를 허용하는 서버(Access-Control-Allow-Origin)에서 제공되는 리소스에만 동작합니다. 파일이 한 글자라도 바뀌면 브라우저가 로드를 차단합니다 -->', 'SRI only works for resources served with CORS (Access-Control-Allow-Origin). If even one byte changes the browser blocks the load -->') };
    });
  }
});
