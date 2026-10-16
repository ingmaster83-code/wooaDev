TK.tool('file-type-detector', {
  inputs: [
    { id: 'file', type: 'file', buffer: true, label: ['파일 선택 (서버로 전송되지 않습니다)', 'Choose a file (never uploaded)'], show: function (o) { return o.mode === 'file'; } },
    { id: 'hex', label: ['파일 앞부분의 16진수 바이트', 'Leading bytes in hex'], rows: 4, sample: '89 50 4E 47 0D 0A 1A 0A 00 00 00 0D 49 48 44 52 00 00 01 00 00 00 01 00 08 06 00 00 00', show: function (o) { return o.mode === 'hex'; } },
    { id: 'name', type: 'text', label: ['파일 이름 (확장자 대조용, 선택)', 'File name (to compare the extension, optional)'], sample: 'photo.jpg' }
  ],
  options: [{ id: 'mode', type: 'select', label: ['입력', 'Input'], choices: [['hex', ['16진수 바이트 붙여 넣기', 'Paste hex bytes']], ['file', ['파일 선택', 'Choose a file']]], default: 'hex' }],
  sampleExpectError: true,
  outputs: [{ id: 'table', label: ['판별 결과', 'Detection'], kind: 'table' }, { id: 'hexdump', label: ['앞부분 16진수 덤프', 'Leading hex dump'], kind: 'code', ext: 'txt', download: false }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var B = TK.bytes, bytes;
    if (o.mode === 'file') { if (!v.file || !v.file.buf) throw new Error(t('파일을 선택하세요', 'Choose a file')); bytes = new Uint8Array(v.file.buf.slice(0, 4096)); var size = v.file.buf.byteLength; }
    else { var hx = String(v.hex || '').replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, ''); if (hx.length < 2) throw new Error(t('16진수 바이트를 입력하세요', 'Enter hex bytes')); if (hx.length % 2) throw new Error(t('16진수 자릿수가 홀수입니다', 'Odd number of hex digits')); bytes = new Uint8Array(hx.length / 2); for (var q = 0; q < bytes.length; q++) bytes[q] = parseInt(hx.substr(q * 2, 2), 16); }
    function at(off, arr) { for (var i = 0; i < arr.length; i++) if (bytes[off + i] !== arr[i]) return false; return true; }
    function str(off, s) { for (var i = 0; i < s.length; i++) if (bytes[off + i] !== s.charCodeAt(i)) return false; return true; }
    var S = [ // [이름, 확장자들, MIME, 검사 함수, 분류]
      ['PNG', 'png', 'image/png', function () { return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); }, 'image'],
      ['JPEG', 'jpg,jpeg,jfif', 'image/jpeg', function () { return at(0, [0xff, 0xd8, 0xff]); }, 'image'],
      ['GIF', 'gif', 'image/gif', function () { return str(0, 'GIF87a') || str(0, 'GIF89a'); }, 'image'],
      ['WebP', 'webp', 'image/webp', function () { return str(0, 'RIFF') && str(8, 'WEBP'); }, 'image'],
      ['BMP', 'bmp', 'image/bmp', function () { return str(0, 'BM') && bytes.length > 14; }, 'image'],
      ['TIFF', 'tif,tiff', 'image/tiff', function () { return at(0, [0x49, 0x49, 0x2a, 0]) || at(0, [0x4d, 0x4d, 0, 0x2a]); }, 'image'],
      ['ICO', 'ico', 'image/x-icon', function () { return at(0, [0, 0, 1, 0]) && bytes[4] > 0; }, 'image'],
      ['PSD (Photoshop)', 'psd', 'image/vnd.adobe.photoshop', function () { return str(0, '8BPS'); }, 'image'],
      ['AVIF / HEIC', 'avif,heic,heif', 'image/avif', function () { return str(4, 'ftyp') && (str(8, 'avif') || str(8, 'avis') || str(8, 'heic') || str(8, 'heix') || str(8, 'mif1')); }, 'image'],
      ['SVG / XML', 'svg,xml', 'image/svg+xml', function () { var s = txt(); return /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(s); }, 'image'],
      ['PDF', 'pdf', 'application/pdf', function () { return str(0, '%PDF-'); }, 'document'],
      ['PostScript', 'ps,eps', 'application/postscript', function () { return str(0, '%!PS'); }, 'document'],
      ['RTF', 'rtf', 'application/rtf', function () { return str(0, '{\\rtf'); }, 'document'],
      ['OLE2 (doc/xls/ppt/msi/hwp)', 'doc,xls,ppt,msi,hwp,msg', 'application/x-ole-storage', function () { return at(0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); }, 'document'],
      ['ZIP 계열 (zip/docx/xlsx/pptx/jar/apk/epub)', 'zip,docx,xlsx,pptx,jar,apk,epub,odt,war', 'application/zip', function () { return str(0, 'PK') && (bytes[2] === 3 || bytes[2] === 5 || bytes[2] === 7) && (bytes[3] === 4 || bytes[3] === 6 || bytes[3] === 8); }, 'archive'],
      ['GZIP', 'gz,tgz', 'application/gzip', function () { return at(0, [0x1f, 0x8b, 8]); }, 'archive'],
      ['BZIP2', 'bz2', 'application/x-bzip2', function () { return str(0, 'BZh'); }, 'archive'],
      ['XZ', 'xz', 'application/x-xz', function () { return at(0, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0]); }, 'archive'],
      ['Zstandard', 'zst', 'application/zstd', function () { return at(0, [0x28, 0xb5, 0x2f, 0xfd]); }, 'archive'],
      ['7-Zip', '7z', 'application/x-7z-compressed', function () { return at(0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]); }, 'archive'],
      ['RAR', 'rar', 'application/vnd.rar', function () { return str(0, 'Rar!\x1a\x07'); }, 'archive'],
      ['TAR', 'tar', 'application/x-tar', function () { return str(257, 'ustar'); }, 'archive'],
      ['ISO 9660', 'iso', 'application/x-iso9660-image', function () { return str(0x8001, 'CD001'); }, 'archive'],
      ['MP3 (ID3)', 'mp3', 'audio/mpeg', function () { return str(0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0); }, 'audio'],
      ['WAV', 'wav', 'audio/wav', function () { return str(0, 'RIFF') && str(8, 'WAVE'); }, 'audio'],
      ['FLAC', 'flac', 'audio/flac', function () { return str(0, 'fLaC'); }, 'audio'],
      ['OGG', 'ogg,oga,ogv,opus', 'audio/ogg', function () { return str(0, 'OggS'); }, 'audio'],
      ['AAC (ADTS)', 'aac', 'audio/aac', function () { return bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0; }, 'audio'],
      ['MIDI', 'mid,midi', 'audio/midi', function () { return str(0, 'MThd'); }, 'audio'],
      ['MP4 / MOV / M4A', 'mp4,m4a,m4v,mov,3gp', 'video/mp4', function () { return str(4, 'ftyp') && !(str(8, 'avif') || str(8, 'heic') || str(8, 'mif1')); }, 'video'],
      ['AVI', 'avi', 'video/x-msvideo', function () { return str(0, 'RIFF') && str(8, 'AVI '); }, 'video'],
      ['Matroska / WebM', 'mkv,webm', 'video/x-matroska', function () { return at(0, [0x1a, 0x45, 0xdf, 0xa3]); }, 'video'],
      ['FLV', 'flv', 'video/x-flv', function () { return str(0, 'FLV') && bytes[3] === 1; }, 'video'],
      ['MPEG-TS', 'ts', 'video/mp2t', function () { return bytes[0] === 0x47 && bytes.length > 188 && bytes[188] === 0x47; }, 'video'],
      ['ELF (Linux 실행 파일)', 'elf,so,o', 'application/x-elf', function () { return at(0, [0x7f, 0x45, 0x4c, 0x46]); }, 'executable'],
      ['PE (Windows exe/dll)', 'exe,dll,sys,scr', 'application/vnd.microsoft.portable-executable', function () { return str(0, 'MZ'); }, 'executable'],
      ['Mach-O (macOS)', 'dylib,o', 'application/x-mach-binary', function () { return at(0, [0xcf, 0xfa, 0xed, 0xfe]) || at(0, [0xce, 0xfa, 0xed, 0xfe]) || at(0, [0xfe, 0xed, 0xfa, 0xce]) || at(0, [0xfe, 0xed, 0xfa, 0xcf]) || at(0, [0xca, 0xfe, 0xba, 0xbe]) && bytes[7] < 0x20 && false; }, 'executable'],
      ['Java class / Mach-O universal', 'class', 'application/java-vm', function () { return at(0, [0xca, 0xfe, 0xba, 0xbe]); }, 'executable'],
      ['WebAssembly', 'wasm', 'application/wasm', function () { return at(0, [0, 0x61, 0x73, 0x6d]); }, 'executable'],
      ['Android DEX', 'dex', 'application/octet-stream', function () { return str(0, 'dex\n'); }, 'executable'],
      ['Shell script (shebang)', 'sh,py,rb,pl', 'text/x-script', function () { return str(0, '#!'); }, 'text'],
      ['SQLite', 'db,sqlite,sqlite3', 'application/vnd.sqlite3', function () { return str(0, 'SQLite format 3\0'); }, 'database'],
      ['Parquet', 'parquet', 'application/vnd.apache.parquet', function () { return str(0, 'PAR1'); }, 'database'],
      ['Avro', 'avro', 'application/avro', function () { return at(0, [0x4f, 0x62, 0x6a, 1]); }, 'database'],
      ['TrueType font', 'ttf', 'font/ttf', function () { return at(0, [0, 1, 0, 0, 0]); }, 'font'],
      ['OpenType font', 'otf', 'font/otf', function () { return str(0, 'OTTO'); }, 'font'],
      ['WOFF', 'woff', 'font/woff', function () { return str(0, 'wOFF'); }, 'font'],
      ['WOFF2', 'woff2', 'font/woff2', function () { return str(0, 'wOF2'); }, 'font'],
      ['PEM / 인증서·키', 'pem,crt,key', 'application/x-pem-file', function () { return str(0, '-----BEGIN '); }, 'security'],
      ['OpenSSH 개인키', '', 'application/x-openssh-key', function () { return str(0, 'openssh-key-v1'); }, 'security'],
      ['DER 인코딩 (ASN.1)', 'der,cer,crt', 'application/x-x509-ca-cert', function () { return bytes[0] === 0x30 && (bytes[1] === 0x82 || bytes[1] === 0x81 || bytes[1] < 0x80) && bytes.length > 4; }, 'security'],
      ['PGP', 'pgp,gpg', 'application/pgp-encrypted', function () { return str(0, '-----BEGIN PGP') || bytes[0] === 0x85 || bytes[0] === 0x99; }, 'security'],
      ['KDBX (KeePass)', 'kdbx', 'application/x-keepass2', function () { return at(0, [0x03, 0xd9, 0xa2, 0x9a, 0x67, 0xfb, 0x4b, 0xb5]); }, 'security'],
      ['Windows 단축 파일 (LNK)', 'lnk', 'application/x-ms-shortcut', function () { return at(0, [0x4c, 0, 0, 0, 1, 0x14, 2, 0]); }, 'executable'],
      ['PCAP', 'pcap', 'application/vnd.tcpdump.pcap', function () { return at(0, [0xd4, 0xc3, 0xb2, 0xa1]) || at(0, [0xa1, 0xb2, 0xc3, 0xd4]); }, 'network'],
      ['pcapng', 'pcapng', 'application/x-pcapng', function () { return at(0, [0x0a, 0x0d, 0x0d, 0x0a]); }, 'network'],
      ['HTML', 'html,htm', 'text/html', function () { return /^\s*(<!doctype html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(txt()); }, 'text'],
      ['XML', 'xml', 'application/xml', function () { return /^\s*<\?xml\s/i.test(txt()); }, 'text'],
      ['JSON', 'json', 'application/json', function () { var s = txt().trim(); return /^[\[{]/.test(s) && /["\d\]}tfn]/.test(s.slice(-1)) && jsonish(s); }, 'text']
    ];
    var _txt = null;
    function txt() { if (_txt === null) { try { _txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, 2048)); } catch (e) { _txt = ''; } } return _txt; }
    function jsonish(s) { try { JSON.parse(s); return true; } catch (e) { return /^\s*[\[{]\s*"/.test(s) || /^\s*\[\s*[\[{\d"]/.test(s); } }
    var hits = S.filter(function (s) { try { return s[3](); } catch (e) { return false; } });
    // 더 구체적인 항목 우선: RIFF/ftyp 계열은 먼저 걸러짐. OLE2/ZIP 은 일반 항목이므로 맨 뒤
    var nm = String(v.name || '').trim(), ext = nm.indexOf('.') >= 0 ? nm.split('.').pop().toLowerCase() : '', issues = [], rows = [];
    // 텍스트 판별
    var isText = false, ascii = 0, nonText = 0; for (var k = 0; k < Math.min(bytes.length, 512); k++) { var b = bytes[k]; if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) ascii++; else nonText++; }
    isText = nonText === 0 && txt() !== '';
    if (!hits.length) {
      if (isText) rows.push([t('일반 텍스트 (UTF-8)', 'Plain text (UTF-8)'), 'txt', 'text/plain', '—', t('텍스트', 'text')]);
      else rows.push([t('알 수 없는 바이너리', 'Unknown binary'), '', 'application/octet-stream', '—', 'binary']);
    }
    hits.forEach(function (h) { rows.push([h[0], h[1].replace(/,/g, ', '), h[2], h[1] ? (ext && h[1].split(',').indexOf(ext) >= 0 ? '✅ ' + t('일치', 'matches') : (ext ? '⚠️ .' + ext : '—')) : '—', h[4]]); });
    var bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 'UTF-8 BOM' : bytes[0] === 0xff && bytes[1] === 0xfe ? 'UTF-16 LE BOM' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'UTF-16 BE BOM' : '';
    if (bom) rows.push([bom, '', '', '—', 'text']);
    if (ext && hits.length) {
      var okExt = hits.some(function (h) { return h[1].split(',').indexOf(ext) >= 0; });
      if (!okExt) issues.push(t('🚨 확장자(.' + ext + ')와 실제 형식(' + hits[0][0] + ')이 다릅니다 — 이름을 바꿔 위장한 파일일 수 있습니다', '🚨 The extension (.' + ext + ') does not match the real format (' + hits[0][0] + ') — the file may have been renamed to disguise it'));
    }
    if (hits.some(function (h) { return h[4] === 'executable'; }) && ext && !/^(exe|dll|sys|scr|so|o|dylib|class|wasm|dex|lnk|elf|sh|py|rb|pl)$/.test(ext)) issues.push(t('🚨 실행 파일인데 확장자가 실행 파일이 아닙니다', '🚨 It is an executable but the extension is not an executable one'));
    if (hits.some(function (h) { return /^ZIP/.test(h[0]); })) issues.push(t('ZIP 계열은 docx/xlsx/pptx/jar/apk/epub 도 같은 시작 바이트를 씁니다 — 정확한 종류는 내부 파일 이름(word/, xl/, META-INF/)을 봐야 합니다', 'ZIP-based formats (docx, xlsx, pptx, jar, apk, epub) share the same start; the exact type needs the inner file names (word/, xl/, META-INF/)'));
    if (hits.some(function (h) { return /^OLE2/.test(h[0]); })) issues.push(t('OLE2 는 구형 Office(doc/xls/ppt), HWP 5.0, msi 가 공유합니다', 'OLE2 is shared by legacy Office (doc / xls / ppt), HWP 5.0 and msi'));
    if (hits.length > 1) issues.push(t('여러 후보가 일치했습니다 — 위쪽일수록 구체적입니다', 'Several candidates matched; the earlier ones are more specific'));
    if (bytes.length < 16) issues.push(t('입력이 짧아(' + bytes.length + '바이트) 판별이 부정확할 수 있습니다', 'The input is short (' + bytes.length + ' bytes), so detection may be unreliable'));
    issues.push(t('매직 바이트는 파일의 시작만 보는 휴리스틱입니다. 업로드 검증에는 확장자·MIME·내용 검사를 함께 하세요', 'Magic bytes are a heuristic on the start of a file; combine extension, MIME and content checks for upload validation'));
    var dump = []; for (var d = 0; d < Math.min(bytes.length, 64); d += 16) { var seg = Array.prototype.slice.call(bytes.subarray(d, d + 16)); dump.push(('0000' + d.toString(16)).slice(-4) + '  ' + seg.map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(' ').padEnd(47) + '  ' + seg.map(function (x) { return x >= 32 && x < 127 ? String.fromCharCode(x) : '.'; }).join('')); }
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('🚨 확장자와 실제 형식이 다릅니다', '🚨 Extension and real format differ') } : t('✅ ' + (hits[0] ? hits[0][0] : isText ? '텍스트' : '알 수 없음'), '✅ ' + (hits[0] ? hits[0][0] : isText ? 'text' : 'unknown')), table: { head: [['형식', 'Format'], ['대표 확장자', 'Extensions'], ['MIME', 'MIME'], ['이름 대조', 'Name check'], ['분류', 'Kind']], rows: rows }, hexdump: dump.join('\n'), issues: issues };
  }
});
