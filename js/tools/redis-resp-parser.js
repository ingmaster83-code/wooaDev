TK.tool('redis-resp-parser', {
  inputs: [{ id: 'in', label: ['RESP 데이터 (또는 명령어)', 'RESP data (or a command)'], rows: 8, sample: '*3\r\n$3\r\nSET\r\n$5\r\nhello\r\n$5\r\nWooa!\r\n:1000\r\n+OK\r\n-ERR unknown command\r\n$-1\r\n*2\r\n$3\r\nfoo\r\n:42\r\n' }],
  options: [
    { id: 'dir', type: 'select', label: ['동작', 'Action'], choices: [['parse', ['RESP 해석', 'Parse RESP']], ['build', ['명령어 → RESP 만들기', 'Build RESP from a command']]], default: 'parse' },
    { id: 'hex', type: 'checkbox', label: ['입력이 16진수 바이트', 'Input is hex bytes'], default: false, show: function (o) { return o.dir === 'parse'; } }
  ],
  outputs: [{ id: 'table', label: ['구조 (바이트 오프셋)', 'Structure (byte offsets)'], kind: 'table' }, { id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var N = TK.binin, issues = [], src = String(v['in'] || '');
    if (!src.trim()) throw new Error(t('내용을 입력하세요', 'Enter some input'));
    function esc(s) { return s.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n'); }
    if (o.dir === 'build') {
      var args = [], cur = '', q = null, has = false, line = src.replace(/\r?\n[\s\S]*$/, '');
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (q) { if (ch === q) q = null; else if (ch === '\\' && q === '"' && i + 1 < line.length) { var nx = line[++i]; cur += nx === 'n' ? '\n' : nx === 'r' ? '\r' : nx === 't' ? '\t' : nx; } else cur += ch; }
        else if (ch === '"' || ch === '\'') { q = ch; has = true; }
        else if (/\s/.test(ch)) { if (cur !== '' || has) { args.push(cur); cur = ''; has = false; } }
        else cur += ch;
      }
      if (q) throw new Error(t('따옴표가 닫히지 않았습니다', 'Unterminated quote'));
      if (cur !== '' || has) args.push(cur);
      if (!args.length) throw new Error(t('명령어를 입력하세요 (예: SET key value)', 'Enter a command (e.g. SET key value)'));
      var wire = '*' + args.length + '\r\n', rowsB = [];
      args.forEach(function (a, ix) { var len = new TextEncoder().encode(a).length; wire += '$' + len + '\r\n' + a + '\r\n'; rowsB.push([String(ix), ix === 0 ? t('명령', 'command') : t('인자', 'argument'), String(len), a]); });
      issues.push(t('명령어는 따옴표("…", \'…\')로 공백을 포함한 인자를 묶을 수 있습니다. 바이너리 안전한 Bulk String 으로 인코딩합니다', 'Quote arguments ("…", \'…\') to include spaces; every argument is encoded as a binary-safe Bulk String'));
      issues.push(t('redis-cli 없이 직접 보낼 때: printf \'' + esc(wire) + '\' | nc 호스트 6379', 'To send without redis-cli: printf \'' + esc(wire) + '\' | nc host 6379'));
      return { _status: t('✅ 인자 ' + args.length + '개 → ' + new TextEncoder().encode(wire).length + '바이트', '✅ ' + args.length + ' argument(s) → ' + new TextEncoder().encode(wire).length + ' bytes'), table: { head: [['#', '#'], ['역할', 'Role'], ['바이트 길이', 'Byte length'], ['값', 'Value']], rows: rowsB }, out: esc(wire) + '\n\n' + wire.replace(/\r\n/g, '\n').trimEnd(), issues: issues };
    }
    var bytes;
    if (o.hex) bytes = N.get({ 'in': src }, { mode: 'text', fmt: 'hex' }).bytes;
    else {
      var norm = src;
      if (/\\r\\n/.test(norm) && !/\r|\n/.test(norm.replace(/\\r\\n/g, ''))) norm = norm.replace(/\\r\\n/g, '\r\n');
      else if (/\\r\\n/.test(norm)) norm = norm.replace(/\\r\\n/g, '\r\n');
      norm = norm.replace(/\r?\n/g, '\r\n');
      bytes = new TextEncoder().encode(norm);
      if (!/\r\n/.test(src) && /\n/.test(src)) issues.push(t('줄바꿈(LF)을 RESP 의 CRLF 로 바꿔서 해석했습니다', 'LF line endings were converted to RESP CRLF'));
    }
    var rows = [], count = 0, p = 0, TYPES = { '+': 'Simple String', '-': 'Error', ':': 'Integer', '$': 'Bulk String', '*': 'Array', '_': 'Null (RESP3)', '#': 'Boolean (RESP3)', ',': 'Double (RESP3)', '(': 'Big Number (RESP3)', '!': 'Bulk Error (RESP3)', '=': 'Verbatim String (RESP3)', '%': 'Map (RESP3)', '~': 'Set (RESP3)', '>': 'Push (RESP3)', '|': 'Attribute (RESP3)' };
    var resp3 = false;
    function line() { var q2 = p; while (q2 + 1 < bytes.length && !(bytes[q2] === 13 && bytes[q2 + 1] === 10)) q2++; if (q2 + 1 >= bytes.length) throw new Error(t('오프셋 ' + p + ': 줄 끝(\\r\\n)을 찾지 못했습니다', 'Offset ' + p + ': no line terminator (\\r\\n) found')); var s = new TextDecoder().decode(bytes.subarray(p, q2)); p = q2 + 2; return s; }
    function parse(depth, label) {
      if (p >= bytes.length) throw new Error(t('데이터가 ' + p + ' 바이트 근처에서 끝났습니다 (값이 더 필요)', 'Data ends near byte ' + p + ' (another value expected)'));
      if (depth > 64) throw new Error(t('중첩이 너무 깊습니다', 'Nesting is too deep')); if (++count > 50000) throw new Error(t('요소가 너무 많습니다', 'Too many elements'));
      var start = p, ty = String.fromCharCode(bytes[p]); p++;
      var name = TYPES[ty]; if (!name) throw new Error(t('오프셋 ' + start + ': 알 수 없는 타입 문자 \'' + ty + '\' (0x' + bytes[start].toString(16) + ')', 'Offset ' + start + ': unknown type byte \'' + ty + '\' (0x' + bytes[start].toString(16) + ')'));
      if ('_#,(%~>|!='.indexOf(ty) >= 0) resp3 = true;
      var ind = new Array(depth + 1).join('  '), add = function (len, val) { if (rows.length < 400) rows.push([String(start), ind + (label || '$'), name, len == null ? '' : String(len), val]); };
      var head = line(), val;
      if (ty === '+') { add(null, JSON.stringify(head)); return head; }
      if (ty === '-') { add(null, head); return { error: head }; }
      if (ty === ':') { if (!/^[+-]?\d+$/.test(head)) throw new Error(t('오프셋 ' + start + ': 정수가 아닙니다 "' + head + '"', 'Offset ' + start + ': not an integer "' + head + '"')); add(null, head); return Number(head); }
      if (ty === '_') { add(null, 'null'); return null; }
      if (ty === '#') { add(null, head === 't' ? 'true' : head === 'f' ? 'false' : '? ' + head); return head === 't'; }
      if (ty === ',') { add(null, head); return head; }
      if (ty === '(') { add(null, head); return head; }
      if (ty === '$' || ty === '!' || ty === '=') {
        var n = parseInt(head, 10);
        if (head === '?' ) throw new Error(t('스트리밍(부정 길이) RESP3 문자열은 지원하지 않습니다', 'Streamed (indefinite) RESP3 strings are not supported'));
        if (!/^-?\d+$/.test(head)) throw new Error(t('오프셋 ' + start + ': 길이가 숫자가 아닙니다 "' + head + '"', 'Offset ' + start + ': length is not a number "' + head + '"'));
        if (n === -1) { add(-1, t('null (없음)', 'null (nil)')); return null; }
        if (n < 0) throw new Error(t('오프셋 ' + start + ': 길이 ' + n + ' 가 올바르지 않습니다', 'Offset ' + start + ': invalid length ' + n));
        if (p + n + 2 > bytes.length) throw new Error(t('오프셋 ' + start + ': Bulk String 길이 ' + n + ' 가 남은 데이터(' + Math.max(0, bytes.length - p - 2) + '바이트)보다 큽니다', 'Offset ' + start + ': bulk length ' + n + ' exceeds the remaining ' + Math.max(0, bytes.length - p - 2) + ' bytes'));
        var raw = bytes.subarray(p, p + n); p += n;
        if (!(bytes[p] === 13 && bytes[p + 1] === 10)) throw new Error(t('오프셋 ' + p + ': Bulk String 뒤에 \\r\\n 이 없습니다 (길이가 실제와 다를 수 있음)', 'Offset ' + p + ': no \\r\\n after the bulk string (the declared length may be wrong)'));
        p += 2;
        var txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(raw); val = txt; add(n, JSON.stringify(N.short(txt, 80))); } catch (e) { val = N.toHex(raw); add(n, 'h\'' + N.short(val, 48) + '\''); }
        return val;
      }
      var cnt = parseInt(head, 10);
      if (!/^-?\d+$/.test(head)) throw new Error(t('오프셋 ' + start + ': 요소 수가 숫자가 아닙니다 "' + head + '"', 'Offset ' + start + ': element count is not a number "' + head + '"'));
      if (cnt === -1) { add(-1, 'null'); return null; }
      if (cnt < 0) throw new Error(t('오프셋 ' + start + ': 요소 수 ' + cnt + ' 가 올바르지 않습니다', 'Offset ' + start + ': invalid element count ' + cnt));
      add(cnt, ty === '%' ? cnt + t(' 쌍', ' pairs') : t('요소 ', '') + cnt + t('개', ' items'));
      var total = ty === '%' || ty === '|' ? cnt * 2 : cnt, arr = [];
      for (var i = 0; i < total; i++) arr.push(parse(depth + 1, (label || '$') + (ty === '%' ? (i % 2 ? '.value' : '.key') + Math.floor(i / 2) : '[' + i + ']')));
      return arr;
    }
    var values = [];
    while (p < bytes.length) values.push(parse(0, values.length ? '$' + values.length : '$'));
    function show(x) { if (x === null) return '(nil)'; if (Array.isArray(x)) return '[' + x.map(show).join(', ') + ']'; if (x && typeof x === 'object' && 'error' in x) return '(error) ' + x.error; if (typeof x === 'string') return JSON.stringify(x); return String(x); }
    var outLines = [];
    values.forEach(function (x, ix) {
      if (Array.isArray(x) && x.length && x.every(function (e) { return typeof e === 'string'; })) outLines.push(t('명령어처럼 보임: ', 'Looks like a command: ') + x.map(function (s) { return /[\s"']/.test(s) || s === '' ? JSON.stringify(s) : s; }).join(' '));
      outLines.push((values.length > 1 ? '#' + (ix + 1) + '  ' : '') + show(x));
    });
    if (values.length > 1) issues.push(t('값 ' + values.length + '개가 이어진 스트림(파이프라인 응답 등)으로 해석했습니다', values.length + ' values were read as a stream (e.g. a pipelined reply)'));
    if (resp3) issues.push(t('RESP3 타입이 포함되어 있습니다 (HELLO 3 으로 협상한 연결)', 'RESP3 types are present (a connection negotiated with HELLO 3)'));
    if (rows.length >= 400) issues.push(t('표는 처음 400개 요소만 보여 줍니다', 'The table shows only the first 400 elements'));
    return { _status: t('✅ 해석 완료 — ' + bytes.length + '바이트, 값 ' + values.length + '개, 요소 ' + count + '개', '✅ Parsed — ' + bytes.length + ' bytes, ' + values.length + ' value(s), ' + count + ' elements'), table: { head: [['오프셋', 'Offset'], ['경로', 'Path'], ['타입', 'Type'], ['길이/수', 'Length/count'], ['값', 'Value']], rows: rows }, out: outLines.join('\n'), issues: issues };
  }
});
