(function () {
  'use strict';

  const D = window.DASHBOARD_DATA || {};
  const CATEGORY_ORDER = ['거시', '변동성 위험', '수급', '기술적', '펀더멘털'];
  const CATEGORY_KEYS = ['macro', 'vol', 'supply', 'technical', 'fundamental'];
  const CATEGORY_META = {
    macro: { name: '거시', color: '#7454c5' },
    vol: { name: '변동성 위험', color: '#c23c4a' },
    supply: { name: '수급', color: '#008c7c' },
    technical: { name: '기술적', color: '#1771b9' },
    fundamental: { name: '펀더멘털', color: '#b66e00' }
  };
  const CATEGORY_SOURCE_KEYS = { macro: '거시', vol: '변동성 위험', supply: '수급', technical: '기술적', fundamental: '펀더멘털' };
  const STORE = 'aip-five-menu-adjustment-v1';
  const ADJUSTMENT_PERIOD_STORE = 'aip-adjustment-period-history-v1';
  const DEFAULT_SETTINGS = { observation: 60, adjustments: { macro: 0, vol: 0, supply: 0, technical: 0, fundamental: 0 }, structural: false, event: false, highVol: false, scoreHi: 60, scoreLo: 45, ai: {
    structural: '',
    theme: '최근 가장 두드러진 테마는 한화에어로스페이스 대전사업장 중대재해(생산 일부 중단, 관련주 약세)와 삼성·SK·LG 등이 참여하는 정부 주도 메가프로젝트(반도체 투자 등) 관련 뉴스입니다.\n콘텐트리중앙·한양증권 등 중앙그룹 유동성 위기 관련 보도도 이 기간 내내 이어졌습니다.',
    sentiment: '뉴스만 보면 좋아 보이지만, 실제 큰 자금은 반대로 움직이고 있어 주의가 필요해요.\n\n* 뉴스 분위기: 관련 기사들이 평소보다 긍정적인 편이에요.\n* 실제 돈의 흐름: 외국인 투자자가 가장 많이 팔았고, 개인 투자자가 가장 많이 샀어요.\n* 시장의 불안 정도: 평소보다 다소 불안한 분위기예요.\n* 옵션 투자자들의 베팅: 옵션 투자자들이 상승 쪽에 매우 적극적으로 베팅하고 있어요.\n* 레버리지 투자 스트레스: 빚내서 투자했다가 강제로 처분되는 경우가 크게 늘었어요(레버리지 경고).',
    forecastNote: '한화에어로 중대재해·반도체 메가프로젝트 부각, 중앙그룹 유동성 위기 지속\n뉴스는 낙관적이나 외국인 매도·콜옵션 쏠림·레버리지 경고로 실제 자금은 반대 방향'
  } };

  function number(v, fallback = 0) {
    // Number('') / Number('   ') is 0, not NaN, so a cleared text input used
    // to silently parse as 0 instead of falling back — e.g. clearing "관측
    // 기간" and saving stored observation:1 (clamped) with no warning.
    if (typeof v === 'string') {
      const trimmed = v.replace(/,/g, '').trim();
      if (trimmed === '') return fallback;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : fallback;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function formatNumber(v, decimals = 1) { return number(v).toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
  function formatPct(v, decimals = 2) { return `${formatNumber(number(v) * 100, decimals)}%`; }
  function formatDate(v) { return String(v || '').replace(/-/g, '.'); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[s]); }
  function rollingMean(values, window) { return values.map((_, i) => { const s = Math.max(0, i - window + 1); let total = 0, count = 0; for (let j=s; j<=i; j++) { if (Number.isFinite(values[j])) { total += values[j]; count++; } } return count ? total / count : null; }); }
  function mean(values) { const a = values.filter(Number.isFinite); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; }
  function min(values) { const a = values.filter(Number.isFinite); return a.length ? Math.min(...a) : 0; }
  function max(values) { const a = values.filter(Number.isFinite); return a.length ? Math.max(...a) : 0; }

  function formatIntegerGroups(digits) { return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function applyCommaFormatting(input) { const mode = input.dataset.commaInput; const allowDecimal = mode === 'dec'; const allowNegative = mode === 'int-signed'; const prevLen = input.value.length; const caretFromEnd = prevLen - (input.selectionStart ?? prevLen); let raw = input.value; const negative = allowNegative && raw.trim().startsWith('-'); raw = raw.replace(/[^0-9.]/g, ''); let intPart = raw, decPart = null; if (allowDecimal) { const dot = raw.indexOf('.'); if (dot !== -1) { intPart = raw.slice(0, dot); decPart = raw.slice(dot + 1).replace(/\./g, ''); } } else { intPart = raw.replace(/\./g, ''); } intPart = intPart.replace(/^0+(?=\d)/, ''); let next = (negative ? '-' : '') + (intPart ? formatIntegerGroups(intPart) : ''); if (decPart !== null) next += '.' + decPart; input.value = next; const pos = Math.max(0, input.value.length - caretFromEnd); input.setSelectionRange(pos, pos); }
  document.addEventListener('input', event => { if (event.target && event.target.matches && event.target.matches('[data-comma-input]')) applyCommaFormatting(event.target); }, true);

  // 컬럼헤더 클릭 정렬: delegated listener를 table(또는 안정적인 조상)에 한 번만 바인딩 -
  // thead innerHTML을 통째로 다시 그리는 테이블(예: 지표별로 헤더 라벨이 바뀌는 보조 지표
  // 탭)에서도 th별 개별 addEventListener처럼 끊기지 않는다. 방향 상태는 th의
  // data-sort-dir에 저장하지만, 렌더 함수가 다시 그릴 때 자기 상태(sortKey/sortDir 변수)
  // 기준으로 매번 다시 표시해줘야 한다(innerHTML 교체 시 데이터 속성도 함께 사라지므로).
  // 정렬 비교자 공용화 - 문자열/숫자 어느 쪽이든 컬럼당 이 한 줄이면 됨:
  // rows.slice().sort((a,b) => A.compareSortValues(a[key], b[key], dir))
  function compareSortValues(a, b, dir) {
    const mul = dir === 'asc' ? 1 : -1;
    if (typeof a === 'string' || typeof b === 'string') return mul * String(a ?? '').localeCompare(String(b ?? ''), 'ko');
    const an = Number(a), bn = Number(b);
    const af = Number.isFinite(an) ? an : -Infinity, bf = Number.isFinite(bn) ? bn : -Infinity;
    return mul * (af - bf);
  }
  function bindSortableHeaders(root, onSort) {
    root.addEventListener('click', event => {
      const th = event.target.closest('th[data-sort-key]');
      if (!th || !root.contains(th)) return;
      const currentDir = th.dataset.sortDir;
      const nextDir = currentDir === 'asc' ? 'desc' : (currentDir === 'desc' ? 'asc' : (th.dataset.sortDefault || 'desc'));
      root.querySelectorAll('th[data-sort-key]').forEach(node => { delete node.dataset.sortDir; });
      th.dataset.sortDir = nextDir;
      onSort(th.dataset.sortKey, nextDir);
    });
  }
  function renderVirtualRows(tbody, totalRows, rowRenderer, options) {
    const opts = options || {};
    const rowHeight = opts.rowHeight || 47.65;
    const buffer = opts.buffer || 10;
    const container = tbody.closest('.ts-table-scroll');
    function paint() {
      if (!totalRows) { tbody.innerHTML = opts.emptyHtml || ''; return; }
      const scrollTop = (container && container.scrollTop) || 0;
      const viewportHeight = (container && container.clientHeight) || 995;
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
      const end = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer);
      const topHeight = start * rowHeight, bottomHeight = (totalRows - end) * rowHeight;
      let html = '';
      if (topHeight > 0) html += `<tr aria-hidden="true"><td colspan="20" style="padding:0;border:0;height:${topHeight}px"></td></tr>`;
      for (let i = start; i < end; i++) html += rowRenderer(i);
      if (bottomHeight > 0) html += `<tr aria-hidden="true"><td colspan="20" style="padding:0;border:0;height:${bottomHeight}px"></td></tr>`;
      tbody.innerHTML = html;
    }
    tbody._vsPaint = paint;
    if (container && !container.dataset.vsBound) {
      container.dataset.vsBound = 'true';
      container.addEventListener('scroll', () => {
        if (container._vsRaf) return;
        container._vsRaf = requestAnimationFrame(() => { container._vsRaf = null; if (tbody._vsPaint) tbody._vsPaint(); });
      });
    }
    if (container) container.scrollTop = 0;
    paint();
  }

  // Keep the header identical on every page.  The original static fragments
  // had diverged over time (including broken encoded labels), so build this
  // small, shared shell from the same DOM recipe on load.
  function syncSharedHeader() {
    const header = document.querySelector('.aip-site-header');
    if (!header) return;
    // header-runtime.js가 나중에 이 헤더를 덮어써서 화면엔 안 보이지만, 이 함수는 여전히
    // 호출되며(죽은 코드 아님, QA로 확인) window.location.pathname 문자열 매칭은
    // 폴더를 다른 이름으로 복사/배포하거나 이 폴더 자체를 웹 루트로 서빙하면 오판한다
    // (header-runtime.js에서 이미 고친 것과 동일한 버그 - document.currentScript 기반으로 교체).
    const scriptSrc = (document.currentScript && document.currentScript.getAttribute('src')) || '';
    const inSet = !scriptSrc.startsWith('aip_3engine_strategy_overview/');
    const prefix = inSet ? '' : 'aip_3engine_strategy_overview/';
    const active = document.body && document.body.dataset ? document.body.dataset.page || '' : '';
    const links = [
      ['quantitative', '\uC815\uB7C9 \uBD84\uC11D', 'quantitative.html'],
      ['adjustment', 'Adjustment', 'adjustment.html'],
      ['portfolio', '\uD3EC\uD2B8\uD3F4\uB9AC\uC624', 'portfolio.html'],
      ['performance', '\uC131\uACFC \uBD84\uC11D', 'performance.html']
    ];

    const inner = document.createElement('div');
    inner.className = 'aip-header-inner';
    const brand = document.createElement('a');
    brand.className = 'aip-brand';
    brand.href = inSet ? 'index.html' : `${prefix}index.html`;
    brand.setAttribute('aria-label', '\uC804\uB7B5 \uAC1C\uC694 \uD648');
    const logo = document.createElement('img');
    logo.src = `${prefix}favicon.svg`;
    logo.alt = 'AIP';
    const brandText = document.createElement('span');
    brandText.textContent = 'AIP X DeepSearch Indicator';
    brand.append(logo, brandText);

    const nav = document.createElement('nav');
    nav.className = 'aip-primary-nav';
    nav.setAttribute('aria-label', '\uC8FC\uC694 \uBA54\uB274');
    links.forEach(([key, label, href]) => {
      const link = document.createElement('a');
      link.className = 'aip-nav-link';
      if (active === key) link.classList.add('active');
      link.href = `${prefix}${href}`;
      link.textContent = label;
      nav.append(link);
    });

    const status = document.createElement('div');
    status.className = 'aip-header-status';
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    const statusText = document.createElement('span');
    const asOf = String(D.meta && (D.meta.data_as_of || D.meta.as_of) || '2026-07-31').slice(0, 10).replace(/-/g, '.');
    statusText.textContent = `\uAE30\uC900\uC77C ${asOf}`;
    status.append(dot, statusText);
    inner.append(brand, nav, status);
    header.replaceChildren(inner);
  }

  function getSettings() {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORE) || '{}'), adjustments: { ...DEFAULT_SETTINGS.adjustments, ...(JSON.parse(localStorage.getItem(STORE) || '{}').adjustments || {}) }, ai: { ...DEFAULT_SETTINGS.ai, ...(JSON.parse(localStorage.getItem(STORE) || '{}').ai || {}) } }; }
    catch (_) { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
  }
  function saveSettings(next) { localStorage.setItem(STORE, JSON.stringify(next)); window.dispatchEvent(new CustomEvent('aip5:adjustment-change', { detail: next })); }
  function resetSettings() { localStorage.removeItem(STORE); const next = getSettings(); window.dispatchEvent(new CustomEvent('aip5:adjustment-change', { detail: next })); return next; }

  // ---------------------------------------------------------------------
  // 기간 지정 조정(분류별 스코어 조정을 특정 시작일~종료일에만 적용) - regime-override.js의
  // 강제 국면 저장소와 동일한 패턴(리스트+겹침 방지+id/createdAt)이지만 국면 라벨이 아니라
  // 카테고리별 조정값을 담는다. 기간이 없는 날짜는 계속 위 settings.adjustments(항상 켜져
  // 있는 기본 조정값)를 쓰므로, 이 기능을 한 번도 안 쓴 사용자는 기존 동작과 완전히 동일하다.
  function getAdjustmentPeriods() {
    try { const list = JSON.parse(localStorage.getItem(ADJUSTMENT_PERIOD_STORE) || '[]'); return Array.isArray(list) ? list : []; }
    catch (_) { return []; }
  }
  function saveAdjustmentPeriods(list) {
    localStorage.setItem(ADJUSTMENT_PERIOD_STORE, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('aip5:adjustment-period-change'));
  }
  function adjustmentPeriodOverlaps(start, end, excludeId) {
    return getAdjustmentPeriods().some(p => p.id !== excludeId && start <= p.end && end >= p.start);
  }
  function addAdjustmentPeriod({ start, end, adjustments, note, structural, event, highVol }) {
    if (!start || !end || start > end) throw new Error('기간이 올바르지 않습니다.');
    if (adjustmentPeriodOverlaps(start, end, null)) throw new Error('겹치는 기간의 조정 설정이 이미 있습니다.');
    const clean = {};
    CATEGORY_KEYS.forEach(key => { clean[key] = clamp(Math.round(number(adjustments && adjustments[key])), -30, 30); });
    const list = getAdjustmentPeriods();
    list.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, start, end, adjustments: clean, structural: !!structural, event: !!event, highVol: !!highVol, note: note || '', createdAt: new Date().toISOString() });
    list.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    saveAdjustmentPeriods(list);
  }
  function deleteAdjustmentPeriod(id) {
    saveAdjustmentPeriods(getAdjustmentPeriods().filter(p => p.id !== id));
  }
  // 기간별 조정 이력 표에서 값(조정 수치/종료일/세부국면축/메모)을 바로 수정할 때 쓴다 -
  // addAdjustmentPeriod와 달리 시작일은 건드리지 않는다(항상 저장 시점의 오늘로 고정되는
  // 필드라 편집 대상이 아님). patch에 없는 필드는 기존 값을 그대로 유지.
  function updateAdjustmentPeriod(id, patch) {
    const list = getAdjustmentPeriods();
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) throw new Error('해당 기간을 찾을 수 없습니다.');
    const current = list[idx];
    const start = current.start;
    const end = patch.end != null ? patch.end : current.end;
    if (!start || !end || start > end) throw new Error('기간이 올바르지 않습니다.');
    if (adjustmentPeriodOverlaps(start, end, id)) throw new Error('겹치는 기간의 조정 설정이 이미 있습니다.');
    const adjustments = { ...current.adjustments };
    if (patch.adjustments) CATEGORY_KEYS.forEach(key => { if (patch.adjustments[key] != null) adjustments[key] = clamp(Math.round(number(patch.adjustments[key])), -30, 30); });
    const next = {
      ...current, start, end, adjustments,
      structural: patch.structural != null ? !!patch.structural : current.structural,
      event: patch.event != null ? !!patch.event : current.event,
      highVol: patch.highVol != null ? !!patch.highVol : current.highVol,
      note: patch.note != null ? patch.note : current.note
    };
    list[idx] = next;
    list.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    saveAdjustmentPeriods(list);
    return next;
  }
  // 기간 하나를 통째로 반환한다(카테고리 조정값만이 아니라) - 세부 국면 축 사용 여부
  // (structural/event/highVol)도 이 기간에 함께 저장되므로, 호출부가 둘 다 읽을 수
  // 있어야 한다. 이 필드가 없는(기능 추가 이전에 저장된) 구버전 기간은 각 필드가
  // undefined이므로, 읽는 쪽에서 "이 기간은 이 축을 override하지 않는다"로 취급하고
  // 전역 설정값으로 폴백해야 한다.
  function adjustmentPeriodForDate(dateStr, periods) {
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (dateStr >= p.start && dateStr <= p.end) return p;
    }
    return null;
  }
  // detailedRegime()의 강세/약세 세부 분기(구조적/이벤트적/고변동성)만 뽑아낸 공용 조각 -
  // regime-override.js의 naturalDetailedRegime()도 강세/약세 1차 판정 기준(ma120 vs
  // settings.scoreHi/Lo)은 서로 다르지만 이 세부 분기 로직은 완전히 동일해야 하므로,
  // 중복 구현 대신 이 함수를 공유한다.
  function subRegimeLabel(primary, structural, event, highVol) {
    if (primary === '강세') return highVol ? '고변동성 강세장' : '저변동성 강세장';
    if (primary === '약세') return structural ? '구조적 약세장' : event ? '이벤트적 약세장' : '경기순환적 약세장';
    return '중립';
  }
  // 해당 날짜를 덮는 기간 조정이 있으면 그 기간의 축 사용 여부를, 없으면(또는 그 기간에
  // 해당 필드가 없으면) 전역 settings 값을 쓴다 - adjustedSeries()가 카테고리 조정값에
  // 이미 적용 중인 "기간 우선, 없으면 전역" 패턴과 동일.
  function resolvedToggles(dateStr, settings, periods) {
    const period = dateStr != null && periods && periods.length ? adjustmentPeriodForDate(dateStr, periods) : null;
    return {
      structural: period && period.structural != null ? period.structural : settings.structural,
      event: period && period.event != null ? period.event : settings.event,
      highVol: period && period.highVol != null ? period.highVol : settings.highVol
    };
  }

  // 지표별 일단위/월단위 적용 토글(정량 분석 페이지의 "세부 지표" 탭에서 편집) - 사이트
  // 전체의 A.adjustedSeries() 소비처(국면예보/포트폴리오 특성비중 백테스트/성과분석/정량분석)가
  // 모두 이 토글을 반영해야 한다는 사용자 확인에 따라 quantitative.js 전용 로컬 함수였던 것을
  // 여기 공용으로 옮겼다. 부재(localStorage에 저장 안 된) = 일단위(현재 프로젝트 상태 기본값).
  // ETF MP 백테스트(regime-override.js::computeQuantExposureAndRegime)의 D.scores.ma120_display_0_100도
  // 이 토글을 반영해야 한다는 추가 확인에 따라 ma120Series()(아래)로 같은 처리 - 단 이 시리즈는
  // "분류별 스코어 조정"(사용자 조정치)은 절대 반영하지 않는다(원래부터 settings.observation/
  // scoreHi/scoreLo와 별개인 고정 컨벤션이었고, 그 성질 자체는 그대로 유지).
  const INDICATOR_MODE_STORE = 'aip-quant-indicator-mode-v1';
  function getIndicatorModes() { try { const v = JSON.parse(localStorage.getItem(INDICATOR_MODE_STORE) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
  function saveIndicatorModes(modes) { localStorage.setItem(INDICATOR_MODE_STORE, JSON.stringify(modes)); window.dispatchEvent(new CustomEvent('aip5:indicator-mode-change')); }
  function monthlyEligibleIndicators() { const isd = window.INDICATOR_SCORE_DATA; return (isd && isd.indicators_month_end) || {}; }
  function indicatorMode(name, modes) { return (name in monthlyEligibleIndicators()) && modes[name] === 'monthly' ? 'monthly' : 'daily'; }
  function indicatorValueSeries(name, modes) {
    const isd = window.INDICATOR_SCORE_DATA || {};
    if (indicatorMode(name, modes) === 'monthly' && isd.indicators_month_end && isd.indicators_month_end[name]) return isd.indicators_month_end[name];
    return (isd.indicators && isd.indicators[name]) || [];
  }
  // D.ic.history는 월말 시점별 IC 가중치 스냅샷(지표명→0.5/1.0/1.5) 배열 - "PIT monthly IC
  // weights for daily score calculation"(생성 스크립트 주석). 이달 점수 계산엔 "전월 말"
  // 스냅샷이 쓰인다(스코어 계산 자체가 미래 데이터를 참조하지 않는 PIT 설계) - 그래서
  // 특정 관측일에 적용된 가중치를 구할 땐 그 날짜 이하인 마지막 스냅샷을 찾는다.
  function weightHistoryForIndicator(name) {
    const history = (D.ic && D.ic.history) || [];
    return history.map(h => ({ date: h.date, weight: h[name] })).filter(r => r.weight != null);
  }
  function weightAsOf(weightHistory, dateStr) {
    let lo = 0, hi = weightHistory.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      // <=(이하)여야 한다 - 파이프라인의 실제 캐시 조회(prior_keys = cache_keys[cache_keys
      // <= date])도 월말 스냅샷 그 날짜 자신에게는 그 달 자신의 새 가중치를 적용한다.
      // 엄격한 <로 두면 매월 마지막 거래일 하루만 전달 가중치를 잘못 가져온다(실측으로
      // 발견 - 클라이언트 재계산값이 서버 categories와 그 날짜에서만 어긋났었다).
      if (weightHistory[mid].date <= dateStr) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return found >= 0 ? weightHistory[found].weight : null;
  }
  function categoryHasMonthlyToggle(categoryName, modes) {
    return (D.indicator_catalog || []).some(row => row.category === categoryName && indicatorMode(row.indicator, modes) === 'monthly');
  }
  // score_at()(research_technical_variant.py)과 동일한 공식: 분류점수 = Σ(가중치×점수)/Σ(가중치)
  // (그 날짜에 값이 있는 지표만), 이어서 (원점수+1)*50으로 0~100 표시값 변환. 서버
  // D.scores.categories 대비 전 구간·전 분류 실측 검증 완료(오차 ~0 - "기술적" 분류는 애초에
  // 토글 가능 지표가 없어 이 함수 호출 대상이 되지 않는다).
  function recomputeCategoryRaw(categoryName, dates, modes) {
    const rows = (D.indicator_catalog || []).filter(row => row.category === categoryName);
    const weightHistories = {};
    rows.forEach(row => { weightHistories[row.indicator] = weightHistoryForIndicator(row.indicator); });
    const seriesByIndicator = {};
    rows.forEach(row => { seriesByIndicator[row.indicator] = indicatorValueSeries(row.indicator, modes); });
    return dates.map((d, i) => {
      let num = 0, den = 0;
      rows.forEach(row => {
        const v = Number(seriesByIndicator[row.indicator][i]);
        if (!Number.isFinite(v)) return;
        const w = weightAsOf(weightHistories[row.indicator], d);
        const weight = w == null ? 1 : w;
        num += weight * v; den += weight;
      });
      return den ? clamp((num / den + 1) * 50, 0, 100) : null;
    });
  }
  function hasAnyMonthlyToggle(indicatorModes = getIndicatorModes()) {
    return Object.keys(monthlyEligibleIndicators()).some(name => indicatorModes[name] === 'monthly');
  }
  function categorySources(dates, indicatorModes) {
    const category = (D.scores && D.scores.categories) || {};
    const sources = {};
    CATEGORY_KEYS.forEach(key => {
      const categoryName = CATEGORY_SOURCE_KEYS[key];
      sources[key] = categoryHasMonthlyToggle(categoryName, indicatorModes)
        ? recomputeCategoryRaw(categoryName, dates, indicatorModes)
        : (category[categoryName] || category[key] || []);
    });
    return sources;
  }
  function adjustedSeries(settings = getSettings(), indicatorModes = getIndicatorModes()) {
    const scores = D.scores || {}; const dates = scores.dates || [];
    const periods = getAdjustmentPeriods();
    const sources = categorySources(dates, indicatorModes);
    const categories = {};
    CATEGORY_KEYS.forEach(key => { categories[key] = new Array(dates.length); });
    dates.forEach((d, i) => {
      const period = periods.length ? adjustmentPeriodForDate(d, periods) : null;
      CATEGORY_KEYS.forEach(key => {
        const adj = period ? number(period.adjustments[key]) : number(settings.adjustments[key]);
        categories[key][i] = clamp(number(sources[key][i]) + adj, 0, 100);
      });
    });
    const daily = dates.map((_, i) => mean(CATEGORY_KEYS.map(key => categories[key][i])));
    const observed = rollingMean(daily, Math.max(1, Math.round(number(settings.observation, 60))));
    return { dates, categories, daily, observed };
  }
  // ETF MP 백테스트(regime-override.js::computeQuantExposureAndRegime)가 쓰는 고정 MA120/
  // 60·40 컨벤션 - "분류별 스코어 조정"(설정 가능한 조정치)은 원래부터 이 시리즈에 전혀
  // 반영되지 않았고 그 성질은 그대로 유지한다(지표 토글만 반영). 토글이 하나도 없으면
  // 서버가 만든 배열을 그대로 돌려준다(압도적으로 흔한 경로라 불필요한 재계산을 피함).
  // 클라이언트 재계산은 실측 검증 결과 2010-06-25 이전(최초 ~119거래일, 서버가 그 이전
  // 히스토리로 MA120 워밍업을 했지만 그 구간은 클라이언트에 없음) 구간만 서버값과 어긋나고
  // 그 이후 전 구간은 완전히 일치한다 - ETF MP 백테스트의 실제 분석 시작일(2022-09-01)보다
  // 훨씬 이전이라 실질적 영향이 없음.
  function ma120Series(indicatorModes = getIndicatorModes()) {
    const scores = D.scores || {};
    const server = scores.ma120_display_0_100 || [];
    if (!hasAnyMonthlyToggle(indicatorModes)) return server;
    const dates = scores.dates || [];
    const sources = categorySources(dates, indicatorModes);
    const daily = dates.map((_, i) => mean(CATEGORY_KEYS.map(key => number(sources[key][i]))));
    return rollingMean(daily, 120);
  }
  function latestIndex() { return Math.max(0, (D.scores && D.scores.dates ? D.scores.dates.length : 1) - 1); }
  function finalObservation(settings = getSettings()) { const s = adjustedSeries(settings); return s.observed[s.observed.length - 1] || 0; }
  function regimeFromScore(value, settings = getSettings()) {
    const hi = number(settings.scoreHi, 60), lo = number(settings.scoreLo, 45);
    return value >= hi ? '강세' : value <= lo ? '약세' : '중립';
  }
  function exposureFromScore(value, settings = getSettings()) {
    const hi = number(settings.scoreHi, 60), lo = number(settings.scoreLo, 45);
    return value >= hi ? 100 : value <= lo ? 0 : 50;
  }
  // 고변동성 세부 국면은 체크박스가 유일한 결정 조건이다 — 이전에는 변동성 카테고리
  // 점수로도 자동 판정되어(OR 결합) 체크를 안 해도 "고변동성 강세장"이 나올 수 있었음.
  function detailedRegime(score, settings = getSettings()) {
    const primary = regimeFromScore(score, settings);
    return subRegimeLabel(primary, settings.structural, settings.event, settings.highVol);
  }
  // detailedRegime()과 동일하지만, 해당 날짜를 덮는 기간별 조정이 세부 국면 축(구조적/
  // 이벤트적/고변동성)을 override하면 그 값을 우선 쓴다 - 카테고리 조정값이 이미
  // adjustedSeries()에서 기간별로 적용되는 것과 동일한 원칙을, 국면 판정 자체에도
  // 적용하기 위함(periods는 호출부가 A.getAdjustmentPeriods()로 한 번만 가져와 넘긴다).
  function detailedRegimeForDate(dateStr, score, settings, periods) {
    const primary = regimeFromScore(score, settings);
    const t = resolvedToggles(dateStr, settings, periods);
    return subRegimeLabel(primary, t.structural, t.event, t.highVol);
  }
  function lastMonthEndIndex(dates, monthEndFlags, beforeIndex) {
    for (let i = beforeIndex - 1; i >= 0; i--) { if (monthEndFlags && monthEndFlags[i]) return i; }
    return Math.max(0, beforeIndex - 1);
  }

  function createChart(el, option) {
    if (!window.echarts || !el) return null;
    const old = echarts.getInstanceByDom(el); if (old) old.dispose();
    const chart = echarts.init(el, null, { renderer: 'canvas' }); chart.setOption(option);
    const resize = () => chart.resize(); window.addEventListener('resize', resize, { passive: true });
    return chart;
  }
  function lineOption({ dates, series, yName = '', minY = null, maxY = null, percent = false }) {
    return {
      animation: false,
      grid: { left: 54, right: 26, top: 52, bottom: 48 },
      tooltip: { trigger: 'axis', valueFormatter: v => percent ? `${formatNumber(v, 2)}%` : formatNumber(v, 2) },
      legend: { top: 10, textStyle: { color: '#587286', fontSize: 12 }, itemWidth: 18 },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLine: { lineStyle: { color: '#b7c7d4' } }, axisLabel: { color:'#71899a', formatter: v => formatDate(v), hideOverlap:true } },
      yAxis: { type: 'value', name: yName, min: minY, max: maxY, scale: minY == null && maxY == null, nameTextStyle:{color:'#71899a'}, splitLine: { lineStyle: { color:'#e7eef3' } }, axisLabel: { color:'#71899a', formatter: v => percent ? `${v}%` : v } },
      // opacity는 선택 항목 - 여러 선을 겹쳐 그릴 때(예: 국면예보의 분류 5개+종합 1개) 종합선만
      // 진하게 두고 나머지를 옅게 해서 어떤 선이 핵심인지 한눈에 보이게 하는 용도. 안 넘기면
      // 기존과 동일하게 전부 불투명(1)하다 - 기존 호출부는 전부 그대로 동작.
      series: series.map(s => ({ type:'line', name:s.name, data:s.data, showSymbol:false, smooth:false, lineStyle:{ width:s.width || 2, color:s.color, opacity:s.opacity != null ? s.opacity : 1 }, itemStyle:{ color:s.color, opacity:s.opacity != null ? s.opacity : 1 }, emphasis:{ focus:'series', lineStyle:{ opacity:1 } } }))
    };
  }
  // 차트 배경에 markArea로 국면/구간을 색칠할 때(정량 스코어·MP 기준·시계열 데이터·단기장기
  // 스트레스 차트) 그 색이 뭘 뜻하는지 차트만 봐서는 알 수 없던 문제 - 각 페이지가 자기
  // 국면→색 매핑 객체({라벨:색상})를 그대로 넘기면 스와치+라벨 한 줄을 만들어준다.
  // idempotent하게(id로 찾아서 없으면 만들고 있으면 내용만 갱신) chartEl 앞에 끼워 넣도록
  // 호출부에서 사용 - 매 렌더마다 불러도 중복 생성되지 않는다.
  function regimeLegendHtml(colorMap) {
    return Object.entries(colorMap).map(([label, color]) => `<span class="regime-legend-item"><i style="background:${esc(color)}"></i>${esc(label)}</span>`).join('');
  }
  function ensureLegendBefore(id, chartEl, colorMap) {
    if (!chartEl) return;
    let legend = document.getElementById(id);
    if (!legend) {
      legend = document.createElement('div');
      legend.id = id;
      legend.className = 'regime-legend';
      chartEl.before(legend);
    }
    legend.innerHTML = regimeLegendHtml(colorMap);
  }
  function sliceDateRange(dates, arrays, range) {
    let start = 0;
    if (range !== 'all') { const years = Number(range); const target = new Date(dates[dates.length - 1]); target.setFullYear(target.getFullYear() - years); const iso = target.toISOString().slice(0,10); start = Math.max(0, dates.findIndex(d => d >= iso)); if (start < 0) start = 0; }
    return { dates: dates.slice(start), arrays: arrays.map(a => a.slice(start)) };
  }
  function sliceCustomRange(dates, arrays, start, end) {
    let from = dates.findIndex(d => d >= start);
    if (from < 0) from = dates.length; // start가 데이터 범위보다 미래면 빈 결과
    let to = dates.length - 1;
    while (to >= 0 && dates[to] > end) to--;
    if (to < from) return { dates: [], arrays: arrays.map(() => []) };
    return { dates: dates.slice(from, to + 1), arrays: arrays.map(a => a.slice(from, to + 1)) };
  }
  function initRangeButtons(root, callback, initial = '1') {
    root.querySelectorAll('[data-range]').forEach(btn => btn.addEventListener('click', () => { root.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('active', b === btn)); callback(btn.dataset.range); }));
    const initialBtn = root.querySelector(`[data-range="${initial}"]`); if (initialBtn) initialBtn.classList.add('active');
  }
  // renderVirtualRows()는 렌더할 때마다 그 테이블의 스크롤을 맨 위로 리셋한다(지표를
  // 바꿀 땐 최신 행부터 보이는 게 맞는 의도된 동작) — 하지만 같은 지표에서 기간 버튼만
  // 바꿀 때는 사용자가 보던 위치가 사라지는 게 "이동"으로 느껴진다. 기간 버튼 콜백을
  // 이걸로 감싸면 렌더 전후로 스크롤 위치를 그대로 복원한다.
  function withScrollPreserved(tbodySelector, fn) {
    return function (arg) {
      const tbody = document.querySelector(tbodySelector);
      const container = tbody ? tbody.closest('.ts-table-scroll') : null;
      const savedScroll = container ? container.scrollTop : null;
      fn(arg);
      if (savedScroll != null) {
        const sameTbody = document.querySelector(tbodySelector);
        const sameContainer = sameTbody ? sameTbody.closest('.ts-table-scroll') : null;
        if (sameContainer) sameContainer.scrollTop = savedScroll;
      }
    };
  }
  function categoryNameFromKey(key) { return CATEGORY_META[key] ? CATEGORY_META[key].name : key; }
  function categoryKeyFromName(name) { const map = { '거시':'macro', '변동성 위험':'vol', '수급':'supply', '기술적':'technical', '펀더멘털':'fundamental' }; return map[name] || name; }
  function metricClass(v) { return number(v) > 0 ? 'positive' : number(v) < 0 ? 'negative' : 'neutral'; }
  function dailyMetrics(dates, equity, returns) {
    // Must compound ALL n returns from a fresh 1.0 baseline (not eq[end]/eq[0]) — the cached
    // backend figures (DASHBOARD_DATA.mode_comparison, MODE_COMPARISON_RANGES) that the
    // 격주/월말/B&H rows read verbatim always include the window's first day's return, so this
    // live "일단위" computation has to use the same convention or the comparison table mixes two
    // different definitions of "total return" in the same table.
    const n = Math.min(dates.length, equity.length); if (n < 2) return { total_return:0,cagr:0,annual_volatility:0,sharpe_rf0:0,mdd:0 };
    const rawEquity = equity.slice(0,n).map(number); const r = (returns && returns.length >= n ? returns.slice(0,n).map(number) : rawEquity.map((v,i)=>i? v / rawEquity[i-1] - 1 : rawEquity[0] - 1));
    const curve=[1]; r.forEach(v=>curve.push(curve[curve.length-1]*(1+v))); const avg=mean(r); const variance=r.length>1?r.reduce((s,v)=>s+(v-avg)**2,0)/(r.length-1):0; const vol=Math.sqrt(variance)*Math.sqrt(252); const days=Math.max(1,(new Date(dates[n-1])-new Date(dates[0]))/86400000); let peak=1,mdd=0;
    curve.forEach(v=>{peak=Math.max(peak,v);mdd=Math.min(mdd,v/peak-1);}); const total=curve[curve.length-1]-1;
    return { total_return:total, cagr:Math.pow(1+total,365.25/days)-1, annual_volatility:vol, sharpe_rf0:vol ? avg/Math.sqrt(variance)*Math.sqrt(252) : 0, mdd };
  }

  syncSharedHeader();
  window.AIP = { D, CATEGORY_ORDER, CATEGORY_KEYS, CATEGORY_META, CATEGORY_SOURCE_KEYS, number, clamp, formatNumber, formatPct, formatDate, esc, mean, min, max, rollingMean, getSettings, saveSettings, resetSettings, adjustmentSettingsStoreKey: STORE, adjustmentPeriodStoreKey: ADJUSTMENT_PERIOD_STORE, getAdjustmentPeriods, addAdjustmentPeriod, updateAdjustmentPeriod, deleteAdjustmentPeriod, adjustmentPeriodForDate, adjustedSeries, indicatorModeStoreKey: INDICATOR_MODE_STORE, getIndicatorModes, saveIndicatorModes, monthlyEligibleIndicators, indicatorMode, indicatorValueSeries, weightHistoryForIndicator, weightAsOf, categoryHasMonthlyToggle, recomputeCategoryRaw, hasAnyMonthlyToggle, ma120Series, latestIndex, finalObservation, regimeFromScore, exposureFromScore, detailedRegime, detailedRegimeForDate, subRegimeLabel, resolvedToggles, lastMonthEndIndex, createChart, lineOption, regimeLegendHtml, ensureLegendBefore, sliceDateRange, initRangeButtons, categoryNameFromKey, categoryKeyFromName, metricClass, dailyMetrics, formatCommaInput: applyCommaFormatting, renderVirtualRows, bindSortableHeaders, compareSortValues, withScrollPreserved, sliceCustomRange };
})();
