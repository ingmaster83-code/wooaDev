TK.tool('mobile-unit-converter', {
  allowEmpty: true,
  inputs: [
    { id: 'val', type: 'text', label: ['값', 'Value'], sample: '16', show: function (o) { return o.mode === 'unit'; } },
    { id: 'color', type: 'text', label: ['색상 (#RRGGBB, #AARRGGBB, rgba(), 0xAARRGGBB)', 'Colour (#RRGGBB, #AARRGGBB, rgba(), 0xAARRGGBB)'], sample: '#80FF5722', show: function (o) { return o.mode === 'color'; } }
  ],
  options: [
    { id: 'mode', type: 'select', label: ['동작', 'Action'], choices: [['unit', ['단위 변환 (dp·sp·px·pt)', 'Unit conversion (dp, sp, px, pt)']], ['color', ['색상 표기 변환', 'Colour notation']]], default: 'unit' },
    { id: 'from', type: 'select', label: ['입력 단위', 'Input unit'], choices: [['dp', 'dp / dip (Android)'], ['sp', 'sp (Android font)'], ['px', 'px (' + '화면 픽셀' + ')'], ['pt', 'pt (iOS point)']], default: 'dp', show: function (o) { return o.mode === 'unit'; } },
    { id: 'dpi', type: 'select', label: ['화면 밀도', 'Screen density'], choices: [['120', 'ldpi 120 (0.75×)'], ['160', 'mdpi 160 (1×)'], ['240', 'hdpi 240 (1.5×)'], ['320', 'xhdpi 320 (2×)'], ['480', 'xxhdpi 480 (3×)'], ['640', 'xxxhdpi 640 (4×)']], default: '480', show: function (o) { return o.mode === 'unit'; } },
    { id: 'font', type: 'number', label: ['글꼴 배율 (sp 계산용)', 'Font scale (for sp)'], default: 1, min: 0.5, max: 3, show: function (o) { return o.mode === 'unit'; } }
  ],
  outputs: [{ id: 'table', label: ['변환 결과', 'Conversions'], kind: 'table' }, { id: 'out', label: ['코드', 'Code'], kind: 'code', ext: 'txt' }, { id: 'issues', label: ['참고', 'Notes'], kind: 'list' }],
  run: function (v, o, t) {
    var issues = [];
    if (o.mode === 'color') {
      var s = String(v.color || '').trim(); if (!s) throw new Error(t('색상을 입력하세요', 'Enter a colour'));
      var a = 255, r, g, b, m;
      if ((m = /^(?:#|0x)([0-9a-f]{8})$/i.exec(s))) { var n = parseInt(m[1], 16); a = n >>> 24; r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; issues.push(t('8자리는 Android/Flutter 는 #AARRGGBB(알파가 앞), 웹 CSS 는 #RRGGBBAA(알파가 뒤)입니다. 여기서는 AARRGGBB 로 읽었습니다', '8 digits are #AARRGGBB (alpha first) on Android / Flutter but #RRGGBBAA (alpha last) in CSS. It was read as AARRGGBB')); }
      else if ((m = /^(?:#|0x)([0-9a-f]{6})$/i.exec(s))) { var n2 = parseInt(m[1], 16); r = n2 >> 16; g = (n2 >> 8) & 255; b = n2 & 255; }
      else if ((m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s))) { r = parseInt(m[1] + m[1], 16); g = parseInt(m[2] + m[2], 16); b = parseInt(m[3] + m[3], 16); }
      else if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,\/]+([\d.]+%?))?\s*\)$/i.exec(s))) { r = +m[1]; g = +m[2]; b = +m[3]; if (m[4] !== undefined) a = Math.round((/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4])) * 255); }
      else throw new Error(t('색상 형식을 해석할 수 없습니다', 'Cannot parse the colour'));
      if ([r, g, b].some(function (x) { return x > 255; })) throw new Error(t('RGB 값은 0~255 여야 합니다', 'RGB values must be 0–255'));
      var h2 = function (x) { return ('0' + x.toString(16)).slice(-2).toUpperCase(); }, af = Math.round(a / 255 * 1000) / 1000;
      var f3 = function (x) { return (Math.round(x / 255 * 1000) / 1000).toString(); };
      var rows = [['#RRGGBB', '#' + h2(r) + h2(g) + h2(b)], ['CSS #RRGGBBAA', '#' + h2(r) + h2(g) + h2(b) + h2(a)], ['Android #AARRGGBB', '#' + h2(a) + h2(r) + h2(g) + h2(b)], ['CSS rgba()', 'rgba(' + r + ', ' + g + ', ' + b + ', ' + af + ')'], ['Flutter', 'Color(0x' + h2(a) + h2(r) + h2(g) + h2(b) + ')'], ['iOS UIColor', 'UIColor(red: ' + f3(r) + ', green: ' + f3(g) + ', blue: ' + f3(b) + ', alpha: ' + af + ')'], ['SwiftUI', 'Color(red: ' + f3(r) + ', green: ' + f3(g) + ', blue: ' + f3(b) + ').opacity(' + af + ')'], ['Android Color.argb', 'Color.argb(' + a + ', ' + r + ', ' + g + ', ' + b + ')'], ['Android XML', '<color name="brand">#' + h2(a) + h2(r) + h2(g) + h2(b) + '</color>'], ['Kotlin Compose', 'Color(0x' + h2(a) + h2(r) + h2(g) + h2(b) + ')'], [t('투명도', 'Opacity'), Math.round(af * 100) + '%']];
      var hsl = (function () { var rr = r / 255, gg = g / 255, bb = b / 255, mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb), d = mx - mn, hh = 0, l = (mx + mn) / 2, ss = d ? d / (1 - Math.abs(2 * l - 1)) : 0; if (d) { if (mx === rr) hh = ((gg - bb) / d) % 6; else if (mx === gg) hh = (bb - rr) / d + 2; else hh = (rr - gg) / d + 4; hh *= 60; if (hh < 0) hh += 360; } return 'hsl(' + Math.round(hh) + ', ' + Math.round(ss * 100) + '%, ' + Math.round(l * 100) + '%)'; })();
      rows.splice(4, 0, ['CSS hsl()', hsl]);
      return { _status: t('✅ 색상 변환 완료', '✅ Colour converted'), table: { head: [['형식', 'Format'], ['값', 'Value']], rows: rows }, out: rows.map(function (x) { return x[0] + ': ' + x[1]; }).join('\n'), issues: issues };
    }
    var val = parseFloat(String(v.val || '').replace(/[^\d.\-]/g, '')); if (isNaN(val)) throw new Error(t('숫자를 입력하세요', 'Enter a number'));
    var dpi = +o.dpi, dens = dpi / 160, fs = o.font || 1, px;
    if (o.from === 'dp') px = val * dens; else if (o.from === 'sp') px = val * dens * fs; else if (o.from === 'px') px = val; else px = val * dens;   // iOS 논리 포인트: 1pt = 1dp 로 취급
    var dp = px / dens, sp = dp / fs;
    function r2(x) { return Math.round(x * 100) / 100; }
    var rows2 = [['px', r2(px) + ' px'], ['dp (Android)', r2(dp) + ' dp'], ['sp (Android)', r2(sp) + ' sp'], ['pt (iOS)', r2(dp) + ' pt'], [t('물리 크기', 'Physical size'), r2(px / dpi * 25.4) + ' mm (' + r2(px / dpi) + ' in)'], [t('밀도 배율', 'Density factor'), dens + '× (' + dpi + ' dpi)']];
    var tbl = [['ldpi', 120], ['mdpi', 160], ['hdpi', 240], ['xhdpi', 320], ['xxhdpi', 480], ['xxxhdpi', 640]].map(function (b) { return [b[0] + ' (' + b[1] + ')', r2(dp * b[1] / 160) + ' px', 'drawable-' + b[0]]; });
    var ios = [1, 2, 3].map(function (k) { return '@' + k + 'x = ' + r2(dp * k) + ' px'; });
    issues.push(t('Android: px = dp × (dpi ÷ 160). sp 는 사용자 글꼴 크기 설정도 곱해집니다', 'Android: px = dp × (dpi ÷ 160). sp also multiplies by the user font-size setting'));
    issues.push(t('iOS 의 pt 는 논리 단위이며 화면 배율(@1x/@2x/@3x)에 따라 픽셀이 됩니다: ' + ios.join(', '), 'An iOS pt is a logical unit that becomes pixels by scale: ' + ios.join(', ')));
    issues.push(t('터치 대상 최소 크기: Android 48dp, iOS 44pt', 'Minimum touch target: 48 dp on Android, 44 pt on iOS'));
    if (dp > 0 && dp < 44 && o.from !== 'sp') issues.push(t('이 크기(' + r2(dp) + 'dp)는 터치 대상으로는 작습니다', 'This size (' + r2(dp) + ' dp) is small for a touch target'));
    return { _status: t('✅ ' + val + ' ' + o.from + ' = ' + r2(px) + ' px (' + dpi + ' dpi)', '✅ ' + val + ' ' + o.from + ' = ' + r2(px) + ' px (' + dpi + ' dpi)'), table: { head: [['단위', 'Unit'], ['값', 'Value']], rows: rows2.concat(tbl.map(function (x) { return [x[0], x[1] + '  → ' + x[2]]; })) }, out: 'Android XML : ' + r2(dp) + 'dp  /  ' + r2(sp) + 'sp\nCompose     : ' + r2(dp) + '.dp  /  ' + r2(sp) + '.sp\nFlutter     : ' + r2(dp) + '  (logical pixels)\nSwiftUI/UIKit: ' + r2(dp) + ' pt\nCSS (1x web): ' + r2(dp) + 'px', issues: issues };
  }
});
