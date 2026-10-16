TK.tool('mqtt-topic-tester', {
  inputs: [
    { id: 'filters', label: ['구독 필터 (한 줄에 하나)', 'Subscription filters (one per line)'], rows: 5, sample: 'sensors/+/temperature\nsensors/#\n+/+/temperature\n#\n$SYS/#\nhome/livingroom/+' },
    { id: 'topics', label: ['발행 토픽 (한 줄에 하나)', 'Published topics (one per line)'], rows: 8, sample: 'sensors/room1/temperature\nsensors/room1/humidity\nsensors/room1/floor2/temperature\nhome/livingroom/light\nhome/livingroom\n$SYS/broker/uptime\n/sensors/room1/temperature' }
  ],
  options: [],
  outputs: [{ id: 'table', label: ['일치 행렬', 'Match matrix'], kind: 'table' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    function lines(s) { return String(s).replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x.length; }); }
    var F = lines(v.filters), T = lines(v.topics), issues = [];
    if (!F.length || !T.length) throw new Error(t('필터와 토픽을 모두 입력하세요', 'Enter both filters and topics'));
    function checkFilter(f) {
      var p = [], lv = f.split('/');
      if (Buffer_len(f) > 65535) p.push(t('65,535바이트를 넘습니다', 'Longer than 65,535 bytes'));
      lv.forEach(function (l, i) {
        if (l.indexOf('#') >= 0 && l !== '#') p.push(t('# 는 레벨 전체여야 합니다: "' + l + '"', '# must be a whole level: "' + l + '"'));
        if (l === '#' && i !== lv.length - 1) p.push(t('# 는 마지막 레벨에만 쓸 수 있습니다', '# is only allowed as the last level'));
        if (l.indexOf('+') >= 0 && l !== '+') p.push(t('+ 는 레벨 전체여야 합니다: "' + l + '"', '+ must be a whole level: "' + l + '"'));
      });
      if (/\u0000/.test(f)) p.push(t('NUL 문자 불가', 'No NUL characters'));
      return p;
    }
    function Buffer_len(s) { return new TextEncoder().encode(s).length; }
    function checkTopic(tp) {
      var p = []; if (/[#+]/.test(tp)) p.push(t('발행 토픽에는 와일드카드(+, #)를 쓸 수 없습니다', 'Published topics cannot contain wildcards (+, #)'));
      if (Buffer_len(tp) > 65535) p.push(t('65,535바이트 초과', 'Over 65,535 bytes'));
      return p;
    }
    function match(f, tp) {
      var fl = f.split('/'), tl = tp.split('/');
      if (/^[+#]/.test(f) && tp[0] === '$') return false;
      for (var i = 0; i < fl.length; i++) {
        if (fl[i] === '#') return true;
        if (i >= tl.length) return false;
        if (fl[i] !== '+' && fl[i] !== tl[i]) return false;
      }
      return fl.length === tl.length;
    }
    var fprobs = {}, bad = 0;
    F.forEach(function (f) { var p = checkFilter(f); if (p.length) { fprobs[f] = p; bad++; issues.push('🚨 ' + t('필터 "' + f + '": ', 'Filter "' + f + '": ') + p.join(', ')); } });
    T.forEach(function (tp) { var p = checkTopic(tp); if (p.length) { bad++; issues.push('🚨 ' + t('토픽 "' + tp + '": ', 'Topic "' + tp + '": ') + p.join(', ')); } });
    var head = [['토픽', 'Topic']].concat(F.map(function (f) { return [f, f]; })), rows = T.map(function (tp) {
      var bad2 = checkTopic(tp).length > 0;
      return [tp + (bad2 ? ' ❌' : '')].concat(F.map(function (f) { return fprobs[f] || bad2 ? '❌' : match(f, tp) ? '✅' : '·'; }));
    });
    if (T.some(function (x) { return x[0] === '/'; })) issues.push(t('앞에 /가 붙은 토픽("/a")은 첫 레벨이 빈 문자열이라 "a" 와 다른 토픽입니다', 'A leading slash ("/a") gives an empty first level, so it is a different topic from "a"'));
    if (F.some(function (f) { return /^[+#]/.test(f); }) && T.some(function (x) { return x[0] === '$'; })) issues.push(t('# 나 +/… 로 시작하는 필터는 $ 로 시작하는 토픽($SYS 등)과 일치하지 않습니다 — $SYS/# 처럼 명시해야 합니다', 'A filter starting with # or + never matches topics that begin with $ ($SYS …); subscribe to $SYS/# explicitly'));
    if (F.indexOf('#') >= 0) issues.push(t('# 구독은 모든 메시지를 받아 부하가 크고 보안상 위험합니다 (ACL 로 제한 권장)', 'A # subscription receives everything — heavy and risky; restrict it with ACLs'));
    if (F.some(function (f) { return f.split('/').length > 8; })) issues.push(t('토픽 레벨이 깊습니다(8 초과) — 브로커 성능과 가독성이 떨어집니다', 'Deep topic hierarchy (> 8 levels) hurts broker performance and readability'));
    issues.push(t('토픽은 대소문자를 구분합니다. sensors/# 는 부모 토픽 "sensors" 자체도 일치시킵니다', 'Topics are case-sensitive; sensors/# also matches the parent topic "sensors" itself'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: bad ? { ok: false, msg: t('❌ 문법 오류 ' + bad + '건', '❌ ' + bad + ' syntax problem(s)') } : t('✅ 필터 ' + F.length + '개 × 토픽 ' + T.length + '개 판정', '✅ Tested ' + F.length + ' filters × ' + T.length + ' topics'), table: { head: head, rows: rows }, issues: uniq };
  }
});
