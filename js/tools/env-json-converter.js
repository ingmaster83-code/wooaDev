TK.tool('env-json-converter', {
  inputs: [{ id: 'in', label: ['입력', 'Input'], rows: 13, sample: '# database\nDB_HOST=localhost\nDB_PORT=5432\nDEBUG=true\nAPI_KEY="abc def"\nEMPTY=' }],
  options: [
    { id: 'mode', type: 'select', label: ['방향', 'Direction'], choices: [['e2j', ['.env → JSON', '.env → JSON']], ['j2e', ['JSON → .env', 'JSON → .env']]], default: 'e2j' },
    { id: 'infer', type: 'checkbox', label: ['숫자·불리언 자동 변환', 'Convert numbers & booleans'], default: true, show: function (o) { return o.mode === 'e2j'; } },
    { id: 'nest', type: 'checkbox', label: ['__ 로 중첩 객체 만들기', 'Nest keys on __'], default: false, show: function (o) { return o.mode === 'e2j'; } },
    { id: 'upper', type: 'checkbox', label: ['키를 대문자 SNAKE_CASE로', 'Uppercase SNAKE_CASE keys'], default: true, show: function (o) { return o.mode === 'j2e'; } },
    { id: 'sep', type: 'text', label: ['중첩 키 구분자', 'Nested key separator'], default: '_', show: function (o) { return o.mode === 'j2e'; } },
    { id: 'always', type: 'checkbox', label: ['값을 항상 따옴표로', 'Always quote values'], default: false, show: function (o) { return o.mode === 'j2e'; } },
    { id: 'exp', type: 'checkbox', label: ['export 붙이기', 'Prefix with export'], default: false, show: function (o) { return o.mode === 'j2e'; } },
    { id: 'indent', type: 'select', label: ['JSON 들여쓰기', 'JSON indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['0', ['압축', 'Minified']]], default: '2', show: function (o) { return o.mode === 'e2j'; } }
  ],
  outputs: [{ id: 'out', label: ['변환 결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['경고', 'Warnings'], kind: 'list' }],
  swap: { from: 'out', to: 'in', set: { mode: 'j2e' }, label: ['결과를 입력으로 (역변환)', 'Use result as input (reverse)'] },
  run: function (v, o, t) {
    var J = TK.json, E = TK.env;
    if (o.mode === 'e2j') {
      var r = E.parse(v.in), obj = {};
      r.vars.forEach(function (x) { J.setProp(obj, x.key, o.infer ? TK.config.infer(x.value) : x.value); });
      var res = obj;
      if (o.nest) {
        var flat = {}; r.vars.forEach(function (x) { flat[x.key] = o.infer ? TK.config.infer(x.value) : x.value; });
        var nested = {};
        Object.keys(flat).forEach(function (k) {
          var parts = k.split('__').map(function (p) { return p.toLowerCase(); }), cur = nested;
          parts.forEach(function (p, i) {
            if (i === parts.length - 1) J.setProp(cur, p, flat[k]);
            else { if (cur[p] === null || typeof cur[p] !== 'object') J.setProp(cur, p, {}); cur = cur[p]; }
          });
        });
        res = nested;
      }
      return { _status: t('✅ 변수 ' + r.vars.length + '개를 변환했습니다', '✅ Converted ' + r.vars.length + ' variable(s)'), out: J.fmt(res, o.indent), issues: r.issues.map(function (x) { return t('줄 ', 'line ') + x.line + ': ' + x.msg; }) };
    }
    var data = J.parseValue(v.in);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error(t('.env로 만들려면 최상위가 객체여야 합니다', 'The top level must be an object to convert to .env'));
    var sep = o.sep === '' ? '_' : o.sep, pairs = [], warn = [];
    var snakeUp = function (p) { return String(p).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase(); };
    (function rec(x, parts) {
      var name = function () { return parts.map(function (p) { return o.upper ? snakeUp(p) : p; }).join(sep).replace(/^(\d)/, '_$1'); };
      if (x !== null && typeof x === 'object') {
        if (Array.isArray(x)) { pairs.push([name(), JSON.stringify(x)]); warn.push(t('배열은 JSON 문자열로 저장했습니다: ' + name(), 'Array stored as a JSON string: ' + name())); return; }
        Object.keys(x).forEach(function (k) { rec(x[k], parts.concat([k])); });
      } else pairs.push([name(), x === null ? '' : String(x)]);
    })(data, []);
    return { _status: t('✅ 변수 ' + pairs.length + '개로 변환했습니다', '✅ Converted to ' + pairs.length + ' variable(s)'), out: E.stringify(pairs, { exported: o.exp, always: o.always }), issues: warn };
  }
});
