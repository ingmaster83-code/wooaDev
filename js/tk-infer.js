/* WooaDev Tool Kit — JSON 샘플로 타입 구조 추론 + 이름 변환 (코드 생성기·스키마 생성기 공용) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};

  /* ── 이름 변환 ── */
  var N = TK.names = {};
  N.words = function (s) {
    s = String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    return s.split(/[^A-Za-z0-9À-￿]+/).filter(Boolean);
  };
  N.pascal = function (s) { return N.words(s).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join('') || 'Item'; };
  N.pascalKeep = function (s) { return N.words(s).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('') || 'Item'; };
  N.camel = function (s) { var p = N.pascal(s); return p.charAt(0).toLowerCase() + p.slice(1); };
  N.snake = function (s) { return N.words(s).map(function (w) { return w.toLowerCase(); }).join('_') || 'field'; };
  N.singular = function (s) {
    if (/ies$/i.test(s) && s.length > 3) return s.replace(/ies$/i, 'y');
    if (/(ss|us|is)$/i.test(s)) return s;
    if (/(sses|xes|ches|shes)$/i.test(s)) return s.replace(/es$/i, '');
    if (/s$/i.test(s) && s.length > 2) return s.replace(/s$/i, '');
    return s;
  };
  N.isIdent = function (s) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s); };
  N.safeIdent = function (s, fallback) {
    var r = String(s).replace(/[^A-Za-z0-9_]/g, '_');
    if (!r || /^[0-9]/.test(r)) r = (fallback || 'f') + '_' + r;
    return r;
  };

  /* ── 문자열 포맷 감지 ── */
  var FMT = [
    ['date-time', /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?$/],
    ['date', /^\d{4}-\d{2}-\d{2}$/],
    ['time', /^\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:?\d{2})?$/],
    ['email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/],
    ['uuid', /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/],
    ['uri', /^https?:\/\/[^\s]+$/],
    ['ipv4', /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/]
  ];
  TK.detectFormat = function (s) {
    for (var i = 0; i < FMT.length; i++) if (FMT[i][1].test(s)) return FMT[i][0];
    return null;
  };

  /* ── 모양(shape) 누적 ── */
  function newShape() { return { n: 0, nulls: 0, bool: 0, int: 0, float: 0, str: 0, fmts: {}, arr: null, arrN: 0, emptyArr: 0, obj: null, objN: 0 }; }
  TK.shape = {
    make: newShape,
    add: function add(sh, v) {
      sh.n++;
      if (v === null || v === undefined) { sh.nulls++; return; }
      var ty = typeof v;
      if (ty === 'boolean') sh.bool++;
      else if (ty === 'number') { if (Number.isInteger(v)) sh.int++; else sh.float++; }
      else if (ty === 'string') {
        sh.str++;
        var f = TK.detectFormat(v) || '-';
        sh.fmts[f] = (sh.fmts[f] || 0) + 1;
      } else if (Array.isArray(v)) {
        sh.arrN++;
        if (!v.length) sh.emptyArr++;
        if (!sh.arr) sh.arr = newShape();
        v.forEach(function (x) { add(sh.arr, x); });
      } else if (ty === 'object') {
        sh.objN++;
        if (!sh.obj) sh.obj = { keys: [], map: Object.create(null) };
        Object.keys(v).forEach(function (k) {
          var f = sh.obj.map[k];
          if (!f) { f = sh.obj.map[k] = { shape: newShape(), count: 0 }; sh.obj.keys.push(k); }
          f.count++;
          add(f.shape, v[k]);
        });
      }
    },
    /**
     * IR 로 확정. {t:'string'|'int'|'float'|'bool'|'any'|'array'|'object', nullable, fmt, item, fields:[{key,ir,optional}], mixed}
     * opts.mergeNumbers: int+float → float (기본 true)
     */
    resolve: function resolve(sh) {
      var kinds = [];
      if (sh.bool) kinds.push('bool');
      if (sh.int && sh.float) kinds.push('float'); else if (sh.float) kinds.push('float'); else if (sh.int) kinds.push('int');
      if (sh.str) kinds.push('string');
      if (sh.arrN) kinds.push('array');
      if (sh.objN) kinds.push('object');
      var ir = { t: 'any', nullable: sh.nulls > 0, mixed: false, samples: sh.n };
      if (kinds.length === 1) {
        ir.t = kinds[0];
        if (ir.t === 'string') {
          var fk = Object.keys(sh.fmts);
          if (fk.length === 1 && fk[0] !== '-') ir.fmt = fk[0];
        } else if (ir.t === 'array') {
          ir.item = sh.arr && sh.arr.n ? resolve(sh.arr) : { t: 'any', nullable: false, mixed: false, samples: 0 };
        } else if (ir.t === 'object') {
          ir.fields = sh.obj.keys.map(function (k) {
            var f = sh.obj.map[k];
            return { key: k, ir: resolve(f.shape), optional: f.count < sh.objN };
          });
        }
      } else if (kinds.length > 1) { ir.mixed = true; ir.kinds = kinds; }
      return ir;
    }
  };

  /** 입력 텍스트(JSON 하나 또는 공백/줄로 이어진 여러 개)에서 샘플 목록을 만든다. 최상위가 배열이면 각 요소를 샘플로. */
  TK.samplesFrom = function (text, opts) {
    opts = opts || {};
    var r = TK.json.parse(text, { multi: true });
    var vals = r.values;
    if (opts.spreadArray !== false && vals.length === 1 && Array.isArray(vals[0])) return { samples: vals[0], root: 'array', dups: r.dups };
    return { samples: vals, root: 'value', dups: r.dups };
  };

  TK.inferIR = function (text, opts) {
    var s = TK.samplesFrom(text, opts);
    var sh = newShape();
    s.samples.forEach(function (v) { TK.shape.add(sh, v); });
    return { ir: TK.shape.resolve(sh), isArray: s.root === 'array', count: s.samples.length };
  };

  /**
   * IR 의 객체들에 이름을 붙여 선언 목록을 만든다. 같은 구조는 재사용(opts.dedupe).
   * 반환: { root: typeRef, decls: [{name, fields:[{key, ir, optional}] }] }  (자식이 먼저)
   */
  TK.nameDecls = function (ir, rootName, opts) {
    opts = opts || {};
    var decls = [], used = Object.create(null), bySig = Object.create(null);
    function sig(o) {
      return o.fields.map(function (f) { return f.key + ':' + typeSig(f.ir) + (f.optional ? '?' : ''); }).join('|');
    }
    function typeSig(x) {
      if (x.t === 'object') return '{' + sig(x) + '}';
      if (x.t === 'array') return '[' + typeSig(x.item) + ']';
      return x.t + (x.nullable ? '?' : '');
    }
    function unique(base) {
      var nm = base, i = 2;
      while (used[nm]) nm = base + (i++);
      used[nm] = 1; return nm;
    }
    function walk(x, hint) {
      if (x.t === 'array') { var itemHint = N.singular(hint); if (itemHint === hint) itemHint = hint + 'Item'; return { t: 'array', nullable: x.nullable, item: walk(x.item, itemHint) }; }
      if (x.t === 'object') {
        var sg = sig(x);
        if (opts.dedupe !== false && bySig[sg]) return { t: 'object', nullable: x.nullable, name: bySig[sg] };
        var nm = unique(N.pascalKeep(hint));
        if (opts.dedupe !== false) bySig[sg] = nm;
        var decl = { name: nm, fields: [] };
        var pos = decls.length;
        decls.push(decl);
        decl.fields = x.fields.map(function (f) { return { key: f.key, ir: walk(f.ir, f.key), optional: f.optional }; });
        // 자식이 먼저 오도록 decl 을 뒤로 이동
        decls.splice(pos, 1); decls.push(decl);
        return { t: 'object', nullable: x.nullable, name: nm };
      }
      return x;
    }
    var root = walk(ir, rootName || 'Root');
    return { root: root, decls: decls };
  };
})(typeof window !== 'undefined' ? window : globalThis);
