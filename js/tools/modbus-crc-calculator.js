TK.tool('modbus-crc-calculator', {
  inputs: [{ id: 'hex', label: ['Modbus RTU 프레임 (16진수 바이트)', 'Modbus RTU frame (hex bytes)'], rows: 4, sample: '01 03 00 00 00 0A' }],
  options: [{ id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['append', ['CRC 계산해 붙이기', 'Compute and append the CRC']], ['verify', ['CRC 포함 프레임 검증', 'Verify a frame that includes its CRC']]], default: 'append' }],
  outputs: [{ id: 'table', label: ['결과', 'Result'], kind: 'table' }, { id: 'out', label: ['완성된 프레임', 'Complete frame'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var hx = String(v.hex || '').replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
    if (hx.length < 2 || hx.length % 2) throw new Error(t('16진수 바이트(2자리씩)를 입력하세요', 'Enter hex bytes (two digits each)'));
    var b = []; for (var i = 0; i < hx.length; i += 2) b.push(parseInt(hx.substr(i, 2), 16));
    var P = TK.hash.CRCS.filter(function (c) { return c.name === 'CRC-16/MODBUS'; })[0];
    function crc(arr) { return TK.hash.crc(P, new Uint8Array(arr)); }
    function h2(x) { return ('0' + x.toString(16)).slice(-2).toUpperCase(); }
    var FN = { 1: 'Read Coils', 2: 'Read Discrete Inputs', 3: 'Read Holding Registers', 4: 'Read Input Registers', 5: 'Write Single Coil', 6: 'Write Single Register', 15: 'Write Multiple Coils', 16: 'Write Multiple Registers', 17: 'Report Server ID', 23: 'Read/Write Multiple Registers', 43: 'Read Device Identification' };
    var EX = { 1: 'Illegal Function', 2: 'Illegal Data Address', 3: 'Illegal Data Value', 4: 'Server Device Failure', 5: 'Acknowledge', 6: 'Server Device Busy', 8: 'Memory Parity Error', 10: 'Gateway Path Unavailable', 11: 'Gateway Target Failed to Respond' };
    var issues = [], rows = [], frame, body;
    if (o.mode === 'verify') {
      if (b.length < 4) throw new Error(t('CRC 2바이트를 포함해 최소 4바이트가 필요합니다', 'At least 4 bytes are needed (including the 2-byte CRC)'));
      body = b.slice(0, -2); var c = crc(body), lo = c & 255, hi = c >> 8, gotLo = b[b.length - 2], gotHi = b[b.length - 1], ok = lo === gotLo && hi === gotHi, swapped = lo === gotHi && hi === gotLo;
      rows.push([t('수신 CRC (전송 순서)', 'Received CRC (wire order)'), h2(gotLo) + ' ' + h2(gotHi)], [t('계산된 CRC (전송 순서)', 'Computed CRC (wire order)'), h2(lo) + ' ' + h2(hi)], [t('계산된 CRC 값 (16비트)', 'Computed CRC (16-bit)'), '0x' + ('000' + c.toString(16)).slice(-4).toUpperCase()], [t('판정', 'Verdict'), ok ? '✅ ' + t('일치', 'match') : swapped ? '⚠️ ' + t('바이트 순서가 반대입니다 (high 먼저 보냄)', 'bytes are swapped (high byte sent first)') : '❌ ' + t('불일치 — 전송 오류 또는 잘못된 프레임', 'mismatch — transmission error or wrong frame')]);
      frame = b; if (swapped) issues.push(t('Modbus RTU 는 CRC 의 낮은 바이트를 먼저 보냅니다', 'Modbus RTU sends the low byte of the CRC first'));
      return describe(ok);
    }
    body = b; var cc = crc(body), lo2 = cc & 255, hi2 = cc >> 8; frame = b.concat([lo2, hi2]);
    rows.push([t('CRC-16/MODBUS 값', 'CRC-16/MODBUS value'), '0x' + ('000' + cc.toString(16)).slice(-4).toUpperCase()], [t('전송 순서 (낮은 바이트 먼저)', 'Wire order (low byte first)'), h2(lo2) + ' ' + h2(hi2)], [t('전체 프레임', 'Full frame'), frame.map(h2).join(' ')]);
    return describe(true);
    function describe(ok) {
      var f = frame, addr = f[0], fn = f[1];
      rows.push([t('슬레이브 주소', 'Slave address'), addr + (addr === 0 ? ' (' + t('브로드캐스트', 'broadcast') + ')' : addr > 247 ? ' ⚠️ ' + t('유효 범위 1~247 초과', 'outside the valid 1–247') : '')]);
      if (fn !== undefined) {
        var isErr = (fn & 0x80) !== 0, code = fn & 0x7f;
        rows.push([t('기능 코드', 'Function code'), fn + (isErr ? ' ⛔' : '') + ' (0x' + h2(fn) + ') — ' + (FN[code] || t('알 수 없음/사용자 정의', 'unknown / user defined')) + (isErr ? ' ' + t('예외 응답', 'exception response') : '')]);
        if (isErr && f.length >= 5) rows.push([t('예외 코드', 'Exception code'), f[2] + ' — ' + (EX[f[2]] || '?')]);
        else if ([1, 2, 3, 4].indexOf(fn) >= 0 && f.length === 8) rows.push([t('요청 해석', 'Request'), t('시작 주소 ', 'start address ') + ((f[2] << 8) | f[3]) + t(', 개수 ', ', quantity ') + ((f[4] << 8) | f[5]) + ' (' + t('프로토콜 주소, 레지스터 번호 ', 'protocol address, register number ') + (((f[2] << 8) | f[3]) + (fn === 3 ? 40001 : fn === 4 ? 30001 : fn === 1 ? 1 : 10001)) + ')']);
        else if ([5, 6].indexOf(fn) >= 0 && f.length === 8) rows.push([t('요청/응답', 'Request / response'), t('주소 ', 'address ') + ((f[2] << 8) | f[3]) + t(', 값 0x', ', value 0x') + h2(f[4]) + h2(f[5]) + (fn === 5 ? (f[4] === 0xff ? ' (ON)' : f[4] === 0 ? ' (OFF)' : ' ⚠️') : '')]);
        else if ([1, 2, 3, 4].indexOf(fn) >= 0 && f.length > 5) rows.push([t('응답 해석', 'Response'), t('데이터 바이트 수 ', 'byte count ') + f[2] + (f[2] === f.length - 5 ? ' ✅' : ' ⚠️ ' + t('프레임 길이와 불일치', 'does not match the frame length')) + (fn === 3 || fn === 4 ? ' → ' + Math.floor(f[2] / 2) + t('개 레지스터: ', ' registers: ') + (function () { var r = []; for (var i = 3; i + 1 < f.length - 2 && r.length < 8; i += 2) r.push('0x' + h2(f[i]) + h2(f[i + 1]) + '=' + ((f[i] << 8) | f[i + 1])); return r.join(', '); })() : '')]);
      }
      if (f.length > 256) issues.push(t('Modbus RTU 프레임은 최대 256바이트입니다', 'A Modbus RTU frame is at most 256 bytes'));
      issues.push(t('CRC 대상은 슬레이브 주소부터 데이터 끝까지이며 CRC 자신은 제외합니다. 프레임 사이에는 3.5 문자 시간 이상의 정적이 필요합니다', 'The CRC covers address through data, not itself. Frames are separated by a silent gap of at least 3.5 character times'));
      issues.push(t('Modbus TCP 에는 CRC 가 없습니다 (TCP 가 무결성을 보장). 이 도구는 RTU(직렬) 용입니다', 'Modbus TCP has no CRC; this tool is for RTU (serial)'));
      return { _status: ok ? t('✅ CRC-16/MODBUS 처리 완료', '✅ CRC-16/MODBUS done') : { ok: false, msg: t('❌ CRC 불일치', '❌ CRC mismatch') }, table: { head: [['항목', 'Item'], ['값', 'Value']], rows: rows }, out: f.map(h2).join(' '), issues: issues };
    }
  }
});
