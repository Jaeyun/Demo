(function () {
  'use strict';
  const A = window.AIP, D = A.D;
  const ISD = window.INDICATOR_SCORE_DATA || {};
  let chart, ledgerChart, ledgerRange = '1', scoreRange = '1';
  let categoryStatSort = { key: null, dir: 'desc' };
  let indicatorTableSort = { key: null, dir: 'asc' };
  let ledgerSort = { key: null, dir: 'desc' };
  // 클릭 정렬: 활성 컬럼이면 data-sort-dir 속성 문자열을 반환, 아니면 빈 문자열(rebuild되는 thead에 매번 재적용)
  function sortAttr(state, key) { return state.key === key ? ` data-sort-dir="${state.dir}"` : ''; }
  // 초기 차트 · 정량 스코어 · 분류별 선 선택
  const visibleSeries = new Set(['final']);
  const REGIME_BAND_COLOR = { '강세':'rgba(0,132,114,.14)', '중립':'rgba(97,120,139,.12)', '약세':'rgba(194,60,74,.14)' };
  // 차트 배경(markArea)은 데이터선을 가리지 않게 옅어야 하지만, 그 옅은 색 그대로 범례 스와치를
  // 만들면 거의 안 보인다 - 범례용으로 색은 그대로 두고 불투명도만 올린 별도 맵을 쓴다.
  const REGIME_LEGEND_COLOR = { '강세':'rgba(0,132,114,.75)', '중립':'rgba(97,120,139,.6)', '약세':'rgba(194,60,74,.75)' };

  function bindTabs() {
    const root = document.getElementById('quantTabs');
    root.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      root.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
      if (tab.dataset.tab === 'score') requestAnimationFrame(renderScore);
      // '세부 지표·스코어링 범위'는 이제 "세부 지표·스코어링 범위"/"선택 지표 시계열" 하위 탭으로
      // 나뉘어 있고 기본으로 보이는 건 전자(표, 차트 없음)다 - indicatorChart를 여기서 미리
      // 그리면 아직 hidden인 "선택 지표 시계열" 컨테이너 안에서 초기화되어 캔버스가 찌그러진 채
      // 굳는다(다른 탭에서 이미 겪은 것과 동일한 echarts 버그). 렌더는 bindIndicatorViewTabs()가
      // 그 하위 탭으로 실제 전환될 때만 하도록 넘긴다.
      if (tab.dataset.tab === 'ledger') requestAnimationFrame(renderLedger);
    }));
  }

  function activateHashTab() {
    const root = document.getElementById('quantTabs');
    const allowed = new Set(['score', 'indicators', 'ledger']);
    const tabName = window.location.hash.slice(1);
    if (!allowed.has(tabName)) return;
    const tab = root.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tab) tab.click();
  }

  function buildScoreStrip(categoryMA, finalSeries, idx) {
    const cells = A.CATEGORY_KEYS.map(key => {
      const m = A.CATEGORY_META[key];
      return `<div class="score-cell"><span class="score-label"><i class="score-dot" style="background:${m.color}"></i>${m.name}</span><strong class="score-value" style="color:${m.color}">${A.formatNumber(categoryMA[key][idx])}</strong></div>`;
    });
    cells.push(`<div class="score-cell final-score-cell"><span class="score-label"><i class="score-dot" style="background:#102a43"></i>정량 스코어</span><strong class="score-value">${A.formatNumber(finalSeries[idx])}</strong></div>`);
    return cells.join('');
  }

  function renderScore() {
    const settings = A.getSettings(), s = effectiveAdjustedSeries(settings), latest = s.dates.length - 1;
    const monthEndFlags = (A.D.scores && A.D.scores.month_end) || [];
    const monthEndIdx = A.lastMonthEndIndex(s.dates, monthEndFlags, latest);
    document.getElementById('quant-asof').textContent = `직전 월말 ${A.formatDate(s.dates[monthEndIdx])} · 실시간 ${A.formatDate(s.dates[latest])} 기준`;
    document.getElementById('live-strip-meta').textContent = `${A.formatDate(s.dates[latest])} 기준`;
    document.getElementById('month-end-strip-meta').textContent = `${A.formatDate(s.dates[monthEndIdx])} 기준`;
    const categoryMA = {};
    A.CATEGORY_KEYS.forEach(key => { categoryMA[key] = A.rollingMean(s.categories[key], settings.observation); });
    document.getElementById('live-score-strip').innerHTML = buildScoreStrip(categoryMA, s.observed, latest);
    document.getElementById('month-end-score-strip').innerHTML = buildScoreStrip(categoryMA, s.observed, monthEndIdx);
    const definitions = A.CATEGORY_KEYS.map(key => ({
      id:key,
      label:A.CATEGORY_META[key].name,
      data:categoryMA[key],
      color:A.CATEGORY_META[key].color,
      width:1.8
    }));
    const finalDefinition = { id:'final', label:'정량 스코어', data:s.observed, color:'#102a43', width:2.8 };
    const seriesOptions = [...definitions, finalDefinition];
    const statRows = [...definitions, { id:'final', label:'정량 스코어', data:s.observed, color:'#102a43' }];
    document.getElementById('quant-stat-meta').textContent = `${settings.observation}영업일 기준`;
    const statRowsComputed = statRows.map(item => ({ label: item.label, color: item.color, min: A.min(item.data), mean: A.mean(item.data), max: A.max(item.data), current: item.data[latest] }));
    const sortedStatRows = categoryStatSort.key ? statRowsComputed.slice().sort((a, b) => A.compareSortValues(a[categoryStatSort.key], b[categoryStatSort.key], categoryStatSort.dir)) : statRowsComputed;
    const statHeadCell = (label, key, cls) => `<th${cls ? ` class="${cls}"` : ''} data-sort-key="${key}"${sortAttr(categoryStatSort, key)}>${label}</th>`;
    document.getElementById('category-stat-body').closest('table').querySelector('thead').innerHTML = `<tr>${statHeadCell('스코어', 'label')}${statHeadCell('최저', 'min', 'numeric')}${statHeadCell('평균', 'mean', 'numeric')}${statHeadCell('최고', 'max', 'numeric')}${statHeadCell('현재', 'current', 'numeric')}</tr>`;
    document.getElementById('category-stat-body').innerHTML = sortedStatRows.map(item => `<tr><td><span class="score-stat-label"><i style="background:${item.color}"></i>${item.label}</span></td><td class="numeric">${A.formatNumber(item.min)}</td><td class="numeric">${A.formatNumber(item.mean)}</td><td class="numeric">${A.formatNumber(item.max)}</td><td class="numeric current">${A.formatNumber(item.current)}</td></tr>`).join('');
    const controls=document.getElementById('score-series-controls');
    controls.innerHTML=seriesOptions.map(item=>`<button type="button" class="series-control ${visibleSeries.has(item.id)?'active':''}" data-series="${item.id}" style="--series-color:${item.color}" aria-pressed="${visibleSeries.has(item.id)}">${item.id === 'final' ? '정량 스코어' : item.label}</button>`).join('');
    controls.querySelectorAll('[data-series]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.series;if(visibleSeries.has(id)){if(visibleSeries.size===1) return; visibleSeries.delete(id);} else visibleSeries.add(id);renderScore();}));
    const visibleOptions = seriesOptions.filter(item=>visibleSeries.has(item.id));
    const sliced = A.sliceDateRange(s.dates, visibleOptions.map(item=>item.data), scoreRange);
    chart = A.createChart(document.getElementById('quant-main-chart'), A.lineOption({ dates:sliced.dates, minY:0, maxY:100, yName:'점수', series:visibleOptions.map((item,i)=>({name:item.label,data:sliced.arrays[i],color:item.color,width:item.width})) }));
  }

  function latestIndicatorScore(name) {
    const series = indicatorValueSeries(name);
    if (!Array.isArray(series) || !series.length) return null;
    const value = Number(series[series.length - 1]);
    return Number.isFinite(value) ? value : null;
  }

  let indicatorChart, indicatorRange = '1';
  let indicatorDetailSort = { key: 'date', dir: 'desc' };

  // 원데이터(raw-indicator-data.js, 스코어링 전 원자료, 2001~)와 점수(indicator-scores.js,
  // 정규화된 스코어, 2010~)는 날짜 범위가 서로 다르다 - 기존엔 '점수'/'원데이터' 서브탭으로
  // 뷰를 전환해 둘 중 하나씩만 보여줬는데, 이제 하나의 표에 관측일/원데이터/점수를 나란히
  // 보여주도록 두 날짜축의 합집합(union)을 만든다. 한쪽에 없는 날짜는 null(표에는 '-')로 채움.
  function mergeDateSeries(datesA, valuesA, datesB, valuesB) {
    const mapA = new Map(datesA.map((d, i) => [d, valuesA[i]]));
    const mapB = new Map(datesB.map((d, i) => [d, valuesB[i]]));
    const allDates = Array.from(new Set([...datesA, ...datesB])).sort();
    return {
      dates: allDates,
      a: allDates.map(d => (mapA.has(d) ? mapA.get(d) : null)),
      b: allDates.map(d => (mapB.has(d) ? mapB.get(d) : null))
    };
  }

  function indicatorDualChartOption(dates, rawValues, rawLabel, scoreValues, scoreMin, scoreMax) {
    const option = A.lineOption({ dates, yName: rawLabel || '원데이터', series: [
      { name: '원데이터', data: rawValues, color: '#1771b9', width: 2.2 },
      { name: '점수', data: scoreValues, color: '#b66e00', width: 1.9 }
    ] });
    option.grid = { left: 70, right: 64, top: 52, bottom: 48 };
    option.yAxis = [
      { type: 'value', name: rawLabel || '원데이터', position: 'left', scale: true, nameTextStyle: { color: '#71899a' }, splitLine: { lineStyle: { color: '#e7eef3' } }, axisLabel: { color: '#71899a' } },
      { type: 'value', name: '점수', position: 'right', min: scoreMin != null ? scoreMin : null, max: scoreMax != null ? scoreMax : null, scale: scoreMin == null && scoreMax == null, nameTextStyle: { color: '#71899a' }, splitLine: { show: false }, axisLabel: { color: '#71899a' } }
    ];
    option.series[0].yAxisIndex = 0; option.series[1].yAxisIndex = 1;
    return option;
  }

  function indicatorDetailTheadHtml() {
    const cols = [
      { key: 'date', label: '관측일' },
      { key: 'raw', label: '원데이터', numeric: true },
      { key: 'score', label: '점수', numeric: true },
      { key: 'weight', label: '가중치', numeric: true },
      { key: null, label: '최신 점수', numeric: true }
    ];
    return `<tr>${cols.map(col => {
      if (!col.key) return `<th${col.numeric ? ' class="numeric"' : ''}>${col.label}</th>`;
      const dirAttr = indicatorDetailSort.key === col.key ? ` data-sort-dir="${indicatorDetailSort.dir}"` : '';
      return `<th${col.numeric ? ' class="numeric"' : ''} data-sort-key="${col.key}"${dirAttr}>${col.label}</th>`;
    }).join('')}</tr>`;
  }

  // 지표별 일단위/월단위 적용 토글의 실제 재계산 엔진(가중치 조회·분류점수 재계산·
  // A.adjustedSeries 자체의 토글 반영)은 app-common.js로 옮겨 사이트 전체(국면예보·
  // 포트폴리오·성과분석·정량분석)가 공유한다 - "정량 분석 페이지에서만" 국한하려던 첫
  // 구현을 사용자가 "전체 페이지와 연동돼야" 한다고 정정. 이 파일엔 그 페이지 전용
  // UI(드래프트 상태·토글 버튼·저장/초기화)만 남긴다.
  const INDICATOR_MODE_STORE = A.indicatorModeStoreKey;
  const MONTHLY_ELIGIBLE = new Set(Object.keys(A.monthlyEligibleIndicators()));
  let indicatorModes = A.getIndicatorModes(); // 드래프트 - 저장 버튼을 눌러야 실제 store(다른 페이지가 읽는 곳)에 반영
  function indicatorMode(name) { return A.indicatorMode(name, indicatorModes); }
  function indicatorValueSeries(name) { return A.indicatorValueSeries(name, indicatorModes); }
  function hasAnyMonthlyToggle() { return Array.from(MONTHLY_ELIGIBLE).some(name => indicatorModes[name] === 'monthly'); }
  function effectiveAdjustedSeries(settings) { return A.adjustedSeries(settings, indicatorModes); }

  function renderIndicatorSeriesTable(dates, rawValues, scoreValues, weightHistory, latestScore) {
    const theadEl = document.getElementById('indicator-detail-thead');
    if (theadEl) theadEl.innerHTML = indicatorDetailTheadHtml();
    let detailRows = dates.map((d, i) => ({ date: d, raw: rawValues[i], score: scoreValues[i], weight: A.weightAsOf(weightHistory, d) }));
    detailRows = indicatorDetailSort.key
      ? detailRows.slice().sort((a, b) => A.compareSortValues(a[indicatorDetailSort.key], b[indicatorDetailSort.key], indicatorDetailSort.dir))
      : detailRows.slice().reverse();
    const detailBody = document.getElementById('indicator-detail-body');
    if (detailBody) {
      const latestCell = latestScore == null ? '-' : A.formatNumber(latestScore);
      A.renderVirtualRows(detailBody, detailRows.length, i => {
        const row = detailRows[i];
        const rawCell = row.raw == null ? '-' : A.formatNumber(row.raw);
        const scoreCell = row.score == null ? '-' : A.formatNumber(row.score);
        const weightCell = row.weight == null ? '-' : A.formatNumber(row.weight, 1);
        return `<tr><td class="nowrap">${A.formatDate(row.date)}</td><td class="numeric">${rawCell}</td><td class="numeric">${scoreCell}</td><td class="numeric">${weightCell}</td><td class="numeric">${latestCell}</td></tr>`;
      }, { emptyHtml: '<tr><td colspan="5" class="small">관측치 · 없음</td></tr>' });
    }
  }

  function renderIndicatorTimeseries() {
    const select = document.getElementById('indicator-select');
    if (!select) return;
    if (!select.dataset.ready) {
      const rows = (D.indicator_catalog || []).slice().sort((a,b) => {
        const ca = A.CATEGORY_ORDER.indexOf(a.category), cb = A.CATEGORY_ORDER.indexOf(b.category);
        return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb) || String(a.indicator).localeCompare(String(b.indicator), 'ko');
      });
      select.innerHTML = rows.map(r => `<option value="${A.esc(r.indicator)}">${A.esc(r.category)} · ${A.esc(r.indicator)}</option>`).join('');
      select.dataset.ready = 'true';
    }
    const name = select.value || select.options[0]?.value;
    const metaEl = document.getElementById('indicator-raw-meta');

    const RID = window.RAW_INDICATOR_DATA || {};
    const rawDates = RID.dates || [];
    const rawSeries = (RID.values && RID.values[name]) || [];
    const rawMeta = (RID.metadata && RID.metadata[name]) || {};
    const scoreDates = ISD.dates || [];
    const scoreSeries = indicatorValueSeries(name);
    const scoreMeta = (ISD.catalog && ISD.catalog[name]) || {};

    const merged = mergeDateSeries(rawDates, rawSeries, scoreDates, scoreSeries);
    const sliced = A.sliceDateRange(merged.dates, [merged.a, merged.b], indicatorRange);
    const [rawSliced, scoreSliced] = sliced.arrays;

    if (metaEl) {
      const parts = [rawMeta.primary_label, rawMeta.source_frequency, rawMeta.release_lag].filter(Boolean);
      metaEl.hidden = !parts.length;
      metaEl.textContent = parts.join(' · ');
    }

    indicatorChart = A.createChart(document.getElementById('indicator-chart'), indicatorDualChartOption(
      sliced.dates, rawSliced, rawMeta.primary_label, scoreSliced, scoreMeta.score_min, scoreMeta.score_max
    ));
    renderIndicatorSeriesTable(sliced.dates, rawSliced, scoreSliced, A.weightHistoryForIndicator(name), latestIndicatorScore(name));
  }

  function renderIndicators() {
    const defaultRows = (D.indicator_catalog || []).slice().sort((a,b) => {
      const ca = A.CATEGORY_ORDER.indexOf(a.category), cb = A.CATEGORY_ORDER.indexOf(b.category);
      return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb) || String(a.indicator).localeCompare(String(b.indicator), 'ko');
    });
    let rows = defaultRows;
    if (indicatorTableSort.key) {
      const key = indicatorTableSort.key, dir = indicatorTableSort.dir;
      const keyed = defaultRows.map(r => ({
        raw: r,
        category: r.category,
        indicator: r.indicator,
        score_min: r.score_min,
        latest: latestIndicatorScore(r.indicator),
        rule: r.current_scoring || r.rule || '',
        update_frequency: r.update_frequency
      }));
      keyed.sort((a, b) => A.compareSortValues(a[key], b[key], dir));
      rows = keyed.map(item => item.raw);
    }
    const asofNode = document.getElementById('indicator-asof');
    if (asofNode && Array.isArray(ISD.dates) && ISD.dates.length) {
      asofNode.textContent = `거시 · 변동성 위험 · 수급 · 기술적 · 펀더멘털 · 최신 점수 기준일 ${A.formatDate(ISD.dates[ISD.dates.length - 1])}`;
    }
    const indicatorHeadCell = (label, key, cls) => `<th${cls ? ` class="${cls}"` : ''} data-sort-key="${key}"${sortAttr(indicatorTableSort, key)}>${label}</th>`;
    document.getElementById('indicator-body').closest('table').querySelector('thead').innerHTML = `<tr>${indicatorHeadCell('분류', 'category')}${indicatorHeadCell('지표', 'indicator')}${indicatorHeadCell('스코어링 범위', 'score_min')}${indicatorHeadCell('최신 점수', 'latest', 'numeric')}<th>적용 방식</th>${indicatorHeadCell('전환 로직', 'rule')}${indicatorHeadCell('갱신 주기', 'update_frequency')}</tr>`;
    document.getElementById('indicator-body').innerHTML = rows.map(r => {
      const lo = r.score_min == null ? '-' : A.formatNumber(r.score_min, 2); const hi = r.score_max == null ? '-' : A.formatNumber(r.score_max, 2);
      const categoryKey = A.categoryKeyFromName(r.category);
      const latest = latestIndicatorScore(r.indicator);
      const latestCell = latest == null ? '-' : `<strong class="${A.metricClass(latest)}">${A.formatNumber(latest, 2)}</strong>`;
      const modeCell = MONTHLY_ELIGIBLE.has(r.indicator)
        ? (() => { const mode = indicatorMode(r.indicator); return `<div class="mode-toggle" data-indicator="${A.esc(r.indicator)}"><button type="button" class="mode-toggle-btn ${mode === 'daily' ? 'active' : ''}" data-mode="daily">일단위</button><button type="button" class="mode-toggle-btn ${mode === 'monthly' ? 'active' : ''}" data-mode="monthly">월말 스냅샷</button></div>`; })()
        : `<span class="small" style="color:var(--muted)">일단위 전용</span>`;
      return `<tr><td class="category-name"><span class="tag category-tag ${A.esc(categoryKey)}">${A.esc(r.category)}</span></td><td class="indicator">${A.esc(r.indicator)}</td><td class="nowrap">${lo} ~ ${hi}</td><td class="numeric">${latestCell}</td><td class="nowrap">${modeCell}</td><td class="rule">${A.esc(r.current_scoring || r.rule || '-')}</td><td class="nowrap small">${A.esc(r.update_frequency || '-')}</td></tr>`;
    }).join('');
  }

  function renderIndicatorModeStatus() {
    const el = document.getElementById('indicator-mode-status');
    if (!el) return;
    const monthlyNames = Array.from(MONTHLY_ELIGIBLE).filter(name => indicatorModes[name] === 'monthly');
    const savedModes = A.getIndicatorModes();
    const dirty = JSON.stringify(indicatorModes) !== JSON.stringify(savedModes);
    const summary = monthlyNames.length ? `월말 스냅샷 적용 중: ${monthlyNames.join(', ')}` : '전체 일단위 적용 중(기본값)';
    el.textContent = summary + (dirty ? ' · 저장되지 않은 변경 사항이 있습니다' : '');
  }
  function bindIndicatorModeControls() {
    document.getElementById('indicator-body').addEventListener('click', event => {
      const btn = event.target.closest('.mode-toggle-btn');
      if (!btn) return;
      const wrap = btn.closest('.mode-toggle');
      const name = wrap.dataset.indicator, mode = btn.dataset.mode;
      if (mode === 'daily') delete indicatorModes[name]; else indicatorModes[name] = 'monthly';
      renderIndicators();
      renderIndicatorModeStatus();
      renderScore(); renderLedger();
      if (document.getElementById('indicator-select').value === name) renderIndicatorTimeseries();
    });
    document.getElementById('save-indicator-modes').addEventListener('click', () => {
      A.saveIndicatorModes(indicatorModes);
      renderIndicatorModeStatus();
    });
    document.getElementById('reset-indicator-modes').addEventListener('click', () => {
      indicatorModes = {};
      A.saveIndicatorModes(indicatorModes);
      renderIndicators();
      renderIndicatorModeStatus();
      renderScore(); renderLedger(); renderIndicatorTimeseries();
    });
  }
  // '세부 지표·스코어링 범위'(표)/'선택 지표 시계열'(차트) 하위 탭 - 기본으로는 표만 보이므로
  // indicatorChart는 이 하위 탭으로 실제 전환될 때 비로소 그린다(hidden 컨테이너에서 초기화되며
  // 캔버스가 찌그러지는 걸 피하려고 - adjustment.js의 compareChart에서 이미 겪은 것과 같은
  // echarts 버그). renderIndicatorTimeseries()는 매번 A.createChart()로 다시 그리므로, 다른
  // 이벤트(토글 클릭 등)가 숨겨진 채로 먼저 한 번 그렸더라도 이 전환 시점에 다시 그려 덮어쓴다.
  function bindIndicatorViewTabs() {
    const root = document.getElementById('indicator-view-tabs');
    if (!root) return;
    root.querySelectorAll('.subtab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.subtab').forEach(item => item.classList.toggle('active', item === tab));
      const view = tab.dataset.indicatorView === 'timeseries' ? 'timeseries' : 'ledger';
      document.querySelector('[data-indicator-panel="ledger"]').hidden = view !== 'ledger';
      document.querySelector('[data-indicator-panel="timeseries"]').hidden = view !== 'timeseries';
      if (view === 'timeseries') requestAnimationFrame(renderIndicatorTimeseries);
    }));
  }

  function regimeClass(label) { return label === '강세' ? 'positive' : label === '약세' ? 'negative' : 'neutral'; }

  function renderLedgerChart(dates, values) {
    const regimes = values.map(v => A.regimeFromScore(v));
    const areas = [];
    let runStart = 0;
    for (let i = 1; i <= regimes.length; i++) {
      if (i === regimes.length || regimes[i] !== regimes[runStart]) {
        areas.push([
          { xAxis: dates[runStart], itemStyle: { color: REGIME_BAND_COLOR[regimes[runStart]] } },
          { xAxis: dates[i - 1] }
        ]);
        runStart = i;
      }
    }
    const option = A.lineOption({ dates, minY:0, maxY:100, yName:'점수', series:[{ name:'정량 스코어', data:values, color:'#102a43', width:2.4 }] });
    option.series[0].markArea = { silent:true, label:{ show:false }, data:areas };
    A.ensureLegendBefore('ledger-regime-legend', document.getElementById('ledger-chart'), REGIME_LEGEND_COLOR);
    ledgerChart = A.createChart(document.getElementById('ledger-chart'), option);
  }

  function renderLedger() {
    const s = effectiveAdjustedSeries();
    const sliced = A.sliceDateRange(s.dates, [s.observed], ledgerRange);
    const start = s.dates.length - sliced.dates.length;
    const rowsInWindow = [];
    for (let i = start; i < s.dates.length; i++) {
      const row = { date: s.dates[i], daily: s.daily[i], observed: s.observed[i], regime: A.regimeFromScore(s.observed[i]), negativeDaily: i > 0 && s.daily[i] - s.daily[i-1] <= -5 };
      A.CATEGORY_KEYS.forEach(key => { row[key] = s.categories[key][i]; });
      rowsInWindow.push(row);
    }
    const orderedRows = ledgerSort.key
      ? rowsInWindow.slice().sort((a, b) => A.compareSortValues(a[ledgerSort.key], b[ledgerSort.key], ledgerSort.dir))
      : rowsInWindow.slice().reverse();
    const ledgerHeadCell = (label, key, cls) => `<th${cls ? ` class="${cls}"` : ''} data-sort-key="${key}"${sortAttr(ledgerSort, key)}>${label}</th>`;
    const categoryHeadCells = A.CATEGORY_KEYS.map(key => ledgerHeadCell(A.categoryNameFromKey(key), key, 'numeric')).join('');
    document.getElementById('ledger-body').closest('table').querySelector('thead').innerHTML = `<tr>${ledgerHeadCell('일자', 'date')}${categoryHeadCells}${ledgerHeadCell('일별 정량 스코어', 'daily', 'numeric')}${ledgerHeadCell('이동 평균', 'observed', 'numeric')}${ledgerHeadCell('국면', 'regime')}</tr>`;
    A.renderVirtualRows(document.getElementById('ledger-body'), orderedRows.length, i => {
      const r = orderedRows[i];
      return `<tr><td class="nowrap">${A.formatDate(r.date)}</td>${A.CATEGORY_KEYS.map(key => `<td class="numeric">${A.formatNumber(r[key])}</td>`).join('')}<td class="numeric ${r.negativeDaily ? 'negative' : ''}">${A.formatNumber(r.daily)}</td><td class="numeric">${A.formatNumber(r.observed)}</td><td><strong class="${regimeClass(r.regime)}">${A.esc(r.regime)}</strong></td></tr>`;
    }, {emptyHtml:'<tr><td colspan="9" class="small">데이터 없음</td></tr>'});
    renderLedgerChart(sliced.dates, sliced.arrays[0]);
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindTabs(); renderScore(); renderIndicators(); renderIndicatorModeStatus(); bindIndicatorModeControls(); bindIndicatorViewTabs(); renderLedger(); activateHashTab();
    A.initRangeButtons(document.getElementById('ledger-ranges'), A.withScrollPreserved('#ledger-body', range => { ledgerRange = range; renderLedger(); }));
    document.getElementById('indicator-select').addEventListener('change', renderIndicatorTimeseries);
    A.initRangeButtons(document.getElementById('indicator-ranges'), A.withScrollPreserved('#indicator-detail-body', range => { indicatorRange = range; renderIndicatorTimeseries(); }));
    A.bindSortableHeaders(document.getElementById('indicator-detail-body').closest('table'), (key, dir) => { indicatorDetailSort = { key, dir }; renderIndicatorTimeseries(); });
    A.initRangeButtons(document.getElementById('quant-score-ranges'), range => { scoreRange = range; renderScore(); });
    window.addEventListener('aip5:adjustment-change', () => { renderScore(); renderLedger(); });
    // 이 페이지엔 조정값을 직접 편집하는 UI가 없어 위 커스텀 이벤트는 사실상 안 터진다 - 실제
    // 갱신 경로는 adjustment.html(다른 탭)에서 저장한 걸 storage 이벤트로 받는 것뿐인데, 이
    // 리스너가 없어서 renderScore/renderLedger(둘 다 A.adjustedSeries 사용)가 새로고침 전까지
    // 낡은 값을 보여주고 있었다.
    window.addEventListener('storage', event => {
      if (event.key === A.adjustmentSettingsStoreKey || event.key === A.adjustmentPeriodStoreKey) { renderScore(); renderLedger(); }
      // 다른 탭(같은 정량 분석 페이지)에서 지표별 토글을 저장한 경우 - 이 탭의 드래프트가
      // 낡은 값으로 남아있으면 나중에 이 탭에서 저장을 눌렀을 때 그 변경을 덮어써버린다.
      if (event.key === A.indicatorModeStoreKey) {
        indicatorModes = A.getIndicatorModes();
        renderIndicators(); renderIndicatorModeStatus(); renderScore(); renderLedger(); renderIndicatorTimeseries();
      }
    });
    A.bindSortableHeaders(document.getElementById('category-stat-body').closest('table'), (key, dir) => { categoryStatSort = { key, dir }; renderScore(); });
    A.bindSortableHeaders(document.getElementById('indicator-body').closest('table'), (key, dir) => { indicatorTableSort = { key, dir }; renderIndicators(); });
    A.bindSortableHeaders(document.getElementById('ledger-body').closest('table'), (key, dir) => { ledgerSort = { key, dir }; renderLedger(); });
  });
})();
