TK.tool('css-clip-path-generator', {
  inputs: [{ id: 'points', label: ['다각형 꼭짓점 (한 줄에 x% y% 또는 x y)', 'Polygon points (one per line: x% y%)'], rows: 7, sample: '50% 0%\n100% 38%\n82% 100%\n18% 100%\n0% 38%', show: function (o) { return o.shape === 'polygon'; } }],
  options: [
    { id: 'shape', type: 'select', label: ['모양', 'Shape'], choices: [['polygon', ['다각형 (직접 입력)', 'Polygon (custom points)']], ['triangle', ['삼각형', 'Triangle']], ['trapezoid', ['사다리꼴', 'Trapezoid']], ['rhombus', ['마름모', 'Rhombus']], ['pentagon', ['오각형', 'Pentagon']], ['hexagon', ['육각형', 'Hexagon']], ['star', ['별', 'Star']], ['arrow', ['화살표', 'Arrow']], ['circle', 'circle()'], ['ellipse', 'ellipse()'], ['inset', ['inset (둥근 사각형)', 'inset (rounded rectangle)']]], default: 'polygon' },
    { id: 'r', type: 'number', label: ['반지름/크기 (%)', 'Radius / size (%)'], default: 50, min: 1, max: 100, show: function (o) { return o.shape === 'circle' || o.shape === 'ellipse'; } },
    { id: 'cx', type: 'number', label: ['중심 X (%)', 'Centre X (%)'], default: 50, min: 0, max: 100, show: function (o) { return o.shape === 'circle' || o.shape === 'ellipse'; } },
    { id: 'cy', type: 'number', label: ['중심 Y (%)', 'Centre Y (%)'], default: 50, min: 0, max: 100, show: function (o) { return o.shape === 'circle' || o.shape === 'ellipse'; } },
    { id: 'inset', type: 'number', label: ['안쪽 여백 (%)', 'Inset (%)'], default: 10, min: 0, max: 49, show: function (o) { return o.shape === 'inset'; } },
    { id: 'round', type: 'number', label: ['모서리 반경 (px)', 'Corner radius (px)'], default: 24, min: 0, max: 200, show: function (o) { return o.shape === 'inset'; } },
    { id: 'bg', type: 'select', label: ['미리보기 배경', 'Preview background'], choices: [['grad', ['그라디언트', 'Gradient']], ['solid', ['단색', 'Solid']]], default: 'grad' }
  ],
  outputs: [{ id: 'out', label: ['CSS', 'CSS'], kind: 'code', ext: 'css' }, { id: 'preview', label: ['미리보기', 'Preview'], kind: 'html' }, { id: 'table', label: ['꼭짓점', 'Points'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var PRE = { triangle: [[50, 0], [100, 100], [0, 100]], trapezoid: [[20, 0], [80, 0], [100, 100], [0, 100]], rhombus: [[50, 0], [100, 50], [50, 100], [0, 50]], pentagon: [[50, 0], [100, 38], [82, 100], [18, 100], [0, 38]], hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]], star: [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]], arrow: [[0, 20], [60, 20], [60, 0], [100, 50], [60, 100], [60, 80], [0, 80]] };
    var pts = [], issues = [], value;
    if (o.shape === 'polygon') {
      String(v.points || '').replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (ln) {
        var m = /^(-?\d+(?:\.\d+)?)(%|px)?[\s,]+(-?\d+(?:\.\d+)?)(%|px)?$/.exec(ln);
        if (!m) throw new Error(t('꼭짓점을 해석할 수 없습니다: "' + ln + '" (예: 50% 0%)', 'Cannot parse point "' + ln + '" (e.g. 50% 0%)'));
        pts.push([+m[1], m[2] || '%', +m[3], m[4] || '%']);
      });
      if (pts.length < 3) throw new Error(t('꼭짓점이 3개 이상 필요합니다', 'At least 3 points are needed'));
      pts.forEach(function (p, i) { if (p[1] === '%' && (p[0] < -50 || p[0] > 150) || p[3] === '%' && (p[2] < -50 || p[2] > 150)) issues.push(t((i + 1) + '번째 점이 요소 밖으로 많이 벗어났습니다', 'Point ' + (i + 1) + ' is far outside the element')); });
      value = 'polygon(' + pts.map(function (p) { return p[0] + p[1] + ' ' + p[2] + p[3]; }).join(', ') + ')';
      var area = 0; for (var k = 0; k < pts.length; k++) { var a = pts[k], b = pts[(k + 1) % pts.length]; area += a[0] * b[2] - b[0] * a[2]; }
      if (Math.abs(area) < 1) issues.push(t('🚨 모든 점이 일직선 위에 있어 보이는 영역이 없습니다', '🚨 All points are collinear, so nothing would be visible'));
    } else if (PRE[o.shape]) { pts = PRE[o.shape].map(function (p) { return [p[0], '%', p[1], '%']; }); value = 'polygon(' + pts.map(function (p) { return p[0] + '% ' + p[2] + '%'; }).join(', ') + ')'; }
    else if (o.shape === 'circle') value = 'circle(' + o.r + '% at ' + o.cx + '% ' + o.cy + '%)';
    else if (o.shape === 'ellipse') value = 'ellipse(' + o.r + '% ' + Math.round(o.r * 0.6) + '% at ' + o.cx + '% ' + o.cy + '%)';
    else value = 'inset(' + o.inset + '% round ' + o.round + 'px)';
    var bgc = o.bg === 'solid' ? '#3b82f6' : 'linear-gradient(135deg,#f97316,#ec4899,#6366f1)';
    var css = '.element {\n  clip-path: ' + value + ';\n  /* ' + t('Safari 구버전', 'older Safari') + ' */\n  -webkit-clip-path: ' + value + ';\n}';
    var pv = '<div style="padding:20px;background:#f1f5f9;border-radius:12px;display:flex;justify-content:center"><div style="width:220px;height:220px;background:' + bgc + ';clip-path:' + value + ';-webkit-clip-path:' + value + '"></div></div>';
    issues.push(t('clip-path 는 보이는 영역만 잘라내고 클릭 영역도 같이 잘립니다. 그림자(box-shadow)도 잘려 보이므로 filter: drop-shadow() 를 부모에 쓰세요', 'clip-path cuts the visible area and the click area. A box-shadow is clipped too, so use filter: drop-shadow() on a wrapper'));
    issues.push(t('폴리곤 점 개수가 같은 두 clip-path 사이는 transition 으로 부드럽게 변환할 수 있습니다', 'Two polygons with the same number of points can be animated with a transition'));
    var rows = pts.map(function (p, i) { return [String(i + 1), p[0] + p[1], p[2] + p[3]]; });
    return { _status: issues.some(function (x) { return /^🚨/.test(x); }) ? { ok: 'info', msg: t('🔍 확인이 필요합니다', '🔍 Needs attention') } : t('✅ clip-path 를 만들었습니다', '✅ clip-path generated'), out: css, preview: pv, table: rows.length ? { head: [['#', '#'], ['x', 'x'], ['y', 'y']], rows: rows } : null, issues: issues };
  }
});
