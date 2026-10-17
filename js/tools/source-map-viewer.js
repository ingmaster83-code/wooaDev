TK.tool('source-map-viewer', {
  inputs: [{ id: 'in', label: ['소스 맵 (.map JSON, data: URI, 또는 sourceMappingURL 주석)', 'Source map (.map JSON, data: URI or sourceMappingURL comment)'], rows: 10, sample: '{\n "version": 3,\n "file": "bundle.js",\n "sourceRoot": "",\n "sources": [\n  "src/util.ts",\n  "src/app.ts"\n ],\n "sourcesContent": [\n  "export function add(a: number, b: number) {\\n  return a + b;\\n}\\n",\n  "import { add } from \'./util\';\\nconst n = add(1, 2);\\nconsole.log(n);\\n"\n ],\n "names": [\n  "add",\n  "a",\n  "b",\n  "n",\n  "console"\n ],\n "mappings": "AAAO,SAASA,IAAIC,EAAWC,GAC7B,OAAOD,CAAE,CAAEC,CACb;ACDA,IAAMC,EAAIH,SACVI,QAAQ"\n}' }],
  options: [
    { id: 'pos', type: 'text', label: ['생성 코드 위치 → 원본 (줄:열, 둘 다 1부터 — 스택 트레이스 형식)', 'Generated position → original (line:column, both 1-based like stack traces)'], default: '1:15', sample: '1:15' },
    { id: 'orig', type: 'text', label: ['원본 위치 → 생성 코드 (파일 일부:줄)', 'Original position → generated (file substring:line)'], default: '', sample: 'util:2' },
    { id: 'limit', type: 'number', label: ['매핑 표시 개수', 'Mappings to show'], default: 100, min: 10, max: 5000 }
  ],
  outputs: [{ id: 'info', label: ['요약', 'Summary'], kind: 'kv' }, { id: 'look', label: ['위치 변환 결과', 'Position lookup'], kind: 'code', ext: 'txt' }, { id: 'src', label: ['소스 파일', 'Sources'], kind: 'table' }, { id: 'map', label: ['매핑 (생성 → 원본)', 'Mappings (generated → original)'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var raw = String(v['in'] || '').trim(); if (!raw) throw new Error(t('소스 맵을 입력하세요', 'Enter a source map'));
    var issues = [];
    /* sourceMappingURL 주석·data URI 처리 */
    var cm = /sourceMappingURL=([^\s*]+)/.exec(raw);
    if (cm && raw.charAt(0) !== '{') raw = cm[1];
    var dm = /^data:application\/json(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/i.exec(raw);
    if (dm) { try { raw = dm[1] ? decodeURIComponent(escape(atob(dm[2].replace(/\s+/g, '')))) : decodeURIComponent(dm[2]); } catch (e) { throw new Error(t('data URI 를 해석하지 못했습니다', 'Could not decode the data URI')); } }
    raw = raw.replace(/^\)\]\}'\s*\n?/, '');
    if (raw.charAt(0) !== '{') throw new Error(t('JSON 형식의 소스 맵이 아닙니다. 외부 .map 파일 경로만 있다면 파일 내용을 붙여 넣으세요', 'Not a JSON source map. If you only have a path to an external .map file, paste the file contents'));
    var m; try { m = JSON.parse(raw); } catch (e) { throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); }
    var B64 = {}; 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function (c, i) { B64[c] = i; });
    function decodeMappings(str, base, nSources, nNames) {
      var segs = [], line = 0, gc = 0, si = base.si, ol = base.ol, oc = base.oc, ni = base.ni, bad = 0;
      var i = 0, n = str.length, vals = [];
      function flushSeg(vs) {
        if (vs.length !== 1 && vs.length !== 4 && vs.length !== 5) { bad++; return; }
        gc += vs[0]; var s = { line: line, col: gc, src: -1, ol: -1, oc: -1, name: -1 };
        if (vs.length >= 4) { si += vs[1]; ol += vs[2]; oc += vs[3]; s.src = si; s.ol = ol; s.oc = oc; if (si < 0 || si >= nSources) bad++; }
        if (vs.length === 5) { ni += vs[4]; s.name = ni; if (ni < 0 || ni >= nNames) bad++; }
        segs.push(s);
      }
      while (i <= n) {
        var c = i < n ? str[i] : ';';
        if (c === ',' || c === ';' || i === n) {
          if (vals.length) { flushSeg(vals); vals = []; }
          if (c === ';' || i === n) { line++; gc = 0; }
          i++; continue;
        }
        var shift = 0, val = 0, cont;
        do { var d = B64[str[i]]; if (d === undefined) throw new Error(t('mappings 에 잘못된 문자가 있습니다: "' + str[i] + '" (위치 ' + i + ')', 'Invalid character in mappings: "' + str[i] + '" (position ' + i + ')')); cont = d & 32; val += (d & 31) * Math.pow(2, shift); shift += 5; i++; } while (cont && i < n);
        if (cont) throw new Error(t('mappings 가 도중에 끝났습니다', 'mappings ends in the middle of a value'));
        vals.push((val % 2) ? -Math.floor(val / 2) : Math.floor(val / 2));
      }
      return { segs: segs, lines: line - (str.length ? 0 : 1), bad: bad, state: { si: si, ol: ol, oc: oc, ni: ni } };
    }
    var sections = [], allSegs = [], sources = [], contents = [], names = [], sourceRoot = m.sourceRoot || '';
    if (m.sections) {
      m.sections.forEach(function (sec, k) {
        if (!sec.map) { issues.push(t('섹션 ' + k + ' 에 map 이 없습니다 (url 방식은 지원하지 않음)', 'Section ' + k + ' has no inline map (url sections are not supported)')); return; }
        var off = sec.offset || { line: 0, column: 0 }, sub = sec.map, sb = sources.length, nb = names.length;
        (sub.sources || []).forEach(function (s, j) { sources.push(s); contents.push((sub.sourcesContent || [])[j]); }); (sub.names || []).forEach(function (n) { names.push(n); });
        var d = decodeMappings(String(sub.mappings || ''), { si: 0, ol: 0, oc: 0, ni: 0 }, (sub.sources || []).length, (sub.names || []).length);
        d.segs.forEach(function (s) { s.col = s.line === 0 ? s.col + (off.column || 0) : s.col; s.line += off.line || 0; if (s.src >= 0) s.src += sb; if (s.name >= 0) s.name += nb; allSegs.push(s); });
        if (d.bad) issues.push(t('섹션 ' + k + ': 범위를 벗어난 매핑 ' + d.bad + '개', 'Section ' + k + ': ' + d.bad + ' out-of-range mapping(s)'));
      });
    } else {
      if (m.version !== 3) issues.push(t('version 이 3 이 아닙니다 (' + m.version + '). 소스 맵 표준은 3 입니다', 'version is not 3 (' + m.version + '); the standard version is 3'));
      if (typeof m.mappings !== 'string') throw new Error(t('mappings 문자열이 없습니다', 'The mappings string is missing'));
      sources = (m.sources || []).slice(); contents = (m.sourcesContent || []).slice(); names = (m.names || []).slice();
      var d2 = decodeMappings(m.mappings, { si: 0, ol: 0, oc: 0, ni: 0 }, sources.length, names.length); allSegs = d2.segs;
      if (d2.bad) issues.push(t('소스·이름 인덱스가 범위를 벗어났거나 필드 수가 잘못된 매핑이 ' + d2.bad + '개 있습니다', d2.bad + ' mapping(s) have out-of-range source / name indexes or a wrong field count'));
    }
    if (!m.sections) {
      if (!sources.length) issues.push(t('sources 가 비어 있습니다', 'sources is empty'));
      if (m.sourcesContent && m.sourcesContent.length !== sources.length) issues.push(t('sourcesContent 개수(' + m.sourcesContent.length + ')가 sources(' + sources.length + ')와 다릅니다', 'sourcesContent length (' + m.sourcesContent.length + ') differs from sources (' + sources.length + ')'));
      if (!m.sourcesContent) issues.push(t('sourcesContent 가 없습니다. 원본 코드는 별도로 제공되어야 디버거에서 보입니다 (공개 배포 시 소스 노출을 피하려는 의도일 수 있음)', 'sourcesContent is missing; debuggers need the original files served separately (sometimes intentional to avoid exposing source)'));
      else issues.push(t('sourcesContent 가 포함되어 있습니다. 이 소스 맵을 공개 배포하면 원본 코드가 그대로 노출됩니다', 'sourcesContent is embedded: publishing this map exposes your original source code'));
    }
    if (!allSegs.length) issues.push(t('매핑이 없습니다', 'There are no mappings'));
    var withSrc = allSegs.filter(function (s) { return s.src >= 0; });
    var unmapped = allSegs.length - withSrc.length;
    function srcName(i) { var s = sources[i]; if (s == null) return '?'; return sourceRoot && !/^([a-z]+:)?\/\//i.test(s) && s.charAt(0) !== '/' ? sourceRoot.replace(/\/?$/, '/') + s : s; }
    var perSrc = {}; withSrc.forEach(function (s) { perSrc[s.src] = (perSrc[s.src] || 0) + 1; });
    var lastGen = allSegs.length ? allSegs[allSegs.length - 1].line + 1 : 0;
    var info = [[['버전', 'Version'], m.sections ? 'index map (sections ' + m.sections.length + ')' : String(m.version)], [['생성 파일', 'File'], m.file || '—'], [['sourceRoot', 'sourceRoot'], sourceRoot || '—'], [['소스 파일 수', 'Source files'], String(sources.length)], [['이름(names) 수', 'Names'], String(names.length)], [['매핑 수', 'Mappings'], allSegs.length + (unmapped ? t(' (원본 없는 구간 ' + unmapped + '개 포함)', ' (' + unmapped + ' without a source)') : '')], [['생성 코드 줄 수 (매핑 기준)', 'Generated lines (by mappings)'], String(lastGen)], [['소스 맵 크기', 'Map size'], raw.length.toLocaleString() + ' B']];
    var ext = m.x_google_ignoreList || m.ignoreList; if (ext && ext.length) info.push([['무시 목록(ignoreList)', 'ignoreList'], ext.map(function (i) { return sources[i]; }).join(', ')]);
    /* 위치 변환 */
    var sorted = allSegs.slice().sort(function (a, b) { return a.line - b.line || a.col - b.col; }), look = [];
    function snippet(si, ln, col) {
      var c = contents[si]; if (c == null) return '';
      var ls = String(c).split(/\r?\n/), out = [];
      for (var k = Math.max(0, ln - 2); k <= Math.min(ls.length - 1, ln + 2); k++) { out.push((k === ln ? '> ' : '  ') + ('     ' + (k + 1)).slice(-5) + ' | ' + ls[k]); if (k === ln) out.push('        | ' + new Array(Math.min(col, 200) + 1).join(' ') + '^'); }
      return out.join('\n');
    }
    var pm = /^\s*(\d+)\s*[:,]\s*(\d+)\s*$/.exec(o.pos || '');
    if (String(o.pos || '').trim() && !pm) issues.push(t('생성 위치는 "줄:열" 형식이어야 합니다 (예: 1:15)', 'The generated position must look like "line:column" (e.g. 1:15)'));
    if (pm) {
      var gl = Number(pm[1]) - 1, gcn = Number(pm[2]) - 1, best = null;
      sorted.forEach(function (s) { if (s.line === gl && s.col <= gcn) best = s; });
      if (!best) look.push(t('생성 ' + pm[1] + ':' + pm[2] + ' 에 해당하는 매핑이 없습니다 (해당 줄의 첫 매핑보다 앞이거나 줄에 매핑이 없음)', 'No mapping for generated ' + pm[1] + ':' + pm[2] + ' (before the first mapping on that line or the line has none)'));
      else if (best.src < 0) look.push(t('생성 ' + pm[1] + ':' + pm[2] + ' → 원본 없음 (생성 코드 전용 구간)', 'Generated ' + pm[1] + ':' + pm[2] + ' → no original (generated-only code)'));
      else { look.push(t('생성 ', 'Generated ') + pm[1] + ':' + pm[2] + ' → ' + srcName(best.src) + ':' + (best.ol + 1) + ':' + (best.oc + 1) + (best.name >= 0 ? '  (' + names[best.name] + ')' : '') + (best.col !== gcn ? t('   [가장 가까운 앞 매핑: 열 ', '   [nearest earlier mapping: column ') + (best.col + 1) + ']' : '')); var sn = snippet(best.src, best.ol, best.oc); if (sn) look.push('', sn); }
    }
    var om = /^\s*(.+?)\s*[:,]\s*(\d+)\s*$/.exec(o.orig || '');
    if (String(o.orig || '').trim() && !om) issues.push(t('원본 위치는 "파일:줄" 형식이어야 합니다 (예: util:2)', 'The original position must look like "file:line" (e.g. util:2)'));
    if (om) {
      var key = om[1].toLowerCase(), ln = Number(om[2]) - 1, hits = [];
      sorted.forEach(function (s) { if (s.src >= 0 && s.ol === ln && (srcName(s.src).toLowerCase().indexOf(key) >= 0)) hits.push(s); });
      if (look.length) look.push('');
      if (!hits.length) look.push(t('원본 "' + om[1] + '" 의 ' + om[2] + '줄에 매핑된 생성 코드가 없습니다', 'No generated code maps to line ' + om[2] + ' of "' + om[1] + '"'));
      else { look.push(t('원본 ', 'Original ') + om[1] + ':' + om[2] + t(' → 생성 코드 ' + hits.length + '곳', ' → ' + hits.length + ' generated location(s)')); hits.slice(0, 20).forEach(function (s) { look.push('  ' + (s.line + 1) + ':' + (s.col + 1) + '  ← ' + srcName(s.src) + ':' + (s.ol + 1) + ':' + (s.oc + 1) + (s.name >= 0 ? ' (' + names[s.name] + ')' : '')); }); if (hits.length > 20) look.push('  …'); }
    }
    var srcRows = sources.map(function (s, i) { var c = contents[i]; return [String(i), srcName(i), perSrc[i] ? String(perSrc[i]) : '0', c == null ? '—' : String(c).length.toLocaleString() + ' B / ' + String(c).split(/\r?\n/).length + t('줄', ' lines')]; });
    var lim = Number(o.limit) || 100, mapRows = allSegs.slice(0, lim).map(function (s) { return [(s.line + 1) + ':' + (s.col + 1), s.src >= 0 ? srcName(s.src) : '—', s.src >= 0 ? (s.ol + 1) + ':' + (s.oc + 1) : '—', s.name >= 0 ? String(names[s.name]) : '']; });
    if (allSegs.length > lim) issues.push(t('매핑 ' + allSegs.length + '개 중 처음 ' + lim + '개만 표시합니다', 'Showing the first ' + lim + ' of ' + allSegs.length + ' mappings'));
    var errs = issues.filter(function (x) { return /범위를 벗어|잘못된|구문 오류/.test(x); }).length;
    return { _status: { ok: true, msg: t('✅ 소스 맵 — 소스 ' + sources.length + '개, 매핑 ' + allSegs.length + '개', '✅ Source map — ' + sources.length + ' source(s), ' + allSegs.length + ' mapping(s)') }, info: info, look: look.join('\n'), src: { head: [['#', '#'], ['파일', 'File'], ['매핑 수', 'Mappings'], ['내용 크기', 'Content size']], rows: srcRows }, map: { head: [['생성 줄:열', 'Generated line:col'], ['원본 파일', 'Original file'], ['원본 줄:열', 'Original line:col'], ['이름', 'Name']], rows: mapRows }, issues: issues };
  }
});
