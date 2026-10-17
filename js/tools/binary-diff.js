TK.tool('binary-diff', {
  inputs: [
    { id: 'a', label: ['A (16진수 / Base64)', 'A (hex / Base64)'], rows: 5, sample: '7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00 03 00 3e 00 01 00 00 00 40 10 00 00 00 00 00 00 48 65 6c 6c 6f 2c 20 57 6f 6f 61 21 00 00 00 00', show: function (o) { return o.mode !== 'file'; } },
    { id: 'b', label: ['B (16진수 / Base64)', 'B (hex / Base64)'], rows: 5, sample: '7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00 03 00 b7 00 01 00 00 00 40 10 00 00 00 00 00 00 48 65 6c 6c 6f 2c 20 57 6f 72 6c 64 21 00 00 00 00 de ad', show: function (o) { return o.mode !== 'file'; } },
    { id: 'fa', type: 'file', buffer: true, label: ['파일 A (서버로 전송되지 않습니다)', 'File A (never uploaded)'], show: function (o) { return o.mode === 'file'; } },
    { id: 'fb', type: 'file', buffer: true, label: ['파일 B', 'File B'], show: function (o) { return o.mode === 'file'; } }
  ],
  options: [
    TK.binin.modeOption(), TK.binin.fmtOption(),
    { id: 'gap', type: 'number', label: ['가까운 차이 합치기 (바이트 간격 이하)', 'Merge differences closer than (bytes)'], default: 4, min: 0, max: 4096 },
    { id: 'ctx', type: 'number', label: ['앞뒤 컨텍스트 (바이트, 16 단위로 올림)', 'Context bytes around each change (rounded to 16)'], default: 16, min: 0, max: 256 },
    { id: 'max', type: 'number', label: ['표시할 최대 차이 구간', 'Maximum difference ranges'], default: 50, min: 1, max: 1000 }
  ],
  outputs: [{ id: 'info', label: ['요약', 'Summary'], kind: 'kv' }, { id: 'table', label: ['차이 구간', 'Difference ranges'], kind: 'table' }, { id: 'diff', label: ['16진수 비교 (− A / + B)', 'Hex view (− A / + B)'], kind: 'diff' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [], A, B;
    if (o.mode === 'file') {
      if (!v.fa || !v.fa.buf || !v.fb || !v.fb.buf) throw new Error(t('파일 A 와 B 를 모두 선택하세요', 'Choose both file A and file B'));
      A = new Uint8Array(v.fa.buf); B = new Uint8Array(v.fb.buf);
    } else {
      if (!String(v.a || '').trim() || !String(v.b || '').trim()) throw new Error(t('A 와 B 를 모두 입력하세요', 'Enter both A and B'));
      A = N.get({ in: v.a }, { mode: 'text', fmt: o.fmt }).bytes; B = N.get({ in: v.b }, { mode: 'text', fmt: o.fmt }).bytes;
    }
    var n = Math.min(A.length, B.length), gap = Math.max(0, Number(o.gap) || 0), ctx = Math.ceil((Number(o.ctx) || 0) / 16) * 16, maxR = Number(o.max) || 50;
    var ranges = [], cur = null, diffBytes = 0;
    for (var i = 0; i < n; i++) {
      if (A[i] !== B[i]) { diffBytes++; if (cur && i - cur.end <= gap) cur.end = i + 1; else { cur = { start: i, end: i + 1 }; ranges.push(cur); } }
    }
    var tail = Math.abs(A.length - B.length);
    function h(u8, s, e, lim) { var x = u8.subarray(s, Math.min(e, s + (lim || 12))); return N.toHex(x, ' ') + (e - s > (lim || 12) ? ' …' : ''); }
    function hx(x) { return '0x' + x.toString(16); }
    function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) { c ^= u8[i]; for (var k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; } return ('00000000' + ((c ^ 0xFFFFFFFF) >>> 0).toString(16)).slice(-8); }
    var identical = !ranges.length && !tail;
    var rows = ranges.slice(0, maxR).map(function (r) { return [hx(r.start) + ' – ' + hx(r.end - 1), String(r.end - r.start), h(A, r.start, r.end), h(B, r.start, r.end)]; });
    if (tail) rows.push([hx(n) + ' – ' + hx(Math.max(A.length, B.length) - 1), String(tail), A.length > B.length ? h(A, n, A.length) : t('(없음)', '(none)'), B.length > A.length ? h(B, n, B.length) : t('(없음)', '(none)')]);
    if (ranges.length > maxR) issues.push(t('차이 구간 ' + ranges.length + '개 중 ' + maxR + '개만 표시합니다', 'Showing ' + maxR + ' of ' + ranges.length + ' difference ranges'));
    /* 16진수 비교: 차이 구간 주변 16바이트 줄만 */
    var lines = [], shown = {}, order = [];
    function addLine(off) { if (shown[off] === undefined && off < Math.max(A.length, B.length)) { shown[off] = true; order.push(off); } }
    ranges.slice(0, maxR).forEach(function (r) { for (var o2 = Math.floor((r.start - ctx) / 16) * 16; o2 <= Math.floor((r.end - 1 + ctx) / 16) * 16; o2 += 16) if (o2 >= 0) addLine(o2); });
    if (tail) for (var to = Math.floor(n / 16) * 16; to <= Math.floor((Math.max(A.length, B.length) - 1) / 16) * 16 && order.length < 400; to += 16) addLine(to);
    order.sort(function (x, y) { return x - y; });
    function line(u8, off, other) {
      var s = '', asc = '';
      for (var k = 0; k < 16; k++) { var p = off + k; if (p < u8.length) { var by = u8[p], d = p >= other.length || other[p] !== by; s += (by < 16 ? '0' : '') + by.toString(16) + (d ? '*' : ' '); asc += by >= 32 && by < 127 ? String.fromCharCode(by) : '.'; } else { s += '   '; } if (k === 7) s += ' '; }
      return ('0000000' + off.toString(16)).slice(-8) + '  ' + s + ' |' + asc + '|';
    }
    var prev = -1;
    order.slice(0, 400).forEach(function (off) {
      if (prev >= 0 && off - prev > 16) lines.push([' ', '   ⋮ ' + ((off - prev - 16)) + t(' 바이트 같음', ' bytes identical')]);
      var la = off < A.length ? line(A, off, B) : null, lb = off < B.length ? line(B, off, A) : null;
      var same = off + 16 <= A.length && off + 16 <= B.length; for (var k = 0; same && k < 16; k++) if (A[off + k] !== B[off + k]) same = false;
      if (same) { lines.push([' ', la]); prev = off; return; }
      if (la) lines.push(['-', la]); if (lb) lines.push(['+', lb]);
      prev = off;
    });
    if (order.length > 400) issues.push(t('16진수 비교는 처음 400줄만 표시합니다', 'The hex view shows the first 400 lines only'));
    var info = [[['A 크기', 'Size of A'], A.length + ' B (CRC-32 ' + crc32(A) + ')'], [['B 크기', 'Size of B'], B.length + ' B (CRC-32 ' + crc32(B) + ')'], [['다른 바이트', 'Differing bytes'], identical ? '0' : diffBytes + (n ? ' / ' + n + ' (' + (diffBytes / n * 100).toFixed(2) + '%)' : '')], [['차이 구간', 'Difference ranges'], String(ranges.length + (tail ? 1 : 0))], [['첫 차이 위치', 'First difference'], identical ? '—' : hx(ranges.length ? ranges[0].start : n)]];
    if (tail) { info.push([['길이 차이', 'Length difference'], (A.length > B.length ? 'A' : 'B') + t('가 ', ' is longer by ') + tail + t(' 바이트 더 김', ' B')]); issues.push(t('두 데이터의 길이가 달라 ' + hx(n) + ' 이후는 한쪽에만 있습니다', 'The lengths differ, so data after ' + hx(n) + ' exists in only one side')); }
    if (!identical && ranges.length && diffBytes > n * 0.5) issues.push(t('절반 이상의 바이트가 달라 서로 다른 파일일 가능성이 높습니다', 'More than half of the bytes differ; these are probably unrelated files'));
    if (!identical && ranges.length === 1 && ranges[0].end - ranges[0].start <= 4) issues.push(t('한 곳만 달라졌습니다. 체크섬·타임스탬프·버전 번호 같은 값일 수 있습니다', 'Only one spot changed; it may be a checksum, timestamp or version number'));
    return { _status: identical ? { ok: true, msg: t('✅ 두 데이터가 완전히 같습니다 (' + A.length + ' B)', '✅ The two inputs are identical (' + A.length + ' B)') } : { ok: 'info', msg: t('차이 ' + diffBytes + '바이트, ' + (ranges.length + (tail ? 1 : 0)) + '개 구간', diffBytes + ' differing byte(s) in ' + (ranges.length + (tail ? 1 : 0)) + ' range(s)') }, info: info, table: { head: [['오프셋 구간', 'Offset range'], ['길이', 'Length'], ['A', 'A'], ['B', 'B']], rows: rows, empty: ['차이가 없습니다', 'No differences'] }, diff: lines, issues: issues };
  }
});
