TK.cron.makeTool('aws-eventbridge-cron', {
  kind: 'aws', label: ['EventBridge', 'EventBridge'], tz: 'UTC',
  inLabel: ['EventBridge 일정 식 — cron(분 시 일 월 요일 연도) 또는 rate(5 minutes)', 'EventBridge schedule — cron(min hour dom mon dow year) or rate(5 minutes)'],
  sample: 'cron(0 18 ? * MON-FRI *)', placeholder: ['cron(0/15 * * * ? *)', 'cron(0/15 * * * ? *)'],
  presets: [
    ['every5', ['5분마다 rate(5 minutes)', 'Every 5 minutes: rate(5 minutes)'], 'rate(5 minutes)'],
    ['hourly', ['매시간 rate(1 hour)', 'Hourly: rate(1 hour)'], 'rate(1 hour)'],
    ['daily', ['매일 UTC 00:00', 'Daily at 00:00 UTC'], 'cron(0 0 * * ? *)'],
    ['weekdays', ['평일 UTC 09:00', 'Weekdays at 09:00 UTC'], 'cron(0 9 ? * MON-FRI *)'],
    ['monthly', ['매월 1일 UTC 00:00', 'First of the month at 00:00 UTC'], 'cron(0 0 1 * ? *)'],
    ['lastday', ['매월 마지막 날 UTC 23:00', 'Last day of the month at 23:00 UTC'], 'cron(0 23 L * ? *)']
  ]
});
