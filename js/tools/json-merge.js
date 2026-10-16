TK.tool('json-merge', {
  inputs: [
    { id: 'a', label: ['기준 JSON (A)', 'Base JSON (A)'], rows: 12, sample: '{\n  "name": "app",\n  "port": 3000,\n  "db": { "host": "localhost", "user": "root" },\n  "plugins": ["auth", "log"]\n}' },
    { id: 'b', label: ['덮어쓸 JSON (B)', 'Overlay JSON (B)'], rows: 12, sample: '{\n  "port": 8080,\n  "db": { "host": "db.prod", "ssl": true },\n  "plugins": ["log", "cache"],\n  "debug": null\n}' }
  ],
  options: [
    { id: 'prio', type: 'select', label: ['충돌 시 우선', 'On conflict prefer'], choices: [['b', ['B (덮어쓰기)', 'B (overlay)']], ['a', ['A (기준 유지)', 'A (keep base)']]], default: 'b' },
    { id: 'arrays', type: 'select', label: ['배열 처리', 'Arrays'], choices: [['replace', ['우선 쪽으로 교체', 'Replace']], ['concat', ['이어 붙이기', 'Concatenate']], ['union', ['합집합(중복 제거)', 'Union (dedupe)']], ['index', ['인덱스별 병합', 'Merge by index']]], default: 'replace' },
    { id: 'nulls', type: 'checkbox', label: ['B의 null은 키 삭제 (RFC 7386)', 'null in B deletes the key (RFC 7386)'], default: false },
    { id: 'sort', type: 'checkbox', label: ['키 정렬', 'Sort keys'], default: false },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['tab', 'Tab'], ['0', ['압축', 'Minified']]], default: '2' }
  ],
  outputs: [
    { id: 'out', label: ['병합 결과', 'Merged result'], kind: 'code', ext: 'json', mime: 'application/json' },
    { id: 'conf', label: ['충돌·변경 내역', 'Conflicts & changes'], kind: 'table' }
  ],
  swap: { from: 'out', to: 'a', label: ['결과를 A로', 'Use result as A'] },
  run: function (v, o, t) {
    var A, B;
    try { A = TK.json.parseValue(v.a); } catch (e) { throw new Error('A: ' + e.message); }
    try { B = TK.json.parseValue(v.b); } catch (e) { throw new Error('B: ' + e.message); }
    var J = TK.json, conf = [], bWins = o.prio === 'b';
    function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
    function add(p, a, b, res, note) { conf.push({ cls: note ? 'r-warn' : 'r-chg', cells: [J.pathStr(p), J.brief(a, 60), J.brief(b, 60), J.brief(res, 60), note || (bWins ? 'B' : 'A')] }); }
    function merge(a, b, p) {
      if (isObj(a) && isObj(b)) {
        var out = {};
        Object.keys(a).forEach(function (k) { J.setProp(out, k, a[k]); });
        Object.keys(b).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(a, k)) {
            if (o.nulls && b[k] === null) return;
            J.setProp(out, k, b[k]);
          } else if (o.nulls && b[k] === null) { delete out[k]; add(p.concat([k]), a[k], null, undefined, t('삭제', 'deleted')); }
          else J.setProp(out, k, merge(a[k], b[k], p.concat([k])));
        });
        return out;
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        if (o.arrays === 'concat') return a.concat(b);
        if (o.arrays === 'union') { var r = a.slice(); b.forEach(function (x) { if (!r.some(function (y) { return J.eq(x, y); })) r.push(x); }); return r; }
        if (o.arrays === 'index') { var m = []; for (var i = 0; i < Math.max(a.length, b.length); i++) m.push(i >= a.length ? b[i] : i >= b.length ? a[i] : merge(a[i], b[i], p.concat([i]))); return m; }
      }
      if (J.eq(a, b)) return a;
      var res = bWins ? b : a;
      add(p, a, b, res);
      return res;
    }
    var out = merge(A, B, []);
    if (o.sort) out = J.sortKeys(out);
    return {
      _status: conf.length ? { ok: 'info', msg: t('🔀 병합 완료 — 충돌·변경 ' + conf.length + '건 (' + (bWins ? 'B' : 'A') + ' 우선)', '🔀 Merged — ' + conf.length + ' conflict(s)/change(s) (' + (bWins ? 'B' : 'A') + ' preferred)') } : t('✅ 병합 완료 — 충돌 없음', '✅ Merged — no conflicts'),
      out: J.fmt(out, o.indent),
      conf: { head: [['경로', 'Path'], ['A 값', 'A value'], ['B 값', 'B value'], ['결과', 'Result'], ['적용', 'Applied']], rows: conf, empty: ['충돌한 값이 없습니다', 'No conflicting values'] }
    };
  }
});
