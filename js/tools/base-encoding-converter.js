TK.tool('base-encoding-converter', {
  inputs: [{ id: 'in', label: ['입력', 'Input'], rows: 8, sample: ['안녕하세요 WooaDev!', 'Hello, WooaDev!'], placeholder: ['텍스트(또는 디코딩할 문자열)를 입력하세요', 'Enter text (or the string to decode)'] }],
  options: [
    { id: 'enc', type: 'select', label: ['인코딩', 'Encoding'], choices: [['b16', 'Base16 (Hex)'], ['b32', 'Base32 (RFC 4648)'], ['b32hex', 'Base32hex'], ['crockford', 'Base32 Crockford'], ['b58', 'Base58 (Bitcoin)'], ['b58flickr', 'Base58 (Flickr)'], ['b58ripple', 'Base58 (Ripple)'], ['a85', 'Base85 (Ascii85)'], ['z85', 'Base85 (Z85)']], default: 'b32' },
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['enc', ['인코딩 (텍스트 → Base)', 'Encode (text → Base)']], ['dec', ['디코딩 (Base → 텍스트)', 'Decode (Base → text)']]], default: 'enc' },
    { id: 'src', type: 'select', label: ['입력 해석', 'Treat input as'], choices: [['text', ['UTF-8 텍스트', 'UTF-8 text']], ['hex', ['16진수 바이트', 'Hex bytes']]], default: 'text', show: function (o) { return o.dir === 'enc'; } },
    { id: 'pad', type: 'checkbox', label: ['= 패딩 붙이기', 'Add = padding'], default: true, show: function (o) { return o.dir === 'enc' && (o.enc === 'b32' || o.enc === 'b32hex'); } },
    { id: 'lower', type: 'checkbox', label: ['소문자', 'Lowercase'], default: false, show: function (o) { return o.dir === 'enc' && (o.enc === 'b16' || o.enc === 'b32' || o.enc === 'b32hex' || o.enc === 'crockford'); } },
    { id: 'as', type: 'select', label: ['디코딩 결과 표시', 'Show decoded as'], choices: [['auto', ['자동 (텍스트 → 불가하면 16진수)', 'Auto (text, else hex)']], ['text', ['UTF-8 텍스트', 'UTF-8 text']], ['hex', ['16진수', 'Hex']]], default: 'auto', show: function (o) { return o.dir === 'dec'; } }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'info', label: ['정보', 'Info'], kind: 'kv' }],
  swap: { from: 'out', to: 'in', label: ['결과를 입력으로', 'Use result as input'] },
  run: function (v, o, t) {
    var B = TK.bytes, bytes, out, info = [];
    if (o.dir === 'enc') {
      bytes = o.src === 'hex' ? B.parseHex(v.in) : B.utf8(v.in);
      switch (o.enc) {
        case 'b16': out = B.b16enc(bytes, o.lower); break;
        case 'b32': out = B.b32enc(bytes, 'std', o.pad); break;
        case 'b32hex': out = B.b32enc(bytes, 'hex', o.pad); break;
        case 'crockford': out = B.b32enc(bytes, 'crockford', false); break;
        case 'b58': out = B.b58enc(bytes, 'btc'); break;
        case 'b58flickr': out = B.b58enc(bytes, 'flickr'); break;
        case 'b58ripple': out = B.b58enc(bytes, 'ripple'); break;
        case 'a85': out = B.b85enc(bytes, 'adobe'); break;
        case 'z85': out = B.b85enc(bytes, 'z85'); break;
      }
      if (o.lower && o.enc !== 'b16') out = out.toLowerCase();
      info = [[['입력 바이트', 'Input bytes'], bytes.length], [['출력 길이', 'Output length'], out.length + (bytes.length ? ' (' + Math.round(out.length / bytes.length * 100) + '%)' : '')]];
      return { _status: t('✅ 인코딩 완료', '✅ Encoded'), out: out, info: info };
    }
    switch (o.enc) {
      case 'b16': bytes = B.b16dec(v.in); break;
      case 'b32': bytes = B.b32dec(v.in, 'std'); break;
      case 'b32hex': bytes = B.b32dec(v.in, 'hex'); break;
      case 'crockford': bytes = B.b32dec(v.in, 'crockford'); break;
      case 'b58': bytes = B.b58dec(v.in, 'btc'); break;
      case 'b58flickr': bytes = B.b58dec(v.in, 'flickr'); break;
      case 'b58ripple': bytes = B.b58dec(v.in, 'ripple'); break;
      case 'a85': bytes = B.b85dec(v.in, 'adobe'); break;
      case 'z85': bytes = B.b85dec(v.in, 'z85'); break;
    }
    var txt = B.fromUtf8(bytes, true), show = o.as;
    if (show === 'auto') show = txt === null ? 'hex' : 'text';
    if (show === 'text') { txt = B.fromUtf8(bytes, false); out = txt; } else out = B.hex(bytes, ' ');
    info = [[['디코딩된 바이트', 'Decoded bytes'], bytes.length], [['유효한 UTF-8', 'Valid UTF-8'], B.fromUtf8(bytes, true) === null ? t('아니오', 'No') : t('예', 'Yes')]];
    return { _status: show === 'hex' && o.as === 'auto' ? { ok: 'info', msg: t('디코딩 결과가 UTF-8 텍스트가 아니어서 16진수로 표시합니다', 'The result is not UTF-8 text, so it is shown as hex') } : t('✅ 디코딩 완료', '✅ Decoded'), out: out, info: info };
  }
});
