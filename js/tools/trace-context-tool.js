TK.tool('trace-context-tool', {
  allowEmpty: true,
  inputs: [
    { id: 'tp', type: 'text', label: ['traceparent 헤더 값', 'traceparent header value'], sample: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01', show: function (o) { return o.mode === 'parse'; } },
    { id: 'ts', type: 'text', label: ['tracestate 헤더 값 (선택)', 'tracestate header value (optional)'], sample: 'congo=t61rcWkgMzE,rojo=00f067aa0ba902b7', show: function (o) { return o.mode === 'parse'; } },
    { id: 'parent', type: 'text', label: ['부모 traceparent (자식 span 만들기)', 'Parent traceparent (to create a child span)'], sample: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01', show: function (o) { return o.mode === 'child'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['parse', ['분석', 'Parse']], ['new', ['새 trace 시작', 'Start a new trace']], ['child', ['자식 span 만들기', 'Create a child span']]], default: 'parse' },
    { id: 'sampled', type: 'checkbox', label: ['sampled 플래그(01) 켜기', 'Set the sampled flag (01)'], default: true, show: function (o) { return o.mode !== 'parse'; } }
  ],
  outputs: [{ id: 'table', label: ['필드', 'Fields'], kind: 'table' }, { id: 'out', label: ['헤더', 'Headers'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var B = TK.bytes, H = TK.hash, issues = [];
    function rnd(n) { var s; do { s = H.hex(B.random(n)); } while (/^0+$/.test(s)); return s; }
    function parseTp(s) {
      s = String(s || '').trim(); var m = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-.*)?$/.exec(s);
      if (!m) { var up = /^[0-9A-F-]+$/.test(s) && /[A-F]/.test(s); throw new Error(up ? t('16진수는 소문자여야 합니다 (대문자 불가)', 'Hex must be lowercase (uppercase is not allowed)') : t('traceparent 형식이 아닙니다 — version-traceid(32)-parentid(16)-flags 이어야 합니다', 'Not a traceparent — expected version-traceid(32)-parentid(16)-flags')); }
      return { version: m[1], trace: m[2], span: m[3], flags: m[4], rest: m[5] || '' };
    }
    function check(p) {
      if (p.version === 'ff') issues.push(t('🚨 version ff 는 유효하지 않습니다', '🚨 version ff is invalid'));
      if (/^0+$/.test(p.trace)) issues.push(t('🚨 trace-id 가 모두 0이면 무효입니다', '🚨 an all-zero trace-id is invalid'));
      if (/^0+$/.test(p.span)) issues.push(t('🚨 parent-id(span-id)가 모두 0이면 무효입니다', '🚨 an all-zero parent-id is invalid'));
      if (p.version === '00' && p.rest) issues.push(t('🚨 version 00 은 뒤에 추가 필드가 있으면 안 됩니다', '🚨 version 00 must not have extra fields'));
      if (p.version !== '00' && p.version !== 'ff') issues.push(t('알 수 없는 버전 ' + p.version + ' — 수신 측은 00 형식으로 읽도록 되어 있습니다', 'Unknown version ' + p.version + ' — receivers fall back to parsing as 00'));
    }
    function rows(p) {
      var f = parseInt(p.flags, 16);
      return [['version', p.version], ['trace-id', p.trace], ['parent-id (span)', p.span], ['trace-flags', p.flags + ' (0b' + ('00000000' + f.toString(2)).slice(-8) + ')'], ['sampled', (f & 1) ? t('예 — 이 trace 를 기록·내보내기', 'yes — record / export this trace') : t('아니오 — 샘플링되지 않음', 'no — not sampled')], ['random-trace-id', (f & 2) ? t('예 (trace-id 의 오른쪽 7바이트가 무작위)', 'yes (the right-most 7 bytes are random)') : t('아니오/알 수 없음', 'no / unknown')]];
    }
    if (o.mode === 'new' || o.mode === 'child') {
      var p;
      if (o.mode === 'new') p = { version: '00', trace: rnd(16), span: rnd(8), flags: o.sampled ? '01' : '00', rest: '' };
      else { var par = parseTp(v.parent); check(par); p = { version: '00', trace: par.trace, span: rnd(8), flags: o.sampled ? (('0' + (parseInt(par.flags, 16) | 1).toString(16)).slice(-2)) : par.flags, rest: '' }; }
      var hdr = p.version + '-' + p.trace + '-' + p.span + '-' + p.flags;
      var oc = 'curl -H "traceparent: ' + hdr + '" https://api.example.com/';
      var b3 = 'X-B3-TraceId: ' + p.trace + '\nX-B3-SpanId: ' + p.span + '\nX-B3-Sampled: ' + (parseInt(p.flags, 16) & 1) + (o.mode === 'child' ? '\nX-B3-ParentSpanId: ' + parseTp(v.parent).span : '');
      var dd = 'x-datadog-trace-id: ' + BigInt('0x' + p.trace.slice(16)).toString() + '\nx-datadog-parent-id: ' + BigInt('0x' + p.span).toString();
      issues.push(t('span-id 와 trace-id 는 암호학적 난수로 만들었습니다. 자식 span 은 trace-id 를 그대로 두고 span-id 만 새로 만듭니다', 'IDs come from a cryptographic random source. A child span keeps the trace-id and gets a new span-id'));
      issues.push(t('B3(Zipkin)·Datadog 헤더는 참고용 변환입니다 (Datadog 은 trace-id 하위 64비트 십진수)', 'B3 (Zipkin) and Datadog headers are reference conversions (Datadog uses the lower 64 bits in decimal)'));
      return { _status: t('✅ ' + (o.mode === 'new' ? '새 trace' : '자식 span') + ' 생성 완료', '✅ ' + (o.mode === 'new' ? 'New trace' : 'Child span') + ' created'), table: { head: [['필드', 'Field'], ['값', 'Value']], rows: rows(p) }, out: 'traceparent: ' + hdr + '\n\n# curl\n' + oc + '\n\n# B3\n' + b3 + '\n\n# Datadog\n' + dd, issues: issues };
    }
    var p0 = parseTp(v.tp); check(p0);
    var rws = rows(p0), ts = String(v.ts || '').trim();
    if (ts) {
      var entries = ts.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      entries.forEach(function (e, i) { var j = e.indexOf('='); if (j < 1) { issues.push(t('⚠️ tracestate 항목 형식 오류(tracestate 만 무시됨): ' + e, '⚠️ Malformed tracestate entry (only tracestate is dropped): ' + e)); return; } var k = e.slice(0, j), val = e.slice(j + 1); if (!/^[a-z][a-z0-9_\-*\/]{0,255}(@[a-z][a-z0-9_\-*\/]{0,13})?$/.test(k)) issues.push(t('tracestate 키 형식이 올바르지 않습니다: ' + k, 'Invalid tracestate key: ' + k)); if (!/^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/.test(val)) issues.push(t('tracestate 값 형식이 올바르지 않습니다: ' + k, 'Invalid tracestate value: ' + k)); rws.push(['tracestate[' + (i + 1) + ']', k + ' = ' + val]); });
      if (entries.length > 32) issues.push(t('⚠️ tracestate 항목은 최대 32개입니다', '⚠️ tracestate allows at most 32 entries'));
      if (ts.length > 512) issues.push(t('tracestate 는 512자를 넘으면 잘릴 수 있습니다', 'tracestate over 512 characters may be truncated'));
    }
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 유효하지 않은 traceparent', '❌ Invalid traceparent') } : t('✅ 유효한 traceparent 입니다', '✅ Valid traceparent'), table: { head: [['필드', 'Field'], ['값', 'Value']], rows: rws }, out: 'traceparent: ' + v.tp.trim() + (ts ? '\ntracestate: ' + ts : ''), issues: issues };
  }
});
