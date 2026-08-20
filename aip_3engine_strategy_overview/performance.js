(function () {
  'use strict';

  const A = window.AIP;
  const D = window.DASHBOARD_DATA || {};
  const ETF = window.REGIME_PORTFOLIO_MODES || {};
  const RANGE_MODE_METRICS = window.MODE_COMPARISON_RANGES || {};
  const MP_SNAPSHOT_STORE = 'aip-mp-snapshot-history-v1';
  let quantRange = '1';
  let mpRange = '1';
  let mpCustomRange = null; // {start, end} (YYYY-MM-DD) - 설정돼 있으면 프리셋 버튼보다 우선
  let mpMode = 'daily';
  let quantChartMode = 'daily';
  let quantModeSort = { key: null, dir: 'desc' };
  let mpModeSort = { key: null, dir: 'desc' };
  let quantChart, mpChart;
  const QUANT_PERFORMANCE_KEYS = { daily: 'performance', biweekly: 'performance_biweekly', monthly: 'performance_monthly' };

  // 세부 국면 배경색(연하게) - adjustment.js/quantitative.js에서 쓰는 3색조 팔레트를
  // detailedRegime()의 6가지 세부값 전체로 확장했다.
  const REGIME_BAND_COLOR = {
    '저변동성 강세장': 'rgba(0,132,114,.14)',
    '고변동성 강세장': 'rgba(0,132,114,.26)',
    '중립': 'rgba(97,120,139,.12)',
    '구조적 약세장': 'rgba(194,60,74,.22)',
    '이벤트적 약세장': 'rgba(194,60,74,.16)',
    '경기순환적 약세장': 'rgba(194,60,74,.10)'
  };
  // 차트 배경(markArea)용 옅은 색과 별개로, 범례 스와치는 알아볼 수 있게 불투명도를 올린다.
  const REGIME_LEGEND_COLOR = {
    '저변동성 강세장': 'rgba(0,132,114,.55)',
    '고변동성 강세장': 'rgba(0,132,114,.85)',
    '중립': 'rgba(97,120,139,.55)',
    '구조적 약세장': 'rgba(194,60,74,.75)',
    '이벤트적 약세장': 'rgba(194,60,74,.55)',
    '경기순환적 약세장': 'rgba(194,60,74,.35)'
  };
  function regimeMarkArea(dates, regimeByDate) {
    if (!dates.length) return [];
    const areas = [];
    let runStart = 0;
    for (let i = 1; i <= dates.length; i++) {
      const prev = regimeByDate.get(dates[runStart]) || '-';
      const cur = i < dates.length ? (regimeByDate.get(dates[i]) || '-') : null;
      if (i === dates.length || cur !== prev) {
        areas.push([
          { xAxis: dates[runStart], itemStyle: { color: REGIME_BAND_COLOR[prev] || 'rgba(150,150,150,.06)' } },
          { xAxis: dates[i - 1] }
        ]);
        runStart = i;
      }
    }
    return areas;
  }
  // '정량 스코어' 탭 원장에는 세부 국면이 직접 없어서(등급만 있는 게 아니라 매일의
  // 조정 적용 스코어로부터 다시 판정해야 함) A.adjustedSeries/A.detailedRegime로
  // 다른 페이지와 동일하게 재계산한다 - 값 자체는 D.scores와 100% 동일 소스.
  function quantRegimeByDate() {
    const settings = A.getSettings();
    const series = A.adjustedSeries(settings);
    const periods = A.getAdjustmentPeriods();
    const map = new Map();
    series.dates.forEach((d, i) => map.set(d, A.detailedRegimeForDate(d, series.observed[i], settings, periods)));
    return map;
  }
  // 'MP 기준' 탭 원장은 이미 각 행에 portfolio_regime이 들어있다(ETF 포트폴리오 목표를
  // 그 국면 그대로 적용한 결과이므로 이게 곧 세부 국면).
  function mpRegimeByDate(ledger) {
    return new Map(ledger.map(row => [row.date, row.portfolio_regime]));
  }
  function loadMpSnapshotHistory() {
    try { const list = JSON.parse(localStorage.getItem(MP_SNAPSHOT_STORE) || '[]'); return Array.isArray(list) ? list : []; }
    catch (_) { return []; }
  }
  function sliceCustomRange(dates, arrays, start, end) {
    let from = dates.findIndex(d => d >= start);
    if (from < 0) from = dates.length; // start가 데이터 범위보다 미래면 빈 결과
    let to = dates.length - 1;
    while (to >= 0 && dates[to] > end) to--;
    if (to < from) return { dates: [], arrays: arrays.map(() => []) };
    return { dates: dates.slice(from, to + 1), arrays: arrays.map(a => a.slice(from, to + 1)) };
  }

  function getMetric(metrics, key) {
    if (key === 'total_return') return metrics.total_return != null ? metrics.total_return : (metrics.final_equity != null ? metrics.final_equity - 1 : 0);
    if (key === 'annual_volatility') return metrics.annual_volatility != null ? metrics.annual_volatility : metrics.volatility;
    if (key === 'sharpe_rf0') return metrics.sharpe_rf0 != null ? metrics.sharpe_rf0 : metrics.sharpe;
    if (key === 'average_exposure') return metrics.average_exposure != null ? metrics.average_exposure : metrics.avg_exposure;
    if (key === 'annual_turnover') return metrics.annual_turnover != null ? metrics.annual_turnover : metrics.turnover_annual;
    return metrics[key];
  }

  function compoundEquity(returns) {
    let equity = 1;
    return returns.map(value => {
      equity *= 1 + A.number(value);
      return equity;
    });
  }

  function getQuantLedger(mode) {
    // When the user has saved a forced-regime override (성과분석 > 히스토리 탭),
    // rebuild this ledger client-side from the KOSPI200 raw price series instead
    // of reading the precomputed `D[...]` ledger, so the chart/table reflect the
    // override — respecting each mode's own rebalance calendar exactly (see
    // regime-override.js::computeQuantBacktest).
    if (A.getRegimeOverrides().length) {
      const recomputed = A.computeQuantBacktest(mode, A.getSettings());
      return {
        dates: recomputed.dates,
        strategyReturns: recomputed.strategy_return,
        marketReturns: recomputed.market_return,
        exposure: recomputed.exposure,
        turnover: recomputed.turnover,
        equity: recomputed.equity,
        bhEquity: recomputed.bh_equity
      };
    }
    const source = D[QUANT_PERFORMANCE_KEYS[mode] || 'performance'] || {};
    const dates = Array.isArray(source.dates) ? source.dates.slice() : [];
    const strategyReturns = dates.map((_, index) => A.number((source.strategy_return || [])[index]));
    const marketReturns = dates.map((_, index) => A.number((source.market_return || [])[index]));
    const exposure = dates.map((_, index) => A.number((source.exposure || [])[index]));
    const turnover = dates.map((_, index) => A.number((source.turnover || [])[index]));

    // Quant tab intentionally rebuilds both curves only from the KOSPI200 daily return ledger.
    // ETF equity and ETF return fields are never used in this path.
    return {
      dates,
      strategyReturns,
      marketReturns,
      exposure,
      turnover,
      equity: compoundEquity(strategyReturns),
      bhEquity: compoundEquity(marketReturns)
    };
  }

  function annualizedTurnover(turnover, dates) {
    if (!turnover.length || dates.length < 2) return 0;
    const days = Math.max(1, (new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000);
    return turnover.reduce((sum, value) => sum + A.number(value), 0) / (days / 365.25);
  }

  function cachedModeMetrics(key, range, fallback) {
    const cached = RANGE_MODE_METRICS[key] && RANGE_MODE_METRICS[key][range];
    return cached || fallback || {};
  }

  function rangedModeMetrics(mode, range) {
    const modeLedger = getQuantLedger(mode);
    const modeSliced = A.sliceDateRange(modeLedger.dates, [modeLedger.equity, modeLedger.strategyReturns, modeLedger.exposure, modeLedger.turnover], range);
    const [modeEquity, modeReturns, modeExposure, modeTurnover] = modeSliced.arrays;
    const metrics = A.dailyMetrics(modeSliced.dates, modeEquity, modeReturns);
    metrics.average_exposure = A.mean(modeExposure);
    metrics.annual_turnover = annualizedTurnover(modeTurnover, modeSliced.dates);
    return metrics;
  }

  function rangedBhMetrics(range) {
    // The B&H curve is identical across daily/biweekly/monthly modes, so the
    // daily ledger's bhEquity/marketReturns is a fine source regardless of mode.
    const modeLedger = getQuantLedger('daily');
    const modeSliced = A.sliceDateRange(modeLedger.dates, [modeLedger.bhEquity, modeLedger.marketReturns], range);
    const [bhEquity, marketReturns] = modeSliced.arrays;
    return A.dailyMetrics(modeSliced.dates, bhEquity, marketReturns);
  }

  function resolvedModeMetrics(key, range, fallback) {
    // Without an active regime override, keep using the precomputed
    // mode-comparison-ranges.js cache exactly as before (no behavior change).
    // With one active, the cache is stale for biweekly/monthly/B&H (it has no
    // notion of overrides) — recompute live from the override-aware ledger,
    // the same way the '일단위' row already does via getQuantLedger().
    if (!A.getRegimeOverrides().length) return cachedModeMetrics(key, range, fallback);
    if (key === 'bh') return rangedBhMetrics(range);
    return rangedModeMetrics(key, range);
  }

  function metricsRow(name, metrics) {
    return `<tr>
      <td>${name}</td>
      <td class="numeric ${A.metricClass(getMetric(metrics, 'total_return'))}">${A.formatPct(getMetric(metrics, 'total_return'))}</td>
      <td class="numeric">${A.formatPct(getMetric(metrics, 'cagr'))}</td>
      <td class="numeric">${A.formatPct(getMetric(metrics, 'annual_volatility'))}</td>
      <td class="numeric">${A.formatNumber(getMetric(metrics, 'sharpe_rf0'))}</td>
      <td class="numeric negative">${A.formatPct(getMetric(metrics, 'mdd'))}</td>
      <td class="numeric">${getMetric(metrics, 'average_exposure') == null ? '-' : A.formatPct(getMetric(metrics, 'average_exposure'))}</td>
      <td class="numeric">${getMetric(metrics, 'annual_turnover') == null ? '-' : A.formatPct(getMetric(metrics, 'annual_turnover'))}</td>
    </tr>`;
  }

  function showQuantDetail(date, sliced, regimeByDate) {
    const idx = sliced.dates.indexOf(date);
    if (idx < 0) return;
    const [equity, bhEquity, , , exposure] = sliced.arrays;
    const startEquity = equity[0] || 1, startBh = bhEquity[0] || 1;
    const stratReturn = equity[idx] / startEquity - 1;
    const bhReturn = bhEquity[idx] / startBh - 1;
    const panel = document.getElementById('quant-detail-panel');
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = `
      <div class="detail-heading"><strong>${A.formatDate(date)} 상세</strong><button type="button" id="quant-detail-close">닫기 ×</button></div>
      <div class="detail-stats">
        <div class="detail-stat"><span>세부 국면</span><strong>${A.esc(regimeByDate.get(date) || '-')}</strong></div>
        <div class="detail-stat"><span>조회기간 누적수익률 · 전략</span><strong class="${A.metricClass(stratReturn)}">${A.formatPct(stratReturn)}</strong></div>
        <div class="detail-stat"><span>조회기간 누적수익률 · B&amp;H</span><strong class="${A.metricClass(bhReturn)}">${A.formatPct(bhReturn)}</strong></div>
        <div class="detail-stat"><span>당일 노출도</span><strong>${A.formatPct(exposure[idx])}</strong></div>
      </div>`;
    const closeBtn = document.getElementById('quant-detail-close');
    if (closeBtn) closeBtn.addEventListener('click', () => { panel.hidden = true; });
  }

  function bindChartDetailClick(chart, sliced, regimeByDate, onPick) {
    if (!chart) return;
    chart.getZr().on('click', params => {
      const point = [params.offsetX, params.offsetY];
      if (!chart.containPixel('grid', point)) return;
      const idx = Math.round(chart.convertFromPixel({ xAxisIndex: 0 }, point)[0]);
      const date = sliced.dates[idx];
      if (date) onPick(date, sliced, regimeByDate);
    });
  }

  function renderQuant() {
    const ledger = getQuantLedger('daily');
    const sliced = A.sliceDateRange(ledger.dates, [ledger.equity, ledger.bhEquity, ledger.strategyReturns, ledger.marketReturns, ledger.exposure, ledger.turnover], quantRange);
    const [equity, bhEquity, strategyReturns, marketReturns, exposure, turnover] = sliced.arrays;
    const startEquity = equity[0] || 1;
    const startBh = bhEquity[0] || 1;
    const ranged = A.dailyMetrics(sliced.dates, equity, strategyReturns);
    ranged.average_exposure = A.mean(exposure);
    ranged.annual_turnover = annualizedTurnover(turnover, sliced.dates);
    const regimeByDate = quantRegimeByDate();
    const bands = regimeMarkArea(sliced.dates, regimeByDate);

    if (quantChartMode === 'all') {
      const biweeklyLedger = getQuantLedger('biweekly'), monthlyLedger = getQuantLedger('monthly');
      const modeSliced = A.sliceDateRange(ledger.dates, [biweeklyLedger.equity, monthlyLedger.equity], quantRange);
      const [biweeklyEquity, monthlyEquity] = modeSliced.arrays;
      const startBiweekly = biweeklyEquity[0] || 1, startMonthly = monthlyEquity[0] || 1;
      const option = A.lineOption({
        dates: sliced.dates,
        series: [
          { name: '일단위 KOSPI200 노출 전략', data: equity.map(value => value / startEquity), color: '#1771b9', width: 2.1 },
          { name: '격주 KOSPI200 노출 전략', data: biweeklyEquity.map(value => value / startBiweekly), color: '#008c7c', width: 2.1 },
          { name: '월말 KOSPI200 노출 전략', data: monthlyEquity.map(value => value / startMonthly), color: '#7454c5', width: 2.1 },
          { name: 'KOSPI200 B&H', data: bhEquity.map(value => value / startBh), color: '#b66e00', width: 2.1 }
        ]
      });
      option.series[0].markArea = { silent: true, label: { show: false }, data: bands };
      withRegimeTooltip(option, regimeByDate);
      quantChart = A.createChart(document.getElementById('quant-performance-chart'), option);
    } else {
      const modeLedger = quantChartMode === 'daily' ? ledger : getQuantLedger(quantChartMode);
      const modeEquity = quantChartMode === 'daily' ? equity : A.sliceDateRange(modeLedger.dates, [modeLedger.equity], quantRange).arrays[0];
      const modeStart = modeEquity[0] || 1;
      const modeLabel = quantChartMode === 'biweekly' ? '격주' : quantChartMode === 'monthly' ? '월말' : '일단위';
      const option = A.lineOption({
        dates: sliced.dates,
        series: [
          { name: `${modeLabel} KOSPI200 노출 전략`, data: modeEquity.map(value => value / modeStart), color: '#1771b9', width: 2.3 },
          { name: 'KOSPI200 B&H', data: bhEquity.map(value => value / startBh), color: '#b66e00', width: 2.1 }
        ]
      });
      option.series[0].markArea = { silent: true, label: { show: false }, data: bands };
      withRegimeTooltip(option, regimeByDate);
      quantChart = A.createChart(document.getElementById('quant-performance-chart'), option);
    }
    A.ensureLegendBefore('quant-regime-legend', document.getElementById('quant-performance-chart'), REGIME_LEGEND_COLOR);
    bindChartDetailClick(quantChart, sliced, regimeByDate, showQuantDetail);

    const comparison = Array.isArray(D.mode_comparison) ? D.mode_comparison : [];
    const findMode = (key, label) => comparison.find(row => row.key === key || row.label === label)?.metrics || {};
    const rows = [
      { name: '일단위', metrics: ranged },
      { name: '격주', metrics: resolvedModeMetrics('biweekly', quantRange, findMode('biweekly', '격주 리밸런싱')) },
      { name: '월말', metrics: resolvedModeMetrics('monthly', quantRange, findMode('monthly', '월말 리밸런싱')) },
      { name: 'KOSPI200 B&H', metrics: resolvedModeMetrics('bh', quantRange, findMode('KOSPI200_BH', 'KOSPI200 B&H')) }
    ];

    // Default (no header clicked yet) keeps the original fixed row order above.
    const displayRows = quantModeSort.key
      ? rows.slice().sort((a, b) => A.compareSortValues(
          quantModeSort.key === '__name__' ? a.name : (getMetric(a.metrics, quantModeSort.key) ?? a.name),
          quantModeSort.key === '__name__' ? b.name : (getMetric(b.metrics, quantModeSort.key) ?? b.name),
          quantModeSort.dir
        ))
      : rows;

    const QUANT_MODE_COLUMNS = [
      { key: '__name__', label: '실행 모드', numeric: false },
      { key: 'total_return', label: '기간 총수익률', numeric: true },
      { key: 'cagr', label: 'CAGR', numeric: true },
      { key: 'annual_volatility', label: '변동성', numeric: true },
      { key: 'sharpe_rf0', label: 'Sharpe', numeric: true },
      { key: 'mdd', label: 'MDD', numeric: true },
      { key: 'average_exposure', label: '평균 노출', numeric: true },
      { key: 'annual_turnover', label: '회전율', numeric: true }
    ];
    const quantTable = document.getElementById('quant-mode-body').closest('table');
    quantTable.querySelector('thead').innerHTML = `<tr>${QUANT_MODE_COLUMNS.map(col => {
      const classAttr = col.numeric ? ' class="numeric"' : '';
      const dirAttr = quantModeSort.key === col.key ? ` data-sort-dir="${quantModeSort.dir}"` : '';
      return `<th${classAttr} data-sort-key="${col.key}"${dirAttr}>${col.label}</th>`;
    }).join('')}</tr>`;

    document.getElementById('quant-mode-body').innerHTML = displayRows.map(row => metricsRow(row.name, row.metrics)).join('');
  }

  // MP 기준(ETF 포트폴리오) 쪽도 정량 스코어 비교표(#quant-mode-body)와 똑같이 "실행 모드가
  // 행, 지표가 열"인 구조로 일단위/격주/월단위/KOSPI200 B&H를 한 표에서 한눈에 비교한다 -
  // 예전엔 지금 선택된 모드 하나만(지표가 행, ETF 포트폴리오/KOSPI200 B&H가 열) 보여줘서
  // 리밸런싱 주기별로 비교하려면 select를 바꿔가며 매번 다시 봐야 했다.
  function rangedMpModeMetrics(mode) {
    const ledger = getEtfLedger(mode);
    const dates = ledger.map(row => row.date);
    // 여기도 sliceMpRange를 써야 커스텀 조회기간 적용 시 차트와 이 표가 어긋나지 않는다
    // (computeMpTableHtml 시절 이미 한 번 고쳤던 것과 동일한 이유).
    const sliced = sliceMpRange(dates, [
      ledger.map(row => row.equity),
      ledger.map(row => row.strategy_return),
      ledger.map(row => row.exposure),
      ledger.map(row => row.turnover)
    ]);
    const [equity, returns, exposure, turnover] = sliced.arrays;
    const metrics = A.dailyMetrics(sliced.dates, equity, returns);
    metrics.average_exposure = A.mean(exposure);
    metrics.annual_turnover = annualizedTurnover(turnover, sliced.dates);
    return metrics;
  }
  function rangedMpBhMetrics() {
    // 벤치마크(KOSPI200 B&H)는 모드와 무관하게 동일하므로 아무 모드의 원장에서나 가져오면 된다.
    const ledger = getEtfLedger('daily');
    const dates = ledger.map(row => row.date);
    const sliced = sliceMpRange(dates, [ledger.map(row => row.bh_equity), ledger.map(row => row.market_return)]);
    const [bhEquity, marketReturns] = sliced.arrays;
    return A.dailyMetrics(sliced.dates, bhEquity, marketReturns);
  }

  const MP_MODE_COLUMNS = [
    { key: '__name__', label: '실행 모드', numeric: false },
    { key: 'total_return', label: '기간 총수익률', numeric: true },
    { key: 'cagr', label: 'CAGR', numeric: true },
    { key: 'annual_volatility', label: '변동성', numeric: true },
    { key: 'sharpe_rf0', label: 'Sharpe', numeric: true },
    { key: 'mdd', label: 'MDD', numeric: true },
    { key: 'average_exposure', label: '평균 노출', numeric: true },
    { key: 'annual_turnover', label: '회전율', numeric: true }
  ];

  function renderMpModeTable() {
    const rows = [
      { name: '일단위', metrics: rangedMpModeMetrics('daily') },
      { name: '격주', metrics: rangedMpModeMetrics('biweekly') },
      { name: '월단위', metrics: rangedMpModeMetrics('monthly') },
      { name: 'KOSPI200 B&H', metrics: rangedMpBhMetrics() }
    ];
    const displayRows = mpModeSort.key
      ? rows.slice().sort((a, b) => A.compareSortValues(
          mpModeSort.key === '__name__' ? a.name : (getMetric(a.metrics, mpModeSort.key) ?? a.name),
          mpModeSort.key === '__name__' ? b.name : (getMetric(b.metrics, mpModeSort.key) ?? b.name),
          mpModeSort.dir
        ))
      : rows;
    const mpTable = document.getElementById('mp-metric-body').closest('table');
    mpTable.querySelector('thead').innerHTML = `<tr>${MP_MODE_COLUMNS.map(col => {
      const classAttr = col.numeric ? ' class="numeric"' : '';
      const dirAttr = mpModeSort.key === col.key ? ` data-sort-dir="${mpModeSort.dir}"` : '';
      return `<th${classAttr} data-sort-key="${col.key}"${dirAttr}>${col.label}</th>`;
    }).join('')}</tr>`;
    document.getElementById('mp-metric-body').innerHTML = displayRows.map(row => metricsRow(row.name, row.metrics)).join('');
  }

  function withRegimeTooltip(option, regimeByDate) {
    option.tooltip.formatter = params => {
      if (!params || !params.length) return '';
      const date = params[0].axisValue;
      const lines = params.map(p => `${p.marker}${p.seriesName}: ${A.formatNumber(p.value, 3)}`).join('<br>');
      return `<b>${A.formatDate(date)}</b> · 세부 국면 ${A.esc(regimeByDate.get(date) || '-')}<br>${lines}`;
    };
    return option;
  }
  function snapshotMarkLines(dates) {
    if (!dates.length) return [];
    const first = dates[0], last = dates[dates.length - 1];
    return loadMpSnapshotHistory()
      .map(s => String(s.signal_date || '').slice(0, 10))
      .filter(d => d && d >= first && d <= last)
      .map(d => ({ xAxis: d }));
  }
  function sliceMpRange(dates, arrays) {
    if (mpCustomRange) return sliceCustomRange(dates, arrays, mpCustomRange.start, mpCustomRange.end);
    return A.sliceDateRange(dates, arrays, mpRange);
  }
  // 이 날짜에 백테스트가 실제로 들고 있던 ETF 구성을 되짚는다 - "가장 가까운 저장 이력"
  // (portfolio.html에서 사용자가 수동 저장한, 완전히 별개의 엔진별·특성별 MP 스냅샷)을 쓰던
  // 예전 방식은 이 차트가 실제로 보여주는 백테스트 구성과 무관한 값을 보여줄 수 있었다(저장을
  // 한 번도 안 했거나, 저장 시점 설정이 그 이후 바뀌었거나, 스냅샷 날짜가 클릭한 시점과
  // 안 맞는 경우 전부) - 이제 그 날짜의 apply_date+regime_key(오버라이드 재계산 시) 또는
  // signal_date(정적 원장일 때, ETF.targets에서 그 시점 실제 holdings 조회)로 직접 복원한다.
  function holdingsForMpRow(row) {
    if (!row) return [];
    if (row.apply_date && row.regime_key) {
      const weights = A.etfWeightsForApplyDate(row.apply_date, row.regime_key) || {};
      return Object.entries(weights).map(([asset, weight]) => ({ asset, weight })).sort((a, b) => b.weight - a.weight);
    }
    const target = (ETF.targets || []).find(t => t.signal_date === row.signal_date);
    return (target && Array.isArray(target.holdings)) ? target.holdings : [];
  }
  function showMpDetail(date, sliced, regimeByDate, ledgerByDate) {
    const idx = sliced.dates.indexOf(date);
    if (idx < 0) return;
    const [equity, bhEquity] = sliced.arrays;
    const startEquity = equity[0] || 1, startBh = bhEquity[0] || 1;
    const stratReturn = equity[idx] / startEquity - 1;
    const bhReturn = bhEquity[idx] / startBh - 1;
    const row = ledgerByDate ? ledgerByDate.get(date) : null;
    const holdings = holdingsForMpRow(row);
    const panel = document.getElementById('mp-detail-panel');
    if (!panel) return;
    panel.hidden = false;
    const holdingsHtml = holdings.length
      ? `<div class="detail-holdings"><span class="detail-holdings-title">이 날짜에 실제로 편입된 ETF 구성 (${A.esc((row && row.portfolio_regime) || regimeByDate.get(date) || '-')})</span><div class="detail-holdings-list">${holdings.slice(0, 12).map(h => `<span>${A.esc(h.asset)} ${A.formatPct(h.weight, 1)}</span>`).join('')}</div></div>`
      : '';
    panel.innerHTML = `
      <div class="detail-heading"><strong>${A.formatDate(date)} 상세</strong><button type="button" id="mp-detail-close">닫기 ×</button></div>
      <div class="detail-stats">
        <div class="detail-stat"><span>세부 국면</span><strong>${A.esc(regimeByDate.get(date) || '-')}</strong></div>
        <div class="detail-stat"><span>조회기간 누적수익률 · ETF 포트폴리오</span><strong class="${A.metricClass(stratReturn)}">${A.formatPct(stratReturn)}</strong></div>
        <div class="detail-stat"><span>조회기간 누적수익률 · KOSPI200 B&amp;H</span><strong class="${A.metricClass(bhReturn)}">${A.formatPct(bhReturn)}</strong></div>
      </div>${holdingsHtml}`;
    const closeBtn = document.getElementById('mp-detail-close');
    if (closeBtn) closeBtn.addEventListener('click', () => { panel.hidden = true; });
  }

  function getEtfLedger(mode) {
    // Same override rebuild as getQuantLedger(), but for the ETF portfolio
    // backtest — see regime-override.js::computeEtfBacktest. ETF composition
    // only changes at month-end signal dates regardless of `mode`; `mode` here
    // only selects which exposure path (daily/biweekly/monthly) is applied on
    // top of that composition, matching the precomputed ledger's own semantics.
    if (A.getRegimeOverrides().length) return A.computeEtfBacktest(mode, A.getSettings());
    return (ETF.modes && ETF.modes[mode] && ETF.modes[mode].ledger) || [];
  }

  function renderMp() {
    // MP 기준 탭은 선차트와 하단 성과분석만 제공한다.
    // 차트 위의 4개 요약 카드(stat rail)는 레이아웃에서 제거한다.
    const mpMetrics = document.getElementById('mp-metrics');
    if (mpMetrics) mpMetrics.remove();
    const modes = ETF.modes || {};

    if (mpMode === 'all') {
      const dailyLedger = getEtfLedger('daily'), biweeklyLedger = getEtfLedger('biweekly'), monthlyLedger = getEtfLedger('monthly');
      const dates = dailyLedger.map(row => row.date);
      const sliced = sliceMpRange(dates, [
        dailyLedger.map(row => row.equity),
        biweeklyLedger.map(row => row.equity),
        monthlyLedger.map(row => row.equity),
        dailyLedger.map(row => row.bh_equity)
      ]);
      const [dailyEquity, biweeklyEquity, monthlyEquity, bhEquity] = sliced.arrays;
      const startDaily = dailyEquity[0] || 1, startBiweekly = biweeklyEquity[0] || 1, startMonthly = monthlyEquity[0] || 1, startBh = bhEquity[0] || 1;
      const regimeByDate = mpRegimeByDate(dailyLedger);
      const option = withRegimeTooltip(A.lineOption({
        dates: sliced.dates,
        series: [
          { name: `${modes.daily?.label || '일단위'} ETF 포트폴리오`, data: dailyEquity.map(value => value / startDaily), color: '#008c7c', width: 2.1 },
          { name: `${modes.biweekly?.label || '격주'} ETF 포트폴리오`, data: biweeklyEquity.map(value => value / startBiweekly), color: '#1771b9', width: 2.1 },
          { name: `${modes.monthly?.label || '월말'} ETF 포트폴리오`, data: monthlyEquity.map(value => value / startMonthly), color: '#7454c5', width: 2.1 },
          { name: 'KOSPI200 B&H', data: bhEquity.map(value => value / startBh), color: '#b66e00', width: 2.1 }
        ]
      }), regimeByDate);
      option.series[0].markArea = { silent: true, label: { show: false }, data: regimeMarkArea(sliced.dates, regimeByDate) };
      option.series[0].markLine = { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#153f5d', type: 'dashed', width: 1 }, data: snapshotMarkLines(sliced.dates) };
      mpChart = A.createChart(document.getElementById('mp-performance-chart'), option);
      A.ensureLegendBefore('mp-regime-legend', document.getElementById('mp-performance-chart'), REGIME_LEGEND_COLOR);
      // ETF 구성은 모드(일/격주/월말)와 무관하게 동일 신호일 기준으로 정해지므로(노출 배율만
      // 다름) '전체' 보기의 상세 패널도 dailyLedger 기준 구성을 그대로 쓰면 된다.
      const dailyByDate = new Map(dailyLedger.map(row => [row.date, row]));
      bindChartDetailClick(mpChart, { dates: sliced.dates, arrays: [dailyEquity, bhEquity] }, regimeByDate,
        (date, s, r) => showMpDetail(date, s, r, dailyByDate));
      renderMpModeTable();
      return;
    }

    const mode = modes[mpMode] || {};
    const ledger = getEtfLedger(mpMode);
    const dates = ledger.map(row => row.date);
    const sliced = sliceMpRange(dates, [
      ledger.map(row => row.equity),
      ledger.map(row => row.bh_equity),
      ledger.map(row => row.strategy_return),
      ledger.map(row => row.market_return)
    ]);
    const [equity, bhEquity] = sliced.arrays;
    const startEquity = equity[0] || 1;
    const startBh = bhEquity[0] || 1;
    const regimeByDate = mpRegimeByDate(ledger);

    const option = withRegimeTooltip(A.lineOption({
      dates: sliced.dates,
      series: [
        { name: `${mode.label || mpMode} ETF 포트폴리오`, data: equity.map(value => value / startEquity), color: '#008c7c', width: 2.3 },
        { name: 'KOSPI200 B&H', data: bhEquity.map(value => value / startBh), color: '#b66e00', width: 2.1 }
      ]
    }), regimeByDate);
    option.series[0].markArea = { silent: true, label: { show: false }, data: regimeMarkArea(sliced.dates, regimeByDate) };
    option.series[0].markLine = { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#153f5d', type: 'dashed', width: 1 }, data: snapshotMarkLines(sliced.dates) };
    mpChart = A.createChart(document.getElementById('mp-performance-chart'), option);
    A.ensureLegendBefore('mp-regime-legend', document.getElementById('mp-performance-chart'), REGIME_LEGEND_COLOR);
    const ledgerByDate = new Map(ledger.map(row => [row.date, row]));
    bindChartDetailClick(mpChart, { dates: sliced.dates, arrays: [equity, bhEquity] }, regimeByDate,
      (date, s, r) => showMpDetail(date, s, r, ledgerByDate));

    renderMpModeTable();
  }

  // ---------------------------------------------------------------------
  // 강제 국면 설정 관리 UI(추가/이력/삭제) 자체는 adjustment.html의 히스토리 탭으로
  // 이전했다 - 이 페이지는 그 저장소를 읽기만 해서 정량/MP 탭 배경밴드·배너에 반영한다.
  function renderOverrideBanners(list) {
    ['quant-override-banner', 'mp-override-banner'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = !list.length;
      if (list.length) el.innerHTML = `강제 국면 설정 ${list.length}건 적용 중 · <a href="adjustment.html#history">히스토리 탭에서 관리</a>`;
    });
  }
  function refreshOverrideBanners() {
    renderOverrideBanners(A.getRegimeOverrides());
  }
  // "MP 기준" 탭 조회 기간 입력 - 네이티브 <input type="date">의 연/월/일 세그먼트 자동이동은
  // 브라우저 내부 동작이라 스크립트로 보장할 수 없어서(환경에 따라 안 먹는 경우 확인됨),
  // 연/월/일을 별도 텍스트 인풋 3개로 나누고 자릿수가 다 차면 다음 칸으로 직접 넘긴다.
  // 기존 코드(mp-range-apply 등)는 그대로 #mp-range-start/#mp-range-end의 .value("YYYY-MM-DD")를
  // 읽으므로, 그 자리엔 숨김 인풋을 두고 세 칸이 바뀔 때마다 값을 합쳐 넣는다.
  function bindDateParts(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const yEl = container.querySelector('.date-part-y'), mEl = container.querySelector('.date-part-m'), dEl = container.querySelector('.date-part-d'), hidden = container.querySelector('input[type="hidden"]');
    if (!yEl || !mEl || !dEl || !hidden) return;
    function sync() {
      const y = yEl.value, m = mEl.value, d = dEl.value;
      hidden.value = (y.length === 4 && m.length && d.length) ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
    }
    function digitsOnly(el) { el.value = el.value.replace(/\D/g, ''); }
    yEl.addEventListener('input', () => { digitsOnly(yEl); if (yEl.value.length >= 4) { mEl.focus(); mEl.select(); } sync(); });
    mEl.addEventListener('input', () => { digitsOnly(mEl); if (mEl.value.length >= 2) { dEl.focus(); dEl.select(); } sync(); });
    dEl.addEventListener('input', () => { digitsOnly(dEl); sync(); });
    mEl.addEventListener('keydown', e => { if (e.key === 'Backspace' && !mEl.value) yEl.focus(); });
    dEl.addEventListener('keydown', e => { if (e.key === 'Backspace' && !dEl.value) mEl.focus(); });
  }
  function bindTabs() {
    const root = document.getElementById('performanceTabs');
    root.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
      root.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab.dataset.tab));
      const renderers = { quant: renderQuant, mp: renderMp };
      requestAnimationFrame(renderers[tab.dataset.tab] || renderQuant);
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindTabs();
    bindDateParts('mp-range-start-parts');
    bindDateParts('mp-range-end-parts');
    refreshOverrideBanners();
    renderQuant();
    renderMp();
    // 다른 탭/페이지(adjustment.html 히스토리 탭, override-detail.html 등)에서 강제 설정이나
    // 조정값을 바꾸면 이 배너·차트가 낡은 채로 남아있던 것을 반영.
    window.addEventListener('storage', event => {
      if (event.key === A.regimeOverrideStoreKey) { refreshOverrideBanners(); renderQuant(); renderMp(); }
      if (event.key === A.adjustmentSettingsStoreKey || event.key === A.adjustmentPeriodStoreKey || event.key === A.indicatorModeStoreKey) { renderQuant(); renderMp(); }
    });
    A.initRangeButtons(document.getElementById('quant-ranges'), range => { quantRange = range; renderQuant(); });
    A.initRangeButtons(document.getElementById('mp-ranges'), range => {
      mpRange = range;
      mpCustomRange = null;
      document.getElementById('mp-range-clear').hidden = true;
      renderMp();
    });
    document.getElementById('mp-mode').addEventListener('change', event => { mpMode = event.target.value; renderMp(); });
    const quantModeSelect = document.getElementById('quant-mode-select');
    if (quantModeSelect) quantModeSelect.addEventListener('change', event => { quantChartMode = event.target.value; renderQuant(); });
    A.bindSortableHeaders(document.getElementById('quant-mode-body').closest('table'), (key, dir) => { quantModeSort = { key, dir }; renderQuant(); });
    A.bindSortableHeaders(document.getElementById('mp-metric-body').closest('table'), (key, dir) => { mpModeSort = { key, dir }; renderMp(); });

    document.getElementById('mp-range-apply').addEventListener('click', () => {
      const start = document.getElementById('mp-range-start').value;
      const end = document.getElementById('mp-range-end').value;
      if (!start || !end || start > end) return;
      mpCustomRange = { start, end };
      document.getElementById('mp-ranges').querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('mp-range-clear').hidden = false;
      renderMp();
    });
    document.getElementById('mp-range-clear').addEventListener('click', () => {
      mpCustomRange = null;
      document.getElementById('mp-range-clear').hidden = true;
      const defaultBtn = document.getElementById('mp-ranges').querySelector('[data-range="1"]');
      if (defaultBtn) defaultBtn.classList.add('active');
      renderMp();
    });
  });
})();
