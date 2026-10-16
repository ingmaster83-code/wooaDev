TK.tool('cubic-bezier-editor', {
  inputs: [{ id: 'in', type: 'text', label: ['cubic-bezier(x1, y1, x2, y2) 또는 키워드', 'cubic-bezier(x1, y1, x2, y2) or keyword'], sample: 'cubic-bezier(0.34, 1.56, 0.64, 1)', placeholder: ['ease, ease-in-out, 0.25 0.1 0.25 1 …', 'ease, ease-in-out, 0.25 0.1 0.25 1 …'] }],
  options: [
    { id: 'dur', type: 'number', label: ['지속 시간 (ms)', 'Duration (ms)'], default: 600, min: 50, max: 10000 },
    { id: 'samples', type: 'number', label: ['표에 표시할 지점 수', 'Rows in the table'], default: 11, min: 3, max: 41 }
  ],
  outputs: [{ id: 'preview', label: ['곡선 미리보기', 'Curve preview'], kind: 'html' }, { id: 'out', label: ['CSS', 'CSS'], kind: 'code', ext: 'css' }, { id: 'table', label: ['진행도 표', 'Progress table'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var KW = { linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1], 'ease-in-sine': [0.12, 0, 0.39, 0], 'ease-out-sine': [0.61, 1, 0.88, 1], 'ease-in-quad': [0.11, 0, 0.5, 0], 'ease-out-quad': [0.5, 1, 0.89, 1], 'ease-in-cubic': [0.32, 0, 0.67, 0], 'ease-out-cubic': [0.33, 1, 0.68, 1], 'ease-in-quart': [0.5, 0, 0.75, 0], 'ease-out-quart': [0.25, 1, 0.5, 1], 'ease-in-expo': [0.7, 0, 0.84, 0], 'ease-out-expo': [0.16, 1, 0.3, 1], 'ease-in-back': [0.36, 0, 0.66, -0.56], 'ease-out-back': [0.34, 1.56, 0.64, 1], 'ease-in-out-back': [0.68, -0.6, 0.32, 1.6] };
    var s = String(v.in || '').trim().toLowerCase(), issues = [], p, m;
    if (!s) throw new Error(t('값을 입력하세요', 'Enter a value'));
    if (KW[s]) p = KW[s];
    else if ((m = /^steps\(\s*(\d+)\s*(?:,\s*([a-z-]+))?\s*\)$/.exec(s))) {
      var n = +m[1]; if (n < 1) throw new Error(t('steps 의 개수는 1 이상이어야 합니다', 'steps() needs at least 1 step'));
      var jump = m[2] || 'end', rows = [], svg = '<svg viewBox="-6 -6 112 112" width="260" height="260" style="background:#f8fafc;border-radius:8px"><rect x="0" y="0" width="100" height="100" fill="none" stroke="#cbd5e1"/>', pathD = 'M0,100';
      function stepVal(x) { var k = Math.floor(x * n); var total = jump === 'jump-both' ? n + 1 : jump === 'jump-none' ? n - 1 : n; var base = jump === 'start' || jump === 'jump-start' || jump === 'jump-both' ? k + 1 : k; if (x >= 1) return 1; var val = base / (total || 1); return Math.min(1, val); }
      for (var i = 0; i <= 100; i++) { var x = i / 100, y = stepVal(x); pathD += ' L' + i + ',' + (100 - y * 100).toFixed(1); }
      svg += '<path d="' + pathD + '" fill="none" stroke="#2563eb" stroke-width="2"/></svg>';
      for (var j = 0; j < Math.min(o.samples, 41); j++) { var xx = j / (o.samples - 1); rows.push([Math.round(xx * 100) + '%', Math.round(xx * o.dur) + ' ms', (stepVal(xx) * 100).toFixed(1) + '%']); }
      issues.push(t('steps() 는 스프라이트 애니메이션·타자기 효과에 씁니다. jump 종류: start, end(기본), both, none', 'steps() suits sprite sheets and typewriter effects. Jump terms: start, end (default), both, none'));
      return { _status: t('✅ steps(' + n + ', ' + jump + ')', '✅ steps(' + n + ', ' + jump + ')'), preview: svg, out: 'animation-timing-function: steps(' + n + ', ' + jump + ');\ntransition: transform ' + o.dur + 'ms steps(' + n + ', ' + jump + ');', table: { head: [['시간', 'Time'], ['경과', 'Elapsed'], ['진행도', 'Progress']], rows: rows }, issues: issues };
    }
    else {
      var nums = s.replace(/^cubic-bezier\(|\)$/g, '').split(/[\s,]+/).filter(Boolean).map(Number);
      if (nums.length !== 4 || nums.some(isNaN)) throw new Error(t('숫자 4개(x1, y1, x2, y2) 또는 키워드를 입력하세요', 'Enter four numbers (x1, y1, x2, y2) or a keyword'));
      p = nums;
    }
    if (p[0] < 0 || p[0] > 1 || p[2] < 0 || p[2] > 1) throw new Error(t('x1, x2 는 0~1 범위여야 합니다 (CSS 규격). 현재 ' + p[0] + ', ' + p[2], 'x1 and x2 must be within 0–1 (CSS spec). Now ' + p[0] + ', ' + p[2]));
    var x1 = p[0], y1 = p[1], x2 = p[2], y2 = p[3];
    function bez(a, b, tt) { var u = 1 - tt; return 3 * u * u * tt * a + 3 * u * tt * tt * b + tt * tt * tt; }
    function yAt(x) { var lo = 0, hi = 1, tt = x; for (var k = 0; k < 40; k++) { tt = (lo + hi) / 2; var bx = bez(x1, x2, tt); if (bx < x) lo = tt; else hi = tt; } return bez(y1, y2, tt); }
    var pathD2 = '', N = 80; for (var q = 0; q <= N; q++) { var tt2 = q / N; pathD2 += (q ? ' L' : 'M') + (bez(x1, x2, tt2) * 100).toFixed(1) + ',' + (100 - bez(y1, y2, tt2) * 100).toFixed(1); }
    var ys = [y1, y2, 0, 1], ymin = 0, ymax = 1; for (var z = 0; z <= 100; z++) { var yy = yAt(z / 100); if (yy < ymin) ymin = yy; if (yy > ymax) ymax = yy; }
    var vbY = Math.min(0, ymin) * 100 - 6, vbH = (Math.max(1, ymax) - Math.min(0, ymin)) * 100 + 12;
    function sy(y) { return (100 - y * 100).toFixed(1); }
    var svg2 = '<svg viewBox="-6 ' + (-(Math.max(1, ymax)) * 100 + 100 - 6) + ' 112 ' + vbH.toFixed(0) + '" width="260" height="' + Math.round(260 * vbH / 112) + '" style="background:#f8fafc;border-radius:8px"><rect x="0" y="0" width="100" height="100" fill="none" stroke="#cbd5e1"/><line x1="0" y1="100" x2="' + (x1 * 100) + '" y2="' + sy(y1) + '" stroke="#f97316" stroke-width="1.2"/><line x1="100" y1="0" x2="' + (x2 * 100) + '" y2="' + sy(y2) + '" stroke="#f97316" stroke-width="1.2"/><circle cx="' + (x1 * 100) + '" cy="' + sy(y1) + '" r="3.5" fill="#f97316"/><circle cx="' + (x2 * 100) + '" cy="' + sy(y2) + '" r="3.5" fill="#f97316"/><path d="' + pathD2 + '" fill="none" stroke="#2563eb" stroke-width="2.4"/></svg>';
    var val = 'cubic-bezier(' + p.map(function (x) { return Math.round(x * 1000) / 1000; }).join(', ') + ')';
    var name = Object.keys(KW).filter(function (k) { return KW[k].join() === p.join(); })[0];
    var rows2 = [], ns = Math.max(3, Math.min(41, Math.round(o.samples) || 11));
    for (var r = 0; r < ns; r++) { var xx2 = r / (ns - 1), y = yAt(xx2); rows2.push([Math.round(xx2 * 100) + '%', Math.round(xx2 * o.dur) + ' ms', (y * 100).toFixed(1) + '%' + (y > 1.0005 ? ' ↑' + t('(넘침)', ' (overshoot)') : y < -0.0005 ? ' ↓' + t('(되돌림)', ' (anticipation)') : '')]); }
    if (ymax > 1.001) issues.push(t('y 값이 1을 넘어 목표를 지나쳤다 돌아오는 오버슈트(탄성) 곡선입니다 (최대 ' + (ymax * 100).toFixed(1) + '%)', 'y exceeds 1: the animation overshoots the target and comes back (max ' + (ymax * 100).toFixed(1) + '%)'));
    if (ymin < -0.001) issues.push(t('y 값이 0 아래로 내려가 시작 전에 반대 방향으로 움직입니다(예비 동작)', 'y dips below 0 so the motion first moves backwards (anticipation)'));
    var ease = (p[1] === 0 && p[3] === 1 && p[0] < 0.5 && p[2] > 0.5) ? t('천천히 시작해 천천히 끝나는 ease-in-out 계열', 'an ease-in-out family curve') : p[1] >= p[0] && p[3] >= p[2] ? t('빠르게 시작해 느려지는 ease-out 계열', 'an ease-out family curve (fast start, slow end)') : t('느리게 시작해 빨라지는 ease-in 계열', 'an ease-in family curve (slow start, fast end)');
    issues.push(t('이 곡선은 ' + ease, 'This curve is ' + ease));
    issues.push(t('transition-timing-function 은 단계 전체가 아니라 키프레임 구간마다 적용됩니다 (animation 은 각 구간에서 다시 시작)', 'In @keyframes the timing function applies per keyframe interval, not to the whole animation'));
    var css = (name ? '/* ' + name + ' */\n' : '') + 'transition: transform ' + o.dur + 'ms ' + val + ';\n\n@keyframes move {\n  from { transform: translateX(0); }\n  to   { transform: translateX(200px); }\n}\n.box { animation: move ' + o.dur + 'ms ' + val + ' forwards; }\n\n/* JS (Web Animations API) */\nel.animate([{ transform: "translateX(0)" }, { transform: "translateX(200px)" }], { duration: ' + o.dur + ', easing: "' + val + '", fill: "forwards" });';
    return { _status: t('✅ ' + val + (name ? ' (= ' + name + ')' : ''), '✅ ' + val + (name ? ' (= ' + name + ')' : '')), preview: svg2, out: css, table: { head: [['시간', 'Time'], ['경과', 'Elapsed'], ['진행도', 'Progress']], rows: rows2 }, issues: issues };
  }
});
