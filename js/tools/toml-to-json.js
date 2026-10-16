TK.tool('toml-to-json', {
  inputs: [{ id: 'in', label: ['TOML 입력', 'TOML input'], rows: 14, sample: '# This is a TOML document\ntitle = "TOML Example"\n\n[owner]\nname = "Kim"\ndob = 1979-05-27T07:32:00-08:00\n\n[database]\nenabled = true\nports = [ 8000, 8001, 8002 ]\ntemp_targets = { cpu = 79.5, case = 72.0 }\n\n[[servers]]\nname = "alpha"\nip = "10.0.0.1"\n\n[[servers]]\nname = "beta"\nip = "10.0.0.2"' }],
  options: [
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['tab', 'Tab'], ['0', ['압축', 'Minified']]], default: '2' },
    { id: 'sort', type: 'checkbox', label: ['키 정렬', 'Sort keys'], default: false }
  ],
  outputs: [{ id: 'out', label: ['JSON 결과', 'JSON output'], kind: 'code', ext: 'json', mime: 'application/json' }],
  swap: { from: 'out', to: 'in' },
  run: function (v, o, t) {
    var data = TK.config.parseToml(v.in);
    if (o.sort) data = TK.json.sortKeys(data);
    var n = TK.json.stats(JSON.parse(TK.config.jsonOut(data)));
    return { _status: t('✅ 변환 완료 — 키 ' + n.keys + '개, 최대 깊이 ' + n.depth, '✅ Converted — ' + n.keys + ' keys, max depth ' + n.depth), out: TK.config.jsonOut(data, o.indent) };
  }
});
