TK.tool('tcp-flags-decoder', {
  inputs: [{ id: 'in', label: ['플래그 값 또는 이름 (한 줄에 하나)', 'Flag values or names (one per line)'], rows: 6, placeholder: ['0x12, 18, 0b010010, SYN+ACK, S., FA', '0x12, 18, 0b010010, SYN+ACK, S., FA'], sample: '0x02\n0x12\n0x18\n0x011\n0x04\nSYN,ECE,CWR\nS.\nFPU' }],
  options: [],
  outputs: [{ id: 'table', label: ['해석 결과', 'Decoded'], kind: 'table' }, { id: 'ref', label: ['TCP 플래그 비트', 'TCP flag bits'], kind: 'table' }],
  run: function (v, o, t) {
    var F = [['NS', 0x100, ['ECN-nonce (실험적)', 'ECN-nonce (experimental)']], ['CWR', 0x80, ['혼잡 윈도우 감소', 'Congestion Window Reduced']], ['ECE', 0x40, ['ECN 에코', 'ECN-Echo']], ['URG', 0x20, ['긴급 포인터 유효', 'Urgent pointer valid']], ['ACK', 0x10, ['확인 응답', 'Acknowledgment']], ['PSH', 0x08, ['즉시 전달(푸시)', 'Push']], ['RST', 0x04, ['연결 리셋', 'Reset']], ['SYN', 0x02, ['연결 요청·동기화', 'Synchronize']], ['FIN', 0x01, ['연결 종료', 'Finish']]];
    var tcpdump = { F: 'FIN', S: 'SYN', R: 'RST', P: 'PSH', U: 'URG', E: 'ECE', W: 'CWR', N: 'NS' };
    var COMBOS = { 0x02: ['연결 요청 (3-way 1단계)', 'Connection request (handshake step 1)'], 0x12: ['연결 수락 (3-way 2단계)', 'Connection accepted (handshake step 2)'], 0x10: ['확인 응답 / 연결 확립 후 데이터 없음', 'Plain ACK'], 0x18: ['데이터 전송(PSH+ACK)', 'Data push (PSH+ACK)'], 0x11: ['연결 종료 요청(FIN+ACK)', 'Close (FIN+ACK)'], 0x04: ['연결 거부·리셋', 'Reset'], 0x14: ['리셋 + 확인(RST+ACK)', 'Reset + ACK'], 0x00: ['NULL 스캔 패킷', 'NULL scan packet'], 0x29: ['XMAS 스캔 (FIN+PSH+URG)', 'XMAS scan (FIN+PSH+URG)'], 0x01: ['FIN 스캔 / 종료', 'FIN scan / close'], 0xc2: ['ECN 협상 SYN (SYN+ECE+CWR)', 'ECN-setup SYN (SYN+ECE+CWR)'], 0x52: ['ECN 협상 SYN-ACK (SYN+ACK+ECE)', 'ECN-setup SYN-ACK (SYN+ACK+ECE)'] };
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [];
    lines.forEach(function (ln) {
      var val = null, m;
      if (/^0x[0-9a-f]+$/i.test(ln) || /^0b[01]+$/i.test(ln) || /^\d+$/.test(ln)) val = Number(BigInt(/^0[xb]/i.test(ln) ? ln.toLowerCase() : ln));
      else {
        var names = ln.toUpperCase().split(/[\s,+|\/]+/).filter(Boolean), acc = 0, ok = true;
        if (names.length === 1 && /^[FSRPUEWN.]+$/.test(names[0]) && !F.some(function (f) { return f[0] === names[0]; })) {     // tcpdump 표기 (S., FA, PU …)
          names[0].split('').forEach(function (c) { if (c === '.') acc |= 0x10; else if (tcpdump[c]) acc |= F.filter(function (f) { return f[0] === tcpdump[c]; })[0][1]; else ok = false; });
        } else names.forEach(function (n) { var f = F.filter(function (x) { return x[0] === n; })[0]; if (f) acc |= f[1]; else ok = false; });
        val = ok ? acc : null;
      }
      if (val === null || val < 0 || val > 0x1ff) { rows.push({ cls: 'r-bad', cells: [ln, t('해석할 수 없거나 9비트(0~511)를 넘습니다', 'Unparseable or exceeds 9 bits (0–511)'), '', '', ''] }); return; }
      var set = F.filter(function (f) { return val & f[1]; }).map(function (f) { return f[0]; });
      var dump = [['FIN', 'F'], ['SYN', 'S'], ['RST', 'R'], ['PSH', 'P'], ['ACK', '.'], ['URG', 'U'], ['ECE', 'E'], ['CWR', 'W']].filter(function (x) { return val & F.filter(function (f) { return f[0] === x[0]; })[0][1]; }).map(function (x) { return x[1]; }).join('');
      rows.push([ln, set.length ? set.join(' + ') : t('(플래그 없음)', '(no flags)'), '0x' + val.toString(16).toUpperCase().padStart(3, '0') + ' = ' + val + ' = ' + val.toString(2).padStart(9, '0'), dump || '—', COMBOS[val] ? t(COMBOS[val][0], COMBOS[val][1]) : '']);
    });
    return { _status: lines.length ? t('✅ ' + lines.length + '개 처리', '✅ Processed ' + lines.length) : '',
      table: { head: [['입력', 'Input'], ['설정된 플래그', 'Flags set'], ['값 (16진·10진·2진)', 'Value (hex · dec · bin)'], ['tcpdump 표기', 'tcpdump notation'], ['의미', 'Meaning']], rows: rows },
      ref: { head: [['플래그', 'Flag'], ['비트 값', 'Bit'], ['의미', 'Meaning']], rows: F.map(function (f) { return [f[0], '0x' + f[1].toString(16).toUpperCase().padStart(3, '0') + ' (' + f[1] + ')', t(f[2][0], f[2][1])]; }) } };
  }
});
