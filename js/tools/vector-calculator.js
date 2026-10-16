TK.tool('vector-calculator', {
  inputs: [
    { id: 'a', label: ['벡터 A (쉼표·공백·JSON 배열)', 'Vector A (comma, space or JSON array)'], rows: 3, sample: '[0.12, -0.53, 0.91, 0.07, 0.44]' },
    { id: 'b', label: ['벡터 B', 'Vector B'], rows: 3, sample: '0.10, -0.48, 0.85, 0.20, 0.39' },
    { id: 'more', label: ['비교할 다른 벡터들 (한 줄에 하나, 선택)', 'More vectors to compare (one per line, optional)'], rows: 4, sample: '0.9 0.1 -0.2 0.5 0.0\n-0.12, 0.53, -0.91, -0.07, -0.44' }
  ],
  options: [{ id: 'prec', type: 'number', label: ['소수 자릿수', 'Decimal places'], default: 6, min: 2, max: 12 }],
  outputs: [{ id: 'table', label: ['유사도 · 거리', 'Similarity & distance'], kind: 'table' }, { id: 'rank', label: ['A 와 비교한 순위', 'Ranking against A'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    function parse(s, name) {
      s = String(s || '').trim(); if (!s) return null;
      var arr; try { var j = JSON.parse(s); arr = Array.isArray(j) ? j : null; if (arr && Array.isArray(arr[0])) arr = null; } catch (e) { arr = null; }
      if (!arr) arr = s.replace(/[\[\]()]/g, ' ').split(/[\s,;]+/).filter(Boolean).map(Number);
      if (!arr.length || arr.some(function (x) { return typeof x !== 'number' || !isFinite(x); })) throw new Error(t(name + ' 에 숫자가 아닌 값이 있습니다', name + ' contains a non-numeric value'));
      return arr;
    }
    var A = parse(v.a, 'A'), B = parse(v.b, 'B'), P = Math.round(o.prec) || 6, issues = [];
    if (!A || !B) throw new Error(t('벡터 A 와 B 를 모두 입력하세요', 'Enter both vector A and B'));
    function dot(x, y) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i] * y[i]; return s; }
    function norm(x) { return Math.sqrt(dot(x, x)); }
    function f(x) { return (Math.round(x * Math.pow(10, P)) / Math.pow(10, P)).toString(); }
    if (A.length !== B.length) throw new Error(t('차원이 다릅니다: A ' + A.length + ', B ' + B.length, 'Dimensions differ: A ' + A.length + ', B ' + B.length));
    var na = norm(A), nb = norm(B), d = dot(A, B);
    if (!na || !nb) issues.push('🚨 ' + t('영벡터가 있어 코사인 유사도가 정의되지 않습니다', 'A zero vector makes cosine similarity undefined'));
    var cos = na && nb ? d / (na * nb) : NaN, eu = Math.sqrt(A.reduce(function (s, x, i) { return s + (x - B[i]) * (x - B[i]); }, 0)), man = A.reduce(function (s, x, i) { return s + Math.abs(x - B[i]); }, 0), cheb = Math.max.apply(null, A.map(function (x, i) { return Math.abs(x - B[i]); }));
    var ang = isNaN(cos) ? NaN : Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    var rows = [[t('차원', 'dimensions'), String(A.length)], ['|A| (L2)', f(na)], ['|B| (L2)', f(nb)], [t('내적 A·B', 'dot product A·B'), f(d)], [t('코사인 유사도', 'cosine similarity'), isNaN(cos) ? '—' : f(cos)], [t('코사인 거리 (1 − cos)', 'cosine distance (1 − cos)'), isNaN(cos) ? '—' : f(1 - cos)], [t('사잇각', 'angle'), isNaN(ang) ? '—' : f(ang) + '°'], [t('유클리드 거리 (L2)', 'Euclidean distance (L2)'), f(eu)], [t('맨해튼 거리 (L1)', 'Manhattan distance (L1)'), f(man)], [t('체비쇼프 거리 (L∞)', 'Chebyshev distance (L∞)'), f(cheb)]];
    if (na && nb) { var ua = A.map(function (x) { return x / na; }), ub = B.map(function (x) { return x / nb; }); rows.push([t('정규화된 A·B 의 유클리드 거리', 'Euclidean distance of the normalised vectors'), f(Math.sqrt(ua.reduce(function (s, x, i) { return s + (x - ub[i]) * (x - ub[i]); }, 0)))]); if (Math.abs(na - 1) < 1e-3 && Math.abs(nb - 1) < 1e-3) issues.push(t('두 벡터가 이미 정규화(길이 1)되어 있어 내적 = 코사인 유사도입니다', 'Both vectors are unit length, so the dot product equals the cosine similarity')); }
    var rank = [];
    String(v.more || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (ln, i) {
      try { var C = parse(ln, '#' + (i + 1)); if (C.length !== A.length) { rank.push(['#' + (i + 1), '—', '—', '❌ ' + t('차원 ' + C.length, 'dim ' + C.length)]); return; } var nc = norm(C), c2 = na && nc ? dot(A, C) / (na * nc) : NaN; rank.push(['#' + (i + 1), isNaN(c2) ? NaN : c2, Math.sqrt(A.reduce(function (s, x, k) { return s + (x - C[k]) * (x - C[k]); }, 0)), ln.length > 40 ? ln.slice(0, 37) + '…' : ln]); } catch (e) { rank.push(['#' + (i + 1), '—', '—', '❌ ' + e.message]); }
    });
    rank.push(['B', cos, eu, t('벡터 B', 'vector B')]);
    rank.sort(function (x, y) { return (isNaN(y[1]) ? -2 : typeof y[1] === 'number' ? y[1] : -3) - (isNaN(x[1]) ? -2 : typeof x[1] === 'number' ? x[1] : -3); });
    var rrows = rank.map(function (r, i) { return [String(i + 1), r[0], typeof r[1] === 'number' && !isNaN(r[1]) ? f(r[1]) : '—', typeof r[2] === 'number' ? f(r[2]) : '—', r[3]]; });
    if (!isNaN(cos)) issues.push(t(cos > 0.9 ? '매우 비슷한 방향입니다 (cos > 0.9)' : cos > 0.5 ? '어느 정도 비슷합니다' : cos > 0 ? '약한 유사성' : cos > -0.5 ? '거의 관련이 없습니다' : '정반대에 가까운 방향입니다', cos > 0.9 ? 'Very similar direction (cos > 0.9)' : cos > 0.5 ? 'Moderately similar' : cos > 0 ? 'Weakly similar' : cos > -0.5 ? 'Mostly unrelated' : 'Close to opposite directions'));
    issues.push(t('코사인 유사도는 길이를 무시하고 방향만 비교합니다. 임베딩 검색에서는 정규화된 벡터의 내적과 같아 가장 흔히 쓰입니다', 'Cosine similarity ignores length and compares direction only; for normalised embeddings it equals the dot product and is the usual choice for search'));
    issues.push(t('유클리드 거리는 크기 차이에 민감합니다. 정규화하면 코사인과 순위가 같아집니다 (d² = 2 − 2cos)', 'Euclidean distance is sensitive to magnitude; after normalising it ranks like cosine (d² = 2 − 2cos)'));
    if (A.length > 1000) issues.push(t('차원이 높습니다(' + A.length + '). 고차원에서는 거리들이 비슷해지는 "차원의 저주"가 생길 수 있습니다', 'High dimension (' + A.length + '): distances tend to concentrate (curse of dimensionality)'));
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 영벡터', '❌ Zero vector') } : t('✅ cosine = ' + f(cos) + ' · L2 = ' + f(eu), '✅ cosine = ' + f(cos) + ' · L2 = ' + f(eu)), table: { head: [['지표', 'Metric'], ['값', 'Value']], rows: rows }, rank: rank.length > 1 ? { head: [['순위', 'Rank'], ['벡터', 'Vector'], ['코사인', 'Cosine'], ['유클리드', 'Euclidean'], ['값', 'Values']], rows: rrows } : null, issues: issues };
  }
});
