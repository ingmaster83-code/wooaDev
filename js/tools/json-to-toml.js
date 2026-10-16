TK.tool('json-to-toml', {
  inputs: [{ id: 'in', label: ['JSON 입력', 'JSON input'], rows: 13, sample: '{\n  "title": "Example",\n  "owner": { "name": "Kim", "active": true },\n  "database": { "ports": [8000, 8001], "connection_max": 5000 },\n  "servers": [\n    { "name": "alpha", "ip": "10.0.0.1" },\n    { "name": "beta", "ip": "10.0.0.2" }\n  ]\n}' }],
  options: [{ id: 'nulls', type: 'select', label: ['null 값 처리', 'null handling'], choices: [['skip', ['항목 제거 (TOML은 null이 없음)', 'Drop the key (TOML has no null)']], ['empty', ['빈 문자열 ""로', 'Use empty string ""']], ['error', ['오류로 알림', 'Report an error']]], default: 'skip' }],
  outputs: [{ id: 'out', label: ['TOML 결과', 'TOML output'], kind: 'code', ext: 'toml', mime: 'application/toml' }],
  swap: { from: 'out', to: 'in' },
  run: function (v, o, t) {
    if (typeof TOML === 'undefined') throw new Error(t('TOML 라이브러리를 불러오지 못했습니다', 'Failed to load the TOML library'));
    var data = TK.json.parseValue(v.in), dropped = 0;
    if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error(t('TOML의 최상위는 키-값 표(객체)여야 합니다. 배열이나 값만으로는 변환할 수 없습니다 — 객체로 감싸 주세요.', 'A TOML document must be a table (object) at the top level. Wrap arrays or plain values in an object.'));
    function clean(x, p) {
      if (Array.isArray(x)) {
        return x.map(function (c, i) {
          if (c === null) { if (o.nulls === 'error') throw new Error(t('null 값이 있습니다: ' + TK.json.pathStr(p.concat([i])), 'null found at ' + TK.json.pathStr(p.concat([i])))); dropped++; return o.nulls === 'empty' ? '' : undefined; }
          return clean(c, p.concat([i]));
        }).filter(function (c) { return c !== undefined; });
      }
      if (x && typeof x === 'object') {
        var out = {};
        Object.keys(x).forEach(function (k) {
          if (x[k] === null) {
            if (o.nulls === 'error') throw new Error(t('null 값이 있습니다: ' + TK.json.pathStr(p.concat([k])), 'null found at ' + TK.json.pathStr(p.concat([k]))));
            dropped++; if (o.nulls === 'empty') TK.json.setProp(out, k, '');
          } else TK.json.setProp(out, k, clean(x[k], p.concat([k])));
        });
        return out;
      }
      return x;
    }
    var res = TOML.stringify(clean(data, []));
    return {
      _status: dropped ? { ok: 'info', msg: t('⚠️ null ' + dropped + '개를 ' + (o.nulls === 'empty' ? '빈 문자열로 바꿨습니다' : '제거했습니다'), '⚠️ ' + dropped + ' null value(s) ' + (o.nulls === 'empty' ? 'replaced with empty strings' : 'dropped')) } : t('✅ 변환 완료', '✅ Converted'),
      out: res
    };
  }
});
