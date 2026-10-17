TK.tool('promql-tools', {
  sampleExpectError: true,
  inputs: [{ id: 'in', label: ['PromQL 식', 'PromQL expression'], rows: 8, sample: 'histogram_quantile(0.95, sum by (job) (rate(http_request_duration_seconds_bucket{job=~"api.*", status!~"5.."}[5m]))) > 0.5\nand on(job) sum by (job) (rate(http_requests_total[30s])) > 100' }],
  options: [
    { id: 'width', type: 'number', label: ['한 줄 최대 너비 (넘으면 줄바꿈)', 'Max line width before wrapping'], default: 80, min: 20, max: 400 },
    { id: 'hints', type: 'checkbox', label: ['권고(ℹ️)도 표시', 'Also show hints (ℹ️)'], default: true }
  ],
  outputs: [{ id: 'fmt', label: ['정리된 PromQL', 'Formatted PromQL'], kind: 'code', ext: 'promql' }, { id: 'steps', label: ['단계별 설명 (안쪽부터)', 'Step-by-step explanation (inside out)'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'tree', label: ['구문 트리', 'Syntax tree'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var P = TK.promql, src = String(v['in'] || '');
    if (!src.trim()) throw new Error(t('PromQL 식을 입력하세요', 'Enter a PromQL expression'));
    var ast;
    try { ast = P.parse(src); } catch (e) { throw new Error(t('구문 오류: ', 'Syntax error: ') + e.message); }
    var errs = P.check(ast), top = P.typeOf(ast), lint = P.lint(ast), issues = [];
    errs.forEach(function (e) { issues.push('⛔ ' + e.msg); });
    if (!errs.length && top === 'r') issues.push('⛔ ' + t('식의 최종 결과가 레인지 벡터입니다. 그래프/알림 쿼리에는 스칼라나 인스턴트 벡터가 필요합니다 (rate() 등으로 변환하거나 서브쿼리를 쓰세요)', 'The final result is a range vector; graphs and alerts need a scalar or instant vector (wrap it in rate() etc. or use a subquery)'));
    if (!errs.length && top === 't') issues.push('ℹ️ ' + t('문자열 결과는 Prometheus 쿼리 API 에서만 반환됩니다', 'A string result is only returned by the query API'));
    lint.forEach(function (x) { if (x.sev !== 'info' || o.hints !== false) issues.push((x.sev === 'error' ? '⛔ ' : x.sev === 'warn' ? '⚠️ ' : 'ℹ️ ') + x.msg); });
    var order = function (s) { return s.indexOf('⛔') === 0 ? 0 : s.indexOf('⚠️') === 0 ? 1 : 2; };
    issues.sort(function (a, b) { return order(a) - order(b); });
    var nErr = issues.filter(function (s) { return s.indexOf('⛔') === 0; }).length, nWarn = issues.filter(function (s) { return s.indexOf('⚠️') === 0; }).length;
    var typeNames = { i: ['instant vector', '인스턴트 벡터'], r: ['range vector', '레인지 벡터'], s: ['scalar', '스칼라'], t: ['string', '문자열'] }[top];
    return { _status: { ok: nErr ? false : true, msg: nErr ? t('⛔ 오류 ' + nErr + '건 · 경고 ' + nWarn + '건 — 결과 타입 ' + typeNames[1], '⛔ ' + nErr + ' error(s), ' + nWarn + ' warning(s) - result type ' + typeNames[0]) : t('✅ 올바른 PromQL — 결과 타입 ' + typeNames[1] + (nWarn ? ' · 경고 ' + nWarn + '건' : ''), '✅ Valid PromQL - result type ' + typeNames[0] + (nWarn ? ' · ' + nWarn + ' warning(s)' : '')) }, fmt: P.print(ast, Number(o.width) || 80, 0), steps: { head: [['#', '#'], ['식', 'Expression'], ['타입', 'Type'], ['의미', 'Meaning']], rows: P.steps(ast) }, issues: issues, tree: P.tree(ast, 0) };
  }
});
