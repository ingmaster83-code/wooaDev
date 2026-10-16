TK.tool('json-to-xml', {
  inputs: [{ id: 'in', label: ['JSON 입력', 'JSON input'], rows: 12, placeholder: ['변환할 JSON을 붙여넣으세요', 'Paste the JSON to convert'],
    sample: '{\n  "order": {\n    "@id": "A-1024",\n    "customer": "Kim & Co.",\n    "items": [\n      { "sku": "P-1", "qty": 2, "price": 9.5 },\n      { "sku": "P-2", "qty": 1, "price": 20 }\n    ],\n    "note": null,\n    "paid": true\n  }\n}' }],
  options: [
    { id: 'root', type: 'text', label: ['루트 요소 이름', 'Root element'], default: 'root' },
    { id: 'item', type: 'text', label: ['배열 항목 이름', 'Array item name'], default: 'item' },
    { id: 'attr', type: 'text', label: ['속성 접두사', 'Attribute prefix'], default: '@' },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['tab', 'Tab'], ['0', ['한 줄', 'Single line']]], default: '2' },
    { id: 'decl', type: 'checkbox', label: ['XML 선언 포함', 'Include XML declaration'], default: true },
    { id: 'self', type: 'checkbox', label: ['빈 요소는 <a/> 로', 'Self-close empty elements'], default: true }
  ],
  outputs: [{ id: 'out', label: ['XML 결과', 'XML output'], kind: 'code', ext: 'xml', mime: 'application/xml' }],
  swap: { from: 'out', to: 'in', label: ['결과를 입력으로', 'Use result as input'] },
  run: function (v, o, t) {
    var data = TK.json.parseValue(v.in), X = TK.xml, renamed = {};
    var ind = o.indent === 'tab' ? '\t' : ' '.repeat(Number(o.indent)), nl = o.indent === '0' ? '' : '\n', pre = o.attr || '@';
    function nm(k) { if (X.validName(k)) return k; var r = X.safeName(k); renamed[k] = r; return r; }
    function isPrim(x) { return x === null || typeof x !== 'object'; }
    function txt(x) { return x === null ? '' : String(x); }
    function el(name, val, lvl) {
      var pad = nl ? ind.repeat(lvl) : '', tag = nm(name);
      if (Array.isArray(val)) return val.map(function (x) { return el(name, x, lvl); }).join(nl);
      if (isPrim(val)) {
        var s = txt(val);
        if (val === null || s === '') return o.self ? pad + '<' + tag + '/>' : pad + '<' + tag + '></' + tag + '>';
        return pad + '<' + tag + '>' + X.escText(s) + '</' + tag + '>';
      }
      var attrs = '', kids = [], text = null, cdata = null;
      Object.keys(val).forEach(function (k) {
        var x = val[k];
        if (pre && k.indexOf(pre) === 0 && k.length > pre.length && isPrim(x)) attrs += ' ' + nm(k.slice(pre.length)) + '="' + X.escAttr(txt(x)) + '"';
        else if (k === '#text') text = txt(x);
        else if (k === '#cdata') cdata = txt(x);
        else kids.push(k);
      });
      var open = '<' + tag + attrs;
      if (!kids.length && text === null && cdata === null) return pad + open + (o.self ? '/>' : '></' + tag + '>');
      if (!kids.length) return pad + open + '>' + (text !== null ? X.escText(text) : '') + (cdata !== null ? '<![CDATA[' + cdata.replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]>' : '') + '</' + tag + '>';
      var inner = [];
      if (text !== null) inner.push((nl ? ind.repeat(lvl + 1) : '') + X.escText(text));
      if (cdata !== null) inner.push((nl ? ind.repeat(lvl + 1) : '') + '<![CDATA[' + cdata + ']]>');
      kids.forEach(function (k) { var x = el(k, val[k], lvl + 1); if (x !== '') inner.push(x); });
      return pad + open + '>' + nl + inner.join(nl) + nl + pad + '</' + tag + '>';
    }
    var body;
    var keys = !isPrim(data) && !Array.isArray(data) ? Object.keys(data) : [];
    var attrKey = function (k) { return (pre && k.indexOf(pre) === 0) || k === '#text' || k === '#cdata'; };
    if (keys.length === 1 && !attrKey(keys[0]) && !Array.isArray(data[keys[0]])) body = el(keys[0], data[keys[0]], 0);
    else if (Array.isArray(data)) { var w = {}; w[o.item || 'item'] = data; body = el(o.root || 'root', w, 0);
    } else body = el(o.root || 'root', data, 0);
    var out = (o.decl ? '<?xml version="1.0" encoding="UTF-8"?>' + nl : '') + body;
    var rn = Object.keys(renamed);
    return {
      _status: rn.length ? { ok: 'info', msg: t('⚠️ XML에서 쓸 수 없는 이름 ' + rn.length + '개를 바꿨습니다: ', '⚠️ Renamed ' + rn.length + ' invalid XML name(s): ') + rn.slice(0, 5).map(function (k) { return k + ' → ' + renamed[k]; }).join(', ') } : t('✅ 변환 완료', '✅ Converted'),
      out: out
    };
  }
});
