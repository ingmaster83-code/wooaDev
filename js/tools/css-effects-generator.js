(function () {
  var E = function (arr) { return function (o) { return arr.indexOf(o.effect) >= 0; }; };
  function num(id, ko, en, def, min, max, eff) { return { id: id, type: 'number', label: [ko, en], default: def, min: min, max: max, show: E(eff) }; }
  TK.tool('css-effects-generator', {
    allowEmpty: true,
    inputs: [],
    options: [
      { id: 'effect', type: 'select', label: ['효과', 'Effect'], choices: [['shadow', 'box-shadow'], ['text', 'text-shadow'], ['border', ['테두리·둥근 모서리', 'Border & radius']], ['transform', 'transform'], ['filter', 'filter'], ['glass', ['글래스모피즘 (backdrop-filter)', 'Glassmorphism (backdrop-filter)']]], default: 'shadow' },
      num('x', '가로 오프셋 (px)', 'X offset (px)', 0, -100, 100, ['shadow', 'text']), num('y', '세로 오프셋 (px)', 'Y offset (px)', 8, -100, 100, ['shadow', 'text']),
      num('blur', '흐림 (px)', 'Blur (px)', 24, 0, 200, ['shadow', 'text', 'filter', 'glass']), num('spread', '퍼짐 (px)', 'Spread (px)', 0, -100, 100, ['shadow']),
      { id: 'color', type: 'text', label: ['색상 (hex)', 'Colour (hex)'], default: '#000000', show: E(['shadow', 'text', 'border', 'glass']) },
      num('alpha', '불투명도 (0~1)', 'Opacity (0–1)', 0.25, 0, 1, ['shadow', 'text', 'glass']),
      { id: 'inset', type: 'checkbox', label: ['안쪽 그림자 (inset)', 'Inset shadow'], default: false, show: E(['shadow']) },
      { id: 'layer2', type: 'checkbox', label: ['겹치는 두 번째 그림자 추가', 'Add a second, layered shadow'], default: true, show: E(['shadow']) },
      num('bw', '두께 (px)', 'Width (px)', 3, 0, 40, ['border']), { id: 'bs', type: 'select', label: ['선 모양', 'Style'], choices: [['solid', 'solid'], ['dashed', 'dashed'], ['dotted', 'dotted'], ['double', 'double']], default: 'solid', show: E(['border']) },
      num('radius', '모서리 반경 (px)', 'Radius (px)', 16, 0, 200, ['border']),
      num('rot', '회전 (deg)', 'Rotate (deg)', 6, -360, 360, ['transform']), num('scale', '확대 (배)', 'Scale', 1.05, 0, 5, ['transform']), num('tx', 'X 이동 (px)', 'Translate X (px)', 0, -300, 300, ['transform']), num('ty', 'Y 이동 (px)', 'Translate Y (px)', -4, -300, 300, ['transform']), num('skx', 'X 기울기 (deg)', 'Skew X (deg)', 0, -89, 89, ['transform']),
      num('bright', '밝기 (%)', 'Brightness (%)', 100, 0, 300, ['filter']), num('contrast', '대비 (%)', 'Contrast (%)', 100, 0, 300, ['filter']), num('gray', '흑백 (%)', 'Grayscale (%)', 0, 0, 100, ['filter']), num('hue', '색조 회전 (deg)', 'Hue rotate (deg)', 0, 0, 360, ['filter']), num('sat', '채도 (%)', 'Saturate (%)', 100, 0, 400, ['filter']), num('sepia', '세피아 (%)', 'Sepia (%)', 0, 0, 100, ['filter'])
    ],
    outputs: [{ id: 'out', label: ['CSS', 'CSS'], kind: 'code', ext: 'css' }, { id: 'preview', label: ['미리보기', 'Preview'], kind: 'html' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
    run: function (v, o, t) {
      function rgba(hex, a) { var h = String(hex || '#000').replace('#', ''); if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(function (c) { return c + c; }).join(''); if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(t('색상은 #RRGGBB 형식으로 입력하세요', 'Enter the colour as #RRGGBB')); var n = parseInt(h, 16); return 'rgba(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + (Math.round(a * 100) / 100) + ')'; }
      var css = [], issues = [], style = '', box = 'width:180px;height:110px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;font:600 14px sans-serif;color:#334155;', bg = '#e2e8f0';
      var e = o.effect;
      if (e === 'shadow') {
        var l1 = (o.inset ? 'inset ' : '') + o.x + 'px ' + o.y + 'px ' + o.blur + 'px ' + o.spread + 'px ' + rgba(o.color, o.alpha), layers = [l1];
        if (o.layer2) layers.push((o.inset ? 'inset ' : '') + Math.round(o.x / 2) + 'px ' + Math.round(o.y / 2) + 'px ' + Math.round(o.blur / 3) + 'px ' + rgba(o.color, Math.min(1, o.alpha * 0.6)));
        css.push('box-shadow:' + (layers.length > 1 ? '\n    ' + layers.join(',\n    ') : ' ' + layers[0]) + ';'); style = 'box-shadow:' + layers.join(',');
        if (o.blur > 60) issues.push(t('흐림이 큰 그림자는 스크롤·애니메이션 성능을 떨어뜨릴 수 있습니다', 'Very blurry shadows can hurt scrolling and animation performance'));
        issues.push(t('겹친 그림자(레이어)를 쓰면 한 겹보다 훨씬 자연스러운 깊이감이 납니다', 'Layered shadows look much more natural than a single one'));
      } else if (e === 'text') {
        css.push('text-shadow: ' + o.x + 'px ' + o.y + 'px ' + o.blur + 'px ' + rgba(o.color, o.alpha) + ';'); style = 'text-shadow:' + o.x + 'px ' + o.y + 'px ' + o.blur + 'px ' + rgba(o.color, o.alpha) + ';font-size:28px;font-weight:800;'; bg = '#fff';
        issues.push(t('text-shadow 에는 spread 값이 없습니다', 'text-shadow has no spread value'));
      } else if (e === 'border') {
        css.push('border: ' + o.bw + 'px ' + o.bs + ' ' + (/^#/.test(o.color) ? o.color : '#' + o.color) + ';', 'border-radius: ' + o.radius + 'px;'); style = 'border:' + o.bw + 'px ' + o.bs + ' ' + o.color + ';border-radius:' + o.radius + 'px;';
        if (o.bs === 'double' && o.bw < 3) issues.push(t('double 은 두께 3px 이상이어야 두 줄로 보입니다', 'double needs at least 3px to show two lines'));
        if (o.radius >= 55) issues.push(t('반경이 크면 원/알약 모양이 됩니다. 완전한 알약은 border-radius: 9999px', 'A large radius makes a pill or circle; use border-radius: 9999px for a perfect pill'));
      } else if (e === 'transform') {
        var tr = ['translate(' + o.tx + 'px, ' + o.ty + 'px)', 'rotate(' + o.rot + 'deg)', 'scale(' + o.scale + ')']; if (o.skx) tr.push('skewX(' + o.skx + 'deg)');
        css.push('transform: ' + tr.join(' ') + ';', 'transition: transform 0.2s ease;'); style = 'transform:' + tr.join(' ') + ';';
        issues.push(t('transform 은 레이아웃을 바꾸지 않아 애니메이션 성능이 좋습니다 (GPU 합성)', 'transform does not trigger layout, so it animates cheaply (GPU compositing)'));
        issues.push(t('여러 함수는 오른쪽에서 왼쪽 순서로 적용됩니다 — 순서를 바꾸면 결과가 달라집니다', 'Several functions apply right-to-left; changing the order changes the result'));
      } else if (e === 'filter') {
        var fl = []; if (o.blur) fl.push('blur(' + o.blur + 'px)'); if (o.bright !== 100) fl.push('brightness(' + o.bright + '%)'); if (o.contrast !== 100) fl.push('contrast(' + o.contrast + '%)'); if (o.gray) fl.push('grayscale(' + o.gray + '%)'); if (o.hue) fl.push('hue-rotate(' + o.hue + 'deg)'); if (o.sat !== 100) fl.push('saturate(' + o.sat + '%)'); if (o.sepia) fl.push('sepia(' + o.sepia + '%)');
        css.push('filter: ' + (fl.join(' ') || 'none') + ';'); style = 'filter:' + (fl.join(' ') || 'none') + ';background:linear-gradient(135deg,#f97316,#3b82f6,#10b981);color:#fff;';
        issues.push(t('filter 는 요소 전체(자식 포함)에 적용됩니다. 배경만 흐리게 하려면 backdrop-filter 를 쓰세요', 'filter affects the whole element including children; use backdrop-filter to blur only what is behind it'));
      } else {
        css.push('background: ' + rgba(o.color === '#000000' ? '#ffffff' : o.color, o.alpha) + ';', 'backdrop-filter: blur(' + o.blur + 'px) saturate(160%);', '-webkit-backdrop-filter: blur(' + o.blur + 'px) saturate(160%);', 'border: 1px solid rgba(255, 255, 255, 0.35);', 'border-radius: 16px;');
        style = 'background:' + rgba(o.color === '#000000' ? '#ffffff' : o.color, o.alpha) + ';backdrop-filter:blur(' + o.blur + 'px) saturate(160%);-webkit-backdrop-filter:blur(' + o.blur + 'px) saturate(160%);border:1px solid rgba(255,255,255,.35);border-radius:16px;color:#fff;'; bg = 'linear-gradient(135deg,#6366f1,#ec4899,#f59e0b)';
        issues.push(t('backdrop-filter 는 뒤에 배경(이미지·그라디언트)이 있어야 효과가 보입니다. 지원하지 않는 브라우저용 반투명 배경을 폴백으로 둡니다', 'backdrop-filter only shows when something is behind the element; keep a semi-transparent background as a fallback'));
      }
      var cssText = '.element {\n  ' + css.join('\n  ') + '\n}';
      var inner = e === 'text' ? 'Hello CSS' : 'Preview', pv = '<div style="padding:28px;background:' + (bg.indexOf('gradient') >= 0 ? bg : bg) + ';border-radius:12px;display:flex;justify-content:center"><div style="' + (e === 'text' ? 'padding:12px;' : box) + style.replace(/"/g, '&quot;') + '">' + inner + '</div></div>';
      return { _status: t('✅ CSS 를 만들었습니다', '✅ CSS generated'), out: cssText, preview: pv, issues: issues };
    }
  });
})();
