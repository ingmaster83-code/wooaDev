TK.tool('json-key-extractor', {
  inputs: [
    { id: 'json', label: ['JSON 입력', 'JSON input'], rows: 12, sample: '{\n  "id": 1,\n  "name": "Kim",\n  "email": "kim@example.com",\n  "orders": [\n    { "id": 10, "total": 3200, "items": [{ "id": 1, "name": "pen" }] },\n    { "id": 11, "total": 900, "items": [] }\n  ],\n  "profile": { "id": "p-1", "email": "k@work.com" }\n}' },
    { id: 'keys', type: 'text', label: ['키 이름 (쉼표·공백으로 여러 개)', 'Key names (comma or space separated)'], sample: 'id, email', placeholder: 'id, email' }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['find', ['어디에 있든 값 찾기 (재귀)', 'Find values anywhere (recursive)']], ['pick', ['이 키만 남기기 (구조 유지)', 'Keep only these keys (keep structure)']], ['omit', ['이 키 제거하기', 'Remove these keys']], ['list', ['사용된 모든 키 목록', 'List all keys used']]], default: 'find' },
    { id: 'ci', type: 'checkbox', label: ['대소문자 무시', 'Ignore case'], default: false },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['0', ['압축', 'Minified']]], default: '2' }
  ],
  outputs: [
    { id: 'table', label: ['결과 목록', 'Results'], kind: 'table' },
    { id: 'out', label: ['JSON 결과', 'JSON result'], kind: 'code', ext: 'json', mime: 'application/json' }
  ],
  run: function (v, o, t) {
    var data = TK.json.parseValue(v.json), J = TK.json;
    var names = String(v.keys).split(/[\s,;]+/).filter(Boolean);
    var norm = function (k) { return o.ci ? String(k).toLowerCase() : String(k); };
    var set = {}; names.forEach(function (n) { set[norm(n)] = 1; });
    var has = function (k) { return set[norm(k)] === 1; };
    if (o.mode !== 'list' && !names.length) throw new Error(t('키 이름을 한 개 이상 입력하세요', 'Enter at least one key name'));
    if (o.mode === 'list') {
      var cnt = {}, order = [], types = {};
      (function rec(x) {
        if (Array.isArray(x)) x.forEach(rec);
        else if (x && typeof x === 'object') Object.keys(x).forEach(function (k) {
          if (!cnt[k]) { cnt[k] = 0; order.push(k); types[k] = {}; }
          cnt[k]++; types[k][J.kind(x[k])] = 1; rec(x[k]);
        });
      })(data);
      order.sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); });
      return {
        _status: t('✅ 고유 키 ' + order.length + '개', '✅ ' + order.length + ' unique key(s)'),
        table: { head: [['키', 'Key'], ['등장 횟수', 'Count'], ['값 타입', 'Value types']], rows: order.map(function (k) { return [k, cnt[k], Object.keys(types[k]).join(', ')]; }) },
        out: J.fmt(order, o.indent)
      };
    }
    if (o.mode === 'find') {
      var found = [];
      (function rec(x, p) {
        if (Array.isArray(x)) x.forEach(function (c, i) { rec(c, p.concat([i])); });
        else if (x && typeof x === 'object') Object.keys(x).forEach(function (k) {
          if (has(k)) found.push({ p: p.concat([k]), k: k, v: x[k] });
          rec(x[k], p.concat([k]));
        });
      })(data, []);
      return {
        _status: found.length ? t('✅ ' + found.length + '곳에서 찾았습니다', '✅ Found in ' + found.length + ' place(s)') : { ok: 'info', msg: t('해당 키가 없습니다', 'No such key') },
        table: { head: [['경로', 'Path'], ['키', 'Key'], ['값', 'Value']], rows: found.map(function (f) { return [J.pathStr(f.p), f.k, J.brief(f.v, 100)]; }), empty: ['해당 키가 없습니다', 'No such key'] },
        out: found.length ? J.fmt(found.map(function (f) { return f.v; }), o.indent) : null
      };
    }
    // pick / omit
    var removed = 0;
    function prune(x) {
      if (Array.isArray(x)) return x.map(prune);
      if (x && typeof x === 'object') {
        var out = {};
        Object.keys(x).forEach(function (k) {
          if (o.mode === 'omit') { if (has(k)) { removed++; return; } J.setProp(out, k, prune(x[k])); }
          else {
            var sub = prune(x[k]);
            if (has(k)) J.setProp(out, k, x[k]);
            else if (sub !== undefined && sub !== null && typeof sub === 'object' && (Array.isArray(sub) ? sub.length : Object.keys(sub).length)) J.setProp(out, k, sub);
          }
        });
        return out;
      }
      return x;
    }
    var res = prune(data);
    return { _status: o.mode === 'omit' ? t('✅ 키 ' + removed + '개를 제거했습니다', '✅ Removed ' + removed + ' key(s)') : t('✅ 지정한 키만 남겼습니다', '✅ Kept only the selected keys'), out: J.fmt(res, o.indent) };
  }
});
