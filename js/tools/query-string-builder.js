TK.tool('query-string-builder', {
  inputs: [{ id: 'in', label: ['입력', 'Input'], rows: 9, sample: 'https://example.com/search?q=hello+world&tag=a&tag=b&filter[status]=open&filter[owner]=kim&ids[]=1&ids[]=2&empty=&page=2#results' }],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['parse', ['쿼리 문자열/URL 분석', 'Parse a query string / URL']], ['build', ['JSON → 쿼리 문자열', 'JSON → query string']]], default: 'parse' },
    { id: 'nested', type: 'checkbox', label: ['a[b]=1 / a[]=1 를 중첩 JSON으로', 'Treat a[b]=1 / a[]=1 as nested JSON'], default: true, show: function (o) { return o.mode === 'parse'; } },
    { id: 'arr', type: 'select', label: ['배열 표기', 'Array style'], choices: [['repeat', ['반복 (a=1&a=2)', 'Repeat (a=1&a=2)']], ['bracket', ['대괄호 (a[]=1&a[]=2)', 'Brackets (a[]=1&a[]=2)']], ['index', ['인덱스 (a[0]=1&a[1]=2)', 'Indexed (a[0]=1&a[1]=2)']], ['comma', ['쉼표 (a=1,2)', 'Comma (a=1,2)']]], default: 'repeat', show: function (o) { return o.mode === 'build'; } },
    { id: 'space', type: 'select', label: ['공백 인코딩', 'Space encoding'], choices: [['pct', '%20'], ['plus', '+']], default: 'pct', show: function (o) { return o.mode === 'build'; } },
    { id: 'sort', type: 'checkbox', label: ['키 정렬', 'Sort keys'], default: false, show: function (o) { return o.mode === 'build'; } },
    { id: 'skip', type: 'checkbox', label: ['null·빈 값 제외', 'Skip null / empty values'], default: false, show: function (o) { return o.mode === 'build'; } }
  ],
  sampleOptions: { mode: 'parse' },
  outputs: [{ id: 'table', label: ['파라미터 목록', 'Parameters'], kind: 'table' }, { id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var J = TK.json;
    function dec(s) { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s; } }
    if (o.mode === 'parse') {
      var s = String(v.in).trim(), url = null, hash = '', base = '';
      var qi = s.indexOf('?'), hi = s.indexOf('#');
      if (hi >= 0) { hash = s.slice(hi); s = s.slice(0, hi); }
      if (qi >= 0 && qi < (hi >= 0 ? hi : Infinity)) { base = s.slice(0, qi); s = s.slice(qi + 1); } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^\//.test(s)) { base = s; s = ''; }
      s = s.replace(/^\?/, '');
      var pairs = s ? s.split('&').filter(function (x) { return x !== ''; }).map(function (p) { var i = p.indexOf('='); return i < 0 ? [dec(p), null, p] : [dec(p.slice(0, i)), dec(p.slice(i + 1)), p]; }) : [];
      var count = {}; pairs.forEach(function (p) { count[p[0]] = (count[p[0]] || 0) + 1; });
      var rows = pairs.map(function (p, i) { return { cls: count[p[0]] > 1 ? 'r-warn' : '', cells: [i + 1, p[0], p[1] === null ? t('(값 없음, = 없음)', '(no value, no =)') : (p[1] === '' ? t('(빈 문자열)', '(empty string)') : p[1]), p[2]] }; });
      var obj = {};
      pairs.forEach(function (p) {
        var key = p[0], val = p[1] === null ? '' : p[1];
        if (!o.nested) { if (key in obj) { if (!Array.isArray(obj[key])) obj[key] = [obj[key]]; obj[key].push(val); } else J.setProp(obj, key, val); return; }
        var path = [], m = /^([^\[\]]+)((?:\[[^\[\]]*\])*)$/.exec(key);
        if (!m) { if (key in obj) { if (!Array.isArray(obj[key])) obj[key] = [obj[key]]; obj[key].push(val); } else J.setProp(obj, key, val); return; }
        path.push(m[1]); (m[2].match(/\[[^\[\]]*\]/g) || []).forEach(function (b) { path.push(b.slice(1, -1)); });
        var cur = obj;
        for (var i = 0; i < path.length; i++) {
          var k = path[i], last = i === path.length - 1, nextIsArr = !last && (path[i + 1] === '' || /^\d+$/.test(path[i + 1]));
          if (k === '') { if (!Array.isArray(cur)) return; if (last) cur.push(val); else { var n = nextIsArr ? [] : {}; cur.push(n); cur = n; } continue; }
          if (last) { if (cur[k] === undefined) J.setProp(cur, k, val); else if (Array.isArray(cur[k])) cur[k].push(val); else cur[k] = [cur[k], val]; }
          else { if (cur[k] === undefined || typeof cur[k] !== 'object') J.setProp(cur, k, nextIsArr ? [] : {}); cur = cur[k]; }
        }
      });
      var dups = Object.keys(count).filter(function (k) { return count[k] > 1 && !(o.nested && /\[\]$/.test(k)); });
      return { _status: t('✅ 파라미터 ' + pairs.length + '개' + (base ? ' · 경로 ' + base : '') + (hash ? ' · 프래그먼트 ' + hash : '') + (dups.length ? ' · 중복 키: ' + dups.join(', ') : ''), '✅ ' + pairs.length + ' parameter(s)' + (base ? ' · path ' + base : '') + (hash ? ' · fragment ' + hash : '') + (dups.length ? ' · repeated keys: ' + dups.join(', ') : '')),
        table: { head: [['#', '#'], ['키', 'Key'], ['값 (디코딩)', 'Value (decoded)'], ['원문', 'Raw']], rows: rows }, out: J.fmt(obj, 2) };
    }
    var data = J.parseValue(v.in);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error(t('{"키": "값"} 형태의 JSON 객체를 입력하세요', 'Enter a JSON object like {"key": "value"}'));
    function enc(x) { var e = encodeURIComponent(String(x)).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); return o.space === 'plus' ? e.replace(/%20/g, '+') : e; }
    var parts = [];
    function emit(key, val) {
      if (val === null || val === undefined) { if (!o.skip) parts.push(enc(key) + '='); return; }
      if (Array.isArray(val)) {
        if (o.arr === 'comma') { parts.push(enc(key) + '=' + val.map(function (x) { return enc(x).replace(/%2C/g, '%2C'); }).join(',')); return; }
        val.forEach(function (x, i) { var k = o.arr === 'bracket' ? key + '[]' : o.arr === 'index' ? key + '[' + i + ']' : key; if (x !== null && typeof x === 'object') emit(k, x); else if (!(o.skip && (x === '' || x === null))) parts.push(enc(k) + '=' + enc(x === null ? '' : x)); });
        return;
      }
      if (typeof val === 'object') { Object.keys(o.sort ? Object.keys(val).sort().reduce(function (a, k) { a[k] = 1; return a; }, {}) : val).forEach(function (k) { emit(key + '[' + k + ']', val[k]); }); return; }
      if (o.skip && val === '') return;
      parts.push(enc(key) + '=' + enc(val));
    }
    (o.sort ? Object.keys(data).sort() : Object.keys(data)).forEach(function (k) { emit(k, data[k]); });
    var qs = parts.join('&');
    return { _status: t('✅ 파라미터 ' + parts.length + '개', '✅ ' + parts.length + ' parameter(s)'), out: qs, table: { head: [['#', '#'], ['키', 'Key'], ['값', 'Value'], ['원문', 'Raw']], rows: parts.map(function (p, i) { var q = p.split('='); return [i + 1, dec(q[0]), dec(q.slice(1).join('=')), p]; }) } };
  }
});
