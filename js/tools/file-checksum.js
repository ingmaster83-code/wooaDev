TK.tool('file-checksum', {
  inputs: [
    { id: 'file', type: 'file', buffer: true, label: ['파일 선택 (서버로 전송되지 않습니다)', 'Choose a file (never uploaded)'], show: function (o) { return o.mode === 'file'; } },
    { id: 'text', label: ['텍스트', 'Text'], rows: 6, sample: 'Hello, WooaDev!', show: function (o) { return o.mode === 'text'; } },
    { id: 'expect', type: 'text', label: ['비교할 해시값 (선택)', 'Hash to compare with (optional)'], sample: '', placeholder: ['배포 페이지에 적힌 SHA-256 값을 붙여 넣으세요', 'Paste the SHA-256 value from the download page'] }
  ],
  options: [{ id: 'mode', type: 'select', label: ['입력', 'Input'], choices: [['file', ['파일', 'File']], ['text', ['텍스트(UTF-8)', 'Text (UTF-8)']]], default: 'file' }, { id: 'upper', type: 'checkbox', label: ['16진수 대문자', 'Uppercase hex'], default: false }],
  sampleOptions: { mode: 'text' },
  outputs: [{ id: 'table', label: ['해시 결과', 'Hashes'], kind: 'table' }, { id: 'out', label: ['SHA-256', 'SHA-256'], kind: 'code', ext: 'txt', download: false }],
  run: function (v, o, t) {
    var H = TK.hash, bytes, name = '';
    if (o.mode === 'file') {
      var f = v.file; if (!f || !f.buf) throw new Error(t('파일을 선택하세요', 'Choose a file'));
      if (f.size > 2147483647) throw new Error(t('2GB를 넘는 파일은 브라우저 메모리 한계로 처리할 수 없습니다', 'Files over 2 GB exceed browser memory limits'));
      bytes = new Uint8Array(f.buf); name = f.name + ' (' + f.size.toLocaleString() + ' bytes)';
    } else { if (!v.text) throw new Error(t('텍스트를 입력하세요', 'Enter some text')); bytes = H.utf8(v.text); name = t('텍스트 ', 'Text ') + bytes.length + ' bytes'; }
    var fmt = function (s) { return o.upper ? s.toUpperCase() : s; };
    var algos = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
    return Promise.all(algos.map(function (a) { return H.sha(a, bytes); })).then(function (res) {
      var rows = [['MD5', fmt(H.hex(H.md5(bytes)))]].concat(algos.map(function (a, i) { return [a, fmt(H.hex(res[i]))]; }));
      rows.push(['CRC-32', fmt(('00000000' + H.crc(H.CRCS[12], bytes).toString(16)).slice(-8))]);
      var exp = String(v.expect || '').trim().replace(/^[a-z0-9-]+[:=]\s*/i, '').replace(/\s/g, ''), matchTxt = '', status = t('✅ 계산 완료 — ', '✅ Done — ') + name;
      if (exp) {
        var low = exp.toLowerCase(), hit = rows.filter(function (r) { return r[1].toLowerCase() === low; })[0];
        if (!hit && /^[A-Za-z0-9+\/=_-]+$/.test(exp) && !/^[0-9a-fA-F]+$/.test(exp)) { try { var hx = H.hex(H.fromB64(exp)); hit = rows.filter(function (r) { return r[1].toLowerCase() === hx; })[0]; } catch (e) { /* 무시 */ } }
        if (hit) { status = { ok: true, msg: t('✅ 일치합니다 — ' + hit[0] + ' 값이 같습니다 (파일이 변조되지 않았습니다)', '✅ Match — the ' + hit[0] + ' value is identical (file is intact)') }; rows = rows.map(function (r) { return r[0] === hit[0] ? { cls: 'r-ok', cells: [r[0] + ' ✓', r[1]] } : r; }); }
        else status = { ok: false, msg: t('❌ 일치하는 해시가 없습니다. 값이 다르면 파일이 손상·변조되었거나 다른 알고리즘 값일 수 있습니다.', '❌ No hash matches. The file may be corrupted or altered, or the value uses another algorithm.') };
      }
      return { _status: status, table: { head: [['알고리즘', 'Algorithm'], ['값', 'Value']], rows: rows }, out: rows.filter(function (r) { return /SHA-256/.test(r.cells ? r.cells[0] : r[0]); }).map(function (r) { return (r.cells || r)[1]; })[0] };
    });
  }
});
