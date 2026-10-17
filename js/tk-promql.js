/* WooaDev Tool Kit — PromQL 파서 · 타입 검사 · 포매터 · 설명 생성기 (평가는 하지 않음) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var P = TK.promql = TK.promql || {};
  var t = function (a, b) { return TK.t(a, b); };
  function fail(msg, pos) { var e = new Error(msg); e.pos = pos; throw e; }

  var AGGS = { sum: 1, avg: 1, min: 1, max: 1, count: 1, group: 1, stddev: 1, stdvar: 1, topk: 'p', bottomk: 'p', quantile: 'p', count_values: 'p', limitk: 'p', limit_ratio: 'p' };
  var PARAM_TYPE = { topk: 'scalar', bottomk: 'scalar', quantile: 'scalar', count_values: 'string', limitk: 'scalar', limit_ratio: 'scalar' };
  var CMP = { '==': 1, '!=': 1, '>': 1, '<': 1, '>=': 1, '<=': 1 };
  var SETOP = { and: 1, or: 1, unless: 1 };
  /* 함수 시그니처: args 타입(i=instant r=range s=scalar t=string), ret, 선택 인자 수(opt), 가변(v) */
  var I = 'i', R = 'r', S = 's', T = 't';
  var FN = {
    abs: [[I], I], absent: [[I], I], absent_over_time: [[R], I], acos: [[I], I], acosh: [[I], I], asin: [[I], I], asinh: [[I], I], atan: [[I], I], atanh: [[I], I],
    avg_over_time: [[R], I], ceil: [[I], I], changes: [[R], I], clamp: [[I, S, S], I], clamp_max: [[I, S], I], clamp_min: [[I, S], I], cos: [[I], I], cosh: [[I], I],
    count_over_time: [[R], I], day_of_month: [[I], I, 1], day_of_week: [[I], I, 1], day_of_year: [[I], I, 1], days_in_month: [[I], I, 1], deg: [[I], I], delta: [[R], I], deriv: [[R], I],
    exp: [[I], I], floor: [[I], I], histogram_avg: [[I], I], histogram_count: [[I], I], histogram_fraction: [[S, S, I], I], histogram_quantile: [[S, I], I], histogram_stddev: [[I], I], histogram_stdvar: [[I], I], histogram_sum: [[I], I],
    holt_winters: [[R, S, S], I], double_exponential_smoothing: [[R, S, S], I], hour: [[I], I, 1], idelta: [[R], I], increase: [[R], I], irate: [[R], I],
    label_join: [[I, T, T, T], I, 0, true], label_replace: [[I, T, T, T, T], I], last_over_time: [[R], I], ln: [[I], I], log10: [[I], I], log2: [[I], I],
    mad_over_time: [[R], I], max_over_time: [[R], I], min_over_time: [[R], I], minute: [[I], I, 1], month: [[I], I, 1], pi: [[], S], predict_linear: [[R, S], I], present_over_time: [[R], I],
    quantile_over_time: [[S, R], I], rad: [[I], I], rate: [[R], I], resets: [[R], I], round: [[I, S], I, 1], scalar: [[I], S], sgn: [[I], I], sin: [[I], I], sinh: [[I], I],
    sort: [[I], I], sort_by_label: [[I, T], I, 0, true], sort_by_label_desc: [[I, T], I, 0, true], sort_desc: [[I], I], sqrt: [[I], I], stddev_over_time: [[R], I], stdvar_over_time: [[R], I],
    sum_over_time: [[R], I], tan: [[I], I], tanh: [[I], I], time: [[], S], timestamp: [[I], I], vector: [[S], I], year: [[I], I, 1]
  };
  var TYPE_NAME = { i: ['instant vector', '인스턴트 벡터'], r: ['range vector', '레인지 벡터'], s: ['scalar', '스칼라'], t: ['string', '문자열'] };
  function tn(x) { return t(TYPE_NAME[x][1], TYPE_NAME[x][0]); }

  /* ---------------------------------------------------------------- 렉서 */
  var DUR_UNITS = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 };
  function durSeconds(s) { var tot = 0, m, re = /(\d+)(ms|[smhdwy])/g; while ((m = re.exec(s))) tot += Number(m[1]) * DUR_UNITS[m[2]]; return tot; }
  function lex(src) {
    var toks = [], i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      var rest = src.slice(i), m;
      if (c === '"' || c === "'" || c === '`') {
        var q = c, j = i + 1, val = '';
        while (j < n && src[j] !== q) { if (src[j] === '\\' && q !== '`') { var d = src[j + 1]; var mp = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", a: '\x07', b: '\b', f: '\f', v: '\v' }; if (mp[d] !== undefined) { val += mp[d]; j += 2; continue; } if (d === 'x') { val += String.fromCharCode(parseInt(src.substr(j + 2, 2), 16)); j += 4; continue; } if (d === 'u') { val += String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)); j += 6; continue; } fail(t('알 수 없는 이스케이프 \\' + d, 'Unknown escape \\' + d), j); } val += src[j]; j++; }
        if (j >= n) fail(t('문자열이 닫히지 않았습니다', 'Unterminated string'), i);
        toks.push({ t: 'str', v: val, pos: i, raw: src.slice(i, j + 1) }); i = j + 1; continue;
      }
      if ((m = /^(?:\d+(?:ms|[smhdwy]))+(?![A-Za-z0-9_])/.exec(rest))) { toks.push({ t: 'dur', v: m[0], pos: i }); i += m[0].length; continue; }
      if ((m = /^(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?![A-Za-z_])/.exec(rest))) { toks.push({ t: 'num', v: Number(m[0]), pos: i, raw: m[0] }); i += m[0].length; continue; }
      if ((m = /^(?::(?=[A-Za-z_:])|[A-Za-z_])[A-Za-z0-9_:]*/.exec(rest))) { toks.push({ t: 'id', v: m[0], pos: i }); i += m[0].length; continue; }
      var two = src.substr(i, 2);
      if (['==', '!=', '>=', '<=', '=~', '!~'].indexOf(two) >= 0) { toks.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
      if ('+-*/%^=<>(){}[],:@'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c, pos: i }); i++; continue; }
      fail(t('예상하지 못한 문자 ' + JSON.stringify(c), 'Unexpected character ' + JSON.stringify(c)), i);
    }
    toks.push({ t: 'eof', pos: n });
    return toks;
  }

  /* ---------------------------------------------------------------- 파서 */
  var PREC = { or: 1, and: 2, unless: 2, '==': 3, '!=': 3, '>': 3, '<': 3, '>=': 3, '<=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5, atan2: 5, '^': 6 };
  P.parse = function (src) {
    var toks = lex(src), p = 0;
    function peek() { return toks[p]; }
    function isOp(v) { var k = toks[p]; return k.t === 'op' && k.v === v; }
    function isId(v) { var k = toks[p]; return k.t === 'id' && k.v.toLowerCase() === v; }
    function eatOp(v) { if (!isOp(v)) fail(t('"' + v + '" 가 필요합니다', 'Expected "' + v + '"') + near(), peek().pos); p++; }
    function near() { var k = peek(); return k.t === 'eof' ? t(' (식이 끝났습니다)', ' (unexpected end of expression)') : t(' (위치 ' + k.pos + ', "' + (k.raw || k.v) + '" 근처)', ' (at position ' + k.pos + ', near "' + (k.raw || k.v) + '")'); }
    function startPos() { return peek().pos; }
    function binOpAt() {
      var k = peek();
      if (k.t === 'op' && PREC[k.v] !== undefined) return k.v;
      if (k.t === 'id' && PREC[k.v.toLowerCase()] !== undefined && (k.v.toLowerCase() === 'and' || k.v.toLowerCase() === 'or' || k.v.toLowerCase() === 'unless' || k.v.toLowerCase() === 'atan2')) return k.v.toLowerCase();
      return null;
    }
    function parseExpr(minPrec) {
      var lhs = parseUnary();
      while (true) {
        var op = binOpAt(); if (!op || PREC[op] < minPrec) break;
        var pos = peek().pos; p++;
        var node = { type: 'bin', op: op, bool: false, matching: null, pos: pos };
        if (isId('bool')) { p++; node.bool = true; }
        if (isId('on') || isId('ignoring')) {
          var on = peek().v.toLowerCase() === 'on'; p++;
          var labs = parseLabelList(); node.matching = { card: 'one-to-one', on: on, labels: labs, include: [] };
          if (isId('group_left') || isId('group_right')) { node.matching.card = peek().v.toLowerCase() === 'group_left' ? 'many-to-one' : 'one-to-many'; p++; if (isOp('(')) node.matching.include = parseLabelList(); }
        }
        var next = op === '^' ? PREC[op] : PREC[op] + 1;
        node.lhs = lhs; node.rhs = parseExpr(next);
        lhs = node;
      }
      return lhs;
    }
    function parseLabelList() { eatOp('('); var out = []; while (!isOp(')')) { var k = peek(); if (k.t !== 'id') fail(t('라벨 이름이 필요합니다', 'Label name expected') + near(), k.pos); out.push(k.v); p++; if (isOp(',')) p++; else break; } eatOp(')'); return out; }
    function parseUnary() {
      if (isOp('-') || isOp('+')) { var op = peek().v, pos = peek().pos; p++; var e = parseExpr(PREC['^'] > 5 ? 5.5 : 5); return { type: 'unary', op: op, e: e, pos: pos }; }
      return parsePostfix();
    }
    function parseDuration() {
      var k = peek();
      if (k.t === 'dur') { p++; return { text: k.v, sec: durSeconds(k.v) }; }
      if (k.t === 'num' && /^\d+$/.test(k.raw)) { p++; return { text: k.raw + 's', sec: Number(k.raw), bare: true }; }
      fail(t('기간(예: 5m)이 필요합니다', 'A duration (e.g. 5m) is expected') + near(), k.pos);
    }
    function parsePostfix() {
      var e = parsePrimary();
      while (true) {
        if (isOp('[')) {
          var pos = peek().pos; p++;
          var range = parseDuration();
          if (isOp(':')) { p++; var step = null; if (!isOp(']')) step = parseDuration(); eatOp(']'); e = { type: 'subq', e: e, range: range, step: step, offset: null, at: null, pos: pos }; }
          else { eatOp(']'); if (e.type !== 'vsel') fail(t('범위 선택자는 벡터 선택자에만 쓸 수 있습니다 (서브쿼리는 [범위:간격] 형식)', 'Range selectors are only allowed on vector selectors (subqueries use [range:step])'), pos); e = { type: 'msel', v: e, range: range, pos: pos }; }
        } else if (isId('offset')) {
          var po = peek().pos; p++;
          var neg = false; if (isOp('-')) { p++; neg = true; } else if (isOp('+')) p++;
          var d = parseDuration(); var tgt = e.type === 'msel' ? e.v : e;
          if (tgt.type !== 'vsel' && tgt.type !== 'subq') fail(t('offset 은 벡터 선택자나 서브쿼리 바로 뒤에만 쓸 수 있습니다', 'offset must directly follow a vector selector, range selector or subquery'), po);
          if (tgt.offset) fail(t('offset 이 두 번 지정되었습니다', 'offset specified twice'), po);
          tgt.offset = { sec: neg ? -d.sec : d.sec, text: (neg ? '-' : '') + d.text };
        } else if (isOp('@')) {
          var pa = peek().pos; p++;
          var tgt2 = e.type === 'msel' ? e.v : e; if (tgt2.type !== 'vsel' && tgt2.type !== 'subq') fail(t('@ 는 벡터 선택자나 서브쿼리 바로 뒤에만 쓸 수 있습니다', '@ must directly follow a vector selector, range selector or subquery'), pa);
          if (tgt2.at) fail(t('@ 가 두 번 지정되었습니다', '@ specified twice'), pa);
          var sign = ''; if (isOp('-')) { p++; sign = '-'; } else if (isOp('+')) p++;
          var k = peek();
          if (k.t === 'num') { p++; tgt2.at = { text: sign + k.raw }; }
          else if (k.t === 'id' && (k.v === 'start' || k.v === 'end')) { p++; eatOp('('); eatOp(')'); tgt2.at = { text: k.v + '()' }; }
          else fail(t('@ 뒤에는 유닉스 타임스탬프나 start()/end() 가 필요합니다', '@ must be followed by a Unix timestamp or start() / end()'), k.pos);
        } else break;
      }
      return e;
    }
    function parseMatchers() {
      var ms = [];
      eatOp('{');
      while (!isOp('}')) {
        var k = peek(); if (k.t !== 'id') fail(t('라벨 이름이 필요합니다', 'Label name expected') + near(), k.pos); p++;
        var o = peek(); if (!(o.t === 'op' && ['=', '!=', '=~', '!~'].indexOf(o.v) >= 0)) fail(t('매처 연산자(=, !=, =~, !~)가 필요합니다', 'Matcher operator (=, !=, =~, !~) expected') + near(), o.pos); p++;
        var v = peek(); if (v.t !== 'str') fail(t('라벨 값은 문자열이어야 합니다', 'Label value must be a string') + near(), v.pos); p++;
        ms.push({ label: k.v, op: o.v, value: v.v, raw: v.raw });
        if (isOp(',')) p++; else break;
      }
      eatOp('}');
      return ms;
    }
    function parsePrimary() {
      var k = peek(), pos = k.pos;
      if (k.t === 'num') { p++; return { type: 'num', v: k.v, raw: k.raw, pos: pos }; }
      if (k.t === 'dur') fail(t('기간은 [ ] 안이나 offset 뒤에서만 쓸 수 있습니다', 'Durations are only valid inside [ ] or after offset') + near(), pos);
      if (k.t === 'str') { p++; return { type: 'str', v: k.v, raw: k.raw, pos: pos }; }
      if (isOp('(')) { p++; var e = parseExpr(1); eatOp(')'); return { type: 'paren', e: e, pos: pos }; }
      if (isOp('{')) { var ms = parseMatchers(); return { type: 'vsel', name: null, matchers: ms, offset: null, at: null, pos: pos }; }
      if (k.t === 'id') {
        var low = k.v.toLowerCase();
        if (low === 'inf' || low === 'nan') { p++; return { type: 'num', v: low === 'inf' ? Infinity : NaN, raw: k.v, pos: pos }; }
        if (AGGS[low] !== undefined && (toks[p + 1].t === 'op' && toks[p + 1].v === '(' || (toks[p + 1].t === 'id' && /^(by|without)$/i.test(toks[p + 1].v)))) return parseAgg();
        if (FN[k.v] && toks[p + 1].t === 'op' && toks[p + 1].v === '(') return parseCall();
        if (toks[p + 1].t === 'op' && toks[p + 1].v === '(') fail(t('알 수 없는 함수 "' + k.v + '"', 'Unknown function "' + k.v + '"'), pos);
        p++;
        var ms2 = isOp('{') ? parseMatchers() : [];
        return { type: 'vsel', name: k.v, matchers: ms2, offset: null, at: null, pos: pos };
      }
      fail(t('식이 필요합니다', 'Expression expected') + near(), pos);
    }
    function parseArgs() { eatOp('('); var args = []; while (!isOp(')')) { args.push(parseExpr(1)); if (isOp(',')) p++; else break; } eatOp(')'); return args; }
    function parseCall() { var k = peek(), pos = k.pos; p++; var args = parseArgs(); return { type: 'call', fn: k.v, args: args, pos: pos }; }
    function parseAgg() {
      var k = peek(), pos = k.pos, op = k.v.toLowerCase(); p++;
      var node = { type: 'agg', op: op, param: null, e: null, by: null, without: false, groupPos: 'none', pos: pos };
      if (isId('by') || isId('without')) { node.without = peek().v.toLowerCase() === 'without'; p++; node.by = parseLabelList(); node.groupPos = 'before'; }
      var args = parseArgs();
      if (isId('by') || isId('without')) { if (node.by) fail(t('집계의 by/without 가 두 번 지정되었습니다', 'by / without specified twice on the aggregation'), peek().pos); node.without = peek().v.toLowerCase() === 'without'; p++; node.by = parseLabelList(); node.groupPos = 'after'; }
      if (AGGS[op] === 'p') { if (args.length !== 2) fail(t(op + ' 는 인자 2개(파라미터, 식)가 필요합니다', op + ' needs 2 arguments (parameter, expression)'), pos); node.param = args[0]; node.e = args[1]; }
      else { if (args.length !== 1) fail(t(op + ' 는 인자 1개가 필요합니다 (받은 개수: ' + args.length + ')', op + ' needs exactly 1 argument (got ' + args.length + ')'), pos); node.e = args[0]; }
      return node;
    }
    var ast = parseExpr(1);
    if (peek().t !== 'eof') fail(t('식 뒤에 처리되지 않은 입력이 있습니다', 'Unexpected input after the expression') + near(), peek().pos);
    return ast;
  };

  /* ---------------------------------------------------------------- 타입 검사 */
  P.typeOf = function typeOf(n) {
    switch (n.type) {
      case 'num': return S; case 'str': return T; case 'vsel': return I; case 'msel': return R; case 'subq': return R;
      case 'paren': return typeOf(n.e); case 'unary': return typeOf(n.e); case 'agg': return I;
      case 'call': return FN[n.fn][1];
      case 'bin': { var a = typeOf(n.lhs), b = typeOf(n.rhs); return a === S && b === S ? S : I; }
    }
  };
  function matchesEmpty(m) {
    if (m.op === '=') return m.value === '';
    if (m.op === '!=') return m.value !== '';
    var rx; try { rx = new RegExp('^(?:' + m.value + ')$'); } catch (er) { return false; }
    return m.op === '=~' ? rx.test('') : !rx.test('');
  }
  P.check = function (ast) {
    var errs = [];
    function e(msg, pos) { errs.push({ msg: msg, pos: pos }); }
    function walk(n) {
      switch (n.type) {
        case 'vsel': {
          if (!n.name && !n.matchers.some(function (m) { return !matchesEmpty(m); })) e(t('벡터 선택자에는 빈 문자열과 일치하지 않는 매처가 하나 이상 필요합니다 (예: {job="api"})', 'A vector selector must contain at least one matcher that does not match the empty string (e.g. {job="api"})'), n.pos);
          if (n.name && n.matchers.some(function (m) { return m.label === '__name__'; })) e(t('메트릭 이름과 __name__ 매처를 함께 쓸 수 없습니다', 'Metric name must not be set twice (name and a __name__ matcher)'), n.pos);
          break;
        }
        case 'msel': walk(n.v); break;
        case 'subq': { if (P.typeOf(n.e) !== I) e(t('서브쿼리의 식은 인스턴스 벡터여야 합니다 (현재: ' + tn(P.typeOf(n.e)) + ')', 'The subquery expression must be an instant vector (got ' + tn(P.typeOf(n.e)) + ')'), n.pos); walk(n.e); break; }
        case 'paren': walk(n.e); break;
        case 'unary': { var ut = P.typeOf(n.e); if (ut !== S && ut !== I) e(t('단항 연산자는 스칼라나 인스턴트 벡터에만 쓸 수 있습니다 (현재: ' + tn(ut) + ')', 'Unary operator expects a scalar or instant vector (got ' + tn(ut) + ')'), n.pos); walk(n.e); break; }
        case 'call': {
          var sig = FN[n.fn], need = sig[0].length, opt = sig[2] || 0, variadic = sig[3];
          if (n.args.length < need - opt || (!variadic && n.args.length > need)) e(t('함수 ' + n.fn + ' 의 인자 개수가 맞지 않습니다 (필요: ' + (opt ? (need - opt) + '~' + need : need) + (variadic ? '개 이상' : '개') + ', 받음: ' + n.args.length + ')', 'Function ' + n.fn + ' got the wrong number of arguments (expected ' + (opt ? (need - opt) + '-' + need : need) + (variadic ? ' or more' : '') + ', got ' + n.args.length + ')'), n.pos);
          n.args.forEach(function (a, i) {
            var want = sig[0][Math.min(i, sig[0].length - 1)] || null; if (!want) return;
            var got = P.typeOf(a);
            if (want !== got) e(t('함수 ' + n.fn + ' 의 ' + (i + 1) + '번째 인자는 ' + tn(want) + ' 여야 하는데 ' + tn(got) + ' 입니다', 'Argument ' + (i + 1) + ' of ' + n.fn + ' must be a ' + tn(want) + ', got ' + tn(got)), a.pos);
            walk(a);
          });
          break;
        }
        case 'agg': {
          var et = P.typeOf(n.e); if (et !== I) e(t('집계 ' + n.op + ' 의 식은 인스턴트 벡터여야 합니다 (현재: ' + tn(et) + ')', 'The expression of ' + n.op + ' must be an instant vector (got ' + tn(et) + ')'), n.pos);
          if (n.param) { var want2 = PARAM_TYPE[n.op] === 'string' ? T : S, got2 = P.typeOf(n.param); if (got2 !== want2) e(t(n.op + ' 의 첫 인자는 ' + tn(want2) + ' 여야 합니다 (현재: ' + tn(got2) + ')', 'The first argument of ' + n.op + ' must be a ' + tn(want2) + ' (got ' + tn(got2) + ')'), n.param.pos); walk(n.param); }
          if ((n.op === 'count_values') && n.by && n.by.indexOf(n.param && n.param.v) >= 0) e(t('count_values 의 레이블 이름이 by 목록에 있습니다', 'The count_values label is also in the by list'), n.pos);
          walk(n.e); break;
        }
        case 'bin': {
          var lt = P.typeOf(n.lhs), rt = P.typeOf(n.rhs);
          if ((lt !== S && lt !== I) || (rt !== S && rt !== I)) e(t('이항 식은 스칼라와 인스턴트 벡터만 포함할 수 있습니다 (왼쪽 ' + tn(lt) + ', 오른쪽 ' + tn(rt) + ')', 'Binary expressions may only contain scalars and instant vectors (left ' + tn(lt) + ', right ' + tn(rt) + ')'), n.pos);
          if (n.bool && !CMP[n.op]) e(t('bool 수식어는 비교 연산자에만 쓸 수 있습니다', 'The bool modifier can only be used with comparison operators'), n.pos);
          if (CMP[n.op] && lt === S && rt === S && !n.bool) e(t('스칼라끼리의 비교에는 bool 수식어가 필요합니다', 'Comparisons between scalars must use the bool modifier'), n.pos);
          if (SETOP[n.op] && (lt === S || rt === S)) e(t('집합 연산자 ' + n.op + ' 는 스칼라와 함께 쓸 수 없습니다', 'Set operator ' + n.op + ' is not allowed with scalars'), n.pos);
          if (n.matching && (lt === S || rt === S)) e(t('on/ignoring 은 두 인스턴트 벡터 사이에서만 쓸 수 있습니다', 'on / ignoring only apply between two instant vectors'), n.pos);
          if (n.matching && n.matching.card !== 'one-to-one' && SETOP[n.op]) e(t('집합 연산자에는 group_left/group_right 를 쓸 수 없습니다', 'No grouping allowed for set operations'), n.pos);
          if (n.matching && n.matching.include.length && n.matching.on) n.matching.include.forEach(function (l) { if (n.matching.labels.indexOf(l) >= 0) e(t('라벨 ' + l + ' 이(가) on 과 group 절에 동시에 있습니다', 'Label ' + l + ' must not occur in both on and group clauses'), n.pos); });
          walk(n.lhs); walk(n.rhs); break;
        }
      }
    }
    walk(ast);
    return errs;
  };

  /* ---------------------------------------------------------------- 출력 */
  function matcherStr(ms) { return ms.map(function (m) { return m.label + m.op + (m.raw || JSON.stringify(m.value)); }).join(', '); }
  function mods(n) { return (n.at ? ' @ ' + n.at.text : '') + (n.offset ? ' offset ' + n.offset.text : ''); }
  function lbls(l) { return '(' + l.join(', ') + ')'; }
  P.print = function print(n, w, ind) {
    ind = ind || 0; w = w || 100;
    var one = single(n);
    if (one.length + ind <= w || !isBreakable(n)) return one;
    var pad = new Array(ind + 3).join(' '), padEnd = new Array(ind + 1).join(' ');
    switch (n.type) {
      case 'call': return n.fn + '(\n' + n.args.map(function (a) { return pad + print(a, w, ind + 2); }).join(',\n') + '\n' + padEnd + ')';
      case 'agg': {
        var head = n.op + (n.by && n.groupPos === 'before' ? (n.without ? ' without ' : ' by ') + lbls(n.by) + ' ' : '');
        var tail = n.by && n.groupPos === 'after' ? (n.without ? ' without ' : ' by ') + lbls(n.by) : '';
        return head + '(\n' + (n.param ? pad + single(n.param) + ',\n' : '') + pad + print(n.e, w, ind + 2) + '\n' + padEnd + ')' + tail;
      }
      case 'bin': {
        var op = n.op + (n.bool ? ' bool' : '') + matchStr(n);
        return print(n.lhs, w, ind) + '\n' + padEnd + op + '\n' + padEnd + print(n.rhs, w, ind);
      }
      case 'paren': return '(\n' + pad + print(n.e, w, ind + 2) + '\n' + padEnd + ')';
      case 'unary': return n.op + print(n.e, w, ind);
      case 'subq': return print(n.e, w, ind) + '[' + n.range.text + ':' + (n.step ? n.step.text : '') + ']' + mods(n);
      default: return one;
    }
  };
  function isBreakable(n) { return n.type === 'call' || n.type === 'agg' || n.type === 'bin' || n.type === 'paren' || n.type === 'unary' || n.type === 'subq'; }
  function matchStr(n) {
    if (!n.matching) return '';
    var s = ' ' + (n.matching.on ? 'on' : 'ignoring') + ' ' + lbls(n.matching.labels);
    if (n.matching.card !== 'one-to-one') s += ' ' + (n.matching.card === 'many-to-one' ? 'group_left' : 'group_right') + (n.matching.include.length ? ' ' + lbls(n.matching.include) : '');
    return s;
  }
  function single(n) {
    switch (n.type) {
      case 'num': return n.raw; case 'str': return n.raw;
      case 'vsel': return (n.name || '') + (n.matchers.length || !n.name ? '{' + matcherStr(n.matchers) + '}' : '') + mods(n);
      case 'msel': return (n.v.name || '') + (n.v.matchers.length || !n.v.name ? '{' + matcherStr(n.v.matchers) + '}' : '') + '[' + n.range.text + ']' + mods(n.v);
      case 'subq': return single(n.e) + '[' + n.range.text + ':' + (n.step ? n.step.text : '') + ']' + mods(n);
      case 'paren': return '(' + single(n.e) + ')';
      case 'unary': return n.op + single(n.e);
      case 'call': return n.fn + '(' + n.args.map(single).join(', ') + ')';
      case 'agg': return n.op + (n.by && n.groupPos === 'before' ? (n.without ? ' without ' : ' by ') + lbls(n.by) + ' ' : '') + '(' + (n.param ? single(n.param) + ', ' : '') + single(n.e) + ')' + (n.by && n.groupPos === 'after' ? (n.without ? ' without ' : ' by ') + lbls(n.by) : '');
      case 'bin': return single(n.lhs) + ' ' + n.op + (n.bool ? ' bool' : '') + matchStr(n) + ' ' + single(n.rhs);
    }
  }
  P.single = single;

  /* ---------------------------------------------------------------- 설명 */
  var FN_DESC = {
    rate: ['구간 안에서 초당 평균 증가율 (카운터 리셋 보정)', 'per-second average rate of increase over the range (handles counter resets)'], irate: ['마지막 두 샘플 기준 순간 초당 증가율', 'instant per-second rate from the last two samples'], increase: ['구간 동안의 총 증가량 (카운터 리셋 보정)', 'total increase over the range (handles counter resets)'],
    delta: ['구간 시작과 끝의 차이 (게이지용)', 'difference between range start and end (for gauges)'], idelta: ['마지막 두 샘플의 차이', 'difference of the last two samples'], deriv: ['구간 선형 회귀 기울기(초당)', 'per-second slope by linear regression over the range'],
    changes: ['구간 안에서 값이 바뀐 횟수', 'number of times the value changed in the range'], resets: ['카운터가 리셋된 횟수', 'number of counter resets'],
    avg_over_time: ['구간 안 평균', 'average over the range'], min_over_time: ['구간 안 최솟값', 'minimum over the range'], max_over_time: ['구간 안 최댓값', 'maximum over the range'], sum_over_time: ['구간 안 합계', 'sum over the range'], count_over_time: ['구간 안 샘플 수', 'number of samples in the range'],
    quantile_over_time: ['구간 안 분위수', 'quantile over the range'], last_over_time: ['구간 안 마지막 값', 'last value in the range'], present_over_time: ['구간에 샘플이 있으면 1', '1 if the range has any sample'], absent_over_time: ['구간에 샘플이 없으면 1', '1 if the range has no sample'],
    histogram_quantile: ['히스토그램 버킷에서 분위수 추정', 'estimate a quantile from histogram buckets'], predict_linear: ['선형 회귀로 N초 뒤 값 예측', 'predict the value N seconds ahead by linear regression'],
    absent: ['시계열이 없으면 1 (알림용)', '1 if no series exists (for alerting)'], abs: ['절댓값', 'absolute value'], ceil: ['올림', 'round up'], floor: ['내림', 'round down'], round: ['반올림', 'round'], sqrt: ['제곱근', 'square root'], exp: ['e의 거듭제곱', 'exponential'], ln: ['자연로그', 'natural logarithm'],
    clamp: ['값을 [min,max] 범위로 제한', 'clamp values into [min, max]'], clamp_min: ['최솟값 제한', 'lower bound'], clamp_max: ['최댓값 제한', 'upper bound'], scalar: ['단일 시계열을 스칼라로 변환', 'convert a single series to a scalar'], vector: ['스칼라를 벡터로 변환', 'convert a scalar to a vector'],
    time: ['현재 시각(유닉스 초)', 'current Unix time'], timestamp: ['샘플의 타임스탬프', 'timestamp of each sample'], label_replace: ['정규식으로 라벨 값 만들기', 'build a label value with a regex'], label_join: ['여러 라벨을 합쳐 새 라벨 만들기', 'join labels into a new label'],
    sort: ['값 오름차순 정렬', 'sort ascending by value'], sort_desc: ['값 내림차순 정렬', 'sort descending by value'], day_of_week: ['요일(0=일)', 'day of week (0 = Sunday)'], hour: ['시(UTC)', 'hour (UTC)'], minute: ['분', 'minute'], month: ['월', 'month'], year: ['연도', 'year'], day_of_month: ['일', 'day of month']
  };
  var AGG_DESC = { sum: ['합계', 'sum'], avg: ['평균', 'average'], min: ['최솟값', 'minimum'], max: ['최댓값', 'maximum'], count: ['시계열 개수', 'number of series'], group: ['값을 1로 만든 그룹', 'group (all values 1)'], stddev: ['표준편차', 'standard deviation'], stdvar: ['분산', 'variance'], topk: ['값이 큰 상위 k개', 'top k by value'], bottomk: ['값이 작은 하위 k개', 'bottom k by value'], quantile: ['분위수', 'quantile'], count_values: ['값별 개수', 'count of series per value'], limitk: ['임의의 k개 시계열', 'k arbitrary series'], limit_ratio: ['시계열의 일부 비율', 'a ratio of series'] };
  var OP_DESC = { '+': ['더하기', 'add'], '-': ['빼기', 'subtract'], '*': ['곱하기', 'multiply'], '/': ['나누기', 'divide'], '%': ['나머지', 'modulo'], '^': ['거듭제곱', 'power'], atan2: ['atan2', 'atan2'], '==': ['같은 것만 남김', 'keep where equal'], '!=': ['다른 것만 남김', 'keep where not equal'], '>': ['큰 것만 남김', 'keep where greater'], '<': ['작은 것만 남김', 'keep where less'], '>=': ['크거나 같은 것만 남김', 'keep where greater or equal'], '<=': ['작거나 같은 것만 남김', 'keep where less or equal'], and: ['양쪽에 모두 있는 시계열 (교집합)', 'series present on both sides (intersection)'], or: ['양쪽 시계열 합집합', 'union of both sides'], unless: ['오른쪽에 없는 왼쪽 시계열 (차집합)', 'left series not present on the right (difference)'] };
  function fmtDur(sec) { if (sec === 0) return '0s'; var parts = [], rest = sec, U = [['w', 604800], ['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]; U.forEach(function (u) { if (rest >= u[1]) { var q = Math.floor(rest / u[1]); parts.push(q + u[0]); rest -= q * u[1]; } }); if (rest > 0) parts.push(rest * 1000 + 'ms'); return parts.join(''); }
  P.steps = function (ast) {
    var rows = [];
    function add(n, desc) { rows.push([String(rows.length + 1), single(n).length > 70 ? single(n).slice(0, 67) + '…' : single(n), tn(P.typeOf(n)), desc]); }
    (function walk(n) {
      switch (n.type) {
        case 'num': case 'str': return;
        case 'paren': walk(n.e); return;
        case 'vsel': {
          var conds = n.matchers.filter(function (m) { return m.label !== '__name__'; }).map(function (m) { return m.label + ' ' + ({ '=': '=', '!=': '≠', '=~': t('정규식 일치', 'matches'), '!~': t('정규식 불일치', 'not matches') })[m.op] + ' ' + (m.raw || m.value); });
          add(n, t('시계열 선택: ', 'Select series: ') + (n.name || '(all names)') + (conds.length ? ' — ' + conds.join(', ') : '') + (n.offset ? t(' (' + fmtDur(Math.abs(n.offset.sec)) + (n.offset.sec < 0 ? ' 이후' : ' 전') + ' 시점)', ' (' + fmtDur(Math.abs(n.offset.sec)) + (n.offset.sec < 0 ? ' ahead' : ' ago') + ')') : '') + (n.at ? ' @ ' + n.at.text : '')); return;
        }
        case 'msel': add(n, t('최근 ' + fmtDur(n.range.sec) + ' 구간의 모든 샘플 (' + n.range.sec + '초)', 'All samples in the last ' + fmtDur(n.range.sec) + ' (' + n.range.sec + ' s)') + (n.v.offset ? t(', ' + fmtDur(Math.abs(n.v.offset.sec)) + ' 전 시점 기준', ', ' + fmtDur(Math.abs(n.v.offset.sec)) + ' ago') : '')); return;
        case 'subq': walk(n.e); add(n, t('서브쿼리: 안쪽 식을 ' + fmtDur(n.range.sec) + ' 구간에서 ' + (n.step ? fmtDur(n.step.sec) : '전역 평가 간격') + '마다 평가해 레인지 벡터로 만듦', 'Subquery: evaluate the inner expression over ' + fmtDur(n.range.sec) + ' every ' + (n.step ? fmtDur(n.step.sec) : 'default evaluation interval') + ' into a range vector')); return;
        case 'unary': walk(n.e); add(n, n.op === '-' ? t('부호 반전', 'negate') : t('부호 유지', 'unary plus')); return;
        case 'call': n.args.forEach(walk); add(n, FN_DESC[n.fn] ? t(FN_DESC[n.fn][0], FN_DESC[n.fn][1]) : t('함수 ' + n.fn, 'function ' + n.fn)); return;
        case 'agg': {
          if (n.param && n.param.type !== 'num' && n.param.type !== 'str') walk(n.param);
          walk(n.e);
          var grp = n.by ? (n.without ? t(' — ' + (n.by.length ? n.by.join(', ') : '(없음)') + ' 라벨을 제외한 나머지로 그룹', ' — grouped by all labels except ' + (n.by.length ? n.by.join(', ') : '(none)')) : t(' — ' + (n.by.length ? n.by.join(', ') : '(없음)') + ' 별로 그룹', ' — grouped by ' + (n.by.length ? n.by.join(', ') : '(none)'))) : t(' — 모든 시계열을 하나로', ' — all series into one');
          add(n, t(AGG_DESC[n.op][0], AGG_DESC[n.op][1]) + (n.param ? ' (' + n.param.raw + ')' : '') + grp); return;
        }
        case 'bin': {
          walk(n.lhs); walk(n.rhs);
          var d = OP_DESC[n.op], extra = '';
          if (n.matching) extra = t(' — 라벨 매칭: ' + (n.matching.on ? 'on' : 'ignoring') + ' (' + n.matching.labels.join(', ') + ')' + (n.matching.card !== 'one-to-one' ? ', ' + n.matching.card : ''), ' — label matching: ' + (n.matching.on ? 'on' : 'ignoring') + ' (' + n.matching.labels.join(', ') + ')' + (n.matching.card !== 'one-to-one' ? ', ' + n.matching.card : ''));
          else if (P.typeOf(n.lhs) === I && P.typeOf(n.rhs) === I && !SETOP[n.op]) extra = t(' — 라벨이 모두 같은 시계열끼리 짝지음', ' — series are paired when all labels are identical');
          add(n, t(d[0], d[1]) + (n.bool ? t(' (bool: 0/1 로 반환)', ' (bool: returns 0 / 1)') : '') + extra); return;
        }
      }
    })(ast);
    return rows;
  };
  P.durSeconds = durSeconds; P.fmtDur = fmtDur;

  /* ---------------------------------------------------------------- 린트 */
  P.lint = function (ast) {
    var out = [];
    function add(sev, msg) { out.push({ sev: sev, msg: msg }); }
    var COUNTER = /(_total|_count|_sum|_bucket|_seconds_total|_bytes_total|_created)$/;
    function metricsOf(n, acc) { acc = acc || []; if (!n) return acc; if (n.type === 'vsel' && n.name) acc.push(n.name); else if (n.type === 'msel') metricsOf(n.v, acc); else if (n.e) metricsOf(n.e, acc); else if (n.args) n.args.forEach(function (a) { metricsOf(a, acc); }); else if (n.lhs) { metricsOf(n.lhs, acc); metricsOf(n.rhs, acc); } return acc; }
    function hasFn(n, names) { if (!n) return false; if (n.type === 'call' && names.indexOf(n.fn) >= 0) return true; if (n.v && hasFn(n.v, names)) return true; if (n.e && hasFn(n.e, names)) return true; if (n.args && n.args.some(function (a) { return hasFn(a, names); })) return true; if (n.lhs && (hasFn(n.lhs, names) || hasFn(n.rhs, names))) return true; return false; }
    (function walk(n) {
      switch (n.type) {
        case 'vsel': {
          var nm = n.matchers.filter(function (m) { return m.label === '__name__'; })[0];
          if (!n.name && nm && nm.op === '=~' && /^\.[*+]$/.test(nm.value)) add('warn', t('{__name__=~"' + nm.value + '"} 은(는) 모든 메트릭을 훑어 서버에 큰 부하를 줍니다', '{__name__=~"' + nm.value + '"} scans every metric and puts heavy load on the server'));
          n.matchers.forEach(function (m) {
            if (m.op === '=~' && !/[.*+?|()\[\]{}\\^$]/.test(m.value) && m.value !== '') add('info', t(m.label + '=~"' + m.value + '" 은(는) 정규식 문자가 없으니 ' + m.label + '="' + m.value + '" 로 쓰면 더 빠릅니다', m.label + '=~"' + m.value + '" has no regex characters; ' + m.label + '="' + m.value + '" is faster'));
            if (m.op === '=~' && m.value === '.*') add('info', t(m.label + '=~".*" 은(는) 조건이 아무 효과가 없습니다 (라벨이 없는 시계열도 포함)', m.label + '=~".*" matches everything, including series without the label'));
            if (m.op === '=~' && /^\^|\$$/.test(m.value)) add('info', t('PromQL 정규식은 자동으로 양쪽이 고정(anchor)됩니다. ^ 와 $ 는 필요 없습니다', 'PromQL regexes are fully anchored automatically; ^ and $ are unnecessary'));
          });
          break;
        }
        case 'msel': walk(n.v); break;
        case 'subq': walk(n.e); if (n.range.sec / (n.step ? n.step.sec : 15) > 11000) add('warn', t('서브쿼리가 한 번에 11,000개 이상의 포인트를 만듭니다', 'The subquery produces more than 11,000 points')); break;
        case 'paren': walk(n.e); break;
        case 'unary': walk(n.e); break;
        case 'call': {
          n.args.forEach(walk);
          var a0 = n.args[0] && (n.args[0].type === 'msel' ? n.args[0] : null);
          if (['rate', 'irate', 'increase'].indexOf(n.fn) >= 0 && a0) {
            var nm2 = a0.v.name || '';
            if (nm2 && !COUNTER.test(nm2)) add('info', t(n.fn + '() 는 카운터(단조 증가) 메트릭용인데 "' + nm2 + '" 은(는) 게이지처럼 보입니다. 게이지라면 deriv()/delta() 를 쓰세요', n.fn + '() is for counters, but "' + nm2 + '" looks like a gauge; use deriv() / delta() for gauges'));
            if (a0.range.sec < 60) add('warn', t(n.fn + '() 의 범위 ' + a0.range.text + ' 은(는) 너무 짧습니다. 수집 주기의 최소 4배(보통 2m 이상)를 권장합니다', 'The ' + a0.range.text + ' range of ' + n.fn + '() is too short; use at least 4x the scrape interval (usually 2m or more)'));
            else if (a0.range.sec < 120 && n.fn !== 'irate') add('info', t(n.fn + '() 범위 ' + a0.range.text + ': 수집 주기가 30초 이상이면 샘플이 2개 미만일 수 있습니다', n.fn + '() range ' + a0.range.text + ': with scrape intervals of 30 s or more there may be fewer than 2 samples'));
            if (n.fn === 'irate' && a0.range.sec > 300) add('warn', t('irate 는 마지막 두 샘플만 쓰므로 범위 ' + a0.range.text + ' 는 의미가 없고 느려질 뿐입니다. 긴 구간이면 rate 를 쓰세요', 'irate only uses the last two samples, so the ' + a0.range.text + ' range is pointless; use rate for long windows'));
          }
          if (['avg_over_time', 'min_over_time', 'max_over_time', 'sum_over_time'].indexOf(n.fn) >= 0 && a0 && a0.v.name && /_total$/.test(a0.v.name)) add('info', t('"' + a0.v.name + '" 은(는) 카운터로 보입니다. ' + n.fn + ' 대신 rate/increase 를 고려하세요', '"' + a0.v.name + '" looks like a counter; consider rate / increase instead of ' + n.fn));
          if (n.fn === 'histogram_quantile') {
            var q = n.args[0]; if (q.type === 'num' && (q.v < 0 || q.v > 1)) add('warn', t('histogram_quantile 의 분위수는 0~1 이어야 합니다 (0.95 = 95%)', 'The histogram_quantile quantile must be between 0 and 1 (0.95 = 95%)'));
            var inner = n.args[1], names = metricsOf(inner);
            if (names.length && !names.some(function (x) { return /_bucket$/.test(x); })) add('warn', t('histogram_quantile 은 "_bucket" 메트릭에 써야 합니다 (현재: ' + names.join(', ') + ')', 'histogram_quantile should be applied to a "_bucket" metric (found: ' + names.join(', ') + ')'));
            if (!hasFn(inner, ['rate', 'irate', 'increase'])) add('warn', t('히스토그램 버킷은 누적 카운터라서 rate()/increase() 로 변환한 뒤 histogram_quantile 에 넣어야 합니다', 'Histogram buckets are cumulative counters: wrap them in rate() / increase() before histogram_quantile'));
            (function chk(x) { if (!x) return; if (x.type === 'agg' && x.by && !x.without && x.by.indexOf('le') < 0) add('error', t('histogram_quantile 안의 집계 by 목록에 "le" 가 없습니다. le 라벨이 사라지면 결과가 틀리거나 비어 있습니다', 'The aggregation inside histogram_quantile drops "le" from by(...), so the result is wrong or empty')); if (x.type === 'agg' && x.without && x.by.indexOf('le') >= 0) add('error', t('without 목록에 "le" 가 있어 버킷 경계가 사라집니다', '"le" in without(...) removes the bucket boundaries')); if (x.e) chk(x.e); if (x.args) x.args.forEach(chk); })(inner);
          }
          if (n.fn === 'absent' && n.args[0] && n.args[0].type === 'vsel' && !n.args[0].name) add('info', t('absent() 는 메트릭 이름이 있는 선택자와 쓰는 것이 좋습니다 (결과 라벨을 자동 생성)', 'absent() works best with a named selector (it derives the result labels from it)'));
          if (n.fn === 'round' && n.args[1] && n.args[1].type === 'num' && n.args[1].v === 0) add('warn', t('round(x, 0) 의 반올림 단위가 0 입니다. 정수로 반올림하려면 인자를 생략하세요', 'round(x, 0) uses a rounding unit of 0; omit the argument to round to integers'));
          break;
        }
        case 'agg': {
          if (n.param) walk(n.param);
          walk(n.e);
          var inner2 = n.e; while (inner2 && inner2.type === 'paren') inner2 = inner2.e;
          if (n.op === 'avg' && inner2 && inner2.type === 'agg' && inner2.op === 'avg') add('warn', t('avg(avg(...)): 평균의 평균은 시계열 수가 다르면 부정확합니다. sum/count 로 계산하세요', 'avg(avg(...)): an average of averages is inaccurate when group sizes differ; compute sum / count instead'));
          if (n.op === 'sum' && inner2 && inner2.type === 'call' && /^(avg_over_time|min_over_time|max_over_time)$/.test(inner2.fn)) add('info', t('sum(' + inner2.fn + '(...)): 시계열별 통계의 합이 의도인지 확인하세요', 'sum(' + inner2.fn + '(...)): make sure summing per-series statistics is what you want'));
          if ((n.op === 'sum' || n.op === 'avg') && inner2 && inner2.type === 'msel') add('error', t('집계는 레인지 벡터를 받을 수 없습니다. rate() 같은 함수로 먼저 변환하세요', 'Aggregations cannot take a range vector; apply a function such as rate() first'));
          break;
        }
        case 'bin': {
          walk(n.lhs); walk(n.rhs);
          if (n.op === '==' && n.rhs.type === 'num' && n.rhs.v === 0 && n.lhs.type === 'agg' && n.lhs.op === 'count') add('info', t('count(...) == 0 은 시계열이 아예 없을 때 아무것도 반환하지 않습니다. 없음을 감지하려면 absent(...) 를 쓰세요', 'count(...) == 0 returns nothing when no series exist; use absent(...) to detect missing data'));
          if (n.op === '/' && n.rhs.type === 'num' && n.rhs.v === 0) add('warn', t('0 으로 나누고 있습니다 (결과는 +Inf/NaN)', 'Division by zero (the result is +Inf / NaN)'));
          if (n.op === '/' && n.lhs.type === 'agg' && n.rhs.type === 'agg' && !sameBy(n.lhs, n.rhs) && !n.matching) add('warn', t('좌우 집계의 by 라벨이 다릅니다. 라벨이 일치하지 않으면 결과가 비어 있습니다 (on()/ignoring()/group_left 검토)', 'The aggregations on both sides group by different labels; mismatched labels give an empty result (consider on() / ignoring() / group_left)'));
          break;
        }
      }
    })(ast);
    var seen = {}; return out.filter(function (x) { if (seen[x.msg]) return false; seen[x.msg] = 1; return true; });
    function sameBy(a, b) { var x = (a.by || []).slice().sort().join(',') + (a.without ? '!' : ''), y = (b.by || []).slice().sort().join(',') + (b.without ? '!' : ''); return x === y; }
  };

  /* AST 트리 (디버깅용) */
  P.tree = function tree(n, ind) {
    ind = ind || 0; var pad = new Array(ind + 1).join('  ');
    switch (n.type) {
      case 'num': return pad + 'Number ' + n.raw;
      case 'str': return pad + 'String ' + n.raw;
      case 'vsel': return pad + 'VectorSelector ' + (n.name || '{}') + (n.matchers.length ? ' {' + matcherStr(n.matchers) + '}' : '') + mods(n);
      case 'msel': return pad + 'MatrixSelector [' + n.range.text + ']\n' + tree(n.v, ind + 1);
      case 'subq': return pad + 'Subquery [' + n.range.text + ':' + (n.step ? n.step.text : '') + ']' + mods(n) + '\n' + tree(n.e, ind + 1);
      case 'paren': return pad + 'Paren\n' + tree(n.e, ind + 1);
      case 'unary': return pad + 'Unary ' + n.op + '\n' + tree(n.e, ind + 1);
      case 'call': return pad + 'Call ' + n.fn + '\n' + n.args.map(function (a) { return tree(a, ind + 1); }).join('\n');
      case 'agg': return pad + 'Aggregate ' + n.op + (n.by ? (n.without ? ' without' : ' by') + ' (' + n.by.join(', ') + ')' : '') + '\n' + (n.param ? tree(n.param, ind + 1) + '\n' : '') + tree(n.e, ind + 1);
      case 'bin': return pad + 'Binary ' + n.op + (n.bool ? ' bool' : '') + matchStr(n) + '\n' + tree(n.lhs, ind + 1) + '\n' + tree(n.rhs, ind + 1);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
