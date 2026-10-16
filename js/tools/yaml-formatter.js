TK.tool('yaml-formatter', {
  inputs: [{ id: 'in', label: ['YAML 입력', 'YAML input'], rows: 16, tabIndent: false,
    sample: '# service config\nservice:\n    name: api      # keep this comment\n    ports:\n        - 80\n        - 443\n    env:\n        - name: MODE\n          value: prod\n    script: |\n        echo "start"\n        run --fast\n  \nlimits: {cpu: 2, mem: 512}\n' }],
  options: [
    { id: 'mode', type: 'select', label: ['정리 방식', 'Mode'], choices: [['reindent', ['들여쓰기만 정리 (주석·순서·스타일 유지)', 'Re-indent only (keeps comments & style)']], ['dump', ['구조 다시 쓰기 (주석 사라짐, 키 정렬 가능)', 'Rewrite structure (drops comments, can sort keys)']]], default: 'reindent' },
    { id: 'indent', type: 'select', label: ['들여쓰기 칸수', 'Indent width'], choices: [['2', '2'], ['4', '4'], ['3', '3']], default: '2', num: true },
    { id: 'sort', type: 'checkbox', label: ['키 정렬', 'Sort keys'], default: false, show: function (o) { return o.mode === 'dump'; } },
    { id: 'wide', type: 'checkbox', label: ['긴 줄 접지 않기', 'Do not wrap long lines'], default: true, show: function (o) { return o.mode === 'dump'; } },
    { id: 'anchors', type: 'checkbox', label: ['중복 구조에 앵커(&) 허용', 'Allow anchors (&) for repeated structures'], default: false, show: function (o) { return o.mode === 'dump'; } }
  ],
  outputs: [{ id: 'out', label: ['정리된 YAML', 'Formatted YAML'], kind: 'code', ext: 'yaml', mime: 'application/yaml' }],
  swap: { from: 'out', to: 'in' },
  run: function (v, o, t) {
    if (typeof jsyaml === 'undefined') throw new Error(t('YAML 라이브러리를 불러오지 못했습니다', 'Failed to load the YAML library'));
    var src = v.in.replace(/\r\n?/g, '\n'), N = Number(o.indent) || 2;
    var orig = TK.config.parseYaml(src);          // 문법 검증
    var norm = function (x) { return JSON.stringify(x === undefined ? null : x, function (k, val) { return val instanceof Date ? val.toISOString() : val; }); };
    var hasComments = /(^|\s)#/.test(src);

    if (o.mode === 'dump') {
      var docs = jsyaml.loadAll(src), parts = docs.map(function (d) {
        return jsyaml.dump(d, { indent: N, sortKeys: !!o.sort, lineWidth: o.wide ? -1 : 80, noRefs: !o.anchors, noCompatMode: true });
      });
      var res = parts.length > 1 ? parts.map(function (p) { return p.replace(/\n$/, ''); }).join('\n---\n') + '\n' : parts[0];
      return { _status: hasComments ? { ok: 'info', msg: t('⚠️ 구조를 다시 썼기 때문에 주석은 유지되지 않았습니다. 주석을 보존하려면 "들여쓰기만 정리"를 쓰세요.', '⚠️ Comments were dropped because the structure was rewritten. Use "Re-indent only" to keep them.') } : t('✅ 정리 완료', '✅ Formatted'), out: res };
    }

    var lines = src.split('\n'), out = [], stack = [], pendingComments = [], i;
    function leading(l) { var m = /^( *)/.exec(l); return m[1].length; }
    function pad(n) { return ' '.repeat(n); }
    function flushComments(n) { pendingComments.forEach(function (c) { out.push(pad(n) + c); }); pendingComments = []; }
    var blockRe = /(?:^|:\s+|\s)(?:[!&][^\s]*\s+)*[|>]([-+]?)([0-9]?)[-+]?\s*(?:#.*)?$/;
    for (i = 0; i < lines.length; i++) {
      var raw = lines[i];
      if (/^\t/.test(raw) || /^ +\t/.test(raw)) throw new Error(t('줄 ' + (i + 1) + ': 들여쓰기에 탭이 있습니다. YAML은 공백만 쓸 수 있습니다.', 'Line ' + (i + 1) + ': tab used for indentation; YAML only allows spaces.'));
      var line = raw.replace(/\s+$/, '');
      if (line === '') { flushComments(0); out.push(''); continue; }
      if (/^(---|\.\.\.)(\s|$)/.test(line) || /^%/.test(line)) { flushComments(0); stack = []; out.push(line); continue; }
      var ind = leading(line), body = line.slice(ind);
      if (body[0] === '#') { pendingComments.push(body); continue; }
      while (stack.length && stack[stack.length - 1].orig > ind) stack.pop();
      var neu;
      if (stack.length && stack[stack.length - 1].orig === ind) neu = stack[stack.length - 1].neu;
      else { neu = stack.length ? stack[stack.length - 1].neu + N : 0; stack.push({ orig: ind, neu: neu }); }
      flushComments(neu);
      // "- " 접두부 정규화
      var prefix = '', pos = ind, npos = neu, rest = body, dashed = false, lastKeyCol = neu, lastKeyOrig = ind;
      var dm;
      while ((dm = /^-(\s+|$)/.exec(rest))) {
        dashed = true;
        var spaces = dm[1].length;
        prefix += '- ';
        pos += 1 + spaces; npos += 2;
        rest = rest.slice(dm[0].length);
        stack.push({ orig: pos, neu: npos });
        lastKeyCol = npos; lastKeyOrig = pos;
        if (rest === '') { lastKeyCol = npos - 2; lastKeyOrig = pos - 1 - spaces; break; }
      }
      out.push(pad(neu) + prefix + rest);
      // 블록 스칼라
      var bm = blockRe.exec(rest === '' && dashed ? '' : rest);
      if (bm && !(rest === '' && dashed)) {
        if (bm[2]) throw new Error(t('줄 ' + (i + 1) + ': 들여쓰기 지시자(|2 등)가 있는 블록은 자동 정리를 지원하지 않습니다. "구조 다시 쓰기" 모드를 사용하세요.', 'Line ' + (i + 1) + ': block scalars with an indentation indicator (e.g. |2) are not supported here. Use "Rewrite structure".'));
        var baseNew = (dashed && /^[|>]/.test(rest)) ? neu : lastKeyCol;
        var baseOrig = (dashed && /^[|>]/.test(rest)) ? ind : lastKeyOrig;
        var blockOrig = null;
        while (i + 1 < lines.length) {
          var nl = lines[i + 1];
          if (nl.trim() === '') { out.push(''); i++; continue; }
          var ni = leading(nl);
          if (ni <= baseOrig) break;
          if (blockOrig === null) blockOrig = ni;
          out.push(pad(baseNew + N + Math.max(0, ni - blockOrig)) + nl.slice(ni).replace(/\s+$/, ''));
          i++;
        }
        // 블록 끝의 빈 줄은 아래 로직에서 다시 처리되므로 되돌린다
        while (out.length && out[out.length - 1] === '' && i + 1 < lines.length && lines[i].trim() === '') { break; }
      }
    }
    flushComments(0);
    var text = out.join('\n').replace(/\n+$/, '') + '\n';
    var a = jsyaml.loadAll(src).map(norm).join('\u0001'), b;
    try { b = jsyaml.loadAll(text).map(norm).join('\u0001'); } catch (e) { b = null; }
    if (a !== b) throw new Error(t('자동 들여쓰기 정리 결과가 원본과 달라질 수 있어 중단했습니다. "구조 다시 쓰기" 모드를 사용해 보세요.', 'Re-indenting would change the meaning of this document, so it was stopped. Try the "Rewrite structure" mode.'));
    return { _status: t('✅ 정리 완료 — 주석과 키 순서를 유지했고, 의미가 같은지 검증했습니다.', '✅ Formatted — comments and key order kept; semantic equality verified.'), out: text };
  }
});
