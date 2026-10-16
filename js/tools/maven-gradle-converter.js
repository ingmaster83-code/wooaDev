TK.tool('maven-gradle-converter', {
  inputs: [{ id: 'in', label: ['Maven <dependency> 또는 Gradle 의존성 선언', 'Maven <dependency> blocks or Gradle dependency declarations'], rows: 14, sample: '<dependency>\n  <groupId>org.springframework.boot</groupId>\n  <artifactId>spring-boot-starter-web</artifactId>\n  <version>3.3.4</version>\n</dependency>\n<dependency>\n  <groupId>org.projectlombok</groupId>\n  <artifactId>lombok</artifactId>\n  <version>1.18.34</version>\n  <scope>provided</scope>\n</dependency>\n<dependency>\n  <groupId>org.junit.jupiter</groupId>\n  <artifactId>junit-jupiter</artifactId>\n  <version>5.10.3</version>\n  <scope>test</scope>\n</dependency>' }],
  options: [
    { id: 'to', type: 'select', label: ['변환 방향', 'Convert to'], choices: [['auto', ['자동 (입력 형식 반대로)', 'Auto (the opposite of the input)']], ['groovy', 'Gradle Groovy DSL'], ['kotlin', 'Gradle Kotlin DSL'], ['maven', 'Maven XML'], ['catalog', 'Gradle version catalog (libs.versions.toml)']], default: 'auto' }
  ],
  outputs: [{ id: 'out', label: ['변환 결과', 'Converted'], kind: 'code', ext: 'txt' }, { id: 'table', label: ['의존성', 'Dependencies'], kind: 'table' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var src = String(v.in), deps = [], issues = [];
    var M2G = { compile: 'implementation', '': 'implementation', provided: 'compileOnly', runtime: 'runtimeOnly', test: 'testImplementation', system: 'compileOnly', import: 'platform' };
    var G2M = { implementation: 'compile', api: 'compile', compile: 'compile', compileOnly: 'provided', runtimeOnly: 'runtime', runtime: 'runtime', testImplementation: 'test', testCompile: 'test', testRuntimeOnly: 'test', testCompileOnly: 'test', annotationProcessor: 'provided', kapt: 'provided', ksp: 'provided', developmentOnly: 'runtime' };
    var isXml = /<dependency>/.test(src);
    if (isXml) {
      var re = /<dependency>([\s\S]*?)<\/dependency>/g, m;
      while ((m = re.exec(src))) {
        var b = m[1], g = function (tag) { var x = new RegExp('<' + tag + '>\\s*([^<]*?)\\s*</' + tag + '>').exec(b); return x ? x[1] : ''; };
        var d = { g: g('groupId'), a: g('artifactId'), v: g('version'), scope: g('scope'), type: g('type'), classifier: g('classifier'), optional: g('optional') === 'true', excl: (b.match(/<exclusion>/g) || []).length };
        if (!d.g || !d.a) { issues.push(t('🚨 groupId 또는 artifactId 가 없는 항목이 있습니다', '🚨 A dependency lacks groupId or artifactId')); continue; }
        deps.push(d);
      }
    } else {
      src.split('\n').forEach(function (ln) {
        var s = ln.trim().replace(/\/\/.*$/, '').trim(); if (!s) return;
        var m = /^(\w+)\s*\(?\s*(platform\()?["']([^:"']+):([^:"']+)(?::([^:"'@]+))?(?::([^:"'@]+))?(?:@(\w+))?["']\)?\)?/.exec(s);
        if (m) { var cfg = m[1]; deps.push({ g: m[3], a: m[4], v: m[5] || '', scope: m[2] ? 'import' : (G2M[cfg] || ''), cfg: cfg, classifier: m[6] || '', type: m[7] || '' }); if (!G2M[cfg] && !m[2]) issues.push(t('알 수 없는 구성 "' + cfg + '" 는 compile 로 취급했습니다', 'Unknown configuration "' + cfg + '" treated as compile')); return; }
        var m2 = /^(\w+)\s*\(?\s*group\s*[:=]\s*["']([^"']+)["']\s*,\s*name\s*[:=]\s*["']([^"']+)["'](?:\s*,\s*version\s*[:=]\s*["']([^"']+)["'])?/.exec(s);
        if (m2) { deps.push({ g: m2[2], a: m2[3], v: m2[4] || '', scope: G2M[m2[1]] || '', cfg: m2[1], classifier: '', type: '' }); return; }
        if (/^(dependencies|\{|\})/.test(s)) return;
        issues.push(t('해석하지 못한 줄: ' + s.slice(0, 50), 'Could not parse: ' + s.slice(0, 50)));
      });
    }
    if (!deps.length) throw new Error(t('의존성을 찾지 못했습니다 (Maven <dependency> 또는 implementation \'g:a:v\')', 'No dependencies found (Maven <dependency> or implementation \'g:a:v\')'));
    var to = o.to === 'auto' ? (isXml ? 'groovy' : 'maven') : o.to, out;
    function cfgOf(d) { if (isXml) return M2G[d.scope] || 'implementation'; return d.cfg || 'implementation'; }
    function ver(d) { if (/^\$\{.*\}$/.test(d.v)) { issues.push(t('버전 속성 ' + d.v + ' 는 Gradle 변수/카탈로그로 직접 옮겨야 합니다 (' + d.a + ')', 'The version property ' + d.v + ' must be moved to a Gradle variable / catalog (' + d.a + ')')); } return d.v; }
    if (to === 'maven') {
      out = deps.map(function (d) { return '<dependency>\n  <groupId>' + d.g + '</groupId>\n  <artifactId>' + d.a + '</artifactId>' + (d.v ? '\n  <version>' + d.v + '</version>' : '') + (d.classifier ? '\n  <classifier>' + d.classifier + '</classifier>' : '') + (d.type && d.type !== 'jar' ? '\n  <type>' + d.type + '</type>' : '') + (d.scope && d.scope !== 'compile' ? '\n  <scope>' + (d.scope === 'import' ? 'import' : d.scope) + '</scope>' : '') + (d.scope === 'import' ? '\n  <type>pom</type>' : '') + '\n</dependency>'; }).join('\n');
      if (deps.some(function (d) { return !d.v; })) issues.push(t('버전이 없는 항목은 BOM(dependencyManagement)에서 관리되어야 합니다', 'Entries without a version must be managed by a BOM (dependencyManagement)'));
      issues.push(t('Gradle 의 api / implementation 구분은 Maven 에 없어 모두 compile 로 변환됩니다 (java-library 의 api 는 의미가 사라짐)', 'Gradle\'s api / implementation split does not exist in Maven; both become compile'));
    } else if (to === 'catalog') {
      var vs = [], libs = [];
      deps.forEach(function (d) { var key = d.a.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase(); if (d.v) { vs.push(key + ' = "' + d.v + '"'); libs.push(key + ' = { module = "' + d.g + ':' + d.a + '", version.ref = "' + key + '" }'); } else libs.push(key + ' = { module = "' + d.g + ':' + d.a + '" }'); });
      out = '[versions]\n' + vs.join('\n') + '\n\n[libraries]\n' + libs.join('\n') + '\n\n// build.gradle(.kts)\ndependencies {\n' + deps.map(function (d) { return '    ' + cfgOf(d) + '(libs.' + d.a.replace(/[^A-Za-z0-9]+/g, '.').toLowerCase() + ')'; }).join('\n') + '\n}';
      issues.push(t('카탈로그 별칭의 - 는 접근 시 . 로 바뀝니다 (spring-boot-starter-web → libs.spring.boot.starter.web)', 'Dashes in catalog aliases become dots on access (spring-boot-starter-web → libs.spring.boot.starter.web)'));
    } else {
      var kt = to === 'kotlin', q = kt ? '"' : "'";
      out = 'dependencies {\n' + deps.map(function (d) { var cfg = cfgOf(d), coord = d.g + ':' + d.a + (d.v ? ':' + ver(d) : '') + (d.classifier ? (d.v ? '' : ':') + ':' + d.classifier : '') + (d.type && d.type !== 'jar' ? '@' + d.type : ''); return '    ' + (cfg === 'platform' || d.scope === 'import' ? 'implementation(platform(' + q + coord + q + '))' : kt ? cfg + '(' + q + coord + q + ')' : cfg + ' ' + q + coord + q); }).join('\n') + '\n}';
      if (isXml && deps.some(function (d) { return d.excl; })) issues.push(t('<exclusions> 는 변환하지 않았습니다 — Gradle 에서는 exclude group: …, module: … 로 직접 추가하세요', '<exclusions> were not converted — add exclude group: …, module: … in Gradle'));
      if (isXml && deps.some(function (d) { return d.optional; })) issues.push(t('<optional> 은 Gradle 에 대응이 없습니다', '<optional> has no Gradle equivalent'));
      if (isXml) issues.push(t('범위 매핑: compile→implementation, provided→compileOnly, runtime→runtimeOnly, test→testImplementation, import→platform', 'Scope mapping: compile→implementation, provided→compileOnly, runtime→runtimeOnly, test→testImplementation, import→platform'));
    }
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: t('✅ 의존성 ' + deps.length + '개를 ' + ({ groovy: 'Gradle(Groovy)', kotlin: 'Gradle(Kotlin)', maven: 'Maven', catalog: '버전 카탈로그' }[to]) + ' 로 변환', '✅ Converted ' + deps.length + ' dependencies to ' + ({ groovy: 'Gradle (Groovy)', kotlin: 'Gradle (Kotlin)', maven: 'Maven', catalog: 'a version catalog' }[to])), out: out, table: { head: [['groupId', 'groupId'], ['artifactId', 'artifactId'], ['버전', 'Version'], ['범위/구성', 'Scope / configuration']], rows: deps.map(function (d) { return [d.g, d.a, d.v || '—', isXml ? (d.scope || 'compile') + ' → ' + (M2G[d.scope] || 'implementation') : (d.cfg || '') + ' → ' + (d.scope || 'compile')]; }) }, issues: uniq };
  }
});
