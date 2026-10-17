TK.tool('yaml-anchor-resolver', {
  inputs: [{ id: 'in', label: ['앵커·별칭·병합 키(<<)가 든 YAML', 'YAML with anchors, aliases and merge keys (<<)'], rows: 18, sample: 'defaults: &defaults\n  adapter: postgres\n  host: localhost\n  pool: 5\n\ndevelopment:\n  <<: *defaults\n  database: dev_db\n\nproduction:\n  <<: *defaults\n  host: db.example.com\n  database: prod_db\n  pool: 20\n\nreplicas: &replicas [web1, web2]\ncluster:\n  nodes: *replicas\n\nunused: &old\n  legacy: true\n' }],
  options: [{ id: 'fmt', type: 'select', label: ['출력', 'Output'], choices: [['yaml', ['펼친 YAML', 'Expanded YAML']], ['json', 'JSON']], default: 'yaml' }, { id: 'drop', type: 'checkbox', label: ['공통 정의(앵커가 붙은 최상위 키)는 출력에서 제외', 'Leave out shared definitions (top-level keys that carry an anchor)'], default: false }],
  outputs: [{ id: 'out', label: ['앵커를 모두 풀어쓴 결과', 'Fully expanded result'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['앵커·별칭 목록', 'Anchors and aliases'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var Y = TK.yamlx, issues = [], src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('YAML 을 입력하세요', 'Enter YAML'));
    var res; try { res = Y.parse(src); } catch (e) { throw new Error(t('YAML 문법 오류 (줄 ' + e.line + '): ', 'YAML syntax error (line ' + e.line + '): ') + e.message); }
    var rows = [], outs = [], total = { anchors: 0, aliases: 0, merges: 0 };
    res.docs.forEach(function (d, di) {
      if (!d.root) return;
      if (d.error) throw new Error(t('줄 ' + (d.error.line || '?') + ': ', 'Line ' + (d.error.line || '?') + ': ') + d.error.message);
      d.dups.forEach(function (x) { issues.push('⚠️ ' + t('줄 ' + x.line + ': 키 "' + x.key + '" 가 중복되었습니다', 'Line ' + x.line + ': duplicate key "' + x.key + '"')); });
      var uses = {}, defs = {};
      (function walk(n) {
        if (!n) return;
        if (n.anchor) { defs[n.anchor] = n; total.anchors++; }
        if (n.kind === 'alias') { uses[n.name] = (uses[n.name] || []).concat(n.line); total.aliases++; }
        if (n.pairs) n.pairs.forEach(function (p) { if (p.name === '<<') total.merges++; walk(p.key); walk(p.val); });
        if (n.items) n.items.forEach(walk);
      })(d.root);
      Object.keys(defs).forEach(function (a) { var u = uses[a] || []; rows.push([(res.docs.length > 1 ? '#' + (di + 1) + ' ' : '') + '&' + a, String(defs[a].anchorLine || defs[a].line), defs[a].kind === 'map' ? t('매핑', 'mapping') : defs[a].kind === 'seq' ? t('리스트', 'list') : t('값', 'scalar'), String(u.length), u.length ? u.join(', ') : '—']); if (!u.length) issues.push('ℹ️ ' + t('줄 ' + (defs[a].anchorLine || defs[a].line) + ': 앵커 &' + a + ' 를 참조하는 별칭이 없습니다', 'Line ' + (defs[a].anchorLine || defs[a].line) + ': the anchor &' + a + ' is never referenced')); });
      Object.keys(uses).forEach(function (a) { if (!defs[a]) issues.push('⛔ ' + t('줄 ' + uses[a][0] + ': 별칭 *' + a + ' 의 앵커가 정의되지 않았습니다', 'Line ' + uses[a][0] + ': the alias *' + a + ' has no anchor')); else if (uses[a].some(function (l) { return l < (defs[a].anchorLine || defs[a].line); })) issues.push('⛔ ' + t('별칭 *' + a + ' 가 앵커보다 먼저 나옵니다 (YAML 은 앞에서 뒤로 해석)', 'The alias *' + a + ' appears before its anchor (YAML resolves top to bottom)')); });
      /* 병합 충돌 안내 */
      (function walk(n) { if (!n || !n.pairs) return; var m = n.pairs.filter(function (p) { return p.name === '<<'; }); if (m.length) { var explicit = n.pairs.filter(function (p) { return p.name !== '<<'; }).map(function (p) { return p.name; }); m.forEach(function (mp) { var tv = Y.deref(mp.val); var srcs = tv && tv.kind === 'seq' ? tv.items.map(function (x) { return Y.deref(x); }) : [tv]; var ov = []; srcs.forEach(function (s) { if (s && s.pairs) s.pairs.forEach(function (p) { if (explicit.indexOf(p.name) >= 0) ov.push(p.name); }); }); if (ov.length) issues.push('ℹ️ ' + t('줄 ' + mp.key.line + ': 병합된 키 ' + ov.join(', ') + ' 는 이 매핑에서 직접 지정한 값이 우선합니다', 'Line ' + mp.key.line + ': for merged keys ' + ov.join(', ') + ' the value set directly in this mapping wins')); if (srcs.length > 1) issues.push('ℹ️ ' + t('줄 ' + mp.key.line + ': 여러 매핑을 병합할 때는 앞에 있는 매핑의 값이 우선합니다', 'Line ' + mp.key.line + ': when merging several mappings, earlier ones win')); }); } n.pairs.forEach(function (p) { walk(Y.deref(p.val)); }); if (n.items) n.items.forEach(function (x) { walk(Y.deref(x)); }); })(Y.deref(d.root));
      var js = d.js;
      if (o.drop && Y.isMap(js) && Y.deref(d.root).kind === 'map') { var keep = {}; Y.deref(d.root).pairs.forEach(function (p) { if (!(p.val && p.val.anchor)) keep[p.name] = js[p.name]; }); js = keep; }
      outs.push(o.fmt === 'json' ? JSON.stringify(js, null, 2) : (g_dump(js)));
    });
    function g_dump(x) { var J = window.jsyaml || globalThis.jsyaml; return J.dump(x, { noRefs: true, lineWidth: -1 }).replace(/\n$/, ''); }
    if (!outs.length) throw new Error(t('내용이 비어 있습니다', 'The file is empty'));
    if (!total.anchors && !total.aliases) issues.push('ℹ️ ' + t('앵커(&)와 별칭(*)이 없는 YAML 입니다. 그대로 정리해 출력했습니다', 'This YAML has no anchors (&) or aliases (*); it was only reformatted'));
    issues.push(t('결과에서는 병합 키(<<)와 별칭이 모두 실제 값으로 바뀌므로 앵커를 지원하지 않는 도구(일부 CI, kubectl 일부 필드)에 넘길 수 있습니다. 주석은 사라집니다', 'Merge keys (<<) and aliases become real values in the result, so it can go to tools that lack anchor support; comments are dropped'));
    return { _status: t('✅ 앵커 ' + total.anchors + '개 · 별칭 ' + total.aliases + '개 · 병합 ' + total.merges + '개를 풀었습니다', '✅ Resolved ' + total.anchors + ' anchor(s), ' + total.aliases + ' alias(es), ' + total.merges + ' merge(s)'), out: outs.join('\n---\n'), table: { head: [['앵커', 'Anchor'], ['정의 줄', 'Defined at'], ['종류', 'Kind'], ['참조 수', 'Uses'], ['참조 줄', 'Used at']], rows: rows }, issues: issues };
  }
});
