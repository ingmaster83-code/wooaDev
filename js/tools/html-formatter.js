TK.tool('html-formatter', {
  inputs: [{ id: 'in', label: ['HTML', 'HTML'], rows: 14, sample: '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Demo</title><style>body{margin:0}</style></head><body><div class="wrap"><h1 id="t">Hello <em>world</em></h1><p>Short <b>bold</b> text.<img src="a.png"><ul><li>One<li>Two</ul><a href="#">link</a><script>if (a<b) { run(); }</script></div><div id="t"></body></html>' }],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['format', ['정리(들여쓰기)', 'Format (indent)']], ['minify', ['최소화(공백 제거)', 'Minify']]], default: 'format' },
    { id: 'indent', type: 'select', label: ['들여쓰기', 'Indent'], choices: [['2', ['2칸', '2 spaces']], ['4', ['4칸', '4 spaces']], ['tab', 'Tab']], default: '2', show: function (o) { return o.mode === 'format'; } },
    { id: 'width', type: 'number', label: ['한 줄 최대 길이 (인라인 내용 합치기)', 'Max line width (for joining inline content)'], default: 100, min: 40, max: 300, show: function (o) { return o.mode === 'format'; } }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'html' }, { id: 'issues', label: ['구조 검사', 'Structure checks'], kind: 'list' }],
  run: function (v, o, t) {
    var src = String(v.in); if (!src.trim()) throw new Error(t('HTML 을 입력하세요', 'Enter some HTML'));
    var VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i, RAW = /^(script|style|pre|textarea)$/i;
    var INLINE = /^(a|abbr|b|bdi|bdo|big|cite|code|data|del|dfn|em|font|i|ins|kbd|label|mark|q|s|samp|small|span|strike|strong|sub|sup|time|tt|u|var|img|br|button|input|select|textarea|svg|wbr)$/i;
    var OPTCLOSE = { li: /^(li)$/i, p: /^(p|div|ul|ol|table|h[1-6]|pre|form|section|article|header|footer|nav|aside|blockquote|hr|fieldset)$/i, dt: /^(dt|dd)$/i, dd: /^(dt|dd)$/i, tr: /^(tr|tbody|tfoot)$/i, td: /^(td|th|tr)$/i, th: /^(td|th|tr)$/i, option: /^(option|optgroup)$/i, thead: /^(tbody|tfoot)$/i };
    var issues = [], i = 0, L = src.length, root = { name: '#root', children: [] }, stack = [root], ids = {}, DEPREC = /^(center|font|marquee|blink|big|strike|tt|frame|frameset|acronym|applet|basefont|dir|isindex|noframes)$/i;
    var hasDoctype = false, hasLang = false, hasTitle = false, hasCharset = false, hasViewport = false;
    function top() { return stack[stack.length - 1]; }
    function addText(s) { if (s !== '') top().children.push({ text: s }); }
    function parseAttrs(s) {
      var attrs = [], re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g, m;
      while ((m = re.exec(s))) attrs.push({ n: m[1], v: m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4], q: m[2] !== undefined ? '"' : m[3] !== undefined ? "'" : m[4] !== undefined ? '' : null });
      return attrs;
    }
    while (i < L) {
      var lt = src.indexOf('<', i);
      if (lt < 0) { addText(src.slice(i)); break; }
      if (lt > i) addText(src.slice(i, lt));
      i = lt;
      if (src.substr(i, 4) === '<!--') { var e = src.indexOf('-->', i + 4); if (e < 0) { issues.push(t('🚨 닫히지 않은 주석', '🚨 Unclosed comment')); top().children.push({ comment: src.slice(i + 4) }); i = L; } else { top().children.push({ comment: src.slice(i + 4, e) }); i = e + 3; } continue; }
      var m = /^<!doctype\s+([^>]*)>/i.exec(src.slice(i)); if (m) { hasDoctype = true; top().children.push({ doctype: m[1].trim() }); i += m[0].length; continue; }
      m = /^<\/([A-Za-z][^\s>\/]*)\s*>/.exec(src.slice(i));
      if (m) {
        var nm = m[1].toLowerCase(), k = stack.length - 1; while (k > 0 && stack[k].name !== nm) k--;
        if (k <= 0) { issues.push(t('짝이 없는 닫는 태그 </' + nm + '> (무시)', 'Stray closing tag </' + nm + '> (ignored)')); }
        else { while (stack.length - 1 > k) { var un = stack.pop(); if (!OPTCLOSE[un.name]) issues.push(t('🚨 </' + un.name + '> 가 없습니다 (<' + nm + '> 이 닫힐 때까지 열려 있음)', '🚨 Missing </' + un.name + '> (still open when <' + nm + '> closed)')); } stack.pop(); }
        i += m[0].length; continue;
      }
      m = /^<([A-Za-z][^\s>\/]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/.exec(src.slice(i));
      if (!m) { addText('<'); i++; issues.push(t('태그로 해석되지 않는 < 문자가 있습니다 (&lt; 로 써야 함)', 'A < that does not start a tag (should be &lt;)')); continue; }
      var name = m[1].toLowerCase(), attrs = parseAttrs(m[2]), self = m[3] === '/';
      i += m[0].length;
      // 선택적 종료 태그 처리
      var tp = top(); if (OPTCLOSE[tp.name] && OPTCLOSE[tp.name].test(name)) stack.pop();
      var el = { name: name, attrs: attrs, children: [], self: self }; top().children.push(el);
      if (name === 'html') hasLang = attrs.some(function (a) { return a.n.toLowerCase() === 'lang'; });
      if (name === 'meta') { attrs.forEach(function (a) { if (a.n.toLowerCase() === 'charset') hasCharset = true; if (a.n.toLowerCase() === 'name' && /viewport/i.test(a.v || '')) hasViewport = true; }); }
      if (name === 'img' && !attrs.some(function (a) { return a.n.toLowerCase() === 'alt'; })) issues.push(t('<img> 에 alt 속성이 없습니다 (접근성·SEO)', '<img> without alt (accessibility / SEO)'));
      if (name === 'a' && attrs.some(function (a) { return a.n.toLowerCase() === 'target' && a.v === '_blank'; }) && !attrs.some(function (a) { return a.n.toLowerCase() === 'rel' && /noopener|noreferrer/.test(a.v || ''); })) issues.push(t('target="_blank" 링크에 rel="noopener" 가 없습니다', 'target="_blank" link without rel="noopener"'));
      if (DEPREC.test(name)) issues.push(t('폐기된 태그 <' + name + '>', 'Deprecated tag <' + name + '>'));
      attrs.forEach(function (a) { if (a.n.toLowerCase() === 'id') { if (ids[a.v]) issues.push(t('🚨 중복된 id="' + a.v + '"', '🚨 Duplicate id="' + a.v + '"')); ids[a.v] = 1; } if (/^on[a-z]+$/i.test(a.n)) issues.push(t('인라인 이벤트 속성 ' + a.n + ' — CSP 와 충돌하고 유지보수가 어렵습니다', 'Inline event attribute ' + a.n + ' — conflicts with CSP and is hard to maintain')); });
      if (name === 'title') hasTitle = true;
      if (RAW.test(name) && !self) {
        var re = new RegExp('</' + name + '\\s*>', 'i'), rm = re.exec(src.slice(i));
        if (!rm) { el.raw = src.slice(i); i = L; issues.push(t('🚨 </' + name + '> 가 없습니다', '🚨 Missing </' + name + '>')); }
        else { el.raw = src.slice(i, i + rm.index); i += rm.index + rm[0].length; }
        continue;
      }
      if (!VOID.test(name) && !self) stack.push(el);
    }
    while (stack.length > 1) { var u = stack.pop(); if (!OPTCLOSE[u.name]) issues.push(t('🚨 </' + u.name + '> 가 없습니다', '🚨 Missing </' + u.name + '>')); }
    if (!hasDoctype && /<html/i.test(src)) issues.push(t('<!DOCTYPE html> 이 없어 쿼크스 모드로 렌더링될 수 있습니다', 'No <!DOCTYPE html> — the browser may use quirks mode'));
    if (/<html/i.test(src)) { if (!hasLang) issues.push(t('<html> 에 lang 속성이 없습니다', '<html> has no lang attribute')); if (!hasTitle) issues.push(t('<title> 이 없습니다', 'No <title>')); if (!hasCharset) issues.push(t('<meta charset> 이 없습니다', 'No <meta charset>')); if (!hasViewport) issues.push(t('모바일용 viewport 메타 태그가 없습니다', 'No viewport meta tag for mobile')); }
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    function attrStr(el) { return el.attrs.map(function (a) { return ' ' + a.n + (a.q === null ? '' : '=' + (a.q || '"') + a.v + (a.q || '"')); }).join(''); }
    function open(el) { return '<' + el.name + attrStr(el) + (el.self ? ' />' : '>'); }
    function inl(el) { return !el.text && !el.comment && !el.doctype && INLINE.test(el.name) && el.children.every(function (c) { return c.text !== undefined || (INLINE.test(c.name || '') && inl(c)); }) && !el.raw; }
    var unit = o.indent === 'tab' ? '\t' : new Array((+o.indent || 2) + 1).join(' '), W = Math.round(o.width) || 100;
    function flat(el) { // 한 줄 표현
      if (el.text !== undefined) return el.text.replace(/\s+/g, ' ');
      if (el.comment !== undefined) return '<!--' + el.comment + '-->';
      if (el.doctype !== undefined) return '<!DOCTYPE ' + el.doctype + '>';
      if (el.raw !== undefined) return open(el) + el.raw + '</' + el.name + '>';
      if (VOID.test(el.name) || el.self) return open(el);
      return open(el) + el.children.map(flat).join('') + '</' + el.name + '>';
    }
    function render(el, d, out) {
      var pad = new Array(d + 1).join(unit);
      if (el.text !== undefined) { var s = el.text.replace(/\s+/g, ' ').trim(); if (s) out.push(pad + s); return; }
      if (el.comment !== undefined) { out.push(pad + '<!--' + el.comment + '-->'); return; }
      if (el.doctype !== undefined) { out.push(pad + '<!DOCTYPE ' + el.doctype + '>'); return; }
      if (el.raw !== undefined) {
        if (/^pre$|^textarea$/i.test(el.name)) { out.push(pad + open(el) + el.raw + '</' + el.name + '>'); return; }
        var body = el.raw.replace(/^\s*\n/, '').replace(/\s+$/, '');
        if (!body.trim()) { out.push(pad + open(el) + '</' + el.name + '>'); return; }
        if (body.indexOf('\n') < 0 && body.length + pad.length < W - 20) { out.push(pad + open(el) + body.trim() + '</' + el.name + '>'); return; }
        var ml = body.split('\n'), ind = Math.min.apply(null, ml.filter(function (x) { return x.trim(); }).map(function (x) { return x.match(/^\s*/)[0].length; }));
        out.push(pad + open(el)); ml.forEach(function (x) { out.push(x.trim() ? pad + unit + x.slice(ind).replace(/\s+$/, '') : ''); }); out.push(pad + '</' + el.name + '>'); return;
      }
      if (VOID.test(el.name) || el.self) { out.push(pad + open(el)); return; }
      var kids = el.children.filter(function (c) { return !(c.text !== undefined && !c.text.trim()); });
      if (!kids.length) { out.push(pad + open(el) + '</' + el.name + '>'); return; }
      var one = flat({ name: el.name, attrs: el.attrs, children: kids.map(function (c) { return c.text !== undefined ? { text: c.text.replace(/^\s+|\s+$/g, function (w) { return w ? ' ' : ''; }) } : c; }) });
      if (kids.every(function (c) { return c.text !== undefined || (c.name && INLINE.test(c.name) && inl(c)) || c.comment !== undefined; }) && pad.length + one.length <= W) { out.push(pad + one.replace(/> </g, '><')); return; }
      out.push(pad + open(el));
      // 인라인 내용이 이어지는 구간은 한 줄로 묶는다
      var buf = '';
      function flush() { if (buf.trim()) out.push(pad + unit + buf.trim()); buf = ''; }
      kids.forEach(function (c) {
        if (c.text !== undefined || (c.name && INLINE.test(c.name) && inl(c))) { var piece = flat(c); if ((buf + piece).length + pad.length + unit.length > W) flush(); buf += (c.text !== undefined ? piece : piece); }
        else { flush(); render(c, d + 1, out); }
      });
      flush();
      out.push(pad + '</' + el.name + '>');
    }
    var out = [], text;
    if (o.mode === 'minify') {
      text = root.children.map(function min(el) {
        if (el.text !== undefined) return el.text.replace(/\s+/g, ' ');
        if (el.comment !== undefined) return /^\[if|^<!\[/.test(el.comment) ? '<!--' + el.comment + '-->' : '';
        if (el.doctype !== undefined) return '<!DOCTYPE ' + el.doctype + '>';
        if (el.raw !== undefined) return open(el) + (/^pre$|^textarea$/i.test(el.name) ? el.raw : el.raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()) + '</' + el.name + '>';
        if (VOID.test(el.name) || el.self) return open(el);
        return open(el) + el.children.map(min).join('') + '</' + el.name + '>';
      }).join('').replace(/>\s+</g, '><').trim();
      var pct = Math.round((1 - text.length / src.length) * 100);
      issues.unshift(pct > 0 ? t('최소화: ' + src.length.toLocaleString() + '자 → ' + text.length.toLocaleString() + '자 (' + pct + '% 감소)', 'Minified: ' + src.length.toLocaleString() + ' → ' + text.length.toLocaleString() + ' chars (' + pct + '% smaller)') : t('최소화: ' + src.length.toLocaleString() + '자 → ' + text.length.toLocaleString() + '자 (이미 압축된 입력이거나 생략된 닫는 태그가 보정되어 줄지 않았습니다)', 'Minified: ' + src.length.toLocaleString() + ' → ' + text.length.toLocaleString() + ' chars (input was already compact, or omitted closing tags were restored)'));
      issues.push(t('인라인 요소 사이의 공백(&nbsp; 아닌 일반 공백)은 의미가 있을 수 있어 단일 공백으로 남기거나 제거했습니다 — 화면 결과를 확인하세요', 'Whitespace between inline elements can matter; it was reduced or removed — check the rendering'));
    } else { root.children.forEach(function (c) { render(c, 0, out); }); text = out.join('\n'); }
    var bad = uniq.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: 'info', msg: t('🔍 구조 문제 ' + bad + '건', '🔍 ' + bad + ' structural problem(s)') } : t('✅ ' + (o.mode === 'minify' ? '최소화' : '정리') + ' 완료', '✅ ' + (o.mode === 'minify' ? 'Minified' : 'Formatted')), out: text, issues: o.mode === 'minify' ? issues.concat(uniq.filter(function (x) { return issues.indexOf(x) < 0; })) : uniq };
  }
});
