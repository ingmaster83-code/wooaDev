TK.tool('env-editor', {
  autoSample: true,
  inputs: [{ id: 'in', label: ['.env 붙여넣기', 'Paste .env'], rows: 8, sample: '# app\nNODE_ENV=development\nPORT=3000\nDATABASE_URL=postgres://user:pass@localhost/db\nJWT_SECRET=changeme\nDEBUG=true' }],
  options: [{ id: 'hide', type: 'checkbox', label: ['값을 점(•)으로 숨기기', 'Hide values'], default: false }],
  outputs: [
    { id: 'grid', label: ['표로 편집 (셀을 직접 수정하세요)', 'Edit as a table (edit cells directly)'], kind: 'html' },
    { id: 'out', label: ['편집 결과 .env', 'Edited .env'], kind: 'code', ext: 'env', mime: 'text/plain' }
  ],
  swap: { from: 'out', to: 'in', label: ['결과를 입력으로', 'Use result as input'] },
  run: function (v, o, t) {
    var r = TK.env.parse(v.in), E = TK.env, esc = TK.esc;
    var h = '<div class="tk-table-wrap"><table class="tk-table tk-grid-edit" id="envgrid"><thead><tr><th>' + t('변수', 'Variable') + '</th><th>' + t('값', 'Value') + '</th><th></th></tr></thead><tbody>';
    r.entries.forEach(function (e) {
      if (e.type === 'kv') h += '<tr data-k="kv" data-exp="' + (e.exported ? 1 : 0) + '"><td style="width:34%"><input class="ek" value="' + esc(e.key) + '" spellcheck="false"></td><td><input class="ev" type="' + (o.hide ? 'password' : 'text') + '" value="' + esc(e.value) + '" spellcheck="false"></td><td style="width:48px"><button type="button" class="dev-btn secondary tk-mini" data-act="del">✕</button></td></tr>';
      else if (e.type === 'comment') h += '<tr data-k="c" data-raw="' + esc(e.text) + '"><td colspan="3" style="color:#9CA3AF">' + esc(e.text) + '</td></tr>';
      else if (e.type === 'blank') h += '<tr data-k="b" style="display:none"><td colspan="3"></td></tr>';
      else h += '<tr data-k="c" data-raw="' + esc(e.raw) + '" class="r-bad"><td colspan="3">⚠ ' + esc(e.raw) + '</td></tr>';
    });
    h += '</tbody></table></div><div class="dev-btn-row"><button type="button" class="dev-btn secondary" data-act="add">+ ' + t('변수 추가', 'Add variable') + '</button></div>';
    var dups = {}, d = [];
    r.vars.forEach(function (x) { if (dups[x.key]) d.push(x.key); dups[x.key] = 1; });
    return {
      _status: r.issues.length ? { ok: 'info', msg: '⚠️ ' + r.issues.map(function (x) { return t('줄 ', 'line ') + x.line + ': ' + x.msg; }).join(' / ') } : t('✅ 변수 ' + r.vars.length + '개', '✅ ' + r.vars.length + ' variable(s)'),
      grid: h,
      out: serialize(r.entries)
    };
    function serialize(entries) {
      return entries.map(function (e) {
        if (e.type === 'kv') return (e.exported ? 'export ' : '') + e.key + '=' + E.quote(e.value);
        if (e.type === 'comment') return e.text;
        if (e.type === 'blank') return '';
        return e.raw;
      }).join('\n').replace(/\n+$/, '') + '\n';
    }
  },
  mount: function (root, api) {
    var E = TK.env;
    function rebuild() {
      var grid = root.querySelector('#envgrid'); if (!grid) return;
      var lines = [];
      grid.querySelectorAll('tbody tr').forEach(function (tr) {
        var k = tr.getAttribute('data-k');
        if (k === 'kv') {
          var key = tr.querySelector('.ek').value.trim(), val = tr.querySelector('.ev').value;
          if (key) lines.push((tr.getAttribute('data-exp') === '1' ? 'export ' : '') + key + '=' + E.quote(val));
        } else if (k === 'c') lines.push(tr.getAttribute('data-raw'));
        else lines.push('');
      });
      api.setOutput('out', lines.join('\n').replace(/\n+$/, '') + '\n');
    }
    root.addEventListener('input', function (e) { if (e.target && (e.target.classList.contains('ek') || e.target.classList.contains('ev'))) rebuild(); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act]') : null; if (!b) return;
      var grid = root.querySelector('#envgrid'); if (!grid) return;
      if (b.getAttribute('data-act') === 'del') { b.closest('tr').parentNode.removeChild(b.closest('tr')); rebuild(); }
      if (b.getAttribute('data-act') === 'add') {
        var tr = document.createElement('tr'); tr.setAttribute('data-k', 'kv'); tr.setAttribute('data-exp', '0');
        tr.innerHTML = '<td style="width:34%"><input class="ek" spellcheck="false" placeholder="NEW_KEY"></td><td><input class="ev" type="text" spellcheck="false"></td><td style="width:48px"><button type="button" class="dev-btn secondary tk-mini" data-act="del">✕</button></td>';
        grid.querySelector('tbody').appendChild(tr); tr.querySelector('.ek').focus();
      }
    });
  }
});
