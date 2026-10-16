TK.tool('json-diff', {
  inputs: [
    { id: 'a', label: ['원본 JSON (A)', 'Original JSON (A)'], rows: 12, sample: '{\n  "name": "WooaDev",\n  "version": "1.0.0",\n  "tags": ["json", "tool"],\n  "author": { "name": "Kim", "email": "kim@example.com" },\n  "legacy": true\n}' },
    { id: 'b', label: ['비교할 JSON (B)', 'Changed JSON (B)'], rows: 12, sample: '{\n  "name": "WooaDev",\n  "version": "1.1.0",\n  "tags": ["json", "tool", "free"],\n  "author": { "name": "Kim", "email": "kim@wooahouse.com" },\n  "license": "MIT"\n}' }
  ],
  options: [
    { id: 'unordered', type: 'checkbox', label: ['배열 순서 무시', 'Ignore array order'], default: false },
    { id: 'patchOut', type: 'checkbox', label: ['JSON Patch(RFC 6902) 생성', 'Generate JSON Patch (RFC 6902)'], default: true }
  ],
  outputs: [
    { id: 'table', label: ['변경 사항', 'Changes'], kind: 'table' },
    { id: 'patch', label: ['JSON Patch (A → B)', 'JSON Patch (A → B)'], kind: 'code', ext: 'json', mime: 'application/json-patch+json' }
  ],
  run: function (v, o, t) {
    var A, B;
    try { A = TK.json.parseValue(v.a); } catch (e) { throw new Error(t('A: ', 'A: ') + e.message); }
    try { B = TK.json.parseValue(v.b); } catch (e) { throw new Error(t('B: ', 'B: ') + e.message); }
    var d = TK.json.diff(A, B, { unordered: o.unordered });
    var res = { table: TK.json.diffTable(d, { a: t('이전(A)', 'Before (A)'), b: t('이후(B)', 'After (B)') }) };
    res._status = d.length ? { ok: 'info', msg: '🔍 ' + TK.json.diffSummary(d) } : t('✅ 두 JSON이 같습니다.' + (o.unordered ? ' (배열 순서 무시)' : ''), '✅ Both JSON documents are identical.' + (o.unordered ? ' (array order ignored)' : ''));
    if (o.patchOut && d.length) {
      var raw = TK.json.diff(A, B, {});
      var esc = function (k) { return String(k).replace(/~/g, '~0').replace(/\//g, '~1'); };
      var ptr = function (p) { return p.map(function (x) { return '/' + esc(x); }).join(''); };
      var ops = raw.map(function (x) {
        if (x.op === 'add') return { op: 'add', path: ptr(x.path), value: x.b };
        if (x.op === 'remove') return { op: 'remove', path: ptr(x.path) };
        return { op: 'replace', path: ptr(x.path), value: x.b };
      });
      // 배열 끝 요소 삭제는 큰 인덱스부터 적용해야 인덱스가 밀리지 않는다
      var rm = ops.filter(function (x) { return x.op === 'remove'; }), rest = ops.filter(function (x) { return x.op !== 'remove'; });
      var parent = function (p) { return p.slice(0, p.lastIndexOf('/')); }, last = function (p) { return p.slice(p.lastIndexOf('/') + 1); };
      rm.sort(function (p, q) {
        var pp = parent(p.path), pq = parent(q.path);
        if (pp !== pq) return pp < pq ? -1 : 1;
        var na = Number(last(p.path)), nb = Number(last(q.path));
        return isNaN(na) || isNaN(nb) ? 0 : nb - na;
      });
      res.patch = TK.json.fmt(rest.concat(rm), 2);
    }
    return res;
  }
});
