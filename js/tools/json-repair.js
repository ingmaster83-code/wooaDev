TK.tool('json-repair', {
  inputs: [{ id: 'in', label: ['깨진 JSON 입력', 'Broken JSON input'], rows: 12, placeholder: ['복구할 JSON(또는 JSON 비슷한 텍스트)을 붙여넣으세요', 'Paste the broken JSON (or JSON-like text)'],
    sample: "{\n  // user info\n  name: 'Wooa',\n  \"age\": 30,\n  tags: ['a', 'b',],\n  active: True,\n  \"memo\": \"line1\nline2\",\n  \"nested\": {\"x\": 1, \"y\": [1, 2\n" }],
  options: [{ id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['tab', 'Tab'], ['0', ['압축', 'Minified']]], default: '2' }],
  outputs: [
    { id: 'out', label: ['복구된 JSON', 'Repaired JSON'], kind: 'code', ext: 'json', mime: 'application/json' },
    { id: 'fixes', label: ['수정 내역', 'What was fixed'], kind: 'table' }
  ],
  swap: { from: 'out', to: 'in' },
  run: function (v, o, t) {
    var s = String(v.in), n, i = 0, fx = [], order = [];
    function fix(ko, en) { var k = ko; if (!fx[k]) { fx[k] = { c: 0, en: en }; order.push(k); } fx[k].c++; }
    // 1) 마크다운 코드펜스·앞뒤 설명 제거
    var fence = /```[a-zA-Z]*\s*([\s\S]*?)```/.exec(s);
    if (fence) { s = fence[1]; fix('마크다운 코드 블록(```) 제거', 'Removed markdown code fence (```)'); }
    var first = s.search(/[\[{]/);
    if (first < 0) {
      if (/^\s*$/.test(s)) throw new Error(t('입력이 비어 있습니다', 'Input is empty'));
      first = s.search(/\S/);
    } else if (/\S/.test(s.slice(0, first))) { s = s.slice(first); fix('JSON 앞의 설명 텍스트 제거', 'Removed text before the JSON'); }
    n = s.length;

    function ws() {
      while (i < n) {
        var c = s[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '﻿' || c === ' ') i++;
        else if (c === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; fix('주석 제거', 'Removed comments'); }
        else if (c === '/' && s[i + 1] === '*') { var e = s.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; fix('주석 제거', 'Removed comments'); }
        else if (c === '#') { while (i < n && s[i] !== '\n') i++; fix('주석 제거', 'Removed comments'); }
        else break;
      }
    }
    var QUOTES = { '"': '"', "'": "'", '“': '”', '‘': '’', '`': '`' };
    function str() {
      var open = s[i], close = QUOTES[open], out = ''; i++;
      if (open !== '"') fix(open === "'" ? '작은따옴표 문자열을 큰따옴표로 변환' : '따옴표 종류를 큰따옴표로 통일', open === "'" ? 'Converted single-quoted strings to double quotes' : 'Normalized quote characters to double quotes');
      while (i < n) {
        var c = s[i];
        if (c === close || (open === '“' && c === '"') ) { i++; return out; }
        if (c === '\\') {
          var e = s[i + 1];
          if (e === undefined) { i++; break; }
          if ('"\\/bfnrt'.indexOf(e) >= 0) { out += c + e; i += 2; }
          else if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(s.substr(i + 2, 4))) { out += s.substr(i, 6); i += 6; }
          else if (e === "'") { out += "'"; i += 2; fix('불필요한 이스케이프 정리', 'Cleaned up invalid escapes'); }
          else { out += e === '\n' ? '' : e; i += 2; fix('불필요한 이스케이프 정리', 'Cleaned up invalid escapes'); }
          continue;
        }
        if (c === '\n') { out += '\\n'; i++; fix('문자열 안의 줄바꿈을 \\n 으로 변환', 'Escaped raw newlines inside strings'); continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\t') { out += '\\t'; i++; fix('문자열 안의 탭을 \\t 로 변환', 'Escaped raw tabs inside strings'); continue; }
        if (c === '"') out += '\\"'; else out += c;
        i++;
      }
      fix('닫히지 않은 문자열을 닫음', 'Closed an unterminated string');
      return out;
    }
    function bare() {
      var m = /^[^\s,:\]\}\[\{"'`]+(?:[ \t]+[^\s,:\]\}\[\{"'`]+)*/.exec(s.slice(i));
      var w = m ? m[0].trim() : s[i++];
      i += m ? m[0].length : 0;
      return w;
    }
    var value;
    value = function () {
      ws();
      if (i >= n) { fix('값이 없는 항목을 null 로 채움', 'Filled missing values with null'); return { k: 'null' }; }
      var c = s[i];
      if (c === '{') return obj();
      if (c === '[') return arr();
      if (c in QUOTES) return { k: 'str', v: str() };
      if (c === ',' || c === '}' || c === ']') { fix('값이 없는 항목을 null 로 채움', 'Filled missing values with null'); return { k: 'null' }; }
      return word();
    };
    function word() {
      var rest = s.slice(i, i + 40), m;
      if ((m = /^(true|false|null)\b/.exec(rest))) { i += m[0].length; return { k: m[1] }; }
      if ((m = /^(True|TRUE)\b/.exec(rest))) { i += m[0].length; fix('Python/대문자 불리언을 JSON 형식으로 변환', 'Converted Python/uppercase literals'); return { k: 'true' }; }
      if ((m = /^(False|FALSE)\b/.exec(rest))) { i += m[0].length; fix('Python/대문자 불리언을 JSON 형식으로 변환', 'Converted Python/uppercase literals'); return { k: 'false' }; }
      if ((m = /^(None|NULL|Null|nil|undefined)\b/.exec(rest))) { i += m[0].length; fix('None/undefined 를 null 로 변환', 'Converted None/undefined to null'); return { k: 'null' }; }
      if ((m = /^[-+]?(?:NaN|Infinity)\b/.exec(rest))) { i += m[0].length; fix('NaN/Infinity 를 null 로 변환', 'Converted NaN/Infinity to null'); return { k: 'null' }; }
      if ((m = /^[-+]?0[xX][0-9a-fA-F]+/.exec(rest))) { i += m[0].length; fix('16진수를 10진수로 변환', 'Converted hex numbers to decimal'); return { k: 'num', v: String(parseInt(m[0], 16)) }; }
      if ((m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?![\w.])/.exec(rest))) {
        i += m[0].length;
        var num = m[0], fixed = num.replace(/^\+/, '').replace(/^(-?)\./, '$10.').replace(/\.(?=$|[eE])/, '').replace(/^(-?)0+(?=\d)/, '$1');
        if (fixed !== num) fix('숫자 표기를 JSON 형식으로 정리', 'Normalized number formatting');
        return { k: 'num', v: fixed };
      }
      var w = bare();
      if (!w) { i++; return { k: 'null' }; }
      fix('따옴표 없는 값을 문자열로 변환', 'Quoted bare words as strings');
      return { k: 'str', v: w.replace(/\\/g, '\\\\').replace(/"/g, '\\"') };
    }
    function key() {
      ws();
      var c = s[i];
      if (c in QUOTES) return str();
      var m = /^[^\s:,\{\}\[\]"'`]+/.exec(s.slice(i));
      if (!m) { i++; return ''; }
      i += m[0].length;
      fix('따옴표 없는 키에 큰따옴표 추가', 'Added quotes around unquoted keys');
      return m[0].replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }
    function obj() {
      i++; var items = [];
      while (true) {
        ws();
        if (i >= n) { fix('닫히지 않은 괄호를 닫음', 'Closed unclosed brackets'); break; }
        if (s[i] === '}') { i++; break; }
        if (s[i] === ',') { i++; fix('불필요한 쉼표 제거', 'Removed extra commas'); continue; }
        if (s[i] === ']') { i++; fix('짝이 맞지 않는 닫는 괄호 무시', 'Ignored a mismatched closing bracket'); continue; }
        var k = key(); ws();
        if (s[i] === ':' || s[i] === '=') { i++; } else fix('누락된 콜론(:) 추가', 'Added missing colons');
        var val = value();
        items.push([k, val]);
        ws();
        if (s[i] === ',') { i++; ws(); if (s[i] === '}') fix('후행 쉼표 제거', 'Removed trailing commas'); }
        else if (i < n && s[i] !== '}') fix('누락된 쉼표 추가', 'Added missing commas');
      }
      return { k: 'obj', v: items };
    }
    function arr() {
      i++; var items = [];
      while (true) {
        ws();
        if (i >= n) { fix('닫히지 않은 괄호를 닫음', 'Closed unclosed brackets'); break; }
        if (s[i] === ']') { i++; break; }
        if (s[i] === ',') { i++; fix('불필요한 쉼표 제거', 'Removed extra commas'); continue; }
        if (s[i] === '}') { i++; fix('짝이 맞지 않는 닫는 괄호 무시', 'Ignored a mismatched closing bracket'); continue; }
        items.push(value());
        ws();
        if (s[i] === ',') { i++; ws(); if (s[i] === ']') fix('후행 쉼표 제거', 'Removed trailing commas'); }
        else if (i < n && s[i] !== ']') fix('누락된 쉼표 추가', 'Added missing commas');
      }
      return { k: 'arr', v: items };
    }
    ws();
    var ast = value();
    ws();
    if (i < n) fix('JSON 뒤의 불필요한 텍스트 제거', 'Removed text after the JSON');

    // AST → 값 (숫자 원문 보존을 위해 직접 직렬화)
    var ind = o.indent === 'tab' ? '	' : Number(o.indent);
    function ser(a, lvl) {
      var pad = ind ? (typeof ind === 'string' ? ind.repeat(lvl + 1) : ' '.repeat(ind * (lvl + 1))) : '';
      var padEnd = ind ? (typeof ind === 'string' ? ind.repeat(lvl) : ' '.repeat(ind * lvl)) : '';
      var nl = ind ? '\n' : '', sep = ind ? ': ' : ':';
      if (a.k === 'obj') {
        // 중복 키는 뒤의 값을 사용
        var map = new Map(); a.v.forEach(function (kv) { map.set(kv[0], kv[1]); });
        if (map.size !== a.v.length) fix('중복 키는 마지막 값만 남김', 'Kept only the last value of duplicate keys');
        if (!map.size) return '{}';
        var parts = []; map.forEach(function (val, k) { parts.push(pad + '"' + k.replace(/\n/g, '\\n') + '"' + sep + ser(val, lvl + 1)); });
        return '{' + nl + parts.join(',' + nl) + nl + padEnd + '}';
      }
      if (a.k === 'arr') {
        if (!a.v.length) return '[]';
        return '[' + nl + a.v.map(function (x) { return pad + ser(x, lvl + 1); }).join(',' + nl) + nl + padEnd + ']';
      }
      if (a.k === 'str') return '"' + a.v + '"';
      if (a.k === 'num') return a.v;
      return a.k;
    }
    var out = ser(ast, 0);
    try { JSON.parse(out); } catch (e) { throw new Error(t('복구 결과가 여전히 올바른 JSON이 아닙니다: ', 'The repaired result is still not valid JSON: ') + e.message); }
    var rows = order.map(function (k) { return [t(k, fx[k].en), fx[k].c + t('회', '×')]; });
    return {
      _status: rows.length ? t('🔧 ' + rows.length + '종류의 문제를 고쳤습니다.', '🔧 Fixed ' + rows.length + ' kind(s) of problems.') : t('✅ 이미 올바른 JSON입니다. 고칠 것이 없습니다.', '✅ Already valid JSON — nothing to fix.'),
      out: out,
      fixes: rows.length ? { head: [['수정 내용', 'Fix'], ['횟수', 'Count']], rows: rows } : null
    };
  }
});
