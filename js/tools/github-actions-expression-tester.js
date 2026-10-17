TK.tool('github-actions-expression-tester', {
  inputs: [
    { id: 'expr', label: ['표현식 (${{ … }} 로 감싸도 되고, ${{ }} 가 섞인 문장도 됩니다)', 'Expression (with or without ${{ … }}; text containing ${{ }} segments works too)'], rows: 3, sample: "github.ref == 'refs/heads/main' && contains(github.event.head_commit.message, '[deploy]') && !cancelled()" },
    { id: 'ctx', label: ['컨텍스트 (JSON: github, env, vars, steps, needs, matrix, inputs, runner, job, secrets …)', 'Contexts (JSON: github, env, vars, steps, needs, matrix, inputs, runner, job, secrets …)'], rows: 14, sample: '{\n  "github": {\n    "ref": "refs/heads/main",\n    "event_name": "push",\n    "actor": "octocat",\n    "event": { "head_commit": { "message": "Fix bug [deploy]" }, "commits": [ { "message": "a" }, { "message": "b" } ] }\n  },\n  "env": { "NODE_ENV": "production" },\n  "matrix": { "os": "ubuntu-latest", "node": 20 },\n  "steps": { "build": { "outcome": "success", "outputs": { "version": "1.2.3" } } },\n  "needs": { "test": { "result": "success" } }\n}' }
  ],
  options: [{ id: 'status', type: 'select', label: ['잡 상태 (success(), failure() 등에 사용)', 'Job status (used by success(), failure() …)'], choices: [['success', 'success'], ['failure', 'failure'], ['cancelled', 'cancelled']], default: 'success' }],
  outputs: [{ id: 'table', label: ['평가 과정', 'Evaluation steps'], kind: 'table' }, { id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], src = String(v.expr || '').trim();
    if (!src) throw new Error(t('표현식을 입력하세요', 'Enter an expression'));
    var ctx; try { ctx = String(v.ctx || '').trim() ? JSON.parse(v.ctx) : {}; } catch (e) { throw new Error(t('컨텍스트 JSON 구문 오류: ', 'Context JSON syntax error: ') + e.message); }
    if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) throw new Error(t('컨텍스트는 JSON 객체여야 합니다', 'Contexts must be a JSON object'));
    var trace = [];
    function typeOf(x) { return x === null || x === undefined ? 'null' : Array.isArray(x) ? 'array' : typeof x === 'object' ? 'object' : typeof x; }
    function show(x) { var ty = typeOf(x); if (ty === 'string') return JSON.stringify(x); if (ty === 'array' || ty === 'object') { var j = JSON.stringify(x); return j.length > 80 ? j.slice(0, 80) + '…' : j; } return ty === 'null' ? 'null' : String(x); }
    function toNum(x) { var ty = typeOf(x); if (ty === 'null') return 0; if (ty === 'boolean') return x ? 1 : 0; if (ty === 'number') return x; if (ty === 'string') { var s = x.trim(); if (s === '') return 0; if (/^[-+]?0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16); if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s); if (/^[-+]?Infinity$/.test(s)) return s.charAt(0) === '-' ? -Infinity : Infinity; return NaN; } return NaN; }
    function toStr(x) { var ty = typeOf(x); if (ty === 'null') return ''; if (ty === 'array' || ty === 'object') return JSON.stringify(x); return String(x); }
    function truthy(x) { return !(x === false || x === 0 || x === '' || x === null || x === undefined || (typeof x === 'number' && Object.is(x, -0))); }
    function cmp(a, b) { /* 반환 {eq, lt} 또는 null(비교 불가=NaN) */
      var ta = typeOf(a), tb = typeOf(b);
      if (ta === tb && (ta === 'array' || ta === 'object')) return { eq: a === b, ord: null };
      if (ta === tb && ta === 'string') { var x = a.toLowerCase(), y = b.toLowerCase(); return { eq: x === y, ord: x < y ? -1 : x > y ? 1 : 0 }; }
      if (ta === 'null' && tb === 'null') return { eq: true, ord: 0 };
      var na = toNum(a), nb = toNum(b); if (isNaN(na) || isNaN(nb)) return { eq: false, ord: null };
      return { eq: na === nb, ord: na < nb ? -1 : na > nb ? 1 : 0 };
    }
    function looseEq(a, b) { return cmp(a, b).eq; }
    /* 토크나이저 */
    function tokenize(s) {
      var toks = [], i = 0, m;
      while (i < s.length) {
        var c = s.charAt(i);
        if (/\s/.test(c)) { i++; continue; }
        var rest = s.slice(i), prev = toks.length ? toks[toks.length - 1] : null, afterValue = prev && (prev.t === 'num' || prev.t === 'str' || prev.t === 'id' || prev.v === ')' || prev.v === ']');
        if ((m = /^(0x[0-9a-fA-F]+|[0-9]+\.?[0-9]*(?:[eE][-+]?[0-9]+)?|\.[0-9]+(?:[eE][-+]?[0-9]+)?)/.exec(rest)) && !(prev && prev.v === '.' && false)) { toks.push({ t: 'num', v: m[1], pos: i, end: i + m[1].length }); i += m[1].length; continue; }
        if (c === '-' && !afterValue && (m = /^-(0x[0-9a-fA-F]+|[0-9]+\.?[0-9]*(?:[eE][-+]?[0-9]+)?|\.[0-9]+)/.exec(rest))) { toks.push({ t: 'num', v: m[0], pos: i, end: i + m[0].length }); i += m[0].length; continue; }
        if (c === '\'') { var j = i + 1, out = ''; while (j < s.length) { if (s.charAt(j) === '\'') { if (s.charAt(j + 1) === '\'') { out += '\''; j += 2; continue; } break; } out += s.charAt(j); j++; } if (j >= s.length) throw new Error(t('문자열이 닫히지 않았습니다 (위치 ' + (i + 1) + ')', 'Unterminated string (position ' + (i + 1) + ')')); toks.push({ t: 'str', v: out, pos: i, end: j + 1 }); i = j + 1; continue; }
        if ((m = /^(&&|\|\||==|!=|<=|>=)/.exec(rest))) { toks.push({ t: 'op', v: m[1], pos: i, end: i + 2 }); i += 2; continue; }
        if ('<>!()[].,*'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c, pos: i, end: i + 1 }); i++; continue; }
        if ((m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(rest))) { toks.push({ t: 'id', v: m[0], pos: i, end: i + m[0].length }); i += m[0].length; continue; }
        throw new Error(t('위치 ' + (i + 1) + ' 에 알 수 없는 문자 "' + c + '" 가 있습니다', 'Unexpected character "' + c + '" at position ' + (i + 1)));
      }
      return toks;
    }
    var FN = { contains: [2, 2], startswith: [2, 2], endswith: [2, 2], format: [1, 99], join: [1, 2], tojson: [1, 1], fromjson: [1, 1], hashfiles: [1, 99], success: [0, 0], always: [0, 0], cancelled: [0, 0], failure: [0, 0] };
    function parse(s) {
      var toks = tokenize(s), p = 0;
      function peek() { return toks[p]; }
      function isOp(v) { return toks[p] && toks[p].t === 'op' && toks[p].v === v; }
      function expectOp(v) { if (!isOp(v)) throw new Error(t('"' + v + '" 가 필요합니다' + (toks[p] ? ' (위치 ' + (toks[p].pos + 1) + ' 의 "' + toks[p].v + '")' : ' (표현식이 끝남)'), 'Expected "' + v + '"' + (toks[p] ? ' at position ' + (toks[p].pos + 1) + ' (found "' + toks[p].v + '")' : ' (end of expression)'))); p++; }
      function node(type, a, startTok, endPos) { a.type = type; a.start = startTok; a.end = endPos; return a; }
      function parseOr() { var l = parseAnd(); while (isOp('||')) { p++; var r = parseAnd(); l = node('or', { l: l, r: r }, l.start, r.end); } return l; }
      function parseAnd() { var l = parseCmp(); while (isOp('&&')) { p++; var r = parseCmp(); l = node('and', { l: l, r: r }, l.start, r.end); } return l; }
      function parseCmp() { var l = parseUnary(); while (toks[p] && toks[p].t === 'op' && ['==', '!=', '<', '<=', '>', '>='].indexOf(toks[p].v) >= 0) { var op = toks[p].v; p++; var r = parseUnary(); l = node('cmp', { op: op, l: l, r: r }, l.start, r.end); } return l; }
      function parseUnary() { if (isOp('!')) { var st = toks[p].pos; p++; var e = parseUnary(); return node('not', { e: e }, st, e.end); } return parsePostfix(); }
      function parsePostfix() {
        var e = parsePrimary();
        while (true) {
          if (isOp('.')) { p++; var tk = toks[p]; if (!tk) throw new Error(t('"." 뒤에 이름이 필요합니다', 'A name is needed after "."')); if (tk.t === 'op' && tk.v === '*') { p++; e = node('star', { e: e }, e.start, tk.end); } else if (tk.t === 'id' || tk.t === 'num') { p++; e = node('prop', { e: e, name: tk.v }, e.start, tk.end); } else throw new Error(t('"." 뒤에 이름이 필요합니다 (위치 ' + (tk.pos + 1) + ')', 'A name is needed after "." (position ' + (tk.pos + 1) + ')')); }
          else if (isOp('[')) { p++; var ix = parseOr(); var close = toks[p]; expectOp(']'); e = node('index', { e: e, ix: ix }, e.start, close.end); }
          else break;
        }
        return e;
      }
      function parsePrimary() {
        var tk = toks[p]; if (!tk) throw new Error(t('표현식이 갑자기 끝났습니다', 'The expression ended unexpectedly'));
        if (tk.t === 'num') { p++; var nv = /^-?0x/i.test(tk.v) ? parseInt(tk.v, 16) : Number(tk.v); return node('lit', { v: nv }, tk.pos, tk.end); }
        if (tk.t === 'str') { p++; return node('lit', { v: tk.v }, tk.pos, tk.end); }
        if (tk.t === 'op' && tk.v === '(') { p++; var e = parseOr(); var cl = toks[p]; expectOp(')'); return node('group', { e: e }, tk.pos, cl.end); }
        if (tk.t === 'id') {
          var low = tk.v.toLowerCase();
          if (low === 'true' || low === 'false') { p++; return node('lit', { v: low === 'true' }, tk.pos, tk.end); }
          if (low === 'null') { p++; return node('lit', { v: null }, tk.pos, tk.end); }
          if (low === 'nan') { p++; return node('lit', { v: NaN }, tk.pos, tk.end); }
          if (low === 'infinity') { p++; return node('lit', { v: Infinity }, tk.pos, tk.end); }
          p++;
          if (isOp('(')) {
            if (!FN[low]) throw new Error(t('알 수 없는 함수 "' + tk.v + '" — 사용 가능: contains, startsWith, endsWith, format, join, toJSON, fromJSON, hashFiles, success, failure, always, cancelled', 'Unknown function "' + tk.v + '" — available: contains, startsWith, endsWith, format, join, toJSON, fromJSON, hashFiles, success, failure, always, cancelled'));
            p++; var args = [];
            if (!isOp(')')) { args.push(parseOr()); while (isOp(',')) { p++; args.push(parseOr()); } }
            var cl2 = toks[p]; expectOp(')');
            if (args.length < FN[low][0] || args.length > FN[low][1]) throw new Error(t(tk.v + '() 의 인자 수가 맞지 않습니다 (' + args.length + '개 전달)', tk.v + '() got a wrong number of arguments (' + args.length + ')'));
            return node('call', { name: low, label: tk.v, args: args }, tk.pos, cl2.end);
          }
          return node('ctx', { name: tk.v }, tk.pos, tk.end);
        }
        throw new Error(t('위치 ' + (tk.pos + 1) + ' 의 "' + tk.v + '" 는 여기에 올 수 없습니다', 'Unexpected "' + tk.v + '" at position ' + (tk.pos + 1)));
      }
      var ast = parseOr();
      if (p < toks.length) throw new Error(t('위치 ' + (toks[p].pos + 1) + ' 의 "' + toks[p].v + '" 뒤를 해석할 수 없습니다', 'Cannot parse past "' + toks[p].v + '" at position ' + (toks[p].pos + 1)));
      return ast;
    }
    function lookup(obj, name) {
      if (obj === null || obj === undefined || typeof obj !== 'object') return null;
      if (Array.isArray(obj)) { return /^\d+$/.test(name) ? (obj[+name] === undefined ? null : obj[+name]) : null; }
      if (Object.prototype.hasOwnProperty.call(obj, name)) return obj[name];
      var low = String(name).toLowerCase(); var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) if (keys[i].toLowerCase() === low) return obj[keys[i]];
      return null;
    }
    function fmt(args) {
      var f = toStr(args[0]), res = '', i = 0;
      while (i < f.length) {
        var c = f.charAt(i);
        if (c === '{') { if (f.charAt(i + 1) === '{') { res += '{'; i += 2; continue; } var m = /^\{(\d+)\}/.exec(f.slice(i)); if (!m) throw new Error(t('format() 형식 문자열의 중괄호가 올바르지 않습니다', 'Invalid braces in the format() string')); var n = +m[1]; if (n + 1 >= args.length) throw new Error(t('format() 의 {' + n + '} 에 해당하는 인자가 없습니다', 'format() has no argument for {' + n + '}')); res += toStr(args[n + 1]); i += m[0].length; continue; }
        if (c === '}') { if (f.charAt(i + 1) === '}') { res += '}'; i += 2; continue; } throw new Error(t('format() 형식 문자열의 중괄호가 올바르지 않습니다', 'Invalid braces in the format() string')); }
        res += c; i++;
      }
      return res;
    }
    function ev(n) {
      var val;
      switch (n.type) {
        case 'lit': val = n.v; break;
        case 'group': val = ev(n.e); break;
        case 'ctx': { var name = n.name.toLowerCase(); val = lookup(ctx, n.name); if (val === null && name === 'github' && !('github' in ctx)) issues.push('ℹ️ ' + t('github 컨텍스트가 JSON 에 없어 null 로 평가됩니다', 'The github context is missing from the JSON, so it evaluates to null')); else if (val === null && !(Object.keys(ctx).some(function (k) { return k.toLowerCase() === name; }))) issues.push('ℹ️ ' + t('"' + n.name + '" 컨텍스트가 JSON 에 없어 null 로 평가됩니다', 'Context "' + n.name + '" is missing from the JSON and evaluates to null')); break; }
        case 'prop': { var pb = ev(n.e); if (Array.isArray(pb) && pb.__filter) { val = pb.map(function (x) { return lookup(x, n.name); }).filter(function (x) { return x !== null; }); val.__filter = true; } else val = lookup(pb, n.name); break; }
        case 'index': { var base = ev(n.e), ix = ev(n.ix); val = Array.isArray(base) ? (typeof ix === 'number' || /^\d+$/.test(String(ix)) ? lookup(base, String(ix)) : null) : lookup(base, toStr(ix)); break; }
        case 'star': { var b2 = ev(n.e); val = Array.isArray(b2) ? b2.slice() : (b2 && typeof b2 === 'object' ? Object.keys(b2).map(function (k) { return b2[k]; }) : []); val.__filter = true; break; }
        case 'not': val = !truthy(ev(n.e)); break;
        case 'and': { var l = ev(n.l); val = truthy(l) ? ev(n.r) : l; break; }
        case 'or': { var l2 = ev(n.l); val = truthy(l2) ? l2 : ev(n.r); break; }
        case 'cmp': { var a = ev(n.l), b = ev(n.r), c = cmp(a, b); if (n.op === '==') val = c.eq; else if (n.op === '!=') val = !c.eq; else if (c.ord === null) val = false; else val = n.op === '<' ? c.ord < 0 : n.op === '<=' ? c.ord <= 0 : n.op === '>' ? c.ord > 0 : c.ord >= 0; break; }
        case 'call': {
          var args = n.args.map(ev), nm = n.name;
          if (nm === 'contains') { var sv = args[0], it = args[1]; if (Array.isArray(sv)) val = sv.some(function (x) { return looseEq(x, it); }); else val = toStr(sv).toLowerCase().indexOf(toStr(it).toLowerCase()) >= 0; }
          else if (nm === 'startswith') val = toStr(args[0]).toLowerCase().indexOf(toStr(args[1]).toLowerCase()) === 0;
          else if (nm === 'endswith') { var s1 = toStr(args[0]).toLowerCase(), s2 = toStr(args[1]).toLowerCase(); val = s1.length >= s2.length && s1.slice(s1.length - s2.length) === s2; }
          else if (nm === 'format') val = fmt(args);
          else if (nm === 'join') { var sep = args.length > 1 ? toStr(args[1]) : ','; val = Array.isArray(args[0]) ? args[0].map(toStr).join(sep) : toStr(args[0]); }
          else if (nm === 'tojson') val = JSON.stringify(args[0] === undefined ? null : args[0], null, 2);
          else if (nm === 'fromjson') { try { val = JSON.parse(toStr(args[0])); } catch (e) { throw new Error(t('fromJSON(): JSON 구문 오류 — ', 'fromJSON(): invalid JSON — ') + e.message); } }
          else if (nm === 'hashfiles') { val = '(hashFiles ' + args.map(toStr).join(', ') + ')'; issues.push('ℹ️ ' + t('hashFiles() 는 러너의 파일이 필요해 여기서는 계산할 수 없습니다. 자리표시 문자열을 반환합니다', 'hashFiles() needs the runner\'s files and cannot be computed here; a placeholder string is returned')); }
          else if (nm === 'success') val = o.status === 'success';
          else if (nm === 'failure') val = o.status === 'failure';
          else if (nm === 'cancelled') val = o.status === 'cancelled';
          else if (nm === 'always') val = true;
          break;
        }
      }
      if (n.type !== 'lit' && n.type !== 'group') trace.push({ s: n.start, e: n.end, v: val, acc: /^(ctx|prop|index|star)$/.test(n.type) });
      return val;
    }
    /* ${{ }} 조각 분리 */
    var segs = [], re = /\$\{\{([\s\S]*?)\}\}/g, last = 0, m, interpolated = /\$\{\{/.test(src);
    if (interpolated) {
      while ((m = re.exec(src))) { if (m.index > last) segs.push({ lit: src.slice(last, m.index) }); segs.push({ ex: m[1], at: m.index + 3 }); last = m.index + m[0].length; }
      if (last < src.length) segs.push({ lit: src.slice(last) });
      if (!segs.some(function (x) { return x.ex !== undefined; })) throw new Error(t('${{ 가 닫히지 않았습니다', '${{ is not closed'));
    } else segs = [{ ex: src, at: 0, bare: true }];
    var rows = [], finals = [], single = segs.filter(function (x) { return x.ex !== undefined; }).length === 1 && segs.length === 1;
    segs.forEach(function (sg) {
      if (sg.lit !== undefined) { finals.push(sg.lit); return; }
      var ast = parse(sg.ex); trace = []; var val = ev(ast), text = sg.ex;
      trace = trace.filter(function (x) { return !(x.acc && trace.some(function (y) { return y.acc && y.s === x.s && y.e > x.e; })); });
      trace.forEach(function (x) { var seg = text.slice(x.s, x.e).trim(); if (seg) rows.push([seg.length > 70 ? seg.slice(0, 70) + '…' : seg, show(x.v), typeOf(x.v)]); });
      var seen = {}; rows = rows.filter(function (r) { var k = r[0] + '|' + r[1]; if (seen[k]) return false; seen[k] = 1; return true; });
      sg.val = val; finals.push(single || sg.bare ? val : toStr(val));
    });
    var result = single || segs[0].bare ? segs[0].val : finals.join('');
    var rt = typeOf(result);
    var outTxt = (rt === 'object' || rt === 'array') ? JSON.stringify(result, null, 2) : rt === 'string' ? result : String(result === null ? 'null' : result);
    if (interpolated && !single) issues.push(t('${{ }} 가 섞인 문장이라 각 값을 문자열로 바꿔 이어 붙였습니다 (객체는 JSON)', 'The text mixes ${{ }} segments, so each value was converted to a string and joined (objects as JSON)'));
    if (/==\s*(true|false)\b/i.test(src)) issues.push('ℹ️ ' + t('불리언과 문자열을 == 로 비교하면 숫자로 바뀌어 비교됩니다 ("true" == true 는 false). 문자열 출력은 \'true\' 와 비교하세요', 'Comparing a boolean with a string using == coerces both to numbers ("true" == true is false); compare outputs with \'true\''));
    if (/\bif:\s*/.test(src) === false && /^\s*\$\{\{[\s\S]*\}\}\s*[^\s]/.test(src)) issues.push('ℹ️ ' + t('if: 에서 ${{ }} 뒤에 다른 글자가 붙으면 문자열이 되어 항상 참입니다', 'In if:, trailing text after ${{ }} turns it into a string that is always true'));
    issues.push(t('GitHub Actions 규칙을 따릅니다: 문자열 비교는 대소문자를 구분하지 않고, 서로 다른 타입은 숫자로 바꿔 비교하며, null·false·0·빈 문자열이 거짓입니다', 'Follows GitHub Actions rules: string comparison ignores case, different types are compared as numbers, and null, false, 0 and "" are falsy'));
    return { _status: t('✅ 결과: ' + show(result) + ' (' + rt + ')', '✅ Result: ' + show(result) + ' (' + rt + ')'), table: { head: [['부분식', 'Sub-expression'], ['값', 'Value'], ['타입', 'Type']], rows: rows }, out: outTxt, issues: issues };
  }
});
