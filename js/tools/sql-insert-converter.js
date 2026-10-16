TK.tool('sql-insert-converter', {
  inputs: [{ id: 'sql', label: ['SQL INSERT 문', 'SQL INSERT statements'], rows: 10, sample: "INSERT INTO users (id, name, email, active, score, note) VALUES\n  (1, 'Kim', 'kim@example.com', true, 3.5, NULL),\n  (2, 'O''Brien', 'ob@example.com', false, 10, 'says \"hi\", ok'),\n  (3, '이영희', NULL, 1, -2, 'line1\\nline2');\nINSERT INTO `orders` (`id`, `user_id`) VALUES (10, 1), (11, 2);" }],
  options: [
    { id: 'fmt', type: 'select', label: ['출력', 'Output'], choices: [['json', 'JSON'], ['csv', 'CSV'], ['jsonl', 'JSON Lines']], default: 'json' },
    { id: 'table', type: 'text', label: ['테이블 이름 필터 (비우면 첫 테이블)', 'Table filter (empty = first table)'], default: '' },
    { id: 'num', type: 'checkbox', label: ['숫자·true/false·NULL 을 JSON 타입으로 변환', 'Convert numbers, true / false and NULL to JSON types'], default: true }
  ],
  outputs: [{ id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['문장별 요약', 'Statements'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var s = String(v.sql), i = 0, L = s.length, stmts = [], issues = [];
    function ws() { while (i < L) { if (/\s/.test(s[i])) i++; else if (s.substr(i, 2) === '--') { while (i < L && s[i] !== '\n') i++; } else if (s.substr(i, 2) === '/*') { var e = s.indexOf('*/', i + 2); i = e < 0 ? L : e + 2; } else break; } }
    function ident() {
      ws(); var q = s[i];
      if (q === '`' || q === '"' || q === '[') { var close = q === '[' ? ']' : q, e = s.indexOf(close, i + 1); if (e < 0) throw new Error(t('식별자 따옴표가 닫히지 않았습니다', 'Unclosed identifier quote')); var r = s.slice(i + 1, e); i = e + 1; return r; }
      var m = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(s.slice(i)); if (!m) throw new Error(t('식별자를 읽을 수 없습니다 (위치 ' + i + ')', 'Cannot read an identifier (position ' + i + ')')); i += m[0].length; return m[0];
    }
    function qname() { var n = ident(); ws(); while (s[i] === '.') { i++; n = ident(); ws(); } return n; }
    function value() {
      ws(); var c = s[i];
      if (c === "'") { var out = ''; i++; while (i < L) { if (s[i] === "'" && s[i + 1] === "'") { out += "'"; i += 2; } else if (s[i] === '\\' && i + 1 < L) { var n = s[i + 1]; out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n === '0' ? '\0' : n; i += 2; } else if (s[i] === "'") { i++; return { s: out }; } else out += s[i++]; } throw new Error(t('문자열이 닫히지 않았습니다', 'Unclosed string')); }
      if (/[xX]/.test(c) && s[i + 1] === "'") { var e = s.indexOf("'", i + 2); var h = s.slice(i + 2, e); i = e + 1; return { s: '0x' + h }; }
      var m = /^(NULL|TRUE|FALSE)\b/i.exec(s.slice(i)); if (m) { i += m[0].length; return { k: m[1].toUpperCase() }; }
      m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i)); if (m) { i += m[0].length; return { n: m[0] }; }
      m = /^[A-Za-z_][A-Za-z0-9_]*\s*\([^()]*\)|^[A-Za-z_][A-Za-z0-9_.]*/.exec(s.slice(i)); if (m) { i += m[0].length; return { f: m[0] }; }
      throw new Error(t('값을 읽을 수 없습니다 (위치 ' + i + ': ' + s.slice(i, i + 12) + ')', 'Cannot read a value (position ' + i + ': ' + s.slice(i, i + 12) + ')'));
    }
    while (true) {
      ws(); if (i >= L) break;
      var m = /^INSERT\s+(?:IGNORE\s+|OR\s+\w+\s+)?(?:INTO\s+)?/i.exec(s.slice(i));
      if (!m) { var nx = s.indexOf(';', i); if (nx < 0) break; i = nx + 1; continue; }
      i += m[0].length; var tbl = qname(); ws(); var cols = null;
      if (s[i] === '(') { i++; cols = []; while (true) { cols.push(ident()); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ')') { i++; break; } throw new Error(t('열 목록을 읽을 수 없습니다', 'Cannot read the column list')); } ws(); }
      if (!/^VALUES?\b/i.test(s.slice(i))) { var nx2 = s.indexOf(';', i); i = nx2 < 0 ? L : nx2 + 1; issues.push(t('VALUES 가 없는 INSERT(…SELECT 등)는 건너뛰었습니다: ' + tbl, 'Skipped an INSERT without VALUES (e.g. …SELECT): ' + tbl)); continue; }
      i += s.slice(i).match(/^VALUES?/i)[0].length; var rows = [];
      while (true) {
        ws(); if (s[i] !== '(') throw new Error(t('( 가 필요합니다 (위치 ' + i + ')', '( expected (position ' + i + ')')); i++; var row = [];
        while (true) { row.push(value()); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ')') { i++; break; } throw new Error(t('값 목록이 올바르지 않습니다 (위치 ' + i + ')', 'Invalid value list (position ' + i + ')')); }
        rows.push(row); ws(); if (s[i] === ',') { i++; continue; } break;
      }
      ws(); if (/^ON\s+(DUPLICATE|CONFLICT)/i.test(s.slice(i))) { issues.push(t('ON DUPLICATE / ON CONFLICT 절은 무시했습니다', 'Ignored the ON DUPLICATE / ON CONFLICT clause')); var nx3 = s.indexOf(';', i); i = nx3 < 0 ? L : nx3; }
      ws(); if (s[i] === ';') i++;
      stmts.push({ table: tbl, cols: cols, rows: rows });
    }
    if (!stmts.length) throw new Error(t('INSERT … VALUES 문을 찾지 못했습니다', 'No INSERT … VALUES statement found'));
    var want = (o.table || '').trim().toLowerCase(), pick = stmts.filter(function (x) { return want ? x.table.toLowerCase() === want : x.table === stmts[0].table; });
    if (!pick.length) throw new Error(t('테이블 "' + o.table + '" 을 찾지 못했습니다 (' + stmts.map(function (x) { return x.table; }).join(', ') + ')', 'Table "' + o.table + '" not found (' + stmts.map(function (x) { return x.table; }).join(', ') + ')'));
    var cols = pick[0].cols, objs = [];
    pick.forEach(function (st) {
      var c = st.cols || cols || null;
      st.rows.forEach(function (r, idx) {
        var names = c || r.map(function (_, k) { return 'col' + (k + 1); });
        if (c && c.length !== r.length) throw new Error(t('열 ' + c.length + '개인데 값이 ' + r.length + '개인 행이 있습니다 (' + st.table + ' ' + (idx + 1) + '번째 행)', 'Column count ' + c.length + ' but row has ' + r.length + ' values (' + st.table + ' row ' + (idx + 1) + ')'));
        var obj = {}; r.forEach(function (x, k) {
          var val;
          if (x.s !== undefined) val = x.s; else if (x.k) val = !o.num ? x.k : x.k === 'NULL' ? null : x.k === 'TRUE'; else if (x.n !== undefined) val = o.num ? Number(x.n) : x.n; else val = '«' + x.f + '»';
          obj[names[k]] = val;
          if (x.f) issues.push(t('함수/표현식 값은 «…» 로 감싸 문자열로 둡니다: ' + x.f, 'Function / expression values are kept as «…» strings: ' + x.f));
        });
        objs.push(obj);
      });
    });
    var keys = []; objs.forEach(function (ob) { Object.keys(ob).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
    var out;
    if (o.fmt === 'csv') {
      var q = function (x) { if (x === null || x === undefined) return ''; x = String(x); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
      out = [keys.map(q).join(',')].concat(objs.map(function (ob) { return keys.map(function (k) { return q(ob[k]); }).join(','); })).join('\n');
    } else if (o.fmt === 'jsonl') out = objs.map(function (x) { return JSON.stringify(x); }).join('\n');
    else out = JSON.stringify(objs, null, 2);
    if (stmts.length > pick.length) issues.push(t('다른 테이블 ' + (stmts.length - pick.length) + '개 문장은 제외했습니다 — 테이블 이름 필터로 선택하세요', (stmts.length - pick.length) + ' statement(s) for other tables were left out — use the table filter'));
    if (!pick[0].cols) issues.push(t('열 목록이 없어 col1, col2 … 로 이름을 붙였습니다', 'No column list, so columns were named col1, col2 …'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: t('✅ ' + pick[0].table + ': ' + objs.length + '행 · ' + keys.length + '열', '✅ ' + pick[0].table + ': ' + objs.length + ' row(s) · ' + keys.length + ' column(s)'), out: out, table: { head: [['테이블', 'Table'], ['행', 'Rows'], ['열', 'Columns']], rows: stmts.map(function (x) { return [x.table, String(x.rows.length), (x.cols || []).join(', ') || '—']; }) }, issues: uniq };
  }
});
