TK.tool('xml-to-json', {
  inputs: [{ id: 'in', label: ['XML 입력', 'XML input'], rows: 12, placeholder: ['변환할 XML을 붙여넣으세요', 'Paste the XML to convert'],
    sample: '<?xml version="1.0" encoding="UTF-8"?>\n<order id="A-1024" paid="true">\n  <customer>Kim &amp; Co.</customer>\n  <items>\n    <item sku="P-1"><qty>2</qty><price>9.5</price></item>\n    <item sku="P-2"><qty>1</qty><price>20</price></item>\n  </items>\n  <note/>\n</order>' }],
  options: [
    { id: 'attr', type: 'text', label: ['속성 접두사', 'Attribute prefix'], default: '@' },
    { id: 'types', type: 'checkbox', label: ['숫자·불리언 값으로 변환', 'Convert numbers & booleans'], default: true },
    { id: 'arr', type: 'checkbox', label: ['항상 배열로', 'Always use arrays'], default: false },
    { id: 'noattr', type: 'checkbox', label: ['속성 무시', 'Ignore attributes'], default: false },
    { id: 'keepRoot', type: 'checkbox', label: ['루트 요소 이름 유지', 'Keep root element name'], default: true },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['tab', 'Tab'], ['0', ['압축', 'Minified']]], default: '2' }
  ],
  outputs: [{ id: 'out', label: ['JSON 결과', 'JSON output'], kind: 'code', ext: 'json', mime: 'application/json' }],
  swap: { from: 'out', to: 'in' },
  run: function (v, o, t) {
    var doc = TK.xml.parse(v.in), pre = o.attr === undefined ? '@' : o.attr;
    function conv(s) {
      if (!o.types) return s;
      if (s === 'true') return true;
      if (s === 'false') return false;
      if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(s) && String(Number(s)) === s) return Number(s);
      return s;
    }
    function node(e) {
      var obj = {}, has = false, text = '', kids = {}, order = [];
      if (!o.noattr) e.attrs.forEach(function (a) { obj[pre + a[0]] = conv(a[1]); has = true; });
      e.children.forEach(function (c) {
        if (c.name) {
          if (!kids[c.name]) { kids[c.name] = []; order.push(c.name); }
          kids[c.name].push(node(c));
        } else if (c.text != null || c.cdata != null) text += c.text != null ? c.text : c.cdata;
      });
      var onlyWs = !text.trim();
      order.forEach(function (k) {
        has = true;
        TK.json.setProp(obj, k, kids[k].length > 1 || o.arr ? kids[k] : kids[k][0]);
      });
      if (!onlyWs) {
        var tv = order.length || has ? text.trim() : text;
        if (!has) return conv(tv.trim());
        obj['#text'] = conv(text.trim()); has = true;
      }
      return has ? obj : '';
    }
    var res = node(doc.root);
    var out = o.keepRoot ? (function () { var w = {}; w[doc.root.name] = res; return w; })() : res;
    return {
      _status: t('✅ 변환 완료 — 루트 <' + doc.root.name + '>', '✅ Converted — root <' + doc.root.name + '>'),
      out: TK.json.fmt(out, o.indent)
    };
  }
});
