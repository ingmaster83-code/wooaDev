TK.tool('checksum-calculator', {
  inputs: [{ id: 'in', label: ['데이터', 'Data'], rows: 6, sample: '123456789', placeholder: ['텍스트 또는 16진수 바이트', 'Text or hex bytes'] }, { id: 'expect', type: 'text', label: ['비교할 값 (선택, 16진수)', 'Value to compare (optional, hex)'], sample: 'CBF43926' }],
  options: [
    { id: 'fmt', type: 'select', label: ['입력 해석', 'Input as'], choices: [['text', ['UTF-8 텍스트', 'UTF-8 text']], ['hex', ['16진수 바이트 (예: 01 03 00 00)', 'Hex bytes (e.g. 01 03 00 00)']]], default: 'text' },
    { id: 'family', type: 'select', label: ['표시할 종류', 'Show'], choices: [['all', ['전체', 'All']], ['16', 'CRC-16'], ['32', 'CRC-32'], ['8', 'CRC-8'], ['64', 'CRC-64'], ['sum', 'Adler-32 · Fletcher-16']], default: 'all' },
    { id: 'swap', type: 'checkbox', label: ['16비트 결과의 바이트 순서 뒤집기 (Modbus 전송 순서)', 'Swap bytes of 16-bit results (Modbus wire order)'], default: false }
  ],
  outputs: [{ id: 'table', label: ['체크섬 결과', 'Checksums'], kind: 'table' }],
  run: function (v, o, t) {
    var H = TK.hash, bytes = o.fmt === 'hex' ? H.fromHex(v.in) : H.utf8(v.in);
    function hx(val, bits) { var s = val.toString(16).toUpperCase(); return '0x' + ('0000000000000000'.slice(0, bits / 4) + s).slice(-bits / 4); }
    var exp = String(v.expect || '').trim().replace(/^0x/i, '').toLowerCase(), rows = [], hits = 0;
    function add(name, val, bits, known) {
      var out = BigInt(val);
      if (o.swap && bits === 16) out = ((out & 255n) << 8n) | (out >> 8n);
      var h = hx(out, bits), alt = bits === 16 ? hx(((out & 255n) << 8n) | (out >> 8n), 16) : null, e = exp && exp.padStart(bits / 4, '0'), hit = exp && (h.slice(2).toLowerCase() === e || (alt && alt.slice(2).toLowerCase() === e));
      if (hit) hits++;
      rows.push({ cls: hit ? 'r-ok' : '', cells: [name + (hit ? ' ✓' : ''), h, out.toString(), known] });
    }
    H.CRCS.forEach(function (p) {
      var f = String(p.width); if (o.family !== 'all' && o.family !== f) return;
      add(p.name, H.crc(p, bytes), p.width, '0x' + p.check.toString(16).toUpperCase().padStart(p.width / 4, '0'));
    });
    if (o.family === 'all' || o.family === 'sum') { add('Adler-32', H.adler32(bytes), 32, '0x091E01DE'); add('Fletcher-16', H.fletcher16(bytes), 16, '0x1EDE'); }
    return { _status: exp ? (hits ? { ok: true, msg: t('✅ ' + hits + '개 알고리즘이 입력한 값과 일치합니다 (초록색 행)', '✅ ' + hits + ' algorithm(s) match the value you entered (green rows)') } : { ok: false, msg: t('❌ 입력한 값과 일치하는 알고리즘이 없습니다', '❌ No algorithm matches the entered value') }) : t('✅ ' + bytes.length + '바이트의 체크섬 ' + rows.length + '종 계산', '✅ ' + rows.length + ' checksums over ' + bytes.length + ' bytes'),
      table: { head: [['알고리즘', 'Algorithm'], ['값 (16진)', 'Value (hex)'], ['10진수', 'Decimal'], ['표준 검증값("123456789")', 'Standard check ("123456789")']], rows: rows } };
  }
});
