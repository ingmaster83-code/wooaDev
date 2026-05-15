"""
WooaDev 영어 버전 자동 생성 스크립트
실행: python build_en.py
결과: en/ 폴더에 영어 버전 HTML 파일 생성
"""

import os, re, shutil, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = os.path.dirname(os.path.abspath(__file__))
EN_DIR = os.path.join(BASE, 'en')
os.makedirs(EN_DIR, exist_ok=True)

# ── 1. 페이지별 메타 번역 ─────────────────────────────────────────────────────
PAGE_META = {
    'index.html': {
        'title': 'Free Developer Tools – Base64 Hash JWT Regex JSON SQL CSS | WooaDev',
        'desc':  'Use 20+ essential developer utilities free in your browser — Base64, Hash, JWT, UUID, Regex, JSON Formatter, SQL Formatter, CSS Unit Converter, and more. No install, no signup.',
        'kw':    'developer tools, Base64 encoder, hash generator, JWT decoder, UUID generator, regex tester, JSON formatter, SQL formatter, CSS unit converter, chmod calculator, HTTP status codes, free dev tools, online dev tools, WooaDev',
        'og_title': 'Free Developer Tools – Base64 Hash JWT Regex JSON SQL | WooaDev',
        'og_desc':  '20+ developer utilities free in your browser. No install, no signup. All processing is local — your data never leaves your device.',
        'app_name': 'WooaDev – Free Developer Tools',
        'faq': [
            ('Are all tools completely free?',
             'Yes. All 20+ tools on WooaDev are 100% free with no sign-up or subscription required.'),
            ('Is my data safe?',
             'Yes. All processing happens locally in your browser. Your data is never sent to any server.'),
            ('Do I need to install anything?',
             'No. All tools run directly in your web browser. No installation or login required.'),
        ],
        'h1': 'Developer Tools Collection',
        'tool_desc': 'Use Base64, Hash, JWT, Regex, UUID, and 15 more utilities directly in your browser — no install needed.',
        'breadcrumb': 'Home',
        'cross_banner_text': 'Need a file viewer?',
        'cross_banner_link_text': '🔍 WooaViewer – Free Viewer →',
        'cross_banner_href': 'https://wooaviewer.wooahouse.com/',
    },
    'base64.html': {
        'title': 'Base64 Encoder & Decoder – Free Online Text & File Base64 Converter | WooaDev',
        'desc':  'Encode text or files to Base64, or decode Base64 strings back to original. URL-safe Base64 supported. Runs entirely in your browser — no server upload.',
        'kw':    'Base64 encoder, Base64 decoder, Base64 converter, online Base64, free Base64, Base64 encode, Base64 decode, Base64 file converter, URL-safe Base64, Base64 online',
        'og_title': 'Base64 Encoder & Decoder – Free Online | WooaDev',
        'og_desc':  'Encode text or files to Base64, or decode Base64 strings instantly. URL-safe support. Free, browser-based, no server upload.',
        'app_name': 'Base64 Encoder / Decoder',
        'faq': [
            ('What is Base64 encoding used for?',
             'Base64 encoding is used to safely transmit binary data over text-based protocols, such as embedding images in HTML/CSS, encoding email attachments, or passing data in APIs.'),
            ('Can I encode files to Base64?',
             'Yes. You can select any file and it will be encoded to a Base64 string directly in your browser.'),
            ('Is my data sent to a server?',
             'No. All encoding and decoding happens locally in your browser. Your data never leaves your device.'),
        ],
        'h1': 'Base64 Encoder / Decoder',
        'tool_desc': 'Encode text or files to Base64, or decode a Base64 string back to its original form. Everything runs in your browser.',
        'breadcrumb': 'Base64 Encoder/Decoder',
        'cross_banner_text': 'Need to encode URLs or parse query strings?',
        'cross_banner_link_text': '🔗 URL Encoder/Decoder →',
        'cross_banner_href': 'url-encoder.html',
    },
    'url-encoder.html': {
        'title': 'URL Encoder & Decoder – Free Online Percent Encoding & Query Parser | WooaDev',
        'desc':  'Encode or decode URLs (percent encoding) and parse query parameters for free. Handles special characters and non-ASCII text. Runs entirely in your browser.',
        'kw':    'URL encoder, URL decoder, percent encoding, URL encode, URL decode, query string parser, encodeURIComponent, URL encoding tool, online URL encoder, free URL decoder',
        'og_title': 'URL Encoder & Decoder – Free Online | WooaDev',
        'og_desc':  'URL encode, decode, and parse query parameters instantly. Supports special characters and Korean. Free, browser-based.',
        'app_name': 'URL Encoder / Decoder',
        'faq': [
            ('What is URL encoding?',
             'URL encoding (percent encoding) converts special characters like spaces, Korean, or symbols into a format that can be safely included in a URL (e.g., space → %20).'),
            ('What is the difference between encodeURI and encodeURIComponent?',
             'encodeURI encodes a full URL while preserving characters like /, ?, and =. encodeURIComponent encodes everything, making it suitable for encoding individual query parameter values.'),
            ('Is my data sent to a server?',
             'No. All encoding and decoding happens locally in your browser. Nothing is uploaded anywhere.'),
        ],
        'h1': 'URL Encoder / Decoder',
        'tool_desc': 'Encode or decode URLs (percent encoding) and parse query string parameters. All processing is done locally in your browser.',
        'breadcrumb': 'URL Encoder/Decoder',
        'cross_banner_text': 'Need to encode text to Base64?',
        'cross_banner_link_text': '🔐 Base64 Encoder/Decoder →',
        'cross_banner_href': 'base64.html',
    },
    'hash-generator.html': {
        'title': 'Hash Generator – MD5 SHA-1 SHA-256 SHA-512 Free Online | WooaDev',
        'desc':  'Generate MD5, SHA-1, SHA-256, and SHA-512 hash values from text or files for free. Compare multiple algorithm results simultaneously. Runs entirely in your browser.',
        'kw':    'hash generator, MD5, SHA256, SHA512, SHA1, hash online, MD5 hash generator, SHA256 hash, free hash generator, file hash, text hash, checksum generator',
        'og_title': 'Hash Generator – MD5 SHA-1 SHA-256 SHA-512 Free Online | WooaDev',
        'og_desc':  'Generate MD5, SHA-1, SHA-256, and SHA-512 hashes from text or files. Compare multiple algorithms at once. Free, browser-based.',
        'app_name': 'Hash Generator',
        'faq': [
            ('What hash algorithms are supported?',
             'MD5, SHA-1, SHA-256, and SHA-512 are all supported and calculated simultaneously.'),
            ('Can I generate a hash from a file?',
             'Yes. You can upload any file and generate its hash values directly in the browser.'),
            ('Is my data sent to a server?',
             'No. All hash computation happens locally in your browser. Your data is never uploaded.'),
        ],
        'h1': 'Hash Generator',
        'tool_desc': 'Enter text to generate MD5, SHA-1, SHA-256, and SHA-512 hashes simultaneously. All computation runs in your browser.',
        'breadcrumb': 'Hash Generator',
        'cross_banner_text': 'Need to decode a JWT token?',
        'cross_banner_link_text': '🎫 JWT Decoder →',
        'cross_banner_href': 'jwt-decoder.html',
    },
    'jwt-decoder.html': {
        'title': 'JWT Decoder – Decode JWT Token Header, Payload & Expiry Free Online | WooaDev',
        'desc':  'Decode JWT token header, payload, and expiration time (exp) for free in your browser. Your token is never sent to any server — 100% private.',
        'kw':    'JWT decoder, JWT parser, JWT token, JWT payload, JWT header, online JWT, JWT expiry, JSON Web Token, JWT decode online, free JWT decoder, JWT verification',
        'og_title': 'JWT Decoder – Free Online JWT Token Parser | WooaDev',
        'og_desc':  'Decode JWT header, payload, and expiry time instantly. Token stays in your browser — never sent to a server. Free.',
        'app_name': 'JWT Decoder',
        'faq': [
            ('What is a JWT token?',
             'A JWT (JSON Web Token) is a compact, URL-safe token format used for authentication and data exchange. It consists of three parts: header, payload, and signature, each Base64-encoded and separated by dots.'),
            ('Is it safe to paste my JWT here?',
             'Yes. All decoding happens locally in your browser. Your token is never sent to any server.'),
            ('Can this tool verify JWT signatures?',
             'This tool decodes the header and payload for inspection. Signature verification requires the secret key, which is not needed for general token inspection.'),
        ],
        'h1': 'JWT Decoder',
        'tool_desc': 'Paste a JWT token to decode its header, payload, and check the expiration time. Everything runs in your browser — your token is never sent anywhere.',
        'breadcrumb': 'JWT Decoder',
        'cross_banner_text': 'Need to generate a secure password or UUID?',
        'cross_banner_link_text': '🔒 Password Generator →',
        'cross_banner_href': 'password-generator.html',
    },
    'password-generator.html': {
        'title': 'Password Generator – Secure Random Password with Strength Checker Free | WooaDev',
        'desc':  'Generate strong random passwords with custom length, uppercase, lowercase, numbers, and special characters. Real-time strength indicator. Runs in your browser — no server upload.',
        'kw':    'password generator, random password, secure password, strong password generator, free password generator, online password generator, password strength checker, random password tool',
        'og_title': 'Password Generator – Secure Random Passwords Free | WooaDev',
        'og_desc':  'Generate strong random passwords with custom options and real-time strength indicator. Free, browser-based, no signup.',
        'app_name': 'Password Generator',
        'faq': [
            ('How secure are the generated passwords?',
             'Passwords are generated using the browser\'s built-in cryptographic random number generator (crypto.getRandomValues), making them cryptographically secure.'),
            ('Can I generate multiple passwords at once?',
             'Yes. You can generate up to 20 passwords at once.'),
            ('Are generated passwords sent to a server?',
             'No. All password generation happens locally in your browser. Nothing is ever transmitted.'),
        ],
        'h1': 'Password Generator',
        'tool_desc': 'Generate cryptographically strong random passwords with custom length and character options. Real-time strength feedback. All in your browser.',
        'breadcrumb': 'Password Generator',
        'cross_banner_text': 'Need to generate UUIDs for your project?',
        'cross_banner_link_text': '🆔 UUID Generator →',
        'cross_banner_href': 'uuid-generator.html',
    },
    'json-formatter.html': {
        'title': 'JSON Formatter & Validator – Beautify, Minify & Sort JSON Free Online | WooaDev',
        'desc':  'Format JSON with indentation, minify, or sort keys alphabetically for free. Instant syntax validation highlights errors. Runs entirely in your browser — no server upload.',
        'kw':    'JSON formatter, JSON validator, JSON beautifier, JSON minify, JSON sort keys, online JSON formatter, JSON lint, JSON pretty print, free JSON formatter, JSON beautify online',
        'og_title': 'JSON Formatter & Validator – Free Online | WooaDev',
        'og_desc':  'Beautify, minify, sort JSON keys, and validate JSON syntax instantly. Free, browser-based, no server upload.',
        'app_name': 'JSON Formatter',
        'faq': [
            ('What operations does this tool support?',
             'Beautify (pretty-print with indentation), minify (compact single line), sort keys alphabetically, and validate JSON syntax.'),
            ('Can I validate JSON syntax errors?',
             'Yes. Any JSON syntax error is immediately highlighted with the line and error message.'),
            ('Is my JSON data sent to a server?',
             'No. All processing happens locally in your browser. Your data is never uploaded anywhere.'),
        ],
        'h1': 'JSON Formatter / Validator',
        'tool_desc': 'Paste JSON to beautify, minify, or sort keys. Syntax errors are highlighted instantly. All processing happens in your browser.',
        'breadcrumb': 'JSON Formatter',
        'cross_banner_text': 'Need to convert JSON to YAML?',
        'cross_banner_link_text': '🔄 JSON ↔ YAML Converter →',
        'cross_banner_href': 'json-yaml.html',
    },
    'json-yaml.html': {
        'title': 'JSON YAML Converter – Convert JSON to YAML and YAML to JSON Free Online | WooaDev',
        'desc':  'Convert JSON to YAML or YAML to JSON for free. Supports custom indentation settings. Runs instantly in your browser — no server upload.',
        'kw':    'JSON to YAML, YAML to JSON, JSON YAML converter, online JSON YAML, JSON YAML transform, free YAML converter, YAML JSON online, JSON YAML tool',
        'og_title': 'JSON ↔ YAML Converter – Free Online | WooaDev',
        'og_desc':  'Convert JSON to YAML and YAML to JSON instantly. Custom indentation, browser-based, no server upload.',
        'app_name': 'JSON ↔ YAML Converter',
        'faq': [
            ('Can I convert both ways?',
             'Yes. You can convert JSON to YAML or YAML to JSON in both directions.'),
            ('Is YAML indentation customizable?',
             'Yes. You can set the indentation level for YAML output.'),
            ('Is my data sent to a server?',
             'No. All conversion happens locally in your browser. Your data is never uploaded.'),
        ],
        'h1': 'JSON ↔ YAML Converter',
        'tool_desc': 'Convert between JSON and YAML formats instantly. Supports custom indentation. All processing runs in your browser.',
        'breadcrumb': 'JSON ↔ YAML',
        'cross_banner_text': 'Need to format or validate JSON?',
        'cross_banner_link_text': '📋 JSON Formatter →',
        'cross_banner_href': 'json-formatter.html',
    },
    'regex-tester.html': {
        'title': 'Regex Tester – Real-time Regular Expression Testing & Match Highlight Free | WooaDev',
        'desc':  'Test regular expressions with real-time match highlighting. Supports g, i, m, s flags and group capture results. Free, browser-based, no server upload.',
        'kw':    'regex tester, regular expression tester, RegExp, online regex, regex test, regex match, regex highlight, regex tool, free regex tester, JavaScript regex',
        'og_title': 'Regex Tester – Real-time Match Highlight Free | WooaDev',
        'og_desc':  'Test regex patterns with real-time match highlighting. Flag and group capture support. Free, browser-based.',
        'app_name': 'Regex Tester',
        'faq': [
            ('What regex flags are supported?',
             'g (global), i (case-insensitive), m (multiline), and s (dotAll) flags are all supported.'),
            ('Can I see captured groups?',
             'Yes. Captured group results are displayed below the match list.'),
            ('Is this tool free?',
             'Yes, completely free. No signup or installation required.'),
        ],
        'h1': 'Regex Tester',
        'tool_desc': 'Enter a regex pattern and test string to see matches highlighted in real time. Supports flags and group captures. All in your browser.',
        'breadcrumb': 'Regex Tester',
        'cross_banner_text': 'Need to compare two text blocks?',
        'cross_banner_link_text': '📊 Diff Viewer →',
        'cross_banner_href': 'diff-viewer.html',
    },
    'diff-viewer.html': {
        'title': 'Diff Viewer – Compare Two Texts Line by Line, Highlight Additions & Deletions Free | WooaDev',
        'desc':  'Compare two text blocks line by line and highlight additions in green and deletions in red. Useful for code review and document comparison. Free, browser-based.',
        'kw':    'diff viewer, text diff, compare text, line diff, text comparison, code diff, diff tool online, online diff checker, free diff viewer, text compare tool',
        'og_title': 'Diff Viewer – Line-by-Line Text Comparison Free | WooaDev',
        'og_desc':  'Compare two texts line by line with color-coded additions and deletions. Free, browser-based, no server upload.',
        'app_name': 'Diff Viewer',
        'faq': [
            ('How does the diff comparison work?',
             'The tool compares two text blocks line by line, displaying added lines in green and removed lines in red.'),
            ('Can I compare code files?',
             'Yes. Paste any text or code into both panels to compare them.'),
            ('Is my text sent to a server?',
             'No. All comparison happens locally in your browser. Your data is never uploaded.'),
        ],
        'h1': 'Diff Viewer',
        'tool_desc': 'Paste two texts to compare them line by line. Added lines are green, removed lines are red. All processing runs in your browser.',
        'breadcrumb': 'Diff Viewer',
        'cross_banner_text': 'Need to test a regex pattern?',
        'cross_banner_link_text': '🔍 Regex Tester →',
        'cross_banner_href': 'regex-tester.html',
    },
    'uuid-generator.html': {
        'title': 'UUID Generator – Generate UUID v4 in Bulk Free Online | WooaDev',
        'desc':  'Generate a single or up to 100 UUID v4 values in bulk. Options for hyphen inclusion, uppercase/lowercase. Runs in your browser — no server upload.',
        'kw':    'UUID generator, UUID v4, generate UUID, bulk UUID, random UUID, GUID generator, UUID online, free UUID generator, UUID tool, UUID v4 generator',
        'og_title': 'UUID Generator – Bulk UUID v4 Free Online | WooaDev',
        'og_desc':  'Generate single or bulk UUID v4 values with hyphen and case options. Free, browser-based.',
        'app_name': 'UUID Generator',
        'faq': [
            ('What version of UUID does this generate?',
             'This tool generates UUID version 4 (v4), which is randomly generated and the most commonly used format.'),
            ('Can I generate multiple UUIDs at once?',
             'Yes. You can generate up to 100 UUIDs in a single batch.'),
            ('Are generated UUIDs truly unique?',
             'UUID v4 uses cryptographically random numbers, making the probability of collision astronomically low.'),
        ],
        'h1': 'UUID Generator',
        'tool_desc': 'Generate single or bulk UUID v4 values. Choose hyphen style and letter case. All generation happens in your browser.',
        'breadcrumb': 'UUID Generator',
        'cross_banner_text': 'Need to generate a secure password?',
        'cross_banner_link_text': '🔒 Password Generator →',
        'cross_banner_href': 'password-generator.html',
    },
    'lorem-ipsum.html': {
        'title': 'Lorem Ipsum Generator – Dummy Text by Paragraphs, Sentences & Words Free | WooaDev',
        'desc':  'Generate Lorem Ipsum dummy text by paragraph, sentence, or word count for free. Essential for UI development and design mockups. Runs in your browser instantly.',
        'kw':    'Lorem Ipsum generator, dummy text, placeholder text, Lorem Ipsum online, random text generator, Lorem Ipsum paragraphs, UI dummy text, free Lorem Ipsum',
        'og_title': 'Lorem Ipsum Generator – Dummy Text Free Online | WooaDev',
        'og_desc':  'Generate Lorem Ipsum placeholder text by paragraphs, sentences, or words. Free, instant, browser-based.',
        'app_name': 'Lorem Ipsum Generator',
        'faq': [
            ('Can I control the amount of text generated?',
             'Yes. You can specify the number of paragraphs, sentences, or words to generate.'),
            ('Is classic Lorem Ipsum text supported?',
             'Yes. The standard Lorem Ipsum text starting with "Lorem ipsum dolor sit amet..." is used by default.'),
            ('Can I copy the generated text easily?',
             'Yes. A one-click copy button is provided for quick copying.'),
        ],
        'h1': 'Lorem Ipsum Generator',
        'tool_desc': 'Generate Lorem Ipsum placeholder text by number of paragraphs, sentences, or words. Copy with one click. All runs in your browser.',
        'breadcrumb': 'Lorem Ipsum',
        'cross_banner_text': 'Need to convert text case styles?',
        'cross_banner_link_text': '🔠 Case Converter →',
        'cross_banner_href': 'case-converter.html',
    },
    'cron-generator.html': {
        'title': 'Cron Expression Generator – Visual Cron Builder & English Description Free | WooaDev',
        'desc':  'Build cron expressions visually or parse existing cron expressions into plain English. Preview the next 5 execution times. Supports every minute, hourly, daily, weekly, monthly schedules.',
        'kw':    'cron generator, cron expression, cron builder, cron parser, cron online, cron schedule, cron job, cron syntax, free cron generator, cron expression tool',
        'og_title': 'Cron Expression Generator – Free Visual Builder | WooaDev',
        'og_desc':  'Build cron expressions visually or parse existing ones. Preview next 5 runs. Free, browser-based.',
        'app_name': 'Cron Expression Generator',
        'faq': [
            ('What is a cron expression?',
             'A cron expression is a string of 5 or 6 fields that defines a scheduled time interval for automated tasks, such as "0 9 * * 1" meaning "every Monday at 9:00 AM".'),
            ('Can I see the next scheduled run times?',
             'Yes. The tool shows the next 5 scheduled execution times for any cron expression.'),
            ('Does it support all standard cron fields?',
             'Yes. The tool supports minute, hour, day of month, month, and day of week fields.'),
        ],
        'h1': 'Cron Expression Generator',
        'tool_desc': 'Build cron expressions visually or parse an existing expression into plain English. See the next 5 run times. All in your browser.',
        'breadcrumb': 'Cron Generator',
        'cross_banner_text': 'Need to convert Unix timestamps?',
        'cross_banner_link_text': '🕐 Timestamp Converter →',
        'cross_banner_href': 'timestamp.html',
    },
    'case-converter.html': {
        'title': 'Case Converter – camelCase snake_case PascalCase kebab-case Instant Converter Free | WooaDev',
        'desc':  'Convert text between camelCase, PascalCase, snake_case, kebab-case, UPPER_SNAKE, and Title Case instantly. Perfect for normalizing variable and function naming conventions.',
        'kw':    'case converter, camelCase, snake_case, PascalCase, kebab-case, UPPER_SNAKE, Title Case, text case converter, naming convention, free case converter',
        'og_title': 'Case Converter – camelCase snake_case kebab-case Free | WooaDev',
        'og_desc':  'Convert text between camelCase, snake_case, PascalCase, kebab-case and more. Instant, free, browser-based.',
        'app_name': 'Case Converter',
        'faq': [
            ('What case formats are supported?',
             'camelCase, PascalCase, snake_case, kebab-case, UPPER_SNAKE_CASE, and Title Case are all supported.'),
            ('Can I convert multiple words at once?',
             'Yes. Paste any multi-word text and all formats are generated simultaneously.'),
            ('Is the conversion instant?',
             'Yes. Results are generated immediately as you type — no button press needed.'),
        ],
        'h1': 'Case Converter',
        'tool_desc': 'Enter text to convert it to camelCase, PascalCase, snake_case, kebab-case, UPPER_SNAKE, and Title Case simultaneously. Instant results in your browser.',
        'breadcrumb': 'Case Converter',
        'cross_banner_text': 'Need Lorem Ipsum dummy text for testing?',
        'cross_banner_link_text': '📝 Lorem Ipsum Generator →',
        'cross_banner_href': 'lorem-ipsum.html',
    },
    'number-base.html': {
        'title': 'Number Base Converter – Binary Octal Decimal Hex Instant Conversion Free | WooaDev',
        'desc':  'Convert numbers between binary (base 2), octal (base 8), decimal (base 10), and hexadecimal (base 16) instantly. Enter one value and all conversions appear simultaneously.',
        'kw':    'number base converter, binary to decimal, decimal to hex, octal converter, hex converter, binary converter, radix converter, base conversion, free number converter',
        'og_title': 'Number Base Converter – Binary Octal Decimal Hex Free | WooaDev',
        'og_desc':  'Convert between binary, octal, decimal, and hexadecimal instantly. Enter one value, see all results. Free, browser-based.',
        'app_name': 'Number Base Converter',
        'faq': [
            ('What number bases are supported?',
             'Binary (base 2), octal (base 8), decimal (base 10), and hexadecimal (base 16) are all supported.'),
            ('Are negative numbers supported?',
             'Negative decimal numbers are supported and converted to the two\'s complement representation in other bases.'),
            ('Do I need to enter a prefix like 0x?',
             'No. Just enter the number value in each field — no prefix like 0x or 0b is needed.'),
        ],
        'h1': 'Number Base Converter',
        'tool_desc': 'Enter a number in any base (binary, octal, decimal, or hex) and see all conversions instantly. Everything runs in your browser.',
        'breadcrumb': 'Number Base Converter',
        'cross_banner_text': 'Need to convert Unix timestamps?',
        'cross_banner_link_text': '🕐 Timestamp Converter →',
        'cross_banner_href': 'timestamp.html',
    },
    'timestamp.html': {
        'title': 'Timestamp Converter – Unix Epoch to Date Time & Date to Timestamp Free | WooaDev',
        'desc':  'Convert Unix timestamps (epoch) to human-readable date/time and vice versa. Real-time current time display, millisecond support. Free, browser-based.',
        'kw':    'timestamp converter, Unix timestamp, epoch converter, Unix epoch to date, date to timestamp, epoch time, millisecond timestamp, online timestamp converter, free timestamp tool',
        'og_title': 'Timestamp Converter – Unix Epoch ↔ Date Time Free | WooaDev',
        'og_desc':  'Convert Unix timestamps to date/time and dates to timestamps. Real-time clock, millisecond support. Free, browser-based.',
        'app_name': 'Timestamp Converter',
        'faq': [
            ('What is a Unix timestamp?',
             'A Unix timestamp (epoch time) is the number of seconds (or milliseconds) elapsed since January 1, 1970 00:00:00 UTC. It is widely used in programming to represent points in time.'),
            ('Does this tool support millisecond timestamps?',
             'Yes. Both second-precision and millisecond-precision Unix timestamps are supported.'),
            ('Can I convert a specific date to a timestamp?',
             'Yes. Enter any date and time and it will be instantly converted to the corresponding Unix timestamp.'),
        ],
        'h1': 'Timestamp Converter',
        'tool_desc': 'Convert Unix timestamps to readable date/time or convert a date back to a Unix timestamp. Millisecond support included. All runs in your browser.',
        'breadcrumb': 'Timestamp Converter',
        'cross_banner_text': 'Need to generate cron schedules?',
        'cross_banner_link_text': '⏰ Cron Generator →',
        'cross_banner_href': 'cron-generator.html',
    },
    'css-units.html': {
        'title': 'CSS Unit Converter – px rem em pt vw % Instant Conversion Free | WooaDev',
        'desc':  'Convert CSS units including px, rem, em, pt, vw, and % instantly. Set a base font size and viewport width to get accurate conversions. Essential for responsive web development.',
        'kw':    'CSS unit converter, px to rem, rem to px, em to px, CSS units, px rem em converter, CSS unit calculator, free CSS converter, responsive design tool',
        'og_title': 'CSS Unit Converter – px rem em pt vw % Free | WooaDev',
        'og_desc':  'Convert CSS units (px, rem, em, pt, vw, %) with custom base font size and viewport. Free, instant, browser-based.',
        'app_name': 'CSS Unit Converter',
        'faq': [
            ('What CSS units are supported?',
             'px, rem, em, pt, vw, and % are all supported for conversion.'),
            ('Can I set a custom base font size?',
             'Yes. You can configure the base font size (default 16px) and viewport width for accurate em/rem/vw calculations.'),
            ('Why do rem and em give different results?',
             'rem is relative to the root element font size, while em is relative to the current element\'s font size. They produce different results when nested elements have different font sizes.'),
        ],
        'h1': 'CSS Unit Converter',
        'tool_desc': 'Enter a value in any CSS unit and see all equivalent values instantly. Configure base font size and viewport width for accurate results.',
        'breadcrumb': 'CSS Unit Converter',
        'cross_banner_text': 'Need to minify or beautify your CSS code?',
        'cross_banner_link_text': '🗜️ CSS/JS/HTML Minifier →',
        'cross_banner_href': 'minifier.html',
    },
    'minifier.html': {
        'title': 'CSS JS HTML Minifier & Formatter – Minify and Beautify Code Free Online | WooaDev',
        'desc':  'Minify CSS, JavaScript, and HTML to reduce file size, or beautify/format code for readability. Shows before/after size comparison. Free, browser-based, no server upload.',
        'kw':    'CSS minifier, JS minifier, HTML minifier, code minify, code beautify, CSS compress, JavaScript compress, HTML beautify, online minifier, free code minifier',
        'og_title': 'CSS JS HTML Minifier & Formatter – Free Online | WooaDev',
        'og_desc':  'Minify or beautify CSS, JavaScript, and HTML code. See file size reduction instantly. Free, browser-based.',
        'app_name': 'CSS / JS / HTML Minifier',
        'faq': [
            ('What languages are supported?',
             'CSS, JavaScript, and HTML are all supported for both minification and beautification.'),
            ('How much file size reduction can I expect?',
             'Results vary by code, but CSS/JS files typically see 20–60% size reduction after minification.'),
            ('Is my code sent to a server?',
             'No. All minification and formatting happens locally in your browser. Your code is never uploaded.'),
        ],
        'h1': 'CSS / JS / HTML Minifier & Formatter',
        'tool_desc': 'Paste CSS, JavaScript, or HTML code to minify (compress) or beautify (format). File size comparison is shown. All runs in your browser.',
        'breadcrumb': 'Minifier / Formatter',
        'cross_banner_text': 'Need to convert CSS units?',
        'cross_banner_link_text': '📐 CSS Unit Converter →',
        'cross_banner_href': 'css-units.html',
    },
    'sql-formatter.html': {
        'title': 'SQL Formatter – Format, Beautify & Minify SQL Queries Free Online | WooaDev',
        'desc':  'Format and beautify SQL queries with proper indentation, or minify them to a single line. Auto-uppercase for SELECT, FROM, WHERE, JOIN keywords. Supports MySQL, PostgreSQL, SQLite.',
        'kw':    'SQL formatter, SQL beautifier, SQL minifier, SQL pretty print, format SQL, SQL query formatter, online SQL formatter, free SQL formatter, SQL indent, SQL keyword uppercase',
        'og_title': 'SQL Formatter – Beautify & Minify SQL Free Online | WooaDev',
        'og_desc':  'Format SQL with proper indentation and keyword uppercase, or minify to one line. MySQL, PostgreSQL, SQLite supported. Free, browser-based.',
        'app_name': 'SQL Formatter',
        'faq': [
            ('What SQL dialects are supported?',
             'MySQL, PostgreSQL, and SQLite syntax are all supported for formatting.'),
            ('Does it automatically uppercase SQL keywords?',
             'Yes. Keywords like SELECT, FROM, WHERE, JOIN, and others are automatically converted to uppercase.'),
            ('Is my SQL code sent to a server?',
             'No. All formatting happens locally in your browser. Your code is never uploaded.'),
        ],
        'h1': 'SQL Formatter',
        'tool_desc': 'Paste SQL to beautify with indentation and keyword uppercase, or minify to a single line. Supports MySQL, PostgreSQL, SQLite. All in your browser.',
        'breadcrumb': 'SQL Formatter',
        'cross_banner_text': 'Need to format JSON data?',
        'cross_banner_link_text': '📋 JSON Formatter →',
        'cross_banner_href': 'json-formatter.html',
    },
    'chmod.html': {
        'title': 'Chmod Calculator – Linux File Permission Octal & Symbolic Converter Free | WooaDev',
        'desc':  'Calculate Linux chmod file permissions visually with checkboxes. Instantly convert between octal (755, 644, 777) and symbolic notation (-rwxr-xr-x). Owner, group, and others supported.',
        'kw':    'chmod calculator, chmod permission, Linux file permission, chmod 755, chmod 644, chmod 777, octal permission, symbolic permission, chmod online, free chmod calculator',
        'og_title': 'Chmod Calculator – Linux File Permission Free Online | WooaDev',
        'og_desc':  'Set Linux file permissions visually and convert between octal and symbolic notation. Free, browser-based.',
        'app_name': 'Chmod Calculator',
        'faq': [
            ('What is chmod?',
             'chmod (change mode) is a Linux/Unix command that sets the read, write, and execute permissions for files and directories for the owner, group, and others.'),
            ('What do the common permission values mean?',
             '755 = owner has full access; group and others can read/execute. 644 = owner can read/write; group and others can only read. 777 = everyone has full access (use with caution).'),
            ('Can I convert between octal and symbolic notation?',
             'Yes. Enter an octal value like 755 and see the symbolic notation (-rwxr-xr-x) instantly, or use the checkboxes to generate both.'),
        ],
        'h1': 'Chmod Calculator',
        'tool_desc': 'Set Linux file permissions visually using checkboxes. See both octal (755) and symbolic (-rwxr-xr-x) notation instantly. All in your browser.',
        'breadcrumb': 'Chmod Calculator',
        'cross_banner_text': 'Need to test a regex pattern on Linux paths?',
        'cross_banner_link_text': '🔍 Regex Tester →',
        'cross_banner_href': 'regex-tester.html',
    },
    'http-status.html': {
        'title': 'HTTP Status Codes Reference – 1xx 2xx 3xx 4xx 5xx Full List with Search | WooaDev',
        'desc':  'Look up all HTTP status codes from 1xx to 5xx with plain-English descriptions. Quickly search by code number. Essential reference for REST API developers. Free, instant.',
        'kw':    'HTTP status codes, HTTP 200, HTTP 404, HTTP 500, HTTP 301, status code reference, REST API status codes, HTTP status list, HTTP error codes, 4xx 5xx codes',
        'og_title': 'HTTP Status Codes Reference – Full 1xx–5xx List | WooaDev',
        'og_desc':  'Full HTTP status code reference from 1xx to 5xx with plain-English descriptions and instant search. Free, always available.',
        'app_name': 'HTTP Status Code Reference',
        'faq': [
            ('What status code ranges are covered?',
             '1xx (Informational), 2xx (Success), 3xx (Redirection), 4xx (Client Error), and 5xx (Server Error) are all covered.'),
            ('Can I search by status code number?',
             'Yes. Type any status code number in the search box to instantly filter the results.'),
            ('What is the difference between 4xx and 5xx errors?',
             '4xx errors indicate a client-side problem (e.g., 404 Not Found, 401 Unauthorized), while 5xx errors indicate a server-side problem (e.g., 500 Internal Server Error).'),
        ],
        'h1': 'HTTP Status Code Reference',
        'tool_desc': 'Search and browse all HTTP status codes from 1xx to 5xx with clear descriptions. Essential reference for web and API developers.',
        'breadcrumb': 'HTTP Status Codes',
        'cross_banner_text': 'Need to test an API endpoint with regex?',
        'cross_banner_link_text': '🔍 Regex Tester →',
        'cross_banner_href': 'regex-tester.html',
    },
    'password-generator.html': {
        'title': 'Password Generator – Secure Random Password with Strength Checker Free | WooaDev',
        'desc':  'Generate strong random passwords with custom length, uppercase, lowercase, numbers, and special characters. Real-time strength indicator. Runs in your browser — no server upload.',
        'kw':    'password generator, random password, secure password, strong password generator, free password generator, online password generator, password strength checker, random password tool',
        'og_title': 'Password Generator – Secure Random Passwords Free | WooaDev',
        'og_desc':  'Generate strong random passwords with custom options and real-time strength indicator. Free, browser-based, no signup.',
        'app_name': 'Password Generator',
        'faq': [
            ('How secure are the generated passwords?',
             'Passwords are generated using the browser\'s built-in cryptographic random number generator (crypto.getRandomValues), making them cryptographically secure.'),
            ('Can I generate multiple passwords at once?',
             'Yes. You can generate up to 20 passwords at once.'),
            ('Are generated passwords sent to a server?',
             'No. All password generation happens locally in your browser. Nothing is ever transmitted.'),
        ],
        'h1': 'Password Generator',
        'tool_desc': 'Generate cryptographically strong random passwords with custom length and character options. Real-time strength feedback. All in your browser.',
        'breadcrumb': 'Password Generator',
        'cross_banner_text': 'Need to generate UUIDs for your project?',
        'cross_banner_link_text': '🆔 UUID Generator →',
        'cross_banner_href': 'uuid-generator.html',
    },
}

# ── 2. 공통 치환 (한 → 영) ────────────────────────────────────────────────────
COMMON = [
    # lang attribute
    ('<html lang="ko">', '<html lang="en">'),
    # locale
    ('content="ko_KR"', 'content="en_US"'),
    # canonical / og:url 처리는 build_page에서
    # nav
    ('>전체 도구 ›<', '>All Tools ›<'),
    # breadcrumb home
    ('>WooaDev<', '>WooaDev<'),  # kept same (brand name)
    # header-right about
    ('>소개<', '>About<'),
    ('href="about.html"', 'href="../about.html"'),
    ('href="privacy.html"', 'href="../privacy.html"'),
    # pwa install button
    ('>📌 홈 화면에 추가<', '>📌 Add to Home Screen<'),
    # our-sites-bar active link: WooaDev → en/
    ('href="https://wooadev.wooahouse.com/" target="_blank" rel="noopener" class="active"',
     'href="https://wooadev.wooahouse.com/en/" target="_blank" rel="noopener" class="active"'),
    # CSS/manifest path adjustment
    ('href="css/style.css"', 'href="../css/style.css"'),
    ('href="/manifest.json"', 'href="../manifest.json"'),
    # sw.js if present
    ('"src": "sw.js"', '"src": "../sw.js"'),
    # pwa-install.js
    ('src="js/pwa-install.js"', 'src="../js/pwa-install.js"'),

    # ── index page specific ──
    # hero
    ('<h1>개발자 도구 모음</h1>', '<h1>Developer Tools Collection</h1>'),
    ('15가지 유틸리티', '20+ utilities'),
    ('설치 없이 바로 사용하세요', 'ready to use — no install needed'),
    ('파일 뷰어가 필요하다면?', 'Need a file viewer?'),
    ('WooaViewer 무료 뷰어 보기 →', 'WooaViewer Free Viewer →'),
    # category titles
    ('<span class="category-title">인코딩 · 디코딩</span>', '<span class="category-title">Encoding · Decoding</span>'),
    ('<p class="category-desc">데이터를 다양한 형식으로 변환</p>', '<p class="category-desc">Transform data between various formats</p>'),
    ('<span class="category-title">해시 · 보안</span>', '<span class="category-title">Hash · Security</span>'),
    ('<p class="category-desc">암호화 해시 생성 및 토큰 분석</p>', '<p class="category-desc">Generate cryptographic hashes and analyze tokens</p>'),
    ('<span class="category-title">포맷 · 변환</span>', '<span class="category-title">Format · Convert</span>'),
    ('<p class="category-desc">데이터 포맷 정리 및 형식 변환</p>', '<p class="category-desc">Organize and convert data formats</p>'),
    ('<span class="category-title">생성기</span>', '<span class="category-title">Generators</span>'),
    ('<p class="category-desc">개발·테스트용 데이터 빠르게 생성</p>', '<p class="category-desc">Generate test and development data fast</p>'),
    ('<span class="category-title">텍스트 · 코드 분석</span>', '<span class="category-title">Text · Code Analysis</span>'),
    ('<p class="category-desc">패턴 매칭과 텍스트 변환</p>', '<p class="category-desc">Pattern matching and text transformation</p>'),
    ('<span class="category-title">숫자 · 시간</span>', '<span class="category-title">Numbers · Time</span>'),
    ('<p class="category-desc">진법 변환과 시간 포맷 처리</p>', '<p class="category-desc">Number base conversion and time format handling</p>'),
    # tool cards - names and descs
    ('<div class="tool-name">Base64</div>', '<div class="tool-name">Base64</div>'),
    ('<div class="tool-desc">텍스트 · 파일을 Base64로 인코딩/디코딩</div>', '<div class="tool-desc">Encode/decode text & files to Base64</div>'),
    ('<div class="tool-name">URL 인코더</div>', '<div class="tool-name">URL Encoder</div>'),
    ('<div class="tool-desc">URL 인코딩/디코딩 · 쿼리스트링 파싱</div>', '<div class="tool-desc">URL encode/decode & query string parsing</div>'),
    ('<div class="tool-name">Hash 생성기</div>', '<div class="tool-name">Hash Generator</div>'),
    ('<div class="tool-desc">MD5 · SHA-1 · SHA-256 · SHA-512 해시 생성</div>', '<div class="tool-desc">Generate MD5 · SHA-1 · SHA-256 · SHA-512 hashes</div>'),
    ('<div class="tool-name">JWT 디코더</div>', '<div class="tool-name">JWT Decoder</div>'),
    ('<div class="tool-desc">JWT 토큰 헤더 · 페이로드 디코드</div>', '<div class="tool-desc">Decode JWT token header & payload</div>'),
    ('<div class="tool-name">비밀번호 생성기</div>', '<div class="tool-name">Password Generator</div>'),
    ('<div class="tool-desc">안전한 랜덤 비밀번호 생성</div>', '<div class="tool-desc">Generate secure random passwords</div>'),
    ('<div class="tool-name">JSON 포맷터</div>', '<div class="tool-name">JSON Formatter</div>'),
    ('<div class="tool-desc">JSON 들여쓰기 · 압축 · 유효성 검사</div>', '<div class="tool-desc">Beautify, minify & validate JSON</div>'),
    ('<div class="tool-name">JSON ↔ YAML</div>', '<div class="tool-name">JSON ↔ YAML</div>'),
    ('<div class="tool-desc">JSON과 YAML 포맷 상호 변환</div>', '<div class="tool-desc">Convert between JSON and YAML formats</div>'),
    ('<div class="tool-name">Diff 비교기</div>', '<div class="tool-name">Diff Viewer</div>'),
    ('<div class="tool-desc">두 텍스트의 차이점 라인별 표시</div>', '<div class="tool-desc">Compare two texts line by line</div>'),
    ('<div class="tool-name">UUID 생성기</div>', '<div class="tool-name">UUID Generator</div>'),
    ('<div class="tool-desc">UUID v4 단건 · 대량 생성</div>', '<div class="tool-desc">Generate single or bulk UUID v4 values</div>'),
    ('<div class="tool-name">Lorem Ipsum</div>', '<div class="tool-name">Lorem Ipsum</div>'),
    ('<div class="tool-desc">단락 · 단어 수 지정 더미 텍스트 생성</div>', '<div class="tool-desc">Generate dummy text by paragraph or word count</div>'),
    ('<div class="tool-name">Cron 생성기</div>', '<div class="tool-name">Cron Generator</div>'),
    ('<div class="tool-desc">Cron 표현식 시각적 생성 · 해석</div>', '<div class="tool-desc">Build and parse cron expressions visually</div>'),
    ('<div class="tool-name">Regex 테스터</div>', '<div class="tool-name">Regex Tester</div>'),
    ('<div class="tool-desc">정규표현식 실시간 매칭 · 하이라이트</div>', '<div class="tool-desc">Real-time regex match highlighting</div>'),
    ('<div class="tool-name">케이스 변환기</div>', '<div class="tool-name">Case Converter</div>'),
    ('<div class="tool-desc">camelCase · snake_case · kebab-case 변환</div>', '<div class="tool-desc">Convert between camelCase, snake_case, kebab-case</div>'),
    ('<div class="tool-name">진법 변환기</div>', '<div class="tool-name">Number Base Converter</div>'),
    ('<div class="tool-desc">2진수 · 8진수 · 10진수 · 16진수 변환</div>', '<div class="tool-desc">Convert between binary, octal, decimal, and hex</div>'),
    ('<div class="tool-name">타임스탬프 변환</div>', '<div class="tool-name">Timestamp Converter</div>'),
    ('<div class="tool-desc">Unix timestamp ↔ 날짜·시간 변환</div>', '<div class="tool-desc">Unix timestamp ↔ date/time conversion</div>'),
    # free/new badges
    ('<span class="free-badge">무료</span>', '<span class="free-badge">Free</span>'),
    # features section
    ('<div class="feature-title">완전 로컬 처리</div>', '<div class="feature-title">Fully Local Processing</div>'),
    ('<div class="feature-desc">모든 연산이 브라우저 안에서만 이루어집니다. 데이터가 서버로 전송되지 않아 안전합니다.</div>',
     '<div class="feature-desc">All operations run inside your browser. Your data is never sent to any server.</div>'),
    ('<div class="feature-title">즉시 실행</div>', '<div class="feature-title">Instant Access</div>'),
    ('<div class="feature-desc">설치나 회원가입 없이 바로 사용할 수 있습니다.</div>',
     '<div class="feature-desc">No install or sign-up required. Start immediately.</div>'),
    ('<div class="feature-title">완전 무료</div>', '<div class="feature-title">Completely Free</div>'),
    ('<div class="feature-desc">15가지 도구 모두 광고 없이 무료로 제공합니다.</div>',
     '<div class="feature-desc">All 20+ tools are provided completely free of charge.</div>'),
    ('<div class="feature-title">모든 기기 지원</div>', '<div class="feature-title">All Devices</div>'),
    ('<div class="feature-desc">PC, 태블릿, 스마트폰 어디서나 사용 가능합니다.</div>',
     '<div class="feature-desc">Works on PC, tablet, and smartphone anywhere.</div>'),
    # footer - index
    ('<p>개발자가 자주 쓰는 유틸리티를 설치 없이 브라우저에서 무료로 사용하세요.</p>',
     '<p>Essential developer utilities, free in your browser — no install needed.</p>'),
    ('<h4>인코딩 · 해시</h4>', '<h4>Encoding · Hash</h4>'),
    ('<h4>포맷 · 변환</h4>', '<h4>Format · Convert</h4>'),
    ('<h4>생성기 · 변환</h4>', '<h4>Generators</h4>'),
    ('<h4>WooaHouse 서비스</h4>', '<h4>WooaHouse Services</h4>'),
    # footer links - Korean tool names
    ('>URL 인코더<', '>URL Encoder<'),
    ('>Hash 생성기<', '>Hash Generator<'),
    ('>JWT 디코더<', '>JWT Decoder<'),
    ('>비밀번호 생성기<', '>Password Generator<'),
    ('>JSON 포맷터<', '>JSON Formatter<'),
    ('>JSON↔YAML<', '>JSON↔YAML<'),
    ('>Diff 비교기<', '>Diff Viewer<'),
    ('>Regex 테스터<', '>Regex Tester<'),
    ('>케이스 변환기<', '>Case Converter<'),
    ('>UUID 생성기<', '>UUID Generator<'),
    ('>Lorem Ipsum<', '>Lorem Ipsum<'),
    ('>Cron 생성기<', '>Cron Generator<'),
    ('>진법 변환기<', '>Number Base Converter<'),
    ('>타임스탬프<', '>Timestamp<'),
    # footer bottom
    ('© 2026 WooaDev. 모든 권리 보유.', '© 2026 WooaDev. All rights reserved.'),
    ('>개인정보처리방침<', '>Privacy Policy<'),

    # ── tool pages - breadcrumb/header common ──
    ('<span>Base64 인코더/디코더</span>', '<span>Base64 Encoder/Decoder</span>'),
    ('<span>Hash 생성기</span>', '<span>Hash Generator</span>'),
    ('<span>JWT 디코더</span>', '<span>JWT Decoder</span>'),
    ('<span>Regex 테스터</span>', '<span>Regex Tester</span>'),
    ('<span>JSON 포맷터</span>', '<span>JSON Formatter</span>'),
    ('<span>JSON ↔ YAML</span>', '<span>JSON ↔ YAML</span>'),
    ('<span>Diff 비교기</span>', '<span>Diff Viewer</span>'),
    ('<span>UUID 생성기</span>', '<span>UUID Generator</span>'),
    ('<span>Lorem Ipsum</span>', '<span>Lorem Ipsum</span>'),
    ('<span>Cron 생성기</span>', '<span>Cron Generator</span>'),
    ('<span>케이스 변환기</span>', '<span>Case Converter</span>'),
    ('<span>진법 변환기</span>', '<span>Number Base Converter</span>'),
    ('<span>타임스탬프 변환기</span>', '<span>Timestamp Converter</span>'),
    ('<span>CSS 단위 변환기</span>', '<span>CSS Unit Converter</span>'),
    ('<span>CSS·JS·HTML 압축/포맷터</span>', '<span>CSS/JS/HTML Minifier</span>'),
    ('<span>SQL 포맷터</span>', '<span>SQL Formatter</span>'),
    ('<span>Chmod 계산기</span>', '<span>Chmod Calculator</span>'),
    ('<span>HTTP 상태코드 참조표</span>', '<span>HTTP Status Code Reference</span>'),
    ('<span>비밀번호 생성기</span>', '<span>Password Generator</span>'),
    ('<span>URL 인코더/디코더</span>', '<span>URL Encoder/Decoder</span>'),

    # ── tool page - footer brand desc ──
    ('<p>개발자 도구를 브라우저에서 무료로 사용하세요.</p>',
     '<p>Free developer tools in your browser.</p>'),
    ('<h4>인코딩 · 해시</h4>', '<h4>Encoding · Hash</h4>'),
    ('<h4>포맷 · 생성</h4>', '<h4>Format · Generate</h4>'),

    # ── common UI labels ──
    ('<div class="dev-label">입력</div>', '<div class="dev-label">Input</div>'),
    ('<div class="dev-label">출력</div>', '<div class="dev-label">Output</div>'),
    ('<div class="dev-label">JSON 입력</div>', '<div class="dev-label">JSON Input</div>'),
    ('<div class="dev-label">JSON 출력</div>', '<div class="dev-label">JSON Output</div>'),
    ('<div class="dev-label">입력 텍스트</div>', '<div class="dev-label">Input Text</div>'),
    ('<div class="dev-label">결과</div>', '<div class="dev-label">Result</div>'),
    ('<div class="dev-label">결과 (YAML)</div>', '<div class="dev-label">Result (YAML)</div>'),
    ('<div class="dev-label">결과 (JSON)</div>', '<div class="dev-label">Result (JSON)</div>'),
    ('<div class="dev-label">테스트 문자열</div>', '<div class="dev-label">Test String</div>'),
    ('<div class="dev-label">원문 (A)</div>', '<div class="dev-label">Text A (Original)</div>'),
    ('<div class="dev-label">수정본 (B)</div>', '<div class="dev-label">Text B (Modified)</div>'),
    ('<div class="dev-label">비교 결과</div>', '<div class="dev-label">Diff Result</div>'),
    # buttons
    ('인코딩 →', 'Encode →'),
    ('← 디코딩', '← Decode'),
    ('↕ 교체', '↕ Swap'),
    ('>지우기<', '>Clear<'),
    ('>복사<', '>Copy<'),
    ('>복사됨!<', '>Copied!<'),
    # copy-btn inline
    ('btn.textContent = \'복사됨!\';', 'btn.textContent = \'Copied!\';'),
    ('btn.textContent = \'복사\';', 'btn.textContent = \'Copy\';'),
    # file select
    ('파일 선택', 'Select File'),
    # base64 page specific
    ("placeholder=\"텍스트를 입력하거나 아래에서 파일을 선택하세요...\"",
     "placeholder=\"Enter text or select a file below...\""),
    # hash page
    ("placeholder=\"해시를 생성할 텍스트를 입력하세요...\"",
     "placeholder=\"Enter text to generate hash...\""),
    ('파일 해시', 'File Hash'),
    ('>파일 선택<', '>Select File<'),
    # JWT page
    ("placeholder=\"JWT 토큰을 붙여넣으세요...\"",
     "placeholder=\"Paste your JWT token here...\""),
    ('JWT 디코더', 'JWT Decoder'),
    ('유효한 JWT 토큰이 아닙니다.', 'Invalid JWT token.'),
    ('만료됨', 'Expired'),
    ('유효', 'Valid'),
    ('만료 정보 없음', 'No expiry info'),
    ('만료 시각:', 'Expires:'),
    ('Header', 'Header'),
    ('Payload', 'Payload'),
    ('Signature', 'Signature'),
    # regex page
    ("placeholder=\"정규표현식 패턴 입력...\"", "placeholder=\"Enter regex pattern...\""),
    ("placeholder=\"테스트할 문자열을 입력하세요...\"", "placeholder=\"Enter test string...\""),
    ('일치 없음', 'No matches'),
    ('매치 없음', 'No matches'),
    # json formatter
    ("placeholder=\"JSON을 여기에 붙여넣으세요...\"",
     "placeholder=\"Paste your JSON here...\""),
    ('>들여쓰기<', '>Beautify<'),
    ('>압축<', '>Minify<'),
    ('>키 정렬<', '>Sort Keys<'),
    ('유효한 JSON입니다.', 'Valid JSON.'),
    ('유효하지 않은 JSON:', 'Invalid JSON:'),
    # json-yaml
    ("placeholder=\"JSON을 입력하세요...\"", "placeholder=\"Enter JSON...\""),
    ("placeholder=\"YAML을 입력하세요...\"", "placeholder=\"Enter YAML...\""),
    ('>JSON → YAML<', '>JSON → YAML<'),
    ('>YAML → JSON<', '>YAML → JSON<'),
    # diff viewer
    ("placeholder=\"원본 텍스트를 입력하세요...\"", "placeholder=\"Enter original text...\""),
    ("placeholder=\"수정된 텍스트를 입력하세요...\"", "placeholder=\"Enter modified text...\""),
    ('>비교하기<', '>Compare<'),
    ('추가된 줄', 'Added lines'),
    ('삭제된 줄', 'Removed lines'),
    ('변경 없음', 'No changes'),
    # uuid
    ("placeholder=\"생성할 UUID 개수 (1~100)\"", "placeholder=\"Number of UUIDs (1–100)\""),
    ('>UUID 생성<', '>Generate UUID<'),
    ('>전체 복사<', '>Copy All<'),
    ('하이픈 포함', 'With hyphens'),
    ('하이픈 제거', 'Without hyphens'),
    ('대문자', 'Uppercase'),
    ('소문자', 'Lowercase'),
    # lorem ipsum
    ('>생성<', '>Generate<'),
    ('단락', 'Paragraphs'),
    ('문장', 'Sentences'),
    ('단어', 'Words'),
    ('단락 수', 'Paragraph count'),
    ('문장 수', 'Sentence count'),
    ('단어 수', 'Word count'),
    # cron
    ("placeholder=\"Cron 표현식 입력 (예: 0 9 * * 1)\"",
     "placeholder=\"Enter cron expression (e.g. 0 9 * * 1)\""),
    ('>해석<', '>Parse<'),
    ('>생성<', '>Generate<'),
    ('다음 실행 시간', 'Next run times'),
    ('매 분', 'Every minute'),
    ('매 시간', 'Every hour'),
    ('매일 자정', 'Every day at midnight'),
    ('매주 월요일', 'Every Monday'),
    ('매월 1일', '1st of every month'),
    # case converter
    ("placeholder=\"변환할 텍스트를 입력하세요...\"",
     "placeholder=\"Enter text to convert...\""),
    # number base
    ('2진수 (Binary)', 'Binary (base 2)'),
    ('8진수 (Octal)', 'Octal (base 8)'),
    ('10진수 (Decimal)', 'Decimal (base 10)'),
    ('16진수 (Hex)', 'Hexadecimal (base 16)'),
    # timestamp
    ('>현재 시각<', '>Current Time<'),
    ('>변환<', '>Convert<'),
    ('타임스탬프 → 날짜', 'Timestamp → Date'),
    ('날짜 → 타임스탬프', 'Date → Timestamp'),
    ('현재 Unix 타임스탬프', 'Current Unix Timestamp'),
    ('밀리초', 'Milliseconds'),
    ('초', 'Seconds'),
    # css units
    ('기준 폰트 크기', 'Base font size'),
    ('뷰포트 너비', 'Viewport width'),
    ('입력값', 'Input value'),
    ('변환 결과', 'Conversion result'),
    # minifier
    ('>CSS 압축<', '>Minify CSS<'),
    ('>CSS 정렬<', '>Beautify CSS<'),
    ('>JS 압축<', '>Minify JS<'),
    ('>JS 정렬<', '>Beautify JS<'),
    ('>HTML 압축<', '>Minify HTML<'),
    ('>HTML 정렬<', '>Beautify HTML<'),
    ('압축률:', 'Reduction:'),
    ('원본 크기:', 'Original size:'),
    ('압축 후:', 'After:'),
    # sql formatter
    ("placeholder=\"SQL 쿼리를 입력하세요...\"",
     "placeholder=\"Enter your SQL query here...\""),
    ('>SQL 포맷<', '>Format SQL<'),
    ('>SQL 압축<', '>Minify SQL<'),
    # chmod
    ('소유자', 'Owner'),
    ('그룹', 'Group'),
    ('기타', 'Others'),
    ('읽기', 'Read'),
    ('쓰기', 'Write'),
    ('실행', 'Execute'),
    ('8진수', 'Octal'),
    ('심볼릭', 'Symbolic'),
    # http status
    ("placeholder=\"상태코드 또는 키워드 검색...\"",
     "placeholder=\"Search by code or keyword...\""),
    ('정보 (1xx)', 'Informational (1xx)'),
    ('성공 (2xx)', 'Success (2xx)'),
    ('리다이렉션 (3xx)', 'Redirection (3xx)'),
    ('클라이언트 오류 (4xx)', 'Client Error (4xx)'),
    ('서버 오류 (5xx)', 'Server Error (5xx)'),

    # ── FAQ section heading ──
    ('>자주 묻는 질문<', '>Frequently Asked Questions<'),
    # general JS messages
    ('복사됨!', 'Copied!'),
    ('복사 실패', 'Copy failed'),
    ("'클립보드 복사를 지원하지 않는 브라우저입니다.'",
     "'Your browser does not support clipboard copy.'"),
    # error messages
    ("'유효하지 않은 Base64 문자열입니다.'", "'Invalid Base64 string.'"),
    ("'인코딩 실패: '", "'Encoding failed: '"),
    ("'디코딩 실패: 유효한 Base64 문자열이 아닙니다.'",
     "'Decoding failed: Not a valid Base64 string.'"),
]

# ── 3. 언어 선택기 CSS ─────────────────────────────────────────────────────────
LANG_SWITCHER_CSS = """    .lang-switcher { display:flex; align-items:center; gap:4px; }
    .lang-switcher a { color:rgba(255,255,255,0.7); text-decoration:none; font-size:0.8rem; font-weight:600; padding:3px 8px; border-radius:12px; transition:background 0.15s; }
    .lang-switcher a.active { color:white; background:rgba(255,255,255,0.25); }
    .lang-switcher a:hover { color:white; background:rgba(255,255,255,0.18); }
    .lang-switcher span { color:rgba(255,255,255,0.3); font-size:0.75rem; }
"""


def build_page(filename, meta):
    ko_path = os.path.join(BASE, filename)
    en_path = os.path.join(EN_DIR, filename)

    with open(ko_path, encoding='utf-8') as f:
        html = f.read()

    # ── 메타 태그 교체 ──
    html = re.sub(r'<title>[^<]+</title>', f'<title>{meta["title"]}</title>', html)
    html = re.sub(r'<meta name="description" content="[^"]*"',
                  f'<meta name="description" content="{meta["desc"]}"', html)
    html = re.sub(r'<meta name="keywords" content="[^"]*"',
                  f'<meta name="keywords" content="{meta["kw"]}"', html)
    html = re.sub(r'<meta property="og:title" content="[^"]*"',
                  f'<meta property="og:title" content="{meta["og_title"]}"', html)
    html = re.sub(r'<meta property="og:description" content="[^"]*"',
                  f'<meta property="og:description" content="{meta["og_desc"]}"', html)
    html = re.sub(r'<meta property="og:url" content="[^"]*"',
                  f'<meta property="og:url" content="https://wooadev.wooahouse.com/en/{filename}"', html)
    html = re.sub(r'<link rel="canonical" href="[^"]*"',
                  f'<link rel="canonical" href="https://wooadev.wooahouse.com/en/{filename}"', html)

    # ── hreflang 추가 (canonical 바로 뒤) ──
    hreflang = (
        f'\n  <link rel="alternate" hreflang="ko" href="https://wooadev.wooahouse.com/{filename}">'
        f'\n  <link rel="alternate" hreflang="en" href="https://wooadev.wooahouse.com/en/{filename}">'
        f'\n  <link rel="alternate" hreflang="x-default" href="https://wooadev.wooahouse.com/en/{filename}">'
    )
    html = re.sub(r'(<link rel="canonical"[^>]*>)', r'\1' + hreflang, html)

    # ── ld+json 업데이트 ──
    html = re.sub(r'"name": "([^"]*[가-힣][^"]*)"', f'"name": "{meta["app_name"]}"', html)
    html = re.sub(r'"description": "([^"]*[가-힣][^"]*)"', f'"description": "{meta["desc"]}"', html)
    html = re.sub(
        r'"url": "https://wooadev\.wooahouse\.com/' + re.escape(filename) + '"',
        f'"url": "https://wooadev.wooahouse.com/en/{filename}"',
        html
    )
    # ld+json inLanguage
    html = html.replace('"inLanguage":"ko"', '"inLanguage":"en"')

    # ── FAQ 교체 ──
    if meta.get('faq'):
        faq_items = meta['faq']
        # <details>/<summary> FAQ format
        faq_details_parts = []
        for i, (q, a) in enumerate(faq_items):
            is_last = (i == len(faq_items) - 1)
            border = '' if is_last else 'border-bottom:1px solid #E5E7EB;'
            faq_details_parts.append(
                f'      <details style="{border}padding:16px">\n'
                f'        <summary style="font-weight:700;cursor:pointer;color:#111827">{q}</summary>\n'
                f'        <p style="margin-top:10px;color:#6B7280;line-height:1.6">{a}</p>\n'
                f'      </details>'
            )
        faq_details_inner = '\n'.join(faq_details_parts)
        html = re.sub(
            r'(<div[^>]*border[^>]*border-radius[^>]*overflow[^>]*>)\s*<details.*?</details>\s*</div>',
            r'\1\n' + faq_details_inner + '\n    </div>',
            html, flags=re.DOTALL
        )
        # plain faq-list format
        faq_html_parts = []
        for i, (q, a) in enumerate(faq_items):
            is_last = (i == len(faq_items) - 1)
            mb = '' if is_last else 'margin-bottom:1.2rem;'
            faq_html_parts.append(
                f'      <div class="faq-item" style="{mb}padding:1rem;background:#f8f9fa;border-radius:8px;">\n'
                f'        <h3 style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">Q. {q}</h3>\n'
                f'        <p style="color:#555;margin:0;">{a}</p>\n'
                f'      </div>'
            )
        faq_inner = '\n'.join(faq_html_parts)
        html = re.sub(
            r'<div class="faq-list">.*?</div>\s*</section>',
            f'<div class="faq-list">\n{faq_inner}\n    </div>\n  </section>',
            html, flags=re.DOTALL
        )
        html = re.sub(
            r'<h2[^>]*>자주 묻는 질문</h2>',
            '<h2 style="font-size:1.4rem;margin-bottom:1.5rem;">Frequently Asked Questions</h2>',
            html
        )
        html = re.sub(
            r'<h2[^>]*font-weight:800[^>]*>자주 묻는 질문</h2>',
            '<h2 style="font-size:1.1rem;font-weight:800;color:#374151;margin-bottom:16px">Frequently Asked Questions</h2>',
            html
        )
        # FAQPage ld+json
        import json as _json
        faq_entities = []
        for q, a in faq_items:
            faq_entities.append({
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a}
            })
        new_faq_json = _json.dumps({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faq_entities
        }, ensure_ascii=False, indent=2)
        html = re.sub(
            r'<script type="application/ld\+json">\s*\{[^<]*"FAQPage"[^<]*\}[^<]*</script>',
            f'<script type="application/ld+json">\n{new_faq_json}\n</script>',
            html, flags=re.DOTALL
        )

    # ── h1 교체 ──
    if meta.get('h1'):
        replaced = re.sub(r'<h1 id="toolTitle">[^<]*</h1>',
                          f'<h1 id="toolTitle">{meta["h1"]}</h1>', html)
        if replaced == html:
            replaced = re.sub(r'<h1>([^<]*)</h1>', f'<h1>{meta["h1"]}</h1>', html, count=1)
        html = replaced

    # ── tool_desc 교체 ──
    if meta.get('tool_desc'):
        replaced = re.sub(r'<p id="toolDesc">[^<]*</p>',
                          f'<p id="toolDesc">{meta["tool_desc"]}</p>', html)
        html = replaced

    # ── breadcrumb ──
    if meta.get('breadcrumb'):
        html = re.sub(r'<span id="breadcrumbTitle">[^<]*</span>',
                      f'<span id="breadcrumbTitle">{meta["breadcrumb"]}</span>', html)

    # ── 공통 치환 ──
    for ko, en in COMMON:
        html = html.replace(ko, en)

    # ── og:locale 교체 ──
    html = html.replace('content="ko_KR"', 'content="en_US"')

    # ── 언어 선택기 CSS 삽입 ──
    if 'lang-switcher' not in html:
        html = html.replace('  </style>', LANG_SWITCHER_CSS + '  </style>', 1)
        if 'lang-switcher' not in html:
            # <style> 태그가 없는 경우 head 끝에 추가
            html = html.replace('</head>',
                f'  <style>\n{LANG_SWITCHER_CSS}  </style>\n</head>', 1)

    # ── 헤더에 언어 선택기 삽입 ──
    html = re.sub(
        r'(\s*</div>\s*</header>)',
        f'\n    <div class="header-right">\n'
        f'      <div class="lang-switcher">\n'
        f'        <a href="../{filename}">KO</a>\n'
        f'        <span>|</span>\n'
        f'        <a href="{filename}" class="active">EN</a>\n'
        f'      </div>\n'
        f'      <a href="../about.html" style="color:rgba(255,255,255,0.85); font-size:0.85rem; text-decoration:none; margin-left:8px;">About</a>\n'
        f'    </div>\n'
        f'  </div>\n'
        f'</header>',
        html, count=1
    )

    # ── 쿠팡 광고 제거 → 애드센스로 교체 ──
    ADSENSE_BLOCK = (
        '<div style="text-align:center;margin:32px auto 0;max-width:728px;padding:0 8px">\n'
        '<ins class="adsbygoogle"\n'
        '     style="display:block"\n'
        '     data-ad-client="ca-pub-6464921081676309"\n'
        '     data-ad-slot="7080296704"\n'
        '     data-ad-format="auto"\n'
        '     data-full-width-responsive="true"></ins>\n'
        '<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>\n'
        '</div>'
    )
    # head의 g.js 제거
    html = re.sub(r'\s*<script src="https://ads-partners\.coupang\.com/g\.js"></script>\n?', '', html)
    # PartnersCoupang 블록 제거
    html = re.sub(r'<script>\s*new PartnersCoupang\.G\([^)]*\);?\s*</script>', '', html)
    # coupang-notice 제거
    html = re.sub(r'<p class="coupang-notice">[^<]*</p>', '', html)

    with open(en_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'  OK  en/{filename}')


# ── 4. 실행 ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('Building WooaDev English pages...')
    for filename, meta in PAGE_META.items():
        ko_path = os.path.join(BASE, filename)
        if os.path.exists(ko_path):
            build_page(filename, meta)
        else:
            print(f'  SKIP  {filename} not found')
    print()
    print(f'Done! English pages saved to: {EN_DIR}')
