TK.tool('toml-formatter', {
  sampleExpectError: false,
  inputs: [{ id: 'in', label: ['TOML 입력', 'TOML input'], rows: 14, sample: 'title="TOML Example"\n[owner]\nname =   "Kim"\n[database]\nports=[8000,8001,8002]\nenabled=true\n[servers.alpha]\nip="10.0.0.1"\n[servers.beta]\nip="10.0.0.2"' }],
  options: [{ id: 'sort', type: 'checkbox', label: ['키 정렬', 'Sort keys'], default: false }],
  outputs: [
    { id: 'out', label: ['정리된 TOML', 'Formatted TOML'], kind: 'code', ext: 'toml', mime: 'application/toml' },
    { id: 'info', label: ['검증 정보', 'Validation'], kind: 'kv' }
  ],
  swap: { from: 'out', to: 'in' },
  run: function (v, o, t) {
    var data = TK.config.parseToml(v.in);
    if (o.sort) data = TK.json.sortKeys(data);
    var out = TOML.stringify(data);
    var st = TK.json.stats(JSON.parse(TK.config.jsonOut(data)));
    var hasComments = /^\s*#/m.test(v.in);
    return {
      _status: hasComments ? { ok: 'info', msg: t('⚠️ 문법은 올바릅니다. 다만 정리 과정에서 주석은 유지되지 않습니다.', '⚠️ Valid TOML. Note: comments are not preserved when reformatting.') } : t('✅ 올바른 TOML입니다', '✅ Valid TOML'),
      out: out,
      info: [[['문법', 'Syntax'], t('유효함 ✅', 'Valid ✅')], [['키', 'Keys'], st.keys], [['테이블(객체)', 'Tables (objects)'], st.objects], [['배열', 'Arrays'], st.arrays], [['최대 깊이', 'Max depth'], st.depth]]
    };
  }
});
