TK.tool('graphql-workbench', {
  sampleExpectError: true,
  inputs: [
    { id: 'sdl', label: ['스키마 (SDL)', 'Schema (SDL)'], rows: 18, sample: [
      'schema { query: Query mutation: Mutation }', '', '"""사용자"""', 'type User implements Node {', '  id: ID!', '  name: String!', '  email: String', '  posts(first: Int = 10, after: String): [Post!]!', '  role: Role!', '}',
      'type Post { id: ID! title: String! author: User! tags: [String!] }', 'interface Node { id: ID! }', 'enum Role { ADMIN EDITOR VIEWER }', 'union SearchResult = User | Post | Comment',
      'input NewPost { title: String! body: String authorId: ID! }', 'type Query {', '  user(id: ID!): User', '  users(role: Role): [User!]!', '  search(term: String!): [SearchResult!]!', '}',
      'type Mutation { createPost(input: NewPost!): Post! }', ''].join('\n') },
    { id: 'query', label: ['쿼리 · 뮤테이션 (선택)', 'Query / mutation (optional)'], rows: 12, sample: [
      'query GetUser($id: ID!, $unused: Int) {', '  user(id: $id) {', '    id', '    nane', '    role { name }', '    posts(first: "5") { title author { email } }', '    ...UserBits', '  }', '}', 'fragment UserBits on User { email, missing }', 'mutation { createPost(input: { title: "Hi" }) { id } }', ''].join('\n') }
  ],
  options: [{ id: 'hints', type: 'checkbox', label: ['권고(ℹ️)도 표시', 'Also show hints (ℹ️)'], default: true }],
  outputs: [{ id: 'table', label: ['스키마 타입 목록', 'Schema types'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'out', label: ['정리된 SDL', 'Formatted SDL'], kind: 'code', ext: 'graphql' }, { id: 'qout', label: ['정리된 쿼리', 'Formatted query'], kind: 'code', ext: 'graphql' }],
  run: function (v, o, t) {
    var G = TK.graphql, issues = [], sdlText = String(v.sdl || ''), qText = String(v.query || '');
    if (!sdlText.trim() && !qText.trim()) throw new Error(t('스키마(SDL) 또는 쿼리를 입력하세요', 'Enter a schema (SDL) or a query'));
    function add(sev, line, msg, src) { issues.push({ sev: sev, line: line || 0, msg: msg, src: src || '' }); }
    var sdoc = null, S = null, qdoc = null;
    if (sdlText.trim()) { try { sdoc = G.parse(sdlText); } catch (e) { throw new Error(t('스키마 구문 오류: ', 'Schema syntax error: ') + e.message); } S = G.schema(sdoc); S.errors.forEach(function (e) { add('error', e.line, e.msg, 'S'); }); }
    if (qText.trim()) { try { qdoc = G.parse(qText); } catch (e) { throw new Error(t('쿼리 구문 오류: ', 'Query syntax error: ') + e.message); } }
    var rows = [];
    if (S) {
      var T = S.types, names = Object.keys(T), dirsKnown = Object.assign({}, G.builtinDirectives);
      Object.keys(S.directives).forEach(function (k) { var args = {}; S.directives[k].args.forEach(function (a) { args[a.name] = G.typeStr(a.type); }); dirsKnown[k] = { args: args, locations: S.directives[k].locations }; });
      ['query', 'mutation', 'subscription'].forEach(function (r) { var n = S.roots[r]; if (n) { if (!T[n]) add('error', 0, t('루트 ' + r + ' 타입 "' + n + '" 이(가) 정의되지 않았습니다', 'Root ' + r + ' type "' + n + '" is not defined'), 'S'); else if (T[n].k !== 'type') add('error', T[n].line, t('루트 ' + r + ' 타입 "' + n + '" 은 object 타입이어야 합니다', 'Root ' + r + ' type "' + n + '" must be an object type'), 'S'); } });
      if (!S.roots.query) add('error', 0, t('Query 루트 타입이 없습니다 (type Query 또는 schema { query: … })', 'There is no Query root type (type Query or schema { query: … })'), 'S');
      function checkTypeRef(ty, line, ctx, wantInput) { var b = G.baseName(ty); if (!T[b]) { add('error', line, t(ctx + ' 의 타입 "' + b + '" 이(가) 정의되지 않았습니다', 'Type "' + b + '" used in ' + ctx + ' is not defined'), 'S'); return; } if (wantInput === true && !G.isInput(S, ty)) add('error', line, t(ctx + ' 의 타입 "' + b + '" 은(는) 입력 타입(scalar, enum, input)이어야 합니다', 'Type "' + b + '" in ' + ctx + ' must be an input type (scalar, enum or input)'), 'S'); if (wantInput === false && !G.isOutput(S, ty)) add('error', line, t(ctx + ' 의 타입 "' + b + '" 은(는) 출력 타입이어야 합니다 (input 타입 불가)', 'Type "' + b + '" in ' + ctx + ' must be an output type (not an input)'), 'S'); }
      function checkDirs(ds, loc, where) { (ds || []).forEach(function (d) { var def = dirsKnown[d.name]; if (!def) { add('error', d.line, t(where + ' 에 정의되지 않은 지시어 @' + d.name, 'Undefined directive @' + d.name + ' on ' + where), 'S'); return; } if (def.locations.indexOf(loc) < 0) add('error', d.line, t('@' + d.name + ' 는 ' + loc + ' 위치에 쓸 수 없습니다', '@' + d.name + ' cannot be used on ' + loc), 'S'); }); }
      var used = {}; function use(n) { used[n] = true; }
      names.forEach(function (n) {
        var ty = T[n]; if (ty.builtin) return;
        if (!/^[A-Z]/.test(n) && o.hints) add('info', ty.line, t('타입 이름 ' + n + ' 은(는) 파스칼 케이스(대문자 시작)가 관례입니다', 'Type name ' + n + ' is conventionally PascalCase'), 'S');
        if (/^__/.test(n)) add('error', ty.line, t('이름은 __ 로 시작할 수 없습니다 (예약)', 'Names must not start with __ (reserved)'), 'S');
        checkDirs(ty.directives, ty.k === 'scalar' ? 'SCALAR' : ty.k === 'type' ? 'OBJECT' : ty.k === 'interface' ? 'INTERFACE' : ty.k === 'union' ? 'UNION' : ty.k === 'enum' ? 'ENUM' : 'INPUT_OBJECT', n);
        if (ty.k === 'type' || ty.k === 'interface') {
          if (!ty.fields.length) add('error', ty.line, t(n + ' 에 필드가 없습니다', n + ' has no fields'), 'S');
          var seenF = {}; ty.fields.forEach(function (f) {
            if (seenF[f.name]) add('error', f.line, t(n + '.' + f.name + ' 필드가 중복되었습니다', 'Field ' + n + '.' + f.name + ' is duplicated'), 'S'); seenF[f.name] = f;
            checkTypeRef(f.type, f.line, n + '.' + f.name, false); use(G.baseName(f.type));
            f.args.forEach(function (a) { checkTypeRef(a.type, a.line, n + '.' + f.name + '(' + a.name + ')', true); use(G.baseName(a.type)); checkDirs(a.directives, 'ARGUMENT_DEFINITION', n + '.' + f.name + '(' + a.name + ')'); });
            checkDirs(f.directives, 'FIELD_DEFINITION', n + '.' + f.name);
            if (o.hints && /^[A-Z]/.test(f.name)) add('info', f.line, t('필드 이름 ' + f.name + ' 은(는) camelCase 가 관례입니다', 'Field name ' + f.name + ' is conventionally camelCase'), 'S');
          });
          (ty.interfaces || []).forEach(function (iname) {
            use(iname); var it = T[iname]; if (!it) { add('error', ty.line, t(n + ' 이(가) 구현하는 인터페이스 ' + iname + ' 이(가) 정의되지 않았습니다', n + ' implements undefined interface ' + iname), 'S'); return; } if (it.k !== 'interface') { add('error', ty.line, t(iname + ' 은(는) 인터페이스가 아닙니다', iname + ' is not an interface'), 'S'); return; }
            it.fields.forEach(function (ifld) { var f = (ty.fields || []).filter(function (x) { return x.name === ifld.name; })[0]; if (!f) { add('error', ty.line, t(n + ' 에 인터페이스 ' + iname + ' 의 필드 ' + ifld.name + ' 이(가) 없습니다', n + ' is missing field ' + ifld.name + ' of interface ' + iname), 'S'); return; } var a = G.typeStr(f.type), b = G.typeStr(ifld.type); if (a !== b && !(a.replace(/!$/, '') === b && /!$/.test(a))) add('error', f.line, t(n + '.' + f.name + ' 의 타입 ' + a + ' 이(가) 인터페이스 ' + iname + ' 의 ' + b + ' 와 호환되지 않습니다', n + '.' + f.name + ' has type ' + a + ' incompatible with ' + b + ' of interface ' + iname), 'S'); ifld.args.forEach(function (ia) { if (!f.args.some(function (x) { return x.name === ia.name; })) add('error', f.line, t(n + '.' + f.name + ' 에 인터페이스의 인자 ' + ia.name + ' 이(가) 없습니다', n + '.' + f.name + ' is missing argument ' + ia.name + ' of the interface'), 'S'); }); });
          });
        } else if (ty.k === 'union') {
          if (!ty.members.length) add('error', ty.line, t('union ' + n + ' 에 멤버가 없습니다', 'Union ' + n + ' has no members'), 'S');
          ty.members.forEach(function (m) { use(m); if (!T[m]) add('error', ty.line, t('union ' + n + ' 의 멤버 ' + m + ' 이(가) 정의되지 않았습니다', 'Union ' + n + ' member ' + m + ' is not defined'), 'S'); else if (T[m].k !== 'type') add('error', ty.line, t('union ' + n + ' 의 멤버 ' + m + ' 은(는) object 타입이어야 합니다', 'Union ' + n + ' member ' + m + ' must be an object type'), 'S'); });
        } else if (ty.k === 'enum') {
          if (!ty.values.length) add('error', ty.line, t('enum ' + n + ' 에 값이 없습니다', 'Enum ' + n + ' has no values'), 'S'); var seenV = {}; ty.values.forEach(function (ev) { if (seenV[ev.name]) add('error', ev.line, t('enum ' + n + ' 의 값 ' + ev.name + ' 이(가) 중복되었습니다', 'Enum ' + n + ' value ' + ev.name + ' is duplicated'), 'S'); seenV[ev.name] = 1; if (/^(true|false|null)$/.test(ev.name)) add('error', ev.line, t('enum 값은 true/false/null 일 수 없습니다', 'Enum values cannot be true / false / null'), 'S'); checkDirs(ev.directives, 'ENUM_VALUE', n + '.' + ev.name); if (o.hints && !/^[A-Z][A-Z0-9_]*$/.test(ev.name)) add('info', ev.line, t('enum 값 ' + ev.name + ' 은(는) SCREAMING_SNAKE_CASE 가 관례입니다', 'Enum value ' + ev.name + ' is conventionally SCREAMING_SNAKE_CASE'), 'S'); });
        } else if (ty.k === 'input') {
          if (!ty.fields.length) add('error', ty.line, t('input ' + n + ' 에 필드가 없습니다', 'Input ' + n + ' has no fields'), 'S'); ty.fields.forEach(function (f) { checkTypeRef(f.type, f.line, n + '.' + f.name, true); use(G.baseName(f.type)); if (f.type.k === 'nonnull' && f.default) add('info', f.line, t('필수 필드 ' + n + '.' + f.name + ' 에 기본값이 있습니다 (호출자는 생략할 수 없음)', 'Required field ' + n + '.' + f.name + ' has a default (callers still cannot omit it)'), 'S'); });
        }
      });
      Object.keys(S.directives).forEach(function (dn) { S.directives[dn].args.forEach(function (a) { use(G.baseName(a.type)); }); });
      ['query', 'mutation', 'subscription'].forEach(function (r) { if (S.roots[r]) use(S.roots[r]); });
      if (o.hints) names.forEach(function (n) { var ty = T[n]; if (!ty.builtin && !used[n] && n !== S.roots.query && n !== S.roots.mutation && n !== S.roots.subscription) add('info', ty.line, t('타입 ' + n + ' 을(를) 참조하는 곳이 없습니다', 'Type ' + n + ' is never referenced'), 'S'); });
      names.forEach(function (n) { var ty = T[n]; if (ty.builtin) return; var cnt = ty.k === 'type' || ty.k === 'interface' || ty.k === 'input' ? ty.fields.length : ty.k === 'enum' ? ty.values.length : ty.k === 'union' ? ty.members.length : '—'; rows.push([n, ty.k, String(cnt), (S.roots.query === n ? 'Query ' : '') + (S.roots.mutation === n ? 'Mutation ' : '') + (S.roots.subscription === n ? 'Subscription ' : '') + ((ty.interfaces || []).length ? '→ ' + ty.interfaces.join(', ') : ''), String(ty.line)]); });
      /* 쿼리 검증 */
      if (qdoc) {
        var fragments = {}, ops = {}, opNames = {};
        qdoc.defs.forEach(function (d) { if (d.k === 'fragment') { if (fragments[d.name]) add('error', d.line, t('프래그먼트 ' + d.name + ' 이(가) 중복되었습니다', 'Fragment ' + d.name + ' is duplicated'), 'Q'); fragments[d.name] = d; } else if (d.k === 'operation') { if (d.name) { if (opNames[d.name]) add('error', d.line, t('오퍼레이션 이름 ' + d.name + ' 이(가) 중복되었습니다', 'Operation name ' + d.name + ' is duplicated'), 'Q'); opNames[d.name] = d; } } else add('error', d.line, t('쿼리 문서에 스키마 정의(' + d.k + ')가 있습니다', 'The query document contains a schema definition (' + d.k + ')'), 'Q'); });
        var opCount = qdoc.defs.filter(function (d) { return d.k === 'operation'; });
        if (opCount.length > 1 && opCount.some(function (d) { return d.anon; })) add('error', opCount[0].line, t('익명 오퍼레이션은 문서에 하나뿐일 때만 쓸 수 있습니다', 'An anonymous operation is allowed only when it is the only operation'), 'Q');
        var usedFrag = {};
        function fieldDef(tn, fname) { var ty = T[tn]; if (!ty) return null; if (fname === '__typename') return { type: { k: 'named', name: 'String' }, args: [] }; if (ty.k === 'type' || ty.k === 'interface') return (ty.fields || []).filter(function (f) { return f.name === fname; })[0] || null; return null; }
        function valueKindOk(val, ty) { /* 리터럴이 입력 타입에 대략 맞는지 */
          if (val.k === 'var') return true; if (ty.k === 'nonnull') { if (val.k === 'null') return false; return valueKindOk(val, ty.of); } if (val.k === 'null') return true;
          if (ty.k === 'list') { if (val.k === 'list') return val.items.every(function (x) { return valueKindOk(x, ty.of); }); return valueKindOk(val, ty.of); }
          var b = T[ty.name]; if (!b) return true;
          if (b.k === 'scalar') { if (ty.name === 'Int') return val.k === 'int'; if (ty.name === 'Float') return val.k === 'int' || val.k === 'float'; if (ty.name === 'String') return val.k === 'string'; if (ty.name === 'Boolean') return val.k === 'bool'; if (ty.name === 'ID') return val.k === 'int' || val.k === 'string'; return true; }
          if (b.k === 'enum') return val.k === 'enum' && b.values.some(function (x) { return x.name === val.v; });
          if (b.k === 'input') { if (val.k !== 'object') return false; return val.fields.every(function (f) { var fd = b.fields.filter(function (x) { return x.name === f.name; })[0]; return fd && valueKindOk(f.value, fd.type); }) && b.fields.every(function (fd) { return fd.type.k !== 'nonnull' || fd.default || val.fields.some(function (f) { return f.name === fd.name; }); }); }
          return false;
        }
        function selCheck(sels, tn, vars, usedVars, where) {
          var ty = T[tn];
          sels.forEach(function (s) {
            if (s.k === 'field') {
              var fd = fieldDef(tn, s.name);
              if (!fd) { if (ty && ty.k === 'union') add('error', s.line, t('union ' + tn + ' 에는 직접 필드를 선택할 수 없습니다 (… on 타입 사용)', 'Cannot select fields directly on union ' + tn + ' (use … on Type)'), 'Q'); else if (ty) { var sug = (ty.fields || []).map(function (f) { return f.name; }).filter(function (nm) { return nm.toLowerCase() === s.name.toLowerCase() || (Math.abs(nm.length - s.name.length) <= 2 && lev(nm, s.name) <= 2); })[0]; add('error', s.line, t('타입 ' + tn + ' 에 필드 "' + s.name + '" 이(가) 없습니다' + (sug ? ' — "' + sug + '" 을(를) 말씀하셨나요?' : ''), 'Cannot query field "' + s.name + '" on type ' + tn + (sug ? ' — did you mean "' + sug + '"?' : '')), 'Q'); } return; }
              var bn = G.baseName(fd.type), bt = T[bn];
              s.args.forEach(function (a) { var ad = fd.args.filter(function (x) { return x.name === a.name; })[0]; if (!ad) { add('error', s.line, t('필드 ' + tn + '.' + s.name + ' 에 인자 "' + a.name + '" 이(가) 없습니다', 'Field ' + tn + '.' + s.name + ' has no argument "' + a.name + '"'), 'Q'); return; } if (a.value.k === 'var') { usedVars[a.value.name] = true; var vd = vars[a.value.name]; if (!vd) add('error', s.line, t('변수 $' + a.value.name + ' 이(가) 오퍼레이션에서 정의되지 않았습니다', 'Variable $' + a.value.name + ' is not defined by the operation'), 'Q'); else { var vt = G.typeStr(vd.type), at = G.typeStr(ad.type); var vtB = vt.replace(/!$/, ''), atB = at.replace(/!$/, ''); if (vtB !== atB && !(vtB === 'Int' && atB === 'Float') && !(vtB === 'ID' && atB === 'String')) add('error', s.line, t('변수 $' + a.value.name + ' 의 타입 ' + vt + ' 이(가) 인자 ' + a.name + ' 의 타입 ' + at + ' 와 맞지 않습니다', 'Variable $' + a.value.name + ' of type ' + vt + ' does not match argument ' + a.name + ' of type ' + at), 'Q'); else if (/!$/.test(at) && !/!$/.test(vt) && !vd.default && !ad.default) add('error', s.line, t('변수 $' + a.value.name + ' 은(는) nullable(' + vt + ')인데 인자 ' + a.name + ' 은(는) ' + at + ' 입니다 — 변수를 ' + vt + '! 로 선언하세요', 'Variable $' + a.value.name + ' is nullable (' + vt + ') but argument ' + a.name + ' is ' + at + ' — declare it as ' + vt + '!'), 'Q'); } } else if (!valueKindOk(a.value, ad.type)) add('error', s.line, t('인자 ' + a.name + ' 의 값 ' + G.valStr(a.value) + ' 이(가) 타입 ' + G.typeStr(ad.type) + ' 와 맞지 않습니다', 'Argument ' + a.name + ' has value ' + G.valStr(a.value) + ' which does not match type ' + G.typeStr(ad.type)), 'Q'); });
              fd.args.forEach(function (ad) { if (ad.type.k === 'nonnull' && !ad.default && !s.args.some(function (a) { return a.name === ad.name; })) add('error', s.line, t('필드 ' + tn + '.' + s.name + ' 의 필수 인자 "' + ad.name + '" 이(가) 없습니다', 'Field ' + tn + '.' + s.name + ' is missing required argument "' + ad.name + '"'), 'Q'); });
              s.directives.forEach(function (d) { var def = dirsKnown[d.name]; if (!def) add('error', d.line, t('정의되지 않은 지시어 @' + d.name, 'Undefined directive @' + d.name), 'Q'); else d.args.forEach(function (a) { if (a.value.k === 'var') usedVars[a.value.name] = true; }); });
              var composite = bt && (bt.k === 'type' || bt.k === 'interface' || bt.k === 'union');
              if (s.selections && !composite) add('error', s.line, t('"' + s.name + '" 은(는) 리프 타입(' + bn + ')이라 하위 선택을 할 수 없습니다', '"' + s.name + '" is a leaf type (' + bn + ') and cannot have a selection set'), 'Q');
              else if (!s.selections && composite) add('error', s.line, t('"' + s.name + '" 은(는) ' + bn + ' 타입이라 하위 필드를 선택해야 합니다', '"' + s.name + '" returns ' + bn + ' and needs a selection of subfields'), 'Q');
              else if (s.selections) selCheck(s.selections, bn, vars, usedVars, where);
            } else if (s.k === 'spread') { usedFrag[s.name] = true; var fr = fragments[s.name]; if (!fr) add('error', s.line, t('프래그먼트 ' + s.name + ' 이(가) 정의되지 않았습니다', 'Unknown fragment ' + s.name), 'Q'); else if (T[fr.on] && ty && !possible(tn, fr.on)) add('error', s.line, t('프래그먼트 ' + s.name + ' (on ' + fr.on + ') 은(는) 타입 ' + tn + ' 에 적용할 수 없습니다', 'Fragment ' + s.name + ' (on ' + fr.on + ') cannot be spread on type ' + tn), 'Q'); }
            else { var cond = s.typeCondition || tn; if (!T[cond]) add('error', s.line, t('인라인 프래그먼트의 타입 ' + cond + ' 이(가) 스키마에 없습니다', 'Inline fragment type ' + cond + ' is not in the schema'), 'Q'); else { if (!possible(tn, cond)) add('error', s.line, t('타입 ' + tn + ' 에서 ... on ' + cond + ' 은(는) 가능하지 않습니다', '... on ' + cond + ' is not possible on type ' + tn), 'Q'); selCheck(s.selections, cond, vars, usedVars, where); } }
          });
        }
        function possible(a, b) { if (a === b) return true; function objs(n) { var ty = T[n]; if (!ty) return []; if (ty.k === 'type') return [n]; if (ty.k === 'union') return ty.members; if (ty.k === 'interface') return names.filter(function (x) { return T[x].k === 'type' && (T[x].interfaces || []).indexOf(n) >= 0; }); return []; } var oa = objs(a), ob = objs(b); return oa.some(function (x) { return ob.indexOf(x) >= 0; }); }
        function lev(a, b) { var dp = []; for (var i = 0; i <= a.length; i++) { dp[i] = [i]; } for (var j = 1; j <= b.length; j++) dp[0][j] = j; for (var i2 = 1; i2 <= a.length; i2++) for (var j2 = 1; j2 <= b.length; j2++) dp[i2][j2] = Math.min(dp[i2 - 1][j2] + 1, dp[i2][j2 - 1] + 1, dp[i2 - 1][j2 - 1] + (a[i2 - 1] === b[j2 - 1] ? 0 : 1)); return dp[a.length][b.length]; }
        var fragUsedVars = {};
        qdoc.defs.forEach(function (d) {
          if (d.k === 'operation') {
            var root = S.roots[d.op]; if (!root || !T[root]) { add('error', d.line, t('스키마에 ' + d.op + ' 루트 타입이 없습니다', 'The schema has no ' + d.op + ' root type'), 'Q'); return; }
            var vars = {}, usedVars = {}; d.vars.forEach(function (vd) { if (vars[vd.name]) add('error', vd.line, t('변수 $' + vd.name + ' 이(가) 중복 정의되었습니다', 'Variable $' + vd.name + ' is defined twice'), 'Q'); vars[vd.name] = vd; if (!G.isInput(S, vd.type)) add('error', vd.line, t('변수 $' + vd.name + ' 의 타입 ' + G.typeStr(vd.type) + ' 은(는) 입력 타입이 아닙니다', 'Variable $' + vd.name + ' type ' + G.typeStr(vd.type) + ' is not an input type'), 'Q'); });
            selCheck(d.selections, root, vars, usedVars, d.name || d.op);
            d.vars.forEach(function (vd) { if (!usedVars[vd.name]) add('warn', vd.line, t('변수 $' + vd.name + ' 이(가) 사용되지 않습니다', 'Variable $' + vd.name + ' is never used'), 'Q'); });
          } else if (d.k === 'fragment') { if (!T[d.on]) add('error', d.line, t('프래그먼트 ' + d.name + ' 의 타입 ' + d.on + ' 이(가) 스키마에 없습니다', 'Fragment ' + d.name + ' type ' + d.on + ' is not in the schema'), 'Q'); else if (T[d.on].k === 'scalar' || T[d.on].k === 'enum' || T[d.on].k === 'input') add('error', d.line, t('프래그먼트는 object/interface/union 에만 쓸 수 있습니다', 'Fragments apply only to object, interface or union types'), 'Q'); else selCheck(d.selections, d.on, {}, fragUsedVars, d.name); }
        });
        Object.keys(fragments).forEach(function (fn) { if (!usedFrag[fn]) add('warn', fragments[fn].line, t('프래그먼트 ' + fn + ' 이(가) 사용되지 않습니다', 'Fragment ' + fn + ' is never used'), 'Q'); });
        /* 프래그먼트 순환 */
        Object.keys(fragments).forEach(function (fn) { var seen = {}; (function walk(name, path) { if (path.indexOf(name) >= 0) { add('error', fragments[fn].line, t('프래그먼트 순환: ' + path.concat(name).join(' → '), 'Fragment cycle: ' + path.concat(name).join(' → ')), 'Q'); return; } var fr = fragments[name]; if (!fr || seen[name]) return; seen[name] = 1; (function sw(sels) { sels.forEach(function (s) { if (s.k === 'spread') walk(s.name, path.concat(name)); else if (s.selections) sw(s.selections); }); })(fr.selections); })(fn, []); });
      }
    }
    if (qdoc && !S) add('info', 0, t('스키마(SDL)를 함께 넣으면 쿼리의 필드·인자·변수 타입을 검증합니다. 지금은 구문과 서식만 확인했습니다', 'Add a schema (SDL) to validate fields, arguments and variable types; only syntax and formatting were checked'), 'Q');
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' }, seen2 = {};
    var shown = issues.filter(function (x) { return o.hints || x.sev !== 'info'; }).filter(function (x) { var k = x.src + x.line + x.msg; if (seen2[k]) return false; seen2[k] = 1; return true; }).sort(function (a, b) { return (a.src === b.src ? 0 : a.src === 'S' ? -1 : 1) || a.line - b.line; });
    var list = shown.map(function (x) { return ICON[x.sev] + ' ' + (x.src === 'S' ? t('스키마', 'Schema') : x.src === 'Q' ? t('쿼리', 'Query') : '') + (x.line ? ' ' + t('줄 ', 'line ') + x.line : '') + ': ' + x.msg; });
    var errs = shown.filter(function (x) { return x.sev === 'error'; }).length, warns = shown.filter(function (x) { return x.sev === 'warn'; }).length;
    var msg = errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : ''), '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : ''));
    if (S) msg += t(' — 타입 ' + rows.length + '개', ' — ' + rows.length + ' type(s)');
    return { _status: { ok: errs ? false : true, msg: msg }, table: { head: [['타입', 'Type'], ['종류', 'Kind'], ['필드·값 수', 'Members'], ['역할·구현', 'Role / implements'], ['줄', 'Line']], rows: rows }, issues: list, out: sdoc ? G.print(sdoc) : '', qout: qdoc ? G.print(qdoc) : '' };
  }
});
