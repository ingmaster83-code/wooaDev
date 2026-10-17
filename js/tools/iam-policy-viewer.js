TK.tool('iam-policy-viewer', {
  sampleExpectError: true,
  inputs: [
    { id: 'in', label: ['IAM 정책 (JSON)', 'IAM policy (JSON)'], rows: 22, sample: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        { Sid: 'ReadBucket', Effect: 'Allow', Action: ['s3:GetObject', 's3:ListBucket'], Resource: 'arn:aws:s3:::my-bucket' },
        { Sid: 'Wide', Effect: 'Allow', Action: ['ec2:*', 'iam:PassRole'], Resource: '*' },
        { Sid: 'Wide', Effect: 'Allow', NotAction: 'iam:*', Resource: '*' },
        { Sid: 'Deny', Effect: 'Deny', Action: 's3:DeleteObject', Resource: 'arn:aws:s3:::my-bucket/*', Condition: { Bool: { 'aws:SecureTransport': 'false' } } },
        { Effect: 'Allow', Action: 'sts:AssumeRole', Resource: '*', Principal: '*' }
      ]
    }, null, 2) },
    { id: 'test', type: 'text', label: ['접근 시뮬레이션 (선택): 작업 [리소스]  예) s3:GetObject arn:aws:s3:::my-bucket/a.txt', 'Access simulation (optional): action [resource]  e.g. s3:GetObject arn:aws:s3:::my-bucket/a.txt'], sample: 's3:GetObject arn:aws:s3:::my-bucket/a.txt' }
  ],
  options: [{ id: 'hints', type: 'checkbox', label: ['권고(ℹ️)도 표시', 'Also show hints (ℹ️)'], default: true }],
  outputs: [{ id: 'table', label: ['문장(Statement) 해석', 'Statements'], kind: 'table' }, { id: 'sim', label: ['시뮬레이션 결과', 'Simulation'], kind: 'table' }, { id: 'issues', label: ['점검 결과', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [], src = String(v['in'] || '').trim(); if (!src) throw new Error(t('정책 JSON 을 입력하세요', 'Enter the policy JSON'));
    var pol; try { pol = JSON.parse(src); } catch (e) { throw new Error(t('JSON 구문 오류: ', 'JSON syntax error: ') + e.message); }
    if (!pol || typeof pol !== 'object' || Array.isArray(pol)) throw new Error(t('정책은 JSON 객체여야 합니다', 'A policy must be a JSON object'));
    function add(sev, msg) { issues.push({ sev: sev, msg: msg }); }
    var arr = function (x) { return x === undefined ? [] : Array.isArray(x) ? x : [x]; };
    if (pol.Version !== '2012-10-17' && pol.Version !== '2008-10-17') add(pol.Version === undefined ? 'warn' : 'error', t('Version 이 ' + (pol.Version === undefined ? '없습니다' : '"' + pol.Version + '" 입니다') + '. "2012-10-17" 을 쓰세요 (없으면 정책 변수 ${aws:username} 이 동작하지 않음)', 'Version is ' + (pol.Version === undefined ? 'missing' : '"' + pol.Version + '"') + '; use "2012-10-17" (policy variables like ${aws:username} do not work without it)'));
    else if (pol.Version === '2008-10-17') add('warn', t('Version 2008-10-17 은 오래된 버전입니다. 2012-10-17 을 쓰세요', 'Version 2008-10-17 is old; use 2012-10-17'));
    var stmts = arr(pol.Statement); if (!stmts.length) throw new Error(t('Statement 가 없습니다', 'There is no Statement'));
    Object.keys(pol).forEach(function (k) { if (['Version', 'Statement', 'Id'].indexOf(k) < 0) add('error', t('최상위 키 "' + k + '" 는 정책에 없습니다', 'Unknown top-level key "' + k + '"')); });
    var SENS = ['iam:CreateAccessKey', 'iam:CreateLoginProfile', 'iam:UpdateLoginProfile', 'iam:AttachUserPolicy', 'iam:AttachRolePolicy', 'iam:AttachGroupPolicy', 'iam:PutUserPolicy', 'iam:PutRolePolicy', 'iam:PutGroupPolicy', 'iam:CreatePolicyVersion', 'iam:SetDefaultPolicyVersion', 'iam:AddUserToGroup', 'iam:UpdateAssumeRolePolicy', 'iam:PassRole', 'sts:AssumeRole', 'lambda:UpdateFunctionCode', 'ec2:RunInstances', 'cloudformation:CreateStack'];
    var rows = [], seenSid = {}, size = src.replace(/\s+/g, '').length, parsed = [];
    var KEYS = ['Sid', 'Effect', 'Principal', 'NotPrincipal', 'Action', 'NotAction', 'Resource', 'NotResource', 'Condition'];
    var OPS = /^(StringEquals|StringNotEquals|StringEqualsIgnoreCase|StringNotEqualsIgnoreCase|StringLike|StringNotLike|NumericEquals|NumericNotEquals|NumericLessThan|NumericLessThanEquals|NumericGreaterThan|NumericGreaterThanEquals|DateEquals|DateNotEquals|DateLessThan|DateLessThanEquals|DateGreaterThan|DateGreaterThanEquals|Bool|BinaryEquals|IpAddress|NotIpAddress|ArnEquals|ArnLike|ArnNotEquals|ArnNotLike|Null)(IfExists)?$/;
    stmts.forEach(function (s, i) {
      var tag = '#' + (i + 1) + (s && s.Sid ? ' (' + s.Sid + ')' : '');
      if (!s || typeof s !== 'object') { add('error', tag + ': ' + t('문장이 객체가 아닙니다', 'The statement is not an object')); return; }
      Object.keys(s).forEach(function (k) { if (KEYS.indexOf(k) < 0) add('error', tag + ': ' + t('알 수 없는 키 "' + k + '"', 'Unknown key "' + k + '"')); });
      if (s.Effect !== 'Allow' && s.Effect !== 'Deny') add('error', tag + ': ' + t('Effect 는 Allow 또는 Deny 여야 합니다 (현재 ' + JSON.stringify(s.Effect) + ')', 'Effect must be Allow or Deny (found ' + JSON.stringify(s.Effect) + ')'));
      if (s.Sid) { if (!/^[A-Za-z0-9]+$/.test(s.Sid)) add('error', tag + ': ' + t('Sid 는 영문자와 숫자만 쓸 수 있습니다', 'Sid may contain only letters and digits')); if (seenSid[s.Sid]) add('error', tag + ': ' + t('Sid "' + s.Sid + '" 가 중복됩니다', 'Sid "' + s.Sid + '" is duplicated')); seenSid[s.Sid] = true; }
      if (s.Action === undefined && s.NotAction === undefined) add('error', tag + ': ' + t('Action 또는 NotAction 이 필요합니다', 'Action or NotAction is required')); if (s.Action !== undefined && s.NotAction !== undefined) add('error', tag + ': ' + t('Action 과 NotAction 을 함께 쓸 수 없습니다', 'Action and NotAction cannot be combined'));
      var hasPrincipal = s.Principal !== undefined || s.NotPrincipal !== undefined;
      if (!hasPrincipal && s.Resource === undefined && s.NotResource === undefined) add('error', tag + ': ' + t('아이덴티티 정책에는 Resource 또는 NotResource 가 필요합니다', 'An identity policy needs Resource or NotResource'));
      if (s.Resource !== undefined && s.NotResource !== undefined) add('error', tag + ': ' + t('Resource 와 NotResource 를 함께 쓸 수 없습니다', 'Resource and NotResource cannot be combined'));
      var acts = arr(s.Action !== undefined ? s.Action : s.NotAction), ress = arr(s.Resource !== undefined ? s.Resource : s.NotResource);
      acts.forEach(function (a) { if (typeof a !== 'string' || (a !== '*' && !/^[A-Za-z0-9-]+:[A-Za-z0-9*?]+$/.test(a))) add('error', tag + ': ' + t('작업 이름 ' + JSON.stringify(a) + ' 형식이 올바르지 않습니다 (서비스:작업)', 'Invalid action name ' + JSON.stringify(a) + ' (service:Action)')); });
      ress.forEach(function (r) { if (typeof r !== 'string' || (r !== '*' && !/^arn:(aws|aws-cn|aws-us-gov|aws-[a-z-]+|\*|\$\{[^}]+\}):[^:]*:[^:]*:[^:]*:.+$/.test(r))) add('error', tag + ': ' + t('리소스 ' + JSON.stringify(r) + ' 은 ARN(arn:aws:서비스:리전:계정:리소스) 형식이 아닙니다', 'Resource ' + JSON.stringify(r) + ' is not an ARN (arn:aws:service:region:account:resource)')); });
      if (s.Condition) Object.keys(s.Condition).forEach(function (op) { if (!OPS.test(op) && !/^(ForAllValues|ForAnyValue):/.test(op)) add('error', tag + ': ' + t('조건 연산자 "' + op + '" 를 알 수 없습니다', 'Unknown condition operator "' + op + '"')); else if (s.Condition[op] === null || typeof s.Condition[op] !== 'object' || Array.isArray(s.Condition[op])) add('error', tag + ': ' + t('조건 연산자 ' + op + ' 의 값은 {키: 값} 객체여야 합니다', 'Condition operator ' + op + ' needs a {key: value} object')); });
      var allow = s.Effect === 'Allow', star = function (x) { return x === '*'; };
      if (allow && s.Action !== undefined && acts.some(star) && ress.some(star) && s.Resource !== undefined) add('error', tag + ': ' + t('모든 작업(*)을 모든 리소스(*)에 허용합니다 — 사실상 관리자 권한입니다', 'Allows every action (*) on every resource (*), effectively admin'));
      else if (allow && s.Action !== undefined && acts.some(star)) add('warn', tag + ': ' + t('모든 작업(*)을 허용합니다. 필요한 작업만 나열하세요', 'Allows every action (*); list only what is needed'));
      if (allow && s.Action !== undefined && ress.some(star) && !acts.some(star) && o.hints) { var wide = acts.filter(function (a) { return /:\*$/.test(a); }); if (wide.length) add('warn', tag + ': ' + t('서비스 전체 작업(' + wide.join(', ') + ')을 모든 리소스(*)에 허용합니다', 'Allows whole-service actions (' + wide.join(', ') + ') on all resources (*)')); }
      if (allow && s.NotAction !== undefined) add('warn', tag + ': ' + t('Allow + NotAction 은 나열한 작업을 제외한 "모든 작업"을 허용합니다. 새 서비스가 생겨도 자동으로 허용되니 주의하세요', 'Allow with NotAction permits "everything except" the listed actions, including future services; be careful'));
      if (allow && s.NotResource !== undefined) add('warn', tag + ': ' + t('Allow + NotResource 는 나열한 리소스를 제외한 모든 리소스를 허용합니다', 'Allow with NotResource permits every resource except the listed ones'));
      if (allow && s.Principal !== undefined && (s.Principal === '*' || (s.Principal && s.Principal.AWS === '*')) && !s.Condition) add('error', tag + ': ' + t('Principal "*" 를 조건 없이 허용하면 모든 AWS 계정과 익명 사용자가 접근할 수 있습니다', 'Principal "*" without a condition lets every AWS account and anonymous users in'));
      if (hasPrincipal && o.hints && s.Resource === undefined && s.NotResource === undefined) { /* 신뢰/리소스 정책 */ }
      if (allow && o.hints && s.Action !== undefined) { var sens = acts.filter(function (a) { return SENS.some(function (x) { return x.toLowerCase() === a.toLowerCase(); }) || /^iam:\*$/i.test(a); }); if (sens.length && ress.some(star)) add('warn', tag + ': ' + t('권한 상승에 쓰일 수 있는 작업(' + sens.join(', ') + ')을 모든 리소스에 허용합니다 (iam:PassRole 은 특정 역할 ARN 으로 제한)', 'Allows privilege-escalation-capable actions (' + sens.join(', ') + ') on all resources (restrict iam:PassRole to specific role ARNs)')); }
      var s3obj = acts.some(function (a) { return /^s3:(Get|Put|Delete)Object/i.test(a); }), s3bucket = acts.some(function (a) { return /^s3:(ListBucket|GetBucket|PutBucket|DeleteBucket)/i.test(a); });
      if (s.Resource !== undefined && s3obj && ress.some(function (r) { return /^arn:aws[^:]*:s3:::[^/]+$/.test(r); }) && !ress.some(function (r) { return /\/|\*$/.test(r); })) add('warn', tag + ': ' + t('s3:*Object 작업의 리소스가 버킷 ARN 뿐입니다. 객체에는 arn:aws:s3:::버킷/* 가 필요합니다', 's3 object actions have only a bucket ARN; objects need arn:aws:s3:::bucket/*'));
      if (s.Resource !== undefined && s3bucket && ress.length && ress.every(function (r) { return /^arn:aws[^:]*:s3:::[^/]+\/.+/.test(r); })) add('warn', tag + ': ' + t('s3:ListBucket 등 버킷 작업의 리소스가 객체 ARN(/…) 뿐입니다. 버킷 ARN 이 필요합니다', 'Bucket actions such as s3:ListBucket have only object ARNs; they need the bucket ARN'));
      if (!s.Condition && s.Effect === 'Deny' && o.hints === false) { /* noop */ }
      var cond = s.Condition ? Object.keys(s.Condition).map(function (k) { return k + ' ' + JSON.stringify(s.Condition[k]); }).join('; ') : '';
      parsed.push({ s: s, tag: tag, acts: acts, ress: ress, notAct: s.NotAction !== undefined, notRes: s.NotResource !== undefined });
      rows.push([String(i + 1), s.Sid || '—', String(s.Effect), (s.NotAction !== undefined ? t('제외: ', 'not: ') : '') + acts.join(', '), (hasPrincipal ? 'P:' + JSON.stringify(s.Principal !== undefined ? s.Principal : s.NotPrincipal) + ' ' : '') + (s.NotResource !== undefined ? t('제외: ', 'not: ') : '') + ress.join(', '), cond || '—']);
    });
    var limits = [['관리형 정책', 6144, 'managed policy'], ['사용자 인라인', 2048, 'user inline'], ['역할 인라인', 10240, 'role inline']];
    if (size > 2048 && o.hints) add('info', t('공백을 뺀 정책 크기는 ' + size + '자입니다. 한도: 사용자 인라인 2,048 · 역할 인라인 10,240 · 관리형 6,144', 'Policy size without whitespace is ' + size + ' characters. Limits: user inline 2,048, role inline 10,240, managed 6,144')); if (size > 6144) add('error', t('공백을 뺀 크기 ' + size + '자가 관리형 정책 한도(6,144자)를 넘습니다', 'Size ' + size + ' without whitespace exceeds the managed policy limit (6,144 characters)'));
    /* 시뮬레이션 */
    var simRows = [], test = String(v.test || '').trim();
    function glob(pat, str, ci) { var re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', ci ? 'i' : ''); return re.test(str); }
    if (test) {
      var tp = test.split(/\s+/), tAct = tp[0], tRes = tp[1] || '*';
      if (!/^[A-Za-z0-9-]+:[A-Za-z0-9]+$/.test(tAct)) throw new Error(t('시뮬레이션 작업은 서비스:작업 형식이어야 합니다 (예: s3:GetObject)', 'The simulated action must be service:Action (e.g. s3:GetObject)'));
      var allowBy = [], denyBy = [];
      parsed.forEach(function (p) {
        if (p.s.Principal !== undefined || p.s.NotPrincipal !== undefined) return;
        var am = p.notAct ? !p.acts.some(function (a) { return glob(a, tAct, true); }) : p.acts.some(function (a) { return glob(a, tAct, true); });
        var rm = p.ress.length === 0 ? true : (p.notRes ? !p.ress.some(function (r) { return glob(r, tRes, false); }) : p.ress.some(function (r) { return glob(r, tRes, false); }));
        if (am && rm) (p.s.Effect === 'Deny' ? denyBy : allowBy).push(p);
      });
      var verdict = denyBy.length ? t('⛔ 명시적 거부 (Deny)', '⛔ Explicit deny') : allowBy.length ? t('✅ 허용', '✅ Allowed') : t('⛔ 암묵적 거부 (일치하는 Allow 없음)', '⛔ Implicit deny (no matching Allow)');
      simRows.push([tAct, tRes, verdict, denyBy.concat(allowBy).map(function (p) { return p.tag + ' ' + p.s.Effect + (p.s.Condition ? ' ' + t('(조건 있음)', '(has conditions)') : ''); }).join(' ; ') || '—']);
      if ((allowBy.concat(denyBy)).some(function (p) { return p.s.Condition; })) add('info', t('조건(Condition)이 있는 문장은 실제 요청의 컨텍스트에 따라 결과가 달라질 수 있어 조건을 평가하지 않고 일치한 것으로 가정했습니다', 'Statements with Condition may behave differently per real request context; conditions are not evaluated and are assumed to match'));
      add('info', t('시뮬레이션은 이 정책 하나만 평가합니다. 실제 결과는 SCP, 권한 경계, 세션 정책, 리소스 정책과 함께 결정됩니다 (정확한 확인은 IAM Policy Simulator 사용)', 'The simulation evaluates this one policy only; real results also depend on SCPs, permission boundaries, session policies and resource policies (use the IAM Policy Simulator for certainty)'));
    }
    var ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' }, seenK = {};
    var shown = issues.filter(function (x) { return o.hints || x.sev !== 'info'; }).filter(function (x) { if (seenK[x.msg]) return false; seenK[x.msg] = 1; return true; });
    var list = shown.map(function (x) { return ICON[x.sev] + ' ' + x.msg; });
    var errs = shown.filter(function (x) { return x.sev === 'error'; }).length, warns = shown.filter(function (x) { return x.sev === 'warn'; }).length;
    return { _status: { ok: errs ? false : true, msg: errs ? t('⛔ 오류 ' + errs + '건 · 경고 ' + warns + '건 — 문장 ' + stmts.length + '개', '⛔ ' + errs + ' error(s), ' + warns + ' warning(s) — ' + stmts.length + ' statement(s)') : t('✅ 오류 없음' + (warns ? ' · 경고 ' + warns + '건' : '') + ' — 문장 ' + stmts.length + '개', '✅ No errors' + (warns ? ' · ' + warns + ' warning(s)' : '') + ' — ' + stmts.length + ' statement(s)') }, table: { head: [['#', '#'], ['Sid', 'Sid'], ['Effect', 'Effect'], ['작업', 'Actions'], ['리소스 / 주체', 'Resources / principal'], ['조건', 'Conditions']], rows: rows }, sim: { head: [['작업', 'Action'], ['리소스', 'Resource'], ['결과', 'Result'], ['근거 문장', 'Matching statements']], rows: simRows }, issues: list };
  }
});
