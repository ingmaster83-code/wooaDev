TK.tool('bitwise-calculator', {
  inputs: [
    { id: 'a', type: 'text', label: ['값 A (10진수·0x16진수·0b2진수·0o8진수)', 'Value A (decimal, 0x hex, 0b binary, 0o octal)'], sample: '0xF0F0' },
    { id: 'b', type: 'text', label: ['값 B', 'Value B'], sample: '0b1010101010101010' }
  ],
  options: [
    { id: 'w', type: 'select', label: ['비트 폭', 'Bit width'], choices: [['8', '8'], ['16', '16'], ['32', '32'], ['64', '64']], default: '16', num: true },
    { id: 'signed', type: 'checkbox', label: ['부호 있는 정수로 해석', 'Interpret as signed'], default: false },
    { id: 'sh', type: 'number', label: ['시프트 칸 수', 'Shift amount'], default: 3, min: 0, max: 63 }
  ],
  outputs: [{ id: 'table', label: ['연산 결과', 'Results'], kind: 'table' }],
  run: function (v, o, t) {
    var w = BigInt(o.w), mask = (1n << w) - 1n, half = 1n << (w - 1n);
    function parse(s, name) {
      s = String(s).trim().replace(/[_\s]/g, '');
      if (!s) throw new Error(t(name + ' 값을 입력하세요', 'Enter value ' + name));
      var m = /^([+-]?)(0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+)$/i.exec(s);
      if (!m) throw new Error(t(name + '은(는) 정수가 아닙니다: ' + s, name + ' is not an integer: ' + s));
      var x = BigInt(m[2].toLowerCase()); if (m[1] === '-') x = -x;
      if (x > mask && !(o.signed && x < 0n)) throw new Error(t(name + '이(가) ' + o.w + '비트 범위를 넘습니다', name + ' does not fit in ' + o.w + ' bits'));
      if (o.signed && (x < -half || x >= half)) throw new Error(t(name + '이(가) 부호 있는 ' + o.w + '비트 범위를 넘습니다', name + ' is outside the signed ' + o.w + '-bit range'));
      return x & mask;
    }
    function sv(x) { x &= mask; return o.signed && x >= half ? x - (1n << w) : x; }
    var A = parse(v.a, 'A'), B = parse(v.b || '0', 'B'), sh = BigInt(Math.max(0, Math.min(Number(w) - 1, Math.round(o.sh))));
    var ops = [['A & B (AND)', A & B], ['A | B (OR)', A | B], ['A ^ B (XOR)', A ^ B], ['~(A & B) (NAND)', ~(A & B) & mask], ['~(A | B) (NOR)', ~(A | B) & mask], ['~(A ^ B) (XNOR)', ~(A ^ B) & mask], ['~A (NOT)', ~A & mask], ['~B (NOT)', ~B & mask],
      ['A << ' + sh, (A << sh) & mask], ['A >> ' + sh + t(' (논리)', ' (logical)'), A >> sh], ['A >> ' + sh + t(' (산술)', ' (arithmetic)'), (sv(A) >> sh) & mask], ['B << ' + sh, (B << sh) & mask], ['B >> ' + sh + t(' (논리)', ' (logical)'), B >> sh],
      ['A + B', (A + B) & mask], ['A − B', (A - B) & mask]];
    function bin(x) { return x.toString(2).padStart(Number(w), '0').replace(/(.{4})(?=.)/g, '$1 '); }
    var head = [['연산', 'Operation'], ['10진수', 'Decimal'], ['16진수', 'Hex'], ['2진수', 'Binary']];
    var rows = [['A', A], ['B', B]].concat(ops).map(function (r) { return [r[0], sv(r[1]).toString(), '0x' + r[1].toString(16).toUpperCase().padStart(Number(w) / 4, '0'), bin(r[1])]; });
    var c = function (x) { return x.toString(2).split('').filter(function (b) { return b === '1'; }).length; };
    return { _status: t('✅ ' + o.w + '비트 ' + (o.signed ? '부호 있는' : '부호 없는') + ' 정수 — A의 1 비트 ' + c(A) + '개, B의 1 비트 ' + c(B) + '개', '✅ ' + o.w + '-bit ' + (o.signed ? 'signed' : 'unsigned') + ' — A has ' + c(A) + ' set bits, B has ' + c(B)), table: { head: head, rows: rows } };
  }
});
