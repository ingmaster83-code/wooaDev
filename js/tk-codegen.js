/* WooaDev Tool Kit — JSON 샘플 → 여러 언어의 모델 코드 생성 (Go, Java, Python, Rust, C#, Dart, Kotlin, Swift) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var G = TK.codegen = TK.codegen || {};
  var t = function (a, b) { return TK.t(a, b); };

  /** 입력 JSON → { decls, root(타입 참조), rootObject(최상위 객체 decl 이름), isArray, sampleCount } */
  G.prepare = function (text, rootName, opts) {
    var inf = TK.inferIR(text);
    var ir = inf.ir;
    var base = ir.t === 'array' ? ir.item : ir;
    if (base.t !== 'object') throw new Error(t('최상위가 객체이거나 객체의 배열이어야 합니다 (현재: ' + (ir.t === 'array' ? '배열 안의 ' : '') + base.t + ')', 'The top level must be an object or an array of objects (found ' + (ir.t === 'array' ? 'array of ' : '') + base.t + ')'));
    var named = TK.nameDecls(base, rootName || 'Root', opts || {});
    return { decls: named.decls, rootName: named.root.name, isArray: ir.t === 'array', count: inf.count, ir: ir };
  };

  function dedupe(names) {
    var used = {};
    return names.map(function (n) { var x = n, i = 2; while (used[x]) x = n + '_' + (i++); used[x] = 1; return x; });
  }
  function rootFirst(decls, rootName) {
    var r = decls.filter(function (d) { return d.name === rootName; }), rest = decls.filter(function (d) { return d.name !== rootName; }).reverse();
    return r.concat(rest);
  }

  /* ───────── Go ───────── */
  var INIT = { id: 'ID', url: 'URL', uri: 'URI', api: 'API', http: 'HTTP', https: 'HTTPS', json: 'JSON', html: 'HTML', xml: 'XML', uuid: 'UUID', ip: 'IP', sql: 'SQL', ui: 'UI', cpu: 'CPU', ssl: 'SSL', tcp: 'TCP', udp: 'UDP', ttl: 'TTL', os: 'OS' };
  function goName(k) {
    var w = TK.names.words(k).map(function (x) { var l = x.toLowerCase(); return INIT[l] || (x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()); }).join('');
    if (!w) w = 'Field'; if (/^[0-9]/.test(w)) w = 'F' + w;
    return w;
  }
  G.go = function (p, o) {
    var uses = { time: false };
    var any = o.any ? 'any' : 'interface{}';
    function ty(ir, optional) {
      var s, ptr = true;
      switch (ir.t) {
        case 'string': if (ir.fmt === 'date-time' && o.time) { s = 'time.Time'; uses.time = true; } else s = 'string'; break;
        case 'int': s = o.int64 ? 'int64' : 'int'; break;
        case 'float': s = 'float64'; break;
        case 'bool': s = 'bool'; break;
        case 'array': s = '[]' + ty(ir.item, false); ptr = false; break;
        case 'object': s = ir.name; break;
        default: s = any; ptr = false;
      }
      if (ir.mixed) { s = any; ptr = false; }
      return (o.pointers && (ir.nullable || optional) && ptr) ? '*' + s : s;
    }
    var out = [];
    rootFirst(p.decls, p.rootName).forEach(function (d) {
      var ids = dedupe(d.fields.map(function (f) { return goName(f.key); }));
      var w = Math.max.apply(null, ids.map(function (x) { return x.length; }).concat([1]));
      var tys = d.fields.map(function (f) { return ty(f.ir, f.optional); });
      var tw = Math.max.apply(null, tys.map(function (x) { return x.length; }).concat([1]));
      out.push('type ' + d.name + ' struct {\n' + d.fields.map(function (f, i) {
        return '\t' + ids[i] + ' '.repeat(w - ids[i].length) + ' ' + tys[i] + ' '.repeat(tw - tys[i].length) + ' `json:"' + f.key + (f.optional && o.omitempty ? ',omitempty' : '') + '"`';
      }).join('\n') + '\n}');
    });
    var head = 'package ' + (o.pkg || 'model') + '\n\n' + (uses.time ? 'import "time"\n\n' : '');
    return head + (p.isArray ? '// JSON root is an array: decode into []' + p.rootName + '\n' : '') + out.join('\n\n') + '\n';
  };

  /* ───────── Java ───────── */
  var JAVA_KW = 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while record var true false null'.split(' ');
  function camelIdent(k, kw) {
    var c = TK.names.camel(k); if (!c) c = 'field'; if (/^[0-9]/.test(c)) c = 'f' + c.charAt(0).toUpperCase() + c.slice(1);
    return kw.indexOf(c) >= 0 ? c + '_' : c;
  }
  G.java = function (p, o) {
    var imports = {};
    function ty(ir) {
      if (ir.mixed) return 'Object';
      switch (ir.t) {
        case 'string': return 'String';
        case 'int': return o.long ? 'Long' : 'Integer';
        case 'float': return 'Double';
        case 'bool': return 'Boolean';
        case 'array': imports['java.util.List'] = 1; return 'List<' + ty(ir.item) + '>';
        case 'object': return ir.name;
        default: return 'Object';
      }
    }
    var out = [];
    rootFirst(p.decls, p.rootName).forEach(function (d) {
      var ids = dedupe(d.fields.map(function (f) { return camelIdent(f.key, JAVA_KW); }));
      var tys = d.fields.map(function (f) { return ty(f.ir); });
      var ann = d.fields.map(function (f, i) {
        if (o.jackson && ids[i] !== f.key) { imports['com.fasterxml.jackson.annotation.JsonProperty'] = 1; return '@JsonProperty("' + f.key + '")'; }
        return '';
      });
      var cls = d.name === p.rootName ? 'public ' : '';
      if (o.style === 'record') {
        out.push(cls + 'record ' + d.name + '(' + (d.fields.length ? '\n' + d.fields.map(function (f, i) { return '    ' + (ann[i] ? ann[i] + ' ' : '') + tys[i] + ' ' + ids[i]; }).join(',\n') + '\n' : '') + ') {}');
      } else if (o.style === 'lombok') {
        imports['lombok.Data'] = 1;
        out.push('@Data\n' + cls + 'class ' + d.name + ' {\n' + d.fields.map(function (f, i) { return '    ' + (ann[i] ? ann[i] + '\n    ' : '') + 'private ' + tys[i] + ' ' + ids[i] + ';'; }).join('\n') + '\n}');
      } else {
        var body = d.fields.map(function (f, i) { return '    ' + (ann[i] ? ann[i] + '\n    ' : '') + 'private ' + tys[i] + ' ' + ids[i] + ';'; }).join('\n');
        var acc = d.fields.map(function (f, i) {
          var cap = ids[i].charAt(0).toUpperCase() + ids[i].slice(1);
          return '    public ' + tys[i] + ' ' + 'get' + cap + '() { return ' + ids[i] + '; }\n    public void set' + cap + '(' + tys[i] + ' ' + ids[i] + ') { this.' + ids[i] + ' = ' + ids[i] + '; }';
        }).join('\n\n');
        out.push(cls + 'class ' + d.name + ' {\n' + body + '\n\n' + acc + '\n}');
      }
    });
    var imp = Object.keys(imports).sort().map(function (x) { return 'import ' + x + ';'; }).join('\n');
    return (o.pkg ? 'package ' + o.pkg + ';\n\n' : '') + (imp ? imp + '\n\n' : '') + out.join('\n\n') + '\n';
  };

  /* ───────── Python ───────── */
  var PY_KW = 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type'.split(' ');
  function pyName(k) {
    var s = TK.names.snake(k); if (/^[0-9]/.test(s)) s = 'f_' + s;
    return PY_KW.indexOf(s) >= 0 ? s + '_' : s;
  }
  G.python = function (p, o) {
    var imp = { typing: {}, datetime: {}, uuid: false, pydantic: {} }, modern = o.modern;
    function base(ir) {
      if (ir.mixed) { imp.typing.Any = 1; return 'Any'; }
      switch (ir.t) {
        case 'string':
          if (o.style === 'pydantic') {
            if (ir.fmt === 'date-time') { imp.datetime.datetime = 1; return 'datetime'; }
            if (ir.fmt === 'date') { imp.datetime.date = 1; return 'date'; }
            if (ir.fmt === 'uuid') { imp.uuid = true; return 'UUID'; }
          }
          return 'str';
        case 'int': return 'int';
        case 'float': return 'float';
        case 'bool': return 'bool';
        case 'array': if (modern) return 'list[' + base(ir.item) + ']'; imp.typing.List = 1; return 'List[' + base(ir.item) + ']';
        case 'object': return "'" + ir.name + "'";
        default: imp.typing.Any = 1; return 'Any';
      }
    }
    function ty(ir, optional) {
      var b = base(ir);
      if (b.charAt(0) === "'" && o.style !== 'pydantic') b = b.slice(1, -1);
      if (b.charAt(0) === "'") b = b.slice(1, -1);
      if (b === 'Any') return b;
      if (ir.nullable || optional) { if (modern) return b + ' | None'; imp.typing.Optional = 1; return 'Optional[' + b + ']'; }
      return b;
    }
    var out = [];
    p.decls.forEach(function (d) {            // 자식 먼저
      var ids = dedupe(d.fields.map(function (f) { return pyName(f.key); }));
      var fields = d.fields.map(function (f, i) { return { f: f, id: ids[i], ty: ty(f.ir, f.optional), opt: f.optional || f.ir.nullable }; });
      if (o.style === 'typeddict') {
        imp.typing.TypedDict = 1;
        var allOpt = fields.every(function (x) { return x.f.optional; });
        var lines = fields.map(function (x) {
          var tt = x.ty.replace(/^Optional\[(.*)\]$/, '$1');
          if (x.f.optional) { imp.typing.NotRequired = 1; tt = 'NotRequired[' + x.ty + ']'; }
          return '    ' + x.id + ': ' + tt;
        });
        var needAlias = fields.some(function (x) { return x.id !== x.f.key; });
        if (needAlias) out.push(d.name + ' = TypedDict(\'' + d.name + '\', {\n' + fields.map(function (x) { return '    \'' + x.f.key + '\': ' + (x.f.optional ? (imp.typing.NotRequired = 1, 'NotRequired[' + x.ty + ']') : x.ty); }).join(',\n') + '\n})');
        else out.push('class ' + d.name + '(TypedDict):\n' + (lines.join('\n') || '    pass'));
        return;
      }
      if (o.style === 'pydantic') {
        imp.pydantic.BaseModel = 1;
        out.push('class ' + d.name + '(BaseModel):\n' + (fields.map(function (x) {
          var alias = x.id !== x.f.key ? (imp.pydantic.Field = 1, 'Field(' + (x.opt ? 'None, ' : '') + 'alias="' + x.f.key + '")') : (x.opt ? 'None' : '');
          return '    ' + x.id + ': ' + x.ty + (alias ? ' = ' + alias : '');
        }).join('\n') || '    pass'));
        return;
      }
      imp.dataclass = true;
      var req = fields.filter(function (x) { return !x.opt; }), optf = fields.filter(function (x) { return x.opt; });
      out.push('@dataclass\nclass ' + d.name + ':\n' + (req.map(function (x) { return '    ' + x.id + ': ' + x.ty; }).concat(optf.map(function (x) { return '    ' + x.id + ': ' + x.ty + ' = None'; })).join('\n') || '    pass'));
    });
    var head = [];
    if (o.style === 'dataclass') head.push('from dataclasses import dataclass');
    if (Object.keys(imp.datetime).length) head.push('from datetime import ' + Object.keys(imp.datetime).sort().join(', '));
    var tp = Object.keys(imp.typing).sort(); if (tp.length) head.push('from typing import ' + tp.join(', '));
    if (imp.uuid) head.push('from uuid import UUID');
    var pd = Object.keys(imp.pydantic).sort(); if (pd.length) head.push('from pydantic import ' + pd.join(', '));
    return head.join('\n') + '\n\n\n' + out.join('\n\n\n') + '\n';
  };

  /* ───────── Rust / C# / Dart / Kotlin (json-to-model) ───────── */
  var RUST_KW = 'as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while async await dyn abstract become box do final macro override priv typeof unsized virtual yield try'.split(' ');
  G.rust = function (p, o) {
    function ty(ir, opt) {
      var s;
      if (ir.mixed) s = 'serde_json::Value';
      else switch (ir.t) {
        case 'string': s = 'String'; break; case 'int': s = 'i64'; break; case 'float': s = 'f64'; break; case 'bool': s = 'bool'; break;
        case 'array': s = 'Vec<' + ty(ir.item, false) + '>'; break; case 'object': s = ir.name; break; default: s = 'serde_json::Value';
      }
      return (ir.nullable || opt) && s !== 'serde_json::Value' ? 'Option<' + s + '>' : s;
    }
    var out = [];
    rootFirst(p.decls, p.rootName).forEach(function (d) {
      var ids = dedupe(d.fields.map(function (f) { var s = TK.names.snake(f.key); if (/^[0-9]/.test(s)) s = 'f_' + s; return RUST_KW.indexOf(s) >= 0 ? 'r#' + s : s; }));
      out.push('#[derive(Debug, Clone, Serialize, Deserialize)]\n' + (o.camel ? '#[serde(rename_all = "camelCase")]\n' : '') + 'pub struct ' + d.name + ' {\n' + d.fields.map(function (f, i) {
        var attrs = [];
        var plain = ids[i].replace(/^r#/, '');
        var autoName = o.camel ? TK.names.camel(f.key) : plain;
        if (autoName !== f.key) attrs.push('rename = "' + f.key + '"');
        if (f.optional) attrs.push('default');
        var type = ty(f.ir, f.optional);
        if (/^Option</.test(type) && f.optional) attrs.push('skip_serializing_if = "Option::is_none"');
        return (attrs.length ? '    #[serde(' + attrs.join(', ') + ')]\n' : '') + '    pub ' + ids[i] + ': ' + type + ',';
      }).join('\n') + '\n}');
    });
    return 'use serde::{Deserialize, Serialize};\n\n' + out.join('\n\n') + '\n';
  };

  var CS_KW = 'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while'.split(' ');
  G.csharp = function (p, o) {
    var usesList = false;
    function ty(ir, opt) {
      var s;
      if (ir.mixed) s = 'object';
      else switch (ir.t) {
        case 'string': s = ir.fmt === 'date-time' && o.dates ? 'DateTime' : 'string'; break; case 'int': s = 'long'; break; case 'float': s = 'double'; break; case 'bool': s = 'bool'; break;
        case 'array': usesList = true; s = 'List<' + ty(ir.item, false) + '>'; break; case 'object': s = ir.name; break; default: s = 'object';
      }
      return (ir.nullable || opt) && o.nullable ? s + '?' : s;
    }
    var out = [];
    rootFirst(p.decls, p.rootName).forEach(function (d) {
      var ids = dedupe(d.fields.map(function (f) { var s = TK.names.pascalKeep(f.key); if (/^[0-9]/.test(s)) s = 'F' + s; return CS_KW.indexOf(s) >= 0 ? '@' + s : s; }));
      if (o.record) {
        out.push('public record ' + d.name + '(\n' + d.fields.map(function (f, i) { return '    [property: JsonPropertyName("' + f.key + '")] ' + ty(f.ir, f.optional) + ' ' + ids[i]; }).join(',\n') + '\n);');
      } else {
        out.push('public class ' + d.name + '\n{\n' + d.fields.map(function (f, i) { var tt = ty(f.ir, f.optional), refInit = o.nullable && !/^(long|double|bool|DateTime)$/.test(tt) && tt.slice(-1) !== '?'; return '    [JsonPropertyName("' + f.key + '")]\n    public ' + tt + ' ' + ids[i] + ' { get; set; }' + (refInit ? ' = default!;' : ''); }).join('\n\n') + '\n}');
      }
    });
    var head = 'using System.Text.Json.Serialization;\n' + (usesList ? 'using System.Collections.Generic;\n' : '') + (/DateTime/.test(out.join('')) ? 'using System;\n' : '');
    return head + '\n' + out.join('\n\n') + '\n';
  };

  var DART_KW = 'abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for Function get hide if implements import in interface is late library mixin new null on operator part required rethrow return set show static super switch sync this throw true try typedef var void while with yield'.split(' ');
  G.dart = function (p, o) {
    function ty(ir, opt) {
      var s;
      if (ir.mixed) s = 'dynamic';
      else switch (ir.t) {
        case 'string': s = 'String'; break; case 'int': s = 'int'; break; case 'float': s = 'double'; break; case 'bool': s = 'bool'; break;
        case 'array': s = 'List<' + ty(ir.item, false) + '>'; break; case 'object': s = ir.name; break; default: s = 'dynamic';
      }
      return (ir.nullable || opt) && s !== 'dynamic' ? s + '?' : s;
    }
    function from(ir, expr, opt) {
      var nul = ir.nullable || opt, q = nul ? '?' : '';
      if (ir.mixed) return expr;
      switch (ir.t) {
        case 'string': return expr + ' as String' + q;
        case 'int': return expr + ' as int' + q;
        case 'float': return '(' + expr + ' as num' + q + ')' + q + '.toDouble()';
        case 'bool': return expr + ' as bool' + q;
        case 'array': {
          var inner = ir.item;
          var el = inner.t === 'object' ? inner.name + '.fromJson(e as Map<String, dynamic>)' : inner.t === 'float' ? '(e as num).toDouble()' : (inner.t === 'string' ? 'e as String' : inner.t === 'int' ? 'e as int' : inner.t === 'bool' ? 'e as bool' : 'e');
          return nul ? '(' + expr + ' as List<dynamic>?)?.map((e) => ' + el + ').toList()' : '(' + expr + ' as List<dynamic>).map((e) => ' + el + ').toList()';
        }
        case 'object': return nul ? '(' + expr + ' == null ? null : ' + ir.name + '.fromJson(' + expr + ' as Map<String, dynamic>))' : ir.name + '.fromJson(' + expr + ' as Map<String, dynamic>)';
        default: return expr;
      }
    }
    function to(ir, expr, opt) {
      var nul = ir.nullable || opt, q = nul ? '?' : '';
      if (ir.t === 'object') return expr + q + '.toJson()';
      if (ir.t === 'array' && ir.item.t === 'object') return expr + q + '.map((e) => e.toJson()).toList()';
      return expr;
    }
    var out = [];
    rootFirst(p.decls, p.rootName).forEach(function (d) {
      var ids = dedupe(d.fields.map(function (f) { var s = TK.names.camel(f.key); if (/^[0-9]/.test(s)) s = 'f' + s; return DART_KW.indexOf(s) >= 0 ? s + '_' : s; }));
      var tys = d.fields.map(function (f) { return ty(f.ir, f.optional); });
      out.push('class ' + d.name + ' {\n' + d.fields.map(function (f, i) { return '  final ' + tys[i] + ' ' + ids[i] + ';'; }).join('\n') +
        '\n\n  const ' + d.name + '({' + d.fields.map(function (f, i) { return (/\?$|dynamic/.test(tys[i]) ? 'this.' : 'required this.') + ids[i]; }).join(', ') + '});' +
        '\n\n  factory ' + d.name + '.fromJson(Map<String, dynamic> json) => ' + d.name + '(\n' + d.fields.map(function (f, i) { return '        ' + ids[i] + ': ' + from(f.ir, "json['" + f.key + "']", f.optional) + ','; }).join('\n') + '\n      );' +
        '\n\n  Map<String, dynamic> toJson() => {\n' + d.fields.map(function (f, i) { return "        '" + f.key + "': " + to(f.ir, ids[i], f.optional) + ','; }).join('\n') + '\n      };\n}');
    });
    return out.join('\n\n') + '\n';
  };

  var KT_KW = 'as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while'.split(' ');
  G.kotlin = function (p, o) {
    function ty(ir, opt) {
      var s;
      if (ir.mixed) s = 'JsonElement';
      else switch (ir.t) {
        case 'string': s = 'String'; break; case 'int': s = 'Long'; break; case 'float': s = 'Double'; break; case 'bool': s = 'Boolean'; break;
        case 'array': s = 'List<' + ty(ir.item, false) + '>'; break; case 'object': s = ir.name; break; default: s = 'JsonElement';
      }
      return (ir.nullable || opt) ? s + '?' : s;
    }
    var out = [], needJson = false;
    rootFirst(p.decls, p.rootName).forEach(function (d) {
      var ids = dedupe(d.fields.map(function (f) { var s = TK.names.camel(f.key); if (/^[0-9]/.test(s)) s = 'f' + s; return KT_KW.indexOf(s) >= 0 ? '`' + s + '`' : s; }));
      out.push((o.serial ? '@Serializable\n' : '') + 'data class ' + d.name + '(\n' + d.fields.map(function (f, i) {
        var tt = ty(f.ir, f.optional); if (/JsonElement/.test(tt)) needJson = true;
        var an = o.serial && ids[i].replace(/`/g, '') !== f.key ? '@SerialName("' + f.key + '") ' : '';
        return '    ' + an + 'val ' + ids[i] + ': ' + tt + (/\?$/.test(tt) && (f.optional || true) ? ' = null' : '');
      }).join(',\n') + '\n)');
    });
    var head = o.serial ? 'import kotlinx.serialization.Serializable\n' + (/@SerialName/.test(out.join('')) ? 'import kotlinx.serialization.SerialName\n' : '') + (needJson ? 'import kotlinx.serialization.json.JsonElement\n' : '') + '\n' : '';
    return head + out.join('\n\n') + '\n';
  };

  /* ───────── Swift ───────── */
  var SW_KW = 'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows return static struct subscript super switch throws typealias var break case continue default defer do else fallthrough for guard if in repeat where while as catch false is nil self Self throw true try Any Type'.split(' ');
  G.swift = function (p, o) {
    var needAny = false;
    function ty(ir, opt) {
      var s;
      if (ir.mixed) { s = 'JSONValue'; needAny = true; }
      else switch (ir.t) {
        case 'string': s = 'String'; break; case 'int': s = 'Int'; break; case 'float': s = 'Double'; break; case 'bool': s = 'Bool'; break;
        case 'array': s = '[' + ty(ir.item, false) + ']'; break; case 'object': s = ir.name; break; default: s = 'JSONValue'; needAny = true;
      }
      return (ir.nullable || opt) ? s + '?' : s;
    }
    var out = [];
    rootFirst(p.decls, p.rootName).forEach(function (d) {
      var ids = dedupe(d.fields.map(function (f) { var s = TK.names.camel(f.key); if (/^[0-9]/.test(s)) s = 'f' + s; return SW_KW.indexOf(s) >= 0 ? '`' + s + '`' : s; }));
      var needKeys = d.fields.some(function (f, i) { return ids[i].replace(/`/g, '') !== f.key; });
      var body = d.fields.map(function (f, i) { return '    ' + (o.letvar === 'var' ? 'var' : 'let') + ' ' + ids[i] + ': ' + ty(f.ir, f.optional); }).join('\n');
      if (needKeys) body += '\n\n    enum CodingKeys: String, CodingKey {\n' + d.fields.map(function (f, i) { var id = ids[i].replace(/`/g, ''); return '        case ' + ids[i] + (id !== f.key ? ' = "' + f.key + '"' : ''); }).join('\n') + '\n    }';
      out.push('struct ' + d.name + ': Codable' + (o.hashable ? ', Hashable' : '') + ' {\n' + body + '\n}');
    });
    var helper = needAny ? '\n\n// 타입이 일정하지 않은 값을 담는 보조 타입 / helper for dynamic values\nenum JSONValue: Codable, Hashable {\n    case string(String), number(Double), bool(Bool), array([JSONValue]), object([String: JSONValue]), null\n    init(from decoder: Decoder) throws {\n        let c = try decoder.singleValueContainer()\n        if c.decodeNil() { self = .null }\n        else if let v = try? c.decode(Bool.self) { self = .bool(v) }\n        else if let v = try? c.decode(Double.self) { self = .number(v) }\n        else if let v = try? c.decode(String.self) { self = .string(v) }\n        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }\n        else { self = .object(try c.decode([String: JSONValue].self)) }\n    }\n    func encode(to encoder: Encoder) throws {\n        var c = encoder.singleValueContainer()\n        switch self {\n        case .string(let v): try c.encode(v)\n        case .number(let v): try c.encode(v)\n        case .bool(let v): try c.encode(v)\n        case .array(let v): try c.encode(v)\n        case .object(let v): try c.encode(v)\n        case .null: try c.encodeNil()\n        }\n    }\n}' : '';
    return 'import Foundation\n\n' + out.join('\n\n') + helper + '\n';
  };
})(typeof window !== 'undefined' ? window : globalThis);
