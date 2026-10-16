TK.tool('mongodb-ejson-converter', {
  inputs: [{ id: 'in', label: ['MongoDB 확장 JSON (EJSON)', 'MongoDB Extended JSON (EJSON)'], rows: 14, sample: '{\n  "_id": {"$oid": "507f1f77bcf86cd799439011"},\n  "createdAt": {"$date": {"$numberLong": "1760000000000"}},\n  "count": {"$numberInt": "42"},\n  "big": {"$numberLong": "9007199254740993"},\n  "price": {"$numberDouble": "19.99"},\n  "amount": {"$numberDecimal": "12345.6789"},\n  "uid": {"$uuid": "123e4567-e89b-12d3-a456-426614174000"},\n  "file": {"$binary": {"base64": "aGVsbG8=", "subType": "00"}},\n  "re": {"$regularExpression": {"pattern": "^a", "options": "i"}},\n  "name": "Kim"\n}' }],
  options: [{ id: 'to', type: 'select', label: ['변환 대상', 'Convert to'], choices: [['relaxed', ['Relaxed EJSON (읽기 쉬움)', 'Relaxed EJSON (readable)']], ['canonical', ['Canonical EJSON (타입 보존)', 'Canonical EJSON (type-preserving)']], ['plain', ['단순 JSON (타입 정보 제거)', 'Plain JSON (types stripped)']]], default: 'relaxed' }],
  outputs: [{ id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var data; try { data = JSON.parse(v.in); } catch (e) { throw new Error(t('JSON 형식 오류: ' + e.message, 'Invalid JSON: ' + e.message)); }
    var issues = [];
    // 1) 어떤 입력이든 먼저 내부 표현으로 정규화: {t:'int',v}, {t:'long',v}, {t:'double',v}, {t:'date',ms}, ...
    function dec(x) {
      if (x === null || typeof x !== 'object') { if (typeof x === 'number') return Number.isInteger(x) ? (Math.abs(x) <= 2147483647 ? { t: 'int', v: String(x) } : { t: 'long', v: String(x) }) : { t: 'double', v: String(x) }; return x; }
      if (Array.isArray(x)) return x.map(dec);
      var ks = Object.keys(x), k = ks[0];
      if (ks.length === 1 || (k === '$binary' && ks.length === 1)) {
        var a = x[k];
        if (k === '$oid') return { t: 'oid', v: a };
        if (k === '$numberInt') return { t: 'int', v: String(a) };
        if (k === '$numberLong') return { t: 'long', v: String(a) };
        if (k === '$numberDouble') return { t: 'double', v: String(a) };
        if (k === '$numberDecimal') return { t: 'decimal', v: String(a) };
        if (k === '$date') { if (a && typeof a === 'object' && a.$numberLong !== undefined) return { t: 'date', ms: Number(a.$numberLong) }; var ms = typeof a === 'number' ? a : Date.parse(a); if (isNaN(ms)) throw new Error(t('$date 값을 해석할 수 없습니다: ' + JSON.stringify(a), 'Cannot parse $date: ' + JSON.stringify(a))); return { t: 'date', ms: ms }; }
        if (k === '$uuid') return { t: 'uuid', v: a };
        if (k === '$binary') return { t: 'bin', b64: a.base64 !== undefined ? a.base64 : a, sub: a.subType || '00' };
        if (k === '$regularExpression') return { t: 're', p: a.pattern, f: a.options || '' };
        if (k === '$timestamp') return { t: 'ts', v: a };
        if (k === '$minKey' || k === '$maxKey' || k === '$undefined') return { t: 'misc', k: k, v: a };
        if (k === '$symbol') return { t: 'sym', v: a };
        if (k === '$code') return { t: 'code', v: a };
      }
      var r = {}; ks.forEach(function (kk) { r[kk] = dec(x[kk]); }); return r;
    }
    function iso(ms) { return new Date(ms).toISOString().replace('.000Z', 'Z'); }
    function enc(x, mode) {
      if (x === null || typeof x !== 'object') return x;
      if (Array.isArray(x)) return x.map(function (e) { return enc(e, mode); });
      if (x.t) {
        var plain = mode === 'plain', canon = mode === 'canonical';
        switch (x.t) {
          case 'oid': return plain ? x.v : { $oid: x.v };
          case 'int': return canon ? { $numberInt: x.v } : Number(x.v);
          case 'long': if (canon) return { $numberLong: x.v }; if (Math.abs(Number(x.v)) > Number.MAX_SAFE_INTEGER) { issues.push(t('64비트 정수 ' + x.v + ' 는 JSON 숫자로 정밀도를 잃을 수 있어 $numberLong 으로 유지했습니다', 'The 64-bit integer ' + x.v + ' may lose precision as a JSON number, so $numberLong was kept')); return { $numberLong: x.v }; } return Number(x.v);
          case 'double': if (canon) return { $numberDouble: x.v }; if (!isFinite(Number(x.v)) || x.v === 'NaN') return { $numberDouble: x.v }; return Number(x.v);
          case 'decimal': return plain ? x.v : { $numberDecimal: x.v };
          case 'date': return plain ? iso(x.ms) : canon ? { $date: { $numberLong: String(x.ms) } } : (x.ms >= 0 && x.ms < 253402300800000 ? { $date: iso(x.ms) } : { $date: { $numberLong: String(x.ms) } });
          case 'uuid': return plain ? x.v : { $uuid: x.v };
          case 'bin': return plain ? x.b64 : { $binary: { base64: x.b64, subType: x.sub } };
          case 're': return plain ? '/' + x.p + '/' + x.f : { $regularExpression: { pattern: x.p, options: x.f } };
          case 'ts': return plain ? x.v : { $timestamp: x.v };
          case 'misc': return plain ? x.k : (function () { var r = {}; r[x.k] = x.v; return r; })();
          case 'sym': return plain ? x.v : { $symbol: x.v };
          case 'code': return plain ? x.v : { $code: x.v };
        }
      }
      var r = {}; Object.keys(x).forEach(function (k) { r[k] = enc(x[k], mode); }); return r;
    }
    var out = enc(dec(data), o.to);
    if (o.to === 'plain') issues.push(t('타입 정보가 사라지므로 다시 MongoDB 로 넣으면 ObjectId·Date 가 문자열이 됩니다', 'Type information is lost, so re-importing into MongoDB turns ObjectId and Date into strings'));
    if (o.to === 'relaxed') issues.push(t('Relaxed 에서는 int32/int64/double 이 보통 JSON 숫자로 표시되어 원래 타입을 구분할 수 없습니다. 타입 보존이 필요하면 Canonical 을 쓰세요', 'In Relaxed form int32 / int64 / double are plain JSON numbers and can no longer be told apart. Use Canonical to preserve types'));
    if (o.to === 'canonical') issues.push(t('JSON 숫자는 정수면 $numberInt(32비트 이내) 또는 $numberLong, 소수면 $numberDouble 로 추정해 변환했습니다', 'Plain JSON numbers were inferred: integers as $numberInt (within 32 bits) or $numberLong, fractions as $numberDouble'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: t('✅ ' + ({ relaxed: 'Relaxed', canonical: 'Canonical', plain: '단순 JSON' }[o.to]) + ' 로 변환했습니다', '✅ Converted to ' + ({ relaxed: 'Relaxed', canonical: 'Canonical', plain: 'plain JSON' }[o.to])), out: JSON.stringify(out, null, 2), issues: uniq };
  }
});
