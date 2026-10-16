TK.tool('text-chunker', {
  inputs: [{ id: 'in', label: ['나눌 문서', 'Document to split'], rows: 14, sample: '# RAG 소개\n\nRAG(Retrieval-Augmented Generation)는 외부 문서를 검색해 LLM 의 답변을 보강하는 방식입니다. 문서를 적당한 크기로 나누는 청킹이 검색 품질을 좌우합니다.\n\n## 청킹 전략\n\n고정 길이 청킹은 단순하지만 문장이 중간에서 잘릴 수 있습니다. 문단·제목 기준 청킹은 의미 단위를 유지합니다. 겹침(overlap)을 두면 경계에서 문맥이 끊기는 문제를 줄일 수 있습니다.\n\n## 주의사항\n\n청크가 너무 작으면 문맥이 부족하고, 너무 크면 관련 없는 내용이 섞여 검색 정밀도가 떨어집니다. Chunks that are too large also cost more tokens when they are placed in the prompt.' }],
  options: [
    { id: 'by', type: 'select', label: ['기준', 'Split by'], choices: [['chars', ['글자 수', 'Characters']], ['tokens', ['토큰 수 (추정)', 'Tokens (estimated)']], ['para', ['문단 (빈 줄)', 'Paragraphs (blank lines)']], ['heading', ['마크다운 제목', 'Markdown headings']], ['sentence', ['문장', 'Sentences']]], default: 'chars' },
    { id: 'size', type: 'number', label: ['청크 크기 (글자 수 · 토큰/문단/제목/문장 기준일 때는 토큰)', 'Chunk size (characters; tokens for the token, paragraph, heading and sentence modes)'], default: 300, min: 20, max: 20000 },
    { id: 'overlap', type: 'number', label: ['겹침 (글자 수 · 토큰 기준일 때는 토큰)', 'Overlap (characters; tokens in token mode)'], default: 40, min: 0, max: 5000 },
    { id: 'boundary', type: 'checkbox', label: ['단어·문장 경계에서 자르기', 'Cut on word / sentence boundaries'], default: true, show: function (o) { return o.by === 'chars' || o.by === 'tokens'; } },
    { id: 'tkm', type: 'select', label: ['토큰 추정 방식', 'Token estimate'], choices: [['en', ['영어 위주 (≈ 4자/토큰)', 'English-like (≈ 4 chars / token)']], ['ko', ['한국어 위주 (≈ 1.5자/토큰)', 'Korean-like (≈ 1.5 chars / token)']], ['mix', ['혼합 (자동)', 'Mixed (auto)']]], default: 'mix' }
  ],
  outputs: [{ id: 'table', label: ['청크 목록', 'Chunks'], kind: 'table' }, { id: 'out', label: ['JSON', 'JSON'], kind: 'code', ext: 'json' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var text = String(v.in).replace(/\r\n/g, '\n'); if (!text.trim()) throw new Error(t('문서를 입력하세요', 'Enter a document'));
    var issues = [], size = Math.max(20, Math.round(o.size)), ov = Math.max(0, Math.round(o.overlap));
    if (ov >= size) throw new Error(t('겹침은 청크 크기보다 작아야 합니다', 'The overlap must be smaller than the chunk size'));
    function est(s) { var cjk = (s.match(/[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ一-鿿]/g) || []).length, other = s.length - cjk; var cpt = o.tkm === 'en' ? 4 : o.tkm === 'ko' ? 1.5 : null; if (cpt) return Math.ceil(s.length / cpt); return Math.ceil(cjk / 1.5 + other / 4); }
    var unit = o.by === 'tokens' ? 'tokens' : 'chars', chunks = [];
    function byChars(src, limitChars, overChars) {
      var out = [], i = 0, n = src.length;
      while (i < n) {
        var end = Math.min(n, i + limitChars);
        if (o.boundary && end < n) { var win = src.slice(i + Math.floor(limitChars * 0.5), end), m = Math.max(win.lastIndexOf('\n\n'), win.lastIndexOf('. '), win.lastIndexOf('。'), win.lastIndexOf('다. '), win.lastIndexOf('? '), win.lastIndexOf('! ')); if (m < 0) m = Math.max(win.lastIndexOf('\n'), win.lastIndexOf(' ')); if (m >= 0) end = i + Math.floor(limitChars * 0.5) + m + 1; }
        out.push({ start: i, end: end, text: src.slice(i, end) });
        if (end >= n) break;
        i = Math.max(end - overChars, i + 1);
      }
      return out;
    }
    if (o.by === 'chars') chunks = byChars(text, size, ov);
    else if (o.by === 'tokens') {
      var cpt = o.tkm === 'en' ? 4 : o.tkm === 'ko' ? 1.5 : (est(text) ? text.length / est(text) : 4);
      chunks = byChars(text, Math.max(20, Math.round(size * cpt)), Math.round(ov * cpt));
    } else {
      var units = [], re;
      if (o.by === 'para') { re = /\n{2,}/g; } else if (o.by === 'heading') { re = /\n(?=#{1,6}\s)/g; } else { re = null; }
      if (re) { var last = 0, m; while ((m = re.exec(text))) { units.push({ s: last, e: m.index }); last = m.index + m[0].length - (o.by === 'heading' ? 0 : 0); if (o.by === 'heading') last = m.index + 1; } units.push({ s: last, e: text.length }); }
      else { var sr = /[^.!?。！？\n]+(?:[.!?。！？]+["'”’)\]]*|\n|$)\s*/g, mm; while ((mm = sr.exec(text))) units.push({ s: mm.index, e: mm.index + mm[0].length }); }
      units = units.filter(function (u) { return text.slice(u.s, u.e).trim(); });
      // 단위를 size 이내로 합치되, 단일 단위가 size 보다 크면 글자 기준으로 쪼갬
      var cur = null;
      function sz(a, b) { var s = text.slice(a, b); return o.tkm ? est(s) : s.length; }
      units.forEach(function (u) {
        if (sz(u.s, u.e) > size * (o.by === 'heading' || o.by === 'para' ? 3 : 1) && o.by !== 'sentence') { if (cur) { chunks.push(cur); cur = null; } var sub = byChars(text.slice(u.s, u.e), Math.round(size * 4), Math.round(ov * 4)); sub.forEach(function (c) { chunks.push({ start: u.s + c.start, end: u.s + c.end, text: c.text }); }); issues.push(t('한 단위(' + sz(u.s, u.e) + '토큰)가 커서 글자 기준으로 추가 분할했습니다', 'One unit (' + sz(u.s, u.e) + ' tokens) was too large and was split by characters')); return; }
        if (cur && o.by !== 'heading' && sz(cur.start, u.e) <= size) { cur.end = u.e; cur.text = text.slice(cur.start, cur.end); }
        else { if (cur) chunks.push(cur); cur = { start: u.s, end: u.e, text: text.slice(u.s, u.e) }; }
      });
      if (cur) chunks.push(cur);
      if (ov > 0 && (o.by === 'sentence' || o.by === 'para' || o.by === 'heading')) issues.push(t('문단·문장·제목 기준은 의미 단위를 유지하므로 겹침은 적용하지 않았습니다', 'Paragraph, sentence and heading splitting keep units whole, so the overlap was not applied'));
    }
    var rows = chunks.map(function (c, i) {
      var tk = est(c.text), prevEnd = i ? chunks[i - 1].end : 0, ovl = i ? Math.max(0, prevEnd - c.start) : 0;
      return [String(i + 1), c.start + '–' + c.end, c.text.length + t('자', ' ch'), '≈' + tk + ' tok', i ? (ovl ? ovl + t('자 겹침', ' ch overlap') : t('겹침 없음', 'no overlap')) : '—', c.text.replace(/\s+/g, ' ').trim().slice(0, 60) + (c.text.length > 60 ? '…' : '')];
    });
    var lens = chunks.map(function (c) { return c.text.length; }), avg = Math.round(lens.reduce(function (a, b) { return a + b; }, 0) / lens.length);
    var tiny = chunks.filter(function (c) { return c.text.trim().length < size * (o.by === 'tokens' ? 1.5 : 1) * 0.15; }).length;
    if (tiny) issues.push(t('아주 짧은 청크 ' + tiny + '개 — 문맥이 부족해 검색 품질이 떨어질 수 있습니다', tiny + ' very short chunk(s) — little context may hurt retrieval'));
    issues.push(t('토큰 수는 글자 수로 추정한 값입니다. 정확한 값은 사용하는 모델의 토크나이저(tiktoken 등)로 계산하세요 (한글은 영어보다 토큰이 많이 듭니다)', 'Token counts are estimated from characters; use your model\'s tokenizer (e.g. tiktoken) for exact numbers (Korean uses more tokens than English)'));
    issues.push(t('일반적으로 200~500 토큰, 10~20% 겹침에서 시작해 검색 결과를 보며 조정합니다. 표·코드 블록은 중간에서 자르지 않는 것이 좋습니다', 'A common starting point is 200–500 tokens with 10–20% overlap, tuned by looking at retrieval results; avoid cutting tables or code blocks'));
    var json = JSON.stringify(chunks.map(function (c, i) { return { id: i, start: c.start, end: c.end, chars: c.text.length, tokens_est: est(c.text), text: c.text }; }), null, 2);
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: t('✅ 청크 ' + chunks.length + '개 · 평균 ' + avg + '자 · 전체 ≈' + est(text) + ' 토큰', '✅ ' + chunks.length + ' chunk(s) · avg ' + avg + ' chars · total ≈' + est(text) + ' tokens'), table: { head: [['#', '#'], ['범위', 'Range'], ['길이', 'Length'], ['토큰(추정)', 'Tokens (est.)'], ['겹침', 'Overlap'], ['미리보기', 'Preview']], rows: rows.slice(0, 500) }, out: json, issues: uniq };
  }
});
