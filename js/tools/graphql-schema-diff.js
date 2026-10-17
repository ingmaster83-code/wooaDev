TK.tool('graphql-schema-diff', {
  sampleExpectError: true,
  inputs: [
    { id: 'a', label: ['이전 스키마 (SDL)', 'Old schema (SDL)'], rows: 20, sample: [
      'type Query {', '  user(id: ID!): User', '  users(role: Role, limit: Int = 10): [User!]!', '  legacy: String', '}',
      'type User {', '  id: ID!', '  name: String', '  email: String!', '  role: Role!', '  age: Int', '}',
      'enum Role { ADMIN EDITOR VIEWER }', 'input Filter { text: String, active: Boolean }', 'union Result = User | Post', 'type Post { id: ID! }', 'interface Entity { id: ID! }', ''].join('\n') },
    { id: 'b', label: ['새 스키마 (SDL)', 'New schema (SDL)'], rows: 20, sample: [
      'type Query {', '  user(id: String!, expand: Boolean!): User', '  users(role: Role, limit: Int = 25): [User]', '  version: String', '}',
      'type User implements Entity {', '  id: ID!', '  name: String!', '  email: String', '  role: Role!', '  nickname: String', '}',
      'enum Role { ADMIN EDITOR GUEST }', 'input Filter { text: String!, active: Boolean, tag: String }', 'union Result = User | Post | Comment', 'type Post { id: ID! }', 'type Comment { id: ID! }', 'interface Entity { id: ID! }', ''].join('\n') }
  ],
  options: [{ id: 'show', type: 'select', label: ['표시', 'Show'], choices: [['all', ['모두', 'All']], ['risk', ['깨짐·위험만', 'Breaking and dangerous only']]], default: 'all' }],
  outputs: [{ id: 'table', label: ['변경 사항', 'Changes'], kind: 'table' }, { id: 'issues', label: ['요약', 'Summary'], kind: 'list' }],
  run: function (v, o, t) {
    var G = TK.graphql, rows = [], seenR = {};
    function load(txt, label) { if (!String(txt || '').trim()) throw new Error(t(label + ' 를 입력하세요', 'Enter the ' + label)); var d; try { d = G.parse(txt); } catch (e) { throw new Error(label + ' ' + t('구문 오류: ', 'syntax error: ') + e.message); } var S = G.schema(d); if (S.errors.length) throw new Error(label + ': ' + S.errors[0].msg); return S; }
    var A = load(v.a, t('이전 스키마', 'old schema')), B = load(v.b, t('새 스키마', 'new schema'));
    var SEV = { breaking: '⛔', danger: '⚠️', safe: '✅', info: 'ℹ️' };
    function add(sev, where, what) { var k = sev + where + what; if (seenR[k]) return; seenR[k] = 1; rows.push([SEV[sev] + ' ' + (sev === 'breaking' ? t('깨짐', 'breaking') : sev === 'danger' ? t('위험', 'dangerous') : sev === 'safe' ? t('안전', 'safe') : t('참고', 'info')), where, what]); }
    /** 출력 위치: 새 타입이 이전 타입의 하위 타입이면 안전. 입력 위치: 새 타입이 상위 타입이면 안전 */
    function relation(a, b, input) {
      var sa = G.typeStr(a), sb = G.typeStr(b); if (sa === sb) return 'same';
      function strip(ty) { var nn = false; if (ty.k === 'nonnull') { nn = true; ty = ty.of; } return { nn: nn, ty: ty }; }
      var x = strip(a), y = strip(b);
      if (x.ty.k === 'list' && y.ty.k === 'list') { var r = relation(x.ty.of, y.ty.of, input); if (r === 'breaking') return 'breaking'; if (x.nn === y.nn) return r; if (!x.nn && y.nn) return input ? 'breaking' : (r === 'same' || r === 'safe' ? 'safe' : r); return input ? (r === 'same' || r === 'safe' ? 'safe' : r) : 'breaking'; }
      if (x.ty.k !== y.ty.k) return 'breaking';
      if (x.ty.k === 'named' && x.ty.name !== y.ty.name) return 'breaking';
      if (x.nn === y.nn) return 'same';
      if (!x.nn && y.nn) return input ? 'breaking' : 'safe';
      return input ? 'safe' : 'breaking';
    }
    var tA = A.types, tB = B.types;
    Object.keys(tA).forEach(function (n) {
      var a = tA[n]; if (a.builtin) return; var b = tB[n];
      if (!b) { add('breaking', n, t(a.k + ' 타입 제거', a.k + ' type removed')); return; }
      if (a.k !== b.k) { add('breaking', n, t('종류 변경: ' + a.k + ' → ' + b.k, 'kind changed: ' + a.k + ' → ' + b.k)); return; }
      if (a.k === 'type' || a.k === 'interface') {
        a.fields.forEach(function (fa) {
          var fb = b.fields.filter(function (x) { return x.name === fa.name; })[0];
          if (!fb) { add('breaking', n + '.' + fa.name, t('필드 제거', 'field removed')); return; }
          var rel = relation(fa.type, fb.type, false);
          if (rel === 'breaking') add('breaking', n + '.' + fa.name, t('타입 ' + G.typeStr(fa.type) + ' → ' + G.typeStr(fb.type), 'type ' + G.typeStr(fa.type) + ' → ' + G.typeStr(fb.type)));
          else if (rel === 'safe') add('safe', n + '.' + fa.name, t('타입 ' + G.typeStr(fa.type) + ' → ' + G.typeStr(fb.type) + ' (더 엄격한 보장)', 'type ' + G.typeStr(fa.type) + ' → ' + G.typeStr(fb.type) + ' (stronger guarantee)'));
          var dA = fa.directives.some(function (d) { return d.name === 'deprecated'; }), dB = fb.directives.some(function (d) { return d.name === 'deprecated'; });
          if (!dA && dB) add('info', n + '.' + fa.name, t('deprecated 표시됨', 'marked deprecated')); if (dA && !dB) add('safe', n + '.' + fa.name, t('deprecated 해제', 'no longer deprecated'));
          fa.args.forEach(function (aa) {
            var ab = fb.args.filter(function (x) { return x.name === aa.name; })[0];
            if (!ab) { add('breaking', n + '.' + fa.name + '(' + aa.name + ')', t('인자 제거', 'argument removed')); return; }
            var r2 = relation(aa.type, ab.type, true);
            if (r2 === 'breaking') add('breaking', n + '.' + fa.name + '(' + aa.name + ')', t('인자 타입 ' + G.typeStr(aa.type) + ' → ' + G.typeStr(ab.type), 'argument type ' + G.typeStr(aa.type) + ' → ' + G.typeStr(ab.type)));
            else if (r2 === 'safe') add('safe', n + '.' + fa.name + '(' + aa.name + ')', t('인자 타입 ' + G.typeStr(aa.type) + ' → ' + G.typeStr(ab.type) + ' (더 넓게 허용)', 'argument type ' + G.typeStr(aa.type) + ' → ' + G.typeStr(ab.type) + ' (accepts more)'));
            var da = aa.default ? G.valStr(aa.default) : null, db = ab.default ? G.valStr(ab.default) : null;
            if (da !== db) add('danger', n + '.' + fa.name + '(' + aa.name + ')', t('기본값 ' + (da || '없음') + ' → ' + (db || '없음') + ' (인자를 생략한 호출의 결과가 달라짐)', 'default ' + (da || 'none') + ' → ' + (db || 'none') + ' (calls that omit the argument change behaviour)'));
          });
          fb.args.forEach(function (ab) { if (!fa.args.some(function (x) { return x.name === ab.name; })) add(ab.type.k === 'nonnull' && !ab.default ? 'breaking' : 'safe', n + '.' + fa.name + '(' + ab.name + ')', t('인자 추가' + (ab.type.k === 'nonnull' && !ab.default ? ' (필수)' : ' (선택)'), 'argument added' + (ab.type.k === 'nonnull' && !ab.default ? ' (required)' : ' (optional)'))); });
        });
        b.fields.forEach(function (fb) { if (!a.fields.some(function (x) { return x.name === fb.name; })) add('safe', n + '.' + fb.name, t('필드 추가', 'field added')); });
        var ia = a.interfaces || [], ib = b.interfaces || [];
        ia.filter(function (x) { return ib.indexOf(x) < 0; }).forEach(function (x) { add('breaking', n, t('인터페이스 ' + x + ' 구현 제거', 'no longer implements interface ' + x)); });
        ib.filter(function (x) { return ia.indexOf(x) < 0; }).forEach(function (x) { add('danger', n, t('인터페이스 ' + x + ' 구현 추가 (… on ' + x + ' 쿼리의 결과가 달라질 수 있음)', 'now implements interface ' + x + ' (results of … on ' + x + ' queries can change)')); });
      } else if (a.k === 'enum') {
        a.values.forEach(function (va) { if (!b.values.some(function (x) { return x.name === va.name; })) add('breaking', n + '.' + va.name, t('enum 값 제거', 'enum value removed')); });
        b.values.forEach(function (vb) { if (!a.values.some(function (x) { return x.name === vb.name; })) add('danger', n + '.' + vb.name, t('enum 값 추가 (클라이언트의 switch 가 처리하지 못할 수 있음)', 'enum value added (client switches may not handle it)')); });
      } else if (a.k === 'union') {
        a.members.forEach(function (m) { if (b.members.indexOf(m) < 0) add('breaking', n, t('union 멤버 ' + m + ' 제거', 'union member ' + m + ' removed')); });
        b.members.forEach(function (m) { if (a.members.indexOf(m) < 0) add('danger', n, t('union 멤버 ' + m + ' 추가 (클라이언트가 새 타입을 처리해야 함)', 'union member ' + m + ' added (clients must handle the new type)')); });
      } else if (a.k === 'input') {
        a.fields.forEach(function (fa) {
          var fb = b.fields.filter(function (x) { return x.name === fa.name; })[0];
          if (!fb) { add('breaking', n + '.' + fa.name, t('입력 필드 제거', 'input field removed')); return; }
          var r3 = relation(fa.type, fb.type, true);
          if (r3 === 'breaking') add('breaking', n + '.' + fa.name, t('타입 ' + G.typeStr(fa.type) + ' → ' + G.typeStr(fb.type), 'type ' + G.typeStr(fa.type) + ' → ' + G.typeStr(fb.type))); else if (r3 === 'safe') add('safe', n + '.' + fa.name, t('타입 ' + G.typeStr(fa.type) + ' → ' + G.typeStr(fb.type) + ' (더 넓게 허용)', 'type ' + G.typeStr(fa.type) + ' → ' + G.typeStr(fb.type) + ' (accepts more)'));
          var da2 = fa.default ? G.valStr(fa.default) : null, db2 = fb.default ? G.valStr(fb.default) : null; if (da2 !== db2) add('danger', n + '.' + fa.name, t('기본값 변경', 'default value changed'));
        });
        b.fields.forEach(function (fb) { if (!a.fields.some(function (x) { return x.name === fb.name; })) add(fb.type.k === 'nonnull' && !fb.default ? 'breaking' : 'safe', n + '.' + fb.name, t('입력 필드 추가' + (fb.type.k === 'nonnull' && !fb.default ? ' (필수)' : ' (선택)'), 'input field added' + (fb.type.k === 'nonnull' && !fb.default ? ' (required)' : ' (optional)'))); });
      }
    });
    Object.keys(tB).forEach(function (n) { if (!tA[n] && !tB[n].builtin) add('safe', n, t(tB[n].k + ' 타입 추가', tB[n].k + ' type added')); });
    Object.keys(A.directives).forEach(function (d) { if (!B.directives[d]) add('breaking', '@' + d, t('지시어 제거', 'directive removed')); });
    Object.keys(B.directives).forEach(function (d) { if (!A.directives[d]) add('safe', '@' + d, t('지시어 추가', 'directive added')); });
    ['query', 'mutation', 'subscription'].forEach(function (r) { if (A.roots[r] !== B.roots[r]) add(A.roots[r] && !B.roots[r] ? 'breaking' : 'danger', 'schema.' + r, (A.roots[r] || '—') + ' → ' + (B.roots[r] || '—')); });
    var cnt = { breaking: 0, danger: 0, safe: 0, info: 0 }; rows.forEach(function (r) { var s = r[0].indexOf('⛔') === 0 ? 'breaking' : r[0].indexOf('⚠️') === 0 ? 'danger' : r[0].indexOf('✅') === 0 ? 'safe' : 'info'; cnt[s]++; });
    var order = { '⛔': 0, '⚠️': 1, 'ℹ️': 2, '✅': 3 };
    var shown = (o.show === 'risk' ? rows.filter(function (r) { return r[0].indexOf('⛔') === 0 || r[0].indexOf('⚠️') === 0; }) : rows).slice().sort(function (a, b) { return order[a[0].split(' ')[0]] - order[b[0].split(' ')[0]]; });
    var sum = [(cnt.breaking ? '⛔ ' : '✅ ') + t('깨짐 ' + cnt.breaking + '건 · 위험 ' + cnt.danger + '건 · 안전 ' + cnt.safe + '건', cnt.breaking + ' breaking · ' + cnt.danger + ' dangerous · ' + cnt.safe + ' safe')];
    sum.push(t('판정 기준: 응답 필드는 타입이 더 엄격해지면(T → T!) 안전하고 느슨해지면(T! → T) 깨지며, 입력(인자·입력 필드)은 반대입니다. 필수 인자·입력 필드 추가와 필드·값 제거는 깨짐, enum 값·union 멤버·인터페이스 추가는 클라이언트 처리에 따라 위험으로 분류합니다 (graphql-inspector 와 같은 분류)', 'Rules: for response fields a stricter type (T → T!) is safe and a looser one (T! → T) breaks; inputs (arguments, input fields) are the reverse. Adding required arguments or input fields and removing fields or values break clients; adding enum values, union members or interfaces is dangerous depending on client handling (the same classes as graphql-inspector)'));
    return { _status: { ok: cnt.breaking ? false : true, msg: cnt.breaking ? t('⛔ 깨지는 변경 ' + cnt.breaking + '건 · 위험 ' + cnt.danger + '건', '⛔ ' + cnt.breaking + ' breaking · ' + cnt.danger + ' dangerous') : t('✅ 깨지는 변경 없음 (위험 ' + cnt.danger + '건)', '✅ No breaking changes (' + cnt.danger + ' dangerous)') }, table: { head: [['판정', 'Verdict'], ['위치', 'Where'], ['변경', 'Change']], rows: shown.slice(0, 500) }, issues: sum };
  }
});
