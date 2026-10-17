/* WooaDev Tool Kit — XPath 1.0 엔진 (tk-xml.js 의 XML 트리 위에서 동작, DOM 불필요)
   지원: 모든 축, 노드 테스트, 술어, 연산자, 변수($name), 핵심 함수 + 자주 쓰는 2.0 함수 일부(ends-with, lower-case, upper-case, matches, replace, abs, min, max, string-join, tokenize) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var XP = TK.xpath = TK.xpath || {};
  var t = function (a, b) { return TK.t(a, b); };

  /** tk-xml 트리 → 문서 순서 번호가 붙은 노드 트리 */
  XP.build = function (parsed) {
    var counter = 0;
    var root = { t: 'root', order: counter++, children: [], attrs: [] };
    function conv(el, parent) {
      var n = { t: 'el', name: el.name, parent: parent, order: counter++, children: [], attrs: [] };
      el.attrs.forEach(function (a) { n.attrs.push({ t: 'attr', name: a[0], value: a[1], parent: n, order: counter++ }); });
      el.children.forEach(function (c) {
        if (c.name !== undefined) n.children.push(conv(c, n));
        else if (c.text !== undefined) { if (c.text !== '') n.children.push({ t: 'text', value: c.text, parent: n, order: counter++ }); }
        else if (c.cdata !== undefined) n.children.push({ t: 'text', value: c.cdata, parent: n, order: counter++, cdata: true });
        else if (c.comment !== undefined) n.children.push({ t: 'comment', value: c.comment, parent: n, order: counter++ });
      });
      return n;
    }
    var r = conv(parsed.root, root); root.children.push(r); root.docEl = r;
    return root;
  };
  function sv(n) {
    if (n.t === 'text' || n.t === 'attr' || n.t === 'comment') return n.value;
    var out = ''; (function w(x) { x.children.forEach(function (c) { if (c.t === 'text') out += c.value; else if (c.t === 'el') w(c); }); })(n); return out;
  }
  XP.stringValue = sv;
  function local(name) { var i = name.indexOf(':'); return i < 0 ? name : name.slice(i + 1); }
  function prefix(name) { var i = name.indexOf(':'); return i < 0 ? '' : name.slice(0, i); }
  function nsUri(n) {
    var p = n.t === 'el' ? prefix(n.name) : n.t === 'attr' ? prefix(n.name) : '', key = p ? 'xmlns:' + p : 'xmlns';
    if (n.t === 'attr' && !p) return '';
    var x = n.t === 'attr' ? n.parent : n;
    while (x && x.t === 'el') { for (var i = 0; i < x.attrs.length; i++) if (x.attrs[i].name === key) return x.attrs[i].value; x = x.parent; }
    return '';
  }
  XP.path = function (n) {
    if (n.t === 'root') return '/';
    var parts = [], x = n;
    while (x && x.t !== 'root') {
      if (x.t === 'attr') parts.unshift('@' + x.name);
      else if (x.t === 'el') { var sib = x.parent.children.filter(function (c) { return c.t === 'el' && c.name === x.name; }); parts.unshift(x.name + (sib.length > 1 ? '[' + (sib.indexOf(x) + 1) + ']' : '')); }
      else { var tt = x.parent.children.filter(function (c) { return c.t === x.t; }); parts.unshift((x.t === 'text' ? 'text()' : 'comment()') + (tt.length > 1 ? '[' + (tt.indexOf(x) + 1) + ']' : '')); }
      x = x.parent;
    }
    return '/' + parts.join('/');
  };
  XP.serialize = function (n, indent) {
    var X = TK.xml;
    function ser(x, d) {
      var pad = indent ? new Array(d + 1).join('  ') : '';
      if (x.t === 'text') return x.cdata ? '<![CDATA[' + x.value + ']]>' : X.escText(x.value);
      if (x.t === 'comment') return '<!--' + x.value + '-->';
      if (x.t === 'attr') return x.name + '="' + X.escAttr(x.value) + '"';
      var at = x.attrs.map(function (a) { return ' ' + a.name + '="' + X.escAttr(a.value) + '"'; }).join('');
      if (!x.children.length) return pad + '<' + x.name + at + '/>';
      var onlyText = x.children.every(function (c) { return c.t === 'text' || c.t === 'comment'; });
      if (!indent || onlyText) return pad + '<' + x.name + at + '>' + x.children.map(function (c) { return ser(c, 0).replace(/^ +/, ''); }).join('') + '</' + x.name + '>';
      return pad + '<' + x.name + at + '>\n' + x.children.filter(function (c) { return c.t !== 'text' || c.value.trim(); }).map(function (c) { return c.t === 'text' ? pad + '  ' + X.escText(c.value.trim()) : ser(c, d + 1); }).join('\n') + '\n' + pad + '</' + x.name + '>';
    }
    if (n.t === 'root') return ser(n.docEl, 0);
    return ser(n, 0);
  };

  /* ---------- 토크나이저 ---------- */
  function tokenize(s) {
    var toks = [], i = 0, m;
    function prevIsOperand() { var p = toks[toks.length - 1]; return p && (p.t === 'num' || p.t === 'str' || p.t === 'name' || p.t === 'var' || p.v === ')' || p.v === ']' || p.v === '.' || p.v === '..' || p.v === '*' && p.nameTest); }
    while (i < s.length) {
      var c = s.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      var rest = s.slice(i);
      if ((m = /^"([^"]*)"|^'([^']*)'/.exec(rest))) { toks.push({ t: 'str', v: m[1] !== undefined ? m[1] : m[2], pos: i }); i += m[0].length; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)/.exec(rest))) { toks.push({ t: 'num', v: parseFloat(m[1]), pos: i }); i += m[0].length; continue; }
      if ((m = /^\$([A-Za-z_][\w.-]*)/.exec(rest))) { toks.push({ t: 'var', v: m[1], pos: i }); i += m[0].length; continue; }
      if ((m = /^(\/\/|\.\.|::|!=|<=|>=)/.exec(rest))) { toks.push({ t: 'op', v: m[1], pos: i }); i += m[1].length; continue; }
      if ('/()[]@,|=<>+-.'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c, pos: i }); i++; continue; }
      if (c === '*') { var isMul = prevIsOperand(); toks.push({ t: 'op', v: '*', pos: i, mul: isMul, nameTest: !isMul }); i++; continue; }
      if ((m = /^[A-Za-z_À-￿][\w.·À-￿-]*(?::(?:[A-Za-z_À-￿][\w.·À-￿-]*|\*))?/.exec(rest))) {
        var nm = m[0];
        if (/:$/.test(nm)) nm = nm.slice(0, -1);
        toks.push({ t: 'name', v: nm, pos: i }); i += nm.length; continue;
      }
      throw new Error(t('위치 ' + (i + 1) + ' 에 알 수 없는 문자 "' + c + '"', 'Unexpected character "' + c + '" at position ' + (i + 1)));
    }
    return toks;
  }
  var AXES = ['child', 'descendant', 'parent', 'ancestor', 'following-sibling', 'preceding-sibling', 'following', 'preceding', 'attribute', 'namespace', 'self', 'descendant-or-self', 'ancestor-or-self'];
  var FUNCS = { last: [0, 0], position: [0, 0], count: [1, 1], id: [1, 1], 'local-name': [0, 1], 'namespace-uri': [0, 1], name: [0, 1], string: [0, 1], concat: [2, 99], 'starts-with': [2, 2], contains: [2, 2], 'substring-before': [2, 2], 'substring-after': [2, 2], substring: [2, 3], 'string-length': [0, 1], 'normalize-space': [0, 1], translate: [3, 3], boolean: [1, 1], not: [1, 1], true: [0, 0], false: [0, 0], lang: [1, 1], number: [0, 1], sum: [1, 1], floor: [1, 1], ceiling: [1, 1], round: [1, 1], 'ends-with': [2, 2], 'lower-case': [1, 1], 'upper-case': [1, 1], matches: [2, 3], replace: [3, 4], abs: [1, 1], min: [1, 1], max: [1, 1], 'string-join': [1, 2], tokenize: [2, 2], 'avg': [1, 1], 'distinct-values': [1, 1], 'data': [0, 1] };

  /* ---------- 파서 ---------- */
  function parse(src) {
    var toks = tokenize(src), p = 0;
    function peek() { return toks[p]; }
    function isOp(v) { return toks[p] && toks[p].t === 'op' && toks[p].v === v && !(v === '*' && !toks[p].mul && false); }
    function isName(v) { return toks[p] && toks[p].t === 'name' && toks[p].v === v; }
    function eat(v) { if (!isOp(v)) throw new Error(t('"' + v + '" 가 필요합니다' + (toks[p] ? ' (위치 ' + (toks[p].pos + 1) + ')' : ' (식이 끝남)'), 'Expected "' + v + '"' + (toks[p] ? ' at position ' + (toks[p].pos + 1) : ' (end of expression)'))); p++; }
    function parseOr() { var l = parseAnd(); while (isName('or')) { p++; l = { k: 'or', l: l, r: parseAnd() }; } return l; }
    function parseAnd() { var l = parseEq(); while (isName('and')) { p++; l = { k: 'and', l: l, r: parseEq() }; } return l; }
    function parseEq() { var l = parseRel(); while (isOp('=') || isOp('!=')) { var op = toks[p++].v; l = { k: 'cmp', op: op, l: l, r: parseRel() }; } return l; }
    function parseRel() { var l = parseAdd(); while (isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) { var op = toks[p++].v; l = { k: 'cmp', op: op, l: l, r: parseAdd() }; } return l; }
    function parseAdd() { var l = parseMul(); while (isOp('+') || isOp('-')) { var op = toks[p++].v; l = { k: 'arith', op: op, l: l, r: parseMul() }; } return l; }
    function parseMul() { var l = parseUnary(); while ((toks[p] && toks[p].t === 'op' && toks[p].v === '*' && toks[p].mul) || isName('div') || isName('mod')) { var op = toks[p++].v; l = { k: 'arith', op: op, l: l, r: parseUnary() }; } return l; }
    function parseUnary() { if (isOp('-')) { p++; return { k: 'neg', e: parseUnary() }; } return parseUnion(); }
    function parseUnion() { var l = parsePath(); while (isOp('|')) { p++; l = { k: 'union', l: l, r: parsePath() }; } return l; }
    function startsStep() { var tk = toks[p]; if (!tk) return false; return tk.t === 'name' || (tk.t === 'op' && (tk.v === '@' || tk.v === '.' || tk.v === '..' || (tk.v === '*' && !tk.mul))); }
    function parsePath() {
      var tk = toks[p], steps = [], abs = false, base = null;
      if (tk && tk.t === 'op' && tk.v === '/') { p++; abs = true; if (!startsStep()) return { k: 'path', abs: true, steps: [] }; }
      else if (tk && tk.t === 'op' && tk.v === '//') { p++; abs = true; steps.push({ axis: 'descendant-or-self', test: { k: 'node' }, preds: [] }); }
      else if (tk && (tk.t === 'str' || tk.t === 'num' || tk.t === 'var' || (tk.t === 'op' && tk.v === '(') || (tk.t === 'name' && toks[p + 1] && toks[p + 1].v === '(' && !/^(node|text|comment|processing-instruction)$/.test(tk.v)))) {
        base = parsePrimary(); var preds = []; while (isOp('[')) { p++; preds.push(parseOr()); eat(']'); }
        if (preds.length) base = { k: 'filter', e: base, preds: preds };
        if (!(isOp('/') || isOp('//'))) return base;
      }
      if (base) { /* 필터식 뒤의 경로 */ if (isOp('//')) { p++; steps.push({ axis: 'descendant-or-self', test: { k: 'node' }, preds: [] }); } else eat('/'); }
      steps.push(parseStep());
      while (isOp('/') || isOp('//')) { if (toks[p++].v === '//') steps.push({ axis: 'descendant-or-self', test: { k: 'node' }, preds: [] }); steps.push(parseStep()); }
      return { k: 'path', abs: abs, base: base, steps: steps };
    }
    function parsePrimary() {
      var tk = toks[p];
      if (tk.t === 'str') { p++; return { k: 'lit', v: tk.v }; }
      if (tk.t === 'num') { p++; return { k: 'lit', v: tk.v }; }
      if (tk.t === 'var') { p++; return { k: 'var', name: tk.v }; }
      if (tk.t === 'op' && tk.v === '(') { p++; var e = parseOr(); eat(')'); return e; }
      var nm = tk.v; p++; eat('(');
      if (!FUNCS[nm]) throw new Error(t('알 수 없는 함수 "' + nm + '()"', 'Unknown function "' + nm + '()"'));
      var args = []; if (!isOp(')')) { args.push(parseOr()); while (isOp(',')) { p++; args.push(parseOr()); } } eat(')');
      if (args.length < FUNCS[nm][0] || args.length > FUNCS[nm][1]) throw new Error(t(nm + '() 의 인자 개수가 맞지 않습니다 (' + args.length + '개)', nm + '() got a wrong number of arguments (' + args.length + ')'));
      return { k: 'call', name: nm, args: args };
    }
    function parseStep() {
      var tk = toks[p]; if (!tk) throw new Error(t('식이 갑자기 끝났습니다', 'The expression ended unexpectedly'));
      var step;
      if (tk.t === 'op' && tk.v === '.') { p++; step = { axis: 'self', test: { k: 'node' }, preds: [] }; }
      else if (tk.t === 'op' && tk.v === '..') { p++; step = { axis: 'parent', test: { k: 'node' }, preds: [] }; }
      else {
        var axis = 'child';
        if (tk.t === 'op' && tk.v === '@') { p++; axis = 'attribute'; }
        else if (tk.t === 'name' && toks[p + 1] && toks[p + 1].v === '::') { if (AXES.indexOf(tk.v) < 0) throw new Error(t('알 수 없는 축 "' + tk.v + '"', 'Unknown axis "' + tk.v + '"')); axis = tk.v; p += 2; }
        var nt = toks[p]; if (!nt) throw new Error(t('노드 테스트가 필요합니다', 'A node test is needed'));
        var test;
        if (nt.t === 'op' && nt.v === '*') { p++; test = { k: 'any' }; }
        else if (nt.t === 'name') {
          p++;
          if (toks[p] && toks[p].v === '(' && /^(node|text|comment|processing-instruction)$/.test(nt.v)) { p++; if (nt.v === 'processing-instruction' && toks[p] && toks[p].t === 'str') p++; eat(')'); test = { k: nt.v }; }
          else if (/:\*$/.test(nt.v)) test = { k: 'prefix', prefix: nt.v.slice(0, -2) };
          else test = { k: 'name', name: nt.v };
        } else throw new Error(t('위치 ' + (nt.pos + 1) + ' 에서 노드 테스트가 필요합니다', 'A node test is needed at position ' + (nt.pos + 1)));
        step = { axis: axis, test: test, preds: [] };
      }
      while (isOp('[')) { p++; step.preds.push(parseOr()); eat(']'); }
      return step;
    }
    var ast = parseOr();
    if (p < toks.length) throw new Error(t('위치 ' + (toks[p].pos + 1) + ' 의 "' + toks[p].v + '" 를 해석할 수 없습니다', 'Cannot parse "' + toks[p].v + '" at position ' + (toks[p].pos + 1)));
    return ast;
  }
  XP.parse = parse;

  /* ---------- 평가 ---------- */
  function isSet(x) { return Array.isArray(x); }
  function toStr(x) { if (isSet(x)) return x.length ? sv(x[0]) : ''; if (typeof x === 'number') return numStr(x); if (typeof x === 'boolean') return x ? 'true' : 'false'; return String(x); }
  function numStr(n) { if (isNaN(n)) return 'NaN'; if (n === Infinity) return 'Infinity'; if (n === -Infinity) return '-Infinity'; if (Object.is(n, -0)) return '0'; return String(n); }
  function toNum(x) { if (typeof x === 'number') return x; if (typeof x === 'boolean') return x ? 1 : 0; var s = toStr(x).trim(); return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : NaN; }
  function toBool(x) { if (isSet(x)) return x.length > 0; if (typeof x === 'number') return x !== 0 && !isNaN(x); if (typeof x === 'string') return x.length > 0; return !!x; }
  function sortUniq(arr) { var seen = [], out = []; arr.forEach(function (n) { if (seen.indexOf(n) < 0) { seen.push(n); out.push(n); } }); return out.sort(function (a, b) { return a.order - b.order; }); }
  function axisNodes(axis, n) {
    var out = [];
    function desc(x) { (x.children || []).forEach(function (c) { out.push(c); desc(c); }); }
    switch (axis) {
      case 'child': return n.children ? n.children.slice() : [];
      case 'attribute': return n.t === 'el' ? n.attrs.slice() : [];
      case 'self': return [n];
      case 'parent': return n.parent ? [n.parent] : [];
      case 'descendant': if (n.children) desc(n); return out;
      case 'descendant-or-self': out.push(n); if (n.children) desc(n); return out;
      case 'ancestor': { var a = n.parent; while (a) { out.push(a); a = a.parent; } return out; }
      case 'ancestor-or-self': { out.push(n); var b = n.parent; while (b) { out.push(b); b = b.parent; } return out; }
      case 'following-sibling': { if (!n.parent || n.t === 'attr') return []; var sib = n.parent.children, i = sib.indexOf(n); return sib.slice(i + 1); }
      case 'preceding-sibling': { if (!n.parent || n.t === 'attr') return []; var sib2 = n.parent.children, j = sib2.indexOf(n); return sib2.slice(0, j).reverse(); }
      case 'following': { var x = n; if (x.t === 'attr') x = x.parent; while (x && x.parent) { var s2 = x.parent.children, k = s2.indexOf(x); for (var q = k + 1; q < s2.length; q++) { out.push(s2[q]); if (s2[q].children) desc(s2[q]); } x = x.parent; } return out; }
      case 'preceding': { var y = n; if (y.t === 'attr') y = y.parent; var ancestors = []; var an = y.parent; while (an) { ancestors.push(an); an = an.parent; } while (y && y.parent) { var s3 = y.parent.children, k2 = s3.indexOf(y); for (var r = k2 - 1; r >= 0; r--) { var tmp = []; (function w(z) { tmp.push(z); if (z.children) z.children.slice().reverse().forEach(w); })(s3[r]); tmp.forEach(function (z) { out.push(z); }); } y = y.parent; } return out; }
      case 'namespace': return [];
    }
    return out;
  }
  function testNode(test, n, axis) {
    var principal = axis === 'attribute' ? 'attr' : 'el';
    switch (test.k) {
      case 'node': return true;
      case 'text': return n.t === 'text';
      case 'comment': return n.t === 'comment';
      case 'processing-instruction': return false;
      case 'any': return n.t === principal;
      case 'prefix': return n.t === principal && prefix(n.name) === test.prefix;
      case 'name': return n.t === principal && (n.name === test.name || (test.name.indexOf(':') < 0 && local(n.name) === test.name && false));
    }
    return false;
  }
  XP.evaluate = function (src, doc, opts) {
    opts = opts || {};
    var ast = typeof src === 'string' ? parse(src) : src, vars = opts.vars || {}, budget = 400000;
    function evalPreds(nodes, preds, ctxVars) {
      preds.forEach(function (pr) {
        var size = nodes.length, kept = [];
        nodes.forEach(function (n, i) { var r = ev(pr, { node: n, pos: i + 1, size: size }); var keep = typeof r === 'number' ? r === i + 1 : toBool(r); if (keep) kept.push(n); });
        nodes = kept;
      });
      return nodes;
    }
    function ev(e, c) {
      if (--budget < 0) throw new Error(t('식이 너무 복잡하거나 문서가 너무 큽니다', 'The expression is too complex or the document too large'));
      switch (e.k) {
        case 'lit': return e.v;
        case 'var': if (!(e.name in vars)) throw new Error(t('정의되지 않은 변수 $' + e.name, 'Undefined variable $' + e.name)); return vars[e.name];
        case 'neg': return -toNum(ev(e.e, c));
        case 'or': return toBool(ev(e.l, c)) || toBool(ev(e.r, c));
        case 'and': return toBool(ev(e.l, c)) && toBool(ev(e.r, c));
        case 'arith': { var a = toNum(ev(e.l, c)), b = toNum(ev(e.r, c)); return e.op === '+' ? a + b : e.op === '-' ? a - b : e.op === '*' ? a * b : e.op === 'div' ? a / b : a % b; }
        case 'cmp': return compare(e.op, ev(e.l, c), ev(e.r, c));
        case 'union': { var l = ev(e.l, c), r = ev(e.r, c); if (!isSet(l) || !isSet(r)) throw new Error(t('| 는 노드 집합에만 쓸 수 있습니다', 'The | operator works on node-sets only')); return sortUniq(l.concat(r)); }
        case 'filter': { var base = ev(e.e, c); if (!isSet(base)) throw new Error(t('술어는 노드 집합에만 쓸 수 있습니다', 'Predicates work on node-sets only')); return evalPreds(sortUniq(base), e.preds); }
        case 'path': {
          var cur;
          if (e.base) { cur = ev(e.base, c); if (!isSet(cur)) throw new Error(t('경로의 시작은 노드 집합이어야 합니다', 'A path must start from a node-set')); }
          else if (e.abs) cur = [rootOf(c.node)];
          else cur = [c.node];
          e.steps.forEach(function (st) {
            var next = [];
            cur.forEach(function (n) {
              var cand = axisNodes(st.axis, n).filter(function (x) { return testNode(st.test, x, st.axis); });
              /* 역방향 축은 위치가 가까운 순 */
              cand = evalPreds(cand, st.preds);
              next = next.concat(cand);
            });
            cur = sortUniq(next);
          });
          return cur;
        }
        case 'call': return call(e, c);
      }
      throw new Error('bad node');
    }
    function rootOf(n) { while (n.parent) n = n.parent; return n; }
    function compare(op, l, r) {
      if (isSet(l) && isSet(r)) { for (var i = 0; i < l.length; i++) for (var j = 0; j < r.length; j++) if (cmp1(op, sv(l[i]), sv(r[j]), 'str')) return true; return false; }
      if (isSet(l) || isSet(r)) {
        var set = isSet(l) ? l : r, other = isSet(l) ? r : l, flip = !isSet(l);
        if (typeof other === 'boolean') { var b1 = toBool(set); return flip ? cmpv(op, other, b1) : cmpv(op, b1, other); }
        for (var k = 0; k < set.length; k++) { var sval = sv(set[k]); var res = typeof other === 'number' ? (flip ? cmp1(op, other, toNum(sval), 'num') : cmp1(op, toNum(sval), other, 'num')) : (flip ? cmp1(op, other, sval, 'str') : cmp1(op, sval, other, 'str')); if (res) return true; }
        return false;
      }
      return cmpv(op, l, r);
    }
    function cmpv(op, l, r) { if (op === '=' || op === '!=') { var eq; if (typeof l === 'boolean' || typeof r === 'boolean') eq = toBool(l) === toBool(r); else if (typeof l === 'number' || typeof r === 'number') eq = toNum(l) === toNum(r); else eq = toStr(l) === toStr(r); return op === '=' ? eq : !eq; } var a = toNum(l), b = toNum(r); return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b; }
    function cmp1(op, a, b, kind) { if (op === '=' || op === '!=') { var eq = kind === 'num' ? toNum(a) === toNum(b) : String(a) === String(b); if (kind === 'str' && (typeof a !== 'string' || typeof b !== 'string')) eq = toNum(a) === toNum(b); return op === '=' ? eq : !eq; } var x = toNum(a), y = toNum(b); return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y; }
    function ctxNode(args, c) { if (args.length) { var s = ev(args[0], c); if (!isSet(s)) throw new Error(t('노드 집합이 필요합니다', 'A node-set is required')); return s[0]; } return c.node; }
    function call(e, c) {
      var nm = e.name, a = e.args;
      function arg(i) { return ev(a[i], c); }
      switch (nm) {
        case 'last': return c.size;
        case 'position': return c.pos;
        case 'count': { var s = arg(0); if (!isSet(s)) throw new Error(t('count() 는 노드 집합이 필요합니다', 'count() needs a node-set')); return s.length; }
        case 'local-name': { var n = ctxNode(a, c); return n && n.name ? local(n.name) : ''; }
        case 'name': { var n2 = ctxNode(a, c); return n2 && n2.name ? n2.name : ''; }
        case 'namespace-uri': { var n3 = ctxNode(a, c); return n3 && n3.name ? nsUri(n3) : ''; }
        case 'string': return a.length ? toStr(arg(0)) : sv(c.node);
        case 'data': return a.length ? toStr(arg(0)) : sv(c.node);
        case 'concat': return a.map(function (x) { return toStr(ev(x, c)); }).join('');
        case 'starts-with': return toStr(arg(0)).indexOf(toStr(arg(1))) === 0;
        case 'ends-with': { var s1 = toStr(arg(0)), s2 = toStr(arg(1)); return s1.length >= s2.length && s1.slice(s1.length - s2.length) === s2; }
        case 'contains': return toStr(arg(0)).indexOf(toStr(arg(1))) >= 0;
        case 'substring-before': { var x = toStr(arg(0)), y = toStr(arg(1)), i = x.indexOf(y); return i < 0 ? '' : x.slice(0, i); }
        case 'substring-after': { var x2 = toStr(arg(0)), y2 = toStr(arg(1)), i2 = x2.indexOf(y2); return i2 < 0 ? '' : x2.slice(i2 + y2.length); }
        case 'substring': { var str = toStr(arg(0)), st = Math.round(toNum(arg(1))); if (a.length === 2) { return st <= 1 ? str : str.slice(Math.max(0, st - 1)); } var ln = Math.round(toNum(arg(2))); if (isNaN(st) || isNaN(ln)) return ''; var from = Math.max(st, 1), to = st + ln; return str.slice(from - 1, Math.max(from - 1, to - 1)); }
        case 'string-length': return (a.length ? toStr(arg(0)) : sv(c.node)).length;
        case 'normalize-space': return (a.length ? toStr(arg(0)) : sv(c.node)).replace(/\s+/g, ' ').trim();
        case 'translate': { var src = toStr(arg(0)), from2 = toStr(arg(1)), to2 = toStr(arg(2)); return src.split('').map(function (ch) { var k = from2.indexOf(ch); return k < 0 ? ch : (k < to2.length ? to2.charAt(k) : ''); }).join(''); }
        case 'boolean': return toBool(arg(0));
        case 'not': return !toBool(arg(0));
        case 'true': return true;
        case 'false': return false;
        case 'lang': { var want = toStr(arg(0)).toLowerCase(), nn = c.node; while (nn && nn.t !== 'root') { var an = nn.t === 'el' ? nn.attrs.filter(function (z) { return z.name === 'xml:lang'; })[0] : null; if (an) { var have = an.value.toLowerCase(); return have === want || have.indexOf(want + '-') === 0; } nn = nn.parent; } return false; }
        case 'id': return [];
        case 'number': return a.length ? toNum(arg(0)) : toNum(sv(c.node));
        case 'sum': { var ss = arg(0); if (!isSet(ss)) throw new Error(t('sum() 은 노드 집합이 필요합니다', 'sum() needs a node-set')); return ss.reduce(function (acc, z) { return acc + toNum(sv(z)); }, 0); }
        case 'avg': { var av = arg(0); if (!isSet(av) || !av.length) return NaN; return av.reduce(function (acc, z) { return acc + toNum(sv(z)); }, 0) / av.length; }
        case 'min': case 'max': { var mm = arg(0); if (!isSet(mm) || !mm.length) return NaN; var nums = mm.map(function (z) { return toNum(sv(z)); }); return nm === 'min' ? Math.min.apply(null, nums) : Math.max.apply(null, nums); }
        case 'abs': return Math.abs(toNum(arg(0)));
        case 'floor': return Math.floor(toNum(arg(0)));
        case 'ceiling': return Math.ceil(toNum(arg(0)));
        case 'round': { var rv = toNum(arg(0)); return isNaN(rv) || !isFinite(rv) ? rv : Math.floor(rv + 0.5); }
        case 'lower-case': return toStr(arg(0)).toLowerCase();
        case 'upper-case': return toStr(arg(0)).toUpperCase();
        case 'matches': { try { return new RegExp(toStr(arg(1)), a.length > 2 ? toStr(arg(2)).replace(/[^imsx]/g, '').replace('x', '') : '').test(toStr(arg(0))); } catch (er) { throw new Error(t('matches(): 정규식 오류 — ', 'matches(): invalid regex — ') + er.message); } }
        case 'replace': { try { return toStr(arg(0)).replace(new RegExp(toStr(arg(1)), 'g' + (a.length > 3 ? toStr(arg(3)).replace(/[^ims]/g, '') : '')), toStr(arg(2)).replace(/\$(\d)/g, '$$$1')); } catch (er2) { throw new Error(t('replace(): 정규식 오류 — ', 'replace(): invalid regex — ') + er2.message); } }
        case 'string-join': { var sj = arg(0); return (isSet(sj) ? sj.map(sv) : [toStr(sj)]).join(a.length > 1 ? toStr(arg(1)) : ''); }
        case 'tokenize': return null;
        case 'distinct-values': { var dv = arg(0); if (!isSet(dv)) return dv; var seenv = {}, outn = []; dv.forEach(function (z) { var k3 = sv(z); if (!seenv[k3]) { seenv[k3] = 1; outn.push(z); } }); return outn; }
      }
      throw new Error('bad call');
    }
    var res = ev(ast, { node: doc, pos: 1, size: 1 });
    if (res === null) throw new Error(t('이 함수는 지원하지 않습니다', 'This function is not supported'));
    return res;
  };
  XP.typeOf = function (x) { return isSet(x) ? 'node-set' : typeof x === 'number' ? 'number' : typeof x === 'boolean' ? 'boolean' : 'string'; };
  XP.toStr = toStr;
})(typeof window !== 'undefined' ? window : globalThis);
