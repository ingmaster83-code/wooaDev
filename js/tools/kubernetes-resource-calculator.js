TK.tool('kubernetes-resource-calculator', {
  inputs: [{ id: 'containers', label: ['컨테이너 (한 줄에 하나: 이름 CPU요청 CPU한도 메모리요청 메모리한도, 없으면 -)', 'Containers (one per line: name cpuRequest cpuLimit memRequest memLimit, - if unset)'], rows: 5, sample: 'app 250m 500m 256Mi 512Mi\nsidecar 50m 100m 64Mi 128Mi\nlog-agent 20m - 32Mi 64Mi' }],
  options: [
    { id: 'replicas', type: 'number', label: ['레플리카 수', 'Replicas'], default: 3, min: 1, max: 10000 },
    { id: 'hpaMax', type: 'number', label: ['HPA 최대 레플리카 (0 = 사용 안 함)', 'HPA max replicas (0 = off)'], default: 10, min: 0, max: 10000 },
    { id: 'nodeCpu', type: 'text', label: ['노드 할당 가능 CPU (예: 3920m, 4)', 'Node allocatable CPU (e.g. 3920m, 4)'], default: '3920m' },
    { id: 'nodeMem', type: 'text', label: ['노드 할당 가능 메모리 (예: 14Gi)', 'Node allocatable memory (e.g. 14Gi)'], default: '14Gi' },
    { id: 'reserve', type: 'number', label: ['데몬셋·시스템 몫 (%)', 'DaemonSets / system share (%)'], default: 10, min: 0, max: 90 }
  ],
  outputs: [{ id: 'table', label: ['컨테이너별 리소스', 'Per-container resources'], kind: 'table' }, { id: 'sum', label: ['파드·배포 합계', 'Pod & deployment totals'], kind: 'table' }, { id: 'manifest', label: ['resources YAML', 'resources YAML'], kind: 'code', ext: 'yml' }, { id: 'issues', label: ['점검 사항', 'Findings'], kind: 'list' }],
  run: function (v, o, t) {
    var BIN = { Ki: 1024, Mi: 1048576, Gi: 1073741824, Ti: 1099511627776, Pi: 1125899906842624, Ei: 1152921504606846976 }, DEC = { k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18 };
    function cpu(s) { if (s === '-' || s === undefined || s === '') return null; var m = /^(\d+(?:\.\d+)?)(m)?$/.exec(s); if (!m) throw new Error(t('CPU 값을 해석할 수 없습니다: ' + s + ' (예: 250m, 0.5, 2)', 'Cannot parse CPU value: ' + s + ' (e.g. 250m, 0.5, 2)')); return m[2] ? +m[1] / 1000 : +m[1]; }
    function mem(s) { if (s === '-' || s === undefined || s === '') return null; var m = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|Pi|Ei|[kKMGTPE])?$/.exec(s), e = /^(\d+)e(\d+)$/.exec(s); if (e) return +e[1] * Math.pow(10, +e[2]); if (!m) throw new Error(t('메모리 값을 해석할 수 없습니다: ' + s + ' (예: 256Mi, 1Gi, 128M)', 'Cannot parse memory value: ' + s + ' (e.g. 256Mi, 1Gi, 128M)')); return +m[1] * (m[2] ? (BIN[m[2]] || DEC[m[2]]) : 1); }
    function fc(x) { return x === null ? '—' : x < 1 ? Math.round(x * 1000) + 'm' : (Math.round(x * 1000) % 1000 === 0 ? String(Math.round(x)) : Math.round(x * 1000) + 'm'); }
    function fm(b) { if (b === null) return '—'; if (b >= 1e6 && b % 1e6 === 0 && b % 1048576 !== 0) return (b / 1e6) + 'M'; var u = ['', 'Ki', 'Mi', 'Gi', 'Ti'], i = 0, x = b; while (i < 4 && x >= 1024) { x /= 1024; i++; } return (Math.round(x * 10) / 10) + u[i]; }
    var rows = [], issues = [], cs = [];
    String(v.containers).replace(/\r/g, '').split('\n').forEach(function (ln) {
      ln = ln.trim(); if (!ln) return; var p = ln.split(/\s+/);
      if (p.length < 2) throw new Error(t('한 줄에 "이름 CPU요청 CPU한도 메모리요청 메모리한도" 형식으로 쓰세요: ' + ln, 'Use "name cpuRequest cpuLimit memRequest memLimit" per line: ' + ln));
      cs.push({ name: p[0], cr: cpu(p[1]), cl: cpu(p[2]), mr: mem(p[3]), ml: mem(p[4]) });
    });
    if (!cs.length) throw new Error(t('컨테이너를 한 줄 이상 입력하세요', 'Enter at least one container'));
    var tot = { cr: 0, cl: 0, mr: 0, ml: 0 }, allLim = true, anySet = false, guar = true, noMemLim = [], noCpuReq = [];
    cs.forEach(function (c) {
      var cr = c.cr === null ? c.cl : c.cr, mr = c.mr === null ? c.ml : c.mr;   // 요청 미지정 + 한도 지정 → 요청 = 한도
      if (c.cr === null && c.cl !== null) issues.push(t(c.name + ': CPU 요청이 없고 한도만 있어 요청 = 한도(' + fc(c.cl) + ')로 간주됩니다', c.name + ': CPU has a limit but no request, so request = limit (' + fc(c.cl) + ')'));
      if (c.mr === null && c.ml !== null) issues.push(t(c.name + ': 메모리 요청이 없고 한도만 있어 요청 = 한도(' + fm(c.ml) + ')로 간주됩니다', c.name + ': memory has a limit but no request, so request = limit (' + fm(c.ml) + ')'));
      if (c.cr !== null && c.cl !== null && c.cl < c.cr) issues.push(t('🚨 ' + c.name + ': CPU 한도(' + fc(c.cl) + ')가 요청(' + fc(c.cr) + ')보다 작아 Pod 생성이 거부됩니다', '🚨 ' + c.name + ': the CPU limit (' + fc(c.cl) + ') is below the request (' + fc(c.cr) + ') — the Pod is rejected'));
      if (c.mr !== null && c.ml !== null && c.ml < c.mr) issues.push(t('🚨 ' + c.name + ': 메모리 한도(' + fm(c.ml) + ')가 요청(' + fm(c.mr) + ')보다 작아 Pod 생성이 거부됩니다', '🚨 ' + c.name + ': the memory limit (' + fm(c.ml) + ') is below the request (' + fm(c.mr) + ') — the Pod is rejected'));
      if (c.ml === null) noMemLim.push(c.name); if (cr === null) noCpuReq.push(c.name);
      if (c.mr !== null && c.ml !== null && c.ml / c.mr > 2) issues.push(t(c.name + ': 메모리 한도가 요청의 ' + Math.round(c.ml / c.mr * 10) / 10 + '배입니다 — 노드가 과다 할당되어 OOM 위험이 커집니다', c.name + ': the memory limit is ' + Math.round(c.ml / c.mr * 10) / 10 + '× the request — overcommit raises OOM risk'));
      if ((c.cr !== null && c.cr >= 64) || (c.mr !== null && c.mr < 4 * 1048576 && c.mr > 0)) issues.push(t(c.name + ': 값이 비정상적으로 보입니다 (CPU ' + fc(c.cr) + ' / 메모리 ' + fm(c.mr) + ') — m 과 Mi 단위를 확인하세요', c.name + ': suspicious values (CPU ' + fc(c.cr) + ' / memory ' + fm(c.mr) + ') — check the m and Mi units'));
      tot.cr += cr || 0; tot.mr += mr || 0; tot.cl += c.cl || 0; tot.ml += c.ml || 0;
      if (c.cl === null || c.ml === null) allLim = false; if (c.cr !== null || c.cl !== null || c.mr !== null || c.ml !== null) anySet = true;
      if (!(c.cl !== null && c.ml !== null && (c.cr === null || c.cr === c.cl) && (c.mr === null || c.mr === c.ml))) guar = false;
      rows.push([c.name, fc(cr) + ' / ' + fc(c.cl), fm(mr) + ' / ' + fm(c.ml)]);
    });
    var qos = !anySet ? 'BestEffort' : (guar && allLim ? 'Guaranteed' : 'Burstable');
    var QD = { Guaranteed: t('요청 = 한도 — 가장 마지막에 쫓겨남, CPU 고정 할당 가능', 'request = limit — evicted last'), Burstable: t('요청 < 한도(또는 일부만 지정) — 노드 자원이 부족하면 중간 우선순위로 쫓겨남', 'request < limit (or partial) — evicted in the middle under pressure'), BestEffort: t('아무것도 지정 안 함 — 노드 자원이 부족하면 가장 먼저 쫓겨남', 'nothing set — evicted first under pressure') };
    if (noMemLim.length) issues.push(t('메모리 한도가 없는 컨테이너: ' + noMemLim.join(', ') + ' — 메모리 누수 시 노드 전체를 위협합니다', 'Containers without a memory limit: ' + noMemLim.join(', ') + ' — a leak can threaten the whole node'));
    if (noCpuReq.length) issues.push(t('CPU 요청이 없는 컨테이너: ' + noCpuReq.join(', ') + ' — 스케줄러가 CPU 를 고려하지 못하고 HPA 사용률도 계산할 수 없습니다', 'Containers without a CPU request: ' + noCpuReq.join(', ') + ' — the scheduler ignores CPU and HPA cannot compute utilisation'));
    issues.push(t('CPU 한도는 초과 시 종료가 아니라 스로틀링(느려짐)입니다. 지연에 민감한 서비스는 CPU 한도를 넉넉히 두거나 생략하는 팀도 많습니다', 'Exceeding a CPU limit throttles instead of killing. Many teams leave CPU limits generous or unset for latency-sensitive services'));
    var rep = Math.max(1, Math.round(o.replicas) || 1), nCpu = cpu(String(o.nodeCpu || '').trim()), nMem = mem(String(o.nodeMem || '').trim());
    if (nCpu === null || nMem === null) throw new Error(t('노드 CPU·메모리를 입력하세요', 'Enter the node CPU and memory'));
    var share = 1 - (Math.min(90, Math.max(0, o.reserve)) / 100), aCpu = nCpu * share, aMem = nMem * share;
    var perNodeCpu = tot.cr > 0 ? Math.floor(aCpu / tot.cr + 1e-9) : Infinity, perNodeMem = tot.mr > 0 ? Math.floor(aMem / tot.mr + 1e-9) : Infinity, per = Math.min(perNodeCpu, perNodeMem);
    var sum = [[t('파드 1개 요청 (CPU / 메모리)', 'Per Pod requests (CPU / memory)'), fc(tot.cr) + ' / ' + fm(tot.mr)], [t('파드 1개 한도 (CPU / 메모리)', 'Per Pod limits (CPU / memory)'), (tot.cl ? fc(tot.cl) : '—') + ' / ' + (tot.ml ? fm(tot.ml) : '—')], ['QoS', qos + ' — ' + QD[qos]], [t('레플리카 ' + rep + '개 요청 합계', 'Requests × ' + rep + ' replicas'), fc(tot.cr * rep) + ' / ' + fm(tot.mr * rep)], [t('레플리카 ' + rep + '개 한도 합계', 'Limits × ' + rep + ' replicas'), (tot.cl ? fc(tot.cl * rep) : '—') + ' / ' + (tot.ml ? fm(tot.ml * rep) : '—')]];
    if (isFinite(per)) {
      sum.push([t('노드 1대당 들어가는 파드 수', 'Pods per node'), per + t('개 (CPU 기준 ' + (isFinite(perNodeCpu) ? perNodeCpu : '∞') + ', 메모리 기준 ' + (isFinite(perNodeMem) ? perNodeMem : '∞') + ')', ' (CPU allows ' + (isFinite(perNodeCpu) ? perNodeCpu : '∞') + ', memory allows ' + (isFinite(perNodeMem) ? perNodeMem : '∞') + ')')]);
      if (per < 1) issues.push(t('🚨 파드 1개의 요청이 노드 1대의 여유보다 커서 스케줄링할 수 없습니다 (Pending)', '🚨 One Pod requests more than a node can offer — it can never be scheduled (Pending)'));
      else {
        sum.push([t('레플리카 ' + rep + '개에 필요한 노드', 'Nodes needed for ' + rep + ' replicas'), Math.ceil(rep / per) + t('대 이상', '+')]);
        if (o.hpaMax > 0) sum.push([t('HPA 최대 ' + Math.round(o.hpaMax) + '개일 때 필요한 노드', 'Nodes needed at HPA max ' + Math.round(o.hpaMax)), Math.ceil(Math.round(o.hpaMax) / per) + t('대 이상', '+')]);
        sum.push([t('노드 사용 효율 (병목 자원)', 'Node packing (bottleneck)'), (perNodeCpu <= perNodeMem ? 'CPU' : t('메모리', 'memory')) + ' · ' + Math.round(Math.min(per * tot.cr / aCpu, 1) * 100) + '% CPU, ' + Math.round(Math.min(per * tot.mr / aMem, 1) * 100) + '% ' + t('메모리', 'memory')]);
      }
    }
    var y = ['resources:'];
    var yy = cs.map(function (c) {
      var req = [], lim = [];
      if (c.cr !== null) req.push('cpu: ' + fc(c.cr)); if (c.mr !== null) req.push('memory: ' + fm(c.mr)); if (c.cl !== null) lim.push('cpu: ' + fc(c.cl)); if (c.ml !== null) lim.push('memory: ' + fm(c.ml));
      var s = '# ' + c.name + '\nresources:'; if (req.length) s += '\n  requests:\n    ' + req.join('\n    '); if (lim.length) s += '\n  limits:\n    ' + lim.join('\n    '); return s;
    });
    var bad = issues.filter(function (x) { return /^🚨/.test(x); }).length;
    return { _status: bad ? { ok: false, msg: t('❌ 배포할 수 없는 설정이 있습니다', '❌ This configuration cannot be deployed') } : t('✅ 파드 1개 요청 ' + fc(tot.cr) + ' CPU · ' + fm(tot.mr) + ' · QoS ' + qos, '✅ Per Pod: ' + fc(tot.cr) + ' CPU · ' + fm(tot.mr) + ' · QoS ' + qos), table: { head: [['컨테이너', 'Container'], ['CPU 요청 / 한도', 'CPU request / limit'], ['메모리 요청 / 한도', 'Memory request / limit']], rows: rows }, sum: { head: [['항목', 'Item'], ['값', 'Value']], rows: sum }, manifest: yy.join('\n\n'), issues: issues };
  }
});
