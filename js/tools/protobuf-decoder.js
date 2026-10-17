TK.tool('protobuf-decoder', {
  inputs: TK.binin.inputs('in', ['Protobuf 바이너리 (16진수 / Base64)', 'Protobuf binary (hex / Base64)'], '08 96 01 12 05 57 6f 6f 61 21 1a 06 08 01 12 02 68 69 20 03 28 05 35 00 00 80 3f 39 18 2d 44 54 fb 21 09 40 42 03 01 02 03', 6),
  options: [
    { id: 'nest', type: 'checkbox', label: ['길이 구분 필드를 중첩 메시지·문자열로 추정', 'Guess nested messages and strings for length-delimited fields'], default: true },
    { id: 'grpc', type: 'checkbox', label: ['gRPC 5바이트 헤더(압축 플래그 + 길이) 건너뛰기', 'Skip the 5-byte gRPC header (compression flag + length)'], default: false },
    TK.binin.modeOption(), TK.binin.fmtOption()
  ],
  outputs: [{ id: 'table', label: ['필드 목록 (바이트 오프셋)', 'Fields (byte offsets)'], kind: 'table' }, { id: 'out', label: ['JSON (필드 번호 기준)', 'JSON (by field number)'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [], inp = N.get(v, o), u8 = inp.bytes, rows = [], count = 0;
    var start0 = 0;
    if (o.grpc) {
      if (u8.length < 5) throw new Error(t('gRPC 헤더(5바이트)보다 짧습니다', 'Shorter than the 5-byte gRPC header'));
      var dvh = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), ln = dvh.getUint32(1);
      if (u8[0] === 1) issues.push(t('압축 플래그가 1 입니다. 메시지가 압축(gzip 등)되어 있어 해석할 수 없습니다', 'Compression flag is 1: the message is compressed and cannot be decoded here'));
      if (ln !== u8.length - 5) issues.push(t('gRPC 헤더의 길이(' + ln + ')가 실제 데이터(' + (u8.length - 5) + '바이트)와 다릅니다', 'gRPC header length (' + ln + ') differs from the data (' + (u8.length - 5) + ' bytes)'));
      u8 = u8.subarray(5); start0 = 5;
    }
    function varint(buf, p, end) {
      var r = 0n, shift = 0n, i = 0;
      while (true) {
        if (p + i >= end) return null;
        var b = buf[p + i]; r |= BigInt(b & 0x7f) << shift; i++;
        if (!(b & 0x80)) break; shift += 7n; if (i > 10) return null;
      }
      return { v: r, n: i };
    }
    function printable(a) {
      var s; try { s = new TextDecoder('utf-8', { fatal: true }).decode(a); } catch (e) { return null; }
      for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c < 32 && c !== 10 && c !== 13 && c !== 9) return null; if (c === 0x7f || (c >= 0x80 && c < 0xa0)) return null; }
      return s;
    }
    /* 오류 시 null (추정 모드), strict 시 throw */
    function parse(buf, p, end, strict) {
      var fields = [];
      while (p < end) {
        var tg = varint(buf, p, end); if (!tg) { if (strict) throw new Error(t('오프셋 ' + (start0 + p) + ': 필드 키(varint)를 읽을 수 없습니다', 'Offset ' + (start0 + p) + ': cannot read a field key (varint)')); return null; }
        var key = tg.v, wt = Number(key & 7n), num = Number(key >> 3n), q = p + tg.n, f = { off: p, num: num, wt: wt };
        if (num < 1 || num > 536870911) { if (strict) throw new Error(t('오프셋 ' + (start0 + p) + ': 필드 번호 ' + num + ' 가 올바르지 않습니다', 'Offset ' + (start0 + p) + ': invalid field number ' + num)); return null; }
        if (wt === 0) { var vi = varint(buf, q, end); if (!vi) { if (strict) throw new Error(t('오프셋 ' + (start0 + q) + ': varint 값이 끝나지 않았습니다', 'Offset ' + (start0 + q) + ': truncated varint')); return null; } f.val = vi.v; q += vi.n; }
        else if (wt === 1) { if (q + 8 > end) { if (strict) throw new Error(t('오프셋 ' + (start0 + q) + ': fixed64 데이터가 부족합니다', 'Offset ' + (start0 + q) + ': fixed64 truncated')); return null; } f.raw = buf.subarray(q, q + 8); q += 8; }
        else if (wt === 5) { if (q + 4 > end) { if (strict) throw new Error(t('오프셋 ' + (start0 + q) + ': fixed32 데이터가 부족합니다', 'Offset ' + (start0 + q) + ': fixed32 truncated')); return null; } f.raw = buf.subarray(q, q + 4); q += 4; }
        else if (wt === 2) { var lv = varint(buf, q, end); if (!lv) { if (strict) throw new Error(t('오프셋 ' + (start0 + q) + ': 길이를 읽을 수 없습니다', 'Offset ' + (start0 + q) + ': cannot read the length')); return null; } q += lv.n; var L = Number(lv.v); if (lv.v > 2147483647n || q + L > end) { if (strict) throw new Error(t('오프셋 ' + (start0 + p) + ': 필드 ' + num + ' 의 길이 ' + lv.v + ' 가 남은 데이터(' + (end - q) + '바이트)보다 큽니다', 'Offset ' + (start0 + p) + ': field ' + num + ' length ' + lv.v + ' exceeds the remaining ' + (end - q) + ' bytes')); return null; } f.raw = buf.subarray(q, q + L); f.rawOff = q; q += L; }
        else if (wt === 3 || wt === 4) { if (strict) throw new Error(t('오프셋 ' + (start0 + p) + ': 그룹(wire type ' + wt + ')은 폐기된 형식이라 해석하지 않습니다', 'Offset ' + (start0 + p) + ': groups (wire type ' + wt + ') are deprecated and not decoded')); return null; }
        else { if (strict) throw new Error(t('오프셋 ' + (start0 + p) + ': 알 수 없는 wire type ' + wt, 'Offset ' + (start0 + p) + ': unknown wire type ' + wt)); return null; }
        f.end = q; fields.push(f); p = q;
      }
      return fields;
    }
    function f64(a) { return new DataView(a.buffer, a.byteOffset, 8).getFloat64(0, true); }
    function f32(a) { return new DataView(a.buffer, a.byteOffset, 4).getFloat32(0, true); }
    function nice(x) { return Number.isInteger(x) && Math.abs(x) < 1e21 ? x.toFixed(0) : String(x); }
    function render(fields, depth, pathPrefix) {
      var obj = {}, order = [];
      fields.forEach(function (f) {
        if (++count > 5000) throw new Error(t('필드가 너무 많습니다', 'Too many fields'));
        var disp, jv, typeName, path = pathPrefix + f.num;
        function put(val) { if (!(f.num in obj)) { obj[f.num] = val; order.push(f.num); } else if (Array.isArray(obj[f.num]) && obj[f.num].__rep) obj[f.num].push(val); else { var a = [obj[f.num], val]; a.__rep = true; obj[f.num] = a; } }
        function row(tn, shown) { if (rows.length < 400) rows.push([String(start0 + f.off), new Array(depth + 1).join('  ') + path, 'wt ' + f.wt, tn, shown]); }
        if (f.wt === 0) {
          var u = f.val, s = BigInt.asIntN(64, u), z = (u >> 1n) ^ -(u & 1n), alt = [];
          if (s !== u) alt.push('int64 ' + s);
          if (z !== u) alt.push('sint ' + z);
          if (u === 0n || u === 1n) alt.push('bool ' + (u === 1n ? 'true' : 'false'));
          row('varint', u + (alt.length ? '  (' + alt.join(' · ') + ')' : ''));
          put(u <= 9007199254740991n ? Number(u) : u.toString());
        } else if (f.wt === 1) {
          var d = f64(f.raw), bi = new DataView(f.raw.buffer, f.raw.byteOffset, 8).getBigUint64(0, true);
          var dOk = isFinite(d) && d !== 0 && Math.abs(d) > 1e-300 && Math.abs(d) < 1e300;
          row('fixed64', bi + ' · int64 ' + BigInt.asIntN(64, bi) + (dOk ? ' · double ' + nice(d) : ''));
          put(bi <= 9007199254740991n ? Number(bi) : bi.toString());
        } else if (f.wt === 5) {
          var fl = f32(f.raw), ui = new DataView(f.raw.buffer, f.raw.byteOffset, 4).getUint32(0, true);
          var fOk = isFinite(fl) && fl !== 0 && Math.abs(fl) > 1e-30 && Math.abs(fl) < 1e30;
          row('fixed32', ui + ' · int32 ' + (ui | 0) + (fOk ? ' · float ' + N.f32(fl) : ''));
          put(ui);
        } else {
          var raw = f.raw, text = null, sub = null;
          if (!raw.length) { row('len=0', t('(빈 값: 빈 문자열/바이트/메시지)', '(empty string / bytes / message)')); put(''); return; }
          if (o.nest) {
            text = printable(raw);
            if (text === null) { sub = parse(raw, 0, raw.length, false); if (sub && !sub.length) sub = null; }
          }
          if (text !== null) { row('string?', JSON.stringify(N.short(text, 80)) + ' (' + raw.length + ' B)'); put(text); }
          else if (sub) {
            row('message?', '{' + sub.length + ' ' + t('필드', 'fields') + '} (' + raw.length + ' B)');
            var inner = render(sub.map(function (x) { x.off += f.rawOff; if (x.rawOff != null) x.rawOff += f.rawOff; return x; }), depth + 1, path + '.');
            put(inner);
          } else {
            var packed = null, p2 = 0, vs = [];
            while (p2 < raw.length) { var pv = varint(raw, p2, raw.length); if (!pv) { vs = null; break; } vs.push(pv.v); p2 += pv.n; }
            if (vs && vs.length > 1) packed = vs;
            row('bytes', 'h\'' + N.short(N.toHex(raw), 48) + '\' (' + raw.length + ' B)' + (packed ? ' · ' + t('packed varint 이라면', 'if packed varints') + ' [' + packed.slice(0, 12).join(', ') + (packed.length > 12 ? ', …' : '') + ']' : ''));
            put(N.mark(N.toHex(raw)));
          }
        }
      });
      var res = {}; order.forEach(function (k) { var x = obj[k]; res[k] = x; });
      return res;
    }
    var fields = parse(u8, 0, u8.length, true);
    if (!fields.length) throw new Error(t('필드가 없습니다', 'No fields'));
    var tree = render(fields, 0, '');
    issues.push(t('스키마(.proto) 없이 해석한 결과입니다. 정수가 int32/uint32/sint32/bool/enum 중 무엇인지, 문자열인지 중첩 메시지인지는 추정이며 같은 바이트가 여러 의미를 가질 수 있습니다', 'Decoded without a .proto schema: whether an integer is int32 / uint32 / sint32 / bool / enum, or whether bytes are a string or a nested message, is a guess'));
    issues.push(t('같은 필드 번호가 반복되면 JSON 에서 배열이 됩니다 (repeated 필드 또는 map 항목)', 'A repeated field number becomes an array in JSON (repeated fields or map entries)'));
    if (rows.length >= 400) issues.push(t('표는 처음 400개 필드만 보여 줍니다', 'The table shows only the first 400 fields'));
    return { _status: t('✅ 해석 완료 — ' + u8.length + '바이트, 필드 ' + count + '개', '✅ Decoded — ' + u8.length + ' bytes, ' + count + ' fields'), table: { head: [['오프셋', 'Offset'], ['필드', 'Field'], ['wire', 'Wire'], ['타입', 'Type'], ['값 (가능한 해석)', 'Value (possible readings)']], rows: rows }, out: N.toJson(tree, 'plain', 2), issues: issues };
  }
});
