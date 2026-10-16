TK.cron.makeTool('jenkins-cron-generator', {
  kind: 'jenkins', label: ['Jenkins cron', 'Jenkins cron'], tz: 'Asia/Seoul',
  inLabel: ['Jenkins cron 식 (분 시 일 월 요일, H 사용 가능)', 'Jenkins cron expression (min hour dom mon dow, H allowed)'],
  sample: 'H(0-29)/10 9-18 * * 1-5', placeholder: ['H/15 * * * *', 'H/15 * * * *'],
  presets: [
    ['every5', ['5분마다 (H/5 * * * *)', 'Every 5 minutes (H/5 * * * *)'], 'H/5 * * * *'],
    ['hourly', ['매시간 (H * * * *)', 'Hourly (H * * * *)'], 'H * * * *'],
    ['nightly', ['매일 새벽 2~3시 사이 (H 2 * * *)', 'Nightly around 2 AM (H 2 * * *)'], 'H 2 * * *'],
    ['weekdays', ['평일 업무 시간 10분마다', 'Every 10 min on weekdays 9–18'], 'H/10 9-18 * * 1-5'],
    ['weekly', ['매주 월요일 새벽 (H 3 * * 1)', 'Mondays at 3 AM (H 3 * * 1)'], 'H 3 * * 1'],
    ['monthly', ['매월 1일 (@monthly)', 'First of every month (@monthly)'], '@monthly']
  ]
});
