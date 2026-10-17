TK.tool('cbor-viewer', {
  inputs: TK.binin.inputs('in', ['CBOR (16진수/Base64) 또는 인코딩할 JSON', 'CBOR (hex / Base64) or JSON to encode'], 'a4 64 6e 61 6d 65 65 57 6f 6f 61 21 63 61 67 65 18 1e 66 73 63 6f 72 65 73 83 01 fb 40 09 1e b8 51 eb 85 1f c1 1a 65 4f 1f 80 62 6f 6b f5', 6),
  options: [
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['dec', ['해석 (CBOR → JSON)', 'Decode (CBOR → JSON)']], ['enc', ['인코딩 (JSON → CBOR)', 'Encode (JSON → CBOR)']]], default: 'dec' },
    TK.binin.modeOption(), TK.binin.fmtOption()
  ],
  outputs: [{ id: 'table', label: ['타입 트리 (바이트 오프셋)', 'Type tree (byte offsets)'], kind: 'table' }, { id: 'out', label: ['JSON / 인코딩 결과', 'JSON / encoded result'], kind: 'code', ext: 'json' }, { id: 'diag', label: ['진단 표기 (RFC 8949)', 'Diagnostic notation (RFC 8949)'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [];
    function half(h) { var s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; if (e === 0) return s * Math.pow(2, -14) * (f / 1024); if (e === 31) return f ? NaN : s * Infinity; return s * Math.pow(2, e - 15) * (1 + f / 1024); }
    if (o.dir === 'enc') {
      var src = String(v['in'] || '').trim(); if (!src) throw new Error(t('인코딩할 JSON 을 입력하세요', 'Enter JSON to encode'));
      var val; try { val = JSON.parse(src); } catch (e) { throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); }
      var out = [];
      var head = function (mt, n) {
        var m = mt << 5;
        if (n < 24) out.push(m | n);
        else if (n < 256) out.push(m | 24, n);
        else if (n < 65536) out.push(m | 25, n >> 8, n & 255);
        else if (n < 4294967296) out.push(m | 26, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
        else { out.push(m | 27); var b = BigInt(n); for (var i = 7; i >= 0; i--) out.push(Number((b >> BigInt(8 * i)) & 255n)); }
      };
      var enc = function (x) {
        if (x === null) return out.push(0xf6); if (x === true) return out.push(0xf5); if (x === false) return out.push(0xf4);
        if (typeof x === 'number') {
          if (Number.isInteger(x)) return x >= 0 ? head(0, x) : head(1, -1 - x);
          var dv = new DataView(new ArrayBuffer(8));
          dv.setFloat32(0, x); if (dv.getFloat32(0) === x) { out.push(0xfa); for (var a = 0; a < 4; a++) out.push(dv.getUint8(a)); return; }
          dv.setFloat64(0, x); out.push(0xfb); for (var c = 0; c < 8; c++) out.push(dv.getUint8(c)); return;
        }
        if (typeof x === 'string') { var u = new TextEncoder().encode(x); head(3, u.length); for (var i = 0; i < u.length; i++) out.push(u[i]); return; }
        if (Array.isArray(x)) { head(4, x.length); return x.forEach(enc); }
        var ks = Object.keys(x);
        if (ks.length === 1 && ks[0] === '$binary' && typeof x.$binary === 'string') { var bb = N.fromB64(x.$binary); head(2, bb.length); for (var j = 0; j < bb.length; j++) out.push(bb[j]); return; }
        head(5, ks.length); ks.forEach(function (k) { enc(k); enc(x[k]); });
      };
      enc(val);
      var bytes = new Uint8Array(out);
      issues.push(t('정수는 가장 짧은 형식, 소수는 float32 로 손실이 없으면 float32, 아니면 float64 로 인코딩합니다 (반정밀도 float16 은 사용하지 않음)', 'Integers use the shortest form; decimals use float32 when lossless, otherwise float64 (float16 is not used)'));
      issues.push(t('맵 키는 JSON 순서 그대로입니다. RFC 8949 의 결정적 인코딩(정렬된 키)이 필요하면 키를 미리 정렬하세요', 'Map keys keep JSON order; sort keys beforehand if you need RFC 8949 deterministic encoding'));
      return { _status: t('✅ ' + bytes.length + '바이트로 인코딩했습니다', '✅ Encoded into ' + bytes.length + ' bytes'), table: { head: [['형식', 'Format'], ['값', 'Value']], rows: [['hex', N.toHex(bytes, ' ')], ['Base64', N.toB64(bytes)], [t('길이', 'Length'), bytes.length + ' bytes']] }, out: N.hexdump(bytes, 512), diag: '', issues: issues };
    }
    var inp = N.get(v, o), u8 = inp.bytes, rows = [], nodes = 0, indefinite = 0;
    var dv2 = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    function need(p, n) { if (p + n > u8.length) throw new Error(t('데이터가 ' + p + ' 바이트 근처에서 끝났습니다 (' + n + '바이트 더 필요)', 'Data ends near byte ' + p + ' (' + n + ' more bytes needed)')); }
    function arg(p, ai) {
      if (ai < 24) return { n: ai, p: p };
      if (ai === 24) { need(p, 1); return { n: u8[p], p: p + 1 }; }
      if (ai === 25) { need(p, 2); return { n: dv2.getUint16(p), p: p + 2 }; }
      if (ai === 26) { need(p, 4); return { n: dv2.getUint32(p), p: p + 4 }; }
      if (ai === 27) { need(p, 8); var b = dv2.getBigUint64(p); return { n: b <= 9007199254740991n ? Number(b) : b, p: p + 8 }; }
      if (ai === 31) return { n: -1, p: p };
      throw new Error(t('오프셋 ' + (p - 1) + ': 예약된 추가 정보 값 ' + ai, 'Offset ' + (p - 1) + ': reserved additional info ' + ai));
    }
    var MT = ['unsigned int', 'negative int', 'byte string', 'text string', 'array', 'map', 'tag', 'simple/float'];
    function hexs(a) { return N.toHex(a); }
    function dec(p, path, depth) {
      need(p, 1); if (depth > 100) throw new Error(t('중첩이 너무 깊습니다', 'Nesting is too deep')); if (++nodes > 200000) throw new Error(t('요소가 너무 많습니다', 'Too many elements'));
      var start = p, ib = u8[p++], mt = ib >> 5, ai = ib & 31, val, diag;
      var add = function (shown, typeName) { if (rows.length < 400) rows.push([String(start), '0x' + (ib < 16 ? '0' : '') + ib.toString(16), new Array(depth + 1).join('  ') + path, typeName || MT[mt], shown]); };
      if (mt === 7) {
        if (ai < 20) { val = N.mark({ '$simple': ai }); diag = 'simple(' + ai + ')'; add('simple(' + ai + ')', 'simple'); }
        else if (ai === 20) { val = false; diag = 'false'; add('false', 'simple'); }
        else if (ai === 21) { val = true; diag = 'true'; add('true', 'simple'); }
        else if (ai === 22) { val = null; diag = 'null'; add('null', 'simple'); }
        else if (ai === 23) { val = undefined; diag = 'undefined'; add('undefined', 'simple'); }
        else if (ai === 24) { need(p, 1); val = N.mark({ '$simple': u8[p] }); diag = 'simple(' + u8[p] + ')'; p++; add(diag, 'simple'); }
        else if (ai === 25) { need(p, 2); val = half(dv2.getUint16(p)); p += 2; diag = fnum(val) + '_1'; add(String(val), 'float16'); }
        else if (ai === 26) { need(p, 4); val = dv2.getFloat32(p); p += 4; diag = fnum(val) + '_2'; add(N.f32(val), 'float32'); }
        else if (ai === 27) { need(p, 8); val = dv2.getFloat64(p); p += 8; diag = fnum(val) + '_3'; add(String(val), 'float64'); }
        else if (ai === 31) throw new Error(t('오프셋 ' + start + ': 짝이 없는 break(0xff) 입니다', 'Offset ' + start + ': stray break (0xff)'));
        else throw new Error(t('오프셋 ' + start + ': 잘못된 simple 값', 'Offset ' + start + ': invalid simple value'));
        return { v: val, d: diag, end: p };
      }
      var a = arg(p, ai); p = a.p;
      if (mt === 0) { val = a.n; add(String(val)); diag = String(val); return { v: val, d: diag, end: p }; }
      if (mt === 1) { val = typeof a.n === 'bigint' ? -1n - a.n : -1 - a.n; if (typeof val === 'bigint' && val >= -9007199254740991n) val = Number(val); add(String(val)); diag = String(val); return { v: val, d: diag, end: p }; }
      if (mt === 2 || mt === 3) {
        var parts = [];
        if (a.n === -1) {
          indefinite++; add('(_ …)', MT[mt] + ' (indefinite)');
          while (true) { need(p, 1); if (u8[p] === 0xff) { p++; break; } var ch = u8[p], cm = ch >> 5; if (cm !== mt) throw new Error(t('오프셋 ' + p + ': 부정 길이 문자열 안에는 같은 종류의 조각만 올 수 있습니다', 'Offset ' + p + ': chunks of an indefinite string must be the same type')); var ca = arg(p + 1, ch & 31); need(ca.p, ca.n); parts.push(u8.subarray(ca.p, ca.p + ca.n)); p = ca.p + ca.n; }
          var tot = parts.reduce(function (s, x) { return s + x.length; }, 0), all = new Uint8Array(tot), q = 0; parts.forEach(function (x) { all.set(x, q); q += x.length; });
          if (mt === 2) { val = all; diag = '(_ ' + parts.map(function (x) { return 'h\'' + hexs(x) + '\''; }).join(', ') + ')'; }
          else { val = new TextDecoder().decode(all); diag = '(_ ' + parts.map(function (x) { return JSON.stringify(new TextDecoder().decode(x)); }).join(', ') + ')'; }
          return { v: val, d: diag, end: p };
        }
        if (typeof a.n === 'bigint') throw new Error(t('길이가 너무 큽니다', 'Length is too large'));
        need(p, a.n); var raw = u8.subarray(p, p + a.n); p += a.n;
        if (mt === 2) { val = raw.slice(); diag = 'h\'' + hexs(raw) + '\''; add(N.disp(val)); }
        else { try { val = new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch (e) { issues.push(t('오프셋 ' + start + ' 의 텍스트가 올바른 UTF-8 이 아닙니다', 'The text at offset ' + start + ' is not valid UTF-8')); val = new TextDecoder().decode(raw); } diag = JSON.stringify(val); add(N.disp(val)); }
        return { v: val, d: diag, end: p };
      }
      if (mt === 4) {
        var arr = [], ds = [];
        if (a.n === -1) { indefinite++; add('[_ …]', 'array (indefinite)'); var i = 0; while (true) { need(p, 1); if (u8[p] === 0xff) { p++; break; } var r = dec(p, path + '[' + i + ']', depth + 1); p = r.end; arr.push(r.v); ds.push(r.d); i++; } return { v: arr, d: '[_ ' + ds.join(', ') + ']', end: p }; }
        add('array(' + a.n + ')');
        for (var k = 0; k < a.n; k++) { var r2 = dec(p, path + '[' + k + ']', depth + 1); p = r2.end; arr.push(r2.v); ds.push(r2.d); }
        return { v: arr, d: '[' + ds.join(', ') + ']', end: p };
      }
      if (mt === 5) {
        var m = new Map(), dd = [], dup = 0, ind = a.n === -1;
        if (ind) { indefinite++; add('{_ …}', 'map (indefinite)'); } else add('map(' + a.n + ')');
        for (var j = 0; ind || j < a.n; j++) {
          if (ind) { need(p, 1); if (u8[p] === 0xff) { p++; break; } }
          var rl = rows.length, kr = dec(p, path + '.«key ' + j + '»', depth + 1); p = kr.end; if (typeof kr.v === 'string') rows.length = rl;
          var ks = typeof kr.v === 'string' ? kr.v : N.keyStr(N.isMark(kr.v) ? kr.v.plain : kr.v);
          if (typeof kr.v !== 'string') issues.push(t('문자열이 아닌 맵 키(' + ks + ')는 JSON 에서 문자열이 됩니다', 'Non-string map key (' + ks + ') becomes a string in JSON'));
          var vr = dec(p, path + '.' + ks, depth + 1); p = vr.end; if (m.has(kr.v)) dup++; m.set(kr.v, vr.v); dd.push(kr.d + ': ' + vr.d);
        }
        if (dup) issues.push(t('중복된 맵 키가 있습니다 (나중 값이 우선)', 'Duplicate map keys found (the later value wins)'));
        return { v: m, d: (ind ? '{_ ' : '{') + dd.join(', ') + '}', end: p };
      }
      /* mt === 6 : tag */
      if (typeof a.n === 'bigint') throw new Error(t('태그 번호가 너무 큽니다', 'Tag number is too large'));
      var TAGN = { 0: 'date/time string', 1: 'epoch date/time', 2: 'positive bignum', 3: 'negative bignum', 4: 'decimal fraction', 5: 'bigfloat', 21: 'expect base64url', 22: 'expect base64', 23: 'expect base16', 24: 'embedded CBOR', 32: 'URI', 33: 'base64url', 34: 'base64', 35: 'regex', 36: 'MIME', 55799: 'self-described CBOR' };
      add('tag(' + a.n + ')' + (TAGN[a.n] ? ' — ' + TAGN[a.n] : ''), 'tag');
      var inner = dec(p, path, depth + 1); p = inner.end; var iv = inner.v;
      if ((a.n === 2 || a.n === 3) && iv instanceof Uint8Array) { var big = 0n; for (var z = 0; z < iv.length; z++) big = (big << 8n) | BigInt(iv[z]); if (a.n === 3) big = -1n - big; val = big >= -9007199254740991n && big <= 9007199254740991n ? Number(big) : big; }
      else if (a.n === 1 && typeof iv === 'number') { var dt = new Date(iv * 1000); val = N.mark({ '$tag': 1, '$value': iv, '$iso': isNaN(dt) ? null : dt.toISOString() }); }
      else if (a.n === 55799) val = iv;
      else val = N.mark({ '$tag': a.n, '$value': iv });
      return { v: val, d: a.n + '(' + inner.d + ')', end: p };
    }
    function fnum(x) { if (isNaN(x)) return 'NaN'; if (!isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity'; return Number.isInteger(x) ? x.toFixed(1) : String(x); }
    var r0 = dec(0, '$', 0), extra = u8.length - r0.end;
    if (extra > 0) issues.push(t('값이 끝난 뒤 ' + extra + '바이트가 더 있습니다 (오프셋 ' + r0.end + '~). CBOR 시퀀스라면 잘라서 나눠 해석하세요', extra + ' trailing byte(s) after the value (offset ' + r0.end + '); split a CBOR sequence and decode each item'));
    if (indefinite) issues.push(t('부정 길이(indefinite) 항목이 ' + indefinite + '개 있습니다. 결정적 인코딩(RFC 8949 4.2)은 부정 길이를 허용하지 않습니다', indefinite + ' indefinite-length item(s); deterministic encoding (RFC 8949 4.2) forbids them'));
    if (rows.length >= 400) issues.push(t('표는 처음 400개 요소만 보여 줍니다', 'The table shows only the first 400 elements'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: t('✅ 해석 완료 — ' + u8.length + '바이트, 요소 ' + nodes + '개', '✅ Decoded — ' + u8.length + ' bytes, ' + nodes + ' items'), table: { head: [['오프셋', 'Offset'], ['바이트', 'Byte'], ['경로', 'Path'], ['타입', 'Type'], ['값', 'Value']], rows: rows }, out: N.toJson(r0.v, 'plain', 2), diag: r0.d, issues: uniq };
  }
});
