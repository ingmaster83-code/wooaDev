/* WooaDev Tool Kit — GraphQL 파서·프린터·스키마 모델 (SDL 과 실행 문서) */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var G = TK.graphql = TK.graphql || {};
  var t = function (a, b) { return TK.t(a, b); };

  /* ---------- 렉서 ---------- */
  function lex(src) {
    var toks = [], i = 0, line = 1, col = 1, n = src.length, m;
    function err(msg, ln, cl) { var e = new Error(msg + ' (' + t('줄 ', 'line ') + ln + t(', 열 ', ', col ') + cl + ')'); e.line = ln; e.col = cl; throw e; }
    function adv(k) { for (var j = 0; j < k; j++) { if (src.charCodeAt(i) === 10) { line++; col = 1; } else col++; i++; } }
    while (i < n) {
      var c = src.charAt(i), ln = line, cl = col;
      if (c === ' ' || c === '\t' || c === ',' || c === '\n' || c === '\r' || c === '﻿') { adv(1); continue; }
      if (c === '#') { while (i < n && src.charAt(i) !== '\n') adv(1); continue; }
      if (c === '.' && src.substr(i, 3) === '...') { toks.push({ k: 'p', v: '...', line: ln, col: cl, pos: i }); adv(3); continue; }
      if ('!$&():=@[]{|}'.indexOf(c) >= 0) { toks.push({ k: 'p', v: c, line: ln, col: cl, pos: i }); adv(1); continue; }
      if (src.substr(i, 3) === '"""') {
        var j = i + 3, out = ''; while (j < n && src.substr(j, 3) !== '"""') { if (src.substr(j, 4) === '\\"""') { out += '"""'; j += 4; } else { out += src.charAt(j); j++; } }
        if (j >= n) err(t('블록 문자열이 닫히지 않았습니다', 'Unterminated block string'), ln, cl);
        var lines = out.replace(/\r\n?/g, '\n').split('\n'), common = Infinity; lines.slice(1).forEach(function (l) { if (l.trim()) common = Math.min(common, l.match(/^[ \t]*/)[0].length); });
        if (isFinite(common)) lines = lines.map(function (l, ix) { return ix ? l.slice(common) : l; });
        while (lines.length && !lines[0].trim()) lines.shift(); while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
        toks.push({ k: 's', v: lines.join('\n'), block: true, line: ln, col: cl, pos: i }); adv(j + 3 - i); continue;
      }
      if (c === '"') {
        var p = i + 1, s = '';
        while (p < n && src.charAt(p) !== '"') { var ch = src.charAt(p); if (ch === '\n') err(t('문자열이 줄 끝에서 닫히지 않았습니다', 'Unterminated string'), ln, cl); if (ch === '\\') { var nx = src.charAt(p + 1); var map = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' }; if (nx === 'u') { s += String.fromCharCode(parseInt(src.substr(p + 2, 4), 16)); p += 6; continue; } if (map[nx] === undefined) err(t('알 수 없는 이스케이프 \\' + nx, 'Unknown escape \\' + nx), line, col + (p - i)); s += map[nx]; p += 2; continue; } s += ch; p++; }
        if (p >= n) err(t('문자열이 닫히지 않았습니다', 'Unterminated string'), ln, cl);
        toks.push({ k: 's', v: s, line: ln, col: cl, pos: i }); adv(p + 1 - i); continue;
      }
      if ((m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i, i + 40)))) { if (/^[A-Za-z_.]/.test(src.charAt(i + m[0].length))) err(t('숫자 뒤에 올 수 없는 문자입니다', 'Invalid character after a number'), ln, cl); toks.push({ k: m[2] || m[3] ? 'f' : 'i', v: m[0], line: ln, col: cl, pos: i }); adv(m[0].length); continue; }
      if ((m = /^[_A-Za-z][_0-9A-Za-z]*/.exec(src.slice(i, i + 200)))) { toks.push({ k: 'n', v: m[0], line: ln, col: cl, pos: i }); adv(m[0].length); continue; }
      err(t('예상하지 못한 문자 "' + c + '"', 'Unexpected character "' + c + '"'), ln, cl);
    }
    toks.push({ k: 'eof', v: '<EOF>', line: line, col: col, pos: n });
    return toks;
  }

  /* ---------- 파서 ---------- */
  G.parse = function (src) {
    var toks = lex(String(src)), p = 0;
    function peek() { return toks[p]; }
    function fail(msg, tk) { tk = tk || toks[p]; var e = new Error(msg + ' (' + t('줄 ', 'line ') + tk.line + t(', 열 ', ', col ') + tk.col + ')'); e.line = tk.line; e.col = tk.col; throw e; }
    function isP(v) { return toks[p].k === 'p' && toks[p].v === v; }
    function isN(v) { return toks[p].k === 'n' && (v === undefined || toks[p].v === v); }
    function eatP(v) { if (!isP(v)) fail(t('"' + v + '" 가 필요합니다 (현재 ' + toks[p].v + ')', 'Expected "' + v + '" but found ' + toks[p].v)); p++; }
    function name() { if (!isN()) fail(t('이름이 필요합니다 (현재 ' + toks[p].v + ')', 'Expected a name but found ' + toks[p].v)); return toks[p++].v; }
    function desc() { if (toks[p].k === 's') { var d = toks[p++].v; return d; } return null; }
    function type() {
      var ty, tk = toks[p];
      if (isP('[')) { p++; var inner = type(); eatP(']'); ty = { k: 'list', of: inner, line: tk.line }; } else ty = { k: 'named', name: name(), line: tk.line };
      if (isP('!')) { p++; ty = { k: 'nonnull', of: ty, line: tk.line }; }
      return ty;
    }
    function value(isConst) {
      var tk = toks[p];
      if (isP('$')) { if (isConst) fail(t('여기서는 변수를 쓸 수 없습니다', 'Variables are not allowed here')); p++; return { k: 'var', name: name(), line: tk.line }; }
      if (tk.k === 'i') { p++; return { k: 'int', v: tk.v, line: tk.line }; }
      if (tk.k === 'f') { p++; return { k: 'float', v: tk.v, line: tk.line }; }
      if (tk.k === 's') { p++; return { k: 'string', v: tk.v, block: tk.block, line: tk.line }; }
      if (tk.k === 'n') { p++; if (tk.v === 'true' || tk.v === 'false') return { k: 'bool', v: tk.v === 'true', line: tk.line }; if (tk.v === 'null') return { k: 'null', line: tk.line }; return { k: 'enum', v: tk.v, line: tk.line }; }
      if (isP('[')) { p++; var items = []; while (!isP(']')) { if (toks[p].k === 'eof') fail(t('리스트가 닫히지 않았습니다', 'Unterminated list')); items.push(value(isConst)); } p++; return { k: 'list', items: items, line: tk.line }; }
      if (isP('{')) { p++; var fields = []; while (!isP('}')) { if (toks[p].k === 'eof') fail(t('객체가 닫히지 않았습니다', 'Unterminated object')); var fn = name(); eatP(':'); fields.push({ name: fn, value: value(isConst) }); } p++; return { k: 'object', fields: fields, line: tk.line }; }
      fail(t('값이 필요합니다 (현재 ' + tk.v + ')', 'Expected a value but found ' + tk.v));
    }
    function directives(isConst) { var ds = []; while (isP('@')) { var tk = toks[p]; p++; var nm = name(), args = []; if (isP('(')) { p++; while (!isP(')')) { var an = name(); eatP(':'); args.push({ name: an, value: value(isConst) }); } p++; } ds.push({ name: nm, args: args, line: tk.line }); } return ds; }
    function argsDef() { var args = []; if (isP('(')) { p++; while (!isP(')')) { if (toks[p].k === 'eof') fail(t('인자 정의가 닫히지 않았습니다', 'Unterminated argument list')); var d = desc(), tk = toks[p], an = name(); eatP(':'); var ty = type(), def = null; if (isP('=')) { p++; def = value(true); } args.push({ name: an, type: ty, default: def, description: d, directives: directives(true), line: tk.line }); } p++; } return args; }
    function fieldsDef() { var fs = []; if (isP('{')) { p++; while (!isP('}')) { if (toks[p].k === 'eof') fail(t('필드 목록이 닫히지 않았습니다', 'Unterminated field list')); var d = desc(), tk = toks[p], fn = name(), args = argsDef(); eatP(':'); var ty = type(); fs.push({ name: fn, args: args, type: ty, description: d, directives: directives(true), line: tk.line }); } p++; } return fs; }
    function inputFields() { var fs = []; if (isP('{')) { p++; while (!isP('}')) { if (toks[p].k === 'eof') fail(t('입력 필드 목록이 닫히지 않았습니다', 'Unterminated input field list')); var d = desc(), tk = toks[p], fn = name(); eatP(':'); var ty = type(), def = null; if (isP('=')) { p++; def = value(true); } fs.push({ name: fn, type: ty, default: def, description: d, directives: directives(true), line: tk.line }); } p++; } return fs; }
    function implementsList() { var is = []; if (isN('implements')) { p++; if (isP('&')) p++; is.push(name()); while (isP('&')) { p++; is.push(name()); } } return is; }
    function selectionSet() {
      var tk = toks[p]; eatP('{'); var sels = [];
      while (!isP('}')) {
        if (toks[p].k === 'eof') fail(t('선택 집합이 닫히지 않았습니다', 'Unterminated selection set'));
        var st = toks[p];
        if (isP('...')) { p++; if (isN() && toks[p].v !== 'on') { var fnm = name(); sels.push({ k: 'spread', name: fnm, directives: directives(false), line: st.line }); } else { var tc = null; if (isN('on')) { p++; tc = name(); } var ds = directives(false); sels.push({ k: 'inline', typeCondition: tc, directives: ds, selections: selectionSet(), line: st.line }); } }
        else { var first = name(), alias = null, fname = first; if (isP(':')) { p++; alias = first; fname = name(); } var args = []; if (isP('(')) { p++; while (!isP(')')) { if (toks[p].k === 'eof') fail(t('인자가 닫히지 않았습니다', 'Unterminated arguments')); var an = name(); eatP(':'); args.push({ name: an, value: value(false) }); } p++; } var dd = directives(false), sub = isP('{') ? selectionSet() : null; sels.push({ k: 'field', alias: alias, name: fname, args: args, directives: dd, selections: sub, line: st.line }); }
      }
      p++; if (!sels.length) fail(t('선택 집합이 비어 있습니다', 'Empty selection set'), tk); return sels;
    }
    function variableDefs() { var vs = []; if (isP('(')) { p++; while (!isP(')')) { if (toks[p].k === 'eof') fail(t('변수 정의가 닫히지 않았습니다', 'Unterminated variable definitions')); var tk = toks[p]; eatP('$'); var vn = name(); eatP(':'); var ty = type(), def = null; if (isP('=')) { p++; def = value(true); } vs.push({ name: vn, type: ty, default: def, directives: directives(true), line: tk.line }); } p++; } return vs; }
    var defs = [];
    while (toks[p].k !== 'eof') {
      var tk0 = toks[p], d0 = desc(), ext = false;
      if (isP('{')) { defs.push({ k: 'operation', op: 'query', name: null, vars: [], directives: [], selections: selectionSet(), line: tk0.line, anon: true }); continue; }
      if (!isN()) fail(t('정의가 필요합니다 (현재 ' + toks[p].v + ')', 'Expected a definition but found ' + toks[p].v));
      var kw = toks[p].v;
      if (kw === 'extend') { ext = true; p++; kw = toks[p].v; }
      var line0 = toks[p].line;
      if (kw === 'query' || kw === 'mutation' || kw === 'subscription') { p++; var oname = isN() ? name() : null; var vars = variableDefs(), ds1 = directives(false); defs.push({ k: 'operation', op: kw, name: oname, vars: vars, directives: ds1, selections: selectionSet(), line: line0 }); }
      else if (kw === 'fragment') { p++; var fnm2 = name(); if (!isN('on')) fail(t('fragment 에는 on 타입이 필요합니다', 'A fragment needs "on Type"')); p++; var tc2 = name(), ds2 = directives(false); defs.push({ k: 'fragment', name: fnm2, on: tc2, directives: ds2, selections: selectionSet(), line: line0 }); }
      else if (kw === 'schema') { p++; var ds3 = directives(true), ops = []; eatP('{'); while (!isP('}')) { var ot = name(); eatP(':'); ops.push({ op: ot, type: name() }); } p++; defs.push({ k: 'schema', ops: ops, directives: ds3, extend: ext, description: d0, line: line0 }); }
      else if (kw === 'scalar') { p++; var sn = name(); defs.push({ k: 'scalar', name: sn, directives: directives(true), extend: ext, description: d0, line: line0 }); }
      else if (kw === 'type' || kw === 'interface') { p++; var tn = name(), impl = implementsList(), ds4 = directives(true); defs.push({ k: kw, name: tn, interfaces: impl, directives: ds4, fields: fieldsDef(), extend: ext, description: d0, line: line0 }); }
      else if (kw === 'union') { p++; var un = name(), ds5 = directives(true), mem = []; if (isP('=')) { p++; if (isP('|')) p++; mem.push(name()); while (isP('|')) { p++; mem.push(name()); } } defs.push({ k: 'union', name: un, directives: ds5, members: mem, extend: ext, description: d0, line: line0 }); }
      else if (kw === 'enum') { p++; var en = name(), ds6 = directives(true), vals = []; if (isP('{')) { p++; while (!isP('}')) { if (toks[p].k === 'eof') fail(t('enum 이 닫히지 않았습니다', 'Unterminated enum')); var vd = desc(), vt = toks[p]; vals.push({ name: name(), description: vd, directives: directives(true), line: vt.line }); } p++; } defs.push({ k: 'enum', name: en, directives: ds6, values: vals, extend: ext, description: d0, line: line0 }); }
      else if (kw === 'input') { p++; var inn = name(), ds7 = directives(true); defs.push({ k: 'input', name: inn, directives: ds7, fields: inputFields(), extend: ext, description: d0, line: line0 }); }
      else if (kw === 'directive') { p++; eatP('@'); var dn = name(), dargs = argsDef(), rep = false; if (isN('repeatable')) { rep = true; p++; } if (!isN('on')) fail(t('directive 에는 on 위치가 필요합니다', 'A directive needs "on LOCATIONS"')); p++; if (isP('|')) p++; var locs = [name()]; while (isP('|')) { p++; locs.push(name()); } defs.push({ k: 'directive', name: dn, args: dargs, repeatable: rep, locations: locs, description: d0, line: line0 }); }
      else fail(t('알 수 없는 키워드 "' + kw + '"', 'Unknown keyword "' + kw + '"'));
    }
    return { defs: defs };
  };

  /* ---------- 프린터 ---------- */
  G.typeStr = function (ty) { return ty.k === 'named' ? ty.name : ty.k === 'list' ? '[' + G.typeStr(ty.of) + ']' : G.typeStr(ty.of) + '!'; };
  G.baseName = function (ty) { while (ty.k !== 'named') ty = ty.of; return ty.name; };
  function valStr(v) {
    switch (v.k) { case 'var': return '$' + v.name; case 'int': case 'float': return v.v; case 'string': return JSON.stringify(v.v); case 'bool': return String(v.v); case 'null': return 'null'; case 'enum': return v.v; case 'list': return '[' + v.items.map(valStr).join(', ') + ']'; case 'object': return '{' + v.fields.map(function (f) { return f.name + ': ' + valStr(f.value); }).join(', ') + '}'; }
    return '';
  }
  G.valStr = valStr;
  function dirStr(ds) { return ds && ds.length ? ' ' + ds.map(function (d) { return '@' + d.name + (d.args.length ? '(' + d.args.map(function (a) { return a.name + ': ' + valStr(a.value); }).join(', ') + ')' : ''); }).join(' ') : ''; }
  function descStr(d, ind) { if (d === null || d === undefined) return ''; if (d.indexOf('\n') >= 0 || d.length > 70) return ind + '"""\n' + d.split('\n').map(function (l) { return ind + l; }).join('\n') + '\n' + ind + '"""\n'; return ind + '"""' + d + '"""\n'; }
  function argsStr(args) { if (!args.length) return ''; if (args.some(function (a) { return a.description; })) return '(\n' + args.map(function (a) { return descStr(a.description, '    ') + '    ' + a.name + ': ' + G.typeStr(a.type) + (a.default ? ' = ' + valStr(a.default) : '') + dirStr(a.directives); }).join('\n') + '\n  )'; return '(' + args.map(function (a) { return a.name + ': ' + G.typeStr(a.type) + (a.default ? ' = ' + valStr(a.default) : '') + dirStr(a.directives); }).join(', ') + ')'; }
  function selStr(sels, ind) {
    var pad = ind + '  ';
    return '{\n' + sels.map(function (s) {
      if (s.k === 'field') return pad + (s.alias ? s.alias + ': ' : '') + s.name + (s.args.length ? '(' + s.args.map(function (a) { return a.name + ': ' + valStr(a.value); }).join(', ') + ')' : '') + dirStr(s.directives) + (s.selections ? ' ' + selStr(s.selections, pad) : '');
      if (s.k === 'spread') return pad + '...' + s.name + dirStr(s.directives);
      return pad + '...' + (s.typeCondition ? ' on ' + s.typeCondition : '') + dirStr(s.directives) + ' ' + selStr(s.selections, pad);
    }).join('\n') + '\n' + ind + '}';
  }
  G.print = function (doc) {
    return doc.defs.map(function (d) {
      var ex = d.extend ? 'extend ' : '', head = descStr(d.description, '');
      switch (d.k) {
        case 'operation': return d.anon ? selStr(d.selections, '') : d.op + (d.name ? ' ' + d.name : '') + (d.vars.length ? '(' + d.vars.map(function (v) { return '$' + v.name + ': ' + G.typeStr(v.type) + (v.default ? ' = ' + valStr(v.default) : ''); }).join(', ') + ')' : '') + dirStr(d.directives) + ' ' + selStr(d.selections, '');
        case 'fragment': return 'fragment ' + d.name + ' on ' + d.on + dirStr(d.directives) + ' ' + selStr(d.selections, '');
        case 'schema': return head + ex + 'schema' + dirStr(d.directives) + ' {\n' + d.ops.map(function (o) { return '  ' + o.op + ': ' + o.type; }).join('\n') + '\n}';
        case 'scalar': return head + ex + 'scalar ' + d.name + dirStr(d.directives);
        case 'type': case 'interface': return head + ex + d.k + ' ' + d.name + (d.interfaces.length ? ' implements ' + d.interfaces.join(' & ') : '') + dirStr(d.directives) + (d.fields.length ? ' {\n' + d.fields.map(function (f) { return descStr(f.description, '  ') + '  ' + f.name + argsStr(f.args) + ': ' + G.typeStr(f.type) + dirStr(f.directives); }).join('\n') + '\n}' : '');
        case 'union': return head + ex + 'union ' + d.name + dirStr(d.directives) + (d.members.length ? ' = ' + d.members.join(' | ') : '');
        case 'enum': return head + ex + 'enum ' + d.name + dirStr(d.directives) + (d.values.length ? ' {\n' + d.values.map(function (v) { return descStr(v.description, '  ') + '  ' + v.name + dirStr(v.directives); }).join('\n') + '\n}' : '');
        case 'input': return head + ex + 'input ' + d.name + dirStr(d.directives) + (d.fields.length ? ' {\n' + d.fields.map(function (f) { return descStr(f.description, '  ') + '  ' + f.name + ': ' + G.typeStr(f.type) + (f.default ? ' = ' + valStr(f.default) : '') + dirStr(f.directives); }).join('\n') + '\n}' : '');
        case 'directive': return head + 'directive @' + d.name + argsStr(d.args) + (d.repeatable ? ' repeatable' : '') + ' on ' + d.locations.join(' | ');
      }
      return '';
    }).join('\n\n') + '\n';
  };

  /* ---------- 스키마 모델 ---------- */
  var SCALARS = ['Int', 'Float', 'String', 'Boolean', 'ID'];
  G.builtinDirectives = { include: { args: { if: 'Boolean!' }, locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'] }, skip: { args: { if: 'Boolean!' }, locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'] }, deprecated: { args: { reason: 'String' }, locations: ['FIELD_DEFINITION', 'ARGUMENT_DEFINITION', 'INPUT_FIELD_DEFINITION', 'ENUM_VALUE'] }, specifiedBy: { args: { url: 'String!' }, locations: ['SCALAR'] }, oneOf: { args: {}, locations: ['INPUT_OBJECT'] } };
  /** 파싱된 SDL 문서 → 모델 {types, directives, roots, errors} (extend 병합, 중복 정의 오류) */
  G.schema = function (doc) {
    var types = {}, dirs = {}, errors = [], roots = { query: null, mutation: null, subscription: null }, explicit = false;
    SCALARS.forEach(function (s) { types[s] = { k: 'scalar', name: s, builtin: true, directives: [], line: 0 }; });
    function err(msg, line) { errors.push({ msg: msg, line: line || 0 }); }
    doc.defs.forEach(function (d) {
      if (d.k === 'operation' || d.k === 'fragment') { err(t('스키마 문서에 실행 정의(' + (d.name || d.op) + ')가 섞여 있습니다', 'The schema contains an executable definition (' + (d.name || d.op) + ')'), d.line); return; }
      if (d.k === 'schema') { explicit = true; d.ops.forEach(function (o) { roots[o.op] = o.type; }); return; }
      if (d.k === 'directive') { if (dirs[d.name] && !G.builtinDirectives[d.name]) err(t('지시어 @' + d.name + ' 가 중복 정의되었습니다', 'Directive @' + d.name + ' is defined twice'), d.line); dirs[d.name] = d; return; }
      var ex = types[d.name];
      if (d.extend) { if (!ex) { err(t('확장하려는 타입 ' + d.name + ' 이(가) 정의되지 않았습니다', 'Cannot extend undefined type ' + d.name), d.line); return; } if (ex.k !== d.k) { err(t(d.name + ' 의 종류가 다릅니다 (' + ex.k + ' ≠ ' + d.k + ')', d.name + ' is a ' + ex.k + ', not a ' + d.k), d.line); return; } ['fields', 'values', 'members', 'interfaces'].forEach(function (key) { if (d[key]) ex[key] = (ex[key] || []).concat(d[key]); }); ex.directives = (ex.directives || []).concat(d.directives || []); return; }
      if (ex && !ex.builtin) { err(t('타입 ' + d.name + ' 이(가) 중복 정의되었습니다 (줄 ' + ex.line + ')', 'Type ' + d.name + ' is defined twice (line ' + ex.line + ')'), d.line); return; }
      if (ex && ex.builtin) { err(t('내장 스칼라 ' + d.name + ' 은(는) 다시 정의할 수 없습니다', 'Built-in scalar ' + d.name + ' cannot be redefined'), d.line); return; }
      types[d.name] = JSON.parse(JSON.stringify(d));
    });
    if (!explicit) { ['Query', 'Mutation', 'Subscription'].forEach(function (n) { if (types[n] && types[n].k === 'type') roots[n.toLowerCase()] = n; }); }
    return { types: types, directives: dirs, roots: roots, errors: errors, explicit: explicit };
  };
  G.isInput = function (S, ty) { var b = S.types[G.baseName(ty)]; return b && (b.k === 'scalar' || b.k === 'enum' || b.k === 'input'); };
  G.isOutput = function (S, ty) { var b = S.types[G.baseName(ty)]; return b && (b.k === 'scalar' || b.k === 'enum' || b.k === 'type' || b.k === 'interface' || b.k === 'union'); };
})(typeof window !== 'undefined' ? window : globalThis);
