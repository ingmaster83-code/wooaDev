TK.tool('sqlite-viewer', {
  inputs: TK.binin.inputs('in', ['SQLite 파일 (Base64 또는 16진수) — 또는 아래에서 파일 선택', 'SQLite file (Base64 or hex) — or choose a file below'], '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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgMFAAEbAQJNb25pdG9yBwoCBQAJFwlNb3VzZQ4BBQAJHQFLZXlib2FyZAIKAAAAAwHxAAH8AfcB8QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUDAQECAwQDCQECAwMJCQ0B+AAFABkAAUgBzQC4AGYAGQAAAAAAAABLBQYVFxcIe3ZpZXd2X2JpZ3ZfYmlnQ1JFQVRFIFZJRVcgdl9iaWcgQVMgU0VMRUNUICogRlJPTSBvcmRlcnMgV0hFUkUgcXR5ID4gNVAEBhcrGQFraW5kZXhpZHhfb3JkZXJzX3VzZXJvcmRlcnMFQ1JFQVRFIElOREVYIGlkeF9vcmRlcnNfdXNlciBPTiBvcmRlcnModXNlcl9pZCmBDQMHFxkZAYF1dGFibGVvcmRlcnNvcmRlcnMEQ1JFQVRFIFRBQkxFIG9yZGVycyAoaWQgSU5URUdFUiBQUklNQVJZIEtFWSwgdXNlcl9pZCBJTlRFR0VSIFJFRkVSRU5DRVMgdXNlcnMoaWQpLCBpdGVtIFRFWFQsIHF0eSBJTlRFR0VSIERFRkFVTFQgMSmBAgEHFxcXAYFjdGFibGV1c2Vyc3VzZXJzAkNSRUFURSBUQUJMRSB1c2VycyAoaWQgSU5URUdFUiBQUklNQVJZIEtFWSwgbmFtZSBURVhUIE5PVCBOVUxMLCBlbWFpbCBURVhUIFVOSVFVRSwgc2NvcmUgUkVBTCwgYXZhdGFyIEJMT0IpKQIGFz0XAQBpbmRleHNxbGl0ZV9hdXRvaW5kZXhfdXNlcnNfMXVzZXJzAwAAAAgAAAAA', 8),
  options: [
    TK.binin.modeOption(), TK.binin.fmtOption(),
    { id: 'table', type: 'text', label: ['볼 테이블 (비우면 첫 번째 테이블)', 'Table to browse (empty = first table)'], default: '' },
    { id: 'limit', type: 'number', label: ['표시할 행 수', 'Rows to show'], default: 50, min: 1, max: 2000 },
    { id: 'skip', type: 'number', label: ['건너뛸 행 수', 'Rows to skip'], default: 0, min: 0, max: 10000000 },
    { id: 'find', type: 'text', label: ['값 검색 (포함, 선택)', 'Search in values (contains, optional)'], default: '' }
  ],
  outputs: [{ id: 'info', label: ['파일 정보', 'File info'], kind: 'kv' }, { id: 'objs', label: ['스키마 개체 (sqlite_master)', 'Schema objects (sqlite_master)'], kind: 'table' }, { id: 'rows', label: ['테이블 행', 'Table rows'], kind: 'table' }, { id: 'sql', label: ['스키마 SQL', 'Schema SQL'], kind: 'code', ext: 'sql' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, g = N.get(v, o), b = g.bytes, issues = [];
    if (b.length < 100 || String.fromCharCode.apply(null, b.subarray(0, 15)) !== 'SQLite format 3') throw new Error(t('SQLite 3 파일이 아닙니다 (처음 16바이트가 "SQLite format 3\\0" 이어야 합니다)', 'Not a SQLite 3 file (the first 16 bytes must be "SQLite format 3\\0")'));
    function u16(p) { return (b[p] << 8) | b[p + 1]; }
    function u32(p) { return ((b[p] * 16777216) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3]); }
    var pageSize = u16(16); if (pageSize === 1) pageSize = 65536;
    if (pageSize < 512 || (pageSize & (pageSize - 1))) throw new Error(t('페이지 크기가 올바르지 않습니다: ' + pageSize, 'Invalid page size: ' + pageSize));
    var reserved = b[20], hdrPages = u32(28), enc = u32(56), encName = { 1: 'UTF-8', 2: 'UTF-16le', 3: 'UTF-16be' }[enc];
    var realPages = Math.floor(b.length / pageSize);
    if (!encName) throw new Error(t('텍스트 인코딩 값이 올바르지 않습니다: ' + enc, 'Invalid text encoding value: ' + enc));
    var nPages = hdrPages && u32(92) === u32(24) ? hdrPages : realPages;
    if (nPages > realPages) { issues.push(t('헤더의 페이지 수(' + nPages + ')가 실제 파일(' + realPages + '페이지)보다 큽니다 — 파일이 잘렸을 수 있습니다', 'The header page count (' + nPages + ') exceeds the file size (' + realPages + ' pages); the file may be truncated')); nPages = realPages; }
    var U = pageSize - reserved, td = new TextDecoder('utf-8');
    function decodeText(a) {
      if (enc === 1) return td.decode(a);
      var s = ''; for (var i = 0; i + 1 < a.length; i += 2) s += String.fromCharCode(enc === 2 ? a[i] | (a[i + 1] << 8) : (a[i] << 8) | a[i + 1]); return s;
    }
    function varint(p) { var r = 0n, i; for (i = 0; i < 8; i++) { r = (r << 7n) | BigInt(b[p + i] & 0x7f); if (!(b[p + i] & 0x80)) return { v: r, n: i + 1 }; } r = (r << 8n) | BigInt(b[p + 8]); return { v: r, n: 9 }; }
    function vi(p) { var r = varint(p); return { v: Number(r.v), n: r.n }; }
    function pageOff(n) { if (n < 1 || n > nPages) throw new Error(t('페이지 번호가 범위를 벗어났습니다: ' + n, 'Page number out of range: ' + n)); return (n - 1) * pageSize; }
    /* 오버플로 포함 페이로드 읽기 */
    function payload(cellP, P, isTable, pageEnd) {
      var X = isTable ? U - 35 : Math.floor((U - 12) * 64 / 255) - 23, M = Math.floor((U - 12) * 32 / 255) - 23;
      if (P <= X) return b.subarray(cellP, cellP + P);
      var K = M + ((P - M) % (U - 4)), local = K <= X ? K : M, out = new Uint8Array(P); out.set(b.subarray(cellP, cellP + local), 0);
      var got = local, ov = u32(cellP + local), guard = 0;
      while (got < P && ov) { if (++guard > 100000) throw new Error(t('오버플로 체인이 비정상입니다', 'Overflow chain is abnormal')); var po = pageOff(ov), take = Math.min(U - 4, P - got); out.set(b.subarray(po + 4, po + 4 + take), got); got += take; ov = u32(po); }
      if (got < P) throw new Error(t('오버플로 페이지 체인이 끝났지만 데이터가 부족합니다', 'The overflow chain ended before all data was read'));
      return out;
    }
    function record(a) {
      var p = 0, hv = (function () { var r = 0n, i; for (i = 0; i < 8; i++) { r = (r << 7n) | BigInt(a[p + i] & 0x7f); if (!(a[p + i] & 0x80)) { p += i + 1; return Number(r); } } r = (r << 8n) | BigInt(a[p + 8]); p += 9; return Number(r); })();
      var types = [], q = p, end = hv;
      function rv() { var r = 0n, i; for (i = 0; i < 8; i++) { r = (r << 7n) | BigInt(a[q + i] & 0x7f); if (!(a[q + i] & 0x80)) { q += i + 1; return Number(r); } } r = (r << 8n) | BigInt(a[q + 8]); q += 9; return Number(r); }
      while (q < end) types.push(rv());
      var pos = hv, vals = [];
      var dv = new DataView(a.buffer, a.byteOffset, a.byteLength);
      types.forEach(function (st) {
        if (st === 0) vals.push(null);
        else if (st >= 1 && st <= 6) { var len = [0, 1, 2, 3, 4, 6, 8][st], x = 0n; for (var i = 0; i < len; i++) x = (x << 8n) | BigInt(a[pos + i]); if (a[pos] & 0x80) x -= (1n << BigInt(len * 8)); vals.push(x >= -9007199254740991n && x <= 9007199254740991n ? Number(x) : x); pos += len; }
        else if (st === 7) { vals.push(dv.getFloat64(pos, false)); pos += 8; }
        else if (st === 8) vals.push(0); else if (st === 9) vals.push(1);
        else if (st >= 12) { var l = st % 2 === 0 ? (st - 12) / 2 : (st - 13) / 2, seg = a.subarray(pos, pos + l); if (pos + l > a.length) throw new Error(t('레코드가 잘렸습니다', 'Truncated record')); vals.push(st % 2 === 0 ? { blob: seg } : decodeText(seg)); pos += l; }
        else throw new Error(t('알 수 없는 레코드 타입 ' + st, 'Unknown record serial type ' + st));
      });
      return vals;
    }
    /* b-트리 순회 */
    var seen = {};
    function walkTable(root, visit) {
      var stop = false;
      (function rec(pn, depth) {
        if (stop) return; if (depth > 40 || seen[pn]) throw new Error(t('b-트리가 순환하거나 너무 깊습니다 (페이지 ' + pn + ')', 'The b-tree is cyclic or too deep (page ' + pn + ')'));
        seen[pn] = 1; var po = pageOff(pn), hb = pn === 1 ? po + 100 : po, ty = b[hb], cnt = u16(hb + 3);
        if (ty === 0x0d) {
          for (var i = 0; i < cnt; i++) { var cp = po + u16(hb + 8 + i * 2); var pl = vi(cp), rid = varint(cp + pl.n); var data = payload(cp + pl.n + rid.n, pl.v, true); if (visit(rid.v, data) === false) { stop = true; return; } }
        } else if (ty === 0x05) {
          for (var j = 0; j < cnt; j++) { var cp2 = po + u16(hb + 12 + j * 2); rec(u32(cp2), depth + 1); if (stop) return; }
          rec(u32(hb + 8), depth + 1);
        } else throw new Error(t('테이블 b-트리가 아닌 페이지입니다 (페이지 ' + pn + ', 종류 0x' + ty.toString(16) + ')', 'Not a table b-tree page (page ' + pn + ', type 0x' + ty.toString(16) + ')'));
      })(root, 0);
      seen = {};
    }
    function countRows(root) {
      var c = 0;
      (function rec(pn, depth) {
        if (depth > 40) return; var po = pageOff(pn), hb = pn === 1 ? po + 100 : po, ty = b[hb], cnt = u16(hb + 3);
        if (ty === 0x0d) c += cnt; else if (ty === 0x05) { for (var j = 0; j < cnt; j++) rec(u32(po + u16(hb + 12 + j * 2)), depth + 1); rec(u32(hb + 8), depth + 1); }
      })(root, 0); return c;
    }
    function fmt(x) { if (x === null) return 'NULL'; if (x && x.blob) { var hx = N.toHex(x.blob.subarray(0, 24)); return 'x\'' + hx + (x.blob.length > 24 ? '…' : '') + '\' (' + x.blob.length + ' B)'; } if (typeof x === 'number' && !Number.isInteger(x)) return String(x); return String(x); }
    /* 스키마 */
    var master = [];
    try { walkTable(1, function (rid, data) { var r = record(data); master.push({ type: r[0], name: r[1], tbl: r[2], root: Number(r[3] || 0), sql: r[4] || '' }); }); }
    catch (e) { throw new Error(t('스키마(sqlite_master)를 읽지 못했습니다: ', 'Could not read the schema (sqlite_master): ') + e.message); }
    var tables = master.filter(function (m) { return m.type === 'table'; });
    function colsOf(sql) {
      var i = sql.indexOf('('), j = sql.lastIndexOf(')'); if (i < 0 || j < i) return [];
      var body = sql.slice(i + 1, j), parts = [], d = 0, cur = '', q = null;
      for (var k = 0; k < body.length; k++) { var ch = body[k]; if (q) { cur += ch; if (ch === q) q = null; continue; } if (ch === '\'' || ch === '"' || ch === '`') { q = ch; cur += ch; continue; } if (ch === '[') q = ']'; if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { parts.push(cur); cur = ''; continue; } cur += ch; }
      if (cur.trim()) parts.push(cur);
      var out = [];
      parts.forEach(function (p) { p = p.trim(); if (/^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(p)) return; var m = /^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([^\s]+))\s*([A-Za-z]*)/.exec(p); if (m) out.push({ name: m[1] || m[2] || m[3] || m[4], alias: /^INTEGER\s+PRIMARY\s+KEY/i.test(p.replace(/^(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|\S+)\s*/, '')) }); });
      return out;
    }
    var objRows = master.map(function (m) { var cnt = '—'; if (m.type === 'table' && m.root > 0 && m.root <= nPages) { try { cnt = /WITHOUT\s+ROWID/i.test(m.sql) ? '—' : String(countRows(m.root)); } catch (e) { cnt = '?'; } } return [m.type, m.name, m.tbl, m.root || '—', cnt]; });
    var sqlText = master.filter(function (m) { return m.sql; }).map(function (m) { return m.sql.replace(/\s+$/, '') + ';'; }).join('\n\n');
    /* 행 */
    var rowsOut = { head: [], rows: [] }, tname = String(o.table || '').trim();
    var target = tname ? tables.filter(function (m) { return m.name.toLowerCase() === tname.toLowerCase(); })[0] : tables.filter(function (m) { return m.name.indexOf('sqlite_') !== 0; })[0] || tables[0];
    if (tname && !target) issues.push(t('테이블 "' + tname + '" 을(를) 찾지 못했습니다. 사용 가능: ' + tables.map(function (m) { return m.name; }).join(', '), 'Table "' + tname + '" was not found. Available: ' + tables.map(function (m) { return m.name; }).join(', ')));
    var shownName = '';
    if (target) {
      shownName = target.name;
      if (/WITHOUT\s+ROWID/i.test(target.sql)) { issues.push(t('테이블 ' + target.name + ' 은(는) WITHOUT ROWID 라서 행을 표시하지 않습니다 (스키마만 확인)', 'Table ' + target.name + ' is WITHOUT ROWID, so rows are not shown (schema only)')); }
      else if (/^CREATE\s+VIRTUAL/i.test(target.sql) || !target.root) { issues.push(t('가상 테이블은 행을 표시하지 않습니다', 'Virtual tables are not browsable here')); }
      else {
        var cs = colsOf(target.sql), skip = Number(o.skip) || 0, lim = Number(o.limit) || 50, needle = String(o.find || '').toLowerCase(), seenN = 0, matched = 0, total = 0, widest = 0;
        var aliasIdx = -1; cs.forEach(function (c, i) { if (c.alias) aliasIdx = i; });
        var list = [];
        try {
          walkTable(target.root, function (rid, data) {
            total++;
            var r = record(data); if (aliasIdx >= 0 && r[aliasIdx] === null) r[aliasIdx] = Number(rid);
            var cells = [String(rid)].concat(r.map(fmt));
            if (needle && !cells.slice(1).some(function (c) { return c.toLowerCase().indexOf(needle) >= 0; })) return true;
            matched++; if (matched <= skip) return true;
            if (list.length < lim) { list.push(cells); widest = Math.max(widest, r.length); return true; }
            return needle ? true : false;
          });
        } catch (e) { issues.push(t('행을 읽는 중 오류: ', 'Error while reading rows: ') + e.message); }
        if (!list.length && !issues.length) issues.push(t('표시할 행이 없습니다', 'No rows to show'));
        var cc = Math.max(widest, cs.length);
        rowsOut.head = [['rowid', 'rowid']].concat(Array.apply(null, Array(cc)).map(function (_, i) { return [cs[i] ? cs[i].name : 'col' + (i + 1), cs[i] ? cs[i].name : 'col' + (i + 1)]; }));
        rowsOut.rows = list.map(function (r) { while (r.length < cc + 1) r.push(''); return r; });
        if (needle) issues.push(t('검색 결과 일치 행 ' + matched + '개', matched + ' matching row(s)'));
      }
    }
    var auto = u32(52), freeCnt = u32(36), sver = u32(96);
    var info = [[['페이지 크기', 'Page size'], pageSize + ' B'], [['페이지 수', 'Page count'], nPages + (hdrPages && hdrPages !== nPages ? ' (' + t('헤더 ', 'header ') + hdrPages + ')' : '')], [['파일 크기', 'File size'], b.length + ' B'], [['텍스트 인코딩', 'Text encoding'], encName], [['예약 바이트', 'Reserved bytes/page'], String(reserved)], [['저널 모드 (쓰기/읽기)', 'Journal mode (write/read)'], b[18] === 2 && b[19] === 2 ? 'WAL' : 'rollback (' + b[18] + '/' + b[19] + ')'], [['파일 변경 카운터', 'File change counter'], String(u32(24))], [['스키마 쿠키', 'Schema cookie'], String(u32(40))], [['스키마 포맷', 'Schema format'], String(u32(44))], [['user_version', 'user_version'], String(u32(60) | 0)], [['application_id', 'application_id'], '0x' + ('00000000' + u32(68).toString(16)).slice(-8)], [['자동 vacuum', 'Auto-vacuum'], auto ? (u32(64) ? 'incremental' : 'full') : 'none'], [['빈 페이지(freelist)', 'Freelist pages'], String(freeCnt)], [['마지막 SQLite 버전', 'Last SQLite version'], sver ? Math.floor(sver / 1000000) + '.' + Math.floor(sver / 1000) % 1000 + '.' + sver % 1000 : '—'], [['개체 수', 'Objects'], tables.length + t('개 테이블', ' table(s)') + ', ' + master.filter(function (m) { return m.type === 'index'; }).length + t('개 인덱스', ' index(es)') + ', ' + master.filter(function (m) { return m.type === 'view'; }).length + t('개 뷰', ' view(s)') + ', ' + master.filter(function (m) { return m.type === 'trigger'; }).length + t('개 트리거', ' trigger(s)')]];
    if (b[18] === 2 || b[19] === 2) issues.push(t('WAL 모드 파일입니다. -wal 파일에 아직 반영되지 않은 변경은 보이지 않습니다', 'This is a WAL-mode file; changes still in the -wal file are not shown'));
    if (reserved) issues.push(t('페이지마다 예약 바이트가 ' + reserved + '개 있습니다 (암호화 확장 등) — 그대로 해석합니다', 'Each page reserves ' + reserved + ' bytes (e.g. encryption extensions); parsed as-is'));
    return { _status: t('✅ SQLite 3 파일 — 페이지 ' + nPages + '개 · ' + encName + ' · 테이블 ' + tables.length + '개' + (shownName ? ' · ' + shownName + ' 표시' : ''), '✅ SQLite 3 file — ' + nPages + ' page(s) · ' + encName + ' · ' + tables.length + ' table(s)' + (shownName ? ' · showing ' + shownName : '')), info: info, objs: { head: [['종류', 'Type'], ['이름', 'Name'], ['테이블', 'Table'], ['루트 페이지', 'Root page'], ['행 수', 'Rows']], rows: objRows }, rows: rowsOut, sql: sqlText, issues: issues };
  }
});
