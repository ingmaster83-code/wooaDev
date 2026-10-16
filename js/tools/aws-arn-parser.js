TK.tool('aws-arn-parser', {
  allowEmpty: true,
  inputs: [
    { id: 'arns', label: ['ARN (한 줄에 하나)', 'ARNs (one per line)'], rows: 6, sample: 'arn:aws:s3:::my-bucket/logs/2026/app.log\narn:aws:iam::123456789012:role/service-role/MyLambdaRole\narn:aws:lambda:ap-northeast-2:123456789012:function:order-handler:prod\narn:aws:dynamodb:ap-northeast-2:123456789012:table/Orders/stream/2026-10-01T00:00:00.000\narn:aws-cn:ec2:cn-north-1:123456789012:instance/i-0abc123def456789a', show: function (o) { return o.mode === 'parse'; } },
    { id: 'partition', type: 'text', label: ['partition', 'partition'], sample: 'aws', show: function (o) { return o.mode === 'build'; } },
    { id: 'service', type: 'text', label: ['service', 'service'], sample: 'sqs', show: function (o) { return o.mode === 'build'; } },
    { id: 'region', type: 'text', label: ['region', 'region'], sample: 'ap-northeast-2', show: function (o) { return o.mode === 'build'; } },
    { id: 'account', type: 'text', label: ['account-id', 'account-id'], sample: '123456789012', show: function (o) { return o.mode === 'build'; } },
    { id: 'resource', type: 'text', label: ['resource', 'resource'], sample: 'my-queue', show: function (o) { return o.mode === 'build'; } }
  ],
  options: [{ id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['parse', ['ARN 분석', 'Parse ARNs']], ['build', ['ARN 만들기', 'Build an ARN']]], default: 'parse' }],
  outputs: [{ id: 'table', label: ['필드별 분석', 'Fields'], kind: 'table' }, { id: 'out', label: ['결과', 'Result'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var NOREGION = { s3: 1, iam: 1, route53: 1, cloudfront: 1, organizations: 1, waf: 1, sts: 0 }, NOACCT = { s3: 1 }, issues = [], rows = [], out = [];
    var SVC = { s3: 'Amazon S3', iam: 'IAM', lambda: 'AWS Lambda', ec2: 'Amazon EC2', dynamodb: 'DynamoDB', sqs: 'Amazon SQS', sns: 'Amazon SNS', rds: 'Amazon RDS', ecs: 'Amazon ECS', eks: 'Amazon EKS', kms: 'AWS KMS', secretsmanager: 'Secrets Manager', logs: 'CloudWatch Logs', events: 'EventBridge', states: 'Step Functions', apigateway: 'API Gateway', cloudformation: 'CloudFormation', ecr: 'Amazon ECR', elasticloadbalancing: 'Elastic Load Balancing', route53: 'Route 53', cloudfront: 'CloudFront', sts: 'STS', ssm: 'Systems Manager', kinesis: 'Kinesis', glue: 'AWS Glue', athena: 'Athena', redshift: 'Redshift', es: 'OpenSearch', bedrock: 'Amazon Bedrock' };
    function split(arn) {
      var p = arn.split(':'); if (p.length < 6 || p[0] !== 'arn') return null;
      return { partition: p[1], service: p[2], region: p[3], account: p[4], resource: p.slice(5).join(':') };
    }
    function check(a, raw) {
      var pr = [];
      if (!/^aws(-cn|-us-gov|-iso(-b)?)?$/.test(a.partition)) pr.push(t('partition 은 aws, aws-cn, aws-us-gov 등이어야 합니다', 'partition should be aws, aws-cn, aws-us-gov …'));
      if (!a.service || !/^[a-z0-9-]+$/.test(a.service)) pr.push(t('service 형식이 올바르지 않습니다', 'invalid service'));
      if (a.region && !/^[a-z]{2}(-[a-z]+)+-\d$/.test(a.region)) pr.push(t('region 형식이 올바르지 않습니다 (예: ap-northeast-2)', 'invalid region (e.g. ap-northeast-2)'));
      if (a.account && !/^\d{12}$/.test(a.account) && a.account !== 'aws') pr.push(t('account-id 는 12자리 숫자여야 합니다', 'account-id must be 12 digits'));
      if (!a.resource) pr.push(t('resource 가 비었습니다', 'empty resource'));
      if (NOREGION[a.service] === 1 && a.region) issues.push(t(a.service + ' ARN 에는 보통 region 이 비어 있습니다', a.service + ' ARNs normally have an empty region'));
      if (NOACCT[a.service] && a.account) issues.push(t('S3 ARN 에는 account-id 가 없습니다 (버킷 이름이 전역 고유)', 'S3 ARNs have no account-id (bucket names are global)'));
      if (!NOREGION[a.service] && !a.region && a.service !== 'sts') issues.push(t(a.service + ' ARN 에 region 이 없습니다 — 리전 서비스라면 누락일 수 있습니다', a.service + ' ARN has no region — may be missing for a regional service'));
      if (/\*/.test(raw)) issues.push(t('와일드카드(*)가 포함되어 있습니다 — IAM 정책 리소스 패턴으로 쓰이는 형태입니다', 'Contains a wildcard (*) — a pattern as used in IAM policy resources'));
      return pr;
    }
    if (o.mode === 'build') {
      var a = { partition: (v.partition || 'aws').trim(), service: (v.service || '').trim(), region: (v.region || '').trim(), account: (v.account || '').trim(), resource: (v.resource || '').trim() };
      if (!a.service || !a.resource) throw new Error(t('service 와 resource 를 입력하세요', 'Enter service and resource'));
      var arn = ['arn', a.partition, a.service, a.region, a.account, a.resource].join(':'), pr = check(a, arn);
      if (pr.length) issues.unshift('🚨 ' + pr.join(' · '));
      return { _status: pr.length ? { ok: false, msg: t('❌ ARN 형식 문제', '❌ ARN format problem') } : t('✅ ARN 을 만들었습니다', '✅ ARN built'), out: arn, table: { head: [['필드', 'Field'], ['값', 'Value']], rows: [['partition', a.partition], ['service', a.service + (SVC[a.service] ? ' (' + SVC[a.service] + ')' : '')], ['region', a.region || '—'], ['account-id', a.account || '—'], ['resource', a.resource]] }, issues: issues };
    }
    var lines = String(v.arns || '').replace(/\r/g, '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean), bad = 0;
    if (!lines.length) throw new Error(t('ARN 을 입력하세요', 'Enter an ARN'));
    lines.forEach(function (ln) {
      var a = split(ln);
      if (!a) { bad++; rows.push([ln, '❌', '', '', '', t('arn:partition:service:region:account:resource 형식이 아닙니다', 'Not in arn:partition:service:region:account:resource form')]); return; }
      var pr = check(a, ln); if (pr.length) bad++;
      var rtype = '', rid = a.resource, m = /^([A-Za-z0-9_-]+)[\/:](.+)$/.exec(a.resource);
      if (m) { rtype = m[1]; rid = m[2]; }
      rows.push([ln.length > 60 ? ln.slice(0, 57) + '…' : ln, pr.length ? '❌' : '✅', a.service + (SVC[a.service] ? ' · ' + SVC[a.service] : '') + ' / ' + a.partition, (a.region || '—') + ' / ' + (a.account || '—'), rtype ? rtype + ' → ' + rid : rid, pr.join(' · ')]);
      out.push(ln + '\n  partition=' + a.partition + ' service=' + a.service + ' region=' + (a.region || '') + ' account=' + (a.account || '') + ' resource=' + a.resource);
    });
    issues.push(t('resource 부분의 구조(타입/이름/버전·별칭)는 서비스마다 다릅니다 — 구분자 / 또는 : 를 기준으로 첫 토큰을 타입으로 추정해 표시했습니다', 'The resource part differs per service — the first token before / or : is shown as the type as a guess'));
    var uniq = []; issues.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return { _status: bad ? { ok: 'info', msg: t('🔍 ' + lines.length + '개 중 ' + bad + '개에 문제가 있습니다', '🔍 ' + bad + ' of ' + lines.length + ' ARN(s) have problems') } : t('✅ ARN ' + lines.length + '개를 분석했습니다', '✅ Parsed ' + lines.length + ' ARN(s)'), table: { head: [['ARN', 'ARN'], ['상태', 'Status'], ['서비스 / 파티션', 'Service / partition'], ['리전 / 계정', 'Region / account'], ['리소스', 'Resource'], ['문제', 'Problems']], rows: rows }, out: out.join('\n'), issues: uniq };
  }
});
