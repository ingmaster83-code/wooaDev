TK.cron.makeTool('quartz-cron-generator', {
  kind: 'quartz', label: ['Quartz cron', 'Quartz cron'], tz: 'Asia/Seoul',
  inLabel: ['Quartz cron 식 (초 분 시 일 월 요일 [연도])', 'Quartz cron expression (sec min hour dom mon dow [year])'],
  sample: '0 15 10 ? * MON-FRI', placeholder: ['0 0/5 * * * ?', '0 0/5 * * * ?'],
  presets: [
    ['every5', ['5분마다', 'Every 5 minutes'], '0 0/5 * * * ?'],
    ['hourly', ['매시 정각', 'Top of every hour'], '0 0 * * * ?'],
    ['daily3', ['매일 03:00', 'Daily at 03:00'], '0 0 3 * * ?'],
    ['weekdays9', ['평일 09:00', 'Weekdays at 09:00'], '0 0 9 ? * MON-FRI'],
    ['firstmon', ['매월 첫째 월요일 10:00', 'First Monday of the month at 10:00'], '0 0 10 ? * 2#1'],
    ['lastday', ['매월 마지막 날 23:30', 'Last day of the month at 23:30'], '0 30 23 L * ?'],
    ['lastweekday', ['매월 마지막 평일 18:00', 'Last weekday of the month at 18:00'], '0 0 18 LW * ?']
  ]
});
