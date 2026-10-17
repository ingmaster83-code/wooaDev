TK.tool('xsd-to-json-schema', {
  inputs: [{ id: 'xsd', label: ['XSD 스키마', 'XSD schema'], rows: 22, sample: '<?xml version="1.0"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n  <xs:simpleType name="IsbnType">\n    <xs:restriction base="xs:string">\n      <xs:pattern value="\\d{3}-\\d{10}"/>\n    </xs:restriction>\n  </xs:simpleType>\n  <xs:complexType name="PersonType">\n    <xs:sequence>\n      <xs:element name="name" type="xs:string"/>\n      <xs:element name="email" type="xs:string" minOccurs="0"/>\n    </xs:sequence>\n    <xs:attribute name="id" type="xs:ID" use="required"/>\n  </xs:complexType>\n  <xs:element name="library">\n    <xs:complexType>\n      <xs:sequence>\n        <xs:element name="book" maxOccurs="unbounded">\n          <xs:complexType>\n            <xs:sequence>\n              <xs:element name="isbn" type="IsbnType"/>\n              <xs:element name="title" type="xs:string"/>\n              <xs:element name="author" type="PersonType" maxOccurs="3"/>\n              <xs:choice>\n                <xs:element name="price" type="xs:decimal"/>\n                <xs:element name="free" type="xs:boolean"/>\n              </xs:choice>\n              <xs:element name="rating">\n                <xs:simpleType>\n                  <xs:restriction base="xs:integer">\n                    <xs:minInclusive value="1"/>\n                    <xs:maxInclusive value="5"/>\n                  </xs:restriction>\n                </xs:simpleType>\n              </xs:element>\n            </xs:sequence>\n            <xs:attribute name="lang" type="xs:language" default="en"/>\n          </xs:complexType>\n        </xs:element>\n      </xs:sequence>\n    </xs:complexType>\n  </xs:element>\n</xs:schema>' }],
  options: [
    { id: 'root', type: 'text', label: ['루트 요소 (비우면 첫 번째 최상위 element)', 'Root element (empty = first top-level element)'], default: '' },
    { id: 'draft', type: 'select', label: ['JSON Schema 버전', 'JSON Schema version'], choices: [['2020-12', '2020-12'], ['draft-07', 'draft-07']], default: '2020-12' },
    { id: 'ap', type: 'text', label: ['XML 속성 이름 접두사', 'Prefix for XML attributes'], default: '@' },
    { id: 'tk', type: 'text', label: ['텍스트 값 키 (속성이 있는 텍스트 요소)', 'Key for text content (text elements that also have attributes)'], default: '#text' },
    { id: 'strict', type: 'checkbox', label: ['additionalProperties: false', 'additionalProperties: false'], default: true },
    { id: 'wrap', type: 'checkbox', label: ['루트 요소 이름으로 한 단계 감싸기 (XML→JSON 변환 관례)', 'Wrap in the root element name (common XML→JSON convention)'], default: true }
  ],
  outputs: [{ id: 'out', label: ['JSON Schema', 'JSON Schema'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['변환 규칙·참고', 'Rules and notes'], kind: 'list' }],
  run: function (v, o, t) {
    var S = TK.xsd, issues = [], src = String(v.xsd || ''); if (!src.trim()) throw new Error(t('XSD 를 입력하세요', 'Enter the XSD'));
    var model; try { model = S.load(src); } catch (e) { throw new Error(t('XSD 오류: ', 'XSD error: ') + e.message); }
    function local(n) { var i = String(n).indexOf(':'); return i < 0 ? n : String(n).slice(i + 1); }
    function attr(el, name) { for (var i = 0; i < el.attrs.length; i++) if (el.attrs[i][0] === name) return el.attrs[i][1]; return null; }
    function kids(el) { return el.children.filter(function (c) { return c.name !== undefined; }); }
    function ln(el) { return local(el.name); }
    var defs = {}, defsDone = {}, notes = {};
    function note(k, msg) { if (!notes[k]) { notes[k] = true; issues.push(msg); } }
    function builtinSchema(ty) {
      var l = local(ty), r = S.INT_RANGE[l];
      if (r) { var sc = { type: 'integer' }; if (isFinite(r[0]) && Math.abs(r[0]) <= 9007199254740991) sc.minimum = r[0]; if (isFinite(r[1]) && Math.abs(r[1]) <= 9007199254740991) sc.maximum = r[1]; if (l === 'unsignedLong' || l === 'long') note('long', t('64비트 정수(long, unsignedLong)는 JSON 숫자의 안전 범위(2^53)를 넘을 수 있습니다', '64-bit integers (long, unsignedLong) can exceed the safe JSON number range (2^53)')); return sc; }
      switch (l) {
        case 'boolean': return { type: 'boolean' };
        case 'decimal': case 'float': case 'double': return { type: 'number' };
        case 'date': return { type: 'string', format: 'date' };
        case 'dateTime': case 'dateTimeStamp': return { type: 'string', format: 'date-time' };
        case 'time': return { type: 'string', format: 'time' };
        case 'duration': return { type: 'string', format: 'duration' };
        case 'anyURI': return { type: 'string', format: 'uri' };
        case 'hexBinary': return { type: 'string', pattern: '^([0-9a-fA-F]{2})*$' };
        case 'base64Binary': return { type: 'string', contentEncoding: 'base64' };
        case 'gYear': return { type: 'string', pattern: '^-?\\d{4,}(Z|[+-]\\d{2}:\\d{2})?$' };
        case 'anyType': case 'anySimpleType': return {};
        default: return { type: 'string' };
      }
    }
    function xsdPattern(p) { return String(p).replace(/\\i/g, '[A-Za-z_:]').replace(/\\c/g, '[\\w.:-]'); }
    function simpleSchema(typeName, inline) {
      if (!inline && typeName && S.isBuiltin(typeName)) return builtinSchema(typeName);
      if (!inline && typeName && model.simple[local(typeName)]) { var nm = local(typeName); if (!defsDone[nm]) { defsDone[nm] = true; defs[nm] = simpleSchema(null, model.simple[nm]); } return { $ref: '#/$defs/' + nm }; }
      var node = inline; if (!node) return {};
      var body = kids(node).filter(function (c) { return ln(c) !== 'annotation'; })[0]; if (!body) return {};
      var bn = ln(body);
      if (bn === 'restriction') {
        var base = attr(body, 'base'), innerSimple = kids(body).filter(function (c) { return ln(c) === 'simpleType'; })[0];
        var sc = base ? (S.isBuiltin(base) ? builtinSchema(base) : simpleSchemaInline(base)) : simpleSchema(null, innerSimple);
        sc = JSON.parse(JSON.stringify(sc));
        var numeric = sc.type === 'integer' || sc.type === 'number', enums = [], pats = [];
        kids(body).forEach(function (f) {
          var fn = ln(f), fv = attr(f, 'value');
          if (fn === 'enumeration') enums.push(numeric ? Number(fv) : sc.type === 'boolean' ? fv === 'true' || fv === '1' : fv);
          else if (fn === 'pattern') pats.push(xsdPattern(fv));
          else if (fn === 'minLength') sc.minLength = +fv; else if (fn === 'maxLength') sc.maxLength = +fv;
          else if (fn === 'length') { sc.minLength = +fv; sc.maxLength = +fv; }
          else if (fn === 'minInclusive' && numeric) sc.minimum = Number(fv); else if (fn === 'maxInclusive' && numeric) sc.maximum = Number(fv);
          else if (fn === 'minExclusive' && numeric) sc.exclusiveMinimum = Number(fv); else if (fn === 'maxExclusive' && numeric) sc.exclusiveMaximum = Number(fv);
          else if (fn === 'fractionDigits' && numeric) { sc.multipleOf = Number('1e-' + fv); note('frac', t('fractionDigits 는 multipleOf 로 옮겼습니다 (부동소수점 오차에 주의)', 'fractionDigits became multipleOf (mind floating-point rounding)')); }
          else if (fn === 'totalDigits') note('total', t('totalDigits 는 JSON Schema 로 표현할 수 없어 생략했습니다', 'totalDigits cannot be expressed in JSON Schema and was dropped'));
          else if (fn === 'whiteSpace' && fv !== 'preserve') note('ws', t('whiteSpace 패싯은 JSON Schema 에 없어 생략했습니다', 'The whiteSpace facet does not exist in JSON Schema and was dropped'));
          else if ((fn === 'minInclusive' || fn === 'maxInclusive' || fn === 'minExclusive' || fn === 'maxExclusive') && !numeric) note('cmp', t('숫자가 아닌 타입의 범위 패싯(날짜 등)은 생략했습니다', 'Range facets on non-numeric types (such as dates) were dropped'));
        });
        if (enums.length) sc.enum = enums;
        if (pats.length === 1) sc.pattern = pats[0]; else if (pats.length > 1) sc.anyOf = pats.map(function (p) { return { pattern: p }; });
        return sc;
      }
      if (bn === 'list') { var it = attr(body, 'itemType'), inl = kids(body).filter(function (c) { return ln(c) === 'simpleType'; })[0]; note('list', t('xs:list 는 공백으로 구분된 문자열이지만 JSON 배열로 옮겼습니다', 'xs:list is a space-separated string but became a JSON array')); return { type: 'array', items: simpleSchema(it, inl || null) }; }
      if (bn === 'union') { var mts = (attr(body, 'memberTypes') || '').split(/\s+/).filter(Boolean), inls = kids(body).filter(function (c) { return ln(c) === 'simpleType'; }); return { anyOf: mts.map(function (m) { return simpleSchema(m, null); }).concat(inls.map(function (s2) { return simpleSchema(null, s2); })) }; }
      return {};
    }
    function simpleSchemaInline(typeName) { var nm = local(typeName); if (model.simple[nm]) return simpleSchema(null, model.simple[nm]); return builtinSchema(typeName); }
    function elementSchema(decl, depth) {
      if (depth > 30) return {};
      var type = attr(decl, 'type'), ct = kids(decl).filter(function (c) { return ln(c) === 'complexType'; })[0], st = kids(decl).filter(function (c) { return ln(c) === 'simpleType'; })[0];
      var sc;
      if (ct) sc = complexSchema(ct, depth);
      else if (st) sc = simpleSchema(null, st);
      else if (type) { var tl = local(type); if (model.complex[tl]) { if (!defsDone[tl]) { defsDone[tl] = true; defs[tl] = {}; defs[tl] = complexSchema(model.complex[tl], depth + 1); } sc = { $ref: '#/$defs/' + tl }; } else sc = simpleSchema(type, null); }
      else sc = {};
      if (attr(decl, 'nillable') === 'true') { sc = { anyOf: [sc, { type: 'null' }] }; note('nil', t('nillable 요소는 null 도 허용하도록 anyOf 로 만들었습니다', 'nillable elements allow null through anyOf')); }
      var def = attr(decl, 'default'); if (def != null && sc.type) { sc = Object.assign({}, sc, { default: sc.type === 'integer' || sc.type === 'number' ? Number(def) : sc.type === 'boolean' ? def === 'true' : def }); }
      var fx = attr(decl, 'fixed'); if (fx != null) sc = Object.assign({}, sc, { const: sc.type === 'integer' || sc.type === 'number' ? Number(fx) : fx });
      return sc;
    }
    function complexSchema(node, depth) {
      var info = S.complexInfo(model, node), props = {}, required = [], alts = [], hasText = false;
      function visit(p, optionalCtx, collect) {
        if (!p) return;
        var opt = optionalCtx || p.min === 0;
        if (p.k === 'el') {
          var d = p.decl; if (!d) { note('ref', t('참조한 요소 ' + p.name + ' 의 선언을 찾지 못해 빈 스키마로 두었습니다', 'The declaration of referenced element ' + p.name + ' was not found; an empty schema is used')); props[p.name] = {}; return; }
          var es = elementSchema(d, depth + 1);
          props[p.name] = p.max > 1 ? Object.assign({ type: 'array', items: es }, p.min > 0 ? { minItems: p.min } : {}, isFinite(p.max) ? { maxItems: p.max } : {}) : es;
          if (!opt && collect) collect.push(p.name);
          return;
        }
        if (p.k === 'any') { note('any', t('xs:any 는 additionalProperties 로 허용했습니다', 'xs:any is allowed through additionalProperties')); anyAllowed = true; return; }
        if (p.k === 'choice') {
          var branches = p.items.map(function (it) { var req = []; var save = required; visit(it, true, req); return req; });
          note('choice', t('xs:choice 는 속성을 모두 나열한 뒤 oneOf/anyOf 로 필수 조합만 구분합니다 (근사)', 'xs:choice lists all properties and distinguishes the required combinations with oneOf / anyOf (approximation)'));
          var allReq = p.items.map(function (it) { return reqOf(it); });
          if (!opt && allReq.every(function (r) { return r.length; })) alts.push({ oneOf: allReq.map(function (r) { return { required: r }; }) });
          return;
        }
        p.items.forEach(function (it) { visit(it, opt, collect !== undefined ? collect : required); });
      }
      function reqOf(p) { var out = []; (function r(q, optc) { if (!q) return; var op = optc || q.min === 0; if (q.k === 'el') { if (!op) out.push(q.name); } else if (q.k === 'choice') { /* 하위 선택은 필수로 세지 않음 */ } else if (q.items) q.items.forEach(function (x) { r(x, op); }); })(p, false); return out; }
      var anyAllowed = false;
      if (info.particle) visit(info.particle, false, required);
      var attrPrefix = o.ap == null ? '@' : String(o.ap);
      info.attrs.forEach(function (a) { var key = attrPrefix + a.name; props[key] = Object.assign(simpleSchema(a.type, a.inline), a.def != null ? { default: a.def } : {}, a.fixed != null ? { const: a.fixed } : {}); if (a.use === 'required') required.push(key); });
      if (info.simpleBase) { var tsch = info.simpleRestriction ? simpleSchema(null, { name: 'simpleType', attrs: [], children: [info.simpleRestriction] }) : simpleSchema(info.simpleBase, null); if (!info.attrs.length) return tsch; props[o.tk || '#text'] = tsch; required.push(o.tk || '#text'); hasText = true; }
      else if (info.mixed) { props[o.tk || '#text'] = { type: 'string' }; note('mixed', t('mixed 콘텐츠의 텍스트는 ' + (o.tk || '#text') + ' 속성으로 표현했습니다 (텍스트 조각의 위치는 잃습니다)', 'Mixed-content text is represented by the ' + (o.tk || '#text') + ' property (text positions are lost)')); }
      var sch = { type: 'object', properties: props };
      if (required.length) sch.required = required.filter(function (x, i, a) { return a.indexOf(x) === i; });
      if (alts.length === 1) Object.assign(sch, alts[0]); else if (alts.length > 1) sch.allOf = alts;
      if (o.strict && !anyAllowed && !info.anyAttr) sch.additionalProperties = false;
      if (info.empty && !info.attrs.length && !info.mixed) { note('empty', t('내용이 없는 요소는 빈 객체로 표현했습니다', 'Elements with no content became an empty object')); }
      return sch;
    }
    var rootName = String(o.root || '').trim() || model.order[0];
    if (!model.elements[rootName]) throw new Error(t('루트 요소 "' + rootName + '" 가 XSD 의 최상위 element 에 없습니다 (' + model.order.join(', ') + ')', 'Root element "' + rootName + '" is not a top-level element of the XSD (' + model.order.join(', ') + ')'));
    var rootSchema = elementSchema(model.elements[rootName], 0);
    var out = { $schema: o.draft === 'draft-07' ? 'http://json-schema.org/draft-07/schema#' : 'https://json-schema.org/draft/2020-12/schema', title: rootName };
    if (o.wrap) { out.type = 'object'; out.properties = {}; out.properties[rootName] = rootSchema; out.required = [rootName]; if (o.strict) out.additionalProperties = false; } else Object.keys(rootSchema).forEach(function (k) { out[k] = rootSchema[k]; });
    if (Object.keys(defs).length) out[o.draft === 'draft-07' ? 'definitions' : '$defs'] = defs;
    var text = JSON.stringify(out, null, 2);
    if (o.draft === 'draft-07') text = text.replace(/"#\/\$defs\//g, '"#/definitions/').replace(/"exclusiveMinimum": ([^,\n]+)/g, '"exclusiveMinimum": $1');
    model.notes.forEach(function (n) { issues.push('ℹ️ ' + n); });
    if (model.order.length > 1) issues.push('ℹ️ ' + t('최상위 element 가 ' + model.order.length + '개(' + model.order.join(', ') + ')입니다. "' + rootName + '" 만 변환했으니 다른 요소는 루트 요소 옵션으로 고르세요', 'The schema has ' + model.order.length + ' top-level elements (' + model.order.join(', ') + '); only "' + rootName + '" was converted, pick another with the root option'));
    issues.push(t('XML 의 속성은 "' + (o.ap || '') + '이름" 속성으로, 반복 요소(maxOccurs>1)는 배열로 옮겼습니다. XML→JSON 변환기마다 규칙이 다르니(속성 접두사, 단일 요소의 배열 여부) 실제 변환 결과와 맞는지 확인하세요', 'XML attributes became "' + (o.ap || '') + 'name" properties and repeated elements (maxOccurs>1) became arrays. XML→JSON converters differ (attribute prefix, single-item arrays), so confirm it matches your actual conversion'));
    issues.push(t('XML 요소의 순서(sequence)와 key/unique 제약은 JSON Schema 로 표현할 수 없어 생략했습니다', 'Element order (sequence) and key / unique constraints cannot be expressed in JSON Schema and were dropped'));
    return { _status: t('✅ "' + rootName + '" 을(를) JSON Schema 로 변환했습니다', '✅ Converted "' + rootName + '" to JSON Schema'), out: text, issues: issues };
  }
});
