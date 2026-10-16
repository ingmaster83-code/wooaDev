TK.tool('ieee754-converter', {
  inputs: [{ id: 'in', label: ['숫자 또는 16진수 비트열 (한 줄에 하나)', 'Numbers or hex bit patterns (one per line)'], rows: 6, placeholder: ['0.1, -3.5e10, 0x40490FDB, NaN, Infinity', '0.1, -3.5e10, 0x40490FDB, NaN, Infinity'], sample: '0.1\n-3.14159\n1e-320\n0x40490FDB\nInfinity\nNaN' }],
  options: [
    { id: 'p', type: 'select', label: ['정밀도', 'Precision'], choices: [['32', ['단정밀도 float32', 'Single (float32)']], ['64', ['배정밀도 float64', 'Double (float64)']], ['16', ['반정밀도 float16', 'Half (float16)']]], default: '32' },
    { id: 'hexmode', type: 'select', label: ['0x 값 해석', '0x values are'], choices: [['bits', ['비트 패턴(부동소수점으로 해석)', 'bit patterns (decoded as float)']], ['num', ['일반 정수', 'plain integers']]], default: 'bits' }
  ],
  sampleOptions: { p: '32' },
  outputs: [{ id: 'table', label: ['변환 결과', 'Conversion'], kind: 'table' }],
  run: function (v, o, t) {
    var P = { 16: { e: 5, m: 10, bias: 15 }, 32: { e: 8, m: 23, bias: 127 }, 64: { e: 11, m: 52, bias: 1023 } }[o.p], total = Number(o.p);
    function toBits(x) {                 // Number → BigInt 비트열
      var dv = new DataView(new ArrayBuffer(8));
      if (total === 64) { dv.setFloat64(0, x); return dv.getBigUint64(0); }
      if (total === 32) { dv.setFloat32(0, x); return BigInt(dv.getUint32(0)); }
      // float16 직접 변환
      var sign = (x < 0 || Object.is(x, -0)) ? 1 : 0, ax = Math.abs(x), e, m;
      if (Number.isNaN(x)) return 0x7e00n;
      if (ax === Infinity) return BigInt((sign << 15) | 0x7c00);
      if (ax === 0) return BigInt(sign << 15);
      e = Math.floor(Math.log2(ax));
      if (e < -14) { m = Math.round(ax / Math.pow(2, -24)); if (m >= 1024) { return BigInt((sign << 15) | (1 << 10)); } return BigInt((sign << 15) | m); }
      m = Math.round((ax / Math.pow(2, e) - 1) * 1024); if (m === 1024) { m = 0; e++; }
      if (e > 15) return BigInt((sign << 15) | 0x7c00);
      return BigInt((sign << 15) | ((e + 15) << 10) | m);
    }
    function fromBits(b) {
      var s = Number((b >> BigInt(total - 1)) & 1n), ex = Number((b >> BigInt(P.m)) & ((1n << BigInt(P.e)) - 1n)), mant = b & ((1n << BigInt(P.m)) - 1n), sg = s ? -1 : 1, emax = (1 << P.e) - 1;
      if (ex === emax) return mant === 0n ? sg * Infinity : NaN;
      var frac = Number(mant) / Math.pow(2, P.m);
      return ex === 0 ? sg * frac * Math.pow(2, 1 - P.bias) : sg * (1 + frac) * Math.pow(2, ex - P.bias);
    }
    function round(x) { return total === 64 ? x : total === 32 ? Math.fround(x) : fromBits(toBits(x)); }
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [];
    lines.forEach(function (ln) {
      var bits, isBits = false, x;
      if (/^0x[0-9a-f]+$/i.test(ln) && o.hexmode === 'bits') {
        bits = BigInt(ln); if (bits >= (1n << BigInt(total))) { rows.push({ cls: 'r-bad', cells: [ln, t(total + '비트를 넘는 값', 'More than ' + total + ' bits'), '', '', '', ''] }); return; }
        isBits = true; x = fromBits(bits);
      } else {
        var s = ln.replace(/_/g, '').toLowerCase();
        if (s === 'nan') x = NaN; else if (/^[+]?(inf|infinity)$/.test(s)) x = Infinity; else if (s === '-inf' || s === '-infinity') x = -Infinity;
        else if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s) || /^0x[0-9a-f]+$/.test(s)) x = Number(s); else { rows.push({ cls: 'r-bad', cells: [ln, t('숫자가 아닙니다', 'Not a number'), '', '', '', ''] }); return; }
        bits = toBits(x);
      }
      var sign = Number((bits >> BigInt(total - 1)) & 1n), ex = (bits >> BigInt(P.m)) & ((1n << BigInt(P.e)) - 1n), mant = bits & ((1n << BigInt(P.m)) - 1n);
      var kind = ex === (1n << BigInt(P.e)) - 1n ? (mant === 0n ? 'Infinity' : (mant >> BigInt(P.m - 1) ? 'NaN (quiet)' : 'NaN (signaling)')) : ex === 0n ? (mant === 0n ? t('0', 'zero') : t('비정규(subnormal)', 'subnormal')) : t('정규', 'normal');
      var stored = round(x), exact = isBits ? stored : (Number.isNaN(x) ? 'NaN' : stored);
      rows.push([ln, Number.isNaN(stored) ? 'NaN' : String(stored) + (!isBits && stored !== x && Number.isFinite(x) ? t('  (입력과 오차 있음)', '  (rounded)') : ''), '0x' + bits.toString(16).toUpperCase().padStart(total / 4, '0'),
        sign + ' | ' + ex.toString(2).padStart(P.e, '0') + ' | ' + mant.toString(2).padStart(P.m, '0'), kind + ' · exp ' + (ex === 0n ? 1 - P.bias : Number(ex) - P.bias), isBits || Number.isNaN(x) || !Number.isFinite(x) ? '' : (Math.abs(Number(stored) - x) === 0 ? '0' : Math.abs(Number(stored) - x).toExponential(3))]);
    });
    return { _status: lines.length ? t('✅ ' + o.p + '비트 IEEE 754 — 부호 1 / 지수 ' + P.e + ' / 가수 ' + P.m + '비트', '✅ IEEE 754 binary' + o.p + ' — 1 sign / ' + P.e + ' exponent / ' + P.m + ' fraction bits') : '',
      table: { head: [['입력', 'Input'], ['저장되는 값', 'Stored value'], ['16진수', 'Hex'], ['부호 | 지수 | 가수', 'Sign | Exponent | Fraction'], ['분류', 'Class'], ['절대 오차', 'Abs. error']], rows: rows } };
  }
});
