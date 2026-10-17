TK.tool('messagepack-viewer', {
  inputs: TK.binin.inputs('in', ['MessagePack (16진수/Base64) 또는 인코딩할 JSON', 'MessagePack (hex / Base64) or JSON to encode'], '84 a4 6e 61 6d 65 a5 57 6f 6f 61 21 a3 61 67 65 1e a6 73 63 6f 72 65 73 93 01 cb 40 09 1e b8 51 eb 85 1f d4 02 0a a2 6f 6b c3', 6),
  options: [
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['dec', ['해석 (MessagePack → JSON)', 'Decode (MessagePack → JSON)']], ['enc', ['인코딩 (JSON → MessagePack)', 'Encode (JSON → MessagePack)']]], default: 'dec' },
    TK.binin.modeOption(), TK.binin.fmtOption()
  ],
  outputs: [{ id: 'table', label: ['구조 (바이트 오프셋)', 'Structure (byte offsets)'], kind: 'table' }, { id: 'out', label: ['JSON / 인코딩 결과', 'JSON / encoded result'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [];
    if (o.dir === 'enc') {
      var src = String(v['in'] || '').trim(); if (!src) throw new Error(t('인코딩할 JSON 을 입력하세요', 'Enter JSON to encode'));
      var val; try { val = JSON.parse(src); } catch (e) { throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); }
      var out = [];
      var w = function (a) { for (var i = 0; i < a.length; i++) out.push(a[i]); };
      var be = function (n, size) { var r = []; for (var i = size - 1; i >= 0; i--) r.push(Math.floor(n / Math.pow(2, 8 * i)) & 255); return r; };
      var enc = function (x) {
        if (x === null) return out.push(0xc0);
        if (x === true) return out.push(0xc3); if (x === false) return out.push(0xc2);
        if (typeof x === 'number') {
          if (Number.isInteger(x)) {
            if (x >= 0) { if (x < 128) out.push(x); else if (x < 256) { out.push(0xcc); w(be(x, 1)); } else if (x < 65536) { out.push(0xcd); w(be(x, 2)); } else if (x < 4294967296) { out.push(0xce); w(be(x, 4)); } else { out.push(0xcf); var bi = BigInt(x); for (var i = 7; i >= 0; i--) out.push(Number((bi >> BigInt(8 * i)) & 255n)); } }
            else { if (x >= -32) out.push(x & 255); else if (x >= -128) { out.push(0xd0); out.push(x & 255); } else if (x >= -32768) { out.push(0xd1); w(be(x + 65536, 2)); } else if (x >= -2147483648) { out.push(0xd2); w(be(x + 4294967296, 4)); } else { out.push(0xd3); var bn = BigInt.asUintN(64, BigInt(x)); for (var k = 7; k >= 0; k--) out.push(Number((bn >> BigInt(8 * k)) & 255n)); } }
            return;
          }
          out.push(0xcb); var dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, x); for (var j = 0; j < 8; j++) out.push(dv.getUint8(j)); return;
        }
        if (typeof x === 'string') { var u = new TextEncoder().encode(x), n = u.length; if (n < 32) out.push(0xa0 | n); else if (n < 256) { out.push(0xd9); w(be(n, 1)); } else if (n < 65536) { out.push(0xda); w(be(n, 2)); } else { out.push(0xdb); w(be(n, 4)); } return w(u); }
        if (Array.isArray(x)) { var l = x.length; if (l < 16) out.push(0x90 | l); else if (l < 65536) { out.push(0xdc); w(be(l, 2)); } else { out.push(0xdd); w(be(l, 4)); } return x.forEach(enc); }
        var keys = Object.keys(x);
        if (keys.length === 1 && keys[0] === '$binary' && typeof x.$binary === 'string') { var bb = N.fromB64(x.$binary), bl = bb.length; if (bl < 256) { out.push(0xc4); w(be(bl, 1)); } else if (bl < 65536) { out.push(0xc5); w(be(bl, 2)); } else { out.push(0xc6); w(be(bl, 4)); } return w(bb); }
        var m = keys.length; if (m < 16) out.push(0x80 | m); else if (m < 65536) { out.push(0xde); w(be(m, 2)); } else { out.push(0xdf); w(be(m, 4)); }
        keys.forEach(function (k) { enc(k); enc(x[k]); });
      };
      enc(val);
      var bytes = new Uint8Array(out);
      if (/\d{16,}/.test(src)) issues.push(t('JavaScript 숫자는 2^53 을 넘으면 정밀도를 잃습니다. 큰 정수는 별도 도구로 인코딩하세요', 'JavaScript numbers lose precision above 2^53; encode big integers another way'));
      issues.push(t('JSON 의 모든 소수는 float64(0xcb) 로 인코딩됩니다. 정수는 가장 짧은 형식을 씁니다', 'All JSON decimals are encoded as float64 (0xcb); integers use the shortest format'));
      return { _status: t('✅ ' + bytes.length + '바이트로 인코딩했습니다', '✅ Encoded into ' + bytes.length + ' bytes'), table: { head: [['형식', 'Format'], ['값', 'Value']], rows: [['hex', N.toHex(bytes, ' ')], ['Base64', N.toB64(bytes)], [t('길이', 'Length'), bytes.length + ' bytes']] }, out: N.hexdump(bytes, 512), issues: issues };
    }
    var inp = N.get(v, o), u8 = inp.bytes, rows = [];
    var NAMES = { 0xc4: 'bin 8', 0xc5: 'bin 16', 0xc6: 'bin 32', 0xca: 'float 32', 0xcb: 'float 64', 0xcc: 'uint 8', 0xcd: 'uint 16', 0xce: 'uint 32', 0xcf: 'uint 64', 0xd0: 'int 8', 0xd1: 'int 16', 0xd2: 'int 32', 0xd3: 'int 64', 0xd9: 'str 8', 0xda: 'str 16', 0xdb: 'str 32', 0xdc: 'array 16', 0xdd: 'array 32', 0xde: 'map 16', 0xdf: 'map 32' };
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), nodes = 0, dupKeys = 0, nonStrKeys = 0;
    function need(p, n) { if (p + n > u8.length) throw new Error(t('데이터가 ' + p + ' 바이트 근처에서 끝났습니다 (' + n + '바이트 더 필요)', 'Data ends near byte ' + p + ' (' + n + ' more bytes needed)')); }
    function str(p, n) { need(p, n); try { return new TextDecoder('utf-8', { fatal: true }).decode(u8.subarray(p, p + n)); } catch (e) { issues.push(t('오프셋 ' + p + ' 의 문자열이 올바른 UTF-8 이 아닙니다', 'The string at offset ' + p + ' is not valid UTF-8')); return new TextDecoder().decode(u8.subarray(p, p + n)); } }
    function ts(p, n) {
      if (n === 4) return dv.getUint32(p);
      return null;
    }
    function ext(p, n, type) {
      need(p, n); var data = u8.subarray(p, p + n);
      if (type === -1 && (n === 4 || n === 8 || n === 12)) {
        var sec, nsec = 0;
        if (n === 4) sec = dv.getUint32(p); else if (n === 8) { var hi = dv.getUint32(p), lo = dv.getUint32(p + 4); nsec = hi >>> 2; sec = (hi & 3) * 4294967296 + lo; } else { nsec = dv.getUint32(p); sec = Number(dv.getBigInt64(p + 4)); }
        var d = new Date(sec * 1000), iso = isNaN(d) ? String(sec) : d.toISOString().replace('.000Z', nsec ? '.' + ('000000000' + nsec).slice(-9) + 'Z' : 'Z');
        return { v: N.mark({ '$timestamp': iso }), label: 'timestamp ' + iso };
      }
      return { v: N.mark({ '$ext': type, '$data': N.toHex(data) }), label: 'ext ' + type + ' h\'' + N.short(N.toHex(data), 40) + '\'' };
    }
    function dec(p, path, depth) {
      need(p, 1); if (depth > 100) throw new Error(t('중첩이 너무 깊습니다', 'Nesting is too deep')); if (++nodes > 200000) throw new Error(t('요소가 너무 많습니다', 'Too many elements'));
      var b = u8[p], start = p, val, label, kind;
      p++;
      var add = function (typeName, shown, len) { if (rows.length < 400) rows.push([String(start), '0x' + (b < 16 ? '0' : '') + b.toString(16), new Array(depth + 1).join('  ') + (path || '$'), typeName, shown]); };
      var rd = function (n, fn) { need(p, n); var r = fn(p); p += n; return r; };
      var container = function (count, isMap, typeName) {
        add(typeName, (isMap ? 'map(' : 'array(') + count + ')');
        if (isMap) {
          var m = new Map();
          for (var i = 0; i < count; i++) {
            var rl = rows.length, kr = dec(p, path + '.«key ' + i + '»', depth + 1); p = kr.end; if (typeof kr.v === 'string') rows.length = rl;
            var key = kr.v; if (typeof key !== 'string') nonStrKeys++;
            var ks = typeof key === 'string' ? key : N.keyStr(B_unmark(key)), pathK = path + '.' + ks;
            if (m.has(key)) dupKeys++;
            var vr = dec(p, pathK, depth + 1); p = vr.end; m.set(key, vr.v);
          }
          return m;
        }
        var arr = []; for (var j = 0; j < count; j++) { var er = dec(p, path + '[' + j + ']', depth + 1); p = er.end; arr.push(er.v); } return arr;
      };
      function B_unmark(x) { return N.isMark(x) ? x.plain : x; }
      var tn = null;
      if (b <= 0x7f) { val = b; add('positive fixint', String(val)); }
      else if (b >= 0xe0) { val = b - 256; add('negative fixint', String(val)); }
      else if (b >= 0xa0 && b <= 0xbf) { var n1 = b & 31; val = str(p, n1); p += n1; add('fixstr', N.disp(val)); }
      else if (b >= 0x90 && b <= 0x9f) val = container(b & 15, false, 'fixarray');
      else if (b >= 0x80 && b <= 0x8f) val = container(b & 15, true, 'fixmap');
      else switch (b) {
        case 0xc0: val = null; add('nil', 'null'); break;
        case 0xc1: throw new Error(t('오프셋 ' + start + ': 0xc1 은 사용되지 않는 바이트입니다', 'Offset ' + start + ': 0xc1 is a never-used byte'));
        case 0xc2: val = false; add('false', 'false'); break;
        case 0xc3: val = true; add('true', 'true'); break;
        case 0xc4: case 0xc5: case 0xc6: { var bl = b === 0xc4 ? rd(1, function (q) { return u8[q]; }) : b === 0xc5 ? rd(2, function (q) { return dv.getUint16(q); }) : rd(4, function (q) { return dv.getUint32(q); }); need(p, bl); val = u8.slice(p, p + bl); p += bl; add(NAMES[b], N.disp(val)); break; }
        case 0xc7: case 0xc8: case 0xc9: { var el = b === 0xc7 ? rd(1, function (q) { return u8[q]; }) : b === 0xc8 ? rd(2, function (q) { return dv.getUint16(q); }) : rd(4, function (q) { return dv.getUint32(q); }); var et = rd(1, function (q) { return dv.getInt8(q); }); var er2 = ext(p, el, et); p += el; val = er2.v; add('ext ' + (b - 0xc6 === 1 ? 8 : b === 0xc8 ? 16 : 32), er2.label); break; }
        case 0xca: val = rd(4, function (q) { return dv.getFloat32(q); }); add('float 32', N.f32(val)); break;
        case 0xcb: val = rd(8, function (q) { return dv.getFloat64(q); }); add('float 64', String(val)); break;
        case 0xcc: val = rd(1, function (q) { return u8[q]; }); add('uint 8', String(val)); break;
        case 0xcd: val = rd(2, function (q) { return dv.getUint16(q); }); add('uint 16', String(val)); break;
        case 0xce: val = rd(4, function (q) { return dv.getUint32(q); }); add('uint 32', String(val)); break;
        case 0xcf: val = rd(8, function (q) { return dv.getBigUint64(q); }); if (val <= 9007199254740991n) val = Number(val); add('uint 64', String(val)); break;
        case 0xd0: val = rd(1, function (q) { return dv.getInt8(q); }); add('int 8', String(val)); break;
        case 0xd1: val = rd(2, function (q) { return dv.getInt16(q); }); add('int 16', String(val)); break;
        case 0xd2: val = rd(4, function (q) { return dv.getInt32(q); }); add('int 32', String(val)); break;
        case 0xd3: val = rd(8, function (q) { return dv.getBigInt64(q); }); if (val >= -9007199254740991n && val <= 9007199254740991n) val = Number(val); add('int 64', String(val)); break;
        case 0xd4: case 0xd5: case 0xd6: case 0xd7: case 0xd8: { var fl = { 0xd4: 1, 0xd5: 2, 0xd6: 4, 0xd7: 8, 0xd8: 16 }[b]; var ft = rd(1, function (q) { return dv.getInt8(q); }); var fr = ext(p, fl, ft); p += fl; val = fr.v; add('fixext ' + fl, fr.label); break; }
        case 0xd9: case 0xda: case 0xdb: { var sl = b === 0xd9 ? rd(1, function (q) { return u8[q]; }) : b === 0xda ? rd(2, function (q) { return dv.getUint16(q); }) : rd(4, function (q) { return dv.getUint32(q); }); val = str(p, sl); p += sl; add(NAMES[b], N.disp(val)); break; }
        case 0xdc: val = container(rd(2, function (q) { return dv.getUint16(q); }), false, 'array 16'); break;
        case 0xdd: val = container(rd(4, function (q) { return dv.getUint32(q); }), false, 'array 32'); break;
        case 0xde: val = container(rd(2, function (q) { return dv.getUint16(q); }), true, 'map 16'); break;
        case 0xdf: val = container(rd(4, function (q) { return dv.getUint32(q); }), true, 'map 32'); break;
      }
      return { v: val, end: p };
    }
    var r = dec(0, '$', 0), extra = u8.length - r.end;
    if (extra > 0) issues.push(t('값이 끝난 뒤 ' + extra + '바이트가 더 있습니다 (오프셋 ' + r.end + '~). 여러 값이 이어진 스트림이면 잘라서 다시 시도하세요', extra + ' trailing byte(s) after the value (offset ' + r.end + '). If this is a stream of values, split it and retry'));
    if (nonStrKeys) issues.push(t('문자열이 아닌 맵 키가 ' + nonStrKeys + '개 있어 JSON 에서는 문자열로 바뀝니다', nonStrKeys + ' map key(s) are not strings and become strings in JSON'));
    if (dupKeys) issues.push(t('중복된 맵 키가 ' + dupKeys + '개 있습니다 (나중 값이 우선)', dupKeys + ' duplicate map key(s) (the later value wins)'));
    if (rows.length >= 400) issues.push(t('표는 처음 400개 요소만 보여 줍니다', 'The table shows only the first 400 elements'));
    issues.push(t('64비트 정수가 2^53 을 넘으면 JSON 에 숫자 그대로 적히지만 JavaScript 로 읽으면 정밀도를 잃을 수 있습니다', '64-bit integers beyond 2^53 are printed as-is but lose precision when parsed by JavaScript'));
    return { _status: t('✅ 해석 완료 — ' + u8.length + '바이트, 요소 ' + nodes + '개', '✅ Decoded — ' + u8.length + ' bytes, ' + nodes + ' elements'), table: { head: [['오프셋', 'Offset'], ['바이트', 'Byte'], ['경로', 'Path'], ['형식', 'Type'], ['값', 'Value']], rows: rows }, out: N.toJson(r.v, 'plain', 2), issues: issues };
  }
});
