TK.tool('jsonl-viewer', {
  inputs: [{ id: 'in', label: ['JSON Lines / NDJSON (한 줄에 JSON 하나)', 'JSON Lines / NDJSON (one JSON value per line)'], rows: 12, sample: '{"ts":"2026-10-16T09:00:01Z","level":"info","msg":"server started","port":8080}\n{"ts":"2026-10-16T09:00:05Z","level":"warn","msg":"slow query","ms":1450,"tags":["db","orders"]}\n{"ts":"2026-10-16T09:00:09Z","level":"error","msg":"payment failed","order":{"id":42,"amount":19.9}}\n{"ts":"2026-10-16T09:00:10Z","level":"info","msg":"retry" \n\n{"ts":"2026-10-16T09:00:12Z","level":"info","msg":"done"}' }],
  options: [
    { id: 'out', type: 'select', label: ['변환 출력', 'Output'], choices: [['array', ['JSON 배열', 'JSON array']], ['csv', 'CSV'], ['pretty', ['들여쓰기한 JSON Lines', 'Pretty-printed lines']], ['valid', ['유효한 줄만 다시 JSONL', 'Valid lines only, as JSONL']]], default: 'array' },
    { id: 'flat', type: 'checkbox', label: ['중첩 객체를 a.b 열로 펼치기 (표·CSV)', 'Flatten nested objects to a.b columns (table & CSV)'], default: true },
    { id: 'filter', type: 'text', label: ['필터 (줄 안에 포함된 텍스트, 선택)', 'Filter (text contained in the line, optional)'], default: '' }
  ],
  sampleExpectError: true,
  outputs: [{ id: 'table', label: ['표', 'Table'], kind: 'table' }, { id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'txt' }, { id: 'stats', label: ['줄별 오류', 'Line errors'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var text = String(v.in).replace(/^﻿/, ''), lines = text.replace(/\r/g, '').split('\n'), issues = [], items = [], errs = [], blank = 0;
    var flt = String(o.filter || '').trim().toLowerCase();
    lines.forEach(function (ln, i) {
      if (!ln.trim()) { blank++; return; }
      try { var val = JSON.parse(ln); if (flt && ln.toLowerCase().indexOf(flt) < 0) return; items.push({ n: i + 1, v: val }); }
      catch (e) { errs.push([String(i + 1), ln.length > 50 ? ln.slice(0, 47) + '…' : ln, e.message.replace(/^JSON\.parse: /, '').slice(0, 80)]); }
    });
    if (!items.length && !errs.length) throw new Error(t('JSON 줄이 없습니다', 'No JSON lines'));
    function flat(x, p, out) { if (x !== null && typeof x === 'object' && !Array.isArray(x) && (o.flat || p === '')) { Object.keys(x).forEach(function (k) { flat(x[k], p ? p + '.' + k : k, out); }); if (!Object.keys(x).length) out[p] = '{}'; } else out[p || '(value)'] = x; return out; }
    var cols = [], rows = items.map(function (it) { var f = (it.v !== null && typeof it.v === 'object' && !Array.isArray(it.v)) ? flat(it.v, '', {}) : { '(value)': it.v }; Object.keys(f).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); return f; });
    function cell(x) { return x === undefined ? '' : x !== null && typeof x === 'object' ? JSON.stringify(x) : String(x); }
    var out;
    if (o.out === 'array') out = JSON.stringify(items.map(function (i) { return i.v; }), null, 2);
    else if (o.out === 'pretty') out = items.map(function (i) { return '// line ' + i.n + '\n' + JSON.stringify(i.v, null, 2); }).join('\n');
    else if (o.out === 'valid') out = items.map(function (i) { return JSON.stringify(i.v); }).join('\n');
    else { var q = function (x) { x = cell(x); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }; out = [cols.map(q).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(r[c]); }).join(','); })).join('\n'); }
    // 통계
    var types = {}; items.forEach(function (i) { var ty = i.v === null ? 'null' : Array.isArray(i.v) ? 'array' : typeof i.v; types[ty] = (types[ty] || 0) + 1; });
    if (errs.length) issues.push('🚨 ' + t('JSON 으로 해석되지 않는 줄 ' + errs.length + '개 (줄 ' + errs.slice(0, 5).map(function (e) { return e[0]; }).join(', ') + ')', errs.length + ' line(s) are not valid JSON (lines ' + errs.slice(0, 5).map(function (e) { return e[0]; }).join(', ') + ')'));
    if (blank) issues.push(t('빈 줄 ' + blank + '개는 무시했습니다 (JSON Lines 규격은 빈 줄을 허용하지 않을 수 있음)', 'Ignored ' + blank + ' blank line(s) (the JSON Lines spec may not allow them)'));
    if (Object.keys(types).length > 1) issues.push(t('줄마다 타입이 다릅니다: ' + Object.keys(types).map(function (k) { return k + ' ' + types[k]; }).join(', '), 'Lines have mixed types: ' + Object.keys(types).map(function (k) { return k + ' ' + types[k]; }).join(', ')));
    var sparse = cols.filter(function (c) { return rows.some(function (r) { return r[c] === undefined; }); }).length; if (sparse) issues.push(t('줄마다 키가 달라 ' + sparse + '개 열은 일부 줄에만 있습니다', sparse + ' column(s) exist only in some lines (keys differ per line)'));
    issues.push(t('JSON Lines 는 한 줄이 곧 하나의 JSON 값입니다. 값 안의 줄바꿈은 \\n 으로 이스케이프되어야 합니다. 확장자는 .jsonl 또는 .ndjson', 'In JSON Lines one line is one JSON value; newlines inside values must be escaped as \\n. Use .jsonl or .ndjson'));
    if (text.length > 5e6) issues.push(t('입력이 매우 큽니다 — 표는 처음 500줄만 표시합니다', 'Large input — the table shows only the first 500 lines'));
    return { _status: errs.length ? { ok: 'info', msg: t('🔍 유효 ' + items.length + '줄 · 오류 ' + errs.length + '줄', '🔍 ' + items.length + ' valid · ' + errs.length + ' invalid line(s)') } : t('✅ ' + items.length + '줄 · 열 ' + cols.length + '개', '✅ ' + items.length + ' line(s) · ' + cols.length + ' column(s)'), table: { head: [['줄', 'Line']].concat(cols.map(function (c) { return [c, c]; })), rows: rows.slice(0, 500).map(function (r, i) { return [String(items[i].n)].concat(cols.map(function (c) { return cell(r[c]); })); }) }, out: out, stats: errs.length ? { head: [['줄', 'Line'], ['내용', 'Content'], ['오류', 'Error']], rows: errs } : null, issues: issues };
  }
});
