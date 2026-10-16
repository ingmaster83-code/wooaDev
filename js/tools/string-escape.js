TK.tool('string-escape', {
  inputs: [{ id: 'in', label: ['입력', 'Input'], rows: 8, sample: 'He said "안녕"\n\tPath: C:\\Users\\wooa\n😀', placeholder: ['변환할 문자열을 붙여넣으세요', 'Paste the string to convert'] }],
  options: [
    { id: 'dir', type: 'select', label: ['방향', 'Direction'], choices: [['esc', ['이스케이프 (실제 값 → 표현식)', 'Escape (value → literal)']], ['unesc', ['언이스케이프 (표현식 → 실제 값)', 'Unescape (literal → value)']]], default: 'esc' },
    { id: 'lang', type: 'select', label: ['대상', 'Target'], choices: [['json', 'JSON'], ['js', 'JavaScript'], ['py', 'Python'], ['java', 'Java / C#'], ['c', 'C / C++'], ['sql', 'SQL (\' → \'\')'], ['mysql', 'MySQL'], ['regex', ['정규식 리터럴', 'Regex literal']]], default: 'json' },
    { id: 'quote', type: 'select', label: ['따옴표', 'Quote'], choices: [['"', '" (double)'], ["'", "' (single)"], ['`', '` (template)']], default: '"', show: function (o) { return o.lang === 'js' || o.lang === 'py'; } },
    { id: 'ascii', type: 'checkbox', label: ['ASCII 밖 문자도 \\uXXXX 로', 'Escape non-ASCII as \\uXXXX'], default: false, show: function (o) { return o.dir === 'esc' && o.lang !== 'sql' && o.lang !== 'regex'; } },
    { id: 'wrap', type: 'checkbox', label: ['앞뒤 따옴표 포함', 'Include surrounding quotes'], default: true, show: function (o) { return o.dir === 'esc' && o.lang !== 'regex'; } }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }],
  swap: { from: 'out', to: 'in', set: { dir: 'unesc' }, label: ['결과를 입력으로 (역변환)', 'Use result as input (reverse)'] },
  run: function (v, o, t) {
    var s = v.in, lang = o.lang;
    var uni = function (cp) { return '\\u' + ('0000' + cp.toString(16)).slice(-4); };
    function nonAscii(str, astral) {
      return str.replace(/[^\x00-\x7F]/gu, function (ch) {
        var cp = ch.codePointAt(0);
        if (cp > 0xFFFF) { if (astral === 'py') return '\\U' + ('00000000' + cp.toString(16)).slice(-8); var hi = Math.floor((cp - 0x10000) / 0x400) + 0xD800, lo = (cp - 0x10000) % 0x400 + 0xDC00; return uni(hi) + uni(lo); }
        return uni(cp);
      });
    }
    if (o.dir === 'esc') {
      var out;
      if (lang === 'regex') return { _status: t('✅ 정규식 특수문자를 이스케이프했습니다', '✅ Escaped regex metacharacters'), out: s.replace(/[.*+?^${}()|[\]\\\/\-]/g, '\\$&') };
      if (lang === 'sql') {
        out = s.replace(/'/g, "''");
        return { _status: t('✅ 완료 — 작은따옴표를 두 번 써서 이스케이프했습니다', '✅ Done — single quotes doubled'), out: o.wrap ? "'" + out + "'" : out };
      }
      if (lang === 'mysql') {
        out = s.replace(/\\/g, '\\\\').replace(/\0/g, '\\0').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\x1a/g, '\\Z');
        return { _status: t('✅ 완료 (mysql_real_escape_string 규칙)', '✅ Done (mysql_real_escape_string rules)'), out: o.wrap ? "'" + out + "'" : out };
      }
      var q = lang === 'json' || lang === 'java' || lang === 'c' ? '"' : o.quote;
      var map = { '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' };
      out = s.replace(/[\\\n\r\t\b\f]/g, function (c) { return map[c]; });
      if (lang === 'js' || lang === 'py') out = out.split(q).join('\\' + q);
      else out = out.replace(/"/g, '\\"');
      if (lang === 'js' && q === '`') out = out.replace(/\$\{/g, '\\${');
      if (lang === 'js' && q === '`') out = out.replace(/\\n/g, '\n');   // 템플릿 리터럴은 실제 줄바꿈 허용
      out = out.replace(/[\x00-\x1f\x7f]/g, function (c) {
        if (lang === 'json' || lang === 'js' || lang === 'java') return uni(c.charCodeAt(0));
        return '\\x' + ('0' + c.charCodeAt(0).toString(16)).slice(-2);
      });
      if (lang === 'js' || lang === 'json') out = out.replace(/[\u2028\u2029]/g, function (c) { return uni(c.charCodeAt(0)); });
      if (lang === 'js') out = out.replace(/\v/g, '\\v');
      if (o.ascii) out = nonAscii(out, lang === 'py' ? 'py' : 'utf16');
      return { _status: t('✅ 이스케이프 완료', '✅ Escaped'), out: o.wrap ? q + out + q : out };
    }
    // 언이스케이프
    var src = s;
    if (lang === 'sql') {
      src = src.trim();
      if (src.length >= 2 && src[0] === "'" && src.slice(-1) === "'") src = src.slice(1, -1);
      return { _status: t('✅ 완료', '✅ Done'), out: src.replace(/''/g, "'") };
    }
    if (lang === 'regex') return { _status: t('✅ 완료', '✅ Done'), out: src.replace(/\\([.*+?^${}()|[\]\\\/\-])/g, '$1') };
    var tr = src.trim();
    if (tr.length >= 2 && (tr[0] === '"' || tr[0] === "'" || tr[0] === '`') && tr.slice(-1) === tr[0]) src = tr.slice(1, -1);
    if (lang === 'json' && s.trim()[0] === '"') {
      try { return { _status: t('✅ JSON 문자열을 해석했습니다', '✅ Parsed as a JSON string'), out: JSON.parse(s.trim()) }; } catch (e) { /* 아래 관대한 해석으로 */ }
    }
    var bad = 0;
    var res = src.replace(/\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|x([0-9a-fA-F]{2})|([0-7]{1,3})|([\s\S]))/g, function (m, a, b1, b2, b3, b4, oct, ch) {
      if (b1) return String.fromCodePoint(parseInt(b1, 16));
      if (b2) return String.fromCharCode(parseInt(b2, 16));
      if (b3) return String.fromCodePoint(parseInt(b3, 16));
      if (b4) return String.fromCharCode(parseInt(b4, 16));
      if (oct) return oct === '0' ? '\0' : String.fromCharCode(parseInt(oct, 8));
      switch (ch) {
        case 'n': return '\n'; case 'r': return '\r'; case 't': return '\t'; case 'b': return '\b'; case 'f': return '\f'; case 'v': return '\v';
        case 'a': return '\x07'; case '\\': case '"': case "'": case '`': case '/': return ch;
        case '\n': return '';
        default: bad++; return ch;
      }
    });
    if (lang === 'mysql') res = res.replace(/\x1a/g, '\x1a');
    return { _status: bad ? { ok: 'info', msg: t('⚠️ 알 수 없는 이스케이프 ' + bad + '개는 문자 그대로 두었습니다', '⚠️ ' + bad + ' unknown escape(s) were kept as plain characters') } : t('✅ 언이스케이프 완료', '✅ Unescaped'), out: res };
  }
});
