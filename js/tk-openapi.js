/* WooaDev Tool Kit — OpenAPI(Swagger 2 / 3.0 / 3.1) 공용 헬퍼: 로드, $ref 해석, 오퍼레이션 열거, 예시 생성, 스키마 평탄화 (tk-yamlx.js 필요) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var O = TK.openapi = TK.openapi || {};
  var t = function (a, b) { return TK.t(a, b); };
  O.METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

  /** YAML/JSON 텍스트 → {spec, version, root(yamlx node), doc, Y} */
  O.load = function (text, label) {
    var Y = TK.yamlx, src = String(text || '');
    if (!src.trim()) throw new Error(t((label || 'OpenAPI 문서') + '를 입력하세요', 'Enter the ' + (label || 'OpenAPI document')));
    var res;
    try { res = Y.parse(src); }
    catch (e) {
      if (/^\s*[\[{]/.test(src)) { try { var js = JSON.parse(src); return mk(js, null, null); } catch (e2) { throw new Error(t('JSON 문법 오류: ', 'JSON syntax error: ') + e2.message); } }
      throw new Error(t('YAML 문법 오류 (줄 ' + e.line + '): ', 'YAML syntax error (line ' + e.line + '): ') + e.message);
    }
    var doc = res.docs[0]; if (!doc || !doc.root) throw new Error(t('내용이 비어 있습니다', 'The document is empty'));
    if (doc.error) throw new Error(doc.error.message);
    return mk(doc.js, Y.deref(doc.root), doc);
    function mk(spec, root, d) {
      if (!Y.isMap(spec)) throw new Error(t('최상위가 객체가 아닙니다', 'The top level is not an object'));
      var v = spec.openapi ? String(spec.openapi) : spec.swagger ? String(spec.swagger) : '';
      var ver = /^3\.1/.test(v) ? '3.1' : /^3\.0/.test(v) ? '3.0' : /^2\./.test(v) ? '2.0' : '';
      return { spec: spec, version: ver, rawVersion: v, root: root, doc: d, Y: Y, dups: d ? d.dups : [] };
    }
  };
  /** 경로(키 배열)의 줄 번호 (모르면 0) */
  O.line = function (L, path) { if (!L.root) return 0; var n = L.Y.get(L.root, path); if (n) return n.line; if (path.length) { var p = L.Y.get(L.root, path.slice(0, -1)); if (p) return L.Y.keyLine(p, String(path[path.length - 1])) || p.line; } return 1; };

  /** 로컬 $ref 해석 → 대상 (실패 시 undefined) */
  O.resolve = function (spec, ref) {
    if (typeof ref !== 'string' || ref.charAt(0) !== '#') return undefined;
    var parts = ref.slice(2).split('/').map(function (p) { return p.replace(/~1/g, '/').replace(/~0/g, '~').replace(/%25/g, '%').replace(/%7B/gi, '{').replace(/%7D/gi, '}'); }), cur = spec;
    for (var i = 0; i < parts.length; i++) { if (cur === null || typeof cur !== 'object') return undefined; cur = cur[parts[i]]; if (cur === undefined) return undefined; }
    return cur;
  };
  O.deref = function (spec, obj, guard) {
    guard = guard || 0;
    while (obj && typeof obj === 'object' && typeof obj.$ref === 'string' && guard++ < 30) { var r = O.resolve(spec, obj.$ref); if (r === undefined) return obj; obj = r; }
    return obj;
  };
  /** [{path, method, op, pathItem}] */
  O.operations = function (spec) {
    var out = [];
    if (!spec.paths || typeof spec.paths !== 'object') return out;
    Object.keys(spec.paths).forEach(function (p) {
      var item = O.deref(spec, spec.paths[p]); if (!item || typeof item !== 'object') return;
      O.METHODS.forEach(function (m) { if (item[m] && typeof item[m] === 'object') out.push({ path: p, method: m, op: item[m], item: item }); });
    });
    return out;
  };
  /** 오퍼레이션의 유효 파라미터 (경로 항목 + 오퍼레이션, 오퍼레이션이 우선) */
  O.params = function (spec, o) {
    var all = {};
    (o.item.parameters || []).concat(o.op.parameters || []).forEach(function (p) { var d = O.deref(spec, p); if (d && d.name && d.in) all[d.in + ':' + d.name] = d; });
    return all;
  };

  /* ---------- 예시 생성 (결정적) ---------- */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(seed, arr) { return arr[hash(seed) % arr.length]; }
  var WORDS = ['alpha', 'bravo', 'coral', 'delta', 'ember', 'fjord', 'gamma', 'harbor', 'indigo', 'juniper'];
  O.example = function (spec, schema, opts, name, depth, seen) {
    opts = opts || {}; depth = depth || 0; seen = seen || [];
    if (depth > (opts.maxDepth || 6) || schema === undefined || schema === null || typeof schema !== 'object') return null;
    if (typeof schema.$ref === 'string') { if (seen.indexOf(schema.$ref) >= 0) return null; var r = O.resolve(spec, schema.$ref); if (r === undefined) return null; return O.example(spec, r, opts, name || schema.$ref.split('/').pop(), depth + 1, seen.concat(schema.$ref)); }
    if (opts.useExamples !== false) {
      if (schema.example !== undefined) return schema.example;
      if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
      if (schema.default !== undefined && !opts.ignoreDefault) return schema.default;
    }
    if (schema.const !== undefined) return schema.const;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    if (Array.isArray(schema.allOf) && schema.allOf.length) { var merged = {}; schema.allOf.forEach(function (s) { var e = O.example(spec, s, opts, name, depth + 1, seen); if (e && typeof e === 'object' && !Array.isArray(e)) Object.assign(merged, e); }); return merged; }
    var alt = schema.oneOf || schema.anyOf; if (Array.isArray(alt) && alt.length) return O.example(spec, alt[0], opts, name, depth + 1, seen);
    var type = schema.type; if (Array.isArray(type)) type = type.filter(function (x) { return x !== 'null'; })[0] || 'null';
    if (!type) type = schema.properties ? 'object' : schema.items ? 'array' : 'string';
    var seed = (name || 'x') + depth;
    switch (type) {
      case 'object': {
        var o = {}, props = schema.properties || {}; Object.keys(props).forEach(function (k) { if (opts.requiredOnly && (schema.required || []).indexOf(k) < 0) return; var ps = O.deref(spec, props[k]); if (ps && ps.readOnly && opts.forRequest) return; if (ps && ps.writeOnly && !opts.forRequest) return; o[k] = O.example(spec, props[k], opts, k, depth + 1, seen); });
        if (schema.additionalProperties && typeof schema.additionalProperties === 'object' && !Object.keys(props).length) o.key = O.example(spec, schema.additionalProperties, opts, 'value', depth + 1, seen);
        return o;
      }
      case 'array': { var n = Math.max(schema.minItems || 0, opts.arrayItems || 1); n = Math.min(n, schema.maxItems || n, 3); var out = []; for (var i = 0; i < n; i++) out.push(O.example(spec, schema.items || {}, opts, name, depth + 1, seen)); return out; }
      case 'integer': { var lo = schema.minimum != null ? schema.minimum : schema.exclusiveMinimum != null && typeof schema.exclusiveMinimum === 'number' ? schema.exclusiveMinimum + 1 : 1, hi = schema.maximum != null ? schema.maximum : lo + 99; var v = lo + (hash(seed) % Math.max(1, Math.min(hi - lo + 1, 100))); return Math.round(v); }
      case 'number': { var lo2 = schema.minimum != null ? schema.minimum : 1, hi2 = schema.maximum != null ? schema.maximum : lo2 + 99; return Math.round((lo2 + (hash(seed) % 1000) / 1000 * Math.min(hi2 - lo2, 100)) * 100) / 100; }
      case 'boolean': return true;
      case 'null': return null;
      default: {
        var f = schema.format, s;
        if (f === 'date-time') s = '2026-10-17T09:30:00Z'; else if (f === 'date') s = '2026-10-17'; else if (f === 'time') s = '09:30:00'; else if (f === 'email') s = 'user@example.com'; else if (f === 'uuid') s = '3fa85f64-5717-4562-b3fc-2c963f66afa6'; else if (f === 'uri' || f === 'url') s = 'https://example.com/' + (name || 'resource'); else if (f === 'hostname') s = 'example.com'; else if (f === 'ipv4') s = '192.0.2.10'; else if (f === 'ipv6') s = '2001:db8::1'; else if (f === 'byte') s = 'U3dhZ2dlcg=='; else if (f === 'binary') s = '(binary)'; else if (f === 'password') s = '********';
        else if (schema.pattern) s = fromPattern(schema.pattern, name); else if (/(^|_)(name|title)$/i.test(name || '')) s = pick(seed, WORDS) + ' ' + pick(seed + 'b', WORDS); else if (/id$/i.test(name || '')) s = 'id-' + (hash(seed) % 9000 + 1000); else s = (name ? name + '-' : 'string-') + pick(seed, WORDS);
        if (schema.minLength && s.length < schema.minLength) s = s + new Array(schema.minLength - s.length + 1).join('x');
        if (schema.maxLength && s.length > schema.maxLength) s = s.slice(0, schema.maxLength);
        return s;
      }
    }
  };
  function fromPattern(p, name) {
    var m;
    if (/^\^?\[A-Z\]\{(\d+)\}\$?$/.test(p)) { m = /\{(\d+)\}/.exec(p); return new Array(+m[1] + 1).join('A'); }
    if (/^\^?\\d\{(\d+)\}\$?$/.test(p)) { m = /\{(\d+)\}/.exec(p); return new Array(+m[1] + 1).join('1'); }
    if (/^\^?\[a-z\]\+\$?$/.test(p)) return 'abc';
    if (/^\^?\\d\+\$?$/.test(p)) return '12345';
    return name ? name + '-sample' : 'sample';
  }
  O.short = function (x, n) { var s = typeof x === 'string' ? x : JSON.stringify(x); return s.length > (n || 60) ? s.slice(0, n || 60) + '…' : s; };
})(typeof window !== 'undefined' ? window : globalThis);
