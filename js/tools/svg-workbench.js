TK.tool('svg-workbench', {
  sampleExpectError: true,
  inputs: [{ id: 'in', label: ['SVG 코드', 'SVG code'], rows: 16, sample: '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- Created with Inkscape (http://www.inkscape.org/) -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" version="1.1" id="svg8" width="48mm" height="48mm" viewBox="0 0 48 48" onload="alert(1)">\n  <metadata id="metadata5"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><cc:Work xmlns:cc="http://creativecommons.org/ns#"/></rdf:RDF></metadata>\n  <sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="1.4"/>\n  <title id="title1">Wooa icon</title>\n  <defs id="defs2">\n    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">\n      <stop offset="0" stop-color="rgb(255, 0, 0)"/>\n      <stop offset="1" stop-color="#0000ff"/>\n    </linearGradient>\n  </defs>\n  <g id="layer1" inkscape:label="Layer 1" inkscape:groupmode="layer">\n    <circle id="c1" cx="24.000000" cy="24.123456" r="20.000" fill="url(#grad)" stroke="black" stroke-width="1.000" stroke-linecap="butt"/>\n    <path id="p1" d="M 12.345678,24.000000 L 24.000000,12.000000 L 35.654321,24.000000 L 24.000000,36.000000 Z" fill="#ffffff" fill-rule="nonzero"/>\n    <path id="p2" d="m 20 20 c 0.5 -0.25 1.5 -0.25 2 0 a 1 1 0 0 1 4 0" fill="none" stroke="white"/>\n    <g id="empty"></g>\n  </g>\n  <script>alert(\'xss\')</script>\n</svg>' }],
  options: [
    { id: 'prec', type: 'number', label: ['좌표 소수 자릿수 (0~6)', 'Decimal places for coordinates (0-6)'], default: 2, min: 0, max: 6 },
    { id: 'pretty', type: 'checkbox', label: ['들여쓰기 출력 (끄면 한 줄로 최소화)', 'Indented output (off = single-line minified)'], default: false },
    { id: 'keepa11y', type: 'checkbox', label: ['<title>·<desc> 유지 (접근성)', 'Keep <title> and <desc> (accessibility)'], default: true },
    { id: 'ids', type: 'checkbox', label: ['참조되지 않는 id 제거', 'Remove unreferenced ids'], default: true },
    { id: 'wh', type: 'checkbox', label: ['viewBox 가 있으면 width/height 제거 (CSS 로 크기 조절)', 'Drop width / height when a viewBox exists (size with CSS)'], default: false },
    { id: 'safe', type: 'checkbox', label: ['위험 요소 제거 (script, on* 이벤트, foreignObject, 외부 링크)', 'Strip risky content (script, on* handlers, foreignObject, external links)'], default: true }
  ],
  outputs: [{ id: 'prev', label: ['미리보기 (정리된 SVG, 스크립트 실행 차단)', 'Preview (cleaned SVG, scripts blocked)'], kind: 'html' }, { id: 'info', label: ['요약', 'Summary'], kind: 'kv' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'out', label: ['정리된 SVG', 'Optimised SVG'], kind: 'code', ext: 'svg' }, { id: 'css', label: ['CSS 용 Data URI', 'Data URI for CSS'], kind: 'code', ext: 'css' }],
  run: function (v, o, t) {
    var src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('SVG 코드를 입력하세요', 'Enter SVG code'));
    var doc; try { doc = TK.xml.parse(src); } catch (e) { throw new Error(t('XML 구문 오류: ', 'XML syntax error: ') + e.message); }
    var root = doc.root; if (!root || root.name !== 'svg') throw new Error(t('루트 요소가 <svg> 가 아닙니다 (<' + (root && root.name) + '>)', 'The root element is not <svg> (<' + (root && root.name) + '>)'));
    var issues = [], prec = Math.max(0, Math.min(6, o.prec == null ? 2 : Number(o.prec)));
    function add(sev, m) { issues.push({ sev: sev, msg: m }); }
    function A(el, n) { for (var i = 0; i < el.attrs.length; i++) if (el.attrs[i][0] === n) return el.attrs[i][1]; return null; }
    /* ---------- 입력 점검 ---------- */
    var counts = {}, pathCount = 0, hasScript = false, extRefs = [], handlers = 0, fo = 0, rasters = 0, rasterBytes = 0, nodes = 0, texts = 0;
    (function scan(el) {
      nodes++; counts[el.name] = (counts[el.name] || 0) + 1;
      if (el.name === 'path') pathCount++;
      if (el.name === 'script') hasScript = true; if (el.name === 'foreignObject') fo++; if (el.name === 'text') texts++;
      el.attrs.forEach(function (a) {
        if (/^on/i.test(a[0])) handlers++;
        if (/^(xlink:)?href$/.test(a[0])) { if (/^\s*javascript:/i.test(a[1])) add('error', t('javascript: 링크가 있습니다 (<' + el.name + '>)', 'A javascript: link is present (<' + el.name + '>)')); else if (/^\s*(https?:)?\/\//i.test(a[1])) extRefs.push(a[1]); else if (/^data:image\//i.test(a[1])) { rasters++; rasterBytes += a[1].length; } }
      });
      el.children.forEach(function (c) { if (c.name) scan(c); });
    })(root);
    if (hasScript) add('error', t('<script> 가 포함되어 있습니다. 웹페이지에 인라인으로 넣으면 XSS 위험입니다 (<img> 로 불러오면 실행되지 않음)', 'A <script> is included: inlining it into a page is an XSS risk (loading through <img> does not run it)'));
    if (handlers) add('error', t('on* 이벤트 핸들러 속성이 ' + handlers + '개 있습니다 (XSS 위험)', handlers + ' on* event handler attribute(s) found (XSS risk)'));
    if (fo) add('warn', t('<foreignObject> ' + fo + '개: HTML 을 포함할 수 있고 일부 렌더러에서 지원되지 않습니다', fo + ' <foreignObject> element(s): can embed HTML and is unsupported in some renderers'));
    if (extRefs.length) add('warn', t('외부 리소스 참조 ' + extRefs.length + '개 (' + extRefs.slice(0, 2).join(', ') + '). <img> 로 쓰면 로드되지 않으며 개인정보 추적에 쓰일 수 있습니다', extRefs.length + ' external reference(s) (' + extRefs.slice(0, 2).join(', ') + '); they do not load via <img> and can be used for tracking'));
    if (rasters) add('info', t('내장 래스터 이미지 ' + rasters + '개 (' + Math.round(rasterBytes / 1024) + ' KB). 벡터 장점이 없고 용량이 큽니다', rasters + ' embedded raster image(s) (' + Math.round(rasterBytes / 1024) + ' KB): no vector benefit and large'));
    var vb = A(root, 'viewBox'), w = A(root, 'width'), h = A(root, 'height');
    if (!vb) add(w && h ? 'warn' : 'error', t('viewBox 가 없습니다. 크기 조절(확대·축소)이 되지 않아 반응형 아이콘으로 쓸 수 없습니다', 'No viewBox: the graphic cannot scale, so it is not usable as a responsive icon'));
    else if (!/^\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+\s*$/.test(vb)) add('error', t('viewBox 형식이 올바르지 않습니다: ' + vb, 'Invalid viewBox: ' + vb));
    if (!A(root, 'xmlns')) add('warn', t('xmlns="http://www.w3.org/2000/svg" 가 없습니다. 독립 파일이나 <img> 로 쓰면 표시되지 않습니다', 'No xmlns="http://www.w3.org/2000/svg": a standalone file or <img> will not render'));
    if (!counts.title && !A(root, 'aria-label') && !A(root, 'aria-hidden') && !A(root, 'role')) add('info', t('접근성: <title> 또는 aria-label 이 없습니다. 장식용이면 aria-hidden="true" 를 지정하세요', 'Accessibility: no <title> or aria-label; add aria-hidden="true" if decorative'));
    if (texts) add('info', t('<text> 요소 ' + texts + '개: 글꼴이 없는 환경에서는 모양이 달라집니다. 윤곽선(path)으로 변환하는 것을 고려하세요', texts + ' <text> element(s): rendering changes where the font is missing; consider converting to outlines'));
    if (/inkscape:|sodipodi:|xmlns:(cc|dc|rdf)=/.test(src)) add('info', t('편집기(Inkscape 등) 메타데이터가 있습니다. 정리하면 크기가 줄어듭니다', 'Editor (Inkscape etc.) metadata is present; cleaning it reduces the size'));
    var longNums = (src.match(/\d+\.\d{4,}/g) || []).length; if (longNums > 5) add('info', t('소수점 4자리 이상 숫자가 ' + longNums + '개 있습니다. 자릿수를 줄이면 용량이 크게 줄어듭니다', longNums + ' numbers have 4+ decimals; lowering precision shrinks the file a lot'));
    /* ---------- 최적화 ---------- */
    var NAMED = { black: '#000', white: '#fff', red: '#f00', lime: '#0f0', blue: '#00f', yellow: '#ff0', cyan: '#0ff', aqua: '#0ff', magenta: '#f0f', fuchsia: '#f0f', gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000', green: '#008000', purple: '#800080', teal: '#008080', navy: '#000080', orange: '#ffa500' };
    function rn(x) { var n = +(+x).toFixed(prec); if (Object.is(n, -0)) n = 0; var s = String(n); if (/e/i.test(s)) s = n.toFixed(prec); return s.replace(/^(-?)0\./, '$1.'); }
    function color(c) {
      c = c.trim(); var lc = c.toLowerCase();
      if (NAMED[lc]) return NAMED[lc].length < lc.length ? NAMED[lc] : lc;
      var m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(c); if (m) { c = '#' + [m[1], m[2], m[3]].map(function (x) { return ('0' + Math.min(255, +x).toString(16)).slice(-2); }).join(''); }
      var h6 = /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i.exec(c); if (h6) return ('#' + h6[1] + h6[2] + h6[3]).toLowerCase();
      return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : c;
    }
    var PCOUNT = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
    function path(d) {
      var i = 0, n = d.length, out = '', cmd = '', first = true;
      function ws() { while (i < n && /[\s,]/.test(d[i])) i++; }
      function num() { var m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(d.slice(i)); if (!m) throw new Error('bad path'); i += m[0].length; return m[0]; }
      var lastNumOut = '';
      function emit(s, isNum) { if (isNum && lastNumOut !== '' && out.length) { if (s.charAt(0) === '-' || (s.charAt(0) === '.' && /\./.test(lastNumOut))) out += s; else out += ' ' + s; } else out += s; lastNumOut = isNum ? s : ''; }
      while (true) {
        ws(); if (i >= n) break;
        var c = d[i];
        if (/[a-zA-Z]/.test(c)) { cmd = c; i++; emit(c, false); var cnt0 = PCOUNT[c.toLowerCase()]; if (cnt0 === undefined) throw new Error('bad cmd'); if (cnt0 === 0) continue; }
        else if (!cmd) throw new Error('bad path');
        var lc = cmd.toLowerCase(), cnt = PCOUNT[lc]; if (!cnt) continue;
        for (var k = 0; k < cnt; k++) {
          ws();
          if (lc === 'a' && (k === 3 || k === 4)) { var fl = d[i]; if (fl !== '0' && fl !== '1') throw new Error('bad flag'); i++; emit(fl, true); }
          else emit(rn(num()), true);
        }
        ws(); if (i < n && !/[a-zA-Z]/.test(d[i]) && lc === 'm') cmd = cmd === 'm' ? 'l' : 'L';
      }
      return out;
    }
    var attrNum = { x: 1, y: 1, cx: 1, cy: 1, r: 1, rx: 1, ry: 1, x1: 1, y1: 1, x2: 1, y2: 1, width: 1, height: 1, 'stroke-width': 1, 'stroke-miterlimit': 1, offset: 1, opacity: 1, 'fill-opacity': 1, 'stroke-opacity': 1, 'font-size': 1 };
    var DEFAULTS = { 'fill-rule': 'nonzero', 'clip-rule': 'nonzero', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'opacity': '1', 'fill-opacity': '1', 'stroke-opacity': '1', 'stroke-miterlimit': '4', 'stroke-dashoffset': '0', 'stroke-opacity ': '1' };
    var refs = {}; (function collect(el) { el.attrs.forEach(function (a) { var m = String(a[1]).match(/url\(\s*['"]?#([^'")\s]+)/g); (m || []).forEach(function (x) { refs[x.replace(/^url\(\s*['"]?#/, '')] = 1; }); if (/^(xlink:)?href$/.test(a[0]) && /^#/.test(a[1])) refs[a[1].slice(1)] = 1; if (a[0] === 'begin' || a[0] === 'end') (String(a[1]).match(/([\w-]+)\./g) || []).forEach(function (x) { refs[x.slice(0, -1)] = 1; }); }); if (el.name === 'style') el.children.forEach(function (c) { var s = c.text || c.cdata || ''; (s.match(/#[\w-]+/g) || []).forEach(function (x) { refs[x.slice(1)] = 1; }); }); el.children.forEach(function (c) { if (c.name) collect(c); }); })(root);
    var removed = { comments: 0, meta: 0, attrs: 0, ids: 0, empty: 0, risky: 0 };
    var RISKY = { script: 1, foreignObject: 1, iframe: 1, embed: 1, object: 1 };
    function clean(el) {
      var kids = [];
      el.children.forEach(function (c) {
        if (c.comment !== undefined) { removed.comments++; return; }
        if (!c.name) {
          var tx = c.text !== undefined ? c.text : c.cdata; if (tx === undefined) return;
          var keepWs = /^(text|tspan|textPath|style|title|desc|script)$/.test(el.name);
          if (!keepWs && !String(tx).trim()) return; kids.push(keepWs ? c : (c.text !== undefined ? { text: String(tx).trim() } : c)); return;
        }
        if (/^(metadata|sodipodi:|inkscape:)/.test(c.name) || /^(rdf|cc|dc):/.test(c.name)) { removed.meta++; return; }
        if (o.safe && RISKY[c.name]) { removed.risky++; return; }
        if (!o.keepa11y && (c.name === 'title' || c.name === 'desc')) { removed.meta++; return; }
        clean(c);
        if ((c.name === 'g' || c.name === 'defs' || c.name === 'switch') && !c.children.length && !c.attrs.some(function (a) { return a[0] === 'id' && refs[a[1]]; })) { removed.empty++; return; }
        kids.push(c);
      });
      el.children = kids;
      var na = [];
      el.attrs.forEach(function (a) {
        var k = a[0], val = a[1];
        if (/^(inkscape|sodipodi):/.test(k) || /^xmlns:(inkscape|sodipodi|dc|cc|rdf)$/.test(k) || k === 'xml:space' && val === 'preserve' && !/^(text|tspan)$/.test(el.name) && el.name !== 'svg') { removed.attrs++; return; }
        if (o.safe && (/^on/i.test(k) || ((/^(xlink:)?href$/.test(k)) && (/^\s*javascript:/i.test(val) || /^\s*(https?:)?\/\//i.test(val))))) { removed.risky++; return; }
        if (k === 'id' && o.ids && !refs[val]) { removed.ids++; return; }
        if (k === 'version' && el.name === 'svg') { removed.attrs++; return; }
        if (k === 'd' && el.name === 'path') { try { val = path(val); } catch (e) { add('warn', t('path 데이터를 해석하지 못해 그대로 둡니다: ' + String(val).slice(0, 30), 'Could not parse path data, left unchanged: ' + String(val).slice(0, 30))); } }
        else if (k === 'points') { val = val.trim().split(/[\s,]+/).filter(Boolean).map(function (x) { return isNaN(+x) ? x : rn(x); }).join(' '); }
        else if (k === 'viewBox') { val = val.trim().split(/[\s,]+/).map(function (x) { return isNaN(+x) ? x : String(+x); }).join(' '); }
        else if (attrNum[k] && /^-?\d*\.?\d+$/.test(val.trim())) val = rn(val.trim());
        else if (/^(fill|stroke|stop-color|flood-color|lighting-color)$/.test(k)) val = color(val);
        else if (k === 'style') {
          var decls = val.split(';').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { var i2 = x.indexOf(':'); if (i2 < 0) return x; var pk = x.slice(0, i2).trim(), pv = x.slice(i2 + 1).trim(); if (/^(fill|stroke|stop-color|flood-color)$/.test(pk)) pv = color(pv); return pk + ':' + pv; });
          val = decls.join(';'); if (!val) { removed.attrs++; return; }
        }
        if (DEFAULTS[k] !== undefined && val === DEFAULTS[k] && !el.attrs.some(function (z) { return z[0] === 'style' && z[1].indexOf(k) >= 0; })) { removed.attrs++; return; }
        na.push([k, val]);
      });
      el.attrs = na;
    }
    var vbPresent = !!vb;
    clean(root);
    if (o.wh && vbPresent) root.attrs = root.attrs.filter(function (a) { if (a[0] === 'width' || a[0] === 'height') { removed.attrs++; return false; } return true; });
    if (!root.attrs.some(function (a) { return a[0] === 'xmlns'; })) root.attrs.unshift(['xmlns', 'http://www.w3.org/2000/svg']);
    function esc(s, attr) { s = String(s).replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/</g, '&lt;'); return attr ? s.replace(/"/g, '&quot;') : s.replace(/>/g, '&gt;'); }
    function ser(el, ind) {
      var pad = o.pretty ? new Array(ind + 1).join('  ') : '', nl = o.pretty ? '\n' : '';
      var at = el.attrs.map(function (a) { return a[0] + '="' + esc(a[1], true) + '"'; }).join(' ');
      var open = '<' + el.name + (at ? ' ' + at : '');
      if (!el.children.length) return pad + open + '/>';
      var onlyText = el.children.every(function (c) { return !c.name; });
      if (onlyText) return pad + open + '>' + el.children.map(function (c) { return c.cdata !== undefined ? '<![CDATA[' + c.cdata + ']]>' : esc(c.text, false); }).join('') + '</' + el.name + '>';
      return pad + open + '>' + nl + el.children.map(function (c) { return c.name ? ser(c, ind + 1) : (o.pretty ? pad + '  ' : '') + (c.cdata !== undefined ? '<![CDATA[' + c.cdata + ']]>' : esc(c.text, false)); }).join(nl) + nl + pad + '</' + el.name + '>';
    }
    var out = ser(root, 0);
    var before = new TextEncoder().encode(src).length, after = new TextEncoder().encode(out).length;
    var saved = before ? Math.round((1 - after / before) * 1000) / 10 : 0;
    /* 안전 미리보기 / data URI */
    var safeEl = JSON.parse(JSON.stringify(root));
    (function strip(el) { el.children = el.children.filter(function (c) { return !(c.name && RISKY[c.name]); }); el.attrs = el.attrs.filter(function (a) { return !(/^on/i.test(a[0])) && !((/^(xlink:)?href$/.test(a[0])) && /^\s*(javascript:|(https?:)?\/\/)/i.test(a[1])); }); el.children.forEach(function (c) { if (c.name) strip(c); }); })(safeEl);
    var safeSvg = (function () { var keep = o.pretty; o.pretty = false; var s = ser(safeEl, 0); o.pretty = keep; return s; })();
    function b64(s) { var u = new TextEncoder().encode(s), r = ''; for (var i = 0; i < u.length; i += 0x8000) r += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(r); }
    var uri = 'data:image/svg+xml;base64,' + b64(safeSvg);
    var enc = 'data:image/svg+xml,' + encodeURIComponent(safeSvg).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/').replace(/"/g, "'");
    var css = '/* URL-encoded (smaller for most icons) */\nbackground-image: url("' + enc.replace(/"/g, "'") + '");\n\n/* Base64 */\nbackground-image: url("' + uri + '");';
    var prev = '<div style="background:repeating-conic-gradient(#e5e7eb 0% 25%,#fff 0% 50%) 50%/16px 16px;padding:12px;border-radius:8px;text-align:center"><img alt="SVG preview" style="max-width:100%;max-height:260px" src="' + uri + '"></div>';
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' }, order = { error: 0, warn: 1, info: 2 };
    var shown = issues.slice().sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    var errs = shown.filter(function (x) { return x.sev === 'error'; }).length;
    var pathCmds = 0; (function cnt(el) { if (el.name === 'path') { var d = A(el, 'd'); if (d) pathCmds += (d.match(/[a-zA-Z]/g) || []).length; } el.children.forEach(function (c) { if (c.name) cnt(c); }); })(root);
    var info = [[['원본 크기', 'Original size'], before.toLocaleString() + ' B'], [['정리 후 크기', 'Optimised size'], after.toLocaleString() + ' B (' + (saved >= 0 ? '−' + saved + '%' : '+' + (-saved) + '%') + ')'], [['viewBox', 'viewBox'], vb || '—'], [['width × height', 'width × height'], (w || '—') + ' × ' + (h || '—')], [['요소 수', 'Elements'], String(nodes)], [['path 수 / 명령 수', 'Paths / commands'], pathCount + ' / ' + pathCmds], [['제거됨', 'Removed'], t('주석 ' + removed.comments + ' · 메타데이터 ' + removed.meta + ' · 속성 ' + removed.attrs + ' · id ' + removed.ids + ' · 빈 그룹 ' + removed.empty + (removed.risky ? ' · 위험 요소 ' + removed.risky : ''), 'comments ' + removed.comments + ' · metadata ' + removed.meta + ' · attributes ' + removed.attrs + ' · ids ' + removed.ids + ' · empty groups ' + removed.empty + (removed.risky ? ' · risky ' + removed.risky : ''))], [['gzip 전송 크기 추정', 'Approx. gzip size'], t('(CompressionStream 이 있는 브라우저에서 아래에 표시)', '(shown below where CompressionStream exists)')]];
    function finish(gz) { if (gz) info[info.length - 1][1] = gz + ' B'; else info.pop(); return { _status: { ok: errs ? false : true, msg: errs ? t('⛔ 문제 ' + errs + '건 — 정리 후 ' + after + ' B (−' + saved + '%)', '⛔ ' + errs + ' problem(s) - ' + after + ' B after cleaning (−' + saved + '%)') : t('✅ ' + before + ' B → ' + after + ' B (−' + saved + '%)', '✅ ' + before + ' B → ' + after + ' B (−' + saved + '%)') }, prev: prev, info: info, issues: shown.map(function (x) { return ICON[x.sev] + ' ' + x.msg; }), out: out, css: css }; }
    if (typeof CompressionStream === 'function') {
      var cs = new CompressionStream('gzip'), wr = cs.writable.getWriter(); wr.write(new TextEncoder().encode(out)).catch(function () {}); wr.close().catch(function () {});
      var rd = cs.readable.getReader(), tot = 0;
      return (function pump() { return rd.read().then(function (x) { if (x.done) return finish(tot); tot += x.value.length; return pump(); }); })().catch(function () { return finish(null); });
    }
    return finish(null);
  }
});
