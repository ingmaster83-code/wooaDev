TK.tool('bson-viewer', {
  inputs: TK.binin.inputs('in', ['BSON (16진수/Base64) 또는 인코딩할 확장 JSON', 'BSON (hex / Base64) or Extended JSON to encode'], '7d 00 00 00 07 5f 69 64 00 50 7f 1f 77 bc f8 6c d7 99 43 90 11 02 6e 61 6d 65 00 05 00 00 00 57 6f 6f 61 00 10 61 67 65 00 1e 00 00 00 01 73 63 6f 72 65 00 1f 85 eb 51 b8 1e 09 40 09 63 72 65 61 74 65 64 00 00 84 28 47 a1 01 00 00 04 74 61 67 73 00 17 00 00 00 02 30 00 02 00 00 00 61 00 02 31 00 02 00 00 00 62 00 00 12 62 69 67 00 01 00 00 00 00 00 20 00 08 6f 6b 00 01 00', 6),
  options: [
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['dec', ['해석 (BSON → JSON)', 'Decode (BSON → JSON)']], ['enc', ['인코딩 (확장 JSON → BSON)', 'Encode (Extended JSON → BSON)']]], default: 'dec' },
    { id: 'ej', type: 'select', label: ['JSON 표기', 'JSON style'], choices: [['relaxed', ['Relaxed 확장 JSON', 'Relaxed Extended JSON']], ['ejson', ['Canonical 확장 JSON', 'Canonical Extended JSON']], ['plain', ['단순 JSON (타입 정보 생략)', 'Plain JSON (types dropped)']]], default: 'relaxed', show: function (o) { return o.dir === 'dec'; } },
    TK.binin.modeOption(), TK.binin.fmtOption()
  ],
  outputs: [{ id: 'table', label: ['요소 목록 (바이트 오프셋)', 'Elements (byte offsets)'], kind: 'table' }, { id: 'out', label: ['JSON / 인코딩 결과', 'JSON / encoded result'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [];
    function dec128(b) {
      var lo = 0n, hi = 0n; for (var i = 7; i >= 0; i--) { lo = (lo << 8n) | BigInt(b[i]); hi = (hi << 8n) | BigInt(b[8 + i]); }
      var sign = (hi >> 63n) ? '-' : '';
      if (((hi >> 58n) & 31n) === 31n) return 'NaN';
      if (((hi >> 58n) & 31n) === 30n) return sign + 'Infinity';
      var exp, coef;
      if (((hi >> 61n) & 3n) === 3n) { exp = Number((hi >> 47n) & 0x3fffn); coef = 0n; }
      else { exp = Number((hi >> 49n) & 0x3fffn); coef = ((hi & ((1n << 49n) - 1n)) << 64n) | lo; }
      if (coef > 9999999999999999999999999999999999n) coef = 0n;
      var e = exp - 6176, ds = coef.toString();
      var adj = e + ds.length - 1;
      if (e <= 0 && adj >= -6) {
        if (e === 0) return sign + ds;
        var pos = ds.length + e; if (pos > 0) return sign + ds.slice(0, pos) + '.' + ds.slice(pos);
        return sign + '0.' + new Array(-pos + 1).join('0') + ds;
      }
      return sign + ds.charAt(0) + (ds.length > 1 ? '.' + ds.slice(1) : '') + 'E' + (adj >= 0 ? '+' : '') + adj;
    }
    if (o.dir === 'enc') {
      var src = String(v['in'] || '').trim(); if (!src) throw new Error(t('인코딩할 JSON 을 입력하세요', 'Enter JSON to encode'));
      var val; try { val = JSON.parse(src); } catch (e) { throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); }
      if (!val || typeof val !== 'object' || Array.isArray(val)) throw new Error(t('최상위는 JSON 객체여야 합니다 (BSON 문서)', 'The top level must be a JSON object (a BSON document)'));
      var enc = new TextEncoder();
      function cstr(s) { var u = enc.encode(s); if (u.indexOf(0) >= 0) throw new Error(t('NUL 문자는 키나 정규식에 쓸 수 없습니다', 'NUL is not allowed in keys or regex')); var r = new Uint8Array(u.length + 1); r.set(u); return r; }
      function i32(n) { var a = new Uint8Array(4); new DataView(a.buffer).setInt32(0, n, true); return a; }
      function i64(n) { var a = new Uint8Array(8); new DataView(a.buffer).setBigInt64(0, BigInt(n), true); return a; }
      function f64(n) { var a = new Uint8Array(8); new DataView(a.buffer).setFloat64(0, n, true); return a; }
      function cat(parts) { var n = parts.reduce(function (s, p) { return s + p.length; }, 0), r = new Uint8Array(n), q = 0; parts.forEach(function (p) { r.set(p, q); q += p.length; }); return r; }
      function str(s) { var u = enc.encode(s); return cat([i32(u.length + 1), u, new Uint8Array([0])]); }
      function ex(x) { var k = Object.keys(x); return k.length ? k : null; }
      function num(x) { var m = /^-?\d+$/; return m.test(String(x)); }
      function elem(key, x) {
        var k = cstr(key);
        if (x === null) return cat([new Uint8Array([0x0a]), k]);
        if (typeof x === 'boolean') return cat([new Uint8Array([8]), k, new Uint8Array([x ? 1 : 0])]);
        if (typeof x === 'string') return cat([new Uint8Array([2]), k, str(x)]);
        if (typeof x === 'number') {
          if (Number.isInteger(x) && x >= -2147483648 && x <= 2147483647) return cat([new Uint8Array([0x10]), k, i32(x)]);
          if (Number.isInteger(x) && Math.abs(x) <= 9007199254740991) return cat([new Uint8Array([0x12]), k, i64(x)]);
          return cat([new Uint8Array([1]), k, f64(x)]);
        }
        if (Array.isArray(x)) { var d = {}; x.forEach(function (e, i) { d[i] = e; }); return cat([new Uint8Array([4]), k, doc(d, true)]); }
        var keys = Object.keys(x), k1 = keys[0];
        if (keys.length === 1 || (keys.length === 2 && k1 === '$binary')) {
          var w = x[k1];
          if (k1 === '$oid') { if (!/^[0-9a-fA-F]{24}$/.test(w)) throw new Error(t('$oid 는 16진수 24자리여야 합니다', '$oid must be 24 hex digits')); var oid = new Uint8Array(12); for (var i = 0; i < 12; i++) oid[i] = parseInt(w.substr(i * 2, 2), 16); return cat([new Uint8Array([7]), k, oid]); }
          if (k1 === '$date') { var ms; if (typeof w === 'string') { ms = Date.parse(w); if (isNaN(ms)) throw new Error(t('$date 형식 오류: ', 'Bad $date: ') + w); } else if (w && w.$numberLong) ms = Number(w.$numberLong); else if (typeof w === 'number') ms = w; else throw new Error(t('$date 형식을 알 수 없습니다', 'Unknown $date form')); return cat([new Uint8Array([9]), k, i64(ms)]); }
          if (k1 === '$numberInt') return cat([new Uint8Array([0x10]), k, i32(parseInt(w, 10))]);
          if (k1 === '$numberLong') { if (!num(w)) throw new Error(t('$numberLong 는 정수 문자열이어야 합니다', '$numberLong must be an integer string')); var bl = new Uint8Array(8); new DataView(bl.buffer).setBigInt64(0, BigInt(w), true); return cat([new Uint8Array([0x12]), k, bl]); }
          if (k1 === '$numberDouble') return cat([new Uint8Array([1]), k, f64(w === 'NaN' ? NaN : w === 'Infinity' ? Infinity : w === '-Infinity' ? -Infinity : parseFloat(w))]);
          if (k1 === '$numberDecimal') throw new Error(t('Decimal128 인코딩은 지원하지 않습니다', 'Decimal128 encoding is not supported'));
          if (k1 === '$timestamp') return cat([new Uint8Array([0x11]), k, i32(w.i), i32(w.t)]);
          if (k1 === '$minKey') return cat([new Uint8Array([0xff]), k]);
          if (k1 === '$maxKey') return cat([new Uint8Array([0x7f]), k]);
          if (k1 === '$undefined') return cat([new Uint8Array([6]), k]);
          if (k1 === '$symbol') return cat([new Uint8Array([0x0e]), k, str(w)]);
          if (k1 === '$code') return cat([new Uint8Array([0x0d]), k, str(w)]);
          if (k1 === '$regularExpression') return cat([new Uint8Array([0x0b]), k, cstr(w.pattern), cstr(String(w.options || '').split('').sort().join(''))]);
          if (k1 === '$binary') {
            var bd = w && typeof w === 'object' ? w : { base64: w, subType: x.$type || '00' };
            var raw = N.fromB64(bd.base64); return cat([new Uint8Array([5]), k, i32(raw.length), new Uint8Array([parseInt(bd.subType || '00', 16)]), raw]);
          }
        }
        return cat([new Uint8Array([3]), k, doc(x, false)]);
      }
      function doc(x) { var body = cat(Object.keys(x).map(function (kk) { return elem(kk, x[kk]); })); return cat([i32(body.length + 5), body, new Uint8Array([0])]); }
      var bytes = doc(val, false);
      issues.push(t('정수는 int32 범위면 int32, 아니면 안전한 정수 범위에서 int64, 그 밖은 double 로 인코딩합니다. 다른 타입은 $numberInt, $numberLong 같은 확장 JSON 표기를 쓰세요', 'Integers become int32 when they fit, int64 within the safe range, otherwise double; use Extended JSON ($numberInt, $numberLong …) to force a type'));
      return { _status: t('✅ ' + bytes.length + '바이트 BSON 문서로 인코딩했습니다', '✅ Encoded a ' + bytes.length + '-byte BSON document'), table: { head: [['형식', 'Format'], ['값', 'Value']], rows: [['hex', N.toHex(bytes, ' ')], ['Base64', N.toB64(bytes)], [t('길이', 'Length'), bytes.length + ' bytes']] }, out: N.hexdump(bytes, 512), issues: issues };
    }
    var inp = N.get(v, o), u8 = inp.bytes, rows = [], nodes = 0;
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var TYPES = { 1: 'double', 2: 'string', 3: 'document', 4: 'array', 5: 'binary', 6: 'undefined', 7: 'ObjectId', 8: 'bool', 9: 'datetime', 10: 'null', 11: 'regex', 12: 'DBPointer', 13: 'javascript', 14: 'symbol', 15: 'javascript+scope', 16: 'int32', 17: 'timestamp', 18: 'int64', 19: 'decimal128', 255: 'minKey', 127: 'maxKey' };
    function need(p, n) { if (p + n > u8.length) throw new Error(t('데이터가 ' + p + ' 바이트 근처에서 끝났습니다 (' + n + '바이트 더 필요)', 'Data ends near byte ' + p + ' (' + n + ' more bytes needed)')); }
    function cs(p) { var q = p; while (q < u8.length && u8[q] !== 0) q++; if (q >= u8.length) throw new Error(t('오프셋 ' + p + ': 문자열 종료(0x00)를 찾지 못했습니다', 'Offset ' + p + ': no NUL terminator for the string')); return { s: new TextDecoder().decode(u8.subarray(p, q)), end: q + 1 }; }
    function bstr(p) { need(p, 4); var n = dv.getInt32(p, true); if (n < 1) throw new Error(t('오프셋 ' + p + ': 문자열 길이가 올바르지 않습니다', 'Offset ' + p + ': invalid string length')); need(p + 4, n); if (u8[p + 3 + n] !== 0) issues.push(t('오프셋 ' + p + ' 의 문자열이 0x00 으로 끝나지 않습니다', 'The string at offset ' + p + ' is not NUL-terminated')); return { s: new TextDecoder().decode(u8.subarray(p + 4, p + 3 + n)), end: p + 4 + n }; }
    var iso = function (ms) { var d = new Date(ms); return isNaN(d) ? null : d.toISOString(); };
    function docp(p, path, depth, isArr) {
      need(p, 5); if (depth > 100) throw new Error(t('중첩이 너무 깊습니다', 'Nesting is too deep'));
      var size = dv.getInt32(p, true); if (size < 5) throw new Error(t('오프셋 ' + p + ': 문서 크기 ' + size + ' 가 올바르지 않습니다', 'Offset ' + p + ': invalid document size ' + size)); need(p, size);
      if (u8[p + size - 1] !== 0) throw new Error(t('오프셋 ' + p + ': 문서가 0x00 으로 끝나지 않습니다', 'Offset ' + p + ': the document does not end with 0x00'));
      var q = p + 4, end = p + size - 1, m = new Map(), arr = [];
      while (q < end) {
        var ty = u8[q], start = q; q++;
        var kk = cs(q); q = kk.end; var key = kk.s, val, shown, pth = path + (isArr ? '[' + key + ']' : '.' + key);
        if (++nodes > 200000) throw new Error(t('요소가 너무 많습니다', 'Too many elements'));
        var addRow = function (sv) { if (rows.length < 400) rows.push([String(start), '0x' + (ty < 16 ? '0' : '') + ty.toString(16), new Array(depth + 1).join('  ') + pth, TYPES[ty] || '?', sv]); };
        switch (ty) {
          case 1: need(q, 8); val = dv.getFloat64(q, true); q += 8; shown = String(val); addRow(shown);
            val = N.mark(val, { '$numberDouble': isFinite(val) ? (Number.isInteger(val) && !Object.is(val, -0) ? val.toFixed(1) : Object.is(val, -0) ? '-0.0' : String(val)) : (isNaN(val) ? 'NaN' : val > 0 ? 'Infinity' : '-Infinity') }, isFinite(val) ? val : { '$numberDouble': isNaN(val) ? 'NaN' : val > 0 ? 'Infinity' : '-Infinity' }); break;
          case 2: { var s = bstr(q); q = s.end; val = s.s; addRow(N.disp(val)); break; }
          case 3: addRow('document'); { var d = docp(q, pth, depth + 1, false); q = d.end; val = d.v; } break;
          case 4: addRow('array'); { var a = docp(q, pth, depth + 1, true); q = a.end; val = a.v; } break;
          case 5: { need(q, 5); var bl = dv.getInt32(q, true), st = u8[q + 4]; if (bl < 0) throw new Error(t('오프셋 ' + q + ': 이진 길이가 올바르지 않습니다', 'Offset ' + q + ': invalid binary length')); need(q + 5, bl); var bin = u8.slice(q + 5, q + 5 + bl); q += 5 + bl;
            if (st === 4 && bl === 16) { var hx = N.toHex(bin); var uu = hx.slice(0, 8) + '-' + hx.slice(8, 12) + '-' + hx.slice(12, 16) + '-' + hx.slice(16, 20) + '-' + hx.slice(20); shown = 'UUID ' + uu; val = N.mark({ '$uuid': uu }, { '$binary': { base64: N.toB64(bin), subType: '04' } }); }
            else { shown = 'binary(subtype ' + st + ', ' + bl + ' B) ' + N.short(N.toHex(bin), 32); val = N.mark({ '$binary': N.toB64(bin), '$subType': ('0' + st.toString(16)).slice(-2) }, { '$binary': { base64: N.toB64(bin), subType: ('0' + st.toString(16)).slice(-2) } }); }
            addRow(shown); break; }
          case 6: val = N.mark({ '$undefined': true }); addRow('undefined'); issues.push(t('undefined(0x06) 타입은 폐기(deprecated)되었습니다', 'The undefined type (0x06) is deprecated')); break;
          case 7: need(q, 12); var oh = N.toHex(u8.subarray(q, q + 12)); q += 12; val = N.mark(oh, { '$oid': oh }); addRow(oh); break;
          case 8: need(q, 1); val = u8[q] === 1; if (u8[q] > 1) issues.push(t('불리언 값이 0/1 이 아닙니다 (오프셋 ' + q + ')', 'Boolean is neither 0 nor 1 (offset ' + q + ')')); q += 1; addRow(String(val)); break;
          case 9: { need(q, 8); var ms = dv.getBigInt64(q, true); q += 8; var msn = Number(ms), is = iso(msn); shown = (is || String(ms)) + ' (' + ms + ' ms)'; addRow(shown); var canon = { '$date': { '$numberLong': ms.toString() } }; var relax = is && msn >= 0 && msn < 253402300800000 ? { '$date': is } : canon; val = N.mark(is || String(ms), canon, relax); break; }
          case 10: val = null; addRow('null'); break;
          case 11: { var pt = cs(q); var op = cs(pt.end); q = op.end; val = N.mark('/' + pt.s + '/' + op.s, { '$regularExpression': { pattern: pt.s, options: op.s } }); addRow('/' + pt.s + '/' + op.s); break; }
          case 12: { var dbs = bstr(q); q = dbs.end; need(q, 12); q += 12; val = N.mark({ '$dbPointer': dbs.s }); addRow('DBPointer ' + dbs.s); issues.push(t('DBPointer(0x0c) 타입은 폐기되었습니다', 'DBPointer (0x0c) is deprecated')); break; }
          case 13: { var js = bstr(q); q = js.end; val = N.mark({ '$code': js.s }); addRow(N.disp(js.s)); break; }
          case 14: { var sy = bstr(q); q = sy.end; val = N.mark({ '$symbol': sy.s }); addRow(N.disp(sy.s)); issues.push(t('Symbol(0x0e) 타입은 폐기되었습니다', 'Symbol (0x0e) is deprecated')); break; }
          case 15: { need(q, 4); var jc = bstr(q + 4); q = jc.end; var sc = docp(q, pth, depth + 1, false); q = sc.end; val = N.mark({ '$code': jc.s, '$scope': sc.v }); addRow('code with scope'); break; }
          case 16: need(q, 4); val = dv.getInt32(q, true); q += 4; addRow(String(val)); val = N.mark(val, { '$numberInt': String(val) }, val); break;
          case 17: { need(q, 8); var ti = dv.getUint32(q, true), tt = dv.getUint32(q + 4, true); q += 8; val = N.mark({ t: tt, i: ti }, { '$timestamp': { t: tt, i: ti } }); addRow('Timestamp(' + tt + ', ' + ti + ')'); break; }
          case 18: { need(q, 8); var l = dv.getBigInt64(q, true); q += 8; addRow(l.toString()); var asNum = l >= -9007199254740991n && l <= 9007199254740991n ? Number(l) : l; val = N.mark(asNum, { '$numberLong': l.toString() }, asNum); break; }
          case 19: { need(q, 16); var dd = dec128(u8.subarray(q, q + 16)); q += 16; addRow(dd); val = N.mark(dd, { '$numberDecimal': dd }); break; }
          case 255: val = N.mark({ '$minKey': 1 }); addRow('MinKey'); break;
          case 127: val = N.mark({ '$maxKey': 1 }); addRow('MaxKey'); break;
          default: throw new Error(t('오프셋 ' + start + ': 알 수 없는 요소 타입 0x' + ty.toString(16), 'Offset ' + start + ': unknown element type 0x' + ty.toString(16)));
        }
        if (isArr) arr.push(val); else { if (m.has(key)) issues.push(t('중복된 키 "' + key + '" (문서 내 오프셋 ' + start + ')', 'Duplicate key "' + key + '" (offset ' + start + ')')); m.set(key, val); }
      }
      if (q !== end) throw new Error(t('오프셋 ' + p + ': 문서 크기와 요소 길이가 맞지 않습니다', 'Offset ' + p + ': document size does not match its elements'));
      return { v: isArr ? arr : m, end: p + size };
    }
    var docs = [], pos = 0;
    while (pos < u8.length) { if (u8.length - pos < 5) throw new Error(t('오프셋 ' + pos + ' 뒤에 문서가 되기엔 데이터가 부족합니다', 'Not enough data for a document after offset ' + pos)); var r = docp(pos, docs.length ? '$' + docs.length : '$', 0, false); docs.push(r.v); pos = r.end; if (docs.length > 5000) { issues.push(t('문서는 처음 5000개만 해석합니다', 'Only the first 5000 documents are decoded')); break; } }
    if (docs.length > 1) issues.push(t('문서 ' + docs.length + '개가 이어진 파일(mongodump)이라 JSON 배열로 출력합니다', docs.length + ' concatenated documents (mongodump style) are output as a JSON array'));
    if (rows.length >= 400) issues.push(t('표는 처음 400개 요소만 보여 줍니다', 'The table shows only the first 400 elements'));
    if (o.ej === 'plain') issues.push(t('단순 JSON 에서는 ObjectId·날짜·Int64 같은 타입 구분이 사라집니다', 'Plain JSON loses the distinction of ObjectId, date, Int64 and similar types'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: t('✅ 해석 완료 — ' + u8.length + '바이트, 문서 ' + docs.length + '개, 요소 ' + nodes + '개', '✅ Decoded — ' + u8.length + ' bytes, ' + docs.length + ' document(s), ' + nodes + ' elements'), table: { head: [['오프셋', 'Offset'], ['타입 바이트', 'Type byte'], ['경로', 'Path'], ['타입', 'Type'], ['값', 'Value']], rows: rows }, out: N.toJson(docs.length === 1 ? docs[0] : docs, o.ej, 2), issues: uniq };
  }
});
