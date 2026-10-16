TK.tool('stack-trace-formatter', {
  inputs: [{ id: 'trace', label: ['스택 트레이스 (Java · Python · Node.js/브라우저 · .NET · Go · Ruby · PHP)', 'Stack trace (Java, Python, Node.js / browser, .NET, Go, Ruby, PHP)'], rows: 14, sample: 'java.lang.IllegalStateException: Order 42 is already shipped\n\tat com.shop.order.OrderService.ship(OrderService.java:88)\n\tat com.shop.order.OrderController.ship(OrderController.java:41)\n\tat jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n\tat org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:883)\n\tat org.apache.catalina.core.StandardWrapper.invoke(StandardWrapper.java:200)\nCaused by: java.sql.SQLException: Deadlock found when trying to get lock\n\tat com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:129)\n\tat com.shop.order.OrderRepository.update(OrderRepository.java:57)\n\t... 12 more' }],
  options: [{ id: 'app', type: 'text', label: ['내 코드 패키지/경로 접두사 (쉼표 구분)', 'Your code prefixes (comma separated)'], default: 'com.shop' }],
  outputs: [{ id: 'table', label: ['프레임', 'Frames'], kind: 'table' }, { id: 'out', label: ['정리된 트레이스', 'Cleaned trace'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var text = String(v.trace).replace(/\r/g, ''), lines = text.split('\n'), issues = [];
    if (!text.trim()) throw new Error(t('스택 트레이스를 입력하세요', 'Enter a stack trace'));
    var lang = '';
    if (/^\s*at .+\(.+\.java:\d+\)|^\s*at .+\(Native Method\)|Exception in thread|^Caused by:/m.test(text)) lang = 'Java';
    else if (/^Traceback \(most recent call last\):|^\s+File ".+", line \d+/m.test(text)) lang = 'Python';
    else if (/^\s+at .+ \(.+:\d+:\d+\)|^\s+at .+:\d+:\d+$|@.+:\d+:\d+$/m.test(text)) lang = 'JavaScript';
    else if (/^\s+at .+ in .+:line \d+|^\s+at [\w.`+<>]+\(.*\)$/m.test(text) && /System\.|Microsoft\./.test(text)) lang = '.NET';
    else if (/^goroutine \d+ \[|^\s+\/.+\.go:\d+/m.test(text)) lang = 'Go';
    else if (/^\s*from .+:\d+:in `|^.+\.rb:\d+:in `/m.test(text)) lang = 'Ruby';
    else if (/^#\d+ .+\(\d+\)|Stack trace:/m.test(text)) lang = 'PHP';
    if (!lang) throw new Error(t('언어를 판별할 수 없습니다 — 각 줄이 "at … (파일:줄)" 등의 스택 프레임 형식인지 확인하세요', 'Cannot detect the language — check that frames look like "at … (file:line)"'));
    var prefixes = String(o.app || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var frames = [], headers = [], cause = 0, cur = 'main';
    function isApp(s) { return prefixes.some(function (p) { return s.indexOf(p) >= 0; }); }
    lines.forEach(function (ln) {
      var m;
      if (lang === 'Java') {
        if ((m = /^\s*at (.+?)\((.+?)(?::(\d+))?\)\s*$/.exec(ln))) frames.push({ grp: cur, fn: m[1], file: m[2], line: m[3] || '', col: '', raw: ln });
        else if ((m = /^\s*\.\.\. (\d+) (more|common frames omitted)/.exec(ln))) frames.push({ grp: cur, fn: '… ' + m[1] + ' ' + t('프레임 생략', 'frames omitted'), file: '', line: '', skip: 1 });
        else if (ln.trim() && !/^\s/.test(ln)) { cause += /^Caused by:/.test(ln) ? 1 : 0; cur = /^Caused by:/.test(ln) ? 'cause' + cause : (cur === 'main' ? 'main' : cur); headers.push({ grp: cur, text: ln }); }
      } else if (lang === 'Python') {
        if ((m = /^\s+File "(.+)", line (\d+)(?:, in (.+))?$/.exec(ln))) frames.push({ grp: cur, fn: m[3] || '<module>', file: m[1], line: m[2], col: '', raw: ln });
        else if (ln.trim() && !/^\s/.test(ln) && !/^Traceback/.test(ln)) { headers.push({ grp: cur, text: ln }); if (/^During handling|^The above exception/.test(ln)) { cause++; cur = 'cause' + cause; } }
      } else if (lang === 'JavaScript') {
        if ((m = /^\s+at (?:(.+?) )?\(?((?:[a-zA-Z]+:\/\/|\/|[A-Za-z]:\\|\.\.?\/|node:)?[^\s()]+?):(\d+):(\d+)\)?$/.exec(ln))) frames.push({ grp: cur, fn: m[1] || '<anonymous>', file: m[2], line: m[3], col: m[4], raw: ln });
        else if ((m = /^(.*)@(.+?):(\d+):(\d+)$/.exec(ln))) frames.push({ grp: cur, fn: m[1] || '<anonymous>', file: m[2], line: m[3], col: m[4], raw: ln });
        else if (ln.trim() && !/^\s/.test(ln)) headers.push({ grp: cur, text: ln });
      } else if (lang === '.NET') {
        if ((m = /^\s+at (.+?)(?: in (.+?):line (\d+))?$/.exec(ln))) frames.push({ grp: cur, fn: m[1], file: m[2] || '', line: m[3] || '', raw: ln });
        else if (ln.trim() && !/^\s/.test(ln)) headers.push({ grp: cur, text: ln });
      } else if (lang === 'Go') {
        var f = frames[frames.length - 1];
        if ((m = /^\s+(\/.+\.go|[A-Za-z]:\\.+\.go):(\d+)(?: \+0x[0-9a-f]+)?$/.exec(ln)) && f && !f.file) { f.file = m[1]; f.line = m[2]; }
        else if ((m = /^([\w./*()-]+)\((.*)\)$/.exec(ln.trim())) && !/^(goroutine|panic)/.test(ln)) frames.push({ grp: cur, fn: m[1], file: '', line: '', raw: ln });
        else if (ln.trim() && !/^\s/.test(ln)) headers.push({ grp: cur, text: ln });
      } else if (lang === 'Ruby') {
        if ((m = /^\s*(?:from )?(.+?):(\d+):in `(.+?)'/.exec(ln))) frames.push({ grp: cur, fn: m[3], file: m[1], line: m[2], raw: ln });
        else if (ln.trim() && !/^\s/.test(ln)) headers.push({ grp: cur, text: ln });
      } else {
        if ((m = /^#\d+\s+(.+?)\((\d+)\):\s*(.+)$/.exec(ln))) frames.push({ grp: cur, fn: m[3], file: m[1], line: m[2], raw: ln });
        else if ((m = /^#\d+\s+(\{main\}|\[internal function\]):?\s*(.*)$/.exec(ln))) frames.push({ grp: cur, fn: m[2] || m[1], file: '', line: '', raw: ln });
        else if (ln.trim() && !/^#/.test(ln)) headers.push({ grp: cur, text: ln });
      }
    });
    if (!frames.length) throw new Error(t('스택 프레임을 찾지 못했습니다', 'No stack frames found'));
    var LIB = /^(java\.|javax\.|jdk\.|sun\.|org\.springframework|org\.apache|org\.hibernate|com\.sun|io\.netty|node:|internal\/|node_modules|site-packages|\/usr\/lib|System\.|Microsoft\.|runtime\.|net\/http|vendor\/|\/gems\/)/;
    var rows = [], nApp = 0;
    frames.forEach(function (fr, i) {
      var where = fr.file ? fr.file + (fr.line ? ':' + fr.line : '') + (fr.col ? ':' + fr.col : '') : '', mine = !fr.skip && prefixes.length && (isApp(fr.fn) || isApp(fr.file)) && !/node_modules|site-packages|\/gems\/|\/vendor\//.test(fr.file);
      if (mine) nApp++;
      var kind = fr.skip ? '…' : mine ? '⭐ ' + t('내 코드', 'your code') : (LIB.test(fr.fn) || LIB.test(fr.file) || /node_modules|site-packages/.test(fr.file)) ? t('라이브러리', 'library') : t('기타', 'other');
      rows.push([String(i + 1), fr.grp === 'main' ? t('원인(최상위)', 'top') : fr.grp.replace('cause', t('근본 원인 ', 'cause ')), fr.fn, where, kind]);
    });
    var firstApp = -1; frames.forEach(function (fr, i) { if (firstApp < 0 && rows[i][4].indexOf('⭐') === 0) firstApp = i; });
    var out = [lang + ' ' + t('스택 트레이스', 'stack trace')];
    headers.forEach(function (h) { out.push((h.grp === 'main' ? '' : '↳ ') + h.text); });
    out.push('');
    frames.forEach(function (fr, i) { out.push((rows[i][4].indexOf('⭐') === 0 ? '▶ ' : '  ') + fr.fn + (fr.file ? '  (' + fr.file + (fr.line ? ':' + fr.line : '') + (fr.col ? ':' + fr.col : '') + ')' : '')); });
    if (firstApp >= 0) issues.push(t('가장 먼저 확인할 내 코드 프레임: ' + frames[firstApp].fn + ' (' + frames[firstApp].file + ':' + frames[firstApp].line + ')', 'First of your own frames to inspect: ' + frames[firstApp].fn + ' (' + frames[firstApp].file + ':' + frames[firstApp].line + ')'));
    else if (prefixes.length) issues.push(t('내 코드 접두사(' + prefixes.join(', ') + ')와 일치하는 프레임이 없습니다', 'No frame matches your code prefixes (' + prefixes.join(', ') + ')'));
    if (cause) issues.push(t('"Caused by"가 ' + cause + '개 있습니다 — 보통 가장 아래(마지막) 원인이 근본 원인입니다', cause + ' "Caused by" entries — the last one is usually the root cause'));
    if (lang === 'JavaScript' && /\.min\.js|\/dist\/|\/build\//.test(text)) issues.push(t('압축된 번들의 줄·열 번호입니다. 소스맵이 있어야 원본 위치를 알 수 있습니다(이 도구는 소스맵을 읽지 않음)', 'These are minified-bundle positions. A source map is needed for original locations (this tool does not read source maps)'));
    issues.push(t('스택 트레이스에는 파일 경로·내부 클래스명·값이 들어 있을 수 있으니 외부에 공유하기 전에 확인하세요', 'Stack traces can hold file paths, internal class names and values; review them before sharing'));
    return { _status: t('✅ ' + lang + ' 프레임 ' + frames.length + '개 · 내 코드 ' + nApp + '개', '✅ ' + lang + ': ' + frames.length + ' frames · ' + nApp + ' in your code'), table: { head: [['#', '#'], ['구분', 'Group'], ['함수/메서드', 'Function / method'], ['위치', 'Location'], ['분류', 'Kind']], rows: rows }, out: out.join('\n'), issues: issues };
  }
});
