TK.tool('jq-playground', {
  inputs: [
    { id: 'prog', label: ['jq 필터', 'jq filter'], rows: 4, sample: '.users | map(select(.age >= 30) | {name, city: .address.city}) | sort_by(.name)' },
    { id: 'in', label: ['JSON 입력 (여러 값을 이어 붙여도 됩니다)', 'JSON input (several concatenated values are allowed)'], rows: 12, sample: '{"users":[{"name":"Mina","age":34,"address":{"city":"Seoul"}},{"name":"Joon","age":28,"address":{"city":"Busan"}},{"name":"Ara","age":41,"address":{"city":"Daegu"}}]}' }
  ],
  options: [
    { id: 'fmt', type: 'select', label: ['출력 형식', 'Output format'], choices: [['2', ['들여쓰기 2칸', '2-space indent']], ['4', ['들여쓰기 4칸', '4-space indent']], ['tab', ['탭 (--tab)', 'Tab (--tab)']], ['c', ['한 줄 (-c)', 'Compact (-c)']]], default: '2' },
    { id: 'raw', type: 'select', label: ['문자열 출력', 'String output'], choices: [['json', ['JSON 문자열 ("…")', 'JSON strings ("…")']], ['r', ['-r 따옴표 없이', '-r raw']], ['j', ['-j 따옴표·줄바꿈 없이', '-j raw, no newline']]], default: 'json' },
    { id: 'sortk', type: 'checkbox', label: ['키 정렬 (-S)', 'Sort keys (-S)'], default: false },
    { id: 'nullin', type: 'checkbox', label: ['입력 없이 실행 (-n)', 'Null input (-n)'], default: false },
    { id: 'slurp', type: 'checkbox', label: ['입력을 하나의 배열로 (-s)', 'Slurp inputs into an array (-s)'], default: false },
    { id: 'rawin', type: 'checkbox', label: ['입력을 텍스트로 (-R, 줄마다 문자열)', 'Raw input (-R, one string per line)'], default: false },
    { id: 'args', type: 'text', label: ['변수 ($name) JSON 객체 (--argjson)', 'Variables ($name) as a JSON object (--argjson)'], default: '', placeholder: ['예: {"min": 30}', 'e.g. {"min": 30}'] }
  ],
  outputs: [{ id: 'out', label: ['결과', 'Output'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['오류 · 디버그', 'Errors & debug'], kind: 'list' }],
  run: function (v, o, t) {
    var Q = TK.jq, prog = String(v.prog || '');
    if (!prog.trim()) throw new Error(t('jq 필터를 입력하세요', 'Enter a jq filter'));
    var args = {}; if (String(o.args || '').trim()) { try { args = JSON.parse(o.args); } catch (e) { throw new Error(t('변수 JSON 구문 오류: ', 'Variables JSON syntax error: ') + e.message); } if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error(t('변수는 JSON 객체여야 합니다', 'Variables must be a JSON object')); }
    var text = String(v['in'] || ''), inputs;
    if (o.rawin) inputs = o.slurp ? [text] : text.split(/\r?\n/).filter(function (l, i, a) { return !(i === a.length - 1 && l === ''); });
    else { try { inputs = text.trim() ? Q.parseInputs(text) : []; } catch (e) { throw new Error(e.val !== undefined ? String(e.val) : e.message); } }
    if (!inputs.length && !o.nullin) throw new Error(t('JSON 입력을 넣거나 "입력 없이 실행(-n)"을 선택하세요', 'Provide JSON input or choose null input (-n)'));
    var res;
    try { res = Q.run(prog, inputs, { args: args, nullInput: !!o.nullin, slurp: !!o.slurp && !o.rawin }); }
    catch (e) { if (e instanceof Q.JQError) throw new Error('jq: error: ' + Q.errorMessage(e.val) + t('\n프로그램 문법을 확인하세요', '\nCheck the program syntax')); throw e; }
    var indent = o.fmt === 'tab' ? '\t' : o.fmt === 'c' ? null : new Array((Number(o.fmt) || 2) + 1).join(' ');
    var parts = res.outputs.map(function (x) { return typeof x === 'string' && o.raw !== 'json' ? x : Q.toJson(x, indent, o.sortk); });
    var out = parts.join(o.raw === 'j' ? '' : '\n');
    var issues = [];
    res.errors.forEach(function (e) { if (e.halt) issues.push('ℹ️ halt_error: ' + (typeof e.msg === 'string' ? e.msg : Q.toJson(e.msg))); else issues.push('⛔ jq: error' + (inputs.length > 1 ? ' (' + t('입력 #', 'input #') + (e.input + 1) + ')' : '') + ': ' + Q.errorMessage(e.val)); });
    res.debug.forEach(function (d) { issues.push('🐞 ' + d[0] + ' ' + Q.toJson(d[1], null)); });
    if (res.outputs.length === 0 && !res.errors.length) issues.push('ℹ️ ' + t('출력이 없습니다 (empty). select 조건이나 경로를 확인하세요', 'No output (empty); check your select conditions or paths'));
    var intKeys = res.outputs.some(function (x) { return x && typeof x === 'object' && JSON.stringify(x).match(/"\d+":/); });
    if (intKeys) issues.push('ℹ️ ' + t('JavaScript 객체 규칙상 정수 형태의 키("1" 등)는 항상 앞쪽에 숫자 순서로 출력됩니다. jq 와 키 순서가 다를 수 있습니다', 'JavaScript objects order integer-like keys ("1" ...) first in numeric order, so key order may differ from real jq'));
    var n = res.outputs.length;
    return { _status: res.errors.length && !res.errors[0].halt ? { ok: false, msg: t('⛔ 오류 ' + res.errors.length + '건 · 출력 ' + n + '개', '⛔ ' + res.errors.length + ' error(s) · ' + n + ' output(s)') } : t('✅ 출력 ' + n + '개', '✅ ' + n + ' output(s)'), out: out, issues: issues };
  }
});
