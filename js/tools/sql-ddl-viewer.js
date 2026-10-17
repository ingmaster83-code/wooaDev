TK.tool('sql-ddl-viewer', {
  sampleExpectError: true,
  inputs: [{ id: 'in', label: ['SQL DDL (CREATE TABLE · CREATE INDEX · ALTER TABLE)', 'SQL DDL (CREATE TABLE, CREATE INDEX, ALTER TABLE)'], rows: 22, sample: [
    'CREATE TABLE users (', '  id BIGINT PRIMARY KEY AUTO_INCREMENT,', '  email VARCHAR(255) NOT NULL UNIQUE,', '  name VARCHAR(100),', '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', ');', '',
    'CREATE TABLE posts (', '  id BIGINT NOT NULL,', '  user_id INT NOT NULL,', '  title VARCHAR(200) NOT NULL,', '  body TEXT,', '  category_id BIGINT,', '  PRIMARY KEY (id),', '  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE', ');', '',
    'CREATE TABLE tags (id INT PRIMARY KEY, label TEXT NOT NULL);', 'CREATE TABLE post_tags (post_id BIGINT NOT NULL REFERENCES posts(id), tag_id INT NOT NULL REFERENCES tags(id), PRIMARY KEY (post_id, tag_id));',
    'CREATE INDEX idx_posts_title ON posts (title);', 'ALTER TABLE posts ADD CONSTRAINT fk_posts_cat FOREIGN KEY (category_id) REFERENCES categories(id);', ''].join('\n') }],
  options: [{ id: 'hints', type: 'checkbox', label: ['권고(ℹ️)도 표시', 'Also show hints (ℹ️)'], default: true }],
  outputs: [{ id: 'erd', label: ['ERD (관계도)', 'ERD (relationship diagram)'], kind: 'html' }, { id: 'table', label: ['테이블 · 컬럼', 'Tables and columns'], kind: 'table' }, { id: 'rel', label: ['관계 (외래 키)', 'Relationships (foreign keys)'], kind: 'table' }, { id: 'mermaid', label: ['Mermaid erDiagram', 'Mermaid erDiagram'], kind: 'code', ext: 'mmd' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], src = String(v['in'] || ''); if (!src.trim()) throw new Error(t('SQL DDL 을 입력하세요', 'Enter SQL DDL'));
    /* 토큰화: 주석·문자열 보존, 문장 분리 */
    var stmts = [], cur = '', i = 0, n = src.length, line = 1, stLine = 1;
    function flush() { if (cur.trim()) stmts.push({ text: cur.trim(), line: stLine }); cur = ''; }
    while (i < n) {
      var c = src[i], nx = src[i + 1];
      if (!cur.trim()) stLine = line;
      if (c === '-' && nx === '-') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '#' ) { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && nx === '*') { var e = src.indexOf('*/', i + 2); var seg = e < 0 ? src.slice(i) : src.slice(i, e + 2); line += (seg.match(/\n/g) || []).length; i += seg.length; continue; }
      if (c === '\'' || c === '"' || c === '`') { var q = c, j = i + 1; while (j < n) { if (src[j] === q) { if (src[j + 1] === q) { j += 2; continue; } break; } j++; } cur += src.slice(i, j + 1); line += (src.slice(i, j + 1).match(/\n/g) || []).length; i = j + 1; continue; }
      if (c === '[' && /\w/.test(src[i + 1] || '')) { var e2 = src.indexOf(']', i); if (e2 > 0) { cur += src.slice(i, e2 + 1); i = e2 + 1; continue; } }
      if (c === ';') { flush(); i++; continue; }
      if (c === '\n') line++;
      cur += c; i++;
    }
    flush();
    function unq(s) { s = s.trim(); var m = /^[`"\[](.*)[`"\]]$/.exec(s); return m ? m[1] : s; }
    function nameOf(s) { var parts = s.trim().split('.'); return unq(parts[parts.length - 1]); }
    function splitTop(body) { var out = [], depth = 0, cur2 = '', q2 = null; for (var k = 0; k < body.length; k++) { var ch = body[k]; if (q2) { cur2 += ch; if (ch === q2) q2 = null; continue; } if (ch === '\'' || ch === '"' || ch === '`') { q2 = ch; cur2 += ch; continue; } if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur2); cur2 = ''; continue; } cur2 += ch; } if (cur2.trim()) out.push(cur2); return out; }
    function cols(s) { return s.replace(/^\s*\(|\)\s*$/g, '').split(',').map(function (x) { return unq(x.trim().replace(/\s+(ASC|DESC)$/i, '').replace(/\(\d+\)$/, '')); }).filter(Boolean); }
    var tables = {}, torder = [], indexes = [], rels = [];
    var RESERVED = ['order', 'group', 'user', 'table', 'select', 'index', 'key', 'desc', 'limit', 'check', 'column', 'default', 'primary', 'references', 'from', 'where', 'to', 'by'];
    stmts.forEach(function (st) {
      var m = /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:GLOBAL\s+|LOCAL\s+)?(?:TEMPORARY|TEMP)\s+)?(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:[`"\[]?[\w$]+[`"\]]?\.)?[`"\[]?[\w$ ]+?[`"\]]?)\s*\(([\s\S]*)\)\s*([^()]*)$/i.exec(st.text);
      if (m) {
        var tn = nameOf(m[1]), tb = { name: tn, cols: [], pk: [], uniques: [], fks: [], checks: [], line: st.line, indexes: [] };
        if (tables[tn]) issues.push({ sev: 'error', line: st.line, msg: t('테이블 ' + tn + ' 이(가) 중복 정의되었습니다', 'Table ' + tn + ' is defined twice') });
        splitTop(m[2]).forEach(function (def) {
          def = def.trim(); if (!def) return;
          var cm = /^(?:CONSTRAINT\s+([`"\[]?[\w$]+[`"\]]?)\s+)?(PRIMARY\s+KEY|UNIQUE(?:\s+(?:KEY|INDEX))?|FOREIGN\s+KEY|CHECK|(?:FULLTEXT|SPATIAL)?\s*(?:KEY|INDEX))\b\s*([`"\[]?[\w$]+[`"\]]?\s*)?(\([\s\S]*)$/i.exec(def);
          if (cm) {
            var kind = cm[2].toUpperCase().replace(/\s+/g, ' '), rest = cm[4];
            if (/^PRIMARY/.test(kind)) { var cl = /^\(([^)]*)\)/.exec(rest); if (cl) tb.pk = cols('(' + cl[1] + ')'); }
            else if (/^UNIQUE/.test(kind)) { var cl2 = /^\(([^)]*)\)/.exec(rest); if (cl2) tb.uniques.push(cols('(' + cl2[1] + ')')); }
            else if (/^FOREIGN/.test(kind)) { var fm = /^\(([^)]*)\)\s*REFERENCES\s+((?:[`"\[]?[\w$]+[`"\]]?\.)?[`"\[]?[\w$]+[`"\]]?)\s*(?:\(([^)]*)\))?([\s\S]*)$/i.exec(rest); if (fm) { var onD = /ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/i.exec(fm[4]), onU = /ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/i.exec(fm[4]); tb.fks.push({ name: cm[1] ? unq(cm[1]) : '', cols: cols('(' + fm[1] + ')'), ref: nameOf(fm[2]), refCols: fm[3] ? cols('(' + fm[3] + ')') : [], onDelete: onD ? onD[1].toUpperCase() : '', onUpdate: onU ? onU[1].toUpperCase() : '', line: st.line }); } }
            else if (/^CHECK/.test(kind)) tb.checks.push(rest.slice(0, 60));
            else { var cl3 = /\(([^)]*)\)/.exec(rest); if (cl3) tb.indexes.push({ name: cm[3] ? unq(cm[3]) : '', cols: cols('(' + cl3[1] + ')') }); }
            return;
          }
          var dm = /^([`"\[]?[\w$ ]+?[`"\]]?)\s+([A-Za-z_]\w*(?:\s+(?:PRECISION|VARYING))?(?:\s*\([^)]*\))?(?:\s+WITH(?:OUT)?\s+TIME\s+ZONE)?(?:\s+(?:UNSIGNED|ZEROFILL))*(?:\[\])?)\s*([\s\S]*)$/i.exec(def);
          if (!dm) { issues.push({ sev: 'warn', line: st.line, msg: t('컬럼 정의를 해석하지 못했습니다: ' + def.slice(0, 50), 'Could not parse column definition: ' + def.slice(0, 50)) }); return; }
          var cname = unq(dm[1]), ctype = dm[2].trim().replace(/\s+/g, ' '), crest = dm[3] || '';
          var extra = /^(NOT|NULL|DEFAULT|PRIMARY|UNIQUE|REFERENCES|CHECK|AUTO_INCREMENT|AUTOINCREMENT|GENERATED|COLLATE|COMMENT|CONSTRAINT|IDENTITY|SERIAL|ON|CHARACTER)\b/i.exec(ctype.split(' ').slice(-1)[0]);
          var col = { name: cname, type: ctype, nullable: !/NOT\s+NULL/i.test(crest) && !/PRIMARY\s+KEY/i.test(crest), pk: /PRIMARY\s+KEY/i.test(crest), unique: /\bUNIQUE\b/i.test(crest), auto: /AUTO_?INCREMENT|AUTOINCREMENT|IDENTITY|GENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY/i.test(crest) || /^(BIG|SMALL)?SERIAL/i.test(ctype), def: '', comment: '' };
          var dd = /DEFAULT\s+((?:'(?:[^']|'')*'|[\w.$]+(?:\([^)]*\))?|\([^)]*\)|-?\d+(?:\.\d+)?))/i.exec(crest); if (dd) col.def = dd[1];
          var cmm = /COMMENT\s+'((?:[^']|'')*)'/i.exec(crest); if (cmm) col.comment = cmm[1];
          if (tb.cols.some(function (x) { return x.name.toLowerCase() === cname.toLowerCase(); })) issues.push({ sev: 'error', line: st.line, msg: t('테이블 ' + tn + ' 의 컬럼 ' + cname + ' 이(가) 중복되었습니다', 'Column ' + cname + ' of table ' + tn + ' is duplicated') });
          if (col.pk) tb.pk.push(cname);
          var rf = /REFERENCES\s+((?:[`"\[]?[\w$]+[`"\]]?\.)?[`"\[]?[\w$]+[`"\]]?)\s*(?:\(([^)]*)\))?([^,]*)/i.exec(crest);
          if (rf) { var oD = /ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/i.exec(rf[3] || ''); tb.fks.push({ name: '', cols: [cname], ref: nameOf(rf[1]), refCols: rf[2] ? cols('(' + rf[2] + ')') : [], onDelete: oD ? oD[1].toUpperCase() : '', onUpdate: '', line: st.line }); }
          tb.cols.push(col);
        });
        tb.cols.forEach(function (c) { if (tb.pk.indexOf(c.name) >= 0) { c.pk = true; c.nullable = false; } });
        tables[tn] = tb; torder.push(tn); return;
      }
      var im = /^CREATE\s+(UNIQUE\s+)?(?:FULLTEXT\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([`"\[]?[\w$]+[`"\]]?)\s+ON\s+((?:[`"\[]?[\w$]+[`"\]]?\.)?[`"\[]?[\w$]+[`"\]]?)\s*(?:USING\s+\w+\s*)?\(([^]*?)\)/i.exec(st.text);
      if (im) { indexes.push({ unique: !!im[1], name: unq(im[2]), table: nameOf(im[3]), cols: cols('(' + im[4] + ')'), line: st.line }); return; }
      var am = /^ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?((?:[`"\[]?[\w$]+[`"\]]?\.)?[`"\[]?[\w$]+[`"\]]?)\s+([\s\S]*)$/i.exec(st.text);
      if (am) {
        var atn = nameOf(am[1]), body = am[2];
        var afk = /ADD\s+(?:CONSTRAINT\s+([`"\[]?[\w$]+[`"\]]?)\s+)?FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+((?:[`"\[]?[\w$]+[`"\]]?\.)?[`"\[]?[\w$]+[`"\]]?)\s*(?:\(([^)]*)\))?([\s\S]*)/i.exec(body);
        if (afk) { var oD2 = /ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/i.exec(afk[5]); indexes.push({ alterFk: { table: atn, name: afk[1] ? unq(afk[1]) : '', cols: cols('(' + afk[2] + ')'), ref: nameOf(afk[3]), refCols: afk[4] ? cols('(' + afk[4] + ')') : [], onDelete: oD2 ? oD2[1].toUpperCase() : '', onUpdate: '', line: st.line } }); return; }
        var apk = /ADD\s+(?:CONSTRAINT\s+[`"\[]?[\w$]+[`"\]]?\s+)?PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(body); if (apk) { indexes.push({ alterPk: { table: atn, cols: cols('(' + apk[1] + ')') } }); return; }
        var aun = /ADD\s+(?:CONSTRAINT\s+[`"\[]?[\w$]+[`"\]]?\s+)?UNIQUE\s*(?:KEY|INDEX)?\s*[`"\[]?[\w$]*[`"\]]?\s*\(([^)]*)\)/i.exec(body); if (aun) { indexes.push({ alterUq: { table: atn, cols: cols('(' + aun[1] + ')') } }); return; }
        var aco = /ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([`"\[]?[\w$]+[`"\]]?)\s+([A-Za-z]\w*(?:\s*\([^)]*\))?)/i.exec(body); if (aco && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CHECK)$/i.test(unq(aco[1]))) { indexes.push({ alterCol: { table: atn, name: unq(aco[1]), type: aco[2], line: st.line } }); return; }
        return;
      }
      if (/^(DROP|INSERT|UPDATE|DELETE|SELECT|SET|USE|GRANT|COMMENT|BEGIN|COMMIT|CREATE\s+(DATABASE|SCHEMA|VIEW|SEQUENCE|TYPE|EXTENSION|TRIGGER|FUNCTION|PROCEDURE))/i.test(st.text)) { if (o.hints && /^CREATE\s+(VIEW|TRIGGER|FUNCTION|PROCEDURE|SEQUENCE|TYPE)/i.test(st.text)) issues.push({ sev: 'info', line: st.line, msg: t('CREATE ' + st.text.split(/\s+/)[1] + ' 문은 해석하지 않고 건너뛰었습니다', 'Skipped a CREATE ' + st.text.split(/\s+/)[1] + ' statement') }); return; }
      issues.push({ sev: 'warn', line: st.line, msg: t('해석하지 못한 문장: ' + st.text.slice(0, 50).replace(/\s+/g, ' '), 'Could not parse the statement: ' + st.text.slice(0, 50).replace(/\s+/g, ' ')) });
    });
    if (!torder.length) throw new Error(t('CREATE TABLE 문을 찾지 못했습니다', 'No CREATE TABLE statement found'));
    var tbIndexes = {};
    indexes.forEach(function (ix) {
      if (ix.alterFk) { var tb = tables[ix.alterFk.table]; if (!tb) issues.push({ sev: 'error', line: ix.alterFk.line, msg: t('ALTER TABLE 대상 ' + ix.alterFk.table + ' 이(가) 정의되지 않았습니다', 'ALTER TABLE target ' + ix.alterFk.table + ' is not defined') }); else tb.fks.push(ix.alterFk); }
      else if (ix.alterPk) { var t2 = tables[ix.alterPk.table]; if (t2) { t2.pk = ix.alterPk.cols; t2.cols.forEach(function (c) { if (t2.pk.indexOf(c.name) >= 0) { c.pk = true; c.nullable = false; } }); } }
      else if (ix.alterUq) { if (tables[ix.alterUq.table]) tables[ix.alterUq.table].uniques.push(ix.alterUq.cols); }
      else if (ix.alterCol) { var t3 = tables[ix.alterCol.table]; if (t3) t3.cols.push({ name: ix.alterCol.name, type: ix.alterCol.type, nullable: true, pk: false, unique: false, auto: false, def: '', comment: '' }); }
      else { if (!tables[ix.table]) issues.push({ sev: 'error', line: ix.line, msg: t('인덱스 ' + ix.name + ' 의 테이블 ' + ix.table + ' 이(가) 정의되지 않았습니다', 'Index ' + ix.name + ' is on undefined table ' + ix.table) }); else { tables[ix.table].indexes.push({ name: ix.name, cols: ix.cols, unique: ix.unique }); ix.cols.forEach(function (c) { if (!tables[ix.table].cols.some(function (x) { return x.name.toLowerCase() === c.toLowerCase(); })) issues.push({ sev: 'error', line: ix.line, msg: t('인덱스 ' + ix.name + ' 의 컬럼 ' + c + ' 이(가) ' + ix.table + ' 에 없습니다', 'Index ' + ix.name + ' column ' + c + ' does not exist in ' + ix.table) }); }); } }
    });
    var NUM = /^(tiny|small|medium|big)?int(eger)?|^serial|^bigserial|^smallserial/i;
    function baseType(ty) { return ty.toLowerCase().replace(/\(.*\)/, '').replace(/\s+(unsigned|zerofill)/g, '').trim(); }
    var rows = [], relRows = [], mer = ['erDiagram'];
    torder.forEach(function (tn) {
      var tb = tables[tn];
      if (!tb.cols.length) issues.push({ sev: 'error', line: tb.line, msg: t('테이블 ' + tn + ' 에 컬럼이 없습니다', 'Table ' + tn + ' has no columns') });
      if (!tb.pk.length && o.hints) issues.push({ sev: 'warn', line: tb.line, msg: t('테이블 ' + tn + ' 에 기본 키(PRIMARY KEY)가 없습니다', 'Table ' + tn + ' has no PRIMARY KEY') });
      if (RESERVED.indexOf(tn.toLowerCase()) >= 0 && o.hints) issues.push({ sev: 'info', line: tb.line, msg: t('테이블 이름 ' + tn + ' 은(는) 예약어일 수 있어 따옴표 없이 쓰면 오류가 납니다', 'Table name ' + tn + ' may be a reserved word and fail unquoted') });
      tb.pk.forEach(function (p) { if (!tb.cols.some(function (c) { return c.name.toLowerCase() === p.toLowerCase(); })) issues.push({ sev: 'error', line: tb.line, msg: t(tn + ' 의 PRIMARY KEY 컬럼 ' + p + ' 이(가) 없습니다', 'PRIMARY KEY column ' + p + ' of ' + tn + ' does not exist') }); });
      tb.cols.forEach(function (c) {
        var keys = (c.pk ? 'PK' : '') + (tb.fks.some(function (f) { return f.cols.indexOf(c.name) >= 0; }) ? (c.pk ? ' ' : '') + 'FK' : '') + (c.unique || tb.uniques.some(function (u) { return u.length === 1 && u[0] === c.name; }) ? ((c.pk || tb.fks.length) ? ' ' : '') + 'UQ' : '');
        rows.push([tn, c.name, c.type, c.nullable ? 'NULL' : 'NOT NULL', keys || '—', ((c.auto ? 'AUTO' : '') + (c.auto && c.def ? ' ' : '') + (c.def ? 'DEFAULT ' + c.def : '')) || '—', c.comment || '']);
      });
      mer.push('  ' + tn + ' {'); tb.cols.forEach(function (c) { var k = (c.pk ? 'PK' : '') + (tb.fks.some(function (f) { return f.cols.indexOf(c.name) >= 0; }) ? (c.pk ? ',FK' : 'FK') : ''); mer.push('    ' + baseType(c.type).replace(/\s+/g, '_').replace(/[^\w]/g, '') + ' ' + c.name + (k ? ' ' + k : '')); }); mer.push('  }');
      tb.fks.forEach(function (fk) {
        var rt = tables[fk.ref];
        fk.cols.forEach(function (fc, ix) {
          var local = tb.cols.filter(function (c) { return c.name.toLowerCase() === fc.toLowerCase(); })[0], rcName = fk.refCols[ix] || (rt && rt.pk[ix]) || '?', remote = rt ? rt.cols.filter(function (c) { return c.name.toLowerCase() === rcName.toLowerCase(); })[0] : null;
          if (!local) issues.push({ sev: 'error', line: fk.line, msg: t('외래 키 컬럼 ' + tn + '.' + fc + ' 이(가) 없습니다', 'Foreign key column ' + tn + '.' + fc + ' does not exist') });
          if (!rt) issues.push({ sev: 'error', line: fk.line, msg: t(tn + '.' + fc + ' 이(가) 참조하는 테이블 ' + fk.ref + ' 이(가) 정의되지 않았습니다', tn + '.' + fc + ' references undefined table ' + fk.ref) });
          else if (!remote) issues.push({ sev: 'error', line: fk.line, msg: t(tn + '.' + fc + ' 이(가) 참조하는 컬럼 ' + fk.ref + '.' + rcName + ' 이(가) 없습니다', tn + '.' + fc + ' references missing column ' + fk.ref + '.' + rcName) });
          else {
            if (local && baseType(local.type) !== baseType(remote.type)) { var bothInt = NUM.test(baseType(local.type)) && NUM.test(baseType(remote.type)); issues.push({ sev: bothInt ? 'warn' : 'error', line: fk.line, msg: t(tn + '.' + fc + '(' + local.type + ') 와 ' + fk.ref + '.' + rcName + '(' + remote.type + ') 의 타입이 다릅니다' + (bothInt ? ' — 정수 크기가 다르면 비교가 느려지거나 일부 DB 에서 FK 생성이 실패합니다' : ''), tn + '.' + fc + ' (' + local.type + ') and ' + fk.ref + '.' + rcName + ' (' + remote.type + ') have different types' + (bothInt ? '; differing integer sizes slow joins or make FK creation fail in some databases' : '')) }); }
            var isKey = rt.pk.indexOf(remote.name) >= 0 || remote.unique || rt.uniques.some(function (u) { return u.length === 1 && u[0] === remote.name; }); if (!isKey && o.hints) issues.push({ sev: 'warn', line: fk.line, msg: t('참조 대상 ' + fk.ref + '.' + rcName + ' 은(는) PRIMARY KEY/UNIQUE 가 아닙니다 (대부분의 DB 에서 FK 대상이 될 수 없음)', 'Referenced ' + fk.ref + '.' + rcName + ' is not a PRIMARY KEY / UNIQUE (not allowed as an FK target in most databases)') });
          }
          var covered = tb.pk[0] === fc || tb.indexes.some(function (ix2) { return ix2.cols[0] === fc; }) || tb.uniques.some(function (u) { return u[0] === fc; }) || (local && local.unique); if (!covered && o.hints && ix === 0) issues.push({ sev: 'info', line: fk.line, msg: t('외래 키 ' + tn + '.' + fc + ' 에 인덱스가 없습니다. 조인·삭제 성능을 위해 인덱스를 추가하세요 (PostgreSQL 은 FK 에 인덱스를 자동 생성하지 않음)', 'The foreign key ' + tn + '.' + fc + ' has no index; add one for join and delete performance (PostgreSQL does not index FKs automatically)') });
          if (local && !local.nullable && /SET\s+NULL/.test(fk.onDelete)) issues.push({ sev: 'error', line: fk.line, msg: t(tn + '.' + fc + ' 은(는) NOT NULL 인데 ON DELETE SET NULL 입니다', tn + '.' + fc + ' is NOT NULL but uses ON DELETE SET NULL') });
          relRows.push([tn + '.' + fc, fk.ref + '.' + rcName, fk.onDelete || '—', fk.onUpdate || '—', fk.name || '—', local && !local.nullable ? t('필수 (1:N)', 'required (1:N)') : t('선택 (0..N)', 'optional (0..N)')]);
        });
        mer.push('  ' + fk.ref + ' ' + ((tb.cols.filter(function (c) { return fk.cols.indexOf(c.name) >= 0; }).every(function (c) { return !c.nullable; })) ? '||--o{' : '|o--o{') + ' ' + tn + ' : "' + fk.cols.join(',') + '"');
      });
      if (tb.indexes.length === 0 && o.hints && tb.fks.length === 0 && tb.cols.length > 8) issues.push({ sev: 'info', line: tb.line, msg: t('테이블 ' + tn + ' 의 컬럼이 ' + tb.cols.length + '개인데 보조 인덱스가 없습니다', 'Table ' + tn + ' has ' + tb.cols.length + ' columns and no secondary index') });
    });
    /* ERD SVG */
    var W = 220, ROW = 17, HEAD = 24, GAPX = 60, GAPY = 40, perRow = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(torder.length))));
    var pos = {}, x = 20, y = 20, rowH = 0, col0 = 0, maxX = 0, svgParts = [];
    function esc(s) { return TK.xml.escText(String(s)); }
    torder.forEach(function (tn, idx) { var tb = tables[tn], h = HEAD + tb.cols.length * ROW + 8; if (col0 === perRow) { col0 = 0; x = 20; y += rowH + GAPY; rowH = 0; } pos[tn] = { x: x, y: y, h: h }; rowH = Math.max(rowH, h); x += W + GAPX; col0++; maxX = Math.max(maxX, x); });
    var H = y + rowH + 20, linkSvg = '';
    torder.forEach(function (tn) { tables[tn].fks.forEach(function (fk) { var a = pos[tn], b = pos[fk.ref]; if (!a || !b) return; var ci = Math.max(0, tables[tn].cols.findIndex(function (c) { return c.name === fk.cols[0]; })), ay = a.y + HEAD + ci * ROW + ROW / 2, ax, bx; var by = b.y + HEAD + 8; if (a.x === b.x) { ax = a.x + W; bx = b.x + W; linkSvg += '<path d="M' + ax + ' ' + ay + ' C' + (ax + 40) + ' ' + ay + ' ' + (bx + 40) + ' ' + by + ' ' + bx + ' ' + by + '" fill="none" stroke="#6366f1" stroke-width="1.4"/>'; } else { var right = a.x < b.x; ax = right ? a.x + W : a.x; bx = right ? b.x : b.x + W; linkSvg += '<path d="M' + ax + ' ' + ay + ' C' + (ax + (right ? 40 : -40)) + ' ' + ay + ' ' + (bx + (right ? -40 : 40)) + ' ' + by + ' ' + bx + ' ' + by + '" fill="none" stroke="#6366f1" stroke-width="1.4"/><circle cx="' + bx + '" cy="' + by + '" r="3" fill="#6366f1"/>'; } }); });
    torder.forEach(function (tn) { var tb = tables[tn], p = pos[tn]; svgParts.push('<g><rect x="' + p.x + '" y="' + p.y + '" width="' + W + '" height="' + p.h + '" rx="6" fill="#fff" stroke="#94a3b8"/><rect x="' + p.x + '" y="' + p.y + '" width="' + W + '" height="' + HEAD + '" rx="6" fill="#4f46e5"/><text x="' + (p.x + 10) + '" y="' + (p.y + 16) + '" fill="#fff" font-size="13" font-weight="700" font-family="sans-serif">' + esc(tn) + '</text>' + tb.cols.map(function (c, i) { var isFk = tb.fks.some(function (f) { return f.cols.indexOf(c.name) >= 0; }); return '<text x="' + (p.x + 10) + '" y="' + (p.y + HEAD + i * ROW + 13) + '" font-size="11" font-family="monospace" fill="' + (c.pk ? '#b45309' : isFk ? '#4338ca' : '#1e293b') + '">' + (c.pk ? '🔑 ' : isFk ? '🔗 ' : '   ') + esc(c.name) + '</text><text x="' + (p.x + W - 8) + '" y="' + (p.y + HEAD + i * ROW + 13) + '" font-size="10" font-family="monospace" text-anchor="end" fill="#64748b">' + esc(c.type.length > 16 ? c.type.slice(0, 15) + '…' : c.type) + '</text>'; }).join('') + '</g>'); });
    var svg = '<div style="overflow:auto;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc"><svg xmlns="http://www.w3.org/2000/svg" width="' + Math.max(maxX, 260) + '" height="' + H + '" viewBox="0 0 ' + Math.max(maxX, 260) + ' ' + H + '" role="img" aria-label="ERD">' + linkSvg + svgParts.join('') + '</svg></div>';
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' }, seenK = {};
    var shown = issues.filter(function (x) { return o.hints || x.sev !== 'info'; }).filter(function (x) { var k = x.line + x.msg; if (seenK[k]) return false; seenK[k] = 1; return true; }).sort(function (a, b) { return a.line - b.line; });
    var list = shown.map(function (x) { return ICON[x.sev] + ' ' + (x.line ? t('줄 ', 'Line ') + x.line + ': ' : '') + x.msg; });
    var errs = shown.filter(function (x) { return x.sev === 'error'; }).length, warns = shown.filter(function (x) { return x.sev === 'warn'; }).length;
    return { _status: { ok: errs ? false : true, msg: errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — 테이블 ' + torder.length + '개', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + torder.length + ' table(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — 테이블 ' + torder.length + '개, 관계 ' + relRows.length + '개', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + torder.length + ' table(s), ' + relRows.length + ' relationship(s)') }, erd: svg, table: { head: [['테이블', 'Table'], ['컬럼', 'Column'], ['타입', 'Type'], ['NULL', 'Null'], ['키', 'Key'], ['기본값', 'Default'], ['주석', 'Comment']], rows: rows }, rel: { head: [['컬럼', 'Column'], ['참조', 'References'], ['ON DELETE', 'ON DELETE'], ['ON UPDATE', 'ON UPDATE'], ['이름', 'Name'], ['관계', 'Cardinality']], rows: relRows }, mermaid: mer.join('\n'), issues: list };
  }
});
