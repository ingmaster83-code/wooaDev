/* WooaDev Tool Kit — 위치(줄 번호)를 보존하는 YAML 로더 (js-yaml 5 의 이벤트 스트림 기반, window.jsyaml 필요)
   - 앵커·별칭·병합 키(<<)·사용자 태그(!Ref 등)를 처리하고, 노드마다 줄 번호를 남긴다.
   - 린터류 도구(GitHub Actions, GitLab CI, Compose, Kubernetes …)가 "몇 번째 줄" 을 알려 줄 때 쓴다. */
(function (g) {
  'use strict';
  var TK = g.TK = g.TK || {};
  var Y = TK.yamlx = TK.yamlx || {};
  var t = function (a, b) { return TK.t(a, b); };

  function resolvePlain(s) {
    if (s === '' || s === '~' || /^(null|Null|NULL)$/.test(s)) return null;
    if (/^(true|True|TRUE)$/.test(s)) return true;
    if (/^(false|False|FALSE)$/.test(s)) return false;
    if (/^[-+]?[0-9]+$/.test(s)) { var n = Number(s); return Math.abs(n) <= 9007199254740991 ? n : s; }
    if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
    if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8);
    if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(s)) return Number(s);
    if (/^[-+]?\.(inf|Inf|INF)$/.test(s)) return s.charAt(0) === '-' ? -Infinity : Infinity;
    if (/^\.(nan|NaN|NAN)$/.test(s)) return NaN;
    return s;
  }

  /** YAML 텍스트 → {docs:[{root, js, dups, tags}], lineOf(offset)} (문법 오류는 Error 에 line 속성) */
  Y.parse = function (text, opts) {
    opts = opts || {};
    var J = g.jsyaml; if (!J || !J.parseEvents) throw new Error(t('YAML 라이브러리를 불러오지 못했습니다', 'Failed to load the YAML library'));
    text = String(text);
    var starts = [0]; for (var i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
    function lineOf(off) { var lo = 0, hi = starts.length - 1; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; } return lo + 1; }
    var docs = [], cur = null, stack = [], events;
    try { events = Array.from(J.parseEvents(text)); }
    catch (e) { var err = new Error((e.reason || e.message || 'YAML error').split('\n')[0]); err.line = e.mark ? e.mark.line + 1 : 1; err.column = e.mark ? e.mark.column + 1 : 1; err.snippet = e.mark && e.mark.snippet; throw err; }
    function nodeBase(kind, ev, startOff) {
      var n = { kind: kind, pos: startOff, line: lineOf(Math.max(0, startOff)), tag: ev.tagStart >= 0 ? text.slice(ev.tagStart, ev.tagEnd) : '', anchor: ev.anchorStart >= 0 ? text.slice(ev.anchorStart, ev.anchorEnd) : '', anchorLine: ev.anchorStart >= 0 ? lineOf(ev.anchorStart) : 0 };
      return n;
    }
    function attach(n) {
      if (n.anchor && cur) cur.anchors[n.anchor] = n;
      if (!stack.length) { cur.root = n; return; }
      var top = stack[stack.length - 1]; top.kids.push(n);
    }
    events.forEach(function (ev) {
      switch (ev.type) {
        case 1: cur = { root: null, anchors: {}, dups: [], tags: [], js: undefined }; docs.push(cur); stack = []; break;
        case 2: case 3: { var n = nodeBase(ev.type === 2 ? 'seq' : 'map', ev, ev.start); n.flow = ev.style === 2 || ev.flow === true; n.kids = []; attach(n); stack.push(n); break; }
        case 4: {
          var raw = ev.valueStart < 0 ? '' : J.getScalarValue(text, ev);
          var n2 = nodeBase('scalar', ev, ev.valueStart < 0 ? (ev.tagStart >= 0 ? ev.tagStart : 0) : ev.valueStart);
          n2.style = ev.style; n2.raw = raw;
          var tag = n2.tag;
          if (tag === '!!str' || tag === '!<tag:yaml.org,2002:str>') n2.value = raw;
          else if (tag && /^!!/.test(tag)) n2.value = resolvePlain(raw);
          else if (ev.style === 1 && !tag) n2.value = resolvePlain(raw);
          else n2.value = raw;
          if (ev.style === 1 && ev.valueStart < 0 && !tag) n2.value = null;
          attach(n2); break;
        }
        case 5: { var n3 = nodeBase('alias', ev, ev.anchorStart); n3.name = text.slice(ev.anchorStart, ev.anchorEnd); n3.anchor = ''; attach(n3); break; }
        case 6: {
          var done = stack.pop();
          if (!done) break;
          if (done.kind === 'map') {
            done.pairs = []; var seen = {};
            for (var k = 0; k + 1 < done.kids.length; k += 2) {
              var kn = done.kids[k], vn = done.kids[k + 1], ks = kn.kind === 'scalar' ? String(kn.value === null ? 'null' : kn.value) : null;
              done.pairs.push({ key: kn, val: vn, name: ks });
              if (ks !== null && ks !== '<<') { if (seen[ks]) cur.dups.push({ key: ks, line: kn.line, first: seen[ks] }); else seen[ks] = kn.line; }
            }
            delete done.kids;
          } else { done.items = done.kids; delete done.kids; }
          break;
        }
      }
    });
    function deref(n, depth) {
      var guard = 0; while (n && n.kind === 'alias') { var doc = n._doc; var target = doc && doc.anchors[n.name]; if (!target || ++guard > 20) return null; n = target; }
      return n;
    }
    docs.forEach(function (d) {
      (function mark(n) { if (!n) return; n._doc = d; if (n.tag && d.tags.indexOf(n.tag) < 0) d.tags.push(n.tag); if (n.pairs) n.pairs.forEach(function (p) { mark(p.key); mark(p.val); }); if (n.items) n.items.forEach(mark); })(d.root);
    });
    var budget = 200000;
    function toJS(n, d, depth) {
      if (--budget < 0) throw new Error(t('YAML 이 너무 큽니다', 'The YAML is too large'));
      if (!n) return null;
      if (depth > 200) throw new Error(t('YAML 중첩이 너무 깊습니다', 'The YAML is nested too deeply'));
      if (n.kind === 'alias') { var target = d.anchors[n.name]; if (!target) { var e = new Error(t('정의되지 않은 앵커 *' + n.name, 'Undefined anchor *' + n.name)); e.line = n.line; throw e; } return toJS(target, d, depth + 1); }
      if (n.kind === 'scalar') return conv(n, n.value, d);
      if (n.kind === 'seq') return conv(n, n.items.map(function (c) { return toJS(c, d, depth + 1); }), d);
      var o = {}, merged = [];
      n.pairs.forEach(function (p) {
        if (p.name === '<<' && p.key.kind === 'scalar') { var vs = p.val.kind === 'seq' ? p.val.items : [p.val]; vs.forEach(function (v) { var m = toJS(v, d, depth + 1); if (m && typeof m === 'object' && !Array.isArray(m)) merged.push(m); }); return; }
        var key = p.name !== null ? p.name : JSON.stringify(toJS(p.key, d, depth + 1));
        if (key === '__proto__') return;
        o[key] = toJS(p.val, d, depth + 1);
      });
      merged.forEach(function (m) { Object.keys(m).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(o, k)) o[k] = m[k]; }); });
      return conv(n, o, d);
    }
    function conv(n, val, d) {
      if (!n.tag || !opts.cfn) return val;
      var tag = n.tag.replace(/^!/, '');
      if (/^!/.test(tag)) return val;
      if (tag === 'Ref' || tag === 'Condition') return (function () { var o2 = {}; o2[tag] = val; return o2; })();
      if (tag === 'GetAtt' && typeof val === 'string') { var i2 = val.indexOf('.'); var o3 = {}; o3['Fn::GetAtt'] = i2 < 0 ? [val] : [val.slice(0, i2), val.slice(i2 + 1)]; return o3; }
      var o4 = {}; o4['Fn::' + tag] = val; return o4;
    }
    docs.forEach(function (d) {
      if (!d.root) { d.js = null; return; }
      try { d.js = toJS(d.root, d, 0); } catch (e) { d.error = e; }
    });
    return { docs: docs, lineOf: lineOf, text: text };
  };

  /** 노드에서 경로(키/인덱스 배열)를 따라 내려간 노드 (없으면 null) */
  Y.get = function (node, path, doc) {
    var n = node;
    for (var i = 0; i < path.length; i++) {
      n = Y.deref(n, doc); if (!n) return null;
      var key = path[i];
      if (n.kind === 'map') { var hit = null; n.pairs.forEach(function (p) { if (p.name === String(key)) hit = p.val; }); n = hit; }
      else if (n.kind === 'seq') n = n.items[key] || null;
      else return null;
    }
    return n || null;
  };
  Y.deref = function (n, doc) { var guard = 0; while (n && n.kind === 'alias') { var d = doc || n._doc; n = d && d.anchors[n.name]; if (++guard > 20) return null; } return n; };
  /** 매핑에서 키 노드의 줄 (없으면 매핑 시작 줄) */
  Y.keyLine = function (map, key) { var m = Y.deref(map); if (!m || m.kind !== 'map') return m ? m.line : 0; var line = m.line; m.pairs.forEach(function (p) { if (p.name === key) line = p.key.line; }); return line; };
  Y.isMap = function (x) { return x && typeof x === 'object' && !Array.isArray(x); };
})(typeof window !== 'undefined' ? window : globalThis);
