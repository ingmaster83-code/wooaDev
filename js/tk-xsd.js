/* WooaDev Tool Kit — XSD 서브셋 모델·검증기 (tk-xml.js, tk-xpath.js 필요)
   지원: element/attribute, complexType(sequence·choice·all·group·simpleContent·complexContent 확장/제한), simpleType(restriction 패싯·list·union), 내장 타입, minOccurs/maxOccurs, mixed, ID/IDREF
   미지원: 네임스페이스 해석(접두사 무시), import/include, key/unique/keyref, substitutionGroup, assert */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var S = TK.xsd = TK.xsd || {};
  var t = function (a, b) { return TK.t(a, b); };
  function local(n) { var i = String(n).indexOf(':'); return i < 0 ? n : String(n).slice(i + 1); }
  function attr(el, name) { for (var i = 0; i < el.attrs.length; i++) if (el.attrs[i][0] === name) return el.attrs[i][1]; return null; }
  function kids(el) { return el.children.filter(function (c) { return c.name !== undefined; }); }
  function lname(el) { return local(el.name); }

  S.INT_RANGE = { byte: [-128, 127], short: [-32768, 32767], int: [-2147483648, 2147483647], long: [-9223372036854775808, 9223372036854775807], unsignedByte: [0, 255], unsignedShort: [0, 65535], unsignedInt: [0, 4294967295], unsignedLong: [0, 18446744073709551615], nonNegativeInteger: [0, Infinity], positiveInteger: [1, Infinity], negativeInteger: [-Infinity, -1], nonPositiveInteger: [-Infinity, 0], integer: [-Infinity, Infinity] };
  var BUILTIN = ['string', 'normalizedString', 'token', 'boolean', 'decimal', 'float', 'double', 'date', 'dateTime', 'time', 'duration', 'gYear', 'gYearMonth', 'gMonth', 'gDay', 'gMonthDay', 'anyURI', 'base64Binary', 'hexBinary', 'ID', 'IDREF', 'IDREFS', 'NMTOKEN', 'NMTOKENS', 'language', 'Name', 'NCName', 'QName', 'anySimpleType', 'anyType', 'dateTimeStamp'].concat(Object.keys(S.INT_RANGE));
  S.isBuiltin = function (n) { return BUILTIN.indexOf(local(n)) >= 0; };

  /** XSD 텍스트 → 모델 */
  S.load = function (xsdText) {
    var parsed = TK.xml.parse(xsdText), root = parsed.root;
    if (lname(root) !== 'schema') throw new Error(t('루트 요소가 xs:schema 가 아닙니다 (<' + root.name + '>)', 'The root element is not xs:schema (<' + root.name + '>)'));
    var model = { elements: {}, complex: {}, simple: {}, groups: {}, attrGroups: {}, attributes: {}, order: [], notes: [], root: root, tns: attr(root, 'targetNamespace') || '', qualified: attr(root, 'elementFormDefault') === 'qualified' };
    kids(root).forEach(function (c) {
      var n = lname(c), name = attr(c, 'name');
      if (n === 'element') { if (!name) throw new Error(t('최상위 element 에는 name 이 필요합니다', 'A top-level element needs a name')); model.elements[name] = c; model.order.push(name); }
      else if (n === 'complexType') { if (!name) throw new Error(t('최상위 complexType 에는 name 이 필요합니다', 'A top-level complexType needs a name')); model.complex[name] = c; }
      else if (n === 'simpleType') { if (!name) throw new Error(t('최상위 simpleType 에는 name 이 필요합니다', 'A top-level simpleType needs a name')); model.simple[name] = c; }
      else if (n === 'group') { if (name) model.groups[name] = c; }
      else if (n === 'attributeGroup') { if (name) model.attrGroups[name] = c; }
      else if (n === 'attribute') { if (name) model.attributes[name] = c; }
      else if (n === 'import' || n === 'include' || n === 'redefine') model.notes.push(t('<' + n + '> 는 지원하지 않아 무시했습니다 (참조하는 타입이 없으면 오류가 납니다)', '<' + n + '> is not supported and was ignored (references to its types will fail)'));
      else if (n === 'annotation' || n === 'notation') { /* 무시 */ }
      else model.notes.push(t('최상위 <' + n + '> 는 해석하지 않습니다', 'Top-level <' + n + '> is not interpreted'));
    });
    if (!model.order.length) throw new Error(t('최상위 element 선언이 없어 검증할 루트를 알 수 없습니다', 'There is no top-level element declaration, so the root to validate is unknown'));
    return model;
  };

  /* ---------- 단순 타입 ---------- */
  function wsCollapse(s) { return s.replace(/\s+/g, ' ').trim(); }
  /** 값이 내장 타입을 만족하는지 → null(통과) 또는 오류 메시지 */
  S.checkBuiltin = function (type, value) {
    var ty = local(type), v = value;
    if (ty === 'string' || ty === 'anySimpleType' || ty === 'anyType') return null;
    if (ty === 'normalizedString') return /[\t\n\r]/.test(v) ? t('탭·줄바꿈을 포함할 수 없습니다', 'must not contain tabs or line breaks') : null;
    if (ty === 'token') return /[\t\n\r]|^ | $|  /.test(v) ? t('공백이 정규화되어야 합니다 (양끝 공백·연속 공백 불가)', 'whitespace must be collapsed (no leading, trailing or repeated spaces)') : null;
    v = wsCollapse(v);
    if (ty === 'boolean') return /^(true|false|1|0)$/.test(v) ? null : t('true, false, 1, 0 중 하나여야 합니다', 'must be true, false, 1 or 0');
    if (ty === 'decimal') return /^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(v) ? null : t('십진수가 아닙니다', 'is not a decimal number');
    if (ty === 'float' || ty === 'double') return /^([-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?|[-+]?INF|NaN)$/.test(v) ? null : t('실수가 아닙니다', 'is not a floating-point number');
    if (S.INT_RANGE[ty]) {
      if (!/^[-+]?\d+$/.test(v)) return t('정수가 아닙니다', 'is not an integer');
      var n = Number(v), r = S.INT_RANGE[ty]; if (n < r[0] || n > r[1]) return t(ty + ' 범위(' + (isFinite(r[0]) ? r[0] : '-∞') + ' ~ ' + (isFinite(r[1]) ? r[1] : '∞') + ')를 벗어납니다', 'is outside the ' + ty + ' range (' + (isFinite(r[0]) ? r[0] : '-inf') + ' to ' + (isFinite(r[1]) ? r[1] : 'inf') + ')'); return null;
    }
    if (ty === 'date') { var m = /^(-?\d{4,})-(\d{2})-(\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(v); if (!m) return t('YYYY-MM-DD 형식이어야 합니다', 'must be YYYY-MM-DD'); var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? null : t('존재하지 않는 날짜입니다', 'is not a real date'); }
    if (ty === 'dateTime' || ty === 'dateTimeStamp') { var m2 = /^(-?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(v); if (!m2) return t('YYYY-MM-DDThh:mm:ss[Z] 형식이어야 합니다', 'must be YYYY-MM-DDThh:mm:ss[Z]'); if (+m2[4] > 24 || +m2[5] > 59 || +m2[6] > 59) return t('시각이 올바르지 않습니다', 'time is invalid'); if (ty === 'dateTimeStamp' && !m2[8]) return t('시간대가 필요합니다', 'a time zone is required'); return null; }
    if (ty === 'time') return /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(v) ? null : t('hh:mm:ss 형식이어야 합니다', 'must be hh:mm:ss');
    if (ty === 'duration') return /^-?P(?!$)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/.test(v) ? null : t('ISO 8601 기간(P1Y2M3DT4H5M6S)이 아닙니다', 'is not an ISO 8601 duration (P1Y2M3DT4H5M6S)');
    if (ty === 'gYear') return /^-?\d{4,}(Z|[+-]\d{2}:\d{2})?$/.test(v) ? null : t('YYYY 형식이어야 합니다', 'must be YYYY');
    if (ty === 'gYearMonth') return /^-?\d{4,}-(0[1-9]|1[0-2])(Z|[+-]\d{2}:\d{2})?$/.test(v) ? null : t('YYYY-MM 형식이어야 합니다', 'must be YYYY-MM');
    if (ty === 'gMonth') return /^--(0[1-9]|1[0-2])(Z|[+-]\d{2}:\d{2})?$/.test(v) ? null : t('--MM 형식이어야 합니다', 'must be --MM');
    if (ty === 'gDay') return /^---(0[1-9]|[12]\d|3[01])(Z|[+-]\d{2}:\d{2})?$/.test(v) ? null : t('---DD 형식이어야 합니다', 'must be ---DD');
    if (ty === 'gMonthDay') return /^--(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(Z|[+-]\d{2}:\d{2})?$/.test(v) ? null : t('--MM-DD 형식이어야 합니다', 'must be --MM-DD');
    if (ty === 'anyURI') return /\s/.test(v) ? t('공백을 포함할 수 없습니다', 'must not contain spaces') : null;
    if (ty === 'hexBinary') return /^([0-9a-fA-F]{2})*$/.test(v) ? null : t('짝수 개의 16진수 문자여야 합니다', 'must be an even number of hex digits');
    if (ty === 'base64Binary') return /^[A-Za-z0-9+\/\s]*={0,2}$/.test(v) && v.replace(/\s/g, '').length % 4 === 0 ? null : t('Base64 가 아닙니다', 'is not Base64');
    if (ty === 'ID' || ty === 'IDREF' || ty === 'NCName') return /^[A-Za-z_][\w.-]*$/.test(v) ? null : t('NCName(영문자·_ 로 시작, 콜론 불가)이어야 합니다', 'must be an NCName (starts with a letter or _, no colon)');
    if (ty === 'Name' || ty === 'QName') return /^[A-Za-z_:][\w.:-]*$/.test(v) ? null : t('XML 이름이어야 합니다', 'must be an XML name');
    if (ty === 'NMTOKEN') return /^[\w.:-]+$/.test(v) ? null : t('NMTOKEN 이어야 합니다', 'must be an NMTOKEN');
    if (ty === 'NMTOKENS' || ty === 'IDREFS') return v && v.split(' ').every(function (x) { return /^[\w.:-]+$/.test(x); }) ? null : t('공백으로 구분된 토큰 목록이어야 합니다', 'must be a space-separated list of tokens');
    if (ty === 'language') return /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/.test(v) ? null : t('언어 태그(예: en, ko-KR)여야 합니다', 'must be a language tag (e.g. en, ko-KR)');
    return null;
  };

  /** simpleType 정의 노드 + 값 검증 */
  S.checkSimple = function (model, typeName, inline, value) {
    var node = inline || (typeName && !S.isBuiltin(typeName) ? model.simple[local(typeName)] : null);
    if (!node) { if (typeName && S.isBuiltin(typeName)) return S.checkBuiltin(typeName, value); if (typeName && !model.complex[local(typeName)]) return t('타입 "' + typeName + '" 이 정의되어 있지 않습니다', 'type "' + typeName + '" is not defined'); return null; }
    var body = kids(node).filter(function (c) { return lname(c) !== 'annotation'; })[0];
    if (!body) return null;
    var bn = lname(body);
    if (bn === 'restriction') {
      var base = attr(body, 'base'), inl = kids(body).filter(function (c) { return lname(c) === 'simpleType'; })[0];
      var err = S.checkSimple(model, base, inl || null, value); if (err) return err;
      var facets = kids(body).filter(function (c) { return lname(c) !== 'simpleType' && lname(c) !== 'annotation'; });
      var v = value, enums = [], pats = [];
      var ws = facets.filter(function (f) { return lname(f) === 'whiteSpace'; })[0]; if (ws) { var wv = attr(ws, 'value'); v = wv === 'collapse' ? wsCollapse(v) : wv === 'replace' ? v.replace(/[\t\n\r]/g, ' ') : v; } else if (base && local(base) !== 'string' && S.isBuiltin(base)) v = wsCollapse(v);
      for (var i = 0; i < facets.length; i++) {
        var f = facets[i], fn = lname(f), fv = attr(f, 'value');
        if (fn === 'enumeration') enums.push(fv);
        else if (fn === 'pattern') pats.push(fv);
        else if (fn === 'minLength' && v.length < +fv) return t('길이가 최소 ' + fv + '자여야 합니다 (현재 ' + v.length + ')', 'must be at least ' + fv + ' characters (is ' + v.length + ')');
        else if (fn === 'maxLength' && v.length > +fv) return t('길이가 최대 ' + fv + '자여야 합니다 (현재 ' + v.length + ')', 'must be at most ' + fv + ' characters (is ' + v.length + ')');
        else if (fn === 'length' && v.length !== +fv) return t('길이가 정확히 ' + fv + '자여야 합니다 (현재 ' + v.length + ')', 'must be exactly ' + fv + ' characters (is ' + v.length + ')');
        else if (fn === 'minInclusive' && !(cmpNum(v, fv) >= 0)) return t(fv + ' 이상이어야 합니다', 'must be at least ' + fv);
        else if (fn === 'maxInclusive' && !(cmpNum(v, fv) <= 0)) return t(fv + ' 이하여야 합니다', 'must be at most ' + fv);
        else if (fn === 'minExclusive' && !(cmpNum(v, fv) > 0)) return t(fv + ' 보다 커야 합니다', 'must be greater than ' + fv);
        else if (fn === 'maxExclusive' && !(cmpNum(v, fv) < 0)) return t(fv + ' 보다 작아야 합니다', 'must be less than ' + fv);
        else if (fn === 'totalDigits') { var digits = v.replace(/^[-+]/, '').replace('.', '').replace(/^0+(?=\d)/, '').length; if (digits > +fv) return t('전체 자릿수가 ' + fv + ' 를 넘습니다', 'has more than ' + fv + ' total digits'); }
        else if (fn === 'fractionDigits') { var fd = (v.split('.')[1] || '').length; if (fd > +fv) return t('소수 자릿수가 ' + fv + ' 를 넘습니다', 'has more than ' + fv + ' fraction digits'); }
      }
      if (enums.length && enums.indexOf(v) < 0) return t('허용된 값(' + enums.join(', ') + ')이 아닙니다', 'is not one of the allowed values (' + enums.join(', ') + ')');
      if (pats.length) { var okp = pats.some(function (p) { try { return new RegExp('^(?:' + xsdRegex(p) + ')$').test(v); } catch (e) { return true; } }); if (!okp) return t('패턴 ' + pats.join(' | ') + ' 과 일치하지 않습니다', 'does not match the pattern ' + pats.join(' | ')); }
      return null;
    }
    if (bn === 'list') { var it = attr(body, 'itemType'), items = wsCollapse(value) ? wsCollapse(value).split(' ') : []; for (var k = 0; k < items.length; k++) { var e2 = S.checkSimple(model, it, kids(body).filter(function (c) { return lname(c) === 'simpleType'; })[0] || null, items[k]); if (e2) return t('목록 항목 "' + items[k] + '": ', 'list item "' + items[k] + '": ') + e2; } return null; }
    if (bn === 'union') { var mts = (attr(body, 'memberTypes') || '').split(/\s+/).filter(Boolean), inl2 = kids(body).filter(function (c) { return lname(c) === 'simpleType'; }); var passed = mts.some(function (m) { return !S.checkSimple(model, m, null, value); }) || inl2.some(function (s2) { return !S.checkSimple(model, null, s2, value); }); return passed ? null : t('union 의 어떤 멤버 타입과도 맞지 않습니다', 'matches none of the union member types'); }
    return null;
  };
  function cmpNum(a, b) { var x = parseFloat(a), y = parseFloat(b); if (!isNaN(x) && !isNaN(y)) return x < y ? -1 : x > y ? 1 : 0; return a < b ? -1 : a > b ? 1 : 0; }
  function xsdRegex(p) { return p.replace(/\\i/g, '[A-Za-z_:]').replace(/\\c/g, '[\\w.:-]').replace(/\\p\{L\}/g, '[A-Za-z\\u00C0-\\uFFFF]').replace(/\\p\{N\}/g, '\\d').replace(/\\p\{Lu\}/g, '[A-Z]').replace(/\\p\{Ll\}/g, '[a-z]'); }

  /* ---------- 콘텐츠 모델 ---------- */
  /** complexType 노드 → {particle, attrs, mixed, simple(base type for simpleContent), anyAttr} */
  S.complexInfo = function (model, node, seen) {
    seen = seen || [];
    var info = { particle: null, attrs: [], mixed: attr(node, 'mixed') === 'true', simpleBase: null, simpleInline: null, anyAttr: false, empty: false };
    function addAttrs(parent) {
      kids(parent).forEach(function (c) {
        var n = lname(c);
        if (n === 'attribute') { var ref = attr(c, 'ref'); if (ref) { var rd = model.attributes[local(ref)]; info.attrs.push({ name: local(ref), type: rd ? attr(rd, 'type') : null, inline: rd ? kids(rd).filter(function (x) { return lname(x) === 'simpleType'; })[0] : null, use: attr(c, 'use') || 'optional', def: attr(c, 'default'), fixed: attr(c, 'fixed') }); } else info.attrs.push({ name: attr(c, 'name'), type: attr(c, 'type'), inline: kids(c).filter(function (x) { return lname(x) === 'simpleType'; })[0] || null, use: attr(c, 'use') || 'optional', def: attr(c, 'default'), fixed: attr(c, 'fixed') }); }
        else if (n === 'attributeGroup') { var ag = model.attrGroups[local(attr(c, 'ref') || '')]; if (ag && seen.indexOf(ag) < 0) { seen.push(ag); addAttrs(ag); } }
        else if (n === 'anyAttribute') info.anyAttr = true;
      });
    }
    function partOf(c) {
      var n = lname(c), min = attr(c, 'minOccurs'), max = attr(c, 'maxOccurs');
      var occ = { min: min == null ? 1 : +min, max: max == null ? 1 : (max === 'unbounded' ? Infinity : +max) };
      if (n === 'element') { var ref = attr(c, 'ref'); return Object.assign({ k: 'el', name: ref ? local(ref) : attr(c, 'name'), decl: ref ? model.elements[local(ref)] : c, ref: !!ref, node: c }, occ); }
      if (n === 'sequence' || n === 'choice' || n === 'all') return Object.assign({ k: n === 'all' ? 'all' : n === 'choice' ? 'choice' : 'seq', items: kids(c).filter(function (x) { return ['element', 'sequence', 'choice', 'all', 'group', 'any'].indexOf(lname(x)) >= 0; }).map(partOf).filter(Boolean) }, occ);
      if (n === 'group') { var gd = model.groups[local(attr(c, 'ref') || '')]; if (!gd) return null; var inner = kids(gd).filter(function (x) { return ['sequence', 'choice', 'all'].indexOf(lname(x)) >= 0; })[0]; if (!inner) return null; var p = partOf(inner); p.min *= occ.min; p.max = p.max * occ.max; return p; }
      if (n === 'any') return Object.assign({ k: 'any', ns: attr(c, 'namespace') || '##any' }, occ);
      return null;
    }
    kids(node).forEach(function (c) {
      var n = lname(c);
      if (n === 'sequence' || n === 'choice' || n === 'all' || n === 'group') info.particle = partOf(c);
      else if (n === 'attribute' || n === 'attributeGroup' || n === 'anyAttribute') { addAttrs({ children: [c], name: 'x' }); }
      else if (n === 'simpleContent') {
        var ext = kids(c).filter(function (x) { return lname(x) === 'extension' || lname(x) === 'restriction'; })[0];
        if (ext) { info.simpleBase = attr(ext, 'base'); info.simpleRestriction = lname(ext) === 'restriction' ? ext : null; addAttrs(ext); var baseCT = model.complex[local(info.simpleBase || '')]; if (baseCT) { var bi = S.complexInfo(model, baseCT, seen); info.simpleBase = bi.simpleBase; info.attrs = bi.attrs.concat(info.attrs); } }
      } else if (n === 'complexContent') {
        var ext2 = kids(c).filter(function (x) { return lname(x) === 'extension' || lname(x) === 'restriction'; })[0];
        if (ext2) {
          var baseName = local(attr(ext2, 'base') || ''), baseInfo = model.complex[baseName] && seen.indexOf(model.complex[baseName]) < 0 ? (seen.push(model.complex[baseName]), S.complexInfo(model, model.complex[baseName], seen)) : null;
          var own = { particle: null }; kids(ext2).forEach(function (x) { var nn = lname(x); if (nn === 'sequence' || nn === 'choice' || nn === 'all' || nn === 'group') own.particle = partOf(x); }); addAttrs(ext2);
          if (lname(ext2) === 'extension' && baseInfo) { info.attrs = baseInfo.attrs.concat(info.attrs); info.anyAttr = info.anyAttr || baseInfo.anyAttr; if (baseInfo.particle && own.particle) info.particle = { k: 'seq', items: [baseInfo.particle, own.particle], min: 1, max: 1 }; else info.particle = own.particle || baseInfo.particle; info.mixed = info.mixed || baseInfo.mixed; }
          else info.particle = own.particle;
        }
      }
    });
    if (!info.particle && !info.simpleBase) info.empty = true;
    return info;
  };
  S.partOf = null;

  /** 파티클이 children[i..] 를 소비하는 가능한 끝 위치들 */
  S.match = function (model, p, ch, i, trace, budget) {
    if (--budget.n < 0) throw new Error(t('콘텐츠 모델이 너무 복잡해 검증을 중단했습니다', 'The content model is too complex; validation stopped'));
    function one(q, pos) {
      if (q.k === 'el') { var nm = q.name; trace.tried[pos] = (trace.tried[pos] || []); if (trace.tried[pos].indexOf(nm) < 0) trace.tried[pos].push(nm); return pos < ch.length && local(ch[pos].name) === nm ? [pos + 1] : []; }
      if (q.k === 'any') { trace.tried[pos] = trace.tried[pos] || []; if (trace.tried[pos].indexOf('*') < 0) trace.tried[pos].push('*'); return pos < ch.length ? [pos + 1] : []; }
      if (q.k === 'seq') { var cur = [pos]; for (var a = 0; a < q.items.length; a++) { var nxt = []; cur.forEach(function (c) { S.match(model, q.items[a], ch, c, trace, budget).forEach(function (e) { if (nxt.indexOf(e) < 0) nxt.push(e); }); }); cur = nxt; if (!cur.length) return []; } return cur; }
      if (q.k === 'choice') { var out = []; q.items.forEach(function (it) { S.match(model, it, ch, pos, trace, budget).forEach(function (e) { if (out.indexOf(e) < 0) out.push(e); }); }); return out; }
      if (q.k === 'all') {
        var res = [];
        (function rec(used, at) {
          var progressed = false;
          q.items.forEach(function (it, idx) { if (used.indexOf(idx) >= 0) return; var m = S.match(model, it, ch, at, trace, budget); m.forEach(function (e) { if (e > at || it.min === 0) { progressed = true; rec(used.concat(idx), e); } }); });
          var okAll = q.items.every(function (it, idx) { return used.indexOf(idx) >= 0 || it.min === 0; });
          if (okAll && res.indexOf(at) < 0) res.push(at);
        })([], pos);
        return res;
      }
      return [];
    }
    var results = [], layer = [i], seen = {};
    if (p.min === 0) results.push(i);
    var limit = p.max === Infinity ? Math.max(p.min, 0) + (ch.length - i) + 1 : p.max;
    for (var k = 1; k <= limit; k++) {
      var next = [];
      layer.forEach(function (c) { one(p, c).forEach(function (e) { if (next.indexOf(e) < 0) next.push(e); }); });
      if (!next.length) break;
      if (k >= p.min) next.forEach(function (e) { if (results.indexOf(e) < 0) results.push(e); });
      var fresh = next.filter(function (e) { return !seen[k >= p.min ? 'x' + e : 'm' + k + ':' + e]; });
      next.forEach(function (e) { seen[k >= p.min ? 'x' + e : 'm' + k + ':' + e] = true; });
      if (k >= p.min && !fresh.length) break;
      layer = next;
    }
    return results;
  };

  /** XML 인스턴스 검증 → 오류 배열 [{path, msg}] */
  S.validate = function (model, xmlDoc) {
    var errors = [], ids = {}, idrefs = [], XP = TK.xpath;
    function err(node, msg) { errors.push({ path: XP.path(node), msg: msg }); }
    var rootEl = xmlDoc.docEl, rootDecl = model.elements[local(rootEl.name)];
    if (!rootDecl) { err(rootEl, t('루트 요소 <' + rootEl.name + '> 가 스키마의 최상위 element(' + model.order.join(', ') + ')에 없습니다', 'Root element <' + rootEl.name + '> is not a top-level element of the schema (' + model.order.join(', ') + ')')); return errors; }
    validateElement(rootDecl, rootEl);
    idrefs.forEach(function (r) { if (!ids[r.v]) err(r.n, t('IDREF "' + r.v + '" 에 해당하는 ID 가 없습니다', 'IDREF "' + r.v + '" has no matching ID')); });
    return errors;
    function typeOfDecl(decl) {
      var type = attr(decl, 'type'), ct = kids(decl).filter(function (c) { return lname(c) === 'complexType'; })[0], st = kids(decl).filter(function (c) { return lname(c) === 'simpleType'; })[0];
      if (ct) return { complex: ct }; if (st) return { simple: st };
      if (type) { var tl = local(type); if (model.complex[tl]) return { complex: model.complex[tl] }; if (S.isBuiltin(type) && tl === 'anyType') return { any: true }; return { simpleName: type }; }
      return { any: true };
    }
    function validateElement(decl, el) {
      var ty = typeOfDecl(decl), nillable = attr(decl, 'nillable') === 'true', fixed = attr(decl, 'fixed'), def = attr(decl, 'default');
      var nil = el.attrs.filter(function (a) { return local(a.name) === 'nil' && /xsi:|^nil$/.test(a.name); })[0];
      if (nil && nil.value === 'true') { if (!nillable) err(el, t('nillable 이 아닌 요소에 xsi:nil="true" 를 썼습니다', 'xsi:nil="true" on an element that is not nillable')); if (el.children.length) err(el, t('xsi:nil 요소는 비어 있어야 합니다', 'An xsi:nil element must be empty')); return; }
      var text = el.children.filter(function (c) { return c.t === 'text'; }).map(function (c) { return c.value; }).join(''), elKids = el.children.filter(function (c) { return c.t === 'el'; });
      if (ty.any) return;
      if (ty.simple || ty.simpleName) {
        if (elKids.length) { err(el, t('단순 타입 요소에는 자식 요소를 둘 수 없습니다 (<' + elKids[0].name + '>)', 'A simple-typed element cannot have child elements (<' + elKids[0].name + '>)')); return; }
        el.attrs.forEach(function (a) { if (!/^xmlns(:|$)|^xsi:/.test(a.name)) err(el, t('단순 타입 요소에는 속성을 둘 수 없습니다 (' + a.name + ')', 'A simple-typed element cannot have attributes (' + a.name + ')')); });
        if (text === '' && def != null) text = def;
        var e = S.checkSimple(model, ty.simpleName || null, ty.simple || null, text); if (e) err(el, t('값 "' + short(text) + '" 이(가) ', 'Value "' + short(text) + '" ') + e);
        if (fixed != null && text !== fixed) err(el, t('고정값 "' + fixed + '" 과 다릅니다', 'differs from the fixed value "' + fixed + '"'));
        trackId(ty.simpleName, text, el); return;
      }
      var info = S.complexInfo(model, ty.complex);
      /* 속성 */
      var seenAttr = {};
      info.attrs.forEach(function (ad) { var got = el.attrs.filter(function (a) { return a.name === ad.name || local(a.name) === ad.name && a.name.indexOf('xmlns') !== 0; })[0]; if (got) { seenAttr[got.name] = true; var e2 = S.checkSimple(model, ad.type, ad.inline, got.value); if (e2) err(el, t('속성 ' + ad.name + ' 값 "' + short(got.value) + '" 이(가) ', 'Attribute ' + ad.name + ' value "' + short(got.value) + '" ') + e2); if (ad.use === 'prohibited') err(el, t('속성 ' + ad.name + ' 은(는) 사용할 수 없습니다', 'Attribute ' + ad.name + ' is prohibited')); if (ad.fixed != null && got.value !== ad.fixed) err(el, t('속성 ' + ad.name + ' 은(는) 고정값 "' + ad.fixed + '" 이어야 합니다', 'Attribute ' + ad.name + ' must be the fixed value "' + ad.fixed + '"')); trackId(ad.type, got.value, el); } else if (ad.use === 'required') err(el, t('필수 속성 ' + ad.name + ' 이(가) 없습니다', 'Missing required attribute ' + ad.name)); });
      el.attrs.forEach(function (a) { if (seenAttr[a.name] || /^xmlns(:|$)|^xsi:|^xml:/.test(a.name)) return; if (!info.anyAttr) err(el, t('스키마에 없는 속성 ' + a.name, 'Attribute ' + a.name + ' is not declared in the schema')); });
      if (info.simpleBase) {
        if (elKids.length) err(el, t('simpleContent 요소에는 자식 요소를 둘 수 없습니다', 'A simpleContent element cannot have child elements'));
        var e3 = S.checkSimple(model, info.simpleBase, null, text); if (e3) err(el, t('값 "' + short(text) + '" 이(가) ', 'Value "' + short(text) + '" ') + e3);
        if (info.simpleRestriction) { var e4 = S.checkSimple(model, null, { name: 'xs:simpleType', attrs: [], children: [info.simpleRestriction] }, text); if (e4) err(el, t('값 "' + short(text) + '" 이(가) ', 'Value "' + short(text) + '" ') + e4); }
        return;
      }
      if (!info.mixed && text.trim()) err(el, t('자식 요소만 올 수 있는 곳에 텍스트 "' + short(text.trim()) + '" 가 있습니다', 'Text "' + short(text.trim()) + '" where only child elements are allowed'));
      if (info.empty && !info.mixed) { if (elKids.length) err(el, t('이 요소는 비어 있어야 합니다 (<' + elKids[0].name + '> 불가)', 'This element must be empty (<' + elKids[0].name + '> not allowed)')); return; }
      var consumedBy = [];
      if (info.particle) {
        var trace = { tried: {} }, budget = { n: 200000 }, ends = S.match(model, info.particle, elKids, 0, trace, budget);
        if (ends.indexOf(elKids.length) < 0) {
          var far = Math.max.apply(null, [0].concat(Object.keys(trace.tried).map(Number))), exp = (trace.tried[far] || []).slice();
          var found = far < elKids.length ? '<' + elKids[far].name + '>' : t('요소의 끝', 'the end of the element');
          err(el, t(far < elKids.length ? '자식 요소 순서·구성이 스키마와 다릅니다: ' + found + ' 위치에 ' + (exp.length ? exp.map(function (x) { return '<' + x + '>'; }).join(' 또는 ') : '다른 요소') + ' 가 와야 합니다' : '자식 요소가 부족합니다: ' + (exp.length ? exp.map(function (x) { return '<' + x + '>'; }).join(' 또는 ') : '필수 요소') + ' 가 더 필요합니다', far < elKids.length ? 'Child elements do not match the schema: at ' + found + ' expected ' + (exp.length ? exp.map(function (x) { return '<' + x + '>'; }).join(' or ') : 'another element') : 'Missing child elements: ' + (exp.length ? exp.map(function (x) { return '<' + x + '>'; }).join(' or ') : 'required elements') + ' expected'));
        }
        /* 요소별 하위 검증: 이름으로 선언을 찾음 (순서 오류가 있어도 각 요소의 내용은 검사) */
        var decls = {}; (function collect(q) { if (!q) return; if (q.k === 'el') decls[q.name] = q.decl; else if (q.items) q.items.forEach(collect); })(info.particle);
        elKids.forEach(function (c) { var d = decls[local(c.name)]; if (d) validateElement(d, c); });
      } else if (elKids.length && !info.mixed) err(el, t('자식 요소를 둘 수 없습니다 (<' + elKids[0].name + '>)', 'Child elements are not allowed (<' + elKids[0].name + '>)'));
    }
    function trackId(type, value, node) { var tl = type ? local(type) : ''; if (tl === 'ID') { var v = value.trim(); if (ids[v]) err(node, t('ID "' + v + '" 가 중복됩니다', 'Duplicate ID "' + v + '"')); ids[v] = true; } else if (tl === 'IDREF') idrefs.push({ v: value.trim(), n: node }); }
    function short(s) { s = String(s); return s.length > 40 ? s.slice(0, 40) + '…' : s; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
