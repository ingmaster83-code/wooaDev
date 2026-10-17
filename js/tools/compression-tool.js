TK.tool('compression-tool', {
  inputs: [
    { id: 'in', label: ['입력 (압축: 텍스트 / 해제·분석: Base64 또는 16진수)', 'Input (compress: text / decompress & inspect: Base64 or hex)'], rows: 8, sample: 'WooaDev compression sample. '.repeat(12).trim(), show: function (o) { return o.mode !== 'file'; } },
    { id: 'file', type: 'file', buffer: true, label: ['파일 선택 (서버로 전송되지 않습니다)', 'Choose a file (never uploaded)'], show: function (o) { return o.mode === 'file'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['입력 방식', 'Input'], choices: [['text', ['텍스트 붙여 넣기', 'Paste text']], ['file', ['파일 선택', 'Choose a file']]], default: 'text' },
    { id: 'op', type: 'select', label: ['작업', 'Operation'], choices: [['compress', ['압축', 'Compress']], ['decompress', ['압축 해제', 'Decompress']], ['inspect', ['헤더 분석', 'Inspect header']], ['compare', ['형식별 크기 비교', 'Compare sizes']]], default: 'compare' },
    { id: 'algo', type: 'select', label: ['형식', 'Format'], choices: [['gzip', 'gzip'], ['deflate', ['deflate (zlib)', 'deflate (zlib)']], ['deflate-raw', 'deflate-raw']], default: 'gzip', show: function (o) { return o.op === 'compress' || o.op === 'decompress'; } },
    { id: 'fmt', type: 'select', label: ['바이너리 표기 (압축 입력·결과)', 'Binary notation (compress output)'], choices: [['b64', 'Base64'], ['hex', ['16진수', 'Hex']]], default: 'b64', show: function (o) { return o.op !== 'inspect' && o.op !== 'compare'; } },
    { id: 'binin', type: 'checkbox', label: ['입력이 텍스트가 아니라 Base64/16진수 바이너리', 'Input is Base64 / hex binary, not text'], default: false, show: function (o) { return o.op === 'compress' && o.mode !== 'file'; } }
  ],
  sampleOptions: { op: 'compare' },
  outputs: [{ id: 'info', label: ['결과 요약', 'Summary'], kind: 'kv' }, { id: 'table', label: ['형식별 크기', 'Size by format'], kind: 'table' }, { id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [];
    if (typeof CompressionStream !== 'function' || typeof DecompressionStream !== 'function') throw new Error(t('이 브라우저는 CompressionStream 을 지원하지 않습니다 (최신 Chrome·Edge·Safari·Firefox 필요)', 'This browser does not support CompressionStream (a current Chrome, Edge, Safari or Firefox is required)'));
    var CRC = (function () { var tb = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } return tb; })();
    function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
    function adler32(u8) { var a = 1, b = 0; for (var i = 0; i < u8.length; i++) { a = (a + u8[i]) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }
    function hex32(n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); }
    function concat(chunks) { var n = 0; chunks.forEach(function (c) { n += c.length; }); var out = new Uint8Array(n), p = 0; chunks.forEach(function (c) { out.set(c, p); p += c.length; }); return out; }
    function pipe(bytes, stream) {
      var w = stream.writable.getWriter(); w.write(bytes).catch(function () {}); w.close().catch(function () {});
      var r = stream.readable.getReader(), chunks = [];
      return (function pump() { return r.read().then(function (x) { if (x.done) return concat(chunks); chunks.push(x.value); return pump(); }); })();
    }
    /* 입력 바이트 */
    var bytes, raw = o.mode === 'file';
    if (raw) { var f = v.file; if (!f || !f.buf) throw new Error(t('파일을 선택하세요', 'Choose a file')); bytes = new Uint8Array(f.buf); }
    else {
      var s = String(v['in'] || ''); if (!s.trim()) throw new Error(t('입력하세요', 'Enter some input'));
      if (o.op === 'compress' || o.op === 'compare') bytes = o.op === 'compress' && o.binin ? N.get({ in: s }, { mode: 'text', fmt: 'auto' }).bytes : new TextEncoder().encode(s);
      else bytes = N.get({ in: s }, { mode: 'text', fmt: o.fmt === 'hex' ? 'hex' : 'auto' }).bytes;
    }
    function show(u8) { return o.fmt === 'hex' ? N.toHex(u8, '') : N.toB64(u8); }
    function ratio(a, b) { return a ? (b / a * 100).toFixed(1) + '%' : '—'; }
    function detect(u8) {
      if (u8.length >= 3 && u8[0] === 0x1f && u8[1] === 0x8b && u8[2] === 8) return 'gzip';
      if (u8.length >= 2 && (u8[0] & 0x0f) === 8 && ((u8[0] << 8) | u8[1]) % 31 === 0) return 'deflate';
      return 'deflate-raw';
    }
    function parseGzip(u8) {
      if (u8.length < 18 || u8[0] !== 0x1f || u8[1] !== 0x8b) throw new Error(t('gzip 헤더(1f 8b)가 아닙니다', 'Not a gzip header (1f 8b)'));
      var flg = u8[3], p = 10, rows = [], mt = (u8[4] | (u8[5] << 8) | (u8[6] << 16) | (u8[7] << 24)) >>> 0;
      var OS = { 0: 'FAT', 1: 'Amiga', 2: 'VMS', 3: 'Unix', 4: 'VM/CMS', 5: 'Atari TOS', 6: 'HPFS', 7: 'Macintosh', 8: 'Z-System', 9: 'CP/M', 10: 'TOPS-20', 11: 'NTFS', 12: 'QDOS', 13: 'Acorn RISCOS', 255: 'unknown' };
      rows.push([['압축 방식', 'Method'], u8[2] === 8 ? 'deflate (8)' : String(u8[2])]);
      rows.push([['플래그', 'Flags'], '0x' + flg.toString(16) + [(flg & 1) ? ' FTEXT' : '', (flg & 2) ? ' FHCRC' : '', (flg & 4) ? ' FEXTRA' : '', (flg & 8) ? ' FNAME' : '', (flg & 16) ? ' FCOMMENT' : ''].join('')]);
      rows.push([['수정 시각', 'Modified'], mt ? new Date(mt * 1000).toISOString() : t('없음 (0)', 'none (0)')]);
      rows.push([['추가 플래그 (XFL)', 'Extra flags (XFL)'], u8[8] === 2 ? 'max compression (2)' : u8[8] === 4 ? 'fastest (4)' : String(u8[8])]);
      rows.push([['운영체제', 'OS'], (OS[u8[9]] || '?') + ' (' + u8[9] + ')']);
      if (flg & 4) { var xl = u8[p] | (u8[p + 1] << 8); p += 2 + xl; }
      var nm = ''; if (flg & 8) { var e = p; while (e < u8.length && u8[e]) e++; nm = new TextDecoder().decode(u8.subarray(p, e)); p = e + 1; rows.push([['원본 파일 이름', 'Original name'], nm]); }
      if (flg & 16) { var e2 = p; while (e2 < u8.length && u8[e2]) e2++; rows.push([['주석', 'Comment'], new TextDecoder().decode(u8.subarray(p, e2))]); p = e2 + 1; }
      if (flg & 2) p += 2;
      var tl = u8.length, crc = (u8[tl - 8] | (u8[tl - 7] << 8) | (u8[tl - 6] << 16) | (u8[tl - 5] << 24)) >>> 0, isz = (u8[tl - 4] | (u8[tl - 3] << 8) | (u8[tl - 2] << 16) | (u8[tl - 1] << 24)) >>> 0;
      rows.push([['헤더 크기', 'Header size'], p + ' B']); rows.push([['압축 데이터', 'Compressed data'], (tl - 8 - p) + ' B']);
      rows.push([['CRC-32 (트레일러)', 'CRC-32 (trailer)'], hex32(crc)]); rows.push([['원본 크기 (ISIZE, mod 2³²)', 'Uncompressed size (ISIZE, mod 2^32)'], String(isz)]);
      return { rows: rows, crc: crc, isize: isz };
    }
    function parseZlib(u8) {
      var cmf = u8[0], flg = u8[1], rows = [];
      if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0) throw new Error(t('zlib 헤더가 아닙니다 (CMF/FLG 검사 실패)', 'Not a zlib header (CMF/FLG check failed)'));
      var lv = (flg >> 6) & 3, win = 1 << ((cmf >> 4) + 8);
      rows.push([['헤더', 'Header'], '0x' + ('00' + cmf.toString(16)).slice(-2) + ('00' + flg.toString(16)).slice(-2)]);
      rows.push([['윈도 크기', 'Window size'], win + ' B']);
      rows.push([['압축 수준 힌트', 'Level hint'], [t('가장 빠름', 'fastest'), t('빠름', 'fast'), t('기본', 'default'), t('최대 압축', 'maximum')][lv]]);
      rows.push([['사전(FDICT)', 'Preset dictionary'], (flg & 32) ? t('있음 (지원하지 않음)', 'yes (unsupported)') : t('없음', 'no')]);
      var ad = (u8[u8.length - 4] * 16777216) + (u8[u8.length - 3] << 16) + (u8[u8.length - 2] << 8) + u8[u8.length - 1];
      rows.push([['Adler-32 (트레일러)', 'Adler-32 (trailer)'], hex32(ad)]);
      return { rows: rows, adler: ad >>> 0 };
    }
    var kinds = ['gzip', 'deflate', 'deflate-raw'];
    if (o.op === 'compare') {
      return Promise.all(kinds.map(function (a) { return pipe(bytes, new CompressionStream(a)); })).then(function (res) {
        var rows = res.map(function (r, i) { return [kinds[i], String(r.length), ratio(bytes.length, r.length), r.length < bytes.length ? '−' + (bytes.length - r.length) + ' B' : '+' + (r.length - bytes.length) + ' B']; });
        var best = res.reduce(function (b, r, i) { return r.length < res[b].length ? i : b; }, 0);
        if (bytes.length < 100) issues.push(t('입력이 매우 작으면 헤더 때문에 오히려 커질 수 있습니다 (gzip 18 B, zlib 6 B 고정 오버헤드)', 'Very small inputs can grow because of fixed headers (gzip 18 B, zlib 6 B)'));
        issues.push(t('브라우저 CompressionStream 은 압축 수준을 고를 수 없어 기본값으로 압축합니다. gzip 이 가장 널리 쓰이고 deflate-raw 가 가장 작습니다', 'The browser CompressionStream cannot select a level and uses the default. gzip is the most widely used and deflate-raw is the smallest'));
        return { _status: t('✅ 원본 ' + bytes.length + ' B → 가장 작은 형식 ' + kinds[best] + ' ' + res[best].length + ' B (' + ratio(bytes.length, res[best].length) + ')', '✅ Original ' + bytes.length + ' B → smallest: ' + kinds[best] + ' ' + res[best].length + ' B (' + ratio(bytes.length, res[best].length) + ')'), info: [[['원본 크기', 'Original size'], bytes.length + ' B']], table: { head: [['형식', 'Format'], ['크기(B)', 'Size (B)'], ['원본 대비', 'vs original'], ['증감', 'Delta']], rows: rows }, issues: issues };
      });
    }
    if (o.op === 'compress') {
      return pipe(bytes, new CompressionStream(o.algo)).then(function (out) {
        return { _status: t('✅ ' + o.algo + ' 압축: ' + bytes.length + ' B → ' + out.length + ' B (' + ratio(bytes.length, out.length) + ')', '✅ ' + o.algo + ': ' + bytes.length + ' B → ' + out.length + ' B (' + ratio(bytes.length, out.length) + ')'), info: [[['원본', 'Original'], bytes.length + ' B'], [['압축 후', 'Compressed'], out.length + ' B'], [['비율', 'Ratio'], ratio(bytes.length, out.length)], [['원본 CRC-32', 'Original CRC-32'], hex32(crc32(bytes))], [['표기', 'Notation'], o.fmt === 'hex' ? 'hex' : 'Base64']], out: show(out), issues: issues };
      });
    }
    if (o.op === 'inspect') {
      var kind = detect(bytes), rows2;
      if (kind === 'deflate-raw') return { _status: t('⚠️ gzip·zlib 헤더가 아닙니다 (raw deflate 일 수 있음)', '⚠️ Not a gzip or zlib header (maybe raw deflate)'), info: [[['처음 16바이트', 'First 16 bytes'], N.toHex(bytes.subarray(0, 16), ' ')], [['크기', 'Size'], bytes.length + ' B']], issues: [t('raw deflate 는 헤더가 없어 분석할 정보가 없습니다. "압축 해제"에서 deflate-raw 로 시도하세요', 'Raw deflate has no header to inspect; try Decompress with deflate-raw')] };
      var pr = kind === 'gzip' ? parseGzip(bytes) : parseZlib(bytes);
      return pipe(bytes, new DecompressionStream(kind)).then(function (plain) {
        var okc = kind === 'gzip' ? (crc32(plain) === pr.crc && (plain.length >>> 0) === pr.isize) : (adler32(plain) === pr.adler);
        pr.rows.push([['해제 후 크기', 'Decompressed size'], plain.length + ' B']);
        pr.rows.push([['무결성 검사', 'Integrity'], okc ? t('✅ 트레일러와 일치', '✅ matches trailer') : t('⛔ 트레일러와 불일치', '⛔ trailer mismatch')]);
        return { _status: t('✅ ' + kind + ' 헤더 분석 — 해제 후 ' + plain.length + ' B', '✅ ' + kind + ' header — ' + plain.length + ' B when decompressed'), info: pr.rows, issues: issues };
      }, function (e) { return { _status: t('⚠️ 헤더는 해석했지만 압축 데이터가 손상되었습니다', '⚠️ Header parsed but the compressed data is corrupt'), info: pr.rows, issues: [e.message || String(e)] }; });
    }
    /* decompress */
    var algo = detect(bytes), chosen = o.algo;
    if (algo !== 'deflate-raw' && algo !== chosen) issues.push(t('입력이 ' + algo + ' 형식으로 보여 ' + algo + ' 로 해제했습니다 (선택: ' + chosen + ')', 'The input looks like ' + algo + ', so it was decompressed as ' + algo + ' (selected: ' + chosen + ')'));
    var use = algo !== 'deflate-raw' ? algo : chosen;
    return pipe(bytes, new DecompressionStream(use)).then(function (plain) {
      var text = null; try { text = new TextDecoder('utf-8', { fatal: true }).decode(plain); } catch (e) { text = null; }
      if (text !== null && /[\u0000-\u0008\u000e-\u001f]/.test(text)) text = null;
      if (text === null) issues.push(t('텍스트가 아닌 바이너리라서 Base64/16진수로 표시합니다', 'The result is binary, so it is shown as Base64 / hex'));
      return { _status: t('✅ ' + use + ' 해제: ' + bytes.length + ' B → ' + plain.length + ' B', '✅ ' + use + ' decompressed: ' + bytes.length + ' B → ' + plain.length + ' B'), info: [[['압축 데이터', 'Compressed'], bytes.length + ' B'], [['해제 후', 'Decompressed'], plain.length + ' B'], [['CRC-32', 'CRC-32'], hex32(crc32(plain))], [['형식', 'Type'], text !== null ? t('UTF-8 텍스트', 'UTF-8 text') : t('바이너리', 'binary')]], out: text !== null ? text : show(plain), issues: issues };
    }, function (e) { throw new Error(t('압축 해제에 실패했습니다: ', 'Decompression failed: ') + (e && e.message ? e.message : String(e)) + t(' — 형식(gzip/deflate/deflate-raw)을 바꿔 보세요', ' - try another format (gzip / deflate / deflate-raw)')); });
  }
});
