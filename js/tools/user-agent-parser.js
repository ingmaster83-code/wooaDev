TK.tool('user-agent-parser', {
  inputs: [{ id: 'in', label: ['User-Agent 문자열 (한 줄에 하나)', 'User-Agent strings (one per line)'], rows: 8,
    sample: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36\nMozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1\nMozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36\nMozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.0.0)\nMozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Whale/3.28.0.0 Safari/537.36\nMozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)\nMozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)\nMozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0' }],
  options: [],
  outputs: [{ id: 'kv', label: ['분석 결과', 'Result'], kind: 'kv' }, { id: 'table', label: ['분석 결과', 'Results'], kind: 'table' }],
  run: function (v, o, t) {
    var NT = { '10.0': '10 / 11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP' };
    function parse(ua) {
      var r = { browser: '', ver: '', engine: '', engVer: '', os: '', osVer: '', device: 'Desktop', model: '', bot: '', inapp: '' }, m;
      // 봇
      var BOTS = [[/Googlebot-Image|Googlebot|AdsBot-Google|Mediapartners-Google|Google-InspectionTool|GoogleOther/, 'Googlebot'], [/bingbot|BingPreview/, 'Bingbot'], [/Yeti/, 'Naver Yeti'], [/Daum(oa)?|DaumCrawler/, 'Daum'], [/DuckDuckBot/, 'DuckDuckBot'], [/Baiduspider/, 'Baiduspider'], [/YandexBot/, 'YandexBot'], [/GPTBot|ChatGPT-User|OAI-SearchBot/, 'OpenAI bot'], [/ClaudeBot|Claude-Web|anthropic-ai/, 'Anthropic bot'], [/PerplexityBot/, 'PerplexityBot'], [/Applebot/, 'Applebot'], [/facebookexternalhit|Facebot/, 'Facebook crawler'], [/Twitterbot/, 'Twitterbot'], [/Slackbot/, 'Slackbot'], [/AhrefsBot/, 'AhrefsBot'], [/SemrushBot/, 'SemrushBot'], [/curl\//, 'curl'], [/Wget\//, 'Wget'], [/python-requests|Python-urllib|aiohttp/, 'Python HTTP client'], [/Go-http-client/, 'Go HTTP client'], [/axios\/|node-fetch|okhttp\//, 'HTTP library'], [/HeadlessChrome|PhantomJS|Puppeteer|Playwright/, 'Headless browser']];
      BOTS.some(function (b) { if (b[0].test(ua)) { r.bot = b[1]; return true; } });
      // 엔진
      if ((m = /Gecko\/(\d+)/.exec(ua)) && /Firefox|Gecko\/\d{8}/.test(ua) && !/like Gecko/.test(ua.replace(/Gecko\/\d{8}/, ''))) { r.engine = 'Gecko'; r.engVer = m[1]; }
      else if ((m = /Trident\/([\d.]+)/.exec(ua))) { r.engine = 'Trident'; r.engVer = m[1]; }
      else if ((m = /AppleWebKit\/([\d.]+)/.exec(ua))) { r.engine = /Chrome\/|Chromium|Edg\/|OPR\/|Whale|SamsungBrowser/.test(ua) && !/CriOS|FxiOS/.test(ua) ? 'Blink' : 'WebKit'; r.engVer = m[1]; }
      if (/Gecko\/\d{8}/.test(ua) && /Firefox/.test(ua)) { r.engine = 'Gecko'; r.engVer = (/rv:([\d.]+)/.exec(ua) || [0, r.engVer])[1]; }
      // 브라우저(순서 중요)
      var BR = [[/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Microsoft Edge'], [/OPR\/([\d.]+)|Opera\/([\d.]+)/, 'Opera'], [/Whale\/([\d.]+)/, 'Naver Whale'], [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'], [/YaBrowser\/([\d.]+)/, 'Yandex Browser'], [/Vivaldi\/([\d.]+)/, 'Vivaldi'], [/DuckDuckGo\/([\d.]+)/, 'DuckDuckGo'], [/Brave\/([\d.]+)/, 'Brave'], [/CriOS\/([\d.]+)/, 'Chrome (iOS)'], [/FxiOS\/([\d.]+)/, 'Firefox (iOS)'], [/Firefox\/([\d.]+)/, 'Firefox'], [/MSIE ([\d.]+)|Trident\/.*rv:([\d.]+)/, 'Internet Explorer'], [/Chrome\/([\d.]+)/, 'Chrome'], [/Chromium\/([\d.]+)/, 'Chromium'], [/Version\/([\d.]+).*Safari/, 'Safari'], [/Safari\/([\d.]+)/, 'Safari']];
      BR.some(function (b) { var mm = b[0].exec(ua); if (mm) { r.browser = b[1]; r.ver = mm[1] || mm[2] || ''; return true; } });
      // 인앱 브라우저
      var APP = [[/KAKAOTALK ([\d.]+)/i, 'KakaoTalk'], [/NAVER\(inapp; ([^;]+); [^;]+; ([\d.]+)\)/, 'NAVER 앱'], [/DaumApps\/([\d.]+)/, 'Daum 앱'], [/FBAN\/FBIOS|FBAV\/([\d.]+)/, 'Facebook 앱'], [/Instagram ([\d.]+)/, 'Instagram'], [/\bLine\/([\d.]+)/, 'LINE'], [/Twitter for|TwitterAndroid/, 'X(Twitter) 앱'], [/MicroMessenger\/([\d.]+)/, 'WeChat'], [/; wv\)/, 'Android WebView']];
      APP.some(function (a) { var mm = a[0].exec(ua); if (mm) { r.inapp = a[1] + (mm[1] && /^\d/.test(mm[1]) ? ' ' + mm[1] : ''); return true; } });
      // OS
      if ((m = /Windows NT ([\d.]+)/.exec(ua))) { r.os = 'Windows'; r.osVer = NT[m[1]] || m[1]; }
      else if ((m = /Android ([\d.]+)/.exec(ua))) { r.os = 'Android'; r.osVer = m[1]; }
      else if ((m = /(?:iPhone|CPU) OS ([\d_]+)/.exec(ua)) && /iPhone|iPad|iPod/.test(ua)) { r.os = /iPad/.test(ua) ? 'iPadOS' : 'iOS'; r.osVer = m[1].replace(/_/g, '.'); }
      else if ((m = /Mac OS X ([\d_.]+)/.exec(ua))) { r.os = 'macOS'; r.osVer = m[1].replace(/_/g, '.'); }
      else if (/CrOS/.test(ua)) { r.os = 'ChromeOS'; }
      else if (/Linux|X11/.test(ua)) { r.os = /Ubuntu/.test(ua) ? 'Ubuntu Linux' : /Fedora/.test(ua) ? 'Fedora Linux' : 'Linux'; }
      else if (/Windows Phone/.test(ua)) r.os = 'Windows Phone';
      // 기기
      if (/iPad|Tablet|PlayBook|Silk/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua) && !/Windows/.test(ua))) r.device = t('태블릿', 'Tablet');
      else if (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone/.test(ua)) r.device = t('모바일', 'Mobile');
      else if (/SmartTV|SMART-TV|Tizen|WebOS|HbbTV|Roku|AppleTV/i.test(ua)) r.device = 'TV';
      else r.device = t('데스크톱', 'Desktop');
      if (r.bot) r.device = t('봇/크롤러', 'Bot / crawler');
      if ((m = /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(ua)) && !/^(wv|Mobile)$/.test(m[1])) r.model = m[1].trim();
      else if (/iPhone/.test(ua)) r.model = 'iPhone'; else if (/iPad/.test(ua)) r.model = 'iPad';
      if (/^SM-/.test(r.model)) r.model += t(' (삼성 갤럭시)', ' (Samsung Galaxy)');
      return r;
    }
    var lines = v.in.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), rs = lines.map(function (ln) { return { ln: ln, r: parse(ln) }; });
    function name(r) { return r.bot || (r.browser ? r.browser + (r.ver ? ' ' + r.ver.split('.').slice(0, 2).join('.') : '') : (r.inapp ? r.inapp.replace(/ [\d.]+$/, '') + t(' (웹뷰)', ' (WebView)') : t('알 수 없음', 'Unknown'))); }
    if (rs.length === 1) {
      var r = rs[0].r;
      return { _status: r.bot ? t('🤖 봇/크롤러: ' + r.bot, '🤖 Bot / crawler: ' + r.bot) : t('✅ 분석 완료', '✅ Parsed'), kv: [[['브라우저', 'Browser'], r.bot ? r.bot + t(' (봇)', ' (bot)') : (r.browser || '—')], [['브라우저 버전', 'Browser version'], r.ver || '—'], [['렌더링 엔진', 'Engine'], (r.engine || '—') + (r.engVer ? ' ' + r.engVer : '')], [['운영체제', 'OS'], (r.os || '—') + (r.osVer ? ' ' + r.osVer : '')], [['기기 유형', 'Device type'], r.device], [['기기 모델', 'Device model'], r.model || '—'], [['인앱 브라우저', 'In-app browser'], r.inapp || '—']] };
    }
    return { _status: t('✅ ' + rs.length + '개 분석', '✅ Parsed ' + rs.length),
      table: { head: [['브라우저', 'Browser'], ['엔진', 'Engine'], ['운영체제', 'OS'], ['기기', 'Device'], ['비고', 'Notes']], rows: rs.map(function (x) { var r = x.r; return [name(r), (r.engine || '—') + (r.engVer ? ' ' + r.engVer.split('.')[0] : ''), (r.os || '—') + (r.osVer ? ' ' + r.osVer : ''), r.device + (r.model ? ' · ' + r.model : ''), r.inapp || (r.bot ? t('크롤러', 'crawler') : '')]; }) } };
  }
});
