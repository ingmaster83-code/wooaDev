TK.tool('config-diff', {
  inputs: [
    { id: 'a', label: ['원본 설정 (A)', 'Original config (A)'], rows: 13, sample: '[server]\nhost = "localhost"\nport = 8080\n\n[database]\nurl = "postgres://localhost/app"\npool = 5\n\n[features]\nbeta = false' },
    { id: 'b', label: ['비교할 설정 (B)', 'Changed config (B)'], rows: 13, sample: '[database]\npool = 10\nurl = "postgres://localhost/app"\n\n[server]\nport = 8080\nhost = "0.0.0.0"\n\n[logging]\nlevel = "info"' }
  ],
  options: [
    { id: 'fmt', type: 'select', label: ['형식', 'Format'], choices: [['toml', 'TOML'], ['ini', 'INI'], ['properties', 'Java .properties'], ['yaml', 'YAML'], ['json', 'JSON'], ['env', '.env']], default: 'toml' },
    { id: 'infer', type: 'checkbox', label: ['값 타입 맞춰 비교 ("8080" = 8080)', 'Coerce types ("8080" = 8080)'], default: true, show: function (o) { return o.fmt === 'ini' || o.fmt === 'properties' || o.fmt === 'env'; } },
    { id: 'unordered', type: 'checkbox', label: ['배열 순서 무시', 'Ignore array order'], default: false }
  ],
  outputs: [{ id: 'table', label: ['변경 사항 (키 순서는 무시)', 'Changes (key order ignored)'], kind: 'table' }],
  run: function (v, o, t) {
    var C = TK.config;
    function load(txt, tag) {
      var d;
      try { d = C.parse(o.fmt, txt, { infer: o.infer, nested: o.fmt === 'properties' }); } catch (e) { throw new Error(tag + ': ' + e.message); }
      d = JSON.parse(C.jsonOut(d === undefined ? null : d));
      return (o.infer && (o.fmt === 'properties')) ? C.inferDeep(d) : d;
    }
    var A = load(v.a, 'A'), B = load(v.b, 'B');
    var d = TK.json.diff(A, B, { unordered: o.unordered });
    return {
      _status: d.length ? { ok: 'info', msg: '🔍 ' + TK.json.diffSummary(d) } : t('✅ 두 설정이 같습니다 (키 순서·공백·주석 차이는 무시)', '✅ Both configs are equivalent (key order, whitespace and comments ignored)'),
      table: TK.json.diffTable(d, { a: t('이전(A)', 'Before (A)'), b: t('이후(B)', 'After (B)') })
    };
  }
});
