TK.tool('yaml-diff', {
  inputs: [
    { id: 'a', label: ['원본 YAML (A)', 'Original YAML (A)'], rows: 14, sample: 'name: api\nreplicas: 2\nimage: app:1.0\nenv:\n  - name: MODE\n    value: dev\nlabels:\n  tier: backend' },
    { id: 'b', label: ['비교할 YAML (B)', 'Changed YAML (B)'], rows: 14, sample: 'name: api\nreplicas: 3\nimage: app:1.1\nenv:\n  - name: MODE\n    value: prod\nlabels:\n  tier: backend\n  team: core' }
  ],
  options: [{ id: 'unordered', type: 'checkbox', label: ['배열 순서 무시', 'Ignore array order'], default: false }],
  outputs: [{ id: 'table', label: ['변경 사항', 'Changes'], kind: 'table' }],
  run: function (v, o, t) {
    function load(txt, tag) {
      var d;
      try { d = TK.config.parseYaml(txt); } catch (e) { throw new Error(tag + ': ' + e.message); }
      return JSON.parse(JSON.stringify(d === undefined ? null : d, function (k, val) { return val instanceof Date ? val.toISOString() : val; }));
    }
    var A = load(v.a, 'A'), B = load(v.b, 'B');
    var d = TK.json.diff(A, B, { unordered: o.unordered });
    return {
      _status: d.length ? { ok: 'info', msg: '🔍 ' + TK.json.diffSummary(d) } : t('✅ 두 YAML의 내용이 같습니다 (들여쓰기·주석·키 순서 차이는 무시)', '✅ Both YAML documents are equivalent (indentation, comments and key order ignored)'),
      table: TK.json.diffTable(d, { a: t('이전(A)', 'Before (A)'), b: t('이후(B)', 'After (B)') })
    };
  }
});
