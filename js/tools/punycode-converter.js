TK.tool('punycode-converter', {
  inputs: [{ id: 'in', label: ['도메인 (한 줄에 하나)', 'Domains (one per line)'], rows: 7, placeholder: ['한글.한국 · 例え.jp · xn--bcher-kva.example', '한글.한국 · 例え.jp · xn--bcher-kva.example'], sample: '한글도메인.한국\nbücher.example\n例え.jp\nxn--bcher-kva.example\nxn--e1afmkfd.xn--p1ai\n😀.fm' }],
  options: [{ id: 'dir', type: 'select', label: ['변환 방향', 'Direction'], choices: [['auto', ['자동 (xn--이 있으면 디코딩)', 'Auto (decode if xn-- present)']], ['enc', ['유니코드 → Punycode', 'Unicode → Punycode']], ['dec', ['Punycode → 유니코드', 'Punycode → Unicode']]], default: 'auto' }],
  outputs: [{ id: 'table', label: ['변환 결과', 'Conversion'], kind: 'table' }, { id: 'out', label: ['변환된 목록', 'Converted list'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var D = TK.dns, lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rows = [], outs = [];
    lines.forEach(function (ln) {
      var host = ln.replace(/^[a-z]+:\/\//i, '').replace(/[\/?#].*$/, ''), dec = o.dir === 'dec' || (o.dir === 'auto' && /(^|\.)xn--/i.test(host)), res, notes = [];
      try {
        if (dec) { res = D.toUnicode(host); }
        else {
          res = D.toASCII(host);
          res.split('.').forEach(function (l) { if (l.length > 63) notes.push(t('레이블 63자 초과: ' + l.slice(0, 12) + '…', 'Label longer than 63: ' + l.slice(0, 12) + '…')); });
          if (res.length > 253) notes.push(t('전체 253자 초과', 'Longer than 253 characters'));
        }
        outs.push(res);
        var labels = host.split('.').length;
        rows.push([ln, dec ? 'Punycode → Unicode' : 'Unicode → Punycode', res, notes.join(' · ') || (res === host ? t('변환할 것이 없습니다 (이미 ASCII)', 'Nothing to convert (already ASCII)') : labels + t('개 레이블', ' label(s)'))]);
      } catch (e) { rows.push({ cls: 'r-bad', cells: [ln, '—', '—', e.message] }); }
    });
    return { _status: lines.length ? t('✅ ' + outs.length + '개 변환', '✅ Converted ' + outs.length) : '', table: { head: [['입력', 'Input'], ['방향', 'Direction'], ['결과', 'Result'], ['메모', 'Notes']], rows: rows }, out: outs.join('\n') };
  }
});
