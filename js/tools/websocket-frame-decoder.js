TK.tool('websocket-frame-decoder', {
  inputs: TK.binin.inputs('in', ['WebSocket 프레임 (16진수 / Base64)', 'WebSocket frames (hex / Base64)'], '81 85 37 fa 21 3d 7f 9f 4d 51 58 81 05 48 65 6c 6c 6f 89 00 88 05 03 e8 62 79 65', 5),
  options: [
    { id: 'dir', type: 'select', label: ['보낸 쪽', 'Sender'], choices: [['any', ['구분 안 함', 'Not specified']], ['client', ['클라이언트 → 서버 (마스킹 필수)', 'Client → server (must be masked)']], ['server', ['서버 → 클라이언트 (마스킹 금지)', 'Server → client (must not be masked)']]], default: 'any' },
    TK.binin.modeOption(), TK.binin.fmtOption()
  ],
  outputs: [{ id: 'table', label: ['프레임', 'Frames'], kind: 'table' }, { id: 'out', label: ['메시지 (조각 합친 결과)', 'Messages (fragments joined)'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, inp = N.get(v, o), u8 = inp.bytes, issues = [], rows = [], msgs = [], p = 0, fragOp = null, frag = [], fragN = 0;
    var OPS = { 0: 'continuation', 1: 'text', 2: 'binary', 8: 'close', 9: 'ping', 10: 'pong' };
    var CLOSE = { 1000: 'Normal Closure', 1001: 'Going Away', 1002: 'Protocol Error', 1003: 'Unsupported Data', 1005: 'No Status Rcvd (예약)', 1006: 'Abnormal Closure (예약)', 1007: 'Invalid Payload Data', 1008: 'Policy Violation', 1009: 'Message Too Big', 1010: 'Mandatory Extension', 1011: 'Internal Error', 1012: 'Service Restart', 1013: 'Try Again Later', 1014: 'Bad Gateway', 1015: 'TLS Handshake (예약)' };
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), nf = 0;
    function utf8(a) { try { return new TextDecoder('utf-8', { fatal: true }).decode(a); } catch (e) { return null; } }
    function flush() {
      var tot = frag.reduce(function (s, x) { return s + x.length; }, 0), all = new Uint8Array(tot), q = 0; frag.forEach(function (x) { all.set(x, q); q += x.length; });
      if (fragOp === 1) { var s = utf8(all); if (s === null) { issues.push(t('텍스트 메시지가 올바른 UTF-8 이 아닙니다 (close 1007 대상)', 'A text message is not valid UTF-8 (should close with 1007)')); s = new TextDecoder().decode(all); } msgs.push('[text' + (fragN > 1 ? ', ' + fragN + t(' 조각', ' fragments') : '') + '] ' + s); }
      else msgs.push('[binary' + (fragN > 1 ? ', ' + fragN + t(' 조각', ' fragments') : '') + ', ' + all.length + ' B] ' + N.short(N.toHex(all), 96));
      fragOp = null; frag = []; fragN = 0;
    }
    while (p < u8.length) {
      var start = p; if (p + 2 > u8.length) { issues.push(t('오프셋 ' + p + ': 프레임 헤더(최소 2바이트)가 잘렸습니다', 'Offset ' + p + ': truncated frame header (2 bytes minimum)')); break; }
      var b0 = u8[p], b1 = u8[p + 1], fin = !!(b0 & 0x80), rsv = (b0 >> 4) & 7, op = b0 & 15, mask = !!(b1 & 0x80), len = b1 & 0x7f; p += 2;
      if (len === 126) { if (p + 2 > u8.length) { issues.push(t('확장 길이(2바이트)가 잘렸습니다', 'Truncated 16-bit length')); break; } len = dv.getUint16(p); p += 2; if (len < 126) issues.push(t('프레임 ' + (nf + 1) + ': 최소 길이 인코딩이 아닙니다 (126 미만을 16비트로 표현)', 'Frame ' + (nf + 1) + ': length not minimally encoded (<126 in 16 bits)')); }
      else if (len === 127) { if (p + 8 > u8.length) { issues.push(t('확장 길이(8바이트)가 잘렸습니다', 'Truncated 64-bit length')); break; } var bl = dv.getBigUint64(p); p += 8; if (bl >> 63n) { issues.push(t('64비트 길이의 최상위 비트가 1 입니다', 'The top bit of the 64-bit length is set')); break; } if (bl > 4294967295n) { issues.push(t('길이 ' + bl + ' 바이트는 너무 큽니다', 'Length ' + bl + ' bytes is too large')); break; } len = Number(bl); }
      var key = null; if (mask) { if (p + 4 > u8.length) { issues.push(t('마스킹 키(4바이트)가 잘렸습니다', 'Truncated masking key')); break; } key = u8.subarray(p, p + 4); p += 4; }
      var avail = Math.min(len, u8.length - p), pay = u8.slice(p, p + avail); p += avail; nf++;
      if (key) for (var i = 0; i < pay.length; i++) pay[i] ^= key[i & 3];
      var trunc = avail < len;
      if (trunc) issues.push(t('프레임 ' + nf + ': 페이로드가 ' + (len - avail) + '바이트 잘렸습니다 (선언 ' + len + ', 실제 ' + avail + ')', 'Frame ' + nf + ': payload truncated by ' + (len - avail) + ' bytes (declared ' + len + ', got ' + avail + ')'));
      var info = '';
      var tag = 'F' + nf;
      if (!(op in OPS)) { issues.push(t(tag + ': 알 수 없는 opcode 0x' + op.toString(16), tag + ': unknown opcode 0x' + op.toString(16))); info = 'h\'' + N.short(N.toHex(pay), 40) + '\''; }
      else if (op === 8) {
        if (pay.length >= 2) { var code = (pay[0] << 8) | pay[1], reason = utf8(pay.subarray(2)); info = code + ' ' + (CLOSE[code] || (code >= 3000 && code < 5000 ? 'Registered/Private' : '?')) + (reason ? ' — "' + reason + '"' : ''); if (code < 1000 || (code >= 1004 && code <= 1006) || (code >= 1015 && code < 3000) || code >= 5000) issues.push(t(tag + ': 전송해서는 안 되는 close 코드 ' + code, tag + ': close code ' + code + ' must not be sent')); }
        else if (pay.length === 1) { info = t('⚠️ 1바이트 페이로드', '⚠️ 1-byte payload'); issues.push(t(tag + ': close 페이로드는 0 또는 2바이트 이상이어야 합니다', tag + ': a close payload must be empty or at least 2 bytes')); }
        else info = t('(상태 코드 없음)', '(no status code)');
      } else if (op === 9 || op === 10) info = pay.length ? 'h\'' + N.short(N.toHex(pay), 40) + '\'' : t('(빈 페이로드)', '(empty payload)');
      else if (op === 1 || (op === 0 && fragOp === 1)) { var sx = utf8(pay); info = sx === null ? 'h\'' + N.short(N.toHex(pay), 40) + '\' ' + t('(일부만 UTF-8 이 아닐 수 있음)', '(may be split mid-character)') : JSON.stringify(N.short(sx, 70)); }
      else info = 'h\'' + N.short(N.toHex(pay), 40) + '\'';
      /* 규격 점검 */
      if (op >= 8 && op <= 15) { if (!fin) issues.push(t(tag + ': 제어 프레임은 FIN=1 이어야 합니다', tag + ': control frames must have FIN=1')); if (len > 125) issues.push(t(tag + ': 제어 프레임 페이로드는 125바이트 이하여야 합니다', tag + ': control frame payload must be ≤ 125 bytes')); }
      if (rsv) issues.push(t(tag + ': RSV 비트 ' + rsv + (rsv & 4 ? '' : '') + ' — ' + (rsv === 4 ? 'permessage-deflate(RSV1) 협상 시 정상입니다' : '확장 협상 없이는 프로토콜 오류입니다'), tag + ': RSV bits ' + rsv + ' — ' + (rsv === 4 ? 'normal if permessage-deflate (RSV1) was negotiated' : 'a protocol error unless an extension defines them')));
      if (o.dir === 'client' && !mask) issues.push(t(tag + ': 클라이언트 프레임은 마스킹되어야 합니다 (RFC 6455 5.3)', tag + ': client frames must be masked (RFC 6455 5.3)'));
      if (o.dir === 'server' && mask) issues.push(t(tag + ': 서버 프레임은 마스킹하면 안 됩니다', tag + ': server frames must not be masked'));
      if (op === 0 && fragOp === null) issues.push(t(tag + ': 시작 프레임 없이 continuation 이 왔습니다', tag + ': continuation without a starting frame'));
      if ((op === 1 || op === 2) && fragOp !== null) issues.push(t(tag + ': 이전 조각 메시지가 끝나지 않았는데 새 데이터 프레임이 시작됐습니다', tag + ': a new data frame started before the previous fragmented message ended'));
      rows.push([tag, String(start), (fin ? 'FIN ' : '· ') + (rsv ? 'RSV' + rsv + ' ' : ''), (OPS[op] || '?') + ' (' + op + ')', mask ? t('예', 'yes') + ' ' + N.toHex(key, ' ') : t('아니오', 'no'), String(len), info]);
      if (op === 1 || op === 2) { fragOp = op; frag = [pay]; fragN = 1; if (fin) flush(); }
      else if (op === 0 && fragOp !== null) { frag.push(pay); fragN++; if (fin) flush(); }
      if (trunc) break;
      if (nf > 2000) { issues.push(t('프레임은 처음 2000개만 해석합니다', 'Only the first 2000 frames are decoded')); break; }
    }
    if (fragOp !== null) issues.push(t('마지막 조각 메시지가 끝나지 않았습니다 (FIN 프레임 없음)', 'The last fragmented message is incomplete (no FIN frame)'));
    if (!nf) throw new Error(t('프레임을 해석하지 못했습니다', 'No frames could be decoded'));
    issues.push(t('이 도구는 프레임 단위(RFC 6455)만 해석합니다. HTTP 업그레이드 요청/응답이나 TLS 레코드가 앞에 붙어 있으면 제거하세요', 'Only RFC 6455 frames are decoded; strip any HTTP upgrade request / response or TLS records in front'));
    return { _status: t('✅ 프레임 ' + nf + '개 해석', '✅ Decoded ' + nf + ' frame(s)'), table: { head: [['#', '#'], ['오프셋', 'Offset'], ['플래그', 'Flags'], ['opcode', 'Opcode'], ['마스크', 'Mask'], ['길이', 'Length'], ['페이로드', 'Payload']], rows: rows }, out: msgs.join('\n'), issues: issues };
  }
});
