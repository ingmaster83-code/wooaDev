TK.tool('sse-parser', {
  inputs: [{ id: 'in', label: ['SSE 스트림 원문 (text/event-stream)', 'Raw SSE stream (text/event-stream)'], rows: 14, sample: ': keep-alive comment\nretry: 3000\n\nevent: message\nid: 101\ndata: {"delta":"Hel"}\n\nevent: message\nid: 102\ndata: {"delta":"lo"}\n\ndata: first line\ndata: second line\n\nevent: done\ndata: [DONE]\n\ndata: truncated, no blank line at the end' }],
  options: [{ id: 'json', type: 'checkbox', label: ['data 가 JSON 이면 파싱해서 표시', 'Parse data as JSON when possible'], default: true }],
  outputs: [{ id: 'table', label: ['이벤트', 'Events'], kind: 'table' }, { id: 'out', label: ['data 이어붙인 결과', 'Concatenated data'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var raw = String(v.in); if (!raw.trim()) throw new Error(t('스트림을 입력하세요', 'Enter a stream'));
    var text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'), lines = text.split('\n'), events = [], issues = [], cur = { data: [], type: '', id: '', retry: '', comments: [], n: 0 }, lastId = '', retry = '', comments = 0, unknown = [];
    function dispatch() {
      if (cur.data.length || cur.type || cur.id) { if (cur.data.length) events.push({ type: cur.type || 'message', id: cur.id, data: cur.data.join('\n'), n: cur.n }); else if (cur.type || cur.id) { issues.push(t('data 없이 끝난 블록은 이벤트로 전달되지 않습니다 (event: ' + (cur.type || '-') + ')', 'A block with no data field is not dispatched (event: ' + (cur.type || '-') + ')')); } }
      cur = { data: [], type: '', id: cur.id, retry: '', comments: [], n: 0 };
    }
    lines.forEach(function (ln, i) {
      if (ln === '') { dispatch(); return; }
      if (ln[0] === ':') { comments++; return; }
      var c = ln.indexOf(':'), field = c < 0 ? ln : ln.slice(0, c), val = c < 0 ? '' : ln.slice(c + 1).replace(/^ /, '');
      if (!cur.n) cur.n = i + 1;
      if (field === 'data') cur.data.push(val); else if (field === 'event') cur.type = val; else if (field === 'id') { if (val.indexOf('\0') < 0) { cur.id = val; lastId = val; } } else if (field === 'retry') { if (/^\d+$/.test(val)) retry = val; else issues.push(t('retry 값은 정수(ms)여야 합니다: ' + val, 'retry must be an integer (ms): ' + val)); } else unknown.push(field);
    });
    var tail = lines[lines.length - 1] !== '' && cur.data.length;
    if (tail) { issues.push(t('마지막 블록 뒤에 빈 줄이 없어 이벤트로 전달되지 않았습니다 (연결이 끊기면 버려짐): data: ' + cur.data.join(' ').slice(0, 30), 'The last block has no trailing blank line, so it is not dispatched (dropped if the connection closes): data: ' + cur.data.join(' ').slice(0, 30))); }
    if (!events.length) throw new Error(t('이벤트가 없습니다 — 각 이벤트는 빈 줄로 끝나야 합니다', 'No events — each event must end with a blank line'));
    var rows = [], chunks = [], jsonN = 0, parts = [];
    events.forEach(function (e, i) {
      var shown = e.data, kind = 'text';
      if (o.json) { try { var j = JSON.parse(e.data); shown = JSON.stringify(j); kind = 'JSON'; jsonN++; var d = j && (j.delta !== undefined ? j.delta : j.choices && j.choices[0] && (j.choices[0].delta && j.choices[0].delta.content !== undefined ? j.choices[0].delta.content : j.choices[0].text) !== undefined ? (j.choices[0].delta ? j.choices[0].delta.content : j.choices[0].text) : j.content_block_delta ? j.content_block_delta.text : (j.delta && j.delta.text)); if (typeof d === 'string') parts.push(d); } catch (er) { if (e.data === '[DONE]') kind = t('종료 신호', 'end marker'); } }
      else if (e.data === '[DONE]') kind = t('종료 신호', 'end marker');
      rows.push([String(i + 1), e.type, e.id || '—', kind, shown.length > 90 ? shown.slice(0, 87) + '…' : shown.replace(/\n/g, ' ⏎ ')]);
      if (e.data !== '[DONE]') chunks.push(e.data);
    });
    var types = {}; events.forEach(function (e) { types[e.type] = (types[e.type] || 0) + 1; });
    rows.push(['', '', '', '', '']);
    rows.push([t('요약', 'Summary'), Object.keys(types).map(function (k) { return k + ' ×' + types[k]; }).join(', '), lastId ? 'Last-Event-ID=' + lastId : '—', retry ? 'retry=' + retry + 'ms' : '—', comments + t('개 주석(:)', ' comment line(s) (:)')]);
    if (unknown.length) issues.push(t('알 수 없는 필드는 무시됩니다: ' + unknown.slice(0, 4).join(', '), 'Unknown fields are ignored: ' + unknown.slice(0, 4).join(', ')));
    if (events.some(function (e) { return e.data === '[DONE]'; })) issues.push(t('data: [DONE] 은 SSE 표준이 아니라 OpenAI 호환 API 의 종료 신호 관례입니다', 'data: [DONE] is a convention of OpenAI-compatible APIs, not part of the SSE standard'));
    if (parts.length) issues.push(t('LLM 스트리밍 형태(delta/choices)를 감지해 텍스트 조각을 이어 붙였습니다', 'LLM streaming shape (delta / choices) detected; text fragments were joined'));
    issues.push(t('EventSource 는 연결이 끊기면 마지막 id 를 Last-Event-ID 헤더로 보내 재연결합니다(기본 약 3초, retry 로 조정). 응답 Content-Type 은 text/event-stream 이어야 하고 프록시 버퍼링을 꺼야 합니다(X-Accel-Buffering: no)', 'On disconnect EventSource reconnects with the last id in the Last-Event-ID header (about 3 s by default, tune with retry). The response must be text/event-stream and proxy buffering must be off (X-Accel-Buffering: no)'));
    issues.push(t('EventSource 는 GET 만 지원하고 헤더를 못 바꿉니다. POST·인증 헤더가 필요하면 fetch 스트림을 쓰세요', 'EventSource supports GET only and cannot set headers; use a fetch stream for POST or auth headers'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: tail ? { ok: 'info', msg: t('🔍 이벤트 ' + events.length + '개 · 마지막 블록 미완성', '🔍 ' + events.length + ' events · last block incomplete') } : t('✅ 이벤트 ' + events.length + '개', '✅ ' + events.length + ' event(s)'), table: { head: [['#', '#'], ['event', 'event'], ['id', 'id'], ['형식', 'Kind'], ['data', 'data']], rows: rows }, out: parts.length ? parts.join('') : chunks.join('\n'), issues: uniq };
  }
});
