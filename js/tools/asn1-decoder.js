TK.tool('asn1-decoder', {
  inputs: [
    { id: 'in', label: ['ASN.1 데이터 (PEM / 16진수 / Base64)', 'ASN.1 data (PEM / hex / Base64)'], rows: 8, sample: '30 32 02 01 05 30 0d 06 09 2a 86 48 86 f7 0d 01 01 0b 05 00 16 0c 57 6f 6f 61 48 6f 75 73 65 2e 63 6f 17 0d 32 36 31 30 31 37 30 30 30 30 30 30 5a 01 01 ff', show: function (o) { return o.mode !== 'file'; } },
    { id: 'file', type: 'file', buffer: true, label: ['파일 선택 (.der .cer .crt .pem .p7b …)', 'Choose a file (.der .cer .crt .pem .p7b …)'], show: function (o) { return o.mode === 'file'; } }
  ],
  options: [
    { id: 'deep', type: 'checkbox', label: ['OCTET STRING·BIT STRING 안에 든 ASN.1 도 펼치기', 'Also expand ASN.1 inside OCTET STRING and BIT STRING'], default: true },
    TK.binin.modeOption(), TK.binin.fmtOption()
  ],
  outputs: [{ id: 'table', label: ['구조 트리', 'Structure tree'], kind: 'table' }, { id: 'out', label: ['텍스트 트리 (openssl asn1parse 유사)', 'Text tree (like openssl asn1parse)'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, A = TK.asn1, issues = [], u8, pemLabel = '';
    if (o.mode !== 'file' && /-----BEGIN [A-Z0-9 ]+-----/.test(String(v['in'] || ''))) {
      var txt = String(v['in']), blocks = txt.match(/-----BEGIN ([A-Z0-9 ]+)-----/g) || [];
      var pm = A.pemToDer(txt); u8 = pm.der; pemLabel = pm.label;
      if (blocks.length > 1) issues.push(t('PEM 블록이 ' + blocks.length + '개 있어 첫 번째(' + pemLabel + ')만 해석했습니다', blocks.length + ' PEM blocks found; only the first (' + pemLabel + ') was decoded'));
      if (/ENCRYPTED/.test(pemLabel) || /Proc-Type: 4,ENCRYPTED/.test(txt)) issues.push(t('암호화된 PEM 은 비밀번호로 복호화한 뒤에야 내용을 볼 수 있습니다', 'An encrypted PEM can only be read after decrypting it'));
    } else if (o.mode === 'file') {
      var f = v.file; if (!f || !f.buf) throw new Error(t('파일을 선택하세요', 'Choose a file'));
      var raw = new Uint8Array(f.buf), head = new TextDecoder().decode(raw.subarray(0, 40));
      if (/-----BEGIN /.test(head)) { var pm2 = A.pemToDer(new TextDecoder().decode(raw)); u8 = pm2.der; pemLabel = pm2.label; } else u8 = raw;
    } else u8 = N.get(v, o).bytes;
    var rows = [], lines = [], count = 0, maxDepth = 0, ber = 0;
    var OIDS = A.OIDS;
    function fmtHex(a, n) { var h = N.toHex(a, ' '); return a.length > n ? N.toHex(a.subarray(0, n), ' ') + ' …(' + a.length + ' B)' : h; }
    function valueOf(n) {
      var val = n.value;
      if (n.cls !== 0) return n.constructed ? '' : fmtHex(val, 24);
      switch (n.tag) {
        case 1: return val[0] ? 'TRUE' : 'FALSE';
        case 2: case 10: { if (val.length > 8) return '0x' + N.toHex(val.subarray(0, 24)) + (val.length > 24 ? '…' : '') + ' (' + A.bitLength(val) + ' bit)'; return A.int(val).toString(); }
        case 3: return val.length ? (val[0] ? t('미사용 ', 'unused ') + val[0] + t('비트 · ', ' bits · ') : '') + fmtHex(val.subarray(1), 20) : '';
        case 4: return fmtHex(val, 24);
        case 5: return 'NULL';
        case 6: { var oid = A.oid(val); return oid + (OIDS[oid] ? ' (' + OIDS[oid] + ')' : ''); }
        case 12: case 19: case 20: case 22: case 26: case 27: case 28: case 18: case 25: return JSON.stringify(A.str(n));
        case 30: return JSON.stringify(A.str(n));
        case 23: case 24: return A.time(n);
        default: return n.constructed ? '' : fmtHex(val, 24);
      }
    }
    function walk(n, depth, base, path) {
      if (++count > 20000) throw new Error(t('노드가 너무 많습니다', 'Too many nodes'));
      if (depth > maxDepth) maxDepth = depth;
      var off = base + n.start, nm = n.name + (n.constructed ? '' : ''), vs = valueOf(n), ind = new Array(depth + 1).join('  ');
      if (n.len === undefined) ber++;
      var tagLabel = n.cls === 0 ? nm : (n.cls === 2 ? '[' + n.tag + '] ' + t('컨텍스트', 'context') : nm);
      if (rows.length < 600) rows.push([String(off), ind + tagLabel + (n.constructed ? ' (' + n.children.length + ')' : ''), String(n.hdr), String(n.len), vs]);
      lines.push(('     ' + off).slice(-5) + ':d=' + depth + '  hl=' + n.hdr + ' l=' + ('    ' + n.len).slice(-4) + ' ' + (n.constructed ? 'cons: ' : 'prim: ') + ind + tagLabel + (vs ? '  : ' + vs : ''));
      if (n.constructed) n.children.forEach(function (c) { walk(c, depth + 1, base, path); });
      else if (o.deep && (n.tag === 4 || n.tag === 3) && n.cls === 0 && n.value.length > 1) {
        var inner = n.tag === 3 ? n.value.subarray(1) : n.value, innerBase = base + n.start + n.hdr + (n.tag === 3 ? 1 : 0);
        if (inner.length >= 2 && (inner[0] === 0x30 || inner[0] === 0x31 || inner[0] === 0x02 || inner[0] === 0x06 || inner[0] === 0xa0 || inner[0] === 0xa1)) {
          try { var sub = A.parse(inner, 0); if (sub.end === inner.length) { lines.push('      ' + ind + '  ↳ ' + t('내부에 든 ASN.1', 'ASN.1 inside')); walk(sub, depth + 1, innerBase, path); } } catch (e) { /* 내부 구조 아님 */ }
        }
      }
    }
    var pos = 0, nroots = 0;
    while (pos < u8.length) {
      var node; try { node = A.parse(u8, pos); } catch (e) { if (nroots) { issues.push(t('오프셋 ' + pos + ' 이후 ' + (u8.length - pos) + '바이트는 해석하지 못했습니다: ', (u8.length - pos) + ' bytes after offset ' + pos + ' could not be parsed: ') + e.message); break; } throw e; }
      walk(node, 0, 0, ''); pos = node.end; nroots++;
      if (nroots > 200) break;
    }
    if (nroots > 1) issues.push(t('최상위 객체가 ' + nroots + '개 이어져 있습니다', nroots + ' top-level objects in a row'));
    if (pemLabel) issues.push(t('PEM 레이블: ' + pemLabel + ' — Base64 를 풀어 DER 로 해석했습니다', 'PEM label: ' + pemLabel + ' — Base64-decoded and parsed as DER'));
    issues.push(t('OBJECT IDENTIFIER 의 이름은 자주 쓰는 것만 내장되어 있습니다. 모르는 OID 는 oid-info.com 에서 확인하세요', 'Only common OIDs are named; look up others on oid-info.com'));
    return { _status: t('✅ 해석 완료 — ' + u8.length + '바이트, 노드 ' + count + '개, 깊이 ' + (maxDepth + 1), '✅ Parsed — ' + u8.length + ' bytes, ' + count + ' nodes, depth ' + (maxDepth + 1)), table: { head: [['오프셋', 'Offset'], ['태그', 'Tag'], ['헤더', 'Header'], ['길이', 'Length'], ['값', 'Value']], rows: rows }, out: lines.join('\n'), issues: issues };
  }
});
