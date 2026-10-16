TK.tool('data-uri-converter', {
  inputs: [
    { id: 'in', label: ['입력', 'Input'], rows: 9, sample: ['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#C4956A"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#C4956A"/></svg>'], show: function (o) { return o.mode !== 'file'; } },
    { id: 'file', type: 'file', binary: true, label: ['파일 선택', 'Choose a file'], show: function (o) { return o.mode === 'file'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['text', ['텍스트 → Data URI', 'Text → Data URI']], ['file', ['파일 → Data URI', 'File → Data URI']], ['dec', ['Data URI → 내용', 'Data URI → content']]], default: 'text' },
    { id: 'mime', type: 'select', label: ['MIME 타입', 'MIME type'], choices: [['image/svg+xml', 'image/svg+xml'], ['text/plain', 'text/plain'], ['text/html', 'text/html'], ['application/json', 'application/json'], ['text/css', 'text/css'], ['text/javascript', 'text/javascript'], ['text/csv', 'text/csv'], ['application/xml', 'application/xml']], default: 'image/svg+xml', show: function (o) { return o.mode === 'text'; } },
    { id: 'enc', type: 'select', label: ['인코딩 방식', 'Encoding'], choices: [['b64', 'Base64'], ['pct', ['퍼센트 인코딩 (SVG·HTML에 짧음)', 'Percent-encoding (shorter for SVG/HTML)']]], default: 'pct', show: function (o) { return o.mode === 'text'; } },
    { id: 'charset', type: 'checkbox', label: ['charset=utf-8 표시', 'Add charset=utf-8'], default: true, show: function (o) { return o.mode === 'text'; } }
  ],
  sampleOptions: { mode: 'text', mime: 'image/svg+xml', enc: 'pct' },
  outputs: [
    { id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' },
    { id: 'info', label: ['정보', 'Info'], kind: 'kv' },
    { id: 'preview', label: ['미리보기', 'Preview'], kind: 'html' }
  ],
  swap: { from: 'out', to: 'in', set: { mode: 'dec' }, label: ['결과를 입력으로 (디코딩)', 'Use result as input (decode)'] },
  run: function (v, o, t) {
    var B = TK.bytes;
    function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.slice(i, i + 0x8000)); return btoa(s); }
    function unb64(str) { var bin = atob(str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')); var a = []; for (var i = 0; i < bin.length; i++) a.push(bin.charCodeAt(i)); return a; }
    function previewFor(uri, mime) {
      if (/^image\//.test(mime) && uri.length < 7e6) return '<div style="padding:12px;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:8px;display:inline-block;max-width:100%"><img alt="preview" style="max-width:100%;max-height:320px;display:block" src="' + TK.esc(uri) + '"></div>';
      return null;
    }
    if (o.mode === 'file') {
      var f = v.file;
      if (!f || !f.dataUrl) throw new Error(t('파일을 선택하세요', 'Choose a file'));
      var uri = f.dataUrl;
      var mime = (/^data:([^;,]*)/.exec(uri) || [])[1] || 'application/octet-stream';
      return { _status: t('✅ 변환 완료', '✅ Converted'), out: uri,
        info: [[['파일', 'File'], f.name], [['MIME', 'MIME'], mime], [['원본 크기', 'Original size'], f.size.toLocaleString() + ' bytes'], [['Data URI 길이', 'Data URI length'], uri.length.toLocaleString() + t('자', ' chars')]],
        preview: previewFor(uri, mime) };
    }
    if (o.mode === 'text') {
      var bytes = B.utf8(v.in), head = 'data:' + o.mime + (o.charset ? ';charset=utf-8' : ''), body;
      if (o.enc === 'b64') { head += ';base64'; body = b64(bytes); }
      else body = encodeURIComponent(v.in).replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/%2C/g, ',').replace(/%3B/g, ';').replace(/%40/g, '@');
      var out = head + ',' + body;
      return { _status: t('✅ 변환 완료', '✅ Converted'), out: out,
        info: [[['MIME', 'MIME'], o.mime], [['원본', 'Original'], bytes.length.toLocaleString() + ' bytes'], [['Data URI 길이', 'Data URI length'], out.length.toLocaleString() + t('자', ' chars')], [['CSS에서', 'In CSS'], 'url("' + (out.length > 200 ? out.slice(0, 200) + '…' : out) + '")']],
        preview: previewFor(out, o.mime) };
    }
    var m = /^\s*data:([^,]*?),([\s\S]*)$/i.exec(v.in);
    if (!m) throw new Error(t('"data:<MIME>[;base64],<데이터>" 형식이 아닙니다', 'Not in the form "data:<MIME>[;base64],<data>"'));
    var meta = m[1].split(';'), isB64 = false, charset = '', mt = meta[0] || 'text/plain';
    meta.slice(1).forEach(function (p) { if (p.toLowerCase() === 'base64') isB64 = true; else if (/^charset=/i.test(p)) charset = p.slice(8); });
    var raw;
    if (isB64) { try { raw = unb64(m[2]); } catch (e) { throw new Error(t('Base64 디코딩에 실패했습니다', 'Base64 decoding failed')); } }
    else { try { raw = B.utf8(decodeURIComponent(m[2])); } catch (e) { throw new Error(t('퍼센트 디코딩에 실패했습니다 (% 뒤에 16진수 2자리가 필요)', 'Percent-decoding failed (% must be followed by two hex digits)')); } }
    var txt = B.fromUtf8(raw, true), isText = txt !== null && !/\u0000/.test(txt);
    return { _status: t('✅ 디코딩 완료', '✅ Decoded'), out: isText ? txt : B.hex(raw.slice(0, 4096), ' ') + (raw.length > 4096 ? ' …' : ''),
      info: [[['MIME', 'MIME'], mt], [['charset', 'charset'], charset || '(unspecified)'], [['인코딩', 'Encoding'], isB64 ? 'base64' : t('퍼센트 인코딩', 'percent-encoding')], [['디코딩된 크기', 'Decoded size'], raw.length.toLocaleString() + ' bytes'], [['표시 방식', 'Shown as'], isText ? t('텍스트', 'text') : t('16진수(바이너리)', 'hex (binary)')]],
      preview: previewFor('data:' + m[1] + ',' + m[2], mt) };
  }
});
