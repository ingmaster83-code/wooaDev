TK.tool('json-flatten', {
  inputs: [{ id: 'in', label: ['JSON 입력', 'JSON input'], rows: 12,
    sample: '{\n  "user": {\n    "name": "Kim",\n    "emails": ["a@x.com", "b@x.com"],\n    "address": { "city": "Seoul", "geo": { "lat": 37.5, "lng": 127 } }\n  },\n  "active": true,\n  "meta": {}\n}' }],
  options: [
    { id: 'mode', type: 'select', label: ['방향', 'Direction'], choices: [['flatten', ['평탄화 (중첩 → 한 단계)', 'Flatten (nested → flat)']], ['unflatten', ['복원 (한 단계 → 중첩)', 'Unflatten (flat → nested)']]], default: 'flatten' },
    { id: 'sep', type: 'text', label: ['구분자', 'Separator'], default: '.' },
    { id: 'arr', type: 'select', label: ['배열 표기', 'Array notation'], choices: [['bracket', ['a[0].b', 'a[0].b']], ['dot', ['a.0.b', 'a.0.b']]], default: 'bracket' },
    { id: 'empty', type: 'checkbox', label: ['빈 객체·배열 유지', 'Keep empty {} / []'], default: true },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['tab', 'Tab'], ['0', ['압축', 'Minified']]], default: '2' }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'json', mime: 'application/json' }],
  swap: { from: 'out', to: 'in', set: { mode: 'unflatten' }, label: ['결과를 입력으로 (역변환)', 'Use result as input (reverse)'] },
  run: function (v, o, t) {
    var data = TK.json.parseValue(v.in), sep = o.sep === '' ? '.' : o.sep, J = TK.json;
    if (o.mode === 'flatten') {
      var flat = {}, n = 0;
      (function rec(x, p) {
        if (x !== null && typeof x === 'object') {
          var keys = Array.isArray(x) ? x.map(function (_, i) { return i; }) : Object.keys(x);
          if (!keys.length) { if (o.empty && p) { J.setProp(flat, p, Array.isArray(x) ? [] : {}); n++; } return; }
          keys.forEach(function (k) {
            var np;
            if (Array.isArray(x)) np = o.arr === 'bracket' ? p + '[' + k + ']' : (p ? p + sep + k : String(k));
            else np = p ? p + sep + k : k;
            rec(x[k], np);
          });
        } else { J.setProp(flat, p || '', x); n++; }
      })(data, '');
      return { _status: t('✅ 평탄화 완료 — 값 ' + n + '개', '✅ Flattened — ' + n + ' value(s)'), out: J.fmt(flat, o.indent) };
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error(t('복원하려면 { "a.b": 1 } 형태의 객체가 필요합니다', 'Unflatten needs an object like { "a.b": 1 }'));
    var root = { c: Object.create(null), order: [] };
    function node() { return { c: Object.create(null), order: [], leaf: undefined, has: false }; }
    root = node();
    Object.keys(data).forEach(function (key) {
      var toks = key.replace(/\[(\d+)\]/g, sep + '$1').split(sep).filter(function (x, i) { return x !== '' || i > 0; });
      if (toks[0] === '') toks.shift();
      var cur = root;
      toks.forEach(function (tk) {
        if (!cur.c[tk]) { cur.c[tk] = node(); cur.order.push(tk); }
        cur = cur.c[tk];
      });
      cur.leaf = data[key]; cur.has = true;
    });
    function build(nd) {
      if (nd.has && !nd.order.length) return nd.leaf;
      var isArr = nd.order.length && nd.order.every(function (k, i) { return /^(0|[1-9]\d*)$/.test(k); }) && nd.order.map(Number).sort(function (a, b) { return a - b; }).every(function (x, i) { return x === i; });
      if (isArr) { var a = []; nd.order.forEach(function (k) { a[Number(k)] = build(nd.c[k]); }); return a; }
      var obj = {}; nd.order.forEach(function (k) { J.setProp(obj, k, build(nd.c[k])); }); return obj;
    }
    return { _status: t('✅ 복원 완료', '✅ Unflattened'), out: J.fmt(build(root), o.indent) };
  }
});
