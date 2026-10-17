TK.tool('dockerfile-editor', {
  inputs: [{ id: 'in', label: ['Dockerfile', 'Dockerfile'], rows: 18, sample: '# syntax=docker/dockerfile:1\nFROM node:latest AS build\nWORKDIR /app\nCOPY . .\nRUN npm install && npm run build\nRUN apt-get update\nRUN apt-get install curl\n\nFROM nginx\nCOPY --from=build /app/dist /usr/share/nginx/html\nCOPY --from=builder /app/conf /etc/nginx\nENV API_TOKEN=abc123\nEXPOSE 80 99999\nCMD nginx -g "daemon off;"\n' }],
  sampleExpectError: true,
  options: [
    { id: 'strict', type: 'checkbox', label: ['모범 사례 권고(ℹ️)도 표시', 'Also show best-practice hints (ℹ️)'], default: true }
  ],
  outputs: [{ id: 'table', label: ['명령어 목록', 'Instructions'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }, { id: 'out', label: ['정리된 Dockerfile (줄 이음 합침·명령어 대문자)', 'Normalised Dockerfile (continuations joined, upper-case instructions)'], kind: 'code', ext: 'txt' }],
  run: function (v, o, t) {
    var src = String(v['in'] || '').replace(/\r\n?/g, '\n'); if (!src.trim()) throw new Error(t('Dockerfile 을 입력하세요', 'Enter a Dockerfile'));
    var lines = src.split('\n'), insts = [], issues = [], esc = '\\', i;
    var KNOWN = ['FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL'];
    /* 파서 지시문 */
    for (i = 0; i < lines.length; i++) { var dm = /^#\s*(syntax|escape|check)\s*=\s*(.+)$/i.exec(lines[i].trim()); if (dm) { if (dm[1].toLowerCase() === 'escape' && /^[`\\]$/.test(dm[2].trim())) esc = dm[2].trim(); } else if (lines[i].trim() && !/^#/.test(lines[i].trim())) break; }
    /* 줄 이음 · 주석 · here-doc 처리 */
    for (i = 0; i < lines.length; i++) {
      var raw = lines[i], tr = raw.trim();
      if (!tr || tr.charAt(0) === '#') continue;
      var startLine = i + 1, text = raw.replace(/\s+$/, '');
      while (text.slice(-1) === esc && i + 1 < lines.length) {
        text = text.slice(0, -1).replace(/\s+$/, '');
        i++;
        var nx = lines[i];
        while (i < lines.length && (/^\s*#/.test(nx) || !nx.trim())) { i++; nx = lines[i]; if (nx === undefined) break; }
        if (nx === undefined) break;
        text += ' ' + nx.replace(/^\s+/, '').replace(/\s+$/, '');
      }
      var m = /^(\S+)\s*(.*)$/.exec(text.trim()); if (!m) continue;
      var inst = m[1], args = m[2];
      /* here-doc (RUN <<EOF …) : 종료 표지까지 본문으로 */
      var hd = /<<-?\s*["']?([A-Za-z_][A-Za-z0-9_]*)["']?/.exec(args);
      if (hd && /^(RUN|COPY|ADD)$/i.test(inst)) { var j = i + 1; while (j < lines.length && lines[j].trim() !== hd[1]) j++; i = Math.min(j, lines.length - 1); }
      insts.push({ line: startLine, name: inst.toUpperCase(), rawName: inst, args: args.trim() });
    }
    if (!insts.length) throw new Error(t('명령어를 찾지 못했습니다', 'No instructions found'));
    function add(sev, line, msg) { issues.push({ sev: sev, line: line, msg: msg }); }
    var stages = [], stageNames = {}, cur = null, argsDefined = {}, hasFrom = false, counts = {};
    insts.forEach(function (it) {
      var nm = it.name, a = it.args, ln = it.line;
      if (KNOWN.indexOf(nm) < 0) { add('error', ln, t('알 수 없는 명령어 "' + it.rawName + '"', 'Unknown instruction "' + it.rawName + '"')); return; }
      if (it.rawName !== nm && o.strict) add('info', ln, t('명령어 ' + it.rawName + ' 는 대문자(' + nm + ')로 쓰는 것이 관례입니다', 'Write the instruction ' + it.rawName + ' in upper case (' + nm + ') by convention'));
      if (!hasFrom && nm !== 'FROM' && nm !== 'ARG') add('error', ln, t(nm + ' 앞에 FROM 이 있어야 합니다 (ARG 만 FROM 앞에 올 수 있음)', nm + ' must come after FROM (only ARG may precede it)'));
      if (nm === 'ARG') { var an = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(a); if (!an) add('error', ln, t('ARG 이름이 올바르지 않습니다', 'Invalid ARG name')); else argsDefined[an[1]] = true; }
      if (nm === 'FROM') {
        hasFrom = true;
        var fm = /^(?:--platform=\S+\s+)?(\S+)(?:\s+(?:AS|as)\s+(\S+))?$/.exec(a);
        if (!fm) { add('error', ln, t('FROM 형식이 올바르지 않습니다 (FROM [--platform=…] 이미지[:태그] [AS 이름])', 'Invalid FROM (FROM [--platform=…] image[:tag] [AS name])')); return; }
        var img = fm[1], sname = fm[2];
        cur = { name: sname || '', index: stages.length, line: ln, image: img, insts: [], user: null, hasCmd: false };
        if (sname) { if (stageNames[sname.toLowerCase()] != null) add('error', ln, t('스테이지 이름 "' + sname + '" 이 중복됩니다', 'Duplicate stage name "' + sname + '"')); stageNames[sname.toLowerCase()] = stages.length; if (/[A-Z]/.test(sname) && o.strict) add('info', ln, t('스테이지 이름은 소문자로 쓰는 것이 좋습니다', 'Stage names are best lower case')); }
        stages.push(cur);
        var vars = img.match(/\$\{?([A-Za-z_][A-Za-z0-9_]*)/g) || [];
        vars.forEach(function (vv) { var n2 = vv.replace(/[${]/g, ''); if (!argsDefined[n2]) add('warn', ln, t('FROM 에서 쓰는 $' + n2 + ' 가 FROM 앞의 ARG 로 정의되지 않았습니다', '$' + n2 + ' used in FROM is not defined by an ARG before FROM')); });
        var lower = img.toLowerCase();
        if (lower !== 'scratch' && stageNames[lower] == null && img.indexOf('$') < 0) {
          var lastSeg = img.split('/').pop();
          if (/@sha256:/.test(img)) { /* 고정됨 */ }
          else if (lastSeg.indexOf(':') < 0) add('warn', ln, t('이미지 "' + img + '" 에 태그가 없어 latest 가 쓰입니다. 버전을 고정하세요', 'Image "' + img + '" has no tag, so latest is used; pin a version'));
          else if (/:latest$/.test(lastSeg)) add('warn', ln, t('이미지 "' + img + '" 는 latest 태그라 빌드가 재현되지 않습니다. 버전을 고정하세요', 'Image "' + img + '" uses latest, so builds are not reproducible; pin a version'));
        }
        return;
      }
      if (cur) cur.insts.push(it);
      counts[nm] = (counts[nm] || 0) + 1;
      switch (nm) {
        case 'RUN': case 'CMD': case 'ENTRYPOINT': case 'SHELL': case 'HEALTHCHECK': break;
      }
      if (nm === 'MAINTAINER') add('warn', ln, t('MAINTAINER 는 폐기되었습니다. LABEL org.opencontainers.image.authors 를 쓰세요', 'MAINTAINER is deprecated; use LABEL org.opencontainers.image.authors'));
      if (nm === 'EXPOSE') a.split(/\s+/).filter(Boolean).forEach(function (pt) { var pm = /^(\d+)(?:-(\d+))?(?:\/(tcp|udp|sctp))?$/i.exec(pt); if (!pm && pt.indexOf('$') < 0) add('error', ln, t('EXPOSE 포트 "' + pt + '" 형식이 올바르지 않습니다 (예: 80, 8080/tcp)', 'Invalid EXPOSE port "' + pt + '" (e.g. 80, 8080/tcp)')); else if (pm && (+pm[1] < 1 || +pm[1] > 65535 || (pm[2] && +pm[2] > 65535))) add('error', ln, t('EXPOSE 포트 ' + pt + ' 가 1~65535 범위를 벗어납니다', 'EXPOSE port ' + pt + ' is outside 1–65535')); });
      if (nm === 'ENV' || nm === 'LABEL' || nm === 'ARG') {
        var secret = /(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIAL)/i;
        var pairs = a.match(/([A-Za-z_][A-Za-z0-9_.-]*)=("[^"]*"|'[^']*'|\S*)/g) || [];
        if (nm !== 'ARG' && !pairs.length && !/^\S+\s+\S+/.test(a)) add('error', ln, t(nm + ' 는 키=값 형식이어야 합니다', nm + ' needs key=value'));
        var keys = pairs.map(function (p) { return p.split('=')[0]; }); if (!pairs.length && /^\S+\s+/.test(a)) keys = [a.split(/\s+/)[0]];
        if (nm === 'ARG' && !pairs.length) keys = [a.split(/\s+/)[0]];
        keys.forEach(function (k) {
          if (secret.test(k) && nm !== 'LABEL') add('warn', ln, t(nm + ' 의 ' + k + ' 에 비밀 값을 넣으면 이미지 레이어와 history 에 남습니다. 빌드 시크릿(--mount=type=secret)이나 런타임 환경 변수를 쓰세요', 'A secret in ' + nm + ' ' + k + ' stays in image layers and history; use build secrets (--mount=type=secret) or runtime env'));
        });
      }
      if (nm === 'COPY' || nm === 'ADD') {
        var fromM = /--from=(\S+)/.exec(a);
        if (fromM) { var ref = fromM[1]; if (nm === 'ADD') add('error', ln, t('ADD 는 --from 을 지원하지 않습니다. COPY 를 쓰세요', 'ADD does not support --from; use COPY')); else if (/^\d+$/.test(ref)) { if (+ref >= stages.length - 1) add('error', ln, t('--from=' + ref + ' 는 현재 스테이지 이전의 스테이지여야 합니다', '--from=' + ref + ' must refer to an earlier stage')); } else if (stageNames[ref.toLowerCase()] == null && !/[:\/.]/.test(ref)) add('error', ln, t('--from=' + ref + ' 에 해당하는 스테이지가 없습니다 (이전에 FROM … AS ' + ref + ' 가 필요)', '--from=' + ref + ' matches no earlier stage (needs FROM … AS ' + ref + ')')); }
        var body = a.replace(/--\S+\s*/g, '').trim();
        var parts = body.charAt(0) === '[' ? null : body.split(/\s+/).filter(Boolean);
        if (parts && parts.length < 2) add('error', ln, t(nm + ' 는 원본과 대상 두 인자가 필요합니다', nm + ' needs a source and a destination'));
        if (nm === 'ADD' && parts && o.strict && !/^https?:\/\//.test(parts[0]) && !/\.(tar|tgz|tar\.gz|tar\.xz|tar\.bz2)$/.test(parts[0]) && !/--checksum|--keep-git-dir|--link/.test(a)) add('info', ln, t('단순 파일 복사에는 ADD 대신 COPY 를 쓰세요 (ADD 는 URL·압축 해제 같은 부수 효과가 있음)', 'Use COPY instead of ADD for plain file copies (ADD has side effects like URLs and auto-extract)'));
        if (nm === 'ADD' && parts && /^https?:\/\//.test(parts[0]) && o.strict) add('info', ln, t('원격 URL 은 ADD 대신 curl/wget 으로 받아 검증하거나 --checksum 을 쓰세요', 'Fetch remote URLs with curl / wget and verify them, or use ADD --checksum'));
        if (nm === 'COPY' && /^\.(\s|$)/.test(body) && o.strict) { var nextFrom = 1e9; insts.forEach(function (x) { if (x.name === 'FROM' && x.line > ln && x.line < nextFrom) nextFrom = x.line; }); var later = insts.some(function (x) { return x.name === 'RUN' && x.line > ln && x.line < nextFrom && /(npm (ci|install)|pip3? install|yarn|bundle install|go mod download|composer install)/.test(x.args); }); if (later) add('info', ln, t('COPY . . 뒤에 의존성 설치가 있어 소스가 바뀔 때마다 캐시가 깨집니다. 의존성 파일(package.json 등)만 먼저 복사해 설치하세요', 'COPY . . before installing dependencies busts the cache on every source change; copy only dependency manifests (package.json …) and install first')); }
      }
      if (nm === 'RUN') {
        var rn = a;
        if (/apt-get\s+update\s*$/.test(rn.replace(/\s*&&.*$/, '')) && !/apt-get\s+install/.test(rn)) add('warn', ln, t('apt-get update 를 별도 RUN 에 두면 캐시된 오래된 목록으로 설치할 수 있습니다. 같은 RUN 에서 && apt-get install 로 이으세요', 'A separate RUN apt-get update can leave a stale cached list; chain it with && apt-get install in the same RUN'));
        if (/apt-get\s+install/.test(rn)) {
          if (!/(-y|--yes|-qq|--assume-yes)/.test(rn)) add('error', ln, t('apt-get install 에 -y 가 없어 빌드가 입력을 기다리며 실패합니다', 'apt-get install without -y waits for input and fails the build'));
          if (!/--no-install-recommends/.test(rn) && o.strict) add('info', ln, t('--no-install-recommends 로 불필요한 패키지를 줄이세요', 'Use --no-install-recommends to avoid extra packages'));
          if (!/rm\s+-rf\s+\/var\/lib\/apt\/lists/.test(rn) && !/--mount=type=cache/.test(rn) && o.strict) add('info', ln, t('같은 RUN 끝에 rm -rf /var/lib/apt/lists/* 로 캐시를 지워 이미지를 줄이세요', 'End the same RUN with rm -rf /var/lib/apt/lists/* to shrink the image'));
          if (!/apt-get\s+update/.test(rn) && cur && !cur.insts.some(function (x) { return x.name === 'RUN' && /apt-get\s+update/.test(x.args) && x.line < ln; })) add('warn', ln, t('apt-get update 없이 install 하면 패키지를 찾지 못할 수 있습니다', 'apt-get install without apt-get update may fail to find packages'));
        }
        if (/\bapk\s+add\b/.test(rn) && !/--no-cache/.test(rn) && o.strict) add('info', ln, t('apk add 에 --no-cache 를 쓰면 캐시 정리가 필요 없습니다', 'apk add --no-cache avoids cache cleanup'));
        if (/\bpip3?\s+install\b/.test(rn) && !/--no-cache-dir/.test(rn) && !/--mount=type=cache/.test(rn) && o.strict) add('info', ln, t('pip install 에 --no-cache-dir 로 이미지 크기를 줄이세요', 'Use pip install --no-cache-dir to keep the image small'));
        if (/\bnpm\s+install\b/.test(rn) && o.strict) add('info', ln, t('재현 가능한 빌드에는 npm install 대신 npm ci 를 쓰세요', 'Use npm ci instead of npm install for reproducible builds'));
        if (/(curl|wget)[^|]*\|\s*(sudo\s+)?(ba)?sh/.test(rn)) add('warn', ln, t('curl | sh 는 검증 없이 원격 스크립트를 실행합니다. 받아서 체크섬을 확인한 뒤 실행하세요', 'curl | sh runs a remote script unverified; download it and verify a checksum first'));
        if (/\bsudo\b/.test(rn)) add('warn', ln, t('컨테이너 빌드에서 sudo 는 필요하지 않습니다. USER 로 권한을 조절하세요', 'sudo is unnecessary in a container build; manage privileges with USER'));
        if (/^cd\s|&&\s*cd\s|;\s*cd\s/.test(rn) && o.strict) add('info', ln, t('RUN 안의 cd 대신 WORKDIR 를 쓰세요', 'Use WORKDIR instead of cd inside RUN'));
        if (/chmod\s+(-R\s+)?(0?777|a\+rwx)/.test(rn)) add('warn', ln, t('chmod 777 은 모든 사용자에게 쓰기 권한을 줍니다', 'chmod 777 gives everyone write access'));
        if (/\b(ssh-keygen|openssl\s+genrsa)\b/.test(rn)) add('info', ln, t('이미지 안에서 키를 만들면 모든 컨테이너가 같은 키를 갖게 됩니다', 'Generating keys in the image gives every container the same key'));
      }
      if (nm === 'WORKDIR' && a && a.charAt(0) !== '/' && a.charAt(0) !== '$' && !/^[A-Za-z]:/.test(a)) add('warn', ln, t('WORKDIR "' + a + '" 는 상대 경로입니다. 절대 경로를 쓰세요', 'WORKDIR "' + a + '" is relative; use an absolute path'));
      if (nm === 'USER' && cur) cur.user = a.split(/[:\s]/)[0];
      if ((nm === 'CMD' || nm === 'ENTRYPOINT' || nm === 'RUN' || nm === 'SHELL') && cur) {
        if (a.charAt(0) === '[') { try { var arr = JSON.parse(a); if (!Array.isArray(arr) || arr.some(function (x) { return typeof x !== 'string'; })) throw 0; } catch (e) { add('error', ln, t(nm + ' 의 exec 형식(JSON 배열)이 올바르지 않습니다. 큰따옴표를 쓰세요', nm + ' exec form (JSON array) is invalid; use double quotes')); } }
        else if ((nm === 'CMD' || nm === 'ENTRYPOINT') && o.strict) add('info', ln, t(nm + ' 의 shell 형식은 PID 1 이 sh 가 되어 SIGTERM 이 전달되지 않습니다. exec 형식 ["실행파일", "인자"] 를 쓰세요', nm + ' shell form makes sh PID 1 and SIGTERM is not forwarded; use exec form ["bin", "arg"]'));
        if (nm === 'CMD' || nm === 'ENTRYPOINT') cur.hasCmd = true;
      }
      if (nm === 'HEALTHCHECK' && !/^(NONE|--\S+\s+)*(CMD|NONE)\b/i.test(a)) add('error', ln, t('HEALTHCHECK 는 CMD 또는 NONE 이 필요합니다', 'HEALTHCHECK needs CMD or NONE'));
      if (nm === 'VOLUME' && !a) add('error', ln, t('VOLUME 에 경로가 없습니다', 'VOLUME has no path'));
    });
    if (!hasFrom) add('error', 1, t('FROM 명령어가 없습니다', 'There is no FROM instruction'));
    ['CMD', 'ENTRYPOINT', 'HEALTHCHECK'].forEach(function (k) {
      stages.forEach(function (st) { var list = st.insts.filter(function (x) { return x.name === k; }); if (list.length > 1) add('warn', list[list.length - 1].line, t('스테이지 ' + (st.name || st.index + 1) + ' 에 ' + k + ' 가 ' + list.length + '번 있습니다. 마지막 것만 적용됩니다', k + ' appears ' + list.length + ' times in stage ' + (st.name || st.index + 1) + '; only the last applies')); });
    });
    var last = stages[stages.length - 1];
    if (last && o.strict) {
      if (!last.user || /^(root|0)$/.test(last.user)) add('warn', last.line, t('마지막 스테이지가 root 로 실행됩니다. USER 로 비특권 사용자를 지정하세요', 'The final stage runs as root; set a non-root USER'));
      if (!last.insts.some(function (x) { return x.name === 'HEALTHCHECK'; })) add('info', last.line, t('HEALTHCHECK 가 없습니다. 오케스트레이터가 상태를 알 수 있도록 추가를 고려하세요', 'No HEALTHCHECK; consider adding one so orchestrators can see health'));
      if (!last.hasCmd) add('info', last.line, t('마지막 스테이지에 CMD/ENTRYPOINT 가 없어 베이스 이미지의 기본 명령이 쓰입니다', 'No CMD / ENTRYPOINT in the final stage; the base image default is used'));
    }
    stages.forEach(function (st) { var lowerImg = st.image.toLowerCase(); if (stageNames[lowerImg] != null && stageNames[lowerImg] >= st.index) add('error', st.line, t('FROM ' + st.image + ' 는 아직 정의되지 않은 스테이지를 참조합니다', 'FROM ' + st.image + ' refers to a stage not defined yet')); });
    var unusedStages = stages.filter(function (st, idx) { if (!st.name || idx === stages.length - 1) return false; var nm2 = st.name.toLowerCase(); return !stages.some(function (o2) { return o2.image.toLowerCase() === nm2 || o2.insts.some(function (x) { return (x.name === 'COPY') && new RegExp('--from=' + st.name + '(\\s|$)', 'i').test(x.args); }); }) && !insts.some(function (x) { return x.name === 'COPY' && new RegExp('--from=' + idx + '(\\s|$)').test(x.args); }); });
    unusedStages.forEach(function (st) { add('info', st.line, t('스테이지 "' + st.name + '" 를 다른 스테이지가 사용하지 않습니다', 'Stage "' + st.name + '" is not used by any other stage')); });
    if (stages.length === 1 && o.strict && insts.filter(function (x) { return x.name === 'RUN'; }).length > 6) add('info', 1, t('RUN 이 많습니다. 멀티스테이지 빌드와 RUN 합치기로 레이어를 줄일 수 있습니다', 'Many RUN layers; multi-stage builds and merging RUNs can reduce layers'));
    var shown = issues.filter(function (x) { return o.strict || x.sev !== 'info'; }).sort(function (x, y) { return x.line - y.line; });
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
    var list = shown.map(function (x) { return ICON[x.sev] + ' ' + t('줄 ', 'Line ') + x.line + ': ' + x.msg; });
    var errs = issues.filter(function (x) { return x.sev === 'error'; }).length, warns = issues.filter(function (x) { return x.sev === 'warn'; }).length;
    var rows = insts.map(function (it) { return [String(it.line), it.name, it.args.length > 90 ? it.args.slice(0, 90) + '…' : it.args]; });
    var outTxt = insts.map(function (it) { return (it.name === 'FROM' ? '\n' : '') + it.name + (it.args ? ' ' + it.args : ''); }).join('\n').replace(/^\n/, '');
    var msg = errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — 스테이지 ' + stages.length + '개, 명령어 ' + insts.length + '개', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + stages.length + ' stage(s), ' + insts.length + ' instruction(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — 스테이지 ' + stages.length + '개, 명령어 ' + insts.length + '개', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + stages.length + ' stage(s), ' + insts.length + ' instruction(s)');
    return { _status: { ok: errs ? false : true, msg: msg }, table: { head: [['줄', 'Line'], ['명령어', 'Instruction'], ['인자', 'Arguments']], rows: rows }, issues: list, out: outTxt };
  }
});
