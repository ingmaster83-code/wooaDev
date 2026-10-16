TK.tool('uri-template-tester', {
  inputs: [
    { id: 'tpl', type: 'text', label: ['URI 템플릿 (RFC 6570)', 'URI template (RFC 6570)'], sample: 'https://api.example.com/users/{id}/posts{?page,limit,tags*}{#section}', placeholder: ['https://example.com/{path}{?q,lang}', 'https://example.com/{path}{?q,lang}'] },
    { id: 'vars', label: ['변수 (JSON)', 'Variables (JSON)'], rows: 8, sample: '{\n  "id": "42",\n  "page": 2,\n  "limit": 20,\n  "tags": ["a b", "c&d"],\n  "section": "top 10"\n}' }
  ],
  options: [],
  outputs: [{ id: 'out', label: ['확장된 URI', 'Expanded URI'], kind: 'code', ext: 'txt', download: false }, { id: 'table', label: ['표현식 분석', 'Expressions'], kind: 'table' }],
  run: function (v, o, t) {
    var vars = TK.json.parseValue(v.vars || '{}');
    if (vars === null || typeof vars !== 'object' || Array.isArray(vars)) throw new Error(t('변수는 JSON 객체여야 합니다', 'Variables must be a JSON object'));
    var OPS = { '': { first: '', sep: ',', named: false, ifemp: '', allow: 'U' }, '+': { first: '', sep: ',', named: false, ifemp: '', allow: 'UR' }, '#': { first: '#', sep: ',', named: false, ifemp: '', allow: 'UR' }, '.': { first: '.', sep: '.', named: false, ifemp: '', allow: 'U' }, '/': { first: '/', sep: '/', named: false, ifemp: '', allow: 'U' }, ';': { first: ';', sep: ';', named: true, ifemp: '', allow: 'U' }, '?': { first: '?', sep: '&', named: true, ifemp: '=', allow: 'U' }, '&': { first: '&', sep: '&', named: true, ifemp: '=', allow: 'U' } };
    function enc(s, allow) {
      s = String(s);
      if (allow === 'UR') return s.replace(/%[0-9A-Fa-f]{2}|[^A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=]/g, function (m) { return m.length === 3 && m[0] === '%' ? m : encodeURIComponent(m).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); });
      return encodeURIComponent(s).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
    }
    var rows = [], undefinedVars = [];
    var out = String(v.tpl).replace(/\{([^{}]*)\}/g, function (all, expr) {
      var op = '', body = expr;
      if (/^[+#.\/;?&]/.test(expr)) { op = expr[0]; body = expr.slice(1); } else if (/^[=,!@|]/.test(expr)) throw new Error(t('예약된 연산자입니다: ' + expr[0], 'Reserved operator: ' + expr[0]));
      var spec = OPS[op], parts = [];
      body.split(',').forEach(function (vs) {
        var m = /^([A-Za-z0-9_%.]+)(\*|:(\d{1,4}))?$/.exec(vs.trim());
        if (!m) throw new Error(t('변수 이름이 올바르지 않습니다: ' + vs, 'Invalid variable name: ' + vs));
        var name = m[1], explode = m[2] === '*', prefix = m[3] ? +m[3] : null, val = vars[name];
        if (val === undefined || val === null || (Array.isArray(val) && !val.length) || (typeof val === 'object' && !Array.isArray(val) && !Object.keys(val).length)) { if (val === undefined) undefinedVars.push(name); return; }
        var res;
        if (Array.isArray(val)) {
          var items = val.map(function (x) { return enc(x, spec.allow); });
          if (explode) res = spec.named ? items.map(function (x, i) { return name + (x === '' ? spec.ifemp : '=' + x); }).join(spec.sep) : items.join(spec.sep);
          else res = (spec.named ? name + (items.join(',') === '' ? spec.ifemp : '=') : '') + items.join(',');
        } else if (typeof val === 'object') {
          var keys = Object.keys(val);
          if (explode) res = keys.map(function (k) { var x = enc(val[k], spec.allow); return spec.named ? enc(k, spec.allow) + (x === '' ? spec.ifemp : '=' + x) : enc(k, spec.allow) + '=' + x; }).join(spec.sep);
          else res = (spec.named ? name + '=' : '') + keys.map(function (k) { return enc(k, spec.allow) + ',' + enc(val[k], spec.allow); }).join(',');
        } else {
          var s = String(val); if (prefix !== null) s = Array.from(s).slice(0, prefix).join('');
          var e = enc(s, spec.allow);
          res = spec.named ? name + (e === '' ? spec.ifemp : '=' + e) : e;
        }
        parts.push(res);
      });
      rows.push(['{' + expr + '}', op ? op : t('(없음)', '(none)'), body, parts.length ? (spec.first + parts.join(spec.sep)) : t('(비어 있음)', '(empty)')]);
      return parts.length ? spec.first + parts.join(spec.sep) : '';
    });
    var uniq = undefinedVars.filter(function (x, i) { return undefinedVars.indexOf(x) === i; });
    return { _status: uniq.length ? { ok: 'info', msg: t('⚠️ 값이 없는 변수는 생략됩니다: ' + uniq.join(', '), '⚠️ Undefined variables are omitted: ' + uniq.join(', ')) } : t('✅ ' + rows.length + '개 표현식 확장', '✅ Expanded ' + rows.length + ' expression(s)'), out: out,
      table: { head: [['표현식', 'Expression'], ['연산자', 'Operator'], ['변수', 'Variables'], ['확장 결과', 'Expansion']], rows: rows } };
  }
});
