TK.tool('rot-encoder', {
  inputs: [{ id: 'in', label: ['입력', 'Input'], rows: 7, sample: 'Hello, WooaDev! Attack at dawn 2026', placeholder: ['텍스트(또는 모스 부호)를 입력하세요', 'Enter text (or Morse code)'] }],
  options: [
    { id: 'mode', type: 'select', label: ['방식', 'Cipher'], choices: [['rot13', 'ROT13'], ['rot47', 'ROT47'], ['rot5', ['ROT5 (숫자만)', 'ROT5 (digits only)']], ['rot18', 'ROT18 (ROT13 + ROT5)'], ['caesar', ['시저 암호 (이동값 지정)', 'Caesar cipher (custom shift)']], ['atbash', 'Atbash'], ['morse', ['모스 부호', 'Morse code']]], default: 'rot13' },
    { id: 'shift', type: 'number', label: ['이동값 (1~25)', 'Shift (1–25)'], default: 3, min: 1, max: 25, show: function (o) { return o.mode === 'caesar'; } },
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['enc', ['암호화 / 인코딩', 'Encrypt / Encode']], ['dec', ['복호화 / 디코딩', 'Decrypt / Decode']]], default: 'enc', show: function (o) { return o.mode === 'caesar' || o.mode === 'morse'; } },
    { id: 'brute', type: 'checkbox', label: ['25가지 이동값 전부 보기', 'Try all 25 shifts'], default: false, show: function (o) { return o.mode === 'caesar'; } }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['모든 이동값', 'All shifts'], kind: 'table' }],
  swap: { from: 'out', to: 'in', label: ['결과를 입력으로', 'Use result as input'] },
  run: function (v, o, t) {
    var s = v.in;
    function shiftLetters(str, n) {
      return str.replace(/[A-Za-z]/g, function (c) { var b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + n + 26) % 26 + b); });
    }
    function rot5(str) { return str.replace(/[0-9]/g, function (c) { return String((Number(c) + 5) % 10); }); }
    function rot47(str) { return str.replace(/[!-~]/g, function (c) { return String.fromCharCode(33 + (c.charCodeAt(0) - 33 + 47) % 94); }); }
    var MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.' };
    var REV = {}; Object.keys(MORSE).forEach(function (k) { REV[MORSE[k]] = k; });
    var out, note = '';
    switch (o.mode) {
      case 'rot13': out = shiftLetters(s, 13); break;
      case 'rot47': out = rot47(s); break;
      case 'rot5': out = rot5(s); break;
      case 'rot18': out = rot5(shiftLetters(s, 13)); break;
      case 'atbash': out = s.replace(/[A-Za-z]/g, function (c) { var b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); }); break;
      case 'caesar': {
        var n = ((Math.round(o.shift) % 26) + 26) % 26;
        out = shiftLetters(s, o.dir === 'dec' ? -n : n);
        if (o.brute) {
          var rows = [];
          for (var k = 1; k <= 25; k++) rows.push([k, shiftLetters(s, -k)]);
          return { _status: t('🔎 입력을 복호화했을 때 가능한 25가지 결과입니다 (이동값 k = 암호화 때 쓴 값)', '🔎 All 25 possible decryptions (k = the shift used when encrypting)'), out: out, table: { head: [['이동값 k', 'Shift k'], ['복호화 결과', 'Decrypted']], rows: rows } };
        }
        break;
      }
      case 'morse': {
        if (o.dir === 'enc') {
          var miss = 0;
          out = s.toUpperCase().split(/\r?\n/).map(function (line) {
            return line.split(/\s+/).filter(Boolean).map(function (w) {
              return Array.from(w).map(function (c) { if (MORSE[c]) return MORSE[c]; miss++; return '?'; }).join(' ');
            }).join(' / ');
          }).join('\n');
          if (miss) note = t('모스 부호에 없는 문자 ' + miss + '개는 ?로 표시했습니다', miss + ' character(s) without a Morse code are shown as ?');
        } else {
          var unk = 0;
          out = s.split(/\r?\n/).map(function (line) {
            return line.trim().split(/\s*(?:\/|\||\s{3,})\s*/).map(function (w) {
              return w.split(/\s+/).filter(Boolean).map(function (c) { var d = c.replace(/[_–—−]/g, '-').replace(/[•·]/g, '.'); if (REV[d]) return REV[d]; unk++; return '?'; }).join('');
            }).join(' ');
          }).join('\n');
          if (unk) note = t('해석할 수 없는 부호 ' + unk + '개는 ?로 표시했습니다', unk + ' unrecognized code(s) shown as ?');
        }
        break;
      }
    }
    return { _status: note ? { ok: 'info', msg: '⚠️ ' + note } : t('✅ 변환 완료', '✅ Converted'), out: out };
  }
});
