(function () {
  'use strict';

  const A = window.AIP;
  const D = window.DASHBOARD_DATA || {};
  const OD = window.REGIME_OVERRIDE_DATA || {};
  const STORE = 'aip-regime-override-history-v1';

  // ---------------------------------------------------------------------
  // Regime vocabulary mapping.
  //
  // The live quant-score display (A.detailedRegime) uses 6 labels: 저변동성
  // 강세장/고변동성 강세장/중립/구조적 약세장/이벤트적 약세장/경기순환적 약세장.
  // The ETF portfolio backtest (generate_quant_regime_portfolio.py::classify)
  // uses its own 5 regime_keys (bull_low_vol/bull_high_vol/neutral/
  // bear_structural/bear_trend) with no direct "event"/"cyclical" bear
  // equivalent (its README: "Event적 약세장은 Adjustment 작업 중단으로 생성하지
  // 않습니다"). The override UI is built on the JS 6-way vocabulary (it is
  // what the rest of the dashboard already shows the user), so forcing
  // "이벤트적 약세장" or "경기순환적 약세장" for the ETF backtest falls back to
  // bear_trend (the ETF system's only non-structural bear sleeve) — this is a
  // deliberate best-effort mapping, not a precise equivalence.
  const DETAILED_REGIME_TO_EXPOSURE = {
    '저변동성 강세장': 100, '고변동성 강세장': 100,
    '중립': 50,
    '구조적 약세장': 0, '이벤트적 약세장': 0, '경기순환적 약세장': 0
  };
  const DETAILED_REGIME_TO_ETF_KEY = {
    '저변동성 강세장': 'bull_low_vol', '고변동성 강세장': 'bull_high_vol',
    '중립': 'neutral',
    '구조적 약세장': 'bear_structural', '이벤트적 약세장': 'bear_trend', '경기순환적 약세장': 'bear_trend'
  };
  // Reverse lookup for the NATURAL (non-overridden) ETF regime label already
  // shipped in etf-data.js's targets[].portfolio_regime (its own vocabulary).
  const ETF_LABEL_TO_KEY = {
    '저변동성 강세장': 'bull_low_vol', '고변동성 강세장': 'bull_high_vol',
    '중립': 'neutral', '구조적 약세장': 'bear_structural',
    '추세적 약세장': 'bear_trend', '약세장(정량)': 'bear_trend'
  };
  const DETAILED_REGIME_OPTIONS = ['저변동성 강세장', '고변동성 강세장', '중립', '구조적 약세장', '이벤트적 약세장', '경기순환적 약세장'];
  const ETF_KEY_TO_LABEL = {
    bull_low_vol: '저변동성 강세장', bull_high_vol: '고변동성 강세장', neutral: '중립',
    bear_structural: '구조적 약세장', bear_trend: '추세적 약세장'
  };

  function detailedRegimeToExposure(regime) { return DETAILED_REGIME_TO_EXPOSURE[regime] != null ? DETAILED_REGIME_TO_EXPOSURE[regime] : 50; }
  function detailedRegimeToEtfKey(regime) { return DETAILED_REGIME_TO_ETF_KEY[regime] || 'neutral'; }

  // ---------------------------------------------------------------------
  // Override storage (managed on adjustment.html's 히스토리 tab; read by performance.html/portfolio.html/override-detail.html).
  function getOverrides() {
    try { const list = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(list) ? list : []; }
    catch (_) { return []; }
  }
  function saveOverrides(list) {
    localStorage.setItem(STORE, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('aip5:regime-override-change'));
  }
  function overlapsExisting(start, end, excludeId) {
    return getOverrides().some(o => o.id !== excludeId && start <= o.end && end >= o.start);
  }
  function addOverride({ start, end, regime, note }) {
    if (!start || !end || start > end) throw new Error('기간이 올바르지 않습니다.');
    if (!DETAILED_REGIME_OPTIONS.includes(regime)) throw new Error('세부 국면 값이 올바르지 않습니다.');
    if (overlapsExisting(start, end, null)) throw new Error('겹치는 기간의 강제 설정이 이미 있습니다.');
    const list = getOverrides();
    list.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, start, end, regime, note: note || '', createdAt: new Date().toISOString() });
    list.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    saveOverrides(list);
  }
  function deleteOverride(id) {
    saveOverrides(getOverrides().filter(o => o.id !== id));
  }
  function regimeForDate(dateStr, overrides) {
    for (let i = 0; i < overrides.length; i++) {
      const o = overrides[i];
      if (dateStr >= o.start && dateStr <= o.end) return o.regime;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // 특정 강제 설정 하나가 정량 스코어(일/격주/월말) 또는 MP 기준 백테스트에 실제로
  // 영향을 주는지 판정한다 - adjustment.html 히스토리 탭과 override-detail.html이
  // 공유(원래 performance.js에만 있던 로직을 이전 - 두 곳에서 똑같이 필요해졌기 때문).
  const OVERRIDE_QUANT_MODES = ['daily', 'biweekly', 'monthly'];
  function overrideAppliesToQuant(o) {
    const dates = (D.scores && D.scores.dates) || [];
    const result = {};
    OVERRIDE_QUANT_MODES.forEach(mode => {
      result[mode] = rebalanceDates(dates, mode).some(d => d >= o.start && d <= o.end);
    });
    return result;
  }
  function overrideAppliesToMp(o) {
    // SIGNAL 날짜(국면이 실제로 결정된 날) 기준 - computeEtfBacktest 자체의 override
    // 판정과 동일 기준(적용/실행일이 아니라 신호일)이라야 두 곳이 서로 어긋나지 않는다.
    //
    // apply_date 목록 자체도 computeEtfBacktest와 동일한 소스(OD.apply_dates - Python
    // 파이프라인의 실제 거래일 캘린더 기준)에서 가져오고, signal_date를 못 찾는 apply_date는
    // computeEtfBacktest와 똑같이 그 apply_date 자신을 신호일로 취급한다(fallback). 예전엔
    // window.REGIME_PORTFOLIO_MODES.targets만 훑었는데, targets는 매 빌드마다 "실제 거래일이
    // 아닌 signal_date+3일" 식의 임시 pending 항목이 하나 덧붙는 별도 생성 스크립트 산출물이라
    // OD.apply_dates와 최신월 경계에서 어긋날 수 있다 - 그러면 이 함수는 "미적용"이라고 하는데
    // computeEtfBacktest는 실제로 그 날짜를 신호일로 취급해 구성을 바꿔버리는 불일치가 생겼었다.
    const modes = window.REGIME_PORTFOLIO_MODES || {};
    const meta = modes.meta || {};
    const analysisStart = meta.analysis_start || '2022-09-01';
    const targets = modes.targets || [];
    const signalDateByApplyDate = new Map(targets.map(t => [t.apply_date, t.signal_date]));
    const applyDates = (OD.apply_dates || []).filter(d => d >= analysisStart);
    return applyDates.some(d => {
      const signalDate = signalDateByApplyDate.get(d) || d;
      return signalDate >= o.start && signalDate <= o.end;
    });
  }

  // ---------------------------------------------------------------------
  // Rebalance-date calendars — must exactly mirror
  // scripts/run_forward_valuation_rebalance.py::_biweekly_triggers/_monthly_triggers
  // and run_cycle_vol_adjustment_variant.py::_triggers (daily = every date).
  function rebalanceDates(dates, mode) {
    if (mode === 'daily') return dates.slice();
    const byMonth = new Map();
    dates.forEach(d => {
      const ym = d.slice(0, 7);
      if (!byMonth.has(ym)) byMonth.set(ym, []);
      byMonth.get(ym).push(d);
    });
    const result = [];
    byMonth.forEach(list => {
      if (mode === 'monthly') {
        result.push(list[list.length - 1]);
      } else if (mode === 'biweekly') {
        const half = Math.ceil(list.length / 2) - 1;
        result.push(list[half]);
        if (list[list.length - 1] !== list[half]) result.push(list[list.length - 1]);
      }
    });
    return result;
  }

  // ---------------------------------------------------------------------
  // Quant-score ("정량 스코어") backtest recompute — mirrors
  // run_cycle_vol_adjustment_variant.py::_daily_execution() exactly: signal on
  // a rebalance date takes effect at the NEXT trading day's open, blended as
  // (overnight leg at the OLD exposure) x (intraday leg at the NEW exposure).
  //
  // IMPORTANT: the backtest's NATURAL (non-overridden) signal must use the same
  // MA_WINDOW=120 and SCORE_HI/LO thresholds `run_cycle_vol_adjustment_variant.py`
  // was actually generated with — NOT `settings.observation`(60)/`scoreHi`(60)/
  // `scoreLo`(45), which govern the live, user-adjustable quantitative.html/
  // adjustment.html score display and are a DIFFERENT, independently-configurable
  // system, nor the category-adjustment settings ("분류별 스코어 조정") at all.
  // `A.ma120Series()` returns `D.scores.ma120_display_0_100` verbatim (guaranteeing
  // an exact match with `D.performance` when no override applies) UNLESS a
  // quantitative.html indicator daily/monthly toggle is active, in which case it
  // recomputes the same MA120 series with the toggled indicator swapped in —
  // still with zero category-adjustment influence. `D.scores.thresholds_display_0_100`
  // is unaffected either way (thresholds aren't part of the indicator toggle).
  function naturalDetailedRegime(displayScore, thresholds, settings, dateStr, periods) {
    const primary = displayScore >= thresholds.hi ? '강세' : displayScore <= thresholds.lo ? '약세' : '중립';
    const t = A.resolvedToggles(dateStr, settings, periods);
    return A.subRegimeLabel(primary, t.structural, t.event, t.highVol);
  }
  function computeQuantExposureAndRegime(mode, settings, overrides) {
    const dates = (D.scores && D.scores.dates) || [];
    const ma = A.ma120Series();
    const thresholds = (D.scores && D.scores.thresholds_display_0_100) || { hi: 60, lo: 40 };
    const periods = A.getAdjustmentPeriods();
    const rebalanceSet = new Set(rebalanceDates(dates, mode));
    const targetByDate = new Map(); // signal date -> {exposure, regime, forced}
    dates.forEach((d, i) => {
      if (!rebalanceSet.has(d)) return;
      const forced = regimeForDate(d, overrides);
      const regime = forced || naturalDetailedRegime(ma[i], thresholds, settings, d, periods);
      targetByDate.set(d, { exposure: detailedRegimeToExposure(regime) / 100, regime, forced: !!forced });
    });
    // Execution map: signal on date[i] executes at date[i+1]'s open.
    const execMap = new Map();
    dates.forEach((d, i) => {
      if (!targetByDate.has(d)) return;
      const execDate = dates[i + 1];
      if (execDate) execMap.set(execDate, targetByDate.get(d));
    });
    return { dates, execMap, targetByDate };
  }

  function computeQuantBacktest(mode, settings, overridesOverride) {
    // overridesOverride: 저장된 전체 히스토리 대신 특정 override 목록(예: override-detail.html이
    // "이 설정 하나만" 또는 "아무 것도 강제하지 않은 자연 국면"을 비교하려 할 때)을 강제로
    // 쓰고 싶을 때만 넘긴다 - 생략하면 항상 하던 대로 저장된 전체 히스토리를 읽는다.
    const overrides = Array.isArray(overridesOverride) ? overridesOverride : getOverrides();
    const feeOneWay = A.number((D.strategy && D.strategy.settings && D.strategy.settings.fee_one_way), 0.0025);
    const { execMap } = computeQuantExposureAndRegime(mode, settings, overrides);
    const kospi = OD.kospi200 || { dates: [], open: [], close: [] };
    const priceByDate = new Map();
    kospi.dates.forEach((d, i) => priceByDate.set(d, { open: kospi.open[i], close: kospi.close[i] }));

    // Iterate the FULL kospi200 axis (which starts years before the visible
    // backtest) so `previousClose`/`previousExposure` are already warmed up by
    // the time we reach the first output date — mirrors how the Python engine
    // iterates from 2001 but only appends rows once `date >= START`. We have no
    // client-side score history before 2010-01-04 (D.scores starts exactly
    // there), so the natural exposure signal cannot be reconstructed for the
    // 2001-2010 warmup window the Python engine actually had. Seed
    // `previousExposure` from the shipped ledger's own first-day value instead
    // of an arbitrary 0.5 default — this closes that gap for every date except
    // the (unavoidable) first calendar month of 2010, before the first natural
    // or forced signal of the visible history takes effect.
    const perfKey = mode === 'daily' ? 'performance' : mode === 'biweekly' ? 'performance_biweekly' : 'performance_monthly';
    const perfDates = (D[perfKey] && D[perfKey].dates) || [];
    const outputStart = perfDates[0];
    const seedExposure = A.number(D[perfKey] && D[perfKey].exposure && D[perfKey].exposure[0], 0.5);
    let previousExposure = seedExposure, previousClose = null, equity = 1.0;
    const outDates = [], outEquity = [], outStrategyReturn = [], outMarketReturn = [], outExposure = [], outTurnover = [], outCost = [];
    let bhEquity = 1.0;
    const outBhEquity = [];
    let started = false;
    for (let i = 0; i < kospi.dates.length; i++) {
      const d = kospi.dates[i];
      if (outputStart && d > perfDates[perfDates.length - 1]) break;
      const px = priceByDate.get(d);
      if (!px || px.open == null || px.close == null || previousClose == null) {
        if (px && px.close != null) previousClose = px.close;
        if (execMap.has(d)) previousExposure = execMap.get(d).exposure;
        continue;
      }
      const newExposure = execMap.has(d) ? execMap.get(d).exposure : previousExposure;
      const turnover = Math.abs(newExposure - previousExposure);
      const cost = turnover * feeOneWay;
      const factor = (1 + previousExposure * (px.open / previousClose - 1)) * (1 + newExposure * (px.close / px.open - 1)) - cost;
      const strategyReturn = factor - 1;
      const marketReturn = px.close / previousClose - 1;
      if (d >= outputStart) {
        if (!started) { equity = 1.0; bhEquity = 1.0; started = true; }
        equity *= 1 + strategyReturn;
        bhEquity *= 1 + marketReturn;
        outDates.push(d); outEquity.push(equity); outBhEquity.push(bhEquity);
        outStrategyReturn.push(strategyReturn); outMarketReturn.push(marketReturn);
        outExposure.push(newExposure); outTurnover.push(turnover); outCost.push(cost);
      }
      previousExposure = newExposure; previousClose = px.close;
    }
    return { dates: outDates, equity: outEquity, bh_equity: outBhEquity, strategy_return: outStrategyReturn, market_return: outMarketReturn, exposure: outExposure, turnover: outTurnover, cost: outCost };
  }

  // ---------------------------------------------------------------------
  // ETF portfolio ("MP 기준") backtest recompute — mirrors
  // scripts/build_regime_portfolio_modes_dashboard.py::build_mode_ledger()
  // exactly. ETF composition changes only at month-end signal dates (the
  // "monthly" rebalance calendar, regardless of which exposure mode is being
  // viewed); exposure for a given mode comes from that same mode's quant-score
  // exposure path (computed above), matching how the Python pipeline feeds
  // `source["performance"]["exposure"]` into this ledger.
  function buildAssetPriceMaps() {
    const maps = {};
    const assets = OD.assets || {};
    Object.keys(assets).forEach(name => {
      const a = assets[name];
      const m = new Map();
      for (let i = 0; i < a.dates.length; i++) m.set(a.dates[i], { open: a.open[i], close: a.close[i] });
      maps[name] = m;
    });
    return maps;
  }

  function forwardFillPrice(dateAxis, priceMap) {
    const open = [], close = [];
    let lastOpen = null, lastClose = null;
    for (let i = 0; i < dateAxis.length; i++) {
      const px = priceMap.get(dateAxis[i]);
      if (px && px.open != null) lastOpen = px.open;
      if (px && px.close != null) lastClose = px.close;
      open.push(lastOpen); close.push(lastClose);
    }
    return { open, close };
  }

  function computeEtfWeightsForDate(applyDate, regimeKey) {
    const byDate = (OD.weights_by_apply_date || {})[applyDate];
    if (!byDate) return null;
    return byDate[regimeKey] || null;
  }

  function computeEtfBacktest(mode, settings, overridesOverride) {
    const overrides = Array.isArray(overridesOverride) ? overridesOverride : getOverrides();
    const feeOneWay = 0.0025;
    const etfMeta = (window.REGIME_PORTFOLIO_MODES && window.REGIME_PORTFOLIO_MODES.meta) || {};
    const analysisStart = etfMeta.analysis_start || '2022-09-01';

    // Natural (non-overridden) portfolio_regime per apply_date, already shipped.
    const targets = (window.REGIME_PORTFOLIO_MODES && window.REGIME_PORTFOLIO_MODES.targets) || [];
    const naturalRegimeByApplyDate = new Map(targets.map(t => [t.apply_date, t.portfolio_regime]));
    const signalDateByApplyDate = new Map(targets.map(t => [t.apply_date, t.signal_date]));

    // ETF composition changes only at month-end signal dates. The override
    // check must use the SIGNAL date (the day the regime was actually decided),
    // not the apply/execution date (the next trading day the change takes
    // effect at open) — this matches how the "정량 스코어" engine checks
    // overrides against its own signal dates in computeQuantExposureAndRegime,
    // so both systems agree on what "inside the override window" means.
    const applyDates = (OD.apply_dates || []).filter(d => d >= analysisStart);
    const regimeKeyByApplyDate = new Map();
    // OD.apply_dates(export_regime_override_data.py, 실제 거래일 캘린더 기준)와
    // window.REGIME_PORTFOLIO_MODES.targets(build_regime_portfolio_modes_dashboard.py, 매
    // 빌드마다 "signal_date+3일" 임시 pending 항목을 하나 덧붙이는 별도 스크립트 산출물)는
    // 서로 다른 생성 스크립트의 결과라 최신월 경계에서 apply_date가 어긋날 수 있다 - targets에
    // 아직 없는(발행 지연된) apply_date를 "중립"으로 단정하면 실제로는 강세장이 이어지고
    // 있었을 수도 있는 기간의 자연 국면을 조용히 틀리게 되므로, 모르는 구간은 직전까지
    // 확인된 국면을 그대로 이어간다(rebalanceDates 없는 날 직전 비중을 유지하는 것과 같은
    // "모르면 바꾸지 않는다" 원칙 - simulateFullyInvestedPath의 drift 분기와 동일 철학).
    // lastKnownNaturalKey는 강제(forced) 국면과는 완전히 분리해서 추적해야 한다 - 이건 오직
    // "targets에 아직 없는 apply_date의 자연 국면을 추정하는" 용도인데, forced로 덮였던 값을
    // 여기 섞으면 그 강제 설정의 적용 구간이 끝난 뒤에도(다음 미확인 apply_date에서) 강제
    // 국면이 자연 국면인 것처럼 계속 새어나간다 - 실제로 이 버그로 "체크박스 끄고 저변동성/
    // 중립/경기순환적 약세장만 나와야 하는데 고변동성 강세장이 보인다"는 리포트가 있었다
    // (고변동성으로 강제한 구간 다음의 미확인 apply_date가 그 값을 그대로 물려받음).
    let lastKnownNaturalKey = null;
    applyDates.forEach(d => {
      const signalDate = signalDateByApplyDate.get(d) || d;
      const forced = regimeForDate(signalDate, overrides);
      if (forced) { regimeKeyByApplyDate.set(d, detailedRegimeToEtfKey(forced)); return; }
      const naturalLabel = naturalRegimeByApplyDate.get(d);
      if (naturalLabel) {
        const key = ETF_LABEL_TO_KEY[naturalLabel] || 'neutral';
        regimeKeyByApplyDate.set(d, key);
        lastKnownNaturalKey = key;
      } else {
        regimeKeyByApplyDate.set(d, lastKnownNaturalKey || 'neutral');
      }
    });

    // Exposure path for this mode, respecting the same overrides. Must pass `overrides`
    // through explicitly (not call computeQuantBacktest(mode, settings) bare) — otherwise
    // when a caller isolates a specific override list via `overridesOverride` (e.g.
    // override-detail.html comparing "this override only" vs "no overrides"), the exposure
    // layer would silently fall back to the full saved history instead of matching the
    // composition layer above, which does honor `overrides` correctly via regimeForDate().
    const quant = computeQuantBacktest(mode, settings, overrides);
    const exposureByDate = new Map();
    quant.dates.forEach((d, i) => exposureByDate.set(d, quant.exposure[i]));

    const dateAxis = OD.kospi200 ? OD.kospi200.dates.filter(d => d >= analysisStart) : [];
    const kospiByDate = new Map();
    if (OD.kospi200) OD.kospi200.dates.forEach((d, i) => kospiByDate.set(d, { open: OD.kospi200.open[i], close: OD.kospi200.close[i] }));
    const priceMaps = buildAssetPriceMaps();
    const alignedPrices = {};
    Object.keys(priceMaps).forEach(name => { alignedPrices[name] = forwardFillPrice(dateAxis, priceMaps[name]); });

    const applyDateSet = new Set(applyDates);
    let currentWeights = null;
    let currentRegimeKey = null;
    let currentApplyDate = null;
    let prevAssetWeights = {};
    let prevExposure = 0;
    let equity = 1.0, bhEquity = 1.0;
    let previousIdx = -1;
    const rows = [];
    for (let i = 0; i < dateAxis.length; i++) {
      const d = dateAxis[i];
      if (applyDateSet.has(d)) {
        currentRegimeKey = regimeKeyByApplyDate.get(d);
        currentApplyDate = d;
        currentWeights = computeEtfWeightsForDate(d, currentRegimeKey) || {};
      }
      if (!currentWeights) continue;
      const exp = Math.max(0, Math.min(1, exposureByDate.has(d) ? exposureByDate.get(d) : prevExposure));
      const desired = {};
      Object.keys(currentWeights).forEach(a => { const w = currentWeights[a] * exp; if (w > 1e-12) desired[a] = w; });
      const rebalanced = previousIdx < 0 || applyDateSet.has(d) || Math.abs(exp - prevExposure) > 1e-12;

      let overnightGrowth = 1.0, intraday, turnover = 0, cost = 0;
      let closeWeights = {};
      if (previousIdx < 0) {
        intraday = 1 - Object.values(desired).reduce((s, w) => s + w, 0);
        Object.keys(desired).forEach(a => {
          const p = alignedPrices[a]; if (!p) return;
          const op = p.open[i], cl = p.close[i];
          if (op != null && cl != null && op !== 0) intraday += desired[a] * (cl / op);
        });
        intraday = intraday > 0 ? intraday : 1.0;
        equity *= intraday;
        Object.keys(desired).forEach(a => {
          const p = alignedPrices[a]; if (!p) return;
          const op = p.open[i], cl = p.close[i];
          if (op != null && cl != null && op !== 0) closeWeights[a] = desired[a] * (cl / op) / intraday;
        });
      } else if (rebalanced) {
        const openValues = {};
        Object.keys(prevAssetWeights).forEach(a => {
          const p = alignedPrices[a]; if (!p) return;
          const prevClose = p.close[previousIdx], op = p.open[i];
          if (prevClose != null && prevClose !== 0 && op != null) openValues[a] = prevAssetWeights[a] * op / prevClose;
        });
        const prevCash = 1 - Object.values(prevAssetWeights).reduce((s, w) => s + w, 0);
        overnightGrowth = prevCash + Object.values(openValues).reduce((s, v) => s + v, 0);
        overnightGrowth = overnightGrowth > 0 ? overnightGrowth : 1.0;
        const preWeights = {};
        Object.keys(openValues).forEach(a => { preWeights[a] = openValues[a] / overnightGrowth; });
        const assetUnion = new Set([...Object.keys(desired), ...Object.keys(preWeights)]);
        turnover = 0.5 * Array.from(assetUnion).reduce((s, a) => s + Math.abs((desired[a] || 0) - (preWeights[a] || 0)), 0);
        cost = turnover * feeOneWay;
        intraday = 1 - Object.values(desired).reduce((s, w) => s + w, 0);
        Object.keys(desired).forEach(a => {
          const p = alignedPrices[a]; if (!p) return;
          const op = p.open[i], cl = p.close[i];
          if (op != null && cl != null && op !== 0) intraday += desired[a] * (cl / op);
        });
        intraday = intraday > 0 ? intraday : 1.0;
        equity *= overnightGrowth * (1 - cost) * intraday;
        Object.keys(desired).forEach(a => {
          const p = alignedPrices[a]; if (!p) return;
          const op = p.open[i], cl = p.close[i];
          if (op != null && cl != null && op !== 0) closeWeights[a] = desired[a] * (cl / op) / intraday;
        });
      } else {
        let gross = 1 - Object.values(prevAssetWeights).reduce((s, w) => s + w, 0);
        Object.keys(prevAssetWeights).forEach(a => {
          const p = alignedPrices[a]; if (!p) return;
          const prevClose = p.close[previousIdx], cl = p.close[i];
          const ratio = (prevClose != null && prevClose !== 0 && cl != null) ? cl / prevClose : 1.0;
          gross += prevAssetWeights[a] * ratio;
        });
        gross = gross > 0 ? gross : 1.0;
        equity *= gross;
        Object.keys(prevAssetWeights).forEach(a => {
          const p = alignedPrices[a]; if (!p) return;
          const prevClose = p.close[previousIdx], cl = p.close[i];
          const ratio = (prevClose != null && prevClose !== 0 && cl != null) ? cl / prevClose : 1.0;
          closeWeights[a] = prevAssetWeights[a] * ratio / gross;
        });
      }

      // Benchmark return: open-to-close on the very first day (matches
      // build_mode_ledger()'s `previous_date is None` branch), close-to-close
      // afterward.
      const kToday = kospiByDate.get(d);
      let marketRet = 0;
      if (previousIdx < 0) {
        if (kToday && kToday.open != null && kToday.close != null && kToday.open !== 0) marketRet = kToday.close / kToday.open - 1;
      } else {
        const kPrev = kospiByDate.get(dateAxis[previousIdx]);
        if (kToday && kPrev && kPrev.close) marketRet = kToday.close / kPrev.close - 1;
      }
      bhEquity *= 1 + marketRet;
      const prevEquity = rows.length ? rows[rows.length - 1].equity : 1.0;
      rows.push({
        date: d, portfolio_regime: ETF_KEY_TO_LABEL[currentRegimeKey] || currentRegimeKey,
        // apply_date/regime_key는 이 날짜에 실제로 어떤 ETF 조합이 쓰였는지 나중에 되짚어보기
        // 위한 것(예: performance.html MP 기준 차트 클릭 시 상세 패널) - computeEtfWeightsForDate
        // (export된 A.etfWeightsForApplyDate)로 이 두 값만 있으면 자산별 비중을 그대로 복원 가능.
        apply_date: currentApplyDate, regime_key: currentRegimeKey,
        exposure: exp, strategy_return: equity / prevEquity - 1, market_return: marketRet,
        equity, bh_equity: bhEquity, turnover, cost, rebalanced: rebalanced ? 1 : 0,
        active_asset_count: Object.keys(desired).length, target_weight_sum: Object.values(desired).reduce((s, w) => s + w, 0)
      });
      prevAssetWeights = closeWeights; prevExposure = exp; previousIdx = i;
    }
    let peak = -Infinity, bhPeak = -Infinity;
    rows.forEach(r => {
      peak = Math.max(peak, r.equity); r.drawdown = r.equity / peak - 1;
      bhPeak = Math.max(bhPeak, r.bh_equity); r.bh_drawdown = r.bh_equity / bhPeak - 1;
    });
    return rows;
  }

  // ---------------------------------------------------------------------
  // Generic fully-invested (no exposure scalar) drift/rebalance/fee equity
  // path — shared by any "reconstruct historical ETF holdings for a regime
  // sequence" feature (e.g. portfolio.html's engine/feature-weight MP). This
  // is deliberately a SEPARATE function from computeEtfBacktest() above
  // rather than a shared refactor of it: computeEtfBacktest's loop also has
  // to trigger a rebalance whenever EXPOSURE changes (not just composition),
  // which this simpler, always-100%-invested caller never needs — forcing
  // the two through one shared core risked subtly perturbing the
  // already-verified computeEtfBacktest arithmetic for no real benefit.
  function simulateFullyInvestedPath(dateAxis, rebalanceWeightsByDate, priceMaps, feeOneWay) {
    let currentWeights = null;
    let prevAssetWeights = {};
    let equity = 1.0;
    let previousIdx = -1;
    const rows = [];
    for (let i = 0; i < dateAxis.length; i++) {
      const d = dateAxis[i];
      const isRebalanceDay = rebalanceWeightsByDate.has(d);
      if (isRebalanceDay) currentWeights = rebalanceWeightsByDate.get(d);
      if (!currentWeights) continue;
      const desired = currentWeights;
      const rebalanced = previousIdx < 0 || isRebalanceDay;

      // 가격 데이터가 없는 자산(예: 조회 시작일보다 나중에 상장된 ETF)은 그 구간 비중을
      // 조용히 증발시키지 않고 "현금처럼"(ratio=1, 손익 0) 취급한다 - 그렇지 않으면
      // desired 비중 합계에서 이미 빠져나간 것으로 계산됐다가 되돌아오지 못해 첫날부터
      // 편입 비중만큼 즉시 손실 처리되는 버그가 생긴다.
      const intradayRatio = a => {
        const p = priceMaps[a]; if (!p) return 1;
        const op = p.open[i], cl = p.close[i];
        return (op != null && cl != null && op !== 0) ? cl / op : 1;
      };
      const overnightRatio = a => {
        const p = priceMaps[a]; if (!p) return 1;
        const prevClose = p.close[previousIdx], op = p.open[i];
        return (prevClose != null && prevClose !== 0 && op != null) ? op / prevClose : 1;
      };

      let overnightGrowth = 1.0, intraday, turnover = 0, cost = 0;
      let closeWeights = {};
      if (previousIdx < 0) {
        intraday = 1 - Object.values(desired).reduce((s, w) => s + w, 0);
        Object.keys(desired).forEach(a => { intraday += desired[a] * intradayRatio(a); });
        intraday = intraday > 0 ? intraday : 1.0;
        equity *= intraday;
        Object.keys(desired).forEach(a => { closeWeights[a] = desired[a] * intradayRatio(a) / intraday; });
      } else if (rebalanced) {
        const openValues = {};
        Object.keys(prevAssetWeights).forEach(a => { openValues[a] = prevAssetWeights[a] * overnightRatio(a); });
        const prevCash = 1 - Object.values(prevAssetWeights).reduce((s, w) => s + w, 0);
        overnightGrowth = prevCash + Object.values(openValues).reduce((s, v) => s + v, 0);
        overnightGrowth = overnightGrowth > 0 ? overnightGrowth : 1.0;
        const preWeights = {};
        Object.keys(openValues).forEach(a => { preWeights[a] = openValues[a] / overnightGrowth; });
        const assetUnion = new Set([...Object.keys(desired), ...Object.keys(preWeights)]);
        turnover = 0.5 * Array.from(assetUnion).reduce((s, a) => s + Math.abs((desired[a] || 0) - (preWeights[a] || 0)), 0);
        cost = turnover * feeOneWay;
        intraday = 1 - Object.values(desired).reduce((s, w) => s + w, 0);
        Object.keys(desired).forEach(a => { intraday += desired[a] * intradayRatio(a); });
        intraday = intraday > 0 ? intraday : 1.0;
        equity *= overnightGrowth * (1 - cost) * intraday;
        Object.keys(desired).forEach(a => { closeWeights[a] = desired[a] * intradayRatio(a) / intraday; });
      } else {
        let gross = 1 - Object.values(prevAssetWeights).reduce((s, w) => s + w, 0);
        Object.keys(prevAssetWeights).forEach(a => {
          const p = priceMaps[a]; if (!p) return;
          const prevClose = p.close[previousIdx], cl = p.close[i];
          const ratio = (prevClose != null && prevClose !== 0 && cl != null) ? cl / prevClose : 1.0;
          gross += prevAssetWeights[a] * ratio;
        });
        gross = gross > 0 ? gross : 1.0;
        equity *= gross;
        Object.keys(prevAssetWeights).forEach(a => {
          const p = priceMaps[a]; if (!p) return;
          const prevClose = p.close[previousIdx], cl = p.close[i];
          const ratio = (prevClose != null && prevClose !== 0 && cl != null) ? cl / prevClose : 1.0;
          closeWeights[a] = prevAssetWeights[a] * ratio / gross;
        });
      }

      const prevEquity = rows.length ? rows[rows.length - 1].equity : 1.0;
      rows.push({
        date: d, equity, strategy_return: equity / prevEquity - 1,
        turnover, cost, rebalanced: rebalanced ? 1 : 0,
        active_asset_count: Object.keys(desired).length,
        target_weight_sum: Object.values(desired).reduce((s, w) => s + w, 0)
      });
      prevAssetWeights = closeWeights; previousIdx = i;
    }
    let peak = -Infinity;
    rows.forEach(r => { peak = Math.max(peak, r.equity); r.drawdown = r.equity / peak - 1; });
    return rows;
  }

  window.AIP = Object.assign(window.AIP || {}, {
    detailedRegimeOptions: DETAILED_REGIME_OPTIONS,
    regimeOverrideStoreKey: STORE,
    getRegimeOverrides: getOverrides,
    addRegimeOverride: addOverride,
    deleteRegimeOverride: deleteOverride,
    regimeOverrideForDate: regimeForDate,
    overrideAppliesToQuant,
    overrideAppliesToMp,
    rebalanceDates,
    detailedRegimeToExposure,
    detailedRegimeToEtfKey,
    computeQuantBacktest,
    computeEtfBacktest,
    etfWeightsForApplyDate: computeEtfWeightsForDate,
    simulateFullyInvestedPath,
    buildAssetPriceMaps,
    forwardFillPrice
  });
})();
