TK.tool('json-validator', {
  sampleExpectError: true,
  inputs: [{ id: 'in', label: ['JSON 입력', 'JSON input'], placeholder: ['검사할 JSON을 붙여넣으세요', 'Paste the JSON to validate'], rows: 12,
    sample: '{\n  "name": "WooaDev",\n  "tools": [1, 2, 3],\n  "active": true,\n}' }],
  options: [{ id: 'dup', type: 'checkbox', label: ['중복 키 검사', 'Check duplicate keys'], default: true }],
  outputs: [
    { id: 'report', label: ['검사 결과', 'Result'], kind: 'kv' },
    { id: 'dups', label: ['중복된 키', 'Duplicate keys'], kind: 'table' },
    { id: 'ctx', label: ['오류 위치', 'Error location'], kind: 'code', download: false }
  ],
  run: function (v, o, t) {
    var r;
    try { r = TK.json.parse(v.in); }
    catch (e) {
      var lines = v.in.split('\n'), ln = e.line || 1, out = [];
      for (var i = Math.max(1, ln - 2); i <= Math.min(lines.length, ln + 1); i++) {
        out.push((i === ln ? '▶ ' : '  ') + String(i).padStart(4) + ' │ ' + lines[i - 1]);
        if (i === ln) out.push('       │ ' + ' '.repeat(Math.max(0, (e.col || 1) - 1)) + '^ ' + (e.reason || e.message));
      }
      return { _status: { ok: false, msg: t('❌ 유효하지 않은 JSON — ', '❌ Invalid JSON — ') + e.message }, ctx: out.join('\n') };
    }
    var st = TK.json.stats(r.value), dups = o.dup ? r.dups : [];
    var res = {
      report: [
        [['문법', 'Syntax'], t('유효함 ✅', 'Valid ✅')],
        [['최상위 타입', 'Root type'], TK.json.kind(r.value)],
        [['최대 깊이', 'Max depth'], st.depth], [['객체', 'Objects'], st.objects], [['배열', 'Arrays'], st.arrays], [['키', 'Keys'], st.keys],
        [['문자열 / 숫자', 'Strings / Numbers'], st.strings + ' / ' + st.numbers], [['불리언 / null', 'Booleans / null'], st.booleans + ' / ' + st.nulls],
        [['크기', 'Size'], new TextEncoder().encode(v.in).length.toLocaleString() + ' bytes']
      ]
    };
    if (dups.length) {
      res._status = { ok: 'info', msg: t('⚠️ 문법은 올바르지만 중복 키가 ' + dups.length + '개 있습니다. 뒤의 값이 앞의 값을 덮어씁니다.', '⚠️ Syntax is valid, but ' + dups.length + ' duplicate key(s) were found. Later values overwrite earlier ones.') };
      res.dups = { head: [['경로', 'Object path'], ['키', 'Key'], ['위치', 'Position']], rows: dups.map(function (d) { return [d.path, d.key, t('줄 ', 'line ') + d.line + t(', 열 ', ', col ') + d.col]; }) };
    } else res._status = t('✅ 유효한 JSON입니다.' + (o.dup ? ' 중복 키 없음.' : ''), '✅ Valid JSON.' + (o.dup ? ' No duplicate keys.' : ''));
    return res;
  }
});
