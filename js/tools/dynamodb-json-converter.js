TK.tool('dynamodb-json-converter', {
  inputs: [{ id: 'in', label: ['입력 JSON', 'Input JSON'], rows: 14, sample: '{\n  "Item": {\n    "pk": {"S": "USER#42"},\n    "age": {"N": "31"},\n    "active": {"BOOL": true},\n    "nick": {"NULL": true},\n    "tags": {"SS": ["a", "b"]},\n    "scores": {"NS": ["1.5", "2"]},\n    "addr": {"M": {"city": {"S": "Seoul"}, "zip": {"S": "04524"}}},\n    "history": {"L": [{"S": "x"}, {"N": "7"}]},\n    "avatar": {"B": "aGVsbG8="}\n  }\n}' }],
  options: [
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['from', ['DynamoDB JSON → 일반 JSON', 'DynamoDB JSON → plain JSON']], ['to', ['일반 JSON → DynamoDB JSON', 'Plain JSON → DynamoDB JSON']]], default: 'from' },
    { id: 'sets', type: 'checkbox', label: ['(일반→DynamoDB) 원소가 모두 문자열/숫자인 배열을 SS/NS 집합으로', '(plain → DynamoDB) arrays of only strings / numbers become SS / NS sets'], default: false, show: function (o) { return o.dir === 'to'; } },
    { id: 'big', type: 'checkbox', label: ['(DynamoDB→일반) 큰 숫자는 문자열 유지', '(DynamoDB → plain) keep big numbers as strings'], default: true, show: function (o) { return o.dir === 'from'; } }
  ],
  outputs: [{ id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var data; try { data = JSON.parse(v.in); } catch (e) { throw new Error(t('JSON 형식 오류: ' + e.message, 'Invalid JSON: ' + e.message)); }
    var issues = [];
    function wrapNum(n) { return String(n); }
    function toDdb(x, path) {
      if (x === null) return { NULL: true };
      if (typeof x === 'string') return { S: x };
      if (typeof x === 'boolean') return { BOOL: x };
      if (typeof x === 'number') { if (!isFinite(x)) throw new Error(t('NaN/Infinity 는 DynamoDB 숫자로 쓸 수 없습니다: ' + path, 'NaN / Infinity cannot be a DynamoDB number: ' + path)); return { N: wrapNum(x) }; }
      if (Array.isArray(x)) {
        if (o.sets && x.length && x.every(function (e) { return typeof e === 'string'; }) && new Set(x).size === x.length) return { SS: x.slice() };
        if (o.sets && x.length && x.every(function (e) { return typeof e === 'number'; }) && new Set(x).size === x.length) return { NS: x.map(wrapNum) };
        return { L: x.map(function (e, i) { return toDdb(e, path + '[' + i + ']'); }) };
      }
      var m = {}; Object.keys(x).forEach(function (k) { m[k] = toDdb(x[k], path + '.' + k); }); return { M: m };
    }
    function fromDdb(x, path) {
      if (x === null || typeof x !== 'object' || Array.isArray(x)) throw new Error(t('DynamoDB 속성 값이 아닙니다 (' + path + ')', 'Not a DynamoDB attribute value (' + path + ')'));
      var ks = Object.keys(x); if (ks.length !== 1) throw new Error(t('속성 값은 타입 하나만 가져야 합니다 (' + path + ': ' + ks.join(', ') + ')', 'An attribute value has exactly one type (' + path + ': ' + ks.join(', ') + ')'));
      var k = ks[0], val = x[k];
      switch (k) {
        case 'S': return val;
        case 'N': { var n = Number(val); if (isNaN(n)) throw new Error(t('숫자가 아닙니다 (' + path + '): ' + val, 'Not a number (' + path + '): ' + val)); if (o.big && (String(n) !== String(val).replace(/^\+/, '') && !/^-?\d+(\.\d+)?$/.test(String(val)) || Math.abs(n) > Number.MAX_SAFE_INTEGER)) { issues.push(t(path + ': 정밀도 손실 위험이 있어 문자열로 유지했습니다 (' + val + ')', path + ': kept as a string to avoid precision loss (' + val + ')')); return String(val); } return n; }
        case 'BOOL': return !!val;
        case 'NULL': return null;
        case 'B': return { $binary: val };
        case 'SS': return val.slice();
        case 'NS': return val.map(Number);
        case 'BS': return val.map(function (b) { return { $binary: b }; });
        case 'L': return val.map(function (e, i) { return fromDdb(e, path + '[' + i + ']'); });
        case 'M': { var r = {}; Object.keys(val).forEach(function (kk) { r[kk] = fromDdb(val[kk], path + '.' + kk); }); return r; }
        default: throw new Error(t('알 수 없는 타입 "' + k + '" (' + path + ')', 'Unknown type "' + k + '" (' + path + ')'));
      }
    }
    var out;
    if (o.dir === 'to') {
      if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
        if (Array.isArray(data.Items)) out = Object.assign({}, data, { Items: data.Items.map(function (it) { return toDdb(it, 'Items').M; }) });
        else if (data.Item && typeof data.Item === 'object') out = Object.assign({}, data, { Item: toDdb(data.Item, 'Item').M });
        else out = toDdb(data, '$').M;
      } else if (Array.isArray(data)) out = data.map(function (it, i) { return toDdb(it, '[' + i + ']').M || toDdb(it, '[' + i + ']'); });
      else out = toDdb(data, '$');
      issues.push(t('숫자는 문자열 N 으로 감싸집니다. 빈 문자열은 지금은 허용되지만 이전 버전/인덱스 키에서는 불가했습니다', 'Numbers are wrapped as string N values. Empty strings are allowed today but were not in older versions or as index keys'));
      if (!o.sets) issues.push(t('배열은 모두 L(리스트)로 변환했습니다. 중복 없는 문자열/숫자 집합이 필요하면 SS/NS 옵션을 켜세요', 'All arrays became L (list). Turn on the SS / NS option for unique string / number sets'));
    } else {
      if (data && Array.isArray(data.Items)) out = Object.assign({}, data, { Items: data.Items.map(function (it) { return fromDdb({ M: it }, 'Items'); }) });
      else if (data && data.Item && typeof data.Item === 'object') out = Object.assign({}, data, { Item: fromDdb({ M: data.Item }, 'Item') });
      else if (Array.isArray(data)) out = data.map(function (it, i) { return fromDdb({ M: it }, '[' + i + ']'); });
      else if (data && typeof data === 'object' && Object.keys(data).length === 1 && /^(S|N|BOOL|NULL|B|SS|NS|BS|L|M)$/.test(Object.keys(data)[0])) out = fromDdb(data, '$');
      else out = fromDdb({ M: data }, '$');
      issues.push(t('집합(SS/NS/BS)은 배열로 변환되어 집합이라는 정보가 사라집니다. 바이너리는 {"$binary": base64} 로 표시했습니다', 'Sets (SS / NS / BS) become arrays and lose the set property. Binary values are shown as {"$binary": base64}'));
    }
    return { _status: t('✅ 변환했습니다', '✅ Converted'), out: JSON.stringify(out, null, 2), issues: issues };
  }
});
