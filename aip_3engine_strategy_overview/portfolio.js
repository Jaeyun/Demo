(function () {
  'use strict';

  const A = window.AIP;
  const PORTFOLIO_STORE = 'aip-five-menu-engine-feature-mp-v2';
  const FEATURE_WEIGHT_STORE = 'aip-five-menu-feature-weights-v1';
  const FEATURE_WEIGHT_PERIOD_STORE = 'aip-feature-weight-period-history-v1';
  const EDITOR_ROWS_PERIOD_STORE = 'aip-engine-feature-mp-period-history-v1';
  const MP_SNAPSHOT_STORE = 'aip-mp-snapshot-history-v1';
  const LEGACY_PORTFOLIO_STORE = 'aip-five-menu-engine-feature-mp-v1';
  const UNIVERSE_DATA = window.ETF_UNIVERSE || { meta: {}, items: [] };
  const UNIVERSE = Array.isArray(UNIVERSE_DATA.items) ? UNIVERSE_DATA.items : (Array.isArray(UNIVERSE_DATA.rows) ? UNIVERSE_DATA.rows : []);
  const WORKBOOK_MAP = window.ETF_WORKBOOK_MAP || {};
  // 특성 라벨은 etf-workbook-map.js(ETF_WORKBOOK_MAP, xlsx 기반 1,160개 ETF 실분류)의 표기와 통일했다.
  // P2·E4는 워크북 분류상 해당 특성으로 태깅된 ETF가 0건 — 유니버스 후보 없이 수동 등록만 가능.
  const ENGINE_INFO = {
    I1: { engine: 'Income', feature: 'I1 · 이자(단기)' },
    I2: { engine: 'Income', feature: 'I2 · 이자(중장기)' },
    I3: { engine: 'Income', feature: 'I3 · 배당(대체)' },
    I4: { engine: 'Income', feature: 'I4 · 배당(주식)' },
    I5: { engine: 'Income', feature: 'I5 · 옵션프리미엄' },
    P1: { engine: 'Performance', feature: 'P1 · 시장' },
    P2: { engine: 'Performance', feature: 'P2 · 레버리지' },
    P3: { engine: 'Performance', feature: 'P3 · 주도섹터' },
    P4: { engine: 'Performance', feature: 'P4 · Thematic' },
    P5: { engine: 'Performance', feature: 'P5 · 방어섹터' },
    E1: { engine: 'Edge', feature: 'E1 · 펀더멘탈' },
    E2: { engine: 'Edge', feature: 'E2 · 변동성 헷지' },
    E3: { engine: 'Edge', feature: 'E3 · 원자재' },
    E4: { engine: 'Edge', feature: 'E4 · Relative Value' }
  };
  const INCOME_CODES = ['I1', 'I2', 'I3', 'I4', 'I5'];
  const PERFORMANCE_CODES = ['P1', 'P2', 'P3', 'P4', 'P5'];
  const EDGE_CODES = ['E1', 'E2', 'E3', 'E4'];
  const ALL_FEATURE_CODES = [...INCOME_CODES, ...PERFORMANCE_CODES, ...EDGE_CODES];
  const ENGINE_KEY_BY_CODE = { income: INCOME_CODES, performance: PERFORMANCE_CODES, edge: EDGE_CODES };
  function engineKeyForCode(code) {
    return Object.keys(ENGINE_KEY_BY_CODE).find(key => ENGINE_KEY_BY_CODE[key].includes(code)) || null;
  }
  function engineCodesForKey(key) { return ENGINE_KEY_BY_CODE[key] || []; }
  const ENGINE_ASSETS = {
    I1: [['KODEX 머니마켓액티브', 1]],
    I2: [['KODEX 종합채권(AA-이상)액티브', 0.5], ['TIGER 우량회사채액티브', 0.25], ['RISE KIS국고채 30년 Enhanced', 0.25]],
    I3: [['KB 발해인프라', 0.5], ['TIGER 리츠부동산인프라', 0.25], ['신한알파리츠', 0.25]],
    I4: [['Plus 고배당주', 1]],
    I5: [['TIGER 배당커버드콜액티브', 0.5], ['KODEX 200타겟위클리커버드콜', 0.5]],
    P1: [['KODEX 200', 0.5], ['TIGER 미국S&P500', 0.25], ['TIME 코스피액티브', 0.25]],
    P2: [['KODEX 레버리지', 1]],
    P3: [['KODEX 반도체', 0.5], ['RISE 네트워크인프라', 0.25], ['KODEX AI전력핵심설비', 0.25]],
    P4: [['TIME 글로벌AI인공지능액티브', 0.4], ['PLUS 태양광&ESS', 0.3], ['SOL 화장품TOP3플러스', 0.3]],
    P5: [['KODEX 은행', 0.5], ['KODEX 보험', 0.5]],
    E1: [['ACE 라이프자산주주가치액티브', 0.5], ['RISE 코리아밸류업', 0.5]],
    E2: [['ACE KRX금현물', 0.5], ['KODEX TRF5050', 0.5]],
    E3: [['TIGER 구리실물', 1]],
    E4: []
  };

  // 각 행은 14개 특성 코드를 전부 갖는다(0%도 명시) — 예전엔 국면마다 일부 코드만 노출해
  // "빠진 건지 의도적으로 0%인지" 구분이 안 됐다. 합계는 전부 100.
  const FEATURE_WEIGHT_DEFAULTS = [
    { id:'bull-high', phase:'강세장', detail:'고변동성 강세장', weights:{ I1:0,I2:0,I3:2,I4:4,I5:4, P1:30,P2:0,P3:0,P4:15,P5:15, E1:15,E2:15,E3:0,E4:0 } },
    { id:'bull-low', phase:'강세장', detail:'저변동성 강세장', weights:{ I1:0,I2:0,I3:2,I4:4,I5:4, P1:0,P2:30,P3:30,P4:0,P5:0, E1:0,E2:30,E3:0,E4:0 } },
    { id:'neutral', phase:'중립', detail:'중립', weights:{ I1:12,I2:12,I3:16,I4:0,I5:0, P1:20,P2:0,P3:20,P4:0,P5:0, E1:10,E2:10,E3:0,E4:0 } },
    { id:'bear-cycle', phase:'약세장', detail:'경기순환적 약세장', weights:{ I1:30,I2:30,I3:0,I4:0,I5:0, P1:30,P2:0,P3:0,P4:0,P5:0, E1:10,E2:0,E3:0,E4:0 } },
    { id:'bear-structural', phase:'약세장', detail:'구조적 약세장', weights:{ I1:30,I2:30,I3:0,I4:0,I5:0, P1:9,P2:0,P3:0,P4:0,P5:21, E1:0,E2:10,E3:0,E4:0 } },
    { id:'bear-event', phase:'약세장', detail:'이벤트적 약세장', weights:{ I1:30,I2:30,I3:0,I4:0,I5:0, P1:21,P2:0,P3:0,P4:0,P5:9, E1:0,E2:10,E3:0,E4:0 } }
  ];

  function loadFeatureWeights() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(FEATURE_WEIGHT_STORE) || 'null'); } catch (_) { saved = null; }
    // version 1(라벨·부분코드 배열 스키마)은 구조가 달라 그대로 못 쓴다 — 기본값으로 재시작.
    const savedRows = (saved?.version === 2 && Array.isArray(saved?.rows)) ? saved.rows : [];
    const savedById = new Map(savedRows.map(row => [row.id, row]));
    return FEATURE_WEIGHT_DEFAULTS.map(base => {
      const override = savedById.get(base.id);
      const weights = {};
      ALL_FEATURE_CODES.forEach(code => { weights[code] = safeNumber(override?.weights?.[code], base.weights[code] || 0); });
      return { id: base.id, phase: base.phase, detail: base.detail, weights };
    });
  }

  let featureWeights = loadFeatureWeights();

  function featureWeightTotal(row) {
    return ALL_FEATURE_CODES.reduce((sum, code) => sum + Number(row.weights[code] || 0), 0);
  }

  // 엔진(Income/Performance/Edge) 하나의 특성 코드들만 합산 - 세부 국면별 엔진 소계 표시용.
  function engineSubtotal(row, codes) {
    return codes.reduce((sum, code) => sum + Number(row.weights[code] || 0), 0);
  }

  function invalidFeatureWeightRows() {
    return featureWeights.filter(row => Math.abs(featureWeightTotal(row) - 100) > 0.5);
  }

  function featureStackHtml(codes) {
    return codes.map(code => `<div class="feature-weight-line"><span>${A.esc(ENGINE_INFO[code].feature)}</span></div>`).join('');
  }

  function featureInputStackHtml(row, codes) {
    return codes.map(code => `<div class="feature-weight-line"><input type="text" min="0" max="100" step="1" inputmode="numeric" data-comma-input="int" data-feature-weight="${row.id}|${code}" value="${A.formatNumber(row.weights[code] || 0, 0)}" aria-label="${A.esc(ENGINE_INFO[code].feature)} 비중"><span>%</span></div>`).join('');
  }

  // 세부 국면 1개당 <tr> 2개: 1행은 특성별 입력만(엔진마다 특성 개수가 달라도 - Income/
  // Performance 5개, Edge 4개 - 각자 자기 높이대로), 2행은 엔진 소계 3개+합계를 한 줄에
  // 나란히(고정된 별도 행이라 세 엔진 소계가 항상 같은 가로줄에 붙는다 - 특성 개수가
  // 달라도 어긋나지 않음, CSS 트릭 없이 진짜 표 구조로 해결). 국면/세부국면 셀은
  // rowspan=2로 두 행에 걸쳐 하나만 표시.
  function renderFeatureWeights() {
    const body = document.getElementById('engine-feature-weight-body');
    if (!body) return;
    const table = body.closest('table');
    if (table) table.classList.add('engine-feature-weight-table');
    body.innerHTML = featureWeights.map(row => {
      const total = featureWeightTotal(row);
      const invalid = Math.abs(total - 100) > 0.5;
      const subtotalCell = (codes, engineKey) => `<td class="engine-${engineKey} subtotal-row-cell">소계</td><td class="weight subtotal-row-cell" data-feature-subtotal="${row.id}|${engineKey}">${A.formatNumber(engineSubtotal(row, codes),0)}%</td>`;
      return `<tr data-feature-row="${row.id}">
        <td class="phase-cell" rowspan="2">${A.esc(row.phase)}</td>
        <td class="detail-cell" rowspan="2">${A.esc(row.detail)}</td>
        <td class="engine-income">${featureStackHtml(INCOME_CODES)}</td><td class="weight feature-stack-weight">${featureInputStackHtml(row, INCOME_CODES)}</td>
        <td class="engine-performance">${featureStackHtml(PERFORMANCE_CODES)}</td><td class="weight feature-stack-weight">${featureInputStackHtml(row, PERFORMANCE_CODES)}</td>
        <td class="engine-edge">${featureStackHtml(EDGE_CODES)}</td><td class="weight feature-stack-weight">${featureInputStackHtml(row, EDGE_CODES)}</td>
      </tr>
      <tr data-feature-subtotal-row="${row.id}">
        ${subtotalCell(INCOME_CODES,'income')}
        ${subtotalCell(PERFORMANCE_CODES,'performance')}
        ${subtotalCell(EDGE_CODES,'edge')}
        <td class="total-cell${invalid ? ' is-invalid' : ''}" data-feature-total="${row.id}">${A.formatNumber(total,0)}%</td>
      </tr>`;
    }).join('');
  }

  function saveFeatureWeights() {
    const invalidRows = invalidFeatureWeightRows();
    if (invalidRows.length) return { ok:false, invalidRows };
    localStorage.setItem(FEATURE_WEIGHT_STORE, JSON.stringify({ version:2, rows:featureWeights }));
    window.dispatchEvent(new CustomEvent('aip5:feature-weight-change', { detail:featureWeights }));
    return { ok:true };
  }

  function cloneFeatureWeightRows(rows) {
    return rows.map(row => ({ id: row.id, phase: row.phase, detail: row.detail, weights: { ...row.weights } }));
  }

  // ---------------------------------------------------------------------
  // 기간 지정 강제 조정("국면에 따른 엔진별·특성별 비중" 탭 전용) - 위 전역 기본값과
  // 별개로, 지정한 기간에만 적용되는 대체 비중 테이블을 저장한다. adjustment.html의
  // 기간별 조정과 동일한 저장 패턴(리스트+겹침 방지+id/createdAt)이지만 카테고리
  // 조정값이 아니라 featureWeights와 동일한 6행 전체를 담는다.
  function getFeatureWeightPeriods() {
    try { const list = JSON.parse(localStorage.getItem(FEATURE_WEIGHT_PERIOD_STORE) || '[]'); return Array.isArray(list) ? list : []; }
    catch (_) { return []; }
  }
  function saveFeatureWeightPeriods(list) {
    localStorage.setItem(FEATURE_WEIGHT_PERIOD_STORE, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('aip5:feature-weight-period-change'));
  }
  function featureWeightPeriodOverlaps(start, end, excludeId) {
    return getFeatureWeightPeriods().some(p => p.id !== excludeId && start <= p.end && end >= p.start);
  }
  function addFeatureWeightPeriod({ start, end, rows, note }) {
    if (!start || !end || start > end) throw new Error('기간이 올바르지 않습니다.');
    if (featureWeightPeriodOverlaps(start, end, null)) throw new Error('겹치는 기간의 강제 조정이 이미 있습니다.');
    const invalid = rows.filter(row => Math.abs(featureWeightTotal(row) - 100) > 0.5);
    if (invalid.length) throw new Error(`합계 100%가 아닌 국면이 있습니다: ${invalid.map(row => row.detail).join(', ')}`);
    const list = getFeatureWeightPeriods();
    list.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, start, end, rows: cloneFeatureWeightRows(rows), note: note || '', createdAt: new Date().toISOString() });
    list.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    saveFeatureWeightPeriods(list);
  }
  function deleteFeatureWeightPeriod(id) {
    saveFeatureWeightPeriods(getFeatureWeightPeriods().filter(p => p.id !== id));
  }
  function featureWeightPeriodForDate(dateStr, periods) {
    for (let i = 0; i < periods.length; i++) { const p = periods[i]; if (dateStr >= p.start && dateStr <= p.end) return p; }
    return null;
  }

  function universeSymbol(item) {
    return normalizeSymbol(item?.symbol || item?.ticker || item?.code || item?.itemCode || item?.etfCode || '');
  }

  function universeName(item) {
    return String(item?.name || item?.etfName || item?.productName || item?.asset || item?.etf || '').trim();
  }

  const ETF_BY_SYMBOL = new Map(UNIVERSE.map(item => [universeSymbol(item), item]).filter(([key]) => key));
  const ETF_BY_NAME = new Map(UNIVERSE.map(item => [universeName(item), item]).filter(([key]) => key));
  // ETF 유니버스 검색 결과에 누락될 수 있는 상장 인프라 펀드·리츠를
  // DeepSearch 기업 검색으로 확인한 KRX 종목코드로 보완한다.
  const SPECIAL_ASSETS = {
    '415640': { name: 'KB 발해인프라', symbol: '415640', exchange: 'KRX', issuer: 'KB자산운용', listedDate: '' },
    '293940': { name: '신한알파리츠', symbol: '293940', exchange: 'KRX', issuer: '신한리츠운용', listedDate: '2018-08-08' },
    '329200': { name: 'TIGER 리츠부동산인프라', symbol: '329200', exchange: 'KRX', issuer: '미래에셋자산운용', listedDate: '2019-07-19' },
    '472150': { name: 'TIGER 배당커버드콜액티브', symbol: '472150', exchange: 'KRX', issuer: '미래에셋자산운용', listedDate: '2023-12-12' }
  };
  const SPECIAL_BY_SYMBOL = new Map(Object.values(SPECIAL_ASSETS).map(item => [item.symbol, item]));
  const ASSET_ALIASES = { 'Tiger배당커버드콜': 'TIGER 배당커버드콜액티브' };

  function canonicalAssetName(value) {
    const name = String(value || '').trim();
    return ASSET_ALIASES[name] || name;
  }

  // regime-override-data.js(Python 파이프라인 원본)의 ETF 가격 시계열은 "Tiger배당커버드콜"
  // (raw)을 키로 쓰지만 ENGINE_ASSETS/DEFAULT_ROWS는 정식 표기 "TIGER 배당커버드콜액티브"
  // (canonical)를 쓴다 - canonicalAssetName()의 정반대 방향 조회라 별도 헬퍼가 필요하다.
  const REVERSE_ASSET_ALIASES = Object.fromEntries(Object.entries(ASSET_ALIASES).map(([raw, canon]) => [canon, raw]));
  function overridePriceAssetKey(name) {
    const assets = (window.REGIME_OVERRIDE_DATA || {}).assets || {};
    if (assets[name]) return name;
    const reverse = REVERSE_ASSET_ALIASES[name];
    return reverse && assets[reverse] ? reverse : name;
  }

  function findEtfByName(name) {
    const canonical = canonicalAssetName(name);
    const special = Object.values(SPECIAL_ASSETS).find(item => item.name === canonical);
    if (special) return special;
    const exact = ETF_BY_NAME.get(canonical);
    if (exact) return exact;
    const needle = canonical.replace(/\s+/g, '').toLowerCase();
    if (!needle) return null;
    return UNIVERSE.find(item => universeName(item).replace(/\s+/g, '').toLowerCase() === needle) || null;
  }

  function etfLabel(row) {
    if (row?.etf?.trim()) return row.etf.trim();
    return row?.symbol?.trim() ? '종목코드 확인 필요' : '종목코드 입력';
  }

  function applySymbol(row, value) {
    const symbol = normalizeSymbol(value);
    row.symbol = symbol;
    const match = ETF_BY_SYMBOL.get(symbol) || SPECIAL_BY_SYMBOL.get(symbol);
    if (match) {
      row.etf = universeName(match) || row.etf || '';
      row.issuer = match.issuer || '';
      row.listedDate = match.listedDate || '';
    } else if (symbol) {
      row.etf = '';
      row.issuer = '';
      row.listedDate = '';
    }
  }

  const DEFAULT_ROWS = Object.keys(ENGINE_INFO).flatMap(code =>
    (ENGINE_ASSETS[code] || []).map(([etf, weight], index) => ({
      id: `${code}-${index}`,
      code,
      etf,
      symbol: universeSymbol(findEtfByName(etf)),
      issuer: findEtfByName(etf)?.issuer || '',
      listedDate: findEtfByName(etf)?.listedDate || '',
      defaultEtf: etf,
      weight,
      ...ENGINE_INFO[code]
    }))
  );
  const DEFAULT_BY_ETF = new Map(DEFAULT_ROWS.map(row => [row.defaultEtf, row]));

  function normalizeSymbol(value) {
    const text = String(value ?? '').trim();
    return /^\d+$/.test(text) ? text.padStart(6, '0') : text;
  }

  function workbookMapping(row) {
    const mapped = WORKBOOK_MAP[normalizeSymbol(row.symbol)];
    if (!Array.isArray(mapped)) return null;
    return { engine: mapped[0] || '미분류', feature: mapped[1] || '미분류' };
  }

  // 워크북 분류 라벨("E1. 펀더멘탈" 등)에서 특성 코드만 뽑는다. 국면 MP 계산에 쓰는
  // ENGINE_INFO 코드와 동일 체계이므로 이걸로 "엔진별·특성별 MP" 탭의 실제 후보를 고른다.
  function workbookCode(mapping) {
    const match = mapping && /^([A-Z]\d)/.exec(mapping.feature || '');
    return match ? match[1] : null;
  }

  const CANDIDATES_BY_CODE = new Map();
  function candidatesForCode(code) {
    if (!CANDIDATES_BY_CODE.has(code)) {
      const rows = UNIVERSE.filter(item => workbookCode(workbookMapping(item)) === code)
        .sort((a, b) => (numericValue(b.marketCap) || 0) - (numericValue(a.marketCap) || 0));
      CANDIDATES_BY_CODE.set(code, rows);
    }
    return CANDIDATES_BY_CODE.get(code);
  }

  // 종목코드가 유니버스에 있는데 워크북 분류가 이 행의 코드와 다르면(또는 유니버스에 없으면)
  // 화면에 그대로 노출한다 — 조용히 재분류하지 않고 사람이 보고 판단하게 한다.
  function mismatchNoteHtml(row) {
    if (!row.symbol) return '';
    const symbol = normalizeSymbol(row.symbol);
    const universeItem = ETF_BY_SYMBOL.get(symbol) || SPECIAL_BY_SYMBOL.get(symbol);
    if (!universeItem) return '<small class="mp-editor-mismatch">유니버스 미등록 · 수동 입력</small>';
    const mapping = workbookMapping(universeItem);
    const code = workbookCode(mapping);
    if (!code || code === row.code) return '';
    return `<small class="mp-editor-mismatch">유니버스 실제 분류: ${A.esc(mappingLabel(mapping))}</small>`;
  }

  function nameCellHtml(row) {
    return `<span class="mp-editor-auto-name ${row.etf ? '' : 'is-empty'}" data-role="etf-name">${A.esc(etfLabel(row))}</span>${mismatchNoteHtml(row)}`;
  }

  function buildCandidateDatalists() {
    const container = document.getElementById('mp-datalists');
    if (!container || container.dataset.ready === 'true') return;
    container.innerHTML = ALL_FEATURE_CODES.map(code => {
      const options = candidatesForCode(code).slice(0, 200).map(item =>
        `<option value="${A.esc(universeSymbol(item))}">${A.esc(universeName(item))}</option>`
      ).join('');
      return `<datalist id="mp-datalist-${code}">${options}</datalist>`;
    }).join('');
    container.dataset.ready = 'true';
  }

  let editorRows = loadEditorRows();
  let editorEngine = 'all';
  // "강제 조정" 하위 탭의 편집용 초안(저장 전) - null이면 아직 시작 안 한 것이고, 처음
  // 하위 탭을 열거나 저장 직후 다시 null로 돌아가 현재 전역값을 기준으로 다시 초기화된다.
  let fwPeriodDraft = null;
  let invPeriodDraft = null;
  let investmentSort = { key: null, dir: 'asc' };
  let mpView = 'prev-monthend'; // 'prev-monthend' | 'target' | 'history'
  let mpTableSort = { key: null, dir: 'desc' };
  let selectedSnapshotId = null; // null이면 '저장 이력' 탭이 최신 저장 이력을 보여줌

  // 유니버스 "장바구니" - 저장된 필터 조건 (단순 localStorage 배열, 별도 상태
  // 관리 프레임워크 없이 렌더링 시마다 다시 읽는다). 색상은 저장 시점에
  // 팔레트를 순환 배정해 객체에 함께 저장 - 이후 삭제/재저장으로 목록이
  // 바뀌어도 기존 조건의 색이 흔들리지 않는다.
  const UNIVERSE_CART_STORE = 'aip-universe-cart-v1';
  const CART_PALETTE = ['#1771b9', '#c23c4a', '#008c7c', '#b66e00', '#7454c5', '#d6336c', '#2f9e44', '#3b5bdb'];

  function loadUniverseCart() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(UNIVERSE_CART_STORE) || 'null'); } catch (_) { saved = null; }
    return Array.isArray(saved) ? saved.filter(item => item && typeof item === 'object' && item.filters && typeof item.id === 'string') : [];
  }

  function saveUniverseCart() {
    localStorage.setItem(UNIVERSE_CART_STORE, JSON.stringify(universeCart));
  }

  let universeCart = loadUniverseCart();
  let cartViewMode = 'union'; // 'union' | a saved condition's id (개별 보기)
  let universeSort = { key: null, dir: 'desc' };

  // 팔레트를 "지금까지 저장한 개수" 기준으로 순환 배정하면 삭제 후 재저장 시
  // 현재 보이는 다른 조건과 색이 겹칠 수 있다 — 지금 실제로 쓰이는 색만 피해서 배정한다.
  function nextCartColor() {
    const used = new Set(universeCart.map(cond => cond.color));
    return CART_PALETTE.find(color => !used.has(color)) || CART_PALETTE[universeCart.length % CART_PALETTE.length];
  }

  function describeCartFilters(filters) {
    const parts = [];
    if (filters.search) parts.push(`검색:${filters.search}`);
    if (filters.engineFeature) parts.push(`엔진·특성:${filters.engineFeature.replace('::', ' · ')}`);
    if (filters.minAum) parts.push(`최소AUM:${formatWon(filters.minAum)}`);
    if (filters.minTradeValue) parts.push(`최소거래대금:${formatWon(filters.minTradeValue)}`);
    return parts.length ? parts.join(' · ') : '조건 없음(전체)';
  }

  function safeNumber(value, fallback) {
    const next = Number(typeof value === 'string' ? value.replace(/,/g, '') : value);
    return Number.isFinite(next) ? Math.max(0, next) : fallback;
  }

  function loadEditorRows() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(PORTFOLIO_STORE) || 'null'); } catch (_) { saved = null; }
    const savedRows = Array.isArray(saved?.rows) ? saved.rows : [];
    if (!savedRows.length) {
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(LEGACY_PORTFOLIO_STORE) || 'null'); } catch (_) { legacy = null; }
      if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
        return DEFAULT_ROWS.map(row => {
          const override = legacy[row.id] || {};
          const next = { ...row, weight: safeNumber(override.weight, row.weight), etf: typeof override.etf === 'string' ? override.etf : row.etf };
          const match = findEtfByName(next.etf);
          if (match) applySymbol(next, universeSymbol(match));
          return next;
        });
      }
      return DEFAULT_ROWS.map(row => ({ ...row }));
    }
    return savedRows.map((savedRow, index) => {
      const code = ENGINE_INFO[savedRow.code] ? savedRow.code : 'I1';
      const info = ENGINE_INFO[code];
      const row = {
        id: String(savedRow.id || `custom-${Date.now()}-${index}`),
        code,
        engine: info.engine,
        feature: info.feature,
        defaultEtf: savedRow.defaultEtf || '',
        symbol: normalizeSymbol(savedRow.symbol || ''),
        etf: typeof savedRow.etf === 'string' ? savedRow.etf : '',
        issuer: savedRow.issuer || '',
        listedDate: savedRow.listedDate || '',
        weight: safeNumber(savedRow.weight, 0)
      };
      if (row.symbol && (ETF_BY_SYMBOL.has(row.symbol) || SPECIAL_BY_SYMBOL.has(row.symbol))) applySymbol(row, row.symbol);
      else if (!row.symbol && row.etf) {
        const match = findEtfByName(row.etf);
        if (match) applySymbol(row, universeSymbol(match));
      }
      return row;
    });
  }

  function saveEditorRows() {
    const next = {
      version: 2,
      rows: editorRows.map(row => ({
        id: row.id, code: row.code, symbol: row.symbol || '', etf: row.etf || '',
        issuer: row.issuer || '', listedDate: row.listedDate || '',
        defaultEtf: row.defaultEtf || '', weight: row.weight
      }))
    };
    localStorage.setItem(PORTFOLIO_STORE, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('aip5:engine-feature-mp-change', { detail: editorRows }));
  }

  function cloneEditorRows(rows) {
    return rows.map(row => ({ id: row.id, code: row.code, symbol: row.symbol || '', etf: row.etf || '', issuer: row.issuer || '', listedDate: row.listedDate || '', defaultEtf: row.defaultEtf || '', weight: safeNumber(row.weight, 0), ...ENGINE_INFO[row.code] }));
  }

  // ---------------------------------------------------------------------
  // 기간 지정 강제 조정("엔진별·특성별 MP" 탭 전용) - featureWeights의 기간별 강제
  // 조정과 동일한 패턴이지만, 여기서는 editorRows(특성별 ETF 배정+비중) 전체를 담는다.
  function getEditorRowsPeriods() {
    try { const list = JSON.parse(localStorage.getItem(EDITOR_ROWS_PERIOD_STORE) || '[]'); return Array.isArray(list) ? list : []; }
    catch (_) { return []; }
  }
  function saveEditorRowsPeriods(list) {
    localStorage.setItem(EDITOR_ROWS_PERIOD_STORE, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('aip5:engine-feature-mp-period-change'));
  }
  function editorRowsPeriodOverlaps(start, end, excludeId) {
    return getEditorRowsPeriods().some(p => p.id !== excludeId && start <= p.end && end >= p.start);
  }
  function addEditorRowsPeriod({ start, end, rows, note }) {
    if (!start || !end || start > end) throw new Error('기간이 올바르지 않습니다.');
    if (editorRowsPeriodOverlaps(start, end, null)) throw new Error('겹치는 기간의 강제 조정이 이미 있습니다.');
    const list = getEditorRowsPeriods();
    list.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, start, end, rows: cloneEditorRows(rows), note: note || '', createdAt: new Date().toISOString() });
    list.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    saveEditorRowsPeriods(list);
  }
  function deleteEditorRowsPeriod(id) {
    saveEditorRowsPeriods(getEditorRowsPeriods().filter(p => p.id !== id));
  }
  function editorRowsPeriodForDate(dateStr, periods) {
    for (let i = 0; i < periods.length; i++) { const p = periods[i]; if (dateStr >= p.start && dateStr <= p.end) return p; }
    return null;
  }

  function engineTag(engine) {
    const kind = engine === 'Income' ? 'amber' : engine === 'Performance' ? 'blue' : 'teal';
    return `<span class="tag ${kind}">${engine}</span>`;
  }

  function numericValue(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(typeof value === 'string' ? value.replace(/,/g, '') : value);
    return Number.isFinite(number) ? number : null;
  }

  function formatWon(value) {
    const number = numericValue(value);
    if (number === null) return '미제공';
    if (number >= 1000000000000) return `${A.formatNumber(number / 1000000000000, 2)}조원`;
    if (number >= 100000000) return `${A.formatNumber(number / 100000000, 1)}억원`;
    return `${A.formatNumber(number, 0)}원`;
  }

  // 표에는 조/억 축약형(스캔용)과 원 단위 전체 숫자(정확한 값)를 함께 보여준다 -
  // 전체 숫자를 크게, 축약형을 <small> 캡션으로 아래에 붙인다(universe-identity의
  // strong+small 2단 표기 관례를 그대로 재사용).
  function formatWonCell(value) {
    const number = numericValue(value);
    if (number === null) return '미제공';
    return `<strong>${number.toLocaleString('ko-KR')}원</strong><small>${A.esc(formatWon(value))}</small>`;
  }

  function formatDateValue(value) {
    return value ? String(value).replace(/-/g, '.') : '-';
  }

  function mappingKey(mapping) {
    return mapping ? `${mapping.engine}::${mapping.feature}` : '__unmapped__';
  }

  function mappingLabel(mapping) {
    return mapping ? `${mapping.engine} · ${mapping.feature}` : '미분류';
  }

  function universeFilterState() {
    const read = id => document.getElementById(id)?.value?.trim() || '';
    return {
      search: read('universe-search').toLowerCase(),
      engineFeature: read('universe-engine-feature'),
    minAum: numericValue(read('universe-min-aum')) || 0,
      minTradeValue: numericValue(read('universe-min-trade-value')) || 0
    };
  }

  function universeMatches(row, filters) {
    const mapping = workbookMapping(row);
    const haystack = [row.name, row.symbol, row.issuer, row.apiCategory, row.traceIndex, mapping?.engine, mapping?.feature].filter(Boolean).join(' ').toLowerCase();
    if (filters.search && !haystack.includes(filters.search)) return false;
    if (filters.engineFeature && mappingKey(mapping) !== filters.engineFeature) return false;
    if (filters.minAum && !(numericValue(row.aum) !== null && numericValue(row.aum) >= filters.minAum)) return false;
    if (filters.minTradeValue && !(numericValue(row.tradeValue60dAvg) !== null && numericValue(row.tradeValue60dAvg) >= filters.minTradeValue)) return false;
    return true;
  }

  function universeRowHtml(row, cartMatches = []) {
    const mapping = workbookMapping(row);
    const mappingHtml = mapping
      ? `<span class="universe-engine">${A.esc(mapping.engine)}</span><span class="universe-feature">${A.esc(mapping.feature)}</span>`
      : '<span class="universe-unmapped">-</span>';
    // 장바구니(저장된 조건)에 매칭되는 항목마다 색상 점 하나씩 - 조건별 색상은
    // 저장 시점에 고정되어 여기서는 그대로 표시만 한다.
    const badgesHtml = cartMatches.length
      ? `<span class="universe-cart-badges">${cartMatches.map(cond => `<i class="universe-cart-dot" style="background:${A.esc(cond.color)}" title="${A.esc(cond.name)}"></i>`).join('')}</span>`
      : '';
    return `<tr>
      <td class="universe-identity">${badgesHtml}<strong>${A.esc(row.name || '-')}</strong><small>${A.esc(row.exchange || '')} · ${A.esc(row.symbol || '-')}</small></td>
      <td class="universe-mapping">${mappingHtml}</td>
      <td>${A.esc(row.issuer || '-')}</td>
      <td>${A.esc(row.traceIndex || '-')}</td>
      <td class="numeric universe-metric-cell">${formatWonCell(row.aum)}</td>
      <td class="numeric universe-metric-cell">${formatWonCell(row.tradeValue60dAvg)}</td>
      <td>${formatDateValue(row.listedDate)}</td>
    </tr>`;
  }

  function populateUniverseMappings() {
    const select = document.getElementById('universe-engine-feature');
    if (!select || select.dataset.ready === 'true') return;
    const engineOrder = { Income: 0, Performance: 1, Edge: 2 };
    const mappings = new Map();
    let hasUnmapped = false;
    UNIVERSE.forEach(row => {
      const mapping = workbookMapping(row);
      if (!mapping) { hasUnmapped = true; return; }
      mappings.set(mappingKey(mapping), mapping);
    });
    const options = [...mappings.values()].sort((a, b) =>
      (engineOrder[a.engine] ?? 99) - (engineOrder[b.engine] ?? 99) ||
      String(a.feature).localeCompare(String(b.feature), 'ko')
    ).map(mapping => `<option value="${A.esc(mappingKey(mapping))}">${A.esc(mappingLabel(mapping))}</option>`);
    if (hasUnmapped) options.push('<option value="__unmapped__">미분류</option>');
    select.insertAdjacentHTML('beforeend', options.join(''));
    select.dataset.ready = 'true';
  }

  function editorRowsHtml(rows) {
    return rows.map(row => `<tr data-row-id="${row.id}">
      <td>${engineTag(row.engine)}</td>
      <td class="nowrap">${A.esc(row.feature)}</td>
      <td><input class="mp-editor-input mp-editor-symbol" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="12" list="mp-datalist-${row.code}" aria-label="${A.esc(row.feature)} ETF 종목코드" data-field="symbol" value="${A.esc(row.symbol || '')}" placeholder="예: 069500"></td>
      <td><span class="mp-editor-name-cell" data-role="etf-name-cell">${nameCellHtml(row)}</span></td>
      <td class="numeric"><input class="mp-editor-input mp-editor-weight" type="text" min="0" max="100" step="0.1" inputmode="decimal" data-comma-input="dec" aria-label="${A.esc(row.feature)} 특성 내부 비중" data-field="weight" value="${A.formatNumber(row.weight * 100, 1)}"><span class="mp-editor-unit">%</span></td>
      <td class="row-action"><button type="button" class="table-action-btn" data-action="delete-row" aria-label="${A.esc(row.feature)} 행 삭제">삭제</button></td>
    </tr>`).join('');
  }

  // 이 행이 매칭되는 저장 조건들(색상·이름 포함) - 뱃지 렌더링과 합집합 계산에 공용으로 쓴다.
  function cartMatchesForRow(row) {
    return universeCart.filter(cond => universeMatches(row, cond.filters));
  }

  // 저장된 조건이 하나도 없으면 오늘과 동일하게 라이브 필터만 적용한다.
  // 조건이 있으면 "합집합"(조건 중 하나라도 매칭) 또는 특정 조건 하나로 좁혀
  // 보여준다 - 이 경우 라이브 필터 입력값은 새 조건을 만들기 위한 값일 뿐,
  // 화면에 보이는 행 자체는 조건 스냅샷 기준으로 결정된다.
  function universeRowsForCurrentView(liveFilters) {
    if (!universeCart.length) return UNIVERSE.filter(row => universeMatches(row, liveFilters));
    if (cartViewMode === 'all') return UNIVERSE.slice();
    if (cartViewMode !== 'union' && !universeCart.some(cond => cond.id === cartViewMode)) cartViewMode = 'union';
    if (cartViewMode === 'union') return UNIVERSE.filter(row => cartMatchesForRow(row).length > 0);
    const active = universeCart.find(cond => cond.id === cartViewMode);
    return UNIVERSE.filter(row => universeMatches(row, active.filters));
  }

  function renderUniverseCartChips() {
    const root = document.getElementById('universe-cart-chips');
    if (!root) return;
    if (!universeCart.length) {
      root.innerHTML = '<span class="cart-chip-empty">저장된 조건 없음</span>';
      const emptyNotice = document.getElementById('universe-cart-notice');
      if (emptyNotice) emptyNotice.hidden = true;
      return;
    }
    const allChip = `<button type="button" class="cart-chip cart-chip-all${cartViewMode === 'all' ? ' active' : ''}" data-cart-view="all">전체 유니버스</button>`;
    const unionChip = `<button type="button" class="cart-chip cart-chip-union${cartViewMode === 'union' ? ' active' : ''}" data-cart-view="union">합집합 보기</button>`;
    const chips = universeCart.map(cond => `
      <span class="cart-chip${cartViewMode === cond.id ? ' active' : ''}" data-cart-view="${A.esc(cond.id)}" style="--chip-color:${A.esc(cond.color)}" title="${A.esc(cond.name)} 조건만 보기 · ${A.esc(describeCartFilters(cond.filters))}">
        <i class="cart-chip-dot" style="background:${A.esc(cond.color)}"></i><span class="cart-chip-name">${A.esc(cond.name)}</span>
        <button type="button" class="cart-chip-remove" data-cart-remove="${A.esc(cond.id)}" aria-label="${A.esc(cond.name)} 조건 삭제" title="삭제">×</button>
      </span>`).join('');
    root.innerHTML = allChip + unionChip + chips;
    const notice = document.getElementById('universe-cart-notice');
    if (notice) {
      notice.hidden = false;
      const active = cartViewMode !== 'all' && cartViewMode !== 'union'
        ? universeCart.find(cond => cond.id === cartViewMode)
        : null;
      if (cartViewMode === 'all') {
        notice.textContent = '지금은 저장된 조건과 무관하게 전체 유니버스를 보고 있습니다 — 아래 필터는 새 조건을 만들 때만 사용하세요.';
      } else if (active) {
        // 칩을 클릭해서 특정 조건만 보는 중이면 그 조건이 실제로 어떤 필터였는지 여기서 바로
        // 보여준다 - 예전엔 칩에 마우스를 올려야만(title 툴팁) 보였는데, 클릭한 결과 화면
        // 자체에서 바로 확인 가능해야 한다는 요청으로 추가.
        notice.textContent = `"${active.name}" 조건: ${describeCartFilters(active.filters)} — 아래 필터는 표에 바로 반영되지 않습니다(새 조건을 만들 때만 사용).`;
      } else {
        notice.textContent = '아래 필터는 표에 바로 반영되지 않습니다 — 새 조건을 만들 때만 사용하세요. 지금 표는 저장된 조건들의 합집합 기준으로 표시 중입니다.';
      }
    }
  }

  const UNIVERSE_SORT_COLUMNS = [
    { key: 'name', label: 'ETF · 종목코드' },
    { key: 'engineFeature', label: '엔진 · 특성' },
    { key: 'issuer', label: '운용사' },
    { key: 'traceIndex', label: '추종지수' },
    { key: 'aum', label: '순자산총액(AUM)', numeric: true },
    { key: 'tradeValue60dAvg', label: '60영업일 평균 거래대금', numeric: true },
    { key: 'listedDate', label: '상장일' }
  ];

  function universeSortValue(row, key) {
    if (key === 'engineFeature') {
      const mapping = workbookMapping(row);
      return mapping ? `${mapping.engine} ${mapping.feature}` : '';
    }
    return row[key];
  }

  function universeTheadHtml() {
    return `<tr>${UNIVERSE_SORT_COLUMNS.map(col => {
      const dirAttr = universeSort.key === col.key ? ` data-sort-dir="${universeSort.dir}"` : '';
      return `<th${col.numeric ? ' class="numeric"' : ''} data-sort-key="${col.key}"${dirAttr}>${A.esc(col.label)}</th>`;
    }).join('')}</tr>`;
  }

  function renderUniverse() {
    populateUniverseMappings();
    const theadEl = document.getElementById('universe-thead');
    if (theadEl) theadEl.innerHTML = universeTheadHtml();
    const filters = universeFilterState();
    const rows = universeSort.key
      ? universeRowsForCurrentView(filters).sort((a, b) => A.compareSortValues(universeSortValue(a, universeSort.key), universeSortValue(b, universeSort.key), universeSort.dir))
      : universeRowsForCurrentView(filters).sort((a, b) => (numericValue(b.aum) || 0) - (numericValue(a.aum) || 0));
    const body = document.getElementById('universe-body');
    body.innerHTML = rows.length
      ? rows.map(row => universeRowHtml(row, universeCart.length ? cartMatchesForRow(row) : [])).join('')
      : '<tr><td colspan="7" class="empty-state">조건 일치 ETF · 없음</td></tr>';
    // meta.generatedAt은 enrich_etf_trade_value_60d.py가 "실행된 시각"일 뿐 데이터
    // 기준일이 아니다(스크립트를 나중에 다시 돌리면 실제 데이터 범위와 무관하게 그
    // 시점으로 바뀐다) - 실제 거래대금 데이터가 커버하는 마지막 날짜인
    // tradeValue60dDateRange.to가 진짜 기준일이라 "기준일" 라벨엔 이걸 써야 한다.
    const asof = UNIVERSE_DATA.meta?.tradeValue60dDateRange?.to
      ? String(UNIVERSE_DATA.meta.tradeValue60dDateRange.to).slice(0, 10).replace(/-/g, '.')
      : (UNIVERSE_DATA.meta?.generatedAt ? String(UNIVERSE_DATA.meta.generatedAt).slice(0, 10).replace(/-/g, '.') : (UNIVERSE[0]?.historyDate || '-'));
    const asofNode = document.getElementById('universe-asof');
    const summary = document.getElementById('universe-summary');
    if (asofNode) asofNode.textContent = asof;
    if (summary) {
      const mapped = rows.filter(row => workbookMapping(row)).length;
      const resultLabel = !universeCart.length ? '필터 결과' : cartViewMode === 'all' ? '전체 유니버스' : '장바구니 결과';
      summary.textContent = `전체 ${UNIVERSE.length.toLocaleString('ko-KR')}개 · ${resultLabel} ${rows.length.toLocaleString('ko-KR')}개 · 엔진·특성 매핑 ${mapped.toLocaleString('ko-KR')}개`;
    }
    renderUniverseCartChips();
  }

  const INVESTMENT_SORT_COLUMNS = [
    { key: 'engine', label: '엔진' },
    { key: 'feature', label: '특성' },
    { key: 'symbol', label: '종목코드' },
    { key: 'etf', label: 'ETF 종목명' },
    { key: 'weight', label: '특성 비중', numeric: true }
  ];

  function investmentSortValue(row, key) {
    if (key === 'etf') return row.etf || row.defaultEtf;
    return row[key];
  }

  function investmentTheadHtml() {
    const sortableTh = INVESTMENT_SORT_COLUMNS.map(col => {
      const dirAttr = investmentSort.key === col.key ? ` data-sort-dir="${investmentSort.dir}"` : '';
      return `<th${col.numeric ? ' class="numeric"' : ''} data-sort-key="${col.key}"${dirAttr}>${A.esc(col.label)}</th>`;
    }).join('');
    return `<tr>${sortableTh}<th>관리</th></tr>`;
  }

  function renderEditor() {
    const theadEl = document.getElementById('investment-thead');
    if (theadEl) theadEl.innerHTML = investmentTheadHtml();
    const filtered = editorEngine === 'all' ? editorRows : editorRows.filter(row => row.engine === editorEngine);
    const rows = investmentSort.key
      ? filtered.slice().sort((a, b) => A.compareSortValues(investmentSortValue(a, investmentSort.key), investmentSortValue(b, investmentSort.key), investmentSort.dir))
      : filtered;
    document.getElementById('investment-body').innerHTML = editorRowsHtml(rows);
  }

  function addEditorRow() {
    const select = document.getElementById('add-engine-mp-category');
    const code = ENGINE_INFO[select?.value] ? select.value : 'I1';
    const info = ENGINE_INFO[code];
    const row = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code,
      engine: info.engine,
      feature: info.feature,
      defaultEtf: '',
      symbol: '',
      etf: '',
      issuer: '',
      listedDate: '',
      weight: 0
    };
    editorRows.push(row);
    editorEngine = info.engine;
    document.querySelectorAll('#engine-filter button').forEach(item => item.classList.toggle('active', item.dataset.engine === editorEngine));
    renderEditor();
    const newRow = document.querySelector(`#investment-body tr[data-row-id="${CSS.escape(row.id)}"]`);
    newRow?.querySelector('[data-field="symbol"]')?.focus({ preventScroll: true });
    renderMp();
  }

  function nextBusinessDate(value) {
    const date = new Date(`${String(value || '').replace(/\./g,'-')}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    do { date.setDate(date.getDate() + 1); } while (date.getDay() === 0 || date.getDay() === 6);
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }

  function latestTarget() {
    const modes = window.REGIME_PORTFOLIO_MODES || {};
    const targets = Array.isArray(modes.targets) ? modes.targets : [];
    const settings = A.getSettings();
    const series = A.adjustedSeries(settings);
    const score = A.finalObservation(settings);
    const detail = A.detailedRegimeForDate(series.dates?.at(-1), score, settings, A.getAdjustmentPeriods());
    const template = [...targets].reverse().find(target => target.portfolio_regime === detail) || targets.at(-1) || (modes.targets || {}).last || {};
    const signalDate = series.dates?.at(-1) || template.signal_date || '';
    return { ...template, portfolio_regime: detail, signal_date: signalDate, apply_date: nextBusinessDate(signalDate) || template.apply_date };
  }

  // "이전 MP · 월말 기준" - 오늘이 아니라 직전 완결된 월말 시점의 국면으로 목표를 계산한다.
  // (엔진·특성 비중/에디터는 스냅샷이 없으므로 현재값을 그대로 적용 - 국면 정하는 기준일만 다르다.)
  function monthEndTarget() {
    const modes = window.REGIME_PORTFOLIO_MODES || {};
    const targets = Array.isArray(modes.targets) ? modes.targets : [];
    const settings = A.getSettings();
    const series = A.adjustedSeries(settings);
    const monthEndFlags = (A.D.scores && A.D.scores.month_end) || [];
    const latest = series.dates.length - 1;
    const monthEndIdx = A.lastMonthEndIndex(series.dates, monthEndFlags, latest);
    const score = series.observed[monthEndIdx];
    const detail = A.detailedRegimeForDate(series.dates[monthEndIdx], score, settings, A.getAdjustmentPeriods());
    const template = [...targets].reverse().find(target => target.portfolio_regime === detail) || targets.at(-1) || (modes.targets || {}).last || {};
    const signalDate = series.dates[monthEndIdx] || template.signal_date || '';
    return { ...template, portfolio_regime: detail, signal_date: signalDate, apply_date: nextBusinessDate(signalDate) || template.apply_date };
  }

  // 엔진 코드별 배분(allocation, 합계<=1)을 실제 ETF별 비중으로 펼친다 — targetHoldings()와
  // holdingsForRegime() 둘 다가 쓰는 공통 코어(중복 로직 분리, 동작은 기존과 100% 동일).
  // rows를 생략하면(targetHoldings()의 기존 호출 전부가 그렇다) 항상 live editorRows를 쓴다 -
  // holdingsForRegime()만 기간별 강제 조정이 있을 때 대체 rows를 명시적으로 넘긴다.
  function expandAllocationToHoldings(baseAllocation, unmapped, rows = editorRows) {
    const grouped = rows.reduce((map, row) => {
      if (!map.has(row.code)) map.set(row.code, []);
      map.get(row.code).push(row);
      return map;
    }, new Map());

    const holdings = [];
    baseAllocation.forEach((allocation, code) => {
      const rows = (grouped.get(code) || []).filter(row => row.etf.trim());
      const referenceRows = rows.length ? rows : DEFAULT_ROWS.filter(row => row.code === code);
      if (!referenceRows.length) {
        // 이 특성에 배정된 ETF가 하나도 없으면(예: E4) 비중을 조용히 버리지 않고 "미배정"으로 남긴다.
        const info = ENGINE_INFO[code] || {};
        holdings.push({ asset: `미배정 · ${info.feature || code}`, weight: allocation });
        return;
      }
      const weightTotal = referenceRows.reduce((sum, row) => sum + Math.max(0, A.number(row.weight)), 0);
      const equalWeight = referenceRows.length ? 1 / referenceRows.length : 0;
      referenceRows.forEach(row => {
        const share = weightTotal > 0 ? Math.max(0, A.number(row.weight)) / weightTotal : equalWeight;
        holdings.push({ asset: row.etf.trim() || row.defaultEtf, weight: allocation * share });
      });
    });

    return holdings.concat(unmapped || []).filter(row => row.asset && row.weight > 0).sort((a, b) => b.weight - a.weight);
  }

  // 세부 국면 라벨만으로 ETF별 목표 비중을 만든다(target/holdings 불필요) — 기간별 강제
  // 재구성(historical backtest) 전용. featureWeights의 6개 행 전부 합계가 항상 >0이므로,
  // targetHoldings()가 쓰던 "정적 target.holdings로 폴백" 경로는 실무상 타지 않는다.
  //
  // dateStr을 넘기면(computeFeatureWeightBacktest만 넘긴다 - targetHoldings()의 기존 호출은
  // dateStr 없이 그대로 호출되므로 "국면 MP" 탭 동작은 100% 그대로다) 그 날짜를 덮는 기간별
  // 강제 조정이 있는지 먼저 확인해 있으면 그 값(비중 테이블/ETF 배정)을, 없으면 전역
  // featureWeights/editorRows를 쓴다 - 두 저장소가 서로 독립적이라 한쪽만 기간 조정돼 있어도
  // 다른 쪽은 전역값으로 정상 결합된다.
  function holdingsForRegime(regimeLabel, dateStr) {
    const fwPeriod = dateStr != null ? featureWeightPeriodForDate(dateStr, getFeatureWeightPeriods()) : null;
    const weightRows = fwPeriod ? fwPeriod.rows : featureWeights;
    const featureRow = weightRows.find(row => row.detail === regimeLabel);
    if (!featureRow) return [];
    const allocation = new Map();
    Object.entries(featureRow.weights).forEach(([code, weight]) => {
      if (ENGINE_INFO[code] && Number(weight) > 0) allocation.set(code, Number(weight) / 100);
    });
    if ([...allocation.values()].reduce((sum, value) => sum + value, 0) <= 0) return [];
    const erPeriod = dateStr != null ? editorRowsPeriodForDate(dateStr, getEditorRowsPeriods()) : null;
    return expandAllocationToHoldings(allocation, [], erPeriod ? erPeriod.rows : editorRows);
  }

  function targetHoldings(target) {
    const baseHoldings = Array.isArray(target.holdings) ? target.holdings : [];
    const defaultCodeByAsset = new Map(DEFAULT_ROWS.map(row => [row.defaultEtf, row.code]));
    const baseAllocation = new Map();
    const unmapped = [];

    baseHoldings.forEach(holding => {
      const asset = canonicalAssetName(holding.asset || holding.name || holding.etf || holding.ticker || '');
      const code = defaultCodeByAsset.get(asset);
      if (!code) { unmapped.push({ asset, weight: A.number(holding.weight) }); return; }
      baseAllocation.set(code, A.number(baseAllocation.get(code)) + A.number(holding.weight));
    });

    // 국면별 엔진·특성 비중 편집값을 현재 MP의 엔진 배분에 연결한다.
    // 편집값이 없거나 합계가 0이면 기존 정적 목표 비중을 그대로 사용한다.
    const fromFeatureWeights = holdingsForRegime(target.portfolio_regime);
    if (fromFeatureWeights.length) return fromFeatureWeights;

    return expandAllocationToHoldings(baseAllocation, unmapped);
  }

  // ---------------------------------------------------------------------
  // 기간 지정 국면 재구성 백테스트 - "국면에 따른 엔진별·특성별 비중"/"엔진별·특성별 MP"
  // 탭 전용. 각 월말 시점의 세부 국면(자연 발생 또는 adjustment.html 히스토리 탭에서
  // 강제 지정한 국면)을 판정하고, 그 시점에 현재 featureWeights/editorRows 설정을
  // 적용했다면 어떤 ETF 조합이 나왔을지와 그 성과를 재구성한다.
  //
  // 국면 판정은 이 탭이 이미 쓰는 latestTarget()/monthEndTarget()과 동일한 컨벤션
  // (A.adjustedSeries(settings)+A.detailedRegimeForDate) - performance.html의 ETF 백테스트가
  // 쓰는 ma120/60-40 컨벤션과는 별개 체계이므로 섞지 않는다. 성과 계산은
  // regime-override.js::simulateFullyInvestedPath()를 그대로 재사용한다.
  function computeFeatureWeightBacktest(start, end, settings) {
    const OD = window.REGIME_OVERRIDE_DATA;
    if (!OD || !OD.kospi200 || !Array.isArray(OD.kospi200.dates) || !OD.kospi200.dates.length) return null;
    if (!start || !end || start > end) return null;

    const s = settings || A.getSettings();
    const series = A.adjustedSeries(s);
    const monthEndFlags = (A.D.scores && A.D.scores.month_end) || [];
    const overrides = A.getRegimeOverrides();
    const adjustPeriods = A.getAdjustmentPeriods();

    const monthEndIdx = [];
    series.dates.forEach((d, i) => { if (monthEndFlags[i]) monthEndIdx.push(i); });

    function regimeAt(idx) {
      const d = series.dates[idx];
      const forced = A.regimeOverrideForDate(d, overrides);
      return { date: d, regime: forced || A.detailedRegimeForDate(d, series.observed[idx], s, adjustPeriods), forced: !!forced };
    }
    function buildSegment(info, applyDate, seed) {
      return { ...info, applyDate, seed, holdings: holdingsForRegime(info.regime, info.date) };
    }

    const dateAxis = OD.kospi200.dates.filter(d => d >= start && d <= end);
    if (!dateAxis.length) return null;

    // 조회 구간 시작일에 이미 보유 중이었을 국면(시작일 이전 마지막 월말)을 먼저 찾아
    // 구간 첫날부터 즉시 투자된 상태로 만든다 - 없으면(전체 이력의 첫 월말보다도 이전) 생략.
    const priorIdx = [...monthEndIdx].reverse().find(i => series.dates[i] < start);
    const segments = [];
    if (priorIdx != null) segments.push(buildSegment(regimeAt(priorIdx), dateAxis[0], true));

    monthEndIdx.filter(i => series.dates[i] >= start && series.dates[i] <= end).forEach(i => {
      const info = regimeAt(i);
      const applyDate = dateAxis.find(d => d >= nextBusinessDate(info.date));
      if (!applyDate) return; // 월말 신호 이후 반영될 다음 영업일이 구간 밖(구간 끝자락) - 완전히 무시
      segments.push(buildSegment(info, applyDate, false));
    });
    if (!segments.length) return null;

    const feeOneWay = 0.0025;
    const rebalanceWeightsByDate = new Map();
    segments.forEach(seg => {
      const weights = {};
      seg.holdings.forEach(h => {
        const key = overridePriceAssetKey(h.asset);
        if (!(OD.assets && OD.assets[key])) return; // 가격 데이터 없는 자산(예: "미배정" 항목)은 현금으로 처리
        weights[key] = (weights[key] || 0) + h.weight;
      });
      rebalanceWeightsByDate.set(seg.applyDate, weights);
    });

    const priceMaps = A.buildAssetPriceMaps();
    const neededAssets = new Set();
    rebalanceWeightsByDate.forEach(weights => Object.keys(weights).forEach(a => neededAssets.add(a)));
    const alignedPrices = {};
    neededAssets.forEach(name => { alignedPrices[name] = A.forwardFillPrice(dateAxis, priceMaps[name] || new Map()); });

    const rows = A.simulateFullyInvestedPath(dateAxis, rebalanceWeightsByDate, alignedPrices, feeOneWay);
    if (!rows.length) return null;

    // 벤치마크(KOSPI200 B&H) - 최초일 시가->종가, 이후 종가->종가 (computeEtfBacktest와 동일 컨벤션).
    const kospiByDate = new Map();
    OD.kospi200.dates.forEach((d, i) => kospiByDate.set(d, { open: OD.kospi200.open[i], close: OD.kospi200.close[i] }));
    let bhEquity = 1.0;
    const bhEquitySeries = [];
    dateAxis.forEach((d, i) => {
      const today = kospiByDate.get(d);
      let ret = 0;
      if (i === 0) { if (today && today.open != null && today.close != null && today.open !== 0) ret = today.close / today.open - 1; }
      else { const prev = kospiByDate.get(dateAxis[i - 1]); if (today && prev && prev.close) ret = today.close / prev.close - 1; }
      bhEquity *= 1 + ret;
      bhEquitySeries.push(bhEquity);
    });

    const metrics = A.dailyMetrics(rows.map(r => r.date), rows.map(r => r.equity), rows.map(r => r.strategy_return));
    const bhMetrics = A.dailyMetrics(dateAxis, bhEquitySeries, null);

    return {
      dates: rows.map(r => r.date),
      equity: rows.map(r => r.equity),
      drawdown: rows.map(r => r.drawdown),
      bh_equity: bhEquitySeries,
      metrics, bh_metrics: bhMetrics,
      segments
    };
  }

  // '저장' 버튼을 누른 순간의 목표 MP를 그대로 얼려서 이력에 남긴다 - '이전 MP'는
  // 이후 편집값이 바뀌어도 저장 시점의 홀딩스를 그대로 보여줘야 하므로, targetHoldings()를
  // 다시 계산하지 않고 이 스냅샷의 holdings를 그대로 사용한다.
  function loadMpSnapshots() {
    try { const list = JSON.parse(localStorage.getItem(MP_SNAPSHOT_STORE) || '[]'); return Array.isArray(list) ? list : []; }
    catch (_) { return []; }
  }
  function persistMpSnapshots(list) { localStorage.setItem(MP_SNAPSHOT_STORE, JSON.stringify(list)); }
  function captureMpSnapshot(trigger) {
    const target = latestTarget();
    const assetMap = new Map(editorRows.map(row => [row.etf.trim() || row.defaultEtf, row]));
    const holdings = targetHoldings(target).map(row => {
      const info = assetMap.get(row.asset) || {};
      return { asset: row.asset, weight: row.weight, engine: info.engine || '', feature: info.feature || '' };
    });
    const snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      trigger,
      signal_date: target.signal_date,
      apply_date: target.apply_date,
      portfolio_regime: target.portfolio_regime,
      holdings
    };
    const list = loadMpSnapshots();
    list.push(snapshot);
    persistMpSnapshots(list);
    selectedSnapshotId = null; // 새로 저장했으니 '저장 이력' 탭 드롭다운도 항상 최신 스냅샷을 보여주도록 리셋
    return snapshot;
  }

  const MP_SORT_COLUMNS = [
    { key: 'asset', label: 'ETF' },
    { key: 'engine', label: '엔진' },
    { key: 'feature', label: '특성' },
    { key: 'weight', label: '목표 비중', numeric: true }
  ];

  function mpTheadHtml() {
    return `<tr>${MP_SORT_COLUMNS.map(col => {
      const dirAttr = mpTableSort.key === col.key ? ` data-sort-dir="${mpTableSort.dir}"` : '';
      return `<th${col.numeric ? ' class="numeric"' : ''} data-sort-key="${col.key}"${dirAttr}>${A.esc(col.label)}</th>`;
    }).join('')}</tr>`;
  }

  function renderMpSnapshotPicker(snapshots) {
    const row = document.getElementById('mp-snapshot-row');
    const picker = document.getElementById('mp-snapshot-picker');
    if (!row || !picker) return;
    if (mpView !== 'history' || !snapshots.length) { row.hidden = true; return; }
    row.hidden = false;
    const ordered = snapshots.slice().reverse(); // 최신순
    picker.innerHTML = ordered.map(s => `<option value="${A.esc(s.id)}">${A.esc(new Date(s.timestamp).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }))} · ${A.esc(s.portfolio_regime || '-')}</option>`).join('');
    picker.value = selectedSnapshotId || ordered[0].id;
    if (!picker.dataset.bound) {
      picker.dataset.bound = 'true';
      picker.addEventListener('change', () => { selectedSnapshotId = picker.value; renderMp(); });
    }
  }

  function renderMp() {
    let holdings, regimeLabel, kicker, title, signalText, statLabels;
    const snapshots = loadMpSnapshots();

    if (mpView === 'target') {
      const target = latestTarget();
      const assetMap = new Map(editorRows.map(row => [row.etf.trim() || row.defaultEtf, row]));
      holdings = targetHoldings(target).map(row => {
        const info = assetMap.get(row.asset) || {};
        return { asset: row.asset, weight: row.weight, engine: info.engine || '', feature: info.feature || '' };
      });
      regimeLabel = target.portfolio_regime || '-';
      kicker = 'TARGET PORTFOLIO';
      title = '목표 MP';
      signalText = '실시간 국면 기준';
      statLabels = { count: '목표 ETF', total: '목표 비중 합계' };
    } else if (mpView === 'history') {
      // "저장 이력" 하위 탭 전용 - 드롭다운으로 고른 특정 저장 시점의 홀딩스를 그대로 보여준다
      // (이전 MP처럼 항상 최신으로 되돌아가지 않고 selectedSnapshotId를 그대로 존중).
      const snapshot = snapshots.length
        ? (snapshots.find(s => s.id === selectedSnapshotId) || snapshots[snapshots.length - 1])
        : null;
      if (snapshot) {
        holdings = snapshot.holdings || [];
        regimeLabel = snapshot.portfolio_regime || '-';
        signalText = `${A.esc(new Date(snapshot.timestamp).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }))} 저장된 국면 기준`;
      } else {
        holdings = [];
        regimeLabel = '-';
        signalText = '저장된 이력이 없습니다.';
      }
      kicker = 'SAVED HISTORY';
      title = '저장 이력';
      statLabels = { count: '저장 시점 편입 ETF', total: '저장 시점 비중 합계' };
    } else {
      // "이전 MP" - 항상 가장 최근 저장 이력을 보여준다.
      const snapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;
      if (snapshot) {
        holdings = snapshot.holdings || [];
        regimeLabel = snapshot.portfolio_regime || '-';
        signalText = `${A.esc(new Date(snapshot.timestamp).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }))} 저장된 국면 기준`;
      } else {
        // 저장 이력이 없을 때만 직전 월말 계산으로 대체 표시(빈 화면 방지용 임시값)
        const target = monthEndTarget();
        const assetMap = new Map(editorRows.map(row => [row.etf.trim() || row.defaultEtf, row]));
        holdings = targetHoldings(target).map(row => {
          const info = assetMap.get(row.asset) || {};
          return { asset: row.asset, weight: row.weight, engine: info.engine || '', feature: info.feature || '' };
        });
        regimeLabel = target.portfolio_regime || '-';
        signalText = '저장된 이력 없음 · 직전 월말 국면으로 임시 표시';
      }
      kicker = 'PREVIOUS PORTFOLIO';
      title = '이전 MP';
      statLabels = { count: '이전 편입 ETF', total: '이전 비중 합계' };
    }

    const total = holdings.reduce((sum, row) => sum + A.number(row.weight), 0);
    const engines = new Set(holdings.map(row => row.engine).filter(Boolean)).size;
    const sortedHoldings = mpTableSort.key
      ? holdings.slice().sort((a, b) => A.compareSortValues(a[mpTableSort.key], b[mpTableSort.key], mpTableSort.dir))
      : holdings.slice().sort((a, b) => b.weight - a.weight);

    document.getElementById('mp-view-kicker').textContent = kicker;
    document.getElementById('mp-view-title').textContent = title;
    document.getElementById('mp-regime').textContent = regimeLabel;
    document.getElementById('mp-signal').textContent = signalText;
    document.getElementById('mp-stats').innerHTML = `
      <div class="stat"><span class="stat-label">${statLabels.count}</span><strong class="stat-value">${holdings.length}개</strong><span class="stat-sub">편입 종목 수</span></div>
      <div class="stat"><span class="stat-label">${statLabels.total}</span><strong class="stat-value">${A.formatPct(total, 1)}</strong><span class="stat-sub">엔진별·특성별 MP 연동</span></div>
      <div class="stat"><span class="stat-label">엔진 수</span><strong class="stat-value">${engines || (holdings.length ? 3 : 0)}</strong><span class="stat-sub">Income · Performance · Edge</span></div>`;
    const theadEl = document.getElementById('mp-thead');
    if (theadEl) theadEl.innerHTML = mpTheadHtml();
    document.getElementById('mp-body').innerHTML = sortedHoldings.length
      ? sortedHoldings.map(row => `<tr><td>${A.esc(row.asset)}</td><td>${A.esc(row.engine || '-')}</td><td>${A.esc(row.feature || '-')}</td><td class="numeric positive">${A.formatPct(row.weight, 1)}</td></tr>`).join('')
      : `<tr><td colspan="4" class="empty-state">편입 종목 없음</td></tr>`;
    renderMpSnapshotPicker(snapshots);
  }

  function bindTabs() {
    const root = document.getElementById('portfolioTabs');
    root.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach(item => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      root.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab.dataset.tab));
      if (tab.dataset.tab === 'mp') renderMp();
      if (tab.dataset.tab === 'investment') renderEditor();
    }));
  }

  const MP_VIEWS = new Set(['prev-monthend', 'target', 'history']);

  function bindMpViewTabs() {
    A.bindSortableHeaders(document.getElementById('mp-body').closest('table'), (key, dir) => { mpTableSort = { key, dir }; renderMp(); });

    const root = document.getElementById('mp-view-tabs');
    if (!root) return;
    root.querySelectorAll('.subtab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.subtab').forEach(item => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      mpView = MP_VIEWS.has(tab.dataset.mpView) ? tab.dataset.mpView : 'prev-monthend';
      renderMp();
    }));
  }

  function activateHashTab() {
    const root = document.getElementById('portfolioTabs');
    const allowed = new Set(['universe', 'engine-feature-weight', 'investment', 'mp']);
    const tabName = window.location.hash.slice(1);
    if (!allowed.has(tabName)) return;
    const tab = root.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tab) tab.click();
  }

  function bindEditor() {
    A.bindSortableHeaders(document.getElementById('investment-body').closest('table'), (key, dir) => { investmentSort = { key, dir }; renderEditor(); });

    document.getElementById('engine-filter').addEventListener('click', event => {
      const button = event.target.closest('button[data-engine]');
      if (!button) return;
      editorEngine = button.dataset.engine;
      document.querySelectorAll('#engine-filter button').forEach(item => item.classList.toggle('active', item === button));
      renderEditor();
    });

    document.getElementById('investment-body').addEventListener('input', event => {
      const input = event.target.closest('input[data-field]');
      if (!input) return;
      const row = editorRows.find(item => item.id === input.closest('tr').dataset.rowId);
      if (!row) return;
      if (input.dataset.field === 'symbol') applySymbol(row, input.value);
      if (input.dataset.field === 'weight') row.weight = safeNumber(input.value, row.weight) / 100;
      const tableRow = input.closest('tr');
      const nameCell = tableRow?.querySelector('[data-role="etf-name-cell"]');
      if (nameCell) nameCell.innerHTML = nameCellHtml(row);
      renderMp();
    });

    document.getElementById('investment-body').addEventListener('click', event => {
      const button = event.target.closest('[data-action="delete-row"]');
      if (!button) return;
      const row = button.closest('tr');
      const id = row?.dataset.rowId;
      if (!id) return;
      editorRows = editorRows.filter(item => item.id !== id);
      renderEditor();
      renderMp();
    });

    const addButton = document.getElementById('add-engine-mp-row');
    if (addButton) addButton.addEventListener('click', addEditorRow);

    document.getElementById('reset-engine-mp').addEventListener('click', () => {
      localStorage.removeItem(PORTFOLIO_STORE);
      localStorage.removeItem(LEGACY_PORTFOLIO_STORE);
      editorRows = loadEditorRows();
      editorEngine = 'all';
      invPeriodDraft = null; // "강제 조정" 초안을 다음에 열 때 방금 복원된 기본값 기준으로 다시 초기화
      document.querySelectorAll('#engine-filter button').forEach(item => item.classList.toggle('active', item.dataset.engine === 'all'));
      renderEditor();
      renderMp();
    });

    const saveButton = document.getElementById('save-engine-mp');
    const saveStatus = document.getElementById('engine-mp-save-status');
    if (saveButton) saveButton.addEventListener('click', () => {
      saveEditorRows();
      invPeriodDraft = null; // "강제 조정" 초안을 다음에 열 때 방금 저장된 기본값 기준으로 다시 초기화
      captureMpSnapshot('engine-mp-save');
      renderMp();
      if (saveStatus) saveStatus.textContent = `저장 완료 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    });

    const featureBody = document.getElementById('engine-feature-weight-body');
    if (featureBody) featureBody.addEventListener('input', event => {
      const input = event.target.closest('[data-feature-weight]');
      if (!input) return;
      const [rowId, code] = input.dataset.featureWeight.split('|');
      const row = featureWeights.find(item => item.id === rowId);
      if (!row || !(code in row.weights)) return;
      row.weights[code] = safeNumber(input.value, row.weights[code]);
      const total = featureWeightTotal(row);
      const totalNode = featureBody.querySelector(`[data-feature-total="${row.id}"]`);
      if (totalNode) {
        totalNode.textContent = `${A.formatNumber(total,0)}%`;
        totalNode.classList.toggle('is-invalid', Math.abs(total - 100) > 0.5);
      }
      const engineKey = engineKeyForCode(code);
      const subtotalNode = engineKey && featureBody.querySelector(`[data-feature-subtotal="${row.id}|${engineKey}"]`);
      if (subtotalNode) subtotalNode.textContent = `${A.formatNumber(engineSubtotal(row, engineCodesForKey(engineKey)), 0)}%`;
      // 특성 비중 입력은 저장 전에도 목표 MP/이전 MP(월말 기준) 미리보기에 즉시 반영한다.
      renderMp();
    });

    const saveFeatureButton = document.getElementById('save-feature-weights');
    const featureStatus = document.getElementById('feature-weight-save-status');
    if (saveFeatureButton) saveFeatureButton.addEventListener('click', () => {
      const result = saveFeatureWeights();
      if (!featureStatus) return;
      featureStatus.classList.toggle('is-error', !result.ok);
      if (result.ok) {
        fwPeriodDraft = null; // "강제 조정" 초안을 다음에 열 때 방금 저장된 기본값 기준으로 다시 초기화
        captureMpSnapshot('feature-weight-save');
        renderMp();
        featureStatus.textContent = `저장 완료 · ${new Date().toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}`;
      } else {
        const detail = result.invalidRows.map(row => `${row.detail}(${A.formatNumber(featureWeightTotal(row),0)}%)`).join(', ');
        featureStatus.textContent = `저장 실패 · 합계 100%가 아님: ${detail}`;
      }
    });
    const resetFeatureButton = document.getElementById('reset-feature-weights');
    if (resetFeatureButton) resetFeatureButton.addEventListener('click', () => {
      localStorage.removeItem(FEATURE_WEIGHT_STORE);
      featureWeights = loadFeatureWeights();
      fwPeriodDraft = null; // "강제 조정" 초안을 다음에 열 때 방금 복원된 기본값 기준으로 다시 초기화
      renderFeatureWeights();
      renderMp();
      if (featureStatus) { featureStatus.classList.remove('is-error'); featureStatus.textContent = '기본값 복원'; }
    });

    window.addEventListener('aip5:adjustment-change', renderMp);
    window.addEventListener('aip5:feature-weight-change', renderMp);
    window.addEventListener('aip5:engine-feature-mp-change', renderMp);
    window.addEventListener('storage', event => {
      // A.adjustmentPeriodStoreKey(기간지정 조정)는 원래 이 목록에 없었음 - adjustedSeries()가
      // 이제 그 스토어도 반영하는데, 다른 탭에서 조정 기간을 추가/삭제해도 이 페이지의 MP
      // 미리보기(latestTarget/monthEndTarget이 adjustedSeries를 씀)가 새로고침 전까지 낡은
      // 값을 계속 보여주는 버그가 있었다.
      const linkedStores = [PORTFOLIO_STORE, FEATURE_WEIGHT_STORE, A.adjustmentSettingsStoreKey, A.adjustmentPeriodStoreKey, A.indicatorModeStoreKey];
      if (!linkedStores.includes(event.key)) return;
      if (event.key === PORTFOLIO_STORE) {
        editorRows = loadEditorRows();
        invPeriodDraft = null; // 다른 탭/창에서 바뀐 기본값으로 "강제 조정" 초안을 다시 초기화
        renderEditor();
        // 다른 창에서 저장하는 동안 이 창이 이미 "강제 조정" 하위 탭을 보고 있었다면
        // (예: 두 창을 나란히 열어둔 경우) 다음 방문까지 기다리지 않고 그 자리에서 갱신한다.
        const invOverridePanel = document.querySelector('[data-inv-panel="override"]');
        if (invOverridePanel && !invOverridePanel.hidden) renderEditorRowsPeriodDraft();
      }
      if (event.key === FEATURE_WEIGHT_STORE) {
        featureWeights = loadFeatureWeights();
        fwPeriodDraft = null;
        renderFeatureWeights();
        const fwOverridePanel = document.querySelector('[data-fw-panel="override"]');
        if (fwOverridePanel && !fwOverridePanel.hidden) renderFeatureWeightPeriodDraft();
      }
      renderMp();
    });
  }

  function bindUniverseFilters() {
    A.bindSortableHeaders(document.getElementById('universe-body').closest('table'), (key, dir) => { universeSort = { key, dir }; renderUniverse(); });

    ['universe-search', 'universe-engine-feature', 'universe-min-aum', 'universe-min-trade-value'].forEach(id => {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener(node.tagName === 'SELECT' ? 'change' : 'input', renderUniverse);
    });

    // 최소 AUM/거래대금 필터 입력값을 조/억원으로 환산해 입력창 우하단에 힌트로 보여준다
    // (표 셀의 formatWonCell·formatWon 재사용 - 표 자체는 이 기능과 무관, 건드리지 않는다).
    ['universe-min-aum', 'universe-min-trade-value'].forEach(id => {
      const input = document.getElementById(id);
      const hint = document.getElementById(`${id}-hint`);
      if (!input || !hint) return;
      const updateHint = () => {
        const value = numericValue(input.value);
        hint.textContent = value ? formatWon(value) : '';
      };
      input.addEventListener('input', updateHint);
      updateHint();
    });

    const reset = document.getElementById('reset-universe-filters');
    if (reset) reset.addEventListener('click', () => {
      ['universe-search', 'universe-min-aum', 'universe-min-trade-value'].forEach(id => { const node = document.getElementById(id); if (node) node.value = ''; });
      const engineFeature = document.getElementById('universe-engine-feature');
      if (engineFeature) engineFeature.value = '';
      document.querySelectorAll('.filter-hint').forEach(node => { node.textContent = ''; });
      renderUniverse();
    });
  }

  function bindUniverseCart() {
    const saveBtn = document.getElementById('universe-cart-save-btn');
    const nameInput = document.getElementById('universe-cart-name');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const name = (nameInput?.value || '').trim();
      if (!name) { nameInput?.focus(); return; }
      if (universeCart.some(cond => cond.name === name)) { nameInput?.focus(); nameInput?.select(); return; }
      const color = nextCartColor();
      const condition = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        color,
        filters: universeFilterState()
      };
      universeCart.push(condition);
      saveUniverseCart();
      cartViewMode = 'all';
      if (nameInput) nameInput.value = '';
      renderUniverse();
    });

    const chipsRoot = document.getElementById('universe-cart-chips');
    if (chipsRoot) chipsRoot.addEventListener('click', event => {
      const removeBtn = event.target.closest('[data-cart-remove]');
      if (removeBtn) {
        const id = removeBtn.dataset.cartRemove;
        universeCart = universeCart.filter(cond => cond.id !== id);
        saveUniverseCart();
        if (cartViewMode === id) cartViewMode = 'union';
        renderUniverse();
        return;
      }
      const viewBtn = event.target.closest('[data-cart-view]');
      if (viewBtn) {
        cartViewMode = viewBtn.dataset.cartView;
        renderUniverse();
      }
    });
  }

  // ---------------------------------------------------------------------
  // 기간 지정 국면 재구성 백테스트 UI - "국면에 따른 엔진별·특성별 비중"/"엔진별·특성별 MP"
  // 두 탭에 동일한 형태로 붙는다(prefix로 DOM id만 구분, 로직은 computeFeatureWeightBacktest
  // 하나 공유). 강제 국면 설정 자체는 adjustment.html 히스토리 탭이 유일한 관리 지점이므로
  // 여기서는 배너로 안내만 하고 편집 UI는 두지 않는다.
  const FEATURE_WEIGHT_BACKTEST_PREFIXES = ['fw-backtest', 'inv-backtest'];

  function renderRegimeOverrideBanner() {
    const list = A.getRegimeOverrides ? A.getRegimeOverrides() : [];
    FEATURE_WEIGHT_BACKTEST_PREFIXES.forEach(prefix => {
      const el = document.getElementById(`${prefix}-banner`);
      if (!el) return;
      el.hidden = !list.length;
      if (list.length) el.innerHTML = `강제 국면 설정 ${list.length}건 등록됨 · <a href="adjustment.html#history">Adjustment 히스토리 탭에서 관리</a>`;
    });
  }

  // ---------------------------------------------------------------------
  // "강제 조정" 하위 탭 - 전역 기본값(featureWeights/editorRows)과 별개로, 지정한
  // 기간에만 적용되는 대체 설정을 저장한다. 편집 UI는 "기본값" 탭의 표를 그대로
  // 재사용하되(초안 상태에 바인딩), 저장은 위 addFeatureWeightPeriod/addEditorRowsPeriod로.
  function draftFeatureInputStackHtml(row, codes) {
    return codes.map(code => `<div class="feature-weight-line"><input type="text" min="0" max="100" step="1" inputmode="numeric" data-comma-input="int" data-fw-draft-weight="${row.id}|${code}" value="${A.formatNumber(row.weights[code] || 0, 0)}" aria-label="${A.esc(ENGINE_INFO[code].feature)} 비중"><span>%</span></div>`).join('');
  }

  function renderFeatureWeightPeriodDraft() {
    if (!fwPeriodDraft) fwPeriodDraft = cloneFeatureWeightRows(featureWeights);
    const body = document.getElementById('fw-period-weight-body');
    if (!body) return;
    body.innerHTML = fwPeriodDraft.map(row => {
      const total = featureWeightTotal(row);
      const invalid = Math.abs(total - 100) > 0.5;
      const subtotalCell = (codes, engineKey) => `<td class="engine-${engineKey} subtotal-row-cell">소계</td><td class="weight subtotal-row-cell" data-fw-draft-subtotal="${row.id}|${engineKey}">${A.formatNumber(engineSubtotal(row, codes),0)}%</td>`;
      return `<tr data-fw-draft-row="${row.id}">
        <td class="phase-cell" rowspan="2">${A.esc(row.phase)}</td>
        <td class="detail-cell" rowspan="2">${A.esc(row.detail)}</td>
        <td class="engine-income">${featureStackHtml(INCOME_CODES)}</td><td class="weight feature-stack-weight">${draftFeatureInputStackHtml(row, INCOME_CODES)}</td>
        <td class="engine-performance">${featureStackHtml(PERFORMANCE_CODES)}</td><td class="weight feature-stack-weight">${draftFeatureInputStackHtml(row, PERFORMANCE_CODES)}</td>
        <td class="engine-edge">${featureStackHtml(EDGE_CODES)}</td><td class="weight feature-stack-weight">${draftFeatureInputStackHtml(row, EDGE_CODES)}</td>
      </tr>
      <tr data-fw-draft-subtotal-row="${row.id}">
        ${subtotalCell(INCOME_CODES,'income')}
        ${subtotalCell(PERFORMANCE_CODES,'performance')}
        ${subtotalCell(EDGE_CODES,'edge')}
        <td class="total-cell${invalid ? ' is-invalid' : ''}" data-fw-draft-total="${row.id}">${A.formatNumber(total,0)}%</td>
      </tr>`;
    }).join('');
  }

  function renderFeatureWeightPeriodHistory() {
    const body = document.getElementById('fw-period-history-body');
    if (!body) return;
    const list = getFeatureWeightPeriods();
    body.innerHTML = list.length ? list.map(p => `<tr>
      <td class="nowrap">${A.esc(A.formatDate(p.start))} ~ ${A.esc(A.formatDate(p.end))}</td>
      <td>${A.esc(p.note || '-')}</td>
      <td class="small nowrap">${A.esc(new Date(p.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }))}</td>
      <td><button type="button" class="line-btn" data-delete-fw-period="${A.esc(p.id)}" aria-label="이 강제 조정 삭제">삭제</button></td>
    </tr>`).join('') : '<tr><td colspan="4" class="small">저장된 강제 조정이 없습니다.</td></tr>';
  }

  function bindFeatureWeightPeriodForm() {
    const draftBody = document.getElementById('fw-period-weight-body');
    if (draftBody) draftBody.addEventListener('input', event => {
      const input = event.target.closest('[data-fw-draft-weight]');
      if (!input || !fwPeriodDraft) return;
      const [rowId, code] = input.dataset.fwDraftWeight.split('|');
      const row = fwPeriodDraft.find(item => item.id === rowId);
      if (!row || !(code in row.weights)) return;
      row.weights[code] = safeNumber(input.value, row.weights[code]);
      const total = featureWeightTotal(row);
      const totalNode = draftBody.querySelector(`[data-fw-draft-total="${row.id}"]`);
      if (totalNode) {
        totalNode.textContent = `${A.formatNumber(total,0)}%`;
        totalNode.classList.toggle('is-invalid', Math.abs(total - 100) > 0.5);
      }
      const engineKey = engineKeyForCode(code);
      const subtotalNode = engineKey && draftBody.querySelector(`[data-fw-draft-subtotal="${row.id}|${engineKey}"]`);
      if (subtotalNode) subtotalNode.textContent = `${A.formatNumber(engineSubtotal(row, engineCodesForKey(engineKey)), 0)}%`;
    });

    const form = document.getElementById('fw-period-form');
    if (form) form.addEventListener('submit', event => {
      event.preventDefault();
      const errorEl = document.getElementById('fw-period-error');
      try {
        const start = document.getElementById('fw-period-start').value;
        const end = document.getElementById('fw-period-end').value;
        const note = document.getElementById('fw-period-note').value;
        addFeatureWeightPeriod({ start, end, rows: fwPeriodDraft || cloneFeatureWeightRows(featureWeights), note });
        if (errorEl) errorEl.textContent = '';
        form.reset();
        fwPeriodDraft = null; // 다음 입력을 위해 현재 전역 기본값을 기준으로 다시 초기화
        renderFeatureWeightPeriodDraft();
        renderFeatureWeightPeriodHistory();
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message || '저장에 실패했습니다.';
      }
    });

    const historyBody = document.getElementById('fw-period-history-body');
    if (historyBody) historyBody.addEventListener('click', event => {
      const delBtn = event.target.closest('[data-delete-fw-period]');
      if (!delBtn) return;
      deleteFeatureWeightPeriod(delBtn.dataset.deleteFwPeriod);
      renderFeatureWeightPeriodHistory();
    });

    window.addEventListener('storage', event => {
      if (event.key === FEATURE_WEIGHT_PERIOD_STORE) renderFeatureWeightPeriodHistory();
    });
  }

  function bindFeatureWeightSubtabs() {
    const root = document.getElementById('fw-view-tabs');
    if (!root) return;
    root.querySelectorAll('.subtab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.subtab').forEach(item => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      const view = tab.dataset.fwView === 'override' ? 'override' : 'default';
      document.querySelectorAll('[data-fw-panel]').forEach(panel => { panel.hidden = panel.dataset.fwPanel !== view; });
      if (view === 'override') { renderFeatureWeightPeriodDraft(); renderFeatureWeightPeriodHistory(); }
    }));
  }

  function renderEditorRowsPeriodDraft() {
    if (!invPeriodDraft) invPeriodDraft = cloneEditorRows(editorRows);
    const body = document.getElementById('inv-period-editor-body');
    if (!body) return;
    body.innerHTML = editorRowsHtml(invPeriodDraft);
  }

  function renderEditorRowsPeriodHistory() {
    const body = document.getElementById('inv-period-history-body');
    if (!body) return;
    const list = getEditorRowsPeriods();
    body.innerHTML = list.length ? list.map(p => `<tr>
      <td class="nowrap">${A.esc(A.formatDate(p.start))} ~ ${A.esc(A.formatDate(p.end))}</td>
      <td>${A.esc(p.note || '-')}</td>
      <td class="small nowrap">${A.esc(new Date(p.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }))}</td>
      <td><button type="button" class="line-btn" data-delete-inv-period="${A.esc(p.id)}" aria-label="이 강제 조정 삭제">삭제</button></td>
    </tr>`).join('') : '<tr><td colspan="4" class="small">저장된 강제 조정이 없습니다.</td></tr>';
  }

  function bindEditorRowsPeriodForm() {
    const draftBody = document.getElementById('inv-period-editor-body');
    if (draftBody) {
      draftBody.addEventListener('input', event => {
        const input = event.target.closest('input[data-field]');
        if (!input || !invPeriodDraft) return;
        const row = invPeriodDraft.find(item => item.id === input.closest('tr').dataset.rowId);
        if (!row) return;
        if (input.dataset.field === 'symbol') applySymbol(row, input.value);
        if (input.dataset.field === 'weight') row.weight = safeNumber(input.value, row.weight) / 100;
        const tableRow = input.closest('tr');
        const nameCell = tableRow?.querySelector('[data-role="etf-name-cell"]');
        if (nameCell) nameCell.innerHTML = nameCellHtml(row);
      });
      draftBody.addEventListener('click', event => {
        const button = event.target.closest('[data-action="delete-row"]');
        if (!button || !invPeriodDraft) return;
        const id = button.closest('tr')?.dataset.rowId;
        if (!id) return;
        invPeriodDraft = invPeriodDraft.filter(item => item.id !== id);
        renderEditorRowsPeriodDraft();
      });
    }

    const addButton = document.getElementById('inv-period-add-row');
    if (addButton) addButton.addEventListener('click', () => {
      if (!invPeriodDraft) invPeriodDraft = cloneEditorRows(editorRows);
      const select = document.getElementById('inv-period-add-category');
      const code = ENGINE_INFO[select?.value] ? select.value : 'I1';
      const info = ENGINE_INFO[code];
      invPeriodDraft.push({ id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, code, engine: info.engine, feature: info.feature, defaultEtf: '', symbol: '', etf: '', issuer: '', listedDate: '', weight: 0 });
      renderEditorRowsPeriodDraft();
    });

    const form = document.getElementById('inv-period-form');
    if (form) form.addEventListener('submit', event => {
      event.preventDefault();
      const errorEl = document.getElementById('inv-period-error');
      try {
        const start = document.getElementById('inv-period-start').value;
        const end = document.getElementById('inv-period-end').value;
        const note = document.getElementById('inv-period-note').value;
        addEditorRowsPeriod({ start, end, rows: invPeriodDraft || cloneEditorRows(editorRows), note });
        if (errorEl) errorEl.textContent = '';
        document.getElementById('inv-period-start').value = '';
        document.getElementById('inv-period-end').value = '';
        document.getElementById('inv-period-note').value = '';
        invPeriodDraft = null;
        renderEditorRowsPeriodDraft();
        renderEditorRowsPeriodHistory();
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message || '저장에 실패했습니다.';
      }
    });

    const historyBody = document.getElementById('inv-period-history-body');
    if (historyBody) historyBody.addEventListener('click', event => {
      const delBtn = event.target.closest('[data-delete-inv-period]');
      if (!delBtn) return;
      deleteEditorRowsPeriod(delBtn.dataset.deleteInvPeriod);
      renderEditorRowsPeriodHistory();
    });

    window.addEventListener('storage', event => {
      if (event.key === EDITOR_ROWS_PERIOD_STORE) renderEditorRowsPeriodHistory();
    });
  }

  function bindInvestmentSubtabs() {
    const root = document.getElementById('inv-view-tabs');
    if (!root) return;
    root.querySelectorAll('.subtab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.subtab').forEach(item => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      const view = tab.dataset.invView === 'override' ? 'override' : 'default';
      document.querySelectorAll('[data-inv-panel]').forEach(panel => { panel.hidden = panel.dataset.invPanel !== view; });
      if (view === 'override') { renderEditorRowsPeriodDraft(); renderEditorRowsPeriodHistory(); }
    }));
  }

  function renderFeatureWeightBacktestFor(prefix) {
    const startEl = document.getElementById(`${prefix}-start`);
    const endEl = document.getElementById(`${prefix}-end`);
    const errorEl = document.getElementById(`${prefix}-error`);
    const resultEl = document.getElementById(`${prefix}-result`);
    if (!startEl || !endEl) return;
    if (errorEl) errorEl.textContent = '';
    const start = startEl.value, end = endEl.value;
    if (!start || !end) { if (resultEl) resultEl.hidden = true; return; }
    if (start > end) { if (errorEl) errorEl.textContent = '시작일이 종료일보다 이후입니다.'; if (resultEl) resultEl.hidden = true; return; }
    if (!window.REGIME_OVERRIDE_DATA) { if (errorEl) errorEl.textContent = '재구성에 필요한 가격 데이터가 로드되지 않았습니다.'; if (resultEl) resultEl.hidden = true; return; }

    const result = computeFeatureWeightBacktest(start, end, A.getSettings());
    if (!result) { if (errorEl) errorEl.textContent = '해당 기간에는 재구성할 수 있는 월말 국면 신호가 없습니다.'; if (resultEl) resultEl.hidden = true; return; }
    if (resultEl) resultEl.hidden = false;

    const m = result.metrics, bh = result.bh_metrics;
    const statEl = document.getElementById(`${prefix}-stats`);
    if (statEl) statEl.innerHTML = `
      <div class="stat"><span class="stat-label">총수익률</span><strong class="stat-value">${A.formatPct(m.total_return, 1)}</strong><span class="stat-sub">KOSPI200 B&amp;H ${A.formatPct(bh.total_return, 1)}</span></div>
      <div class="stat"><span class="stat-label">CAGR</span><strong class="stat-value">${A.formatPct(m.cagr, 1)}</strong><span class="stat-sub">KOSPI200 B&amp;H ${A.formatPct(bh.cagr, 1)}</span></div>
      <div class="stat"><span class="stat-label">MDD</span><strong class="stat-value">${A.formatPct(m.mdd, 1)}</strong><span class="stat-sub">KOSPI200 B&amp;H ${A.formatPct(bh.mdd, 1)}</span></div>
      <div class="stat"><span class="stat-label">Sharpe(rf0)</span><strong class="stat-value">${A.formatNumber(m.sharpe_rf0, 2)}</strong><span class="stat-sub">일간 재구성 기준</span></div>`;

    const segBody = document.getElementById(`${prefix}-segments`);
    if (segBody) segBody.innerHTML = result.segments.map(seg => `<tr>
      <td class="nowrap">${A.esc(A.formatDate(seg.date))}${seg.seed ? ' <span class="small">(구간 진입 시 국면)</span>' : ''}</td>
      <td class="nowrap">${A.esc(A.formatDate(seg.applyDate))}</td>
      <td>${A.esc(seg.regime)}</td>
      <td>${seg.forced ? '강제' : '자연'}</td>
    </tr>`).join('');

    const picker = document.getElementById(`${prefix}-segment-picker`);
    if (picker) {
      const ordered = result.segments.slice().reverse();
      picker.innerHTML = ordered.map((seg, i) => `<option value="${i}">${A.esc(A.formatDate(seg.applyDate))} · ${A.esc(seg.regime)}${seg.forced ? ' (강제)' : ''}</option>`).join('');
      const renderHoldings = () => {
        const seg = ordered[Number(picker.value) || 0];
        const holdingsBody = document.getElementById(`${prefix}-holdings`);
        if (!holdingsBody || !seg) return;
        holdingsBody.innerHTML = seg.holdings.length
          ? seg.holdings.map(h => `<tr><td>${A.esc(h.asset)}</td><td class="numeric positive">${A.formatPct(h.weight, 1)}</td></tr>`).join('')
          : `<tr><td colspan="2" class="empty-state">편입 종목 없음</td></tr>`;
      };
      if (!picker.dataset.bound) { picker.dataset.bound = 'true'; picker.addEventListener('change', renderHoldings); }
      picker.value = '0';
      renderHoldings();
    }
  }

  function bindFeatureWeightBacktest(prefix) {
    const runBtn = document.getElementById(`${prefix}-run`);
    if (runBtn) runBtn.addEventListener('click', () => renderFeatureWeightBacktestFor(prefix));
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindTabs();
    renderUniverse();
    buildCandidateDatalists();
    renderEditor();
    renderFeatureWeights();
    renderMp();
    bindMpViewTabs();
    bindEditor();
    bindUniverseFilters();
    bindUniverseCart();
    renderRegimeOverrideBanner();
    FEATURE_WEIGHT_BACKTEST_PREFIXES.forEach(bindFeatureWeightBacktest);
    bindFeatureWeightSubtabs();
    bindFeatureWeightPeriodForm();
    bindInvestmentSubtabs();
    bindEditorRowsPeriodForm();
    window.addEventListener('storage', event => {
      if (event.key === A.regimeOverrideStoreKey) renderRegimeOverrideBanner();
    });
    activateHashTab();
  });
})();
