/* WooaDev Tool Kit — 설정 파일 파서/작성기: INI, Java .properties, Apple plist(XML), dotenv, 그리고 TOML/YAML/JSON 래퍼 */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var C = TK.config = TK.config || {};
  var t = function (a, b) { return TK.t(a, b); };
  var setProp = function (o, k, v) { if (TK.json && TK.json.setProp) TK.json.setProp(o, k, v); else o[k] = v; };

  C.infer = function (v) {
    if (typeof v !== 'string') return v;
    var s = v.trim();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(s) && Math.abs(Number(s)) <= Number.MAX_SAFE_INTEGER) return Number(s);
    return v;
  };
  function inferDeep(x) {
    if (Array.isArray(x)) return x.map(inferDeep);
    if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (k) { setProp(o, k, inferDeep(x[k])); }); return o; }
    return C.infer(x);
  }

  /** "a.b[0].c" 형태의 평면 키를 중첩 구조로 */
  C.unflatten = function (flat, sep) {
    sep = sep || '.';
    function nd() { return { c: Object.create(null), order: [], leaf: undefined, has: false }; }
    var root = nd();
    Object.keys(flat).forEach(function (key) {
      var toks = key.replace(/\[(\d+)\]/g, sep + '$1').split(sep);
      var cur = root;
      toks.forEach(function (tk) {
        if (!cur.c[tk]) { cur.c[tk] = nd(); cur.order.push(tk); }
        cur = cur.c[tk];
      });
      cur.leaf = flat[key]; cur.has = true;
    });
    function build(n) {
      if (n.has && !n.order.length) return n.leaf;
      var isArr = n.order.length && n.order.map(Number).sort(function (a, b) { return a - b; }).every(function (x, i) { return String(x) === String(i) && /^\d+$/.test(String(x)); }) && n.order.every(function (k) { return /^(0|[1-9]\d*)$/.test(k); });
      if (isArr) { var a = []; n.order.forEach(function (k) { a[Number(k)] = build(n.c[k]); }); return a; }
      var o = {}; n.order.forEach(function (k) { setProp(o, k, build(n.c[k])); }); return o;
    }
    return build(root);
  };
  C.flatten = function (obj, sep) {
    sep = sep || '.';
    var out = {};
    (function rec(x, p) {
      if (x !== null && typeof x === 'object') {
        var keys = Array.isArray(x) ? x.map(function (_, i) { return i; }) : Object.keys(x);
        if (!keys.length) { if (p) out[p] = ''; return; }
        keys.forEach(function (k) { rec(x[k], Array.isArray(x) ? p + '[' + k + ']' : (p ? p + sep + k : k)); });
      } else out[p] = x === null ? '' : String(x);
    })(obj, '');
    return out;
  };

  /* ── INI ── */
  C.parseIni = function (text, o) {
    o = o || {};
    var root = {}, cur = root, lines = String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/);
    lines.forEach(function (raw, idx) {
      var s = raw.trim();
      if (!s || s[0] === ';' || s[0] === '#') return;
      var m = /^\[([^\]]*)\]\s*(?:[;#].*)?$/.exec(s);
      if (m) {
        var name = m[1].trim();
        if (o.nested && name.indexOf('.') >= 0) {
          cur = root;
          name.split('.').forEach(function (p) { if (typeof cur[p] !== 'object' || cur[p] === null) setProp(cur, p, {}); cur = cur[p]; });
        } else { if (typeof root[name] !== 'object' || root[name] === null) setProp(root, name, {}); cur = root[name]; }
        return;
      }
      var kv = /^([^=:]+?)\s*[=:]\s*(.*)$/.exec(s);
      if (!kv) throw new Error(t('INI 형식 오류 (줄 ' + (idx + 1) + '): ' + s, 'Invalid INI syntax (line ' + (idx + 1) + '): ' + s));
      var key = kv[1].trim(), val = kv[2];
      var q = val.trim()[0];
      if ((q === '"' || q === "'") && val.trim().slice(-1) === q && val.trim().length >= 2) val = val.trim().slice(1, -1);
      else val = val.replace(/\s+[;#].*$/, '').trim();
      var arr = /^(.*)\[\]$/.exec(key);
      if (arr) { if (!Array.isArray(cur[arr[1]])) setProp(cur, arr[1], []); cur[arr[1]].push(o.infer ? C.infer(val) : val); }
      else setProp(cur, key, o.infer ? C.infer(val) : val);
    });
    return root;
  };
  C.stringifyIni = function (obj, o) {
    o = o || {};
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(t('INI로 만들려면 최상위가 객체여야 합니다', 'The top level must be an object to convert to INI'));
    var top = [], sections = [];
    function val(v) { return v === null ? '' : String(v); }
    function put(lines, k, v) {
      if (Array.isArray(v)) v.forEach(function (x) { lines.push(k + '[] = ' + val(x)); });
      else lines.push(k + ' = ' + val(v));
    }
    function sec(name, x) {
      var lines = ['[' + name + ']'], subs = [];
      Object.keys(x).forEach(function (k) {
        if (x[k] !== null && typeof x[k] === 'object' && !Array.isArray(x[k])) subs.push(k); else put(lines, k, x[k]);
      });
      sections.push(lines.join('\n'));
      subs.forEach(function (k) { sec(name + '.' + k, x[k]); });
    }
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== null && typeof obj[k] === 'object' && !Array.isArray(obj[k])) sec(k, obj[k]); else put(top, k, obj[k]);
    });
    return (top.length ? top.join('\n') + '\n\n' : '') + sections.join('\n\n');
  };

  /* ── Java .properties ── */
  function unescProps(s) {
    return s.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, function (_, hex, c) {
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      return c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c === 'f' ? '\f' : c;
    });
  }
  C.parseProps = function (text, o) {
    o = o || {};
    var lines = String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/), flat = {}, order = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].replace(/^\s+/, '');
      if (!l || l[0] === '#' || l[0] === '!') continue;
      while (/(^|[^\\])(\\\\)*\\$/.test(l) && i + 1 < lines.length) { l = l.slice(0, -1) + lines[++i].replace(/^\s+/, ''); }
      var k = '', j = 0;
      for (; j < l.length; j++) {
        var c = l[j];
        if (c === '\\') { k += l.substr(j, 2); j++; continue; }
        if (c === '=' || c === ':' || /\s/.test(c)) break;
        k += c;
      }
      var rest = l.slice(j).replace(/^\s*[=:]?\s*/, '');
      var key = unescProps(k), val = unescProps(rest);
      if (!Object.prototype.hasOwnProperty.call(flat, key)) order.push(key);
      flat[key] = val;
    }
    var out = {}; order.forEach(function (k) { setProp(out, k, flat[k]); });
    return o.nested ? C.unflatten(out, '.') : out;
  };
  function escProps(s, isKey) {
    var r = String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\f/g, '\\f');
    if (isKey) r = r.replace(/[ =:#!]/g, function (c) { return '\\' + c; });
    else r = r.replace(/^ /, '\\ ');
    return r.replace(/[^\x20-\x7E]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); });
  }
  C.stringifyProps = function (obj, o) {
    o = o || {};
    var flat = o.keepFlat ? obj : C.flatten(obj, '.');
    return Object.keys(flat).map(function (k) { return escProps(k, true) + '=' + escProps(flat[k] === null ? '' : flat[k], false); }).join('\n');
  };

  /* ── Apple plist (XML) ── */
  C.parsePlist = function (text) {
    var doc = TK.xml.parse(text);
    if (doc.root.name !== 'plist') throw new Error(t('<plist> 루트 요소가 없습니다', 'The <plist> root element is missing'));
    function kids(e) { return e.children.filter(function (c) { return c.name; }); }
    function val(e) {
      var txt = e.children.map(function (c) { return c.text != null ? c.text : (c.cdata != null ? c.cdata : ''); }).join('');
      switch (e.name) {
        case 'dict': {
          var o = {}, ks = kids(e);
          for (var i = 0; i < ks.length; i += 2) {
            if (ks[i].name !== 'key') throw new Error(t('dict 안에는 <key> 다음에 값이 와야 합니다', 'Inside <dict>, each <key> must be followed by a value'));
            var key = ks[i].children.map(function (c) { return c.text || ''; }).join('');
            if (!ks[i + 1]) throw new Error(t('키 "' + key + '"에 값이 없습니다', 'Key "' + key + '" has no value'));
            setProp(o, key, val(ks[i + 1]));
          }
          return o;
        }
        case 'array': return kids(e).map(val);
        case 'string': return txt;
        case 'integer': return Number(txt.trim());
        case 'real': return Number(txt.trim());
        case 'true': return true;
        case 'false': return false;
        case 'date': return txt.trim();
        case 'data': return txt.replace(/\s+/g, '');
        default: throw new Error(t('지원하지 않는 plist 요소 <' + e.name + '>', 'Unsupported plist element <' + e.name + '>'));
      }
    }
    var k = kids(doc.root);
    if (!k.length) throw new Error(t('<plist> 안에 값이 없습니다', 'The <plist> is empty'));
    return val(k[0]);
  };
  C.stringifyPlist = function (obj) {
    var X = TK.xml, warn = false;
    function ser(v, lvl) {
      var pad = '\t'.repeat(lvl);
      if (v === null) { warn = true; return pad + '<string></string>'; }
      if (typeof v === 'boolean') return pad + (v ? '<true/>' : '<false/>');
      if (typeof v === 'number') return pad + (Number.isInteger(v) ? '<integer>' + v + '</integer>' : '<real>' + v + '</real>');
      if (typeof v === 'string') return pad + '<string>' + X.escText(v) + '</string>';
      if (Array.isArray(v)) return v.length ? pad + '<array>\n' + v.map(function (x) { return ser(x, lvl + 1); }).join('\n') + '\n' + pad + '</array>' : pad + '<array/>';
      var ks = Object.keys(v);
      return ks.length ? pad + '<dict>\n' + ks.map(function (k) { return pad + '\t<key>' + X.escText(k) + '</key>\n' + ser(v[k], lvl + 1); }).join('\n') + '\n' + pad + '</dict>' : pad + '<dict/>';
    }
    var body = ser(obj, 1);
    C.lastPlistWarn = warn;
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n' + body + '\n</plist>';
  };

  /* ── TOML / YAML / JSON / ENV 래퍼 ── */
  C.bigReplacer = function (k, v) { return typeof v === 'bigint' ? '@@BIGINT@@' + v.toString() + '@@' : v; };
  C.jsonOut = function (v, indent) {
    var ind = indent === 'tab' ? '\t' : Number(indent) || undefined;
    return JSON.stringify(v, C.bigReplacer, ind).replace(/"@@BIGINT@@(-?\d+)@@"/g, '$1');
  };
  C.parseToml = function (text) {
    if (typeof TOML === 'undefined') throw new Error(t('TOML 라이브러리를 불러오지 못했습니다', 'Failed to load the TOML library'));
    try { return TOML.parse(String(text), { integersAsBigInt: 'asNeeded' }); }
    catch (e) { throw new Error(t('TOML 오류: ', 'TOML error: ') + String(e.message).split('\n')[0] + (e.line ? t(' (줄 ', ' (line ') + e.line + t(', 열 ', ', col ') + e.column + ')' : '')); }
  };
  C.parseYaml = function (text) {
    if (typeof jsyaml === 'undefined') throw new Error(t('YAML 라이브러리를 불러오지 못했습니다', 'Failed to load the YAML library'));
    try {
      var docs = jsyaml.loadAll(String(text));
      return docs.length > 1 ? docs : docs[0];
    } catch (e) { throw new Error(t('YAML 오류: ', 'YAML error: ') + (e.reason || String(e.message).split('\n')[0]) + (e.mark ? t(' (줄 ', ' (line ') + (e.mark.line + 1) + t(', 열 ', ', col ') + (e.mark.column + 1) + ')' : '')); }
  };
  /** 서식 이름 → 값. fmt: json|yaml|toml|ini|properties|env|plist */
  C.parse = function (fmt, text, o) {
    o = o || {};
    switch (fmt) {
      case 'json': return TK.json.parseValue(text);
      case 'yaml': return C.parseYaml(text);
      case 'toml': return C.parseToml(text);
      case 'ini': return C.parseIni(text, { infer: o.infer, nested: o.nested });
      case 'properties': return C.parseProps(text, { nested: o.nested });
      case 'plist': return C.parsePlist(text);
      case 'env': { var r = TK.env.parse(text), out = {}; r.vars.forEach(function (v) { setProp(out, v.key, v.value); }); return o.infer ? inferDeep(out) : out; }
    }
    throw new Error('unknown format ' + fmt);
  };
  C.inferDeep = inferDeep;
})(typeof window !== 'undefined' ? window : globalThis);
