TK.tool('config-converter', {
  inputs: [{ id: 'in', label: ['입력', 'Input'], rows: 14, sample: '; server settings\nhost = example.com\nport = 8080\ndebug = true\n\n[database]\nuser = admin\npassword = "p@ss word"\nhosts[] = db1\nhosts[] = db2\n\n[database.pool]\nmax = 10' }],
  options: [
    { id: 'fmt', type: 'select', label: ['설정 형식', 'Config format'], choices: [['ini', 'INI'], ['properties', 'Java .properties'], ['plist', 'Apple plist (XML)']], default: 'ini' },
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['to', ['설정 → JSON', 'Config → JSON']], ['from', ['JSON → 설정', 'JSON → Config']]], default: 'to' },
    { id: 'infer', type: 'checkbox', label: ['숫자·불리언 자동 변환', 'Convert numbers & booleans'], default: true, show: function (o) { return o.dir === 'to' && o.fmt === 'ini'; } },
    { id: 'nested', type: 'checkbox', label: ['점(.) 표기를 중첩 객체로', 'Treat dots as nesting'], default: true, show: function (o) { return o.dir === 'to' && o.fmt !== 'plist'; } },
    { id: 'indent', type: 'select', label: ['JSON 들여쓰기', 'JSON indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['0', ['압축', 'Minified']]], default: '2', show: function (o) { return o.dir === 'to'; } }
  ],
  outputs: [{ id: 'out', label: ['변환 결과', 'Result'], kind: 'code', ext: 'txt' }],
  swap: { from: 'out', to: 'in', set: { dir: 'from' }, label: ['결과를 입력으로 (역변환)', 'Use result as input (reverse)'] },
  run: function (v, o, t) {
    var C = TK.config;
    if (o.dir === 'to') {
      var data = C.parse(o.fmt, v.in, { infer: o.infer, nested: o.nested });
      var n = TK.json.stats(data);
      return { _status: t('✅ JSON으로 변환했습니다 — 키 ' + n.keys + '개', '✅ Converted to JSON — ' + n.keys + ' keys'), out: TK.json.fmt(data, o.indent) };
    }
    var obj = TK.json.parseValue(v.in), out;
    if (o.fmt === 'ini') out = C.stringifyIni(obj);
    else if (o.fmt === 'properties') out = C.stringifyProps(obj);
    else { out = C.stringifyPlist(obj); }
    return { _status: o.fmt === 'plist' && C.lastPlistWarn ? { ok: 'info', msg: t('⚠️ plist에는 null이 없어 빈 문자열로 바꿨습니다', '⚠️ plist has no null; empty strings were used instead') } : t('✅ 변환 완료', '✅ Converted'), out: out };
  }
});
