TK.tool('integer-representation', {
  inputs: [{ id: 'in', label: ['정수 또는 이진수 (한 줄에 하나)', 'Integers or bit strings (one per line)'], rows: 6, placeholder: ['-42, 255, 0b11010110, 0xFFD6', '-42, 255, 0b11010110, 0xFFD6'], sample: '-42\n127\n-128\n0b11010110\n0xFFD6' }],
  options: [
    { id: 'w', type: 'select', label: ['비트 폭', 'Bit width'], choices: [['4', '4'], ['8', '8'], ['16', '16'], ['32', '32'], ['64', '64']], default: '8', num: true },
    { id: 'bare', type: 'select', label: ['0b/0x 없는 이진 문자열(0과 1만)', 'Bare 0/1 strings are'], choices: [['dec', ['10진수 숫자로', 'decimal numbers']], ['bin', ['이진수 비트열로', 'bit patterns']]], default: 'dec' }
  ],
  outputs: [{ id: 'table', label: ['표현 방식별 결과', 'Representations'], kind: 'table' }],
  run: function (v, o, t) {
    var w = BigInt(o.w), W = Number(w), mask = (1n << w) - 1n, half = 1n << (w - 1n);
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [];
    function grp(s) { return s.replace(/(.{4})(?=.)/g, '$1 '); }
    lines.forEach(function (ln) {
      var s = ln.replace(/[_\s]/g, ''), m = /^([+-]?)(0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+)$/i.exec(s), val, bitsPattern = false, bits;
      if (!m) { rows.push({ cls: 'r-bad', cells: [ln, t('정수가 아닙니다', 'Not an integer'), '', '', '', '', ''] }); return; }
      var body = m[2].toLowerCase();
      if (/^0[xbo]/.test(body)) { bitsPattern = true; val = BigInt(body); if (val > mask) { rows.push({ cls: 'r-bad', cells: [ln, t(o.w + '비트를 넘는 비트열', 'Exceeds ' + o.w + ' bits'), '', '', '', '', ''] }); return; } }
      else if (o.bare === 'bin' && /^[01]+$/.test(body) && m[1] === '') { bitsPattern = true; val = BigInt('0b' + body); if (val > mask) { rows.push({ cls: 'r-bad', cells: [ln, t(o.w + '비트를 넘는 비트열', 'Exceeds ' + o.w + ' bits'), '', '', '', '', ''] }); return; } }
      else { val = BigInt(body); if (m[1] === '-') val = -val; }
      var signedVal, twos;
      if (bitsPattern) { twos = val; signedVal = twos >= half ? twos - (1n << w) : twos; }
      else {
        if (val < -half || val >= (1n << w)) { rows.push({ cls: 'r-bad', cells: [ln, t(o.w + '비트 범위를 넘습니다 (' + (-half) + ' ~ ' + ((1n << w) - 1n) + ')', 'Outside the ' + o.w + '-bit range (' + (-half) + ' to ' + ((1n << w) - 1n) + ')'), '', '', '', '', ''] }); return; }
        signedVal = val >= half ? val - (1n << w) : val; twos = val & mask;
      }
      var neg = signedVal < 0n, ones = neg ? (~(-signedVal)) & mask : twos, noOnes = signedVal === -half;
      var signMag = neg ? ((1n << (w - 1n)) | (-signedVal)) : signedVal;
      rows.push([ln, signedVal.toString() + (twos !== (signedVal & mask) ? '' : '') + (signedVal >= 0n && twos >= half ? '' : ''), grp(twos.toString(2).padStart(W, '0')), '0x' + twos.toString(16).toUpperCase().padStart(W / 4, '0'), noOnes ? t('표현 불가', 'n/a') : grp(ones.toString(2).padStart(W, '0')),
        signedVal === -half ? t('표현 불가', 'n/a') : grp(signMag.toString(2).padStart(W, '0')), twos.toString()]);
    });
    return { _status: lines.length ? t('✅ ' + o.w + '비트 — 부호 있는 범위 ' + (-half) + ' ~ ' + (half - 1n) + ', 부호 없는 범위 0 ~ ' + mask, '✅ ' + o.w + '-bit — signed range ' + (-half) + ' to ' + (half - 1n) + ', unsigned 0 to ' + mask) : '',
      table: { head: [['입력', 'Input'], ['부호 있는 값', 'Signed value'], ['2의 보수 (2진)', "Two's complement"], ['16진수', 'Hex'], ['1의 보수', "One's complement"], ['부호-크기', 'Sign-magnitude'], ['부호 없는 해석', 'Unsigned']], rows: rows } };
  }
});
