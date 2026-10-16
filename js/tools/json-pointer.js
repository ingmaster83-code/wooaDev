TK.tool('json-pointer', {
  inputs: [
    { id: 'json', label: ['JSON 데이터', 'JSON data'], rows: 12, sample: '{\n  "users": [\n    { "name": "Kim", "tags": ["a/b", "c~d"] },\n    { "name": "Lee" }\n  ],\n  "a/b": { "m~n": 100 },\n  "my key": true\n}' },
    { id: 'ptr', type: 'text', label: ['JSON Pointer', 'JSON Pointer'], sample: '/users/0/tags/0', placeholder: '/users/0/name' }
  ],
  options: [{ id: 'mode', type: 'select', label: ['모드', 'Mode'], choices: [['get', ['포인터로 값 찾기', 'Resolve a pointer']], ['list', ['모든 경로의 포인터 목록', 'List all pointers']]], default: 'get' }],
  outputs: [
    { id: 'info', label: ['포인터 정보', 'Pointer info'], kind: 'kv' },
    { id: 'val', label: ['값', 'Value'], kind: 'code', ext: 'json', mime: 'application/json' },
    { id: 'table', label: ['모든 포인터', 'All pointers'], kind: 'table' }
  ],
  run: function (v, o, t) {
    var data = TK.json.parseValue(v.json), J = TK.json;
    var enc = function (k) { return String(k).replace(/~/g, '~0').replace(/\//g, '~1'); };
    if (o.mode === 'list') {
      var rows = [];
      (function rec(x, p) {
        rows.push([p === '' ? '(root)' : p, J.kind(x), (x !== null && typeof x === 'object') ? (Array.isArray(x) ? '[' + x.length + ']' : '{' + Object.keys(x).length + '}') : J.brief(x, 60)]);
        if (x !== null && typeof x === 'object') (Array.isArray(x) ? x.map(function (_, i) { return i; }) : Object.keys(x)).forEach(function (k) { rec(x[k], p + '/' + enc(k)); });
      })(data, '');
      return { _status: t('✅ 포인터 ' + rows.length + '개', '✅ ' + rows.length + ' pointers'), table: { head: [['포인터', 'Pointer'], ['타입', 'Type'], ['값', 'Value']], rows: rows } };
    }
    var raw = String(v.ptr).trim();
    if (raw[0] === '#') { try { raw = decodeURIComponent(raw.slice(1)); } catch (e) { throw new Error(t('URI 조각을 디코딩할 수 없습니다', 'Cannot decode the URI fragment')); } }
    if (raw !== '' && raw[0] !== '/') throw new Error(t('JSON Pointer는 "/"로 시작해야 합니다 (예: /users/0/name)', 'A JSON Pointer must start with "/" (e.g. /users/0/name)'));
    var toks = raw === '' ? [] : raw.slice(1).split('/').map(function (x) {
      if (/~[^01]|~$/.test(x)) throw new Error(t('"~" 뒤에는 0 또는 1만 올 수 있습니다: ' + x, 'Only "~0" and "~1" are valid escapes: ' + x));
      return x.replace(/~1/g, '/').replace(/~0/g, '~');
    });
    var cur = data, walked = [];
    toks.forEach(function (k) {
      if (Array.isArray(cur)) {
        if (!/^(0|[1-9]\d*)$/.test(k)) throw new Error(t('배열 인덱스가 올바르지 않습니다: "' + k + '"', 'Invalid array index: "' + k + '"'));
        if (Number(k) >= cur.length) throw new Error(t('인덱스 ' + k + '가 범위를 벗어났습니다 (길이 ' + cur.length + ')', 'Index ' + k + ' is out of range (length ' + cur.length + ')'));
      } else if (cur && typeof cur === 'object') {
        if (!Object.prototype.hasOwnProperty.call(cur, k)) throw new Error(t('키 "' + k + '"가 ' + (walked.length ? '/' + walked.map(enc).join('/') : '루트') + '에 없습니다', 'Key "' + k + '" not found at ' + (walked.length ? '/' + walked.map(enc).join('/') : 'root')));
      } else throw new Error(t('"' + k + '"를 찾으려는데 ' + J.kind(cur) + ' 값에는 하위 항목이 없습니다', 'Cannot look up "' + k + '" inside a ' + J.kind(cur) + ' value'));
      cur = cur[k]; walked.push(k);
    });
    var norm = toks.map(function (k) { return '/' + enc(k); }).join('');
    return {
      _status: t('✅ 값을 찾았습니다 (' + J.kind(cur) + ')', '✅ Found a value (' + J.kind(cur) + ')'),
      info: [
        [['정규화된 포인터', 'Normalized pointer'], norm === '' ? '"" (root)' : norm],
        [['URI 조각 형식', 'URI fragment form'], '#' + norm.split('/').map(function (s) { return encodeURIComponent(s).replace(/[!'()*]/g, escape); }).join('/')],
        [['JSONPath 표기', 'JSONPath form'], '$' + toks.map(function (k, i) { return /^(0|[1-9]\d*)$/.test(k) && Array.isArray(walkTo(i)) ? '[' + k + ']' : "['" + k.replace(/'/g, "\\'") + "']"; }).join('')]
      ],
      val: J.fmt(cur, 2)
    };
    function walkTo(n) { var c = data; for (var i = 0; i < n; i++) c = c[toks[i]]; return c; }
  }
});
