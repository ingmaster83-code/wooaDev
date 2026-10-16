/* WooaDev Tool Kit — JSON Schema 유틸: 샘플→스키마 생성, 스키마→모의 데이터(정규식 생성기 포함), $ref 해석, 스키마 비교 */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var S = TK.schema = TK.schema || {};
  var t = function (a, b) { return TK.t(a, b); };

  S.DRAFTS = {
    '2020-12': 'https://json-schema.org/draft/2020-12/schema',
    '2019-09': 'https://json-schema.org/draft/2019-09/schema',
    '07': 'http://json-schema.org/draft-07/schema#'
  };

  /* ───────── 샘플 → 스키마 ───────── */
  S.fromIR = function (ir, o) {
    o = o || {};
    function typeName(k) { return { bool: 'boolean', int: 'integer', float: 'number', string: 'string', array: 'array', object: 'object' }[k]; }
    function gen(x) {
      var s = {};
      if (x.mixed) {
        var ts = x.kinds.map(typeName); if (x.nullable) ts.push('null'); s.type = ts; return s;
      }
      if (x.t === 'any') { if (x.nullable) s.type = 'null'; return s; }
      s.type = x.nullable ? [typeName(x.t), 'null'] : typeName(x.t);
      if (x.t === 'string' && x.fmt && o.formats) s.format = x.fmt;
      if (x.t === 'array') { if (x.item && x.item.samples) s.items = gen(x.item); }
      if (x.t === 'object') {
        s.properties = {};
        var req = [];
        x.fields.forEach(function (f) { TK.json.setProp(s.properties, f.key, gen(f.ir)); if (!f.optional && o.required) req.push(f.key); });
        if (req.length) s.required = req;
        if (o.strict) s.additionalProperties = false;
      }
      return s;
    }
    var root = gen(ir), out = {};
    out.$schema = S.DRAFTS[o.draft || '2020-12'];
    if (o.title) out.title = o.title;
    Object.keys(root).forEach(function (k) { out[k] = root[k]; });
    return out;
  };

  /* ───────── $ref 해석 ───────── */
  S.resolveRef = function (root, ref) {
    if (ref === '#') return root;
    if (ref.charAt(0) !== '#') throw new Error(t('외부 $ref는 지원하지 않습니다: ' + ref, 'External $ref is not supported: ' + ref));
    var parts = decodeURIComponent(ref.slice(1)).split('/').slice(1).map(function (p) { return p.replace(/~1/g, '/').replace(/~0/g, '~'); });
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || typeof cur !== 'object' || !(parts[i] in cur)) throw new Error(t('$ref를 찾을 수 없습니다: ' + ref, 'Cannot resolve $ref: ' + ref));
      cur = cur[parts[i]];
    }
    return cur;
  };

  /* ───────── 정규식 → 문자열 생성기 ───────── */
  S.regexGen = function (pattern, rnd) {
    var s = String(pattern), i = 0;
    var PRINT = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var CLS = { d: '0123456789', w: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_', s: ' ' };
    function pick(str) { return str[Math.floor(rnd() * str.length)]; }
    function unsupported(what) { throw new Error(t('지원하지 않는 정규식 구문: ' + what, 'Unsupported regex syntax: ' + what)); }
    function alt() {
      var opts = [seq()];
      while (s[i] === '|') { i++; opts.push(seq()); }
      return function () { return opts[Math.floor(rnd() * opts.length)](); };
    }
    function seq() {
      var parts = [];
      while (i < s.length && s[i] !== '|' && s[i] !== ')') {
        var atom = atomf();
        if (atom === null) continue;
        var q = quant();
        parts.push(rep(atom, q));
      }
      return function () { return parts.map(function (p) { return p(); }).join(''); };
    }
    function rep(atom, q) {
      return function () {
        var n = q.min + Math.floor(rnd() * (q.max - q.min + 1)), out = '';
        for (var k = 0; k < n; k++) out += atom();
        return out;
      };
    }
    function quant() {
      var c = s[i];
      var q = { min: 1, max: 1 };
      if (c === '*') { q = { min: 0, max: 5 }; i++; }
      else if (c === '+') { q = { min: 1, max: 5 }; i++; }
      else if (c === '?') { q = { min: 0, max: 1 }; i++; }
      else if (c === '{') {
        var m = /^\{(\d+)(,(\d*))?\}/.exec(s.slice(i));
        if (m) { q.min = +m[1]; q.max = m[2] ? (m[3] === '' ? q.min + 5 : +m[3]) : q.min; i += m[0].length; }
      }
      if (s[i] === '?') i++;     // lazy
      return q;
    }
    function escClass(c) {
      if (CLS[c]) return CLS[c];
      if (c === 'D') return 'abcXYZ-_.'; if (c === 'W') return '-.!@#'; if (c === 'S') return PRINT;
      return null;
    }
    function atomf() {
      var c = s[i++];
      if (c === '^' || c === '$') return null;
      if (c === '(') {
        if (s[i] === '?') {
          if (s[i + 1] === ':') i += 2; else if (s[i + 1] === '<' && /[A-Za-z]/.test(s[i + 2])) { i = s.indexOf('>', i) + 1; } else unsupported('(?' + s[i + 1] + '…)');
        }
        var inner = alt();
        if (s[i] !== ')') unsupported(t('닫히지 않은 괄호', 'unclosed group'));
        i++;
        return inner;
      }
      if (c === '[') {
        var neg = false, set = '';
        if (s[i] === '^') { neg = true; i++; }
        while (i < s.length && s[i] !== ']') {
          var ch = s[i++];
          if (ch === '\\') { var e = s[i++]; var ec = escClass(e); if (ec) set += ec; else set += ({ n: '\n', t: '\t' }[e] || e); continue; }
          if (s[i] === '-' && s[i + 1] && s[i + 1] !== ']') {
            var from = ch.charCodeAt(0), to = s[i + 1].charCodeAt(0); i += 2;
            for (var k = from; k <= to && k < from + 300; k++) set += String.fromCharCode(k);
          } else set += ch;
        }
        i++;
        if (neg) { var pool = PRINT.split('').filter(function (x) { return set.indexOf(x) < 0; }).join(''); set = pool || 'x'; }
        return function () { return pick(set); };
      }
      if (c === '.') return function () { return pick(PRINT); };
      if (c === '\\') {
        var e2 = s[i++], cls = escClass(e2);
        if (cls) return function () { return pick(cls); };
        if (/[bB]/.test(e2)) return null;
        if (/[1-9]/.test(e2)) unsupported('\\' + e2);
        var lit = ({ n: '\n', t: '\t', r: '\r' })[e2] || e2;
        return function () { return lit; };
      }
      return function () { return c; };
    }
    var f = alt();
    if (i < s.length) unsupported(s.slice(i));
    return f();
  };

  /* ───────── 스키마 → 모의 데이터 ───────── */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t1 = Math.imul(a ^ a >>> 15, 1 | a); t1 = t1 + Math.imul(t1 ^ t1 >>> 7, 61 | t1) ^ t1; return ((t1 ^ t1 >>> 14) >>> 0) / 4294967296; }; }
  S.rng = mulberry32;

  var WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua apple river stone cloud forest window garden market silver planet bridge coffee'.split(' ');
  var NAMES = ['Kim Minjun', 'Lee Seoyeon', 'Park Jiho', 'Choi Yuna', 'Jung Hyunwoo', 'Kang Soyeon', 'Alex Morgan', 'Sam Rivera'];

  S.mock = function (schema, o) {
    o = o || {};
    var rnd = S.rng(o.seed == null ? 1 : o.seed), root = schema, warnings = [];
    function R(n) { return Math.floor(rnd() * n); }
    function between(a, b) { return a + R(b - a + 1); }
    function merge(a, b) {
      var r = {}; Object.keys(a).forEach(function (k) { r[k] = a[k]; });
      Object.keys(b).forEach(function (k) {
        if (k === 'properties') r.properties = Object.assign({}, a.properties || {}, b.properties);
        else if (k === 'required') r.required = (a.required || []).concat(b.required || []);
        else r[k] = b[k];
      });
      return r;
    }
    function norm(sc, depth) {
      var guard = 0;
      while (sc && typeof sc === 'object' && guard++ < 20) {
        if (sc.$ref) { var target = S.resolveRef(root, sc.$ref), rest = Object.assign({}, sc); delete rest.$ref; sc = merge(target, rest); continue; }
        if (sc.allOf) { var base = Object.assign({}, sc); delete base.allOf; sc.allOf.forEach(function (x) { base = merge(base, norm(x, depth)); }); sc = base; continue; }
        if (sc.oneOf || sc.anyOf) { var alts = sc.oneOf || sc.anyOf, base2 = Object.assign({}, sc); delete base2.oneOf; delete base2.anyOf; sc = merge(base2, alts[R(alts.length)]); continue; }
        break;
      }
      return sc;
    }
    function str(sc, name) {
      var fmt = sc.format;
      if (fmt === 'date-time') return new Date(Date.UTC(2020 + R(7), R(12), 1 + R(28), R(24), R(60), R(60))).toISOString().replace(/\.\d+Z$/, 'Z');
      if (fmt === 'date') return new Date(Date.UTC(2020 + R(7), R(12), 1 + R(28))).toISOString().slice(0, 10);
      if (fmt === 'time') return ('0' + R(24)).slice(-2) + ':' + ('0' + R(60)).slice(-2) + ':' + ('0' + R(60)).slice(-2) + 'Z';
      if (fmt === 'email') return WORDS[R(WORDS.length)] + R(100) + '@example.com';
      if (fmt === 'uuid') { var h = function (n) { var x = ''; for (var k = 0; k < n; k++) x += '0123456789abcdef'[R(16)]; return x; }; return h(8) + '-' + h(4) + '-4' + h(3) + '-' + '89ab'[R(4)] + h(3) + '-' + h(12); }
      if (fmt === 'uri' || fmt === 'url' || fmt === 'iri') return 'https://example.com/' + WORDS[R(WORDS.length)] + '/' + R(1000);
      if (fmt === 'hostname') return WORDS[R(WORDS.length)] + '.example.com';
      if (fmt === 'ipv4') return between(1, 223) + '.' + R(256) + '.' + R(256) + '.' + between(1, 254);
      if (fmt === 'ipv6') return '2001:db8:' + R(65536).toString(16) + ':' + R(65536).toString(16) + '::' + R(65536).toString(16);
      if (sc.pattern) {
        var tries = 0, v;
        do { v = S.regexGen(sc.pattern, rnd); tries++; } while (tries < 40 && (new RegExp(sc.pattern).test(v) === false));
        return v;
      }
      var min = sc.minLength || 0, max = sc.maxLength == null ? Math.max(min, 24) : sc.maxLength, txt;
      var nm = (name || '').toLowerCase();
      if (/name$|^name/.test(nm)) txt = NAMES[R(NAMES.length)];
      else if (/city/.test(nm)) txt = ['Seoul', 'Busan', 'Daegu', 'Incheon'][R(4)];
      else if (/title|subject/.test(nm)) txt = WORDS[R(WORDS.length)] + ' ' + WORDS[R(WORDS.length)];
      else { var w = []; var n = between(1, 3); for (var k = 0; k < n; k++) w.push(WORDS[R(WORDS.length)]); txt = w.join(' '); }
      while (txt.length < min) txt += ' ' + WORDS[R(WORDS.length)];
      if (txt.length > max) txt = txt.slice(0, max);
      return txt;
    }
    function num(sc, int) {
      var lo = sc.minimum != null ? sc.minimum : (sc.exclusiveMinimum != null && typeof sc.exclusiveMinimum === 'number' ? sc.exclusiveMinimum + (int ? 1 : 0.01) : 0);
      var hi = sc.maximum != null ? sc.maximum : (sc.exclusiveMaximum != null && typeof sc.exclusiveMaximum === 'number' ? sc.exclusiveMaximum - (int ? 1 : 0.01) : lo + 1000);
      if (hi < lo) hi = lo;
      if (sc.multipleOf) {
        var m = sc.multipleOf, a = Math.ceil(lo / m), b = Math.floor(hi / m);
        if (b < a) b = a;
        var val = (a + R(b - a + 1)) * m;
        return Number(val.toFixed(10));
      }
      if (int) return Math.ceil(lo) + R(Math.max(0, Math.floor(hi) - Math.ceil(lo)) + 1);
      return Number((lo + rnd() * (hi - lo)).toFixed(2));
    }
    function gen(sc0, depth, name) {
      if (sc0 === true || sc0 === undefined) return WORDS[R(WORDS.length)];
      if (sc0 === false) return null;
      var sc = norm(sc0, depth);
      if (!sc || typeof sc !== 'object') return null;
      if ('const' in sc) return sc.const;
      if (sc.enum) return sc.enum[R(sc.enum.length)];
      if (o.useExamples && Array.isArray(sc.examples) && sc.examples.length) return sc.examples[R(sc.examples.length)];
      if (o.useDefaults !== false && 'default' in sc) return sc.default;
      var ty = sc.type;
      if (Array.isArray(ty)) { var nn = ty.filter(function (x) { return x !== 'null'; }); ty = nn.length ? nn[R(nn.length)] : 'null'; }
      if (!ty) { if (sc.properties || sc.required) ty = 'object'; else if (sc.items || sc.prefixItems) ty = 'array'; else if (sc.pattern || sc.format || sc.minLength != null || sc.maxLength != null) ty = 'string'; else if (sc.minimum != null || sc.maximum != null) ty = 'number'; else ty = 'string'; }
      switch (ty) {
        case 'string': return str(sc, name);
        case 'integer': return num(sc, true);
        case 'number': return num(sc, false);
        case 'boolean': return rnd() < 0.5;
        case 'null': return null;
        case 'array': {
          if (depth > 6) return [];
          var min = sc.minItems != null ? sc.minItems : o.minItems != null ? o.minItems : 1, max = sc.maxItems != null ? sc.maxItems : Math.max(min, o.maxItems != null ? o.maxItems : 3);
          var n = between(min, Math.max(min, max)), out = [];
          var tuple = Array.isArray(sc.prefixItems) ? sc.prefixItems : (Array.isArray(sc.items) ? sc.items : null);
          if (tuple) { tuple.forEach(function (x) { out.push(gen(x, depth + 1)); }); return out; }
          var itemSc = sc.items === undefined ? true : sc.items, guard = 0;
          while (out.length < n && guard++ < n * 20) {
            var v = gen(itemSc, depth + 1, name);
            if (sc.uniqueItems && out.some(function (y) { return TK.json.eq(y, v); })) continue;
            out.push(v);
          }
          return out;
        }
        case 'object': {
          var obj = {}, props = sc.properties || {}, req = sc.required || [];
          if (depth > 8) return obj;
          Object.keys(props).forEach(function (k) {
            var include = req.indexOf(k) >= 0 || o.optional === 'always' || (o.optional !== 'never' && rnd() < 0.7);
            if (include) TK.json.setProp(obj, k, gen(props[k], depth + 1, k));
          });
          req.forEach(function (k) { if (!(k in obj)) TK.json.setProp(obj, k, WORDS[R(WORDS.length)]); });
          return obj;
        }
      }
      return null;
    }
    return { gen: function () { return gen(schema, 0); }, warnings: warnings };
  };

  /* ───────── 스키마 비교 ───────── */
  /** $ref/allOf 를 펼치고, 속성 경로별 요약 맵을 만든다: path → {type, required, enum, constraints…} */
  S.summarize = function (schema) {
    var root = schema, map = {}, order = [];
    function mergeS(a, b) {
      var r = Object.assign({}, a);
      Object.keys(b).forEach(function (k) {
        if (k === 'properties') r.properties = Object.assign({}, a.properties || {}, b.properties);
        else if (k === 'required') r.required = (a.required || []).concat(b.required || []);
        else r[k] = b[k];
      });
      return r;
    }
    function norm(sc, seen) {
      var guard = 0;
      while (sc && typeof sc === 'object' && guard++ < 30) {
        if (sc.$ref) { if (seen.indexOf(sc.$ref) >= 0) return { recursive: true, seen: seen }; seen = seen.concat([sc.$ref]); var rest = Object.assign({}, sc); delete rest.$ref; sc = mergeS(S.resolveRef(root, sc.$ref), rest); continue; }
        if (sc.allOf) { var base = Object.assign({}, sc); delete base.allOf; sc.allOf.forEach(function (x) { var r = norm(x, seen); if (!r.recursive) base = mergeS(base, r.sc); }); sc = base; continue; }
        break;
      }
      return { sc: sc, seen: seen };
    }
    var KEYS = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern', 'format', 'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties', 'additionalProperties', 'const'];
    function visit(sc0, path, req, seen) {
      var n = norm(sc0, seen);
      if (n.recursive) { map[path] = { type: ['(recursive)'], required: req, enum: null, c: {} }; order.push(path); return; }
      var sc = n.sc; seen = n.seen;
      if (sc === true || sc === false || !sc || typeof sc !== 'object') { map[path] = { type: [sc === false ? 'never' : 'any'], required: req, enum: null, c: {} }; order.push(path); return; }
      var ty = sc.type === undefined ? [] : [].concat(sc.type);
      var c = {};
      KEYS.forEach(function (k) { if (sc[k] !== undefined) c[k] = sc[k]; });
      var complex = ['oneOf', 'anyOf', 'not', 'if'].filter(function (k) { return sc[k] !== undefined; });
      complex.forEach(function (k) { c[k] = JSON.stringify(sc[k]); });
      if (!ty.length) { if (sc.properties) ty = ['object']; else if (sc.items) ty = ['array']; }
      map[path] = { type: ty.slice().sort(), required: req, enum: sc.enum ? sc.enum.slice() : null, c: c };
      order.push(path);
      var reqList = sc.required || [];
      if (sc.properties) Object.keys(sc.properties).forEach(function (k) { visit(sc.properties[k], path + (path ? '.' : '') + k, reqList.indexOf(k) >= 0, seen); });
      if (sc.items && !Array.isArray(sc.items)) visit(sc.items, path + '[]', false, seen);
      if (Array.isArray(sc.prefixItems)) sc.prefixItems.forEach(function (x, i) { visit(x, path + '[' + i + ']', false, seen); });
    }
    visit(schema, '', true, []);
    return { map: map, order: order };
  };

  S.diff = function (a, b, usage) {
    var A = S.summarize(a), B = S.summarize(b), rows = [], req = usage === 'request';
    function add(risk, path, what, before, after) { rows.push({ risk: risk, path: path || '(root)', what: what, before: before, after: after }); }
    var paths = A.order.concat(B.order.filter(function (p) { return !(p in A.map); }));
    var show = function (x) { return x === undefined ? '' : (typeof x === 'string' ? x : JSON.stringify(x)); };
    paths.forEach(function (p) {
      var x = A.map[p], y = B.map[p];
      if (!x) {
        if (req) add(y.required ? 'bad' : 'ok', p, y.required ? t('필수 속성이 추가됨', 'Required property added') : t('선택 속성이 추가됨', 'Optional property added'), '', y.type.join('|'));
        else add(y.required ? 'ok' : 'ok', p, t('속성이 추가됨', 'Property added'), '', y.type.join('|'));
        return;
      }
      if (!y) {
        if (req) add(B.map[''] && B.map[''].c.additionalProperties === false ? 'bad' : 'warn', p, t('속성이 제거됨', 'Property removed'), x.type.join('|'), '');
        else add(x.required ? 'bad' : 'warn', p, x.required ? t('필수 속성이 제거됨', 'Required property removed') : t('선택 속성이 제거됨', 'Optional property removed'), x.type.join('|'), '');
        return;
      }
      if (p !== '' && x.required !== y.required) {
        if (req) add(y.required ? 'bad' : 'ok', p, y.required ? t('선택 → 필수', 'Optional → required') : t('필수 → 선택', 'Required → optional'), x.required ? 'required' : 'optional', y.required ? 'required' : 'optional');
        else add(y.required ? 'ok' : 'bad', p, y.required ? t('선택 → 필수 (응답이 더 확실해짐)', 'Optional → required (more guaranteed)') : t('필수 → 선택 (값이 없을 수 있음)', 'Required → optional (may be missing)'), x.required ? 'required' : 'optional', y.required ? 'required' : 'optional');
      }
      var tx = x.type.join('|'), ty = y.type.join('|');
      if (tx !== ty) {
        var removed = x.type.filter(function (k) { return y.type.indexOf(k) < 0 && !(k === 'integer' && y.type.indexOf('number') >= 0); }), added = y.type.filter(function (k) { return x.type.indexOf(k) < 0 && !(k === 'integer' && x.type.indexOf('number') >= 0); });
        var widen = removed.length === 0 && (added.length > 0 || (x.type.indexOf('integer') >= 0 && y.type.indexOf('number') >= 0));
        var risk;
        if (req) risk = widen ? 'ok' : 'bad'; else risk = widen ? 'warn' : 'bad';
        if (!x.type.length || !y.type.length) risk = req ? (y.type.length ? 'bad' : 'ok') : 'warn';
        add(risk, p, widen ? t('타입이 넓어짐', 'Type widened') : t('타입 변경', 'Type changed'), tx || '(any)', ty || '(any)');
      }
      if (x.enum || y.enum) {
        var ex = (x.enum || []).map(show), ey = (y.enum || []).map(show);
        var rem = ex.filter(function (v) { return ey.indexOf(v) < 0; }), adn = ey.filter(function (v) { return ex.indexOf(v) < 0; });
        if (!x.enum && y.enum) add(req ? 'bad' : 'ok', p, t('enum 제한이 생김', 'enum restriction added'), '', ey.join(', '));
        else if (x.enum && !y.enum) add(req ? 'ok' : 'warn', p, t('enum 제한이 사라짐', 'enum restriction removed'), ex.join(', '), '');
        else {
          if (rem.length) add(req ? 'bad' : 'ok', p, t('enum 값 제거', 'enum value(s) removed'), rem.join(', '), '');
          if (adn.length) add(req ? 'ok' : 'warn', p, t('enum 값 추가', 'enum value(s) added'), '', adn.join(', '));
        }
      }
      var ck = Object.keys(Object.assign({}, x.c, y.c));
      ck.forEach(function (k) {
        var vx = x.c[k], vy = y.c[k];
        if (JSON.stringify(vx) === JSON.stringify(vy)) return;
        var lowerBound = ['minimum', 'exclusiveMinimum', 'minLength', 'minItems', 'minProperties'].indexOf(k) >= 0, upperBound = ['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems', 'maxProperties'].indexOf(k) >= 0, tighter;
        if (lowerBound) tighter = vy !== undefined && (vx === undefined || vy > vx);
        else if (upperBound) tighter = vy !== undefined && (vx === undefined || vy < vx);
        else if (k === 'additionalProperties') tighter = vy === false;
        else if (k === 'uniqueItems') tighter = vy === true;
        else if (k === 'oneOf' || k === 'anyOf' || k === 'not' || k === 'if') { add('warn', p, t(k + ' 구조 변경 (직접 확인 필요)', k + ' changed (review manually)'), '', ''); return; }
        else tighter = vx === undefined || (vy !== undefined && vx !== vy);          // pattern, format, const, multipleOf: 바뀌면 제한 변화로 간주
        if (req) add(tighter ? 'bad' : 'ok', p, tighter ? t(k + ' 제한이 엄격해짐', k + ' became stricter') : t(k + ' 제한이 완화됨', k + ' was relaxed'), show(vx), show(vy));
        else add(tighter ? 'ok' : 'warn', p, tighter ? t(k + ' 제한이 엄격해짐 (응답 값이 더 한정됨)', k + ' became stricter (responses are narrower)') : t(k + ' 제한이 완화됨 (예상 못한 값이 올 수 있음)', k + ' was relaxed (unexpected values possible)'), show(vx), show(vy));
      });
    });
    return rows;
  };
})(typeof window !== 'undefined' ? window : globalThis);
