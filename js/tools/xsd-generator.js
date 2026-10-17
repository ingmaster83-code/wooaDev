TK.tool('xsd-generator', {
  inputs: [{ id: 'xml', label: ['XML 샘플 (같은 요소가 여러 번 나올수록 정확합니다)', 'XML sample (more repeats of an element give a better schema)'], rows: 20, sample: '<?xml version="1.0"?>\n<catalog>\n  <book id="b1" lang="en" inStock="true">\n    <title>XML Basics</title>\n    <author>Kim</author>\n    <price currency="USD">29.99</price>\n    <pages>320</pages>\n    <published>2024-03-01</published>\n  </book>\n  <book id="b2" lang="ko" inStock="false">\n    <title>XPath 입문</title>\n    <author>Lee</author>\n    <author>Park</author>\n    <price currency="KRW">18000</price>\n    <pages>256</pages>\n  </book>\n  <book id="b3" lang="en" inStock="true">\n    <title>Advanced XSLT</title>\n    <author>Kim</author>\n    <price currency="USD">45.00</price>\n    <pages>512</pages>\n    <published>2023-11-20</published>\n  </book>\n</catalog>\n' }],
  options: [
    { id: 'style', type: 'select', label: ['스타일', 'Style'], choices: [['nested', ['중첩형 (Russian Doll)', 'Nested (Russian Doll)']], ['types', ['이름 있는 타입 (Venetian Blind)', 'Named types (Venetian Blind)']]], default: 'nested' },
    { id: 'pfx', type: 'select', label: ['XSD 접두사', 'XSD prefix'], choices: [['xs', 'xs:'], ['xsd', 'xsd:']], default: 'xs' },
    { id: 'enums', type: 'checkbox', label: ['값이 몇 가지로 반복되면 enumeration 으로', 'Turn repeated small value sets into enumerations'], default: true },
    { id: 'ints', type: 'select', label: ['정수 타입', 'Integer type'], choices: [['int', 'xs:int / xs:long'], ['integer', 'xs:integer']], default: 'int' },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', '2'], ['4', '4']], default: '2' }
  ],
  outputs: [{ id: 'out', label: ['생성된 XSD', 'Generated XSD'], kind: 'code', ext: 'xsd' }, { id: 'table', label: ['추론 요약', 'Inference summary'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var X = TK.xml, issues = [], src = String(v.xml || ''); if (!src.trim()) throw new Error(t('XML 을 입력하세요', 'Enter XML'));
    var parsed; try { parsed = X.parse(src); } catch (e) { throw new Error(t('XML 오류: ', 'XML error: ') + e.message); }
    var P = o.pfx + ':', ind = new Array(+o.indent + 1).join(' ');
    var profiles = {};
    function prof(path, name) { if (!profiles[path]) profiles[path] = { path: path, name: name, count: 0, attrs: {}, seqs: [], texts: [], textOnly: 0, hasText: false, kids: {}, order: [] }; return profiles[path]; }
    function walk(el, path) {
      var pr = prof(path, el.name); pr.count++;
      el.attrs.forEach(function (a) { if (/^xmlns(:|$)/.test(a[0])) return; var at = pr.attrs[a[0]] || (pr.attrs[a[0]] = { count: 0, values: [] }); at.count++; at.values.push(a[1]); });
      var kids = el.children.filter(function (c) { return c.name !== undefined; }), txt = el.children.filter(function (c) { return c.text !== undefined || c.cdata !== undefined; }).map(function (c) { return c.text !== undefined ? c.text : c.cdata; }).join('');
      var counts = {}, seq = [];
      kids.forEach(function (k) { counts[k.name] = (counts[k.name] || 0) + 1; if (seq[seq.length - 1] !== k.name) seq.push(k.name); });
      pr.seqs.push(seq);
      Object.keys(counts).forEach(function (n) { var kk = pr.kids[n] || (pr.kids[n] = { min: Infinity, max: 0, parents: 0 }); kk.min = Math.min(kk.min, counts[n]); kk.max = Math.max(kk.max, counts[n]); kk.parents++; });
      pr.texts.push(txt);
      if (txt.trim()) pr.hasText = true;
      kids.forEach(function (k) { walk(k, path + '/' + k.name); });
    }
    walk(parsed.root, '/' + parsed.root.name);
    function inferType(values) {
      var vs = values.map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
      if (!vs.length) return 'string';
      if (vs.every(function (x) { return /^(true|false)$/.test(x); })) return 'boolean';
      if (vs.every(function (x) { return /^[-+]?\d+$/.test(x); })) { if (o.ints === 'integer') return 'integer'; var big = vs.some(function (x) { return Math.abs(Number(x)) > 2147483647; }); var huge = vs.some(function (x) { return Math.abs(Number(x)) > 9007199254740991; }); return huge ? 'integer' : big ? 'long' : 'int'; }
      if (vs.every(function (x) { return /^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(x); })) return 'decimal';
      if (vs.every(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x) && !TK.xsd.checkBuiltin('date', x); })) return 'date';
      if (vs.every(function (x) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(x) && !TK.xsd.checkBuiltin('dateTime', x); })) return 'dateTime';
      if (vs.every(function (x) { return /^\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/.test(x) && !TK.xsd.checkBuiltin('time', x); })) return 'time';
      if (vs.every(function (x) { return /^https?:\/\/\S+$/.test(x); })) return 'anyURI';
      return 'string';
    }
    function enumOf(values, type) { if (!o.enums || type !== 'string' && type !== 'int' && type !== 'integer') return null; var vs = values.map(function (x) { return x.trim(); }).filter(Boolean), d = {}; vs.forEach(function (x) { d[x] = true; }); var ks = Object.keys(d); return vs.length >= 3 && ks.length >= 2 && ks.length <= 8 && ks.length <= vs.length * 0.7 ? ks : null; }
    function occurs(min, max) { return (min !== 1 ? ' minOccurs="' + min + '"' : '') + (max !== 1 ? ' maxOccurs="' + (max === Infinity ? 'unbounded' : max) + '"' : ''); }
    function esc(s) { return TK.xml.escAttr(s); }
    /* 자식 순서 일관성 */
    function orderOf(pr) {
      var names = Object.keys(pr.kids); if (names.length <= 1) return { seq: names, ok: true };
      var before = {}; names.forEach(function (n) { before[n] = {}; });
      var ok = true;
      pr.seqs.forEach(function (sq) { var seen = {}; sq.forEach(function (n, i) { if (seen[n]) ok = false; seen[n] = true; for (var j = i + 1; j < sq.length; j++) if (sq[j] !== n) before[n][sq[j]] = true; }); });
      names.forEach(function (a) { names.forEach(function (b) { if (a !== b && before[a][b] && before[b][a]) ok = false; }); });
      if (!ok) return { seq: names, ok: false };
      /* 위상 정렬 (관측되지 않은 쌍은 첫 등장 순서) */
      var firstIdx = {}; pr.seqs.forEach(function (sq) { sq.forEach(function (n, i) { if (firstIdx[n] === undefined) firstIdx[n] = i; }); });
      var out = names.slice().sort(function (a, b) { if (before[a][b]) return -1; if (before[b][a]) return 1; return firstIdx[a] - firstIdx[b]; });
      return { seq: out, ok: true };
    }
    var typeDefs = [], statRows = [];
    function simpleOf(values, type) {
      var en = enumOf(values, type);
      if (en) return { inline: ind + ind + '<' + P + 'simpleType>\n' + ind + ind + ind + '<' + P + 'restriction base="' + P + type + '">\n' + en.map(function (e) { return ind + ind + ind + ind + '<' + P + 'enumeration value="' + esc(e) + '"/>\n'; }).join('') + ind + ind + ind + '</' + P + 'restriction>\n' + ind + ind + '</' + P + 'simpleType>', enumValues: en };
      return { type: P + type };
    }
    function attrDecl(name, at, total, depth) {
      var ty = inferType(at.values), st = simpleOf(at.values, ty), use = at.count === total ? ' use="required"' : '', pad = new Array(depth + 1).join(ind);
      if (st.enumValues) return pad + '<' + P + 'attribute name="' + name + '"' + use + '>\n' + pad + ind + '<' + P + 'simpleType>\n' + pad + ind + ind + '<' + P + 'restriction base="' + P + ty + '">\n' + st.enumValues.map(function (e) { return pad + ind + ind + ind + '<' + P + 'enumeration value="' + esc(e) + '"/>\n'; }).join('') + pad + ind + ind + '</' + P + 'restriction>\n' + pad + ind + '</' + P + 'simpleType>\n' + pad + '</' + P + 'attribute>\n';
      return pad + '<' + P + 'attribute name="' + name + '" type="' + P + ty + '"' + use + '/>\n';
    }
    function elementDecl(pr, depth, occ) {
      var pad = new Array(depth + 1).join(ind), name = pr.name, attrNames = Object.keys(pr.attrs), kidNames = Object.keys(pr.kids), occStr = occ || '';
      var textVals = pr.texts, ty = null;
      if (!kidNames.length && !attrNames.length) {
        ty = inferType(textVals); var st = simpleOf(textVals, ty);
        statRows.push([pr.path, String(pr.count), '—', '—', st.enumValues ? ty + ' (enum ' + st.enumValues.length + ')' : ty]);
        if (st.inline) return pad + '<' + P + 'element name="' + name + '"' + occStr + '>\n' + st.inline.replace(new RegExp('^' + ind + ind, 'gm'), pad + ind) + '\n' + pad + '</' + P + 'element>\n';
        return pad + '<' + P + 'element name="' + name + '" type="' + st.type + '"' + occStr + '/>\n';
      }
      var info = complexBody(pr, o.style === 'types' ? 2 : depth + 2);
      statRows.push([pr.path, String(pr.count), kidNames.join(', ') || '—', attrNames.join(', ') || '—', info.summary]);
      if (o.style === 'types') {
        var tname = name + 'Type'; typeDefs.push(pad.replace(/./g, '') + '<' + P + 'complexType name="' + tname + '"' + (info.mixed ? ' mixed="true"' : '') + '>\n' + info.body + '</' + P + 'complexType>\n');
        return pad + '<' + P + 'element name="' + name + '" type="' + tname + '"' + occStr + '/>\n';
      }
      return pad + '<' + P + 'element name="' + name + '"' + occStr + '>\n' + pad + ind + '<' + P + 'complexType' + (info.mixed ? ' mixed="true"' : '') + '>\n' + info.body + pad + ind + '</' + P + 'complexType>\n' + pad + '</' + P + 'element>\n';
    }
    function complexBody(pr, depth) {
      var attrNames = Object.keys(pr.attrs), kidNames = Object.keys(pr.kids), pad = new Array(depth + 1).join(ind), body = '', summary = '';
      if (!kidNames.length) {
        var ty = inferType(pr.texts), st = simpleOf(pr.texts, ty);
        body = pad + '<' + P + 'simpleContent>\n' + pad + ind + '<' + P + 'extension base="' + P + ty + '">\n' + attrNames.map(function (a) { return attrDecl(a, pr.attrs[a], pr.count, depth + 2); }).join('') + pad + ind + '</' + P + 'extension>\n' + pad + '</' + P + 'simpleContent>\n';
        return { body: body, summary: 'simpleContent ' + ty, mixed: false };
      }
      var ord = orderOf(pr), child = function (n, d) { var kk = pr.kids[n]; var mn = kk.parents === pr.count ? Math.min(kk.min, 1) : 0; return elementDecl(profiles[pr.path + '/' + n], d, occurs(mn, kk.max > 1 ? Infinity : 1)); };
      var mixed = pr.hasText;
      var allOnce = kidNames.every(function (n) { return pr.kids[n].max <= 1; });
      if (ord.ok) { body = pad + '<' + P + 'sequence>\n' + ord.seq.map(function (n) { return child(n, depth + 1); }).join('') + pad + '</' + P + 'sequence>\n'; summary = 'sequence'; }
      else if (allOnce) { body = pad + '<' + P + 'all>\n' + kidNames.map(function (n) { return child(n, depth + 1); }).join('') + pad + '</' + P + 'all>\n'; summary = 'all'; issues.push('ℹ️ ' + t('<' + pr.name + '> 의 자식 순서가 샘플마다 달라 xs:all 로 만들었습니다', 'The child order of <' + pr.name + '> varies between samples, so xs:all is used')); }
      else { body = pad + '<' + P + 'choice minOccurs="0" maxOccurs="unbounded">\n' + kidNames.map(function (n) { var kk = pr.kids[n]; return elementDecl(profiles[pr.path + '/' + n], depth + 1, ''); }).join('') + pad + '</' + P + 'choice>\n'; summary = 'choice (unbounded)'; issues.push('ℹ️ ' + t('<' + pr.name + '> 의 자식이 섞여 나와 xs:choice(무제한)로 만들었습니다. 순서가 정해진 구조라면 샘플을 더 넣어 보세요', 'Children of <' + pr.name + '> are interleaved, so an unbounded xs:choice is used; add more samples if the order is fixed')); }
      body += attrNames.map(function (a) { return attrDecl(a, pr.attrs[a], pr.count, depth); }).join('');
      if (mixed) issues.push('ℹ️ ' + t('<' + pr.name + '> 에 텍스트와 자식 요소가 함께 있어 mixed="true" 로 만들었습니다', '<' + pr.name + '> has text together with child elements, so mixed="true" is used'));
      return { body: body, summary: summary, mixed: mixed };
    }
    var rootProf = profiles['/' + parsed.root.name], rootDecl = elementDecl(rootProf, 1, '');
    var head = '<?xml version="1.0" encoding="UTF-8"?>\n<' + P + 'schema xmlns:' + o.pfx + '="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">\n';
    var out = head + rootDecl + typeDefs.map(function (d) { return d.split('\n').map(function (l) { return l ? ind + l : l; }).join('\n'); }).join('') + '</' + P + 'schema>\n';
    var single = Object.keys(profiles).every(function (p) { return profiles[p].count < 2; });
    if (single) issues.push('⚠️ ' + t('같은 요소가 한 번씩만 나와 반복·선택 여부를 알 수 없습니다. 샘플에 반복되는 항목을 여러 개 넣으면 minOccurs/maxOccurs 가 정확해집니다', 'Every element occurs once, so repetition and optionality cannot be inferred; add several repeated items to the sample for accurate minOccurs / maxOccurs'));
    issues.push(t('샘플에서 추론한 스키마입니다. 타입(숫자·날짜), 필수 여부, 최대 횟수는 보이는 값 기준이니 사람이 검토해 다듬으세요. 생성된 XSD 는 "XSD 검증" 도구로 원본 XML 을 검증해 확인할 수 있습니다', 'The schema is inferred from the sample; types, required-ness and maximum counts reflect only what was seen, so review it. You can check the result by validating the original XML with the XSD validator'));
    return { _status: t('✅ 요소 ' + Object.keys(profiles).length + '종에서 XSD 를 만들었습니다', '✅ Built an XSD from ' + Object.keys(profiles).length + ' element path(s)'), out: out, table: { head: [['경로', 'Path'], ['등장 수', 'Count'], ['자식', 'Children'], ['속성', 'Attributes'], ['타입/구성', 'Type / model']], rows: statRows }, issues: issues };
  }
});
