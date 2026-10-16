TK.tool('xml-table-converter', {
  inputs: [{ id: 'in', label: ['XML', 'XML'], rows: 14, sample: '<?xml version="1.0"?>\n<catalog>\n  <book id="b1" lang="en">\n    <title>XML Basics</title>\n    <author>Kim</author>\n    <price currency="USD">29.99</price>\n    <tags><tag>xml</tag><tag>intro</tag></tags>\n  </book>\n  <book id="b2">\n    <title>Data, "Quoted" &amp; More</title>\n    <author>Lee</author>\n    <price currency="KRW">35000</price>\n  </book>\n</catalog>' }],
  options: [
    { id: 'rec', type: 'text', label: ['레코드 요소 경로 (비우면 자동 감지, 예: catalog/book)', 'Record element path (empty = auto, e.g. catalog/book)'], default: '' },
    { id: 'attrs', type: 'checkbox', label: ['속성도 열로 (@속성)', 'Attributes as columns (@attr)'], default: true },
    { id: 'sep', type: 'select', label: ['구분자', 'Delimiter'], choices: [[',', ['쉼표 (CSV)', 'Comma (CSV)']], ['\t', ['탭 (TSV)', 'Tab (TSV)']], [';', ['세미콜론', 'Semicolon']]], default: ',' },
    { id: 'join', type: 'text', label: ['반복 요소를 합칠 구분자', 'Joiner for repeated elements'], default: '|' },
    { id: 'bom', type: 'checkbox', label: ['엑셀용 UTF-8 BOM 추가', 'Add a UTF-8 BOM for Excel'], default: false }
  ],
  outputs: [{ id: 'table', label: ['미리보기', 'Preview'], kind: 'table' }, { id: 'out', label: ['CSV', 'CSV'], kind: 'code', ext: 'csv' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var doc = TK.xml.parse(String(v.in)), issues = [];
    function el(n) { return n && n.name !== undefined; }
    function kids(n) { return n.children.filter(el); }
    // 레코드 경로 찾기
    var path = String(o.rec || '').trim().replace(/^\/+|\/+$/g, ''), recs = [];
    function walk(n, cur, cb) { cb(n, cur); kids(n).forEach(function (c) { walk(c, cur + '/' + c.name, cb); }); }
    if (path) {
      var want = '/' + path; walk(doc.root, '/' + doc.root.name, function (n, p) { if (p === want || (path.indexOf('/') < 0 && n.name === path && n !== doc.root)) recs.push(n); });
      if (!recs.length) throw new Error(t('경로 "' + path + '" 와 일치하는 요소가 없습니다', 'No element matches the path "' + path + '"'));
    } else {
      // 자동: 같은 이름 형제가 2개 이상 반복되는 가장 얕은 요소
      var best = null; walk(doc.root, '/' + doc.root.name, function (n, p) { var cnt = {}; kids(n).forEach(function (c) { cnt[c.name] = (cnt[c.name] || 0) + 1; }); Object.keys(cnt).forEach(function (k) { if (cnt[k] > 1 && !best) best = { parent: n, name: k }; }); });
      if (best) recs = kids(best.parent).filter(function (c) { return c.name === best.name; });
      else { recs = kids(doc.root).length ? kids(doc.root) : [doc.root]; if (kids(doc.root).length) issues.push(t('반복되는 요소를 찾지 못해 루트의 자식을 각각 한 행으로 처리했습니다', 'No repeating element found; each child of the root became a row')); }
      if (best) issues.push(t('레코드 요소 자동 감지: <' + best.name + '> ' + recs.length + '개', 'Auto-detected record element: <' + best.name + '> × ' + recs.length));
    }
    var cols = [], rowsData = [];
    function addCol(c) { if (cols.indexOf(c) < 0) cols.push(c); }
    function text(n) { return n.children.filter(function (c) { return c.text !== undefined || c.cdata !== undefined; }).map(function (c) { return c.text !== undefined ? c.text : c.cdata; }).join('').trim().replace(/\s+/g, ' '); }
    function flatten(n, prefix, row, depth) {
      if (o.attrs) n.attrs.forEach(function (a) { var k = prefix + '@' + a[0]; addCol(k); row[k] = a[1]; });
      var ks = kids(n), tx = text(n);
      if (!ks.length) { var col = prefix.replace(/\.$/, '') || n.name; addCol(col); row[col] = row[col] !== undefined ? row[col] + o.join + tx : tx; return; }
      if (tx) { var c2 = (prefix.replace(/\.$/, '') || n.name) + '#text'; addCol(c2); row[c2] = tx; }
      var counts = {}; ks.forEach(function (c) { counts[c.name] = (counts[c.name] || 0) + 1; });
      ks.forEach(function (c) { flatten(c, prefix + c.name + '.', row, depth + 1); });
      Object.keys(counts).forEach(function (k) { if (counts[k] > 1) issues.push(t('<' + k + '> 가 한 레코드 안에서 반복됩니다 — 값을 "' + o.join + '" 로 합쳤습니다', '<' + k + '> repeats inside a record — values were joined with "' + o.join + '"')); });
    }
    recs.forEach(function (r) { var row = {}; if (o.attrs) r.attrs.forEach(function (a) { addCol('@' + a[0]); row['@' + a[0]] = a[1]; }); kids(r).forEach(function (c) { flatten(c, c.name + '.', row, 1); }); if (!kids(r).length) { var tx = text(r); if (tx) { addCol(r.name); row[r.name] = tx; } } rowsData.push(row); });
    // 열 이름 정리: 말단 접미사 '.' 제거
    function cn(c) { return c.replace(/\.@/, '@').replace(/\.$/, ''); }
    var names = cols.map(cn), dup = names.filter(function (x, i) { return names.indexOf(x) !== i; });
    var SEP = o.sep === '\\t' ? '\t' : o.sep;
    function q(x, hdr) { x = x === undefined ? '' : String(x); var needs = x.indexOf(SEP) >= 0 || /["\n\r]/.test(x); if (!hdr && /^[=+\-@]/.test(x) && x.length > 1 && isNaN(Number(x))) { issues.push(t('수식으로 해석될 수 있는 값 "' + x.slice(0, 20) + '" — 엑셀에서 열면 수식이 실행될 수 있습니다(CSV 인젝션)', 'The value "' + x.slice(0, 20) + '" may be read as a formula (CSV injection) when opened in Excel')); } return needs ? '"' + x.replace(/"/g, '""') + '"' : x; }
    var csv = [names.map(function (x) { return q(x, true); }).join(SEP)].concat(rowsData.map(function (r) { return cols.map(function (c) { return q(r[c]); }).join(SEP); })).join('\n');
    if (o.bom) csv = '﻿' + csv;
    if (dup.length) issues.push(t('열 이름이 겹칩니다: ' + dup.join(', '), 'Duplicate column names: ' + dup.join(', ')));
    var empty = rowsData.reduce(function (a, r) { return a + cols.filter(function (c) { return r[c] === undefined; }).length; }, 0); if (empty) issues.push(t('레코드마다 요소가 달라 빈 칸 ' + empty + '개가 생겼습니다', empty + ' empty cell(s) because records differ in structure'));
    issues.push(t('중첩 요소는 부모.자식 형식의 열로 펼칩니다. 한 레코드 안에서 반복되는 요소는 구분자로 합칩니다', 'Nested elements are flattened into parent.child columns; repeated elements inside a record are joined'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: t('✅ ' + rowsData.length + '행 × ' + cols.length + '열', '✅ ' + rowsData.length + ' row(s) × ' + cols.length + ' column(s)'), table: { head: names.map(function (n) { return [n, n]; }), rows: rowsData.slice(0, 200).map(function (r) { return cols.map(function (c) { return r[c] === undefined ? '' : r[c]; }); }) }, out: csv, issues: uniq };
  }
});
