TK.tool('postgresql-data-parser', {
  inputs: [
    { id: 'arr', label: ['PostgreSQL 배열 리터럴 (한 줄에 하나)', 'PostgreSQL array literals (one per line)'], rows: 5, sample: '{1,2,3}\n{"hello world",NULL,"with \\"quote\\"","a,b"}\n{{1,2},{3,4}}\n{apple,banana}', show: function (o) { return o.mode === 'array'; } },
    { id: 'iv', label: ['interval 값 (한 줄에 하나)', 'interval values (one per line)'], rows: 5, sample: '1 year 2 mons 3 days 04:05:06.5\n-1 days +02:00:00\nP1Y2M3DT4H5M6S\n@ 2 hours 30 mins\n00:90:00', show: function (o) { return o.mode === 'interval'; } }
  ],
  options: [{ id: 'mode', type: 'select', label: ['대상', 'Type'], choices: [['array', ['배열 → JSON', 'Array → JSON']], ['interval', ['interval 분석', 'Parse interval']]], default: 'array' }],
  outputs: [{ id: 'table', label: ['결과', 'Results'], kind: 'table' }, { id: 'out', label: ['JSON / 정규화', 'JSON / normalised'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], rows = [], out = [];
    if (o.mode === 'array') {
      var lines = String(v.arr || '').replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!lines.length) throw new Error(t('배열 리터럴을 입력하세요', 'Enter an array literal'));
      lines.forEach(function (s) {
        var i = 0, dims = 0;
        if (/^\[[^\]]*\]=/.test(s)) s = s.replace(/^\[[^\]]*\]=/, '');
        function parse() {
          if (s[i] !== '{') throw new Error(t('{ 가 필요합니다 (위치 ' + i + ')', '{ expected (position ' + i + ')'));
          i++; var arr = [];
          if (s[i] === '}') { i++; return arr; }
          while (true) {
            var c = s[i];
            if (c === '{') arr.push(parse());
            else if (c === '"') { var str = ''; i++; while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; str += s[i++]; } if (s[i] !== '"') throw new Error(t('따옴표가 닫히지 않았습니다', 'Unclosed quote')); i++; arr.push({ q: str }); }
            else { var st = i; while (i < s.length && s[i] !== ',' && s[i] !== '}') i++; var tok = s.slice(st, i).trim(); if (tok === '') throw new Error(t('빈 요소가 있습니다 (위치 ' + i + ')', 'Empty element (position ' + i + ')')); arr.push(/^null$/i.test(tok) ? null : { u: tok }); }
            if (s[i] === ',') { i++; continue; } if (s[i] === '}') { i++; return arr; }
            throw new Error(t(', 또는 } 가 필요합니다 (위치 ' + i + ')', ', or } expected (position ' + i + ')'));
          }
        }
        function conv(a) { return a.map(function (e) { if (Array.isArray(e)) return conv(e); if (e === null) return null; if (e.q !== undefined) return e.q; return /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(e.u) && Math.abs(Number(e.u)) <= Number.MAX_SAFE_INTEGER ? Number(e.u) : /^(t|true)$/i.test(e.u) ? true : /^(f|false)$/i.test(e.u) ? false : e.u; }); }
        function depth(a) { return Array.isArray(a) && a.length && Array.isArray(a[0]) ? 1 + depth(a[0]) : 1; }
        function rect(a) { if (!Array.isArray(a[0])) return !a.some(Array.isArray); var l = a[0].length; return a.every(function (x) { return Array.isArray(x) && x.length === l && rect(x); }); }
        try {
          var tree = parse(); if (i < s.length) throw new Error(t('끝에 남은 문자가 있습니다 (위치 ' + i + ')', 'Trailing characters (position ' + i + ')'));
          dims = depth(tree); var js = conv(tree), n = JSON.stringify(js);
          rows.push([s.length > 40 ? s.slice(0, 37) + '…' : s, '✅', String(dims) + 'D', String(JSON.stringify(js).match(/,/g) ? (function f(a) { return a.reduce(function (c, e) { return c + (Array.isArray(e) ? f(e) : 1); }, 0); })(js) : (js.length ? 1 : 0)), (rect(tree) ? '' : '⚠️ ' + t('다차원 배열의 하위 배열 길이가 다릅니다(PostgreSQL 은 거부)', 'Sub-array lengths differ (PostgreSQL rejects this)'))]);
          out.push(JSON.stringify(js));
          if (!rect(tree)) issues.push(t('PostgreSQL 다차원 배열은 모든 하위 배열의 길이가 같아야 합니다: ' + s, 'PostgreSQL multi-dimensional arrays need equal-length sub-arrays: ' + s));
        } catch (e) { rows.push([s.length > 40 ? s.slice(0, 37) + '…' : s, '❌', '', '', e.message]); out.push('// ' + e.message); }
      });
      issues.push(t('따옴표 없는 요소는 숫자/불리언으로 추정해 변환했습니다. 텍스트 배열의 숫자처럼 보이는 문자열은 원래 타입과 다를 수 있습니다', 'Unquoted elements are guessed as numbers / booleans; numeric-looking strings of a text array may differ from the original type'));
      issues.push(t('NULL(따옴표 없음)은 null, "NULL"(따옴표 있음)은 문자열입니다', 'Unquoted NULL is null; quoted "NULL" is a string'));
      var bad = rows.filter(function (r) { return r[1] === '❌'; }).length;
      return { _status: bad ? { ok: 'info', msg: t('🔍 ' + rows.length + '개 중 ' + bad + '개 오류', '🔍 ' + bad + ' of ' + rows.length + ' failed') } : t('✅ 배열 ' + rows.length + '개를 변환했습니다', '✅ Converted ' + rows.length + ' array(s)'), table: { head: [['입력', 'Input'], ['상태', 'Status'], ['차원', 'Dims'], ['요소 수', 'Elements'], ['참고', 'Note']], rows: rows }, out: out.join('\n'), issues: issues };
    }
    var ivs = String(v.iv || '').replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!ivs.length) throw new Error(t('interval 값을 입력하세요', 'Enter an interval'));
    ivs.forEach(function (s) {
      var f = { y: 0, mo: 0, d: 0, h: 0, mi: 0, s: 0 }, ok = true, m;
      var src = s.replace(/^@\s*/, '').replace(/\s+ago$/i, function () { f.ago = 1; return ''; });
      if ((m = /^P(?:(-?\d+(?:\.\d+)?)Y)?(?:(-?\d+(?:\.\d+)?)M)?(?:(-?\d+(?:\.\d+)?)W)?(?:(-?\d+(?:\.\d+)?)D)?(?:T(?:(-?\d+(?:\.\d+)?)H)?(?:(-?\d+(?:\.\d+)?)M)?(?:(-?\d+(?:\.\d+)?)S)?)?$/i.exec(src))) {
        f.y = +m[1] || 0; f.mo = +m[2] || 0; f.d = (+m[4] || 0) + 7 * (+m[3] || 0); f.h = +m[5] || 0; f.mi = +m[6] || 0; f.s = +m[7] || 0;
      } else {
        var rest = src, any = false;
        var re = /([+-]?\d+(?:\.\d+)?)\s*(years?|yrs?|y|mons?|months?|weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|millennia?|centur(?:y|ies)|decades?)\b/gi;
        rest = rest.replace(re, function (all, num, unit) {
          any = true; var n = parseFloat(num), u = unit.toLowerCase();
          if (/^y/.test(u)) f.y += n; else if (/^mon/.test(u)) f.mo += n; else if (/^w/.test(u)) f.d += 7 * n; else if (/^d(?!ec)/.test(u) || u === 'd') f.d += n; else if (/^h/.test(u)) f.h += n; else if (/^(min|m$)/.test(u)) f.mi += n; else if (/^s/.test(u)) f.s += n; else if (/^mill/.test(u)) f.y += 1000 * n; else if (/^cent/.test(u)) f.y += 100 * n; else if (/^dec/.test(u)) f.y += 10 * n;
          return ' ';
        });
        var tm = /([+-]?)(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?/.exec(rest);
        if (tm) { any = true; var sg = tm[1] === '-' ? -1 : 1; f.h += sg * +tm[2]; f.mi += sg * +tm[3]; f.s += sg * (+tm[4] || 0); rest = rest.replace(tm[0], ' '); }
        if (!any || rest.replace(/\s+/g, '') !== '') ok = false;
      }
      if (f.ago) { for (var k in f) if (typeof f[k] === 'number') f[k] = -f[k]; }
      if (!ok) { rows.push([s, '❌', '', '', t('해석할 수 없습니다', 'Cannot parse')]); out.push('// ' + s + ': error'); return; }
      var totalSec = f.h * 3600 + f.mi * 60 + f.s, normSec = totalSec, nh = Math.trunc(normSec / 3600), nm = Math.trunc((normSec - nh * 3600) / 60), ns = Math.round((normSec - nh * 3600 - nm * 60) * 1e6) / 1e6;
      function p2(n) { return (Math.abs(n) < 10 ? '0' : '') + Math.abs(n); }
      var parts = [];
      var yrs = Math.trunc(f.y), mons = f.mo + (f.y - yrs) * 12; var mo2 = Math.trunc(mons), days = f.d + (mons - mo2) * 30;
      if (yrs) parts.push(yrs + ' year' + (Math.abs(yrs) === 1 ? '' : 's')); if (mo2) parts.push(mo2 + ' mon' + (Math.abs(mo2) === 1 ? '' : 's')); var dd = Math.trunc(days); if (dd) parts.push(dd + ' day' + (Math.abs(dd) === 1 ? '' : 's'));
      var time = (normSec < 0 ? '-' : '') + p2(nh) + ':' + p2(nm) + ':' + (Math.abs(ns) < 10 ? '0' : '') + Math.abs(ns);
      if (normSec || !parts.length) parts.push(time);
      var iso = 'P' + (yrs ? yrs + 'Y' : '') + (mo2 ? mo2 + 'M' : '') + (dd ? dd + 'D' : '') + ((nh || nm || ns) ? 'T' + (nh ? nh + 'H' : '') + (nm ? nm + 'M' : '') + (ns ? ns + 'S' : '') : '');
      if (iso === 'P') iso = 'PT0S';
      var approx = yrs * 365.25 * 86400 + mo2 * 30 * 86400 + dd * 86400 + normSec;
      rows.push([s, '✅', parts.join(' '), iso, Math.round(approx).toLocaleString() + t('초', ' s') + ' (≈ ' + (Math.round(approx / 86400 * 100) / 100) + t('일', ' d') + ')']);
      out.push(JSON.stringify({ input: s, years: yrs, months: mo2, days: dd, hours: nh, minutes: nm, seconds: ns, iso8601: iso, postgres: parts.join(' ') }));
    });
    issues.push(t('interval 의 월(mon)은 30일, 연은 12개월로 환산되므로 초 단위 환산은 근사값입니다. PostgreSQL 은 월·일·시간을 따로 보관합니다', 'In an interval a month counts as 30 days and a year as 12 months, so the seconds figure is approximate. PostgreSQL stores months, days and time separately'));
    issues.push(t('시간 부분이 24시간을 넘어도 일로 자동 올림되지 않습니다 (justify_hours 필요)', 'Hours beyond 24 are not rolled into days automatically (use justify_hours)'));
    var bad2 = rows.filter(function (r) { return r[1] === '❌'; }).length;
    return { _status: bad2 ? { ok: 'info', msg: t('🔍 ' + rows.length + '개 중 ' + bad2 + '개 오류', '🔍 ' + bad2 + ' of ' + rows.length + ' failed') } : t('✅ interval ' + rows.length + '개를 분석했습니다', '✅ Parsed ' + rows.length + ' interval(s)'), table: { head: [['입력', 'Input'], ['상태', 'Status'], ['PostgreSQL 표기', 'PostgreSQL form'], ['ISO 8601', 'ISO 8601'], ['환산', 'Total']], rows: rows }, out: out.join('\n'), issues: issues };
  }
});
