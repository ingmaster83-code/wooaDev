TK.tool('css-formatter', {
  inputs: [{ id: 'in', label: ['CSS', 'CSS'], rows: 14, sample: '/* 카드 */\n.card{color:#FFF;background:url("a.png") no-repeat;margin:0 auto;color:red!important}\n.card:hover,.card:focus{transform:translateY(-2px)}\n@media (max-width:600px){.card{margin:0;-webkit-transition:all .3s;transition:all .3s}.empty{}}\n.btn{padding:4px 8px;&:hover{opacity:.8}}' }],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['format', ['정리', 'Format']], ['minify', ['최소화', 'Minify']]], default: 'format' },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['tab', 'Tab']], default: '2', show: function (o) { return o.mode === 'format'; } },
    { id: 'sort', type: 'checkbox', label: ['선언을 알파벳순으로 정렬', 'Sort declarations alphabetically'], default: false, show: function (o) { return o.mode === 'format'; } },
    { id: 'comments', type: 'checkbox', label: ['주석 유지', 'Keep comments'], default: true }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'css' }, { id: 'issues', label: ['검사 결과', 'Lint results'], kind: 'list' }],
  run: function (v, o, t) {
    var s = String(v.in); if (!s.trim()) throw new Error(t('CSS 를 입력하세요', 'Enter some CSS'));
    var i = 0, L = s.length, issues = [];
    function node(kind, extra) { return Object.assign({ kind: kind }, extra); }
    function skipStr(q) { var j = i + 1; while (j < L && s[j] !== q) { if (s[j] === '\\') j++; if (s[j] === '\n') break; j++; } if (s[j] !== q) { issues.push(t('🚨 닫히지 않은 문자열 (위치 ' + i + ')', '🚨 Unclosed string (position ' + i + ')')); return j; } return j + 1; }
    function parseBlock(depth) {
      var items = [], buf = '';
      while (i < L) {
        var c = s[i];
        if (c === '/' && s[i + 1] === '*') { var e = s.indexOf('*/', i + 2); var cm = e < 0 ? s.slice(i + 2) : s.slice(i + 2, e); if (e < 0) issues.push(t('🚨 닫히지 않은 주석', '🚨 Unclosed comment')); i = e < 0 ? L : e + 2; if (buf.trim()) buf += ' '; else items.push(node('comment', { text: cm.trim() })); continue; }
        if (c === '"' || c === "'") { var j = skipStr(c); buf += s.slice(i, j); i = j; continue; }
        if (c === '(') { var d = 1, j2 = i + 1; while (j2 < L && d) { if (s[j2] === '(') d++; else if (s[j2] === ')') d--; else if (s[j2] === '"' || s[j2] === "'") { var sv = i; i = j2; j2 = skipStr(s[j2]) - 1; i = sv; } j2++; } buf += s.slice(i, j2); i = j2; continue; }
        if (c === '{') {
          i++; var kids = parseBlock(depth + 1), prelude = buf.trim().replace(/\s+/g, ' '); buf = '';
          items.push(node('block', { prelude: prelude, items: kids })); continue;
        }
        if (c === '}') { if (depth === 0) { issues.push(t('🚨 짝이 없는 } (위치 ' + i + ')', '🚨 Stray } (position ' + i + ')')); i++; continue; } if (buf.trim()) items.push(node('decl', { text: buf.trim() })); i++; return items; }
        if (c === ';') { if (buf.trim()) items.push(node('decl', { text: buf.trim() })); buf = ''; i++; continue; }
        buf += c; i++;
      }
      if (depth > 0) issues.push(t('🚨 닫히지 않은 { 가 있습니다', '🚨 Unclosed {'));
      if (buf.trim()) items.push(node('decl', { text: buf.trim() }));
      return items;
    }
    var tree = parseBlock(0);
    function splitDecl(txt) { var k = txt.indexOf(':'); if (k < 0) return null; return [txt.slice(0, k).trim(), txt.slice(k + 1).trim()]; }
    function normVal(val) {
      var imp = /\s*!\s*important\s*$/i.test(val); val = val.replace(/\s*!\s*important\s*$/i, '');
      var parts = [], b = '', q = '', depth = 0;
      for (var k = 0; k < val.length; k++) { var ch = val[k]; if (q) { b += ch; if (ch === q && val[k - 1] !== '\\') q = ''; continue; } if (ch === '"' || ch === "'") { q = ch; b += ch; continue; } if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(b); b = ''; continue; } b += ch; }
      parts.push(b);
      var r = parts.map(function (x) { return x.trim().replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s*,\s*/g, ', '); }).join(', ');
      return r + (imp ? ' !important' : '');
    }
    var vendorSeen = {}, importantN = 0, emptyN = 0, dupN = 0;
    function lint(items, label) {
      var seen = {};
      items.forEach(function (it) {
        if (it.kind === 'decl') {
          var d = splitDecl(it.text); if (!d) { issues.push(t('🚨 "' + it.text.slice(0, 30) + '" — 속성:값 형식이 아닙니다 (' + label + ')', '🚨 "' + it.text.slice(0, 30) + '" is not property:value (' + label + ')')); return; }
          var p = d[0].toLowerCase(); if (!/^(--|[-a-z]+$)/.test(p) && !/^\$|^@/.test(p)) issues.push(t('속성 이름이 이상합니다: ' + d[0], 'Odd property name: ' + d[0]));
          if (/!\s*important/i.test(d[1])) importantN++;
          if (seen[p] !== undefined && seen[p] !== d[1] && !/^--/.test(p)) { dupN++; issues.push(t('같은 규칙에서 속성이 중복되었습니다: ' + p + ' (' + label + ') — 뒤의 값이 이깁니다 (폴백 의도가 아니면 제거)', 'Duplicate property in one rule: ' + p + ' (' + label + ') — the later wins (remove unless it is a fallback)')); }
          seen[p] = d[1];
          if (/^-(webkit|moz|ms|o)-/.test(p)) vendorSeen[p] = 1;
          if (/(^|\s|,)#[0-9a-f]{3,8}\b/i.test(d[1]) && !/(^|[\s,(])#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i.test(d[1])) issues.push(t('색상 값 길이가 올바르지 않습니다: ' + d[1], 'Invalid colour length: ' + d[1]));
        } else if (it.kind === 'block') {
          if (!it.items.length) { emptyN++; issues.push(t('빈 규칙: ' + it.prelude, 'Empty rule: ' + it.prelude)); }
          lint(it.items, it.prelude);
        }
      });
    }
    lint(tree, '');
    if (importantN > 3) issues.push(t('!important 가 ' + importantN + '번 쓰였습니다 — 선택자 우선순위를 정리하는 편이 낫습니다', '!important is used ' + importantN + ' times — consider fixing selector specificity instead'));
    Object.keys(vendorSeen).forEach(function (p) { var std = p.replace(/^-(webkit|moz|ms|o)-/, ''); if (/^(transition|transform|animation|box-shadow|border-radius|flex)/.test(std)) issues.push(t('벤더 접두사 ' + p + ' — 현대 브라우저는 접두사 없이도 지원합니다 (Autoprefixer 사용 권장)', 'Vendor prefix ' + p + ' — modern browsers need no prefix (use Autoprefixer)')); });
    var unit = o.indent === 'tab' ? '\t' : new Array((+o.indent || 2) + 1).join(' ');
    function declOut(it) { var d = splitDecl(it.text); return d ? d[0] + ': ' + normVal(d[1]) + ';' : it.text + ';'; }
    function fmt(items, d, out) {
      var pad = new Array(d + 1).join(unit), decls = items.filter(function (x) { return x.kind === 'decl'; });
      var order = o.sort ? items.map(function (x, idx) { return x; }) : items;
      if (o.sort) { var ds = decls.slice().sort(function (a, b) { var x = (splitDecl(a.text) || [''])[0], y = (splitDecl(b.text) || [''])[0]; return x < y ? -1 : x > y ? 1 : 0; }), di = 0; order = items.map(function (x) { return x.kind === 'decl' ? ds[di++] : x; }); }
      order.forEach(function (it, idx) {
        if (it.kind === 'comment') { if (o.comments) out.push(pad + '/* ' + it.text + ' */'); }
        else if (it.kind === 'decl') out.push(pad + declOut(it));
        else {
          if (idx > 0 && d === 0 || (idx > 0 && order[idx - 1].kind === 'block')) out.push('');
          var pre = it.prelude.replace(/\s*,\s*/g, d === 0 && !/^@/.test(it.prelude) ? ',\n' + pad : ', ').replace(/\s*>\s*/g, ' > ').replace(/\s*\+\s*(?![^(]*\))/g, ' + ').replace(/\s*~\s*/g, ' ~ ');
          if (/^@/.test(pre)) pre = pre.replace(/\(\s*([a-z-]+)\s*:\s*/gi, '($1: ');
          if (!it.items.length) { out.push(pad + pre + ' {}'); }
          else { out.push(pad + pre + ' {'); fmt(it.items, d + 1, out); out.push(pad + '}'); }
        }
      });
    }
    function min(items) {
      return items.map(function (it) {
        if (it.kind === 'comment') return o.comments && /^!/.test(it.text) ? '/*' + it.text + '*/' : '';
        if (it.kind === 'decl') { var d = splitDecl(it.text); return d ? d[0] + ':' + normVal(d[1]).replace(/, /g, ',').replace(/\b0(\.\d+)/g, '$1').replace(/\s*!important/, '!important') : it.text; }
        return it.prelude.replace(/\s*([,>+~])\s*/g, '$1') + '{' + min(it.items).replace(/;}/g, '}') + '}';
      }).filter(Boolean).reduce(function (acc, x) { return acc + (acc && !/\}$/.test(acc) && !/\{$/.test(acc) ? ';' : '') + x; }, '');
    }
    var out = [], text;
    if (o.mode === 'minify') {
      text = (function m(items) { return items.map(function (it) { if (it.kind === 'comment') return ''; if (it.kind === 'decl') return null; return it.prelude.replace(/\s*([,>+~])\s*/g, '$1') + '{' + body(it.items) + '}'; }).filter(function (x) { return x !== null && x !== ''; }).join(''); function body(its) { var ds = [], bl = []; its.forEach(function (x) { if (x.kind === 'decl') { var d = splitDecl(x.text); ds.push(d ? d[0] + ':' + normVal(d[1]).replace(/, /g, ',').replace(/(^|[ (,])0\.(\d)/g, '$1.$2') : x.text); } else if (x.kind === 'block') bl.push(x.prelude.replace(/\s*([,>+~])\s*/g, '$1') + '{' + body(x.items) + '}'); }); return ds.join(';') + (ds.length && bl.length ? ';' : '') + bl.join(''); } })(tree);
      var tops = tree.filter(function (x) { return x.kind === 'decl'; }); if (tops.length) text = tops.map(function (x) { return x.text; }).join(';') + ';' + text;
      var pct = Math.round((1 - text.length / s.length) * 100); issues.unshift(t('최소화: ' + s.length.toLocaleString() + '자 → ' + text.length.toLocaleString() + '자 (' + pct + '% 감소)', 'Minified: ' + s.length.toLocaleString() + ' → ' + text.length.toLocaleString() + ' chars (' + pct + '% smaller)'));
    } else { fmt(tree, 0, out); text = out.join('\n'); }
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    var bad = uniq.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: 'info', msg: t('🔍 문법 문제 ' + bad + '건 — 결과는 가능한 범위에서 정리했습니다', '🔍 ' + bad + ' syntax problem(s) — the result is a best-effort clean-up') } : t('✅ ' + (o.mode === 'minify' ? '최소화' : '정리') + ' 완료', '✅ ' + (o.mode === 'minify' ? 'Minified' : 'Formatted')), out: text, issues: uniq };
  }
});
