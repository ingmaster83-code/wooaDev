TK.tool('syslog-parser', {
  inputs: [{ id: 'log', label: ['syslog 메시지 (한 줄에 하나, RFC 3164 / RFC 5424)', 'Syslog messages (one per line, RFC 3164 / RFC 5424)'], rows: 8, sample: '<34>Oct 16 09:12:03 web01 sshd[2412]: Failed password for root from 203.0.113.5 port 51234 ssh2\n<165>1 2026-10-16T09:12:05.003Z web01.example.com myapp 2518 ID47 [exampleSDID@32473 iut="3" eventSource="Application"] Request handled in 35ms\n<13>Oct  6 23:59:59 db01 kernel: Out of memory: Killed process 8123 (mysqld)\n<190>1 2026-10-16T09:13:00+09:00 gw01 nginx - - - upstream timed out' }],
  options: [{ id: 'year', type: 'number', label: ['RFC 3164 에 붙일 연도 (원본에 연도가 없음)', 'Year for RFC 3164 (the original has none)'], default: 2026, min: 1970, max: 2100 }],
  outputs: [{ id: 'table', label: ['파싱 결과', 'Parsed messages'], kind: 'table' }, { id: 'json', label: ['JSON', 'JSON'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var lines = String(v.log).replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error(t('syslog 메시지를 입력하세요', 'Enter syslog messages'));
    var FAC = ['kern', 'user', 'mail', 'daemon', 'auth', 'syslog', 'lpr', 'news', 'uucp', 'cron', 'authpriv', 'ftp', 'ntp', 'audit', 'alert', 'clock', 'local0', 'local1', 'local2', 'local3', 'local4', 'local5', 'local6', 'local7'];
    var SEV = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'], SEVKO = ['긴급(시스템 사용 불가)', '경보(즉시 조치)', '치명', '오류', '경고', '알림', '정보', '디버그'];
    var MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    var rows = [], out = [], issues = [], bad = 0, sevCount = {};
    lines.forEach(function (ln) {
      var m = /^<(\d{1,3})>(.*)$/.exec(ln), pri = null, rest = ln, fmt = '';
      if (m) { pri = +m[1]; rest = m[2]; } else issues.push(t('PRI(<숫자>)가 없는 줄: ' + ln.slice(0, 40), 'Line without a <PRI>: ' + ln.slice(0, 40)));
      var rec = { pri: pri }, mm;
      if ((mm = /^(\d)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(-|(?:\[[^\]]*\])+)\s*(.*)$/.exec(rest))) {
        fmt = 'RFC 5424'; rec.version = +mm[1]; rec.timestamp = mm[2]; rec.host = mm[3]; rec.app = mm[4]; rec.procid = mm[5]; rec.msgid = mm[6]; rec.sd = mm[7]; rec.message = mm[8].replace(/^\uFEFF/, '');
        if (rec.timestamp !== '-' && isNaN(Date.parse(rec.timestamp))) issues.push(t('타임스탬프를 해석할 수 없습니다: ' + rec.timestamp, 'Cannot parse timestamp: ' + rec.timestamp));
        rec.iso = rec.timestamp === '-' ? '' : (isNaN(Date.parse(rec.timestamp)) ? '' : new Date(Date.parse(rec.timestamp)).toISOString());
      } else if ((mm = /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\S+)\s+(.*)$/.exec(rest))) {
        fmt = 'RFC 3164'; rec.timestamp = mm[1] + ' ' + mm[2] + ' ' + mm[3] + ':' + mm[4] + ':' + mm[5]; rec.host = mm[6];
        var tm = /^([^\s:\[]+)(?:\[(\d+)\])?:\s*(.*)$/.exec(mm[7]); if (tm) { rec.app = tm[1]; rec.procid = tm[2] || '-'; rec.message = tm[3]; } else { rec.app = '-'; rec.procid = '-'; rec.message = mm[7]; }
        rec.iso = new Date(Date.UTC(o.year, MON[mm[1]], +mm[2], +mm[3], +mm[4], +mm[5])).toISOString().replace('.000Z', 'Z') + '?';
      } else { bad++; rows.push([ln.slice(0, 50), '❌', '', '', '', '', t('RFC 3164/5424 형식이 아닙니다', 'Not RFC 3164 / 5424')]); out.push({ raw: ln, error: 'unparsed' }); return; }
      if (pri !== null) { rec.facility = FAC[pri >> 3] || String(pri >> 3); rec.severity = SEV[pri & 7]; if ((pri >> 3) > 23) issues.push(t('PRI ' + pri + ' 의 facility 가 범위(0~23)를 벗어납니다', 'PRI ' + pri + ' has a facility outside 0–23')); sevCount[rec.severity] = (sevCount[rec.severity] || 0) + 1; }
      var note = ''; if (pri !== null && (pri & 7) <= 3) note = '🚨 ' + SEVKO[pri & 7];
      rows.push([fmt, '✅', pri === null ? '—' : rec.facility + '.' + rec.severity + ' (' + pri + ')', rec.iso || rec.timestamp, rec.host + ' / ' + rec.app + (rec.procid && rec.procid !== '-' ? '[' + rec.procid + ']' : ''), (rec.message || '').slice(0, 70), note]);
      out.push(rec);
    });
    if (rows.some(function (r) { return r[0] === 'RFC 3164'; })) issues.push(t('RFC 3164 에는 연도·시간대가 없어 입력한 연도로 UTC 로 가정했습니다 (? 표시는 추정값). 연말·연초 로그는 연도가 어긋날 수 있습니다', 'RFC 3164 has no year or time zone, so the entered year and UTC were assumed (? marks a guess). Logs around New Year may get the wrong year'));
    issues.push(t('PRI = facility × 8 + severity. 예: <34> = auth(4)×8 + crit(2)', 'PRI = facility × 8 + severity. Example: <34> = auth(4) × 8 + crit(2)'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    var sevs = Object.keys(sevCount).map(function (k) { return k + ' ' + sevCount[k]; }).join(', ');
    return { _status: bad ? { ok: 'info', msg: t('🔍 ' + lines.length + '건 중 ' + bad + '건 실패', '🔍 ' + bad + ' of ' + lines.length + ' failed') } : t('✅ ' + lines.length + '건 파싱 (' + sevs + ')', '✅ Parsed ' + lines.length + ' (' + sevs + ')'), table: { head: [['형식', 'Format'], ['상태', 'Status'], ['facility.severity', 'facility.severity'], ['시각', 'Time'], ['호스트 / 앱', 'Host / app'], ['메시지', 'Message'], ['비고', 'Note']], rows: rows }, json: JSON.stringify(out, null, 2), issues: uniq };
  }
});
