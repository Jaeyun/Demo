(function () {
  'use strict';
  const A = window.AIP, D = A.D;
  // 고정 텍스트(설정/localStorage와 무관 — 과거에 저장된 빈 ai 필드가 있어도 항상 이 내용이 표시됨)
  // AI_COMMENT_GUIDE.md(dashboard/ 루트)의 "핫테마 표준 템플릿(10줄)" 구조를 그대로 따름.
  // 2026-08-18 v2: deepsearch-kg MCP(별도 지식그래프 - 실제 뉴스 감성·투자자 매매동향·핫테마 버즈
  // 데이터 보유)에서 직접 조회한 REAL 데이터로 재작성(hot_theme_commentary/keyword_news_timeline/
  // fundamental_screener). 핫테마는 실제 버즈 1위인 'AIDC'(AI 데이터센터, burst 29.32) - 후보였던
  // '신천지'는 정치인 스캔들 노이즈라 배제. Workflow 어드버서리얼 검증(2라운드) 통과.
  const FIXED_AI_THEME = '[주도 테마 진단] AIDC(AI 데이터센터)(가속기)\n▶ 버즈량 및 확산 속도: 최근 30일 뉴스 버스트 비율이 관측 테마 중 1위이며, 월별 기사량이 3월 66건→7월 170건→8월(18일 기준) 171건으로 가파르게 늘어 확산이 뚜렷이 가속 중\n▶ 핵심 모멘텀 트리거: SK텔레콤의 해킹 사태 수습 국면에서 AIDC 성장 스토리가 부각, LG유플러스의 AIDC 완판 소식, KT 임원의 AIDC-AX 핵심 발언 등 통신 3사의 전략 발표가 겹치며 부각\n▶ 기업 펀더멘털 정합성: 관련주 중 KT는 영업이익률 8.7%·ROE 9.4%로 수익성이 가장 탄탄한 반면, 밸류에이션이 가장 높은 SK텔레콤은 ROE가 2.9%에 그쳐 테마 스토리 대비 실제 이익 기반이 상대적으로 얇음\n▶ 밸류에이션 및 과열도: 관련주 PER가 KT 7.4배부터 SK텔레콤 59.6배까지 크게 벌어져 있어, 이미 밸류에이션이 상당히 반영된 종목과 아직 저평가로 남은 종목이 뚜렷이 갈림\n▶ 2차 확산 및 파생 테마: 같은 기간 \'레이밴\'(AI 글라스)·\'AI팩토리\' 테마도 함께 버스트하고 있어, AIDC를 축으로 한 AI 인프라 전반으로 온기가 번지는 초기 단계\n▶ 기관/외국인 수급 결합도: 시장 전체로는 이 구간 외국인이 순매수를 주도했으나, 이는 시장 전체 수급일 뿐 AIDC 테마 종목에 국한된 수치는 아님\n▶ 테마 수명주기 및 리스크: 뉴스량이 아직 최고월(진행 중인 이번 달)에 머물러 있어 소멸 신호는 없으나, 확산 속도가 꺾이는 시점을 지속 관찰할 필요\n▶ 주도주 vs 후발주 선별: 낮은 PER(7.4배)와 상대적으로 양호한 ROE를 겸비한 KT, 긍정적 뉴스 온기를 동반한 LG유플러스가 상대적으로 안전한 선택지\n▶ 포트폴리오 전술: 저PER 구간의 통신주 중심으로 비중을 유지하되, 고PER 종목은 신규 확대를 자제하고 확산 속도 둔화 신호가 나오면 차익실현을 검토';
  // AI_COMMENT_GUIDE.md의 "투자심리 표준 템플릿(10줄)" 구조. 2026-08-18 v2: market_sentiment_pulse
  // (deepsearch-kg) 실측 데이터로 재작성 - 뉴스심리 percentile 89.3(최근1년 상위 11%), 투자자
  // 매매동향(외국인 순매수 주도 vs 개인 순매도 주도), VKOSPI/풋콜비율/반대매매비중 percentile.
  // 센티먼트 Index는 뉴스심리(0.5)+역VKOSPI(0.25)+역풋콜(0.25) 가중평균(반대매매비중은 발행지연
  // 5주라 이 합성에서 제외, 대신 항목5에 별도 caveat과 함께 서술).
  const FIXED_AI_SENTIMENT = '[투자심리 상태] 탐욕 단계 (통합 센티먼트 Index: 68/100)\n▶ SNS 리테일 심리: 뉴스·SNS를 아우르는 시장심리 지표가 최근 1년 분포 상위 11%로 과열권에 근접해 있어, 리테일 관심도 과열의 방증으로 해석됨\n▶ 뉴스 미디어 톤앤매너: 최근 한 주 시장 전반 뉴스 톤이 평소보다 뚜렷하게 낙관적이며, 직전 구간 대비로도 그 수준을 그대로 유지\n▶ 파생/옵션 내재 심리: VKOSPI는 최근 1년 분포 기준 62.2퍼센타일로 다소 높은 편이고, 풋콜비율은 절대값 1.13까지 올랐으나 percentile로는 45.6에 그쳐 옵션시장이 방향성 있게 쏠린 상태는 아님\n▶ 레버리지 및 투기 지표: 반대매매비중이 최근 1년 분포 상위권까지 올라 레버리지 스트레스 경고 신호가 감지되나, 해당 지표는 발행 지연으로 한 달 이상 지난 시점 기준값임에 유의\n▶ 스마트머니 vs 리테일 괴리: 최근 구간 외국인이 순매수를 주도(자금 흐름의 절반)했고 개인이 순매도를 주도해, 개인이 판 물량을 외국인이 받아내는 구도\n▶ 가격-심리 다이버전스: 뉴스 심리와 실제 자금 흐름의 방향이 뚜렷이 어긋나지 않고 오히려 외국인 순매수 우위와 낙관적 뉴스 톤이 같은 방향을 가리켜, 이번 랠리는 실제 자금 유입을 동반한 강세로 판단됨\n▶ 단기 심리 변곡점(Trigger): 반대매매비중 최신치가 갱신돼 실제로도 여전히 높은 수준인지, 외국인 순매수 주도가 다음 구간에도 이어지는지가 단기 심리 반전의 트리거가 될 수 있음\n▶ 군집 심리(Herding) 위험도: \'게이츠\'·\'테라파워\' 등 특정 키워드 버즈가 동시에 급등하고 있어 뉴스 관심이 소수 소재로 쏠리는 중 - 쏠림이 풀리면 해당 소재 관련주의 변동성이 확대될 수 있음\n▶ 역발상 운용 시사점: 뉴스 심리 과열과 반대매매비중 상승이 겹치는 구간이므로, 외국인 순매수가 견조하더라도 추격 매수보다는 일부 이익실현과 레버리지 축소가 유효';
  // AI_COMMENT_GUIDE.md의 "국면예보 종합" 압축 지침 적용 - 실제 패널은 3~5줄 공간뿐이라 20줄
  // 전체 대신 핵심동인→특이 범주→보정근거→전망 순으로 압축. 날짜·세부국면(라벨)·스코어·관측값은
  // forecastInsight()가 이미 앞에 붙이므로 여기서 중복하지 않는다(1차 초안이 "중립"을 다시 적어
  // Workflow 검증에서 지적받고 수정). 2026-08-18 v2: market_sentiment_pulse+macro_indicator
  // (deepsearch-kg) 실측 데이터로 재작성 - 원/달러 환율 강세 전환, 기준금리 인상 후 동결 반영.
  const FIXED_FORECAST_NOTE = '시장 전체 뉴스 심리가 최근 1년 분포 상위권까지 달아오른 가운데, 외국인 순매수가 주도하는 위험선호 회복과 AIDC 등 개별 성장테마의 확산이 강세를 뒷받침\n원화가 뚜렷한 강세로 돌아섰고 기준금리도 인상 후 동결 기조를 유지해 매크로 여건은 우호적이나, 수급·변동성 범주는 상대적으로 취약해 종합 판단이 강세로 확실히 넘어가지 못하고 있음\n개인 투자자는 이 구간 내내 순매도를 이어가 뉴스 심리의 낙관과는 다른 태도를 보였고 반대매매비중도 높은 수준(다만 한 달 이상 지난 시점 기준으로 다소 오래된 수치)이라는 점은, 현재의 강세가 폭넓은 매수 주체 동조보다는 외국인 주도의 국지적 강세에 가깝다는 것을 보여주는 경계 요인\n뉴스 심리 과열과 개인 매도세가 계속 부딪히는 동안에는 추격 매수보다 분할 대응이 유효함';
  let stressChart, rawChart, marketChart, categoryChart, forecastChart, compareChart, globalRatesChart, rawRange='1', marketRange='1', stressRange='all', categoryRange='1', compareRange='1', globalRatesRange='10';
  let globalRatesRendered = false; // 서브탭 첫 활성화 때만 렌더(다른 탭들과 동일한 지연 렌더 관례)
  // 기본 선택 국가(영국 제외) - 체크박스로 사용자가 즉시 바꿀 수 있고, 페이지를 새로고침하면
  // 이 기본값으로 되돌아간다(서브탭 자체가 새로고침 시 "기초 지표"로 리셋되는 것과 동일한 정책 -
  // 영구 저장이 필요하면 별도 요청 시 localStorage로 확장).
  let globalRatesSelected = new Set(['US','EU','JP','CN','KR','AU']);
  let categoryCustomRange = null; // {start, end} (YYYY-MM-DD) - 설정돼 있으면 프리셋 버튼보다 우선
  // 네이티브 <select> 드롭다운을 열 때 브라우저가 목록이 들어갈 자리를 만들려고
  // 페이지를 강제로 스크롤시키는 경우가 있음 — 마우스 클릭 흐름에서는 mousedown의
  // 기본 동작(포커스 이동+팝업 오픈)이 진행되는 동안 스크롤이 이미 일어난 뒤에야
  // focus가 뜨는 경우가 있어(실측 확인됨) mousedown 쪽을 우선 캡처해야 하고,
  // 키보드로 Tab 이동해 포커스만 받는 흐름에서는 mousedown이 아예 없으므로 focus를
  // 폴백으로 둔다 — 둘 중 먼저 발생한 시점의 스크롤 위치를 기억해뒀다가 change 이후
  // 되돌려서 상쇄한다.
  function bindIndicatorSelect(select, handler) {
    if (!select) return;
    const capture = () => { if (select.dataset.preScrollY == null) select.dataset.preScrollY = String(window.scrollY); };
    select.addEventListener('mousedown', capture);
    select.addEventListener('focus', capture);
    select.addEventListener('change', () => {
      handler();
      const y = Number(select.dataset.preScrollY);
      delete select.dataset.preScrollY;
      if (Number.isFinite(y)) requestAnimationFrame(() => window.scrollTo(window.scrollX, y));
    });
  }
  let rawCatalogSort = { key: null, dir: 'asc' };
  let rawDetailSort = { key: null, dir: 'desc' };
  let marketDetailSort = { key: null, dir: 'desc' };

  // 탭이 숨겨진(display:none) 상태에서 echarts가 처음 초기화되면 컨테이너 폭을 0/기본값으로
  // 잘못 측정해 캔버스가 찌그러진 채로 굳어버리고, 창 크기를 실제로 바꾸기 전엔 스스로 안
  // 고쳐진다(A.createChart의 resize 리스너는 window 'resize' 이벤트에만 걸려있음). 특히
  // compareChart(수렴·발산)는 그 탭(market)의 렌더 함수(renderMarket)가 자기 차트만 resize할 뿐
  // compareChart는 건드리지 않아서, 탭을 열기만 해서는 절대 스스로 고쳐지지 않고 사용자가
  // compare 자체 컨트롤(지수 선택 등)을 직접 건드려야만 우연히 고쳐졌었다. resize()는 호출
  // 시점에 컨테이너 크기를 다시 읽으므로 클래스 토글 직후 동기적으로 불러도 정확하다(rAF까지
  // 기다릴 필요 없음 - 오히려 자동화 테스트 환경에서는 requestAnimationFrame 콜백이 전혀
  // 실행되지 않는 경우가 있어 그 프레임에만 의존하면 검증조차 안 되는 걸 확인함).
  function resizeAllCharts() {
    [forecastChart, categoryChart, rawChart, marketChart, compareChart, stressChart, globalRatesChart].forEach(c => c && c.resize());
  }
  function bindTabs() {
    const root = document.getElementById('adjustTabs');
    root.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      root.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
      resizeAllCharts();
      requestAnimationFrame(() => {
        if (tab.dataset.tab === 'forecast') renderForecast();
        if (tab.dataset.tab === 'input') renderCategoryChart();
        if (tab.dataset.tab === 'raw') renderRaw();
        if (tab.dataset.tab === 'market') renderMarket();
        if (tab.dataset.tab === 'stress') renderStress();
        if (tab.dataset.tab === 'history') renderOverrideHistory();
        resizeAllCharts();
      });
    }));
  }

  function todayISO() { const d=new Date(), pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function bindAdjustViewTabs() {
    const root = document.getElementById('adjust-view-tabs');
    if (!root) return;
    root.querySelectorAll('.subtab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.subtab').forEach(item => item.classList.toggle('active', item === tab));
      const view = tab.dataset.adjustView;
      document.querySelectorAll('[data-adjust-panel]').forEach(panel => { panel.hidden = panel.dataset.adjustPanel !== view; });
      if (view === 'entry') { resizeAllCharts(); renderCategoryChart(); }
    }));
  }

  function activateHashTab() {
    const root = document.getElementById('adjustTabs');
    const allowed = new Set(['forecast', 'input', 'raw', 'market', 'stress', 'ai', 'history']);
    const tabName = window.location.hash.slice(1);
    if (!allowed.has(tabName)) return;
    const tab = root.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tab) tab.click();
  }
  function readForm() {
    const next = A.getSettings();
    next.observation = A.clamp(Math.round(A.number(document.getElementById('observation').value, 60)), 1, 300);
    next.scoreHi = A.clamp(Math.round(A.number(document.getElementById('score-hi').value, 60)), 0, 100);
    next.scoreLo = A.clamp(Math.round(A.number(document.getElementById('score-lo').value, 45)), 0, 100);
    A.CATEGORY_KEYS.forEach(key => { next.adjustments[key] = A.clamp(A.number(document.querySelector(`[data-adjust="${key}"]`).value), -30, 30); });
    next.structural = document.getElementById('structural-toggle').checked; next.event = document.getElementById('event-toggle').checked; next.highVol = document.getElementById('high-vol-toggle').checked;
    return next;
  }
  function fillForm() {
    const s = A.getSettings();
    document.getElementById('adjust-list').innerHTML = A.CATEGORY_KEYS.map(key => { const m=A.CATEGORY_META[key]; return `<div class="adjust-row"><i class="score-dot" style="background:${m.color}"></i><label for="adjust-${key}">${m.name}</label><input id="adjust-${key}" data-adjust="${key}" type="text" min="-30" max="30" step="1" inputmode="numeric" data-comma-input="int-signed" value="${s.adjustments[key]}"></div>`; }).join('');
    document.getElementById('observation').value = s.observation; document.getElementById('score-hi').value = s.scoreHi; document.getElementById('score-lo').value = s.scoreLo; document.getElementById('structural-toggle').checked = s.structural; document.getElementById('event-toggle').checked = s.event; document.getElementById('high-vol-toggle').checked = s.highVol;
    document.getElementById('adjust-apply-start-label').textContent = A.formatDate(todayISO());
    renderAiCommentText(document.getElementById('ai-theme'), FIXED_AI_THEME);
    renderAiCommentText(document.getElementById('ai-sentiment'), FIXED_AI_SENTIMENT);
  }
  // 첫 줄([...] 제목)은 굵게 별도 단락으로, 나머지 ▶ 항목은 한 줄씩 별도 단락으로 렌더링한다.
  // white-space:pre-line만으로는 줄바꿈은 되어도 제목과 본문이 시각적으로 구분되지 않아서
  // (사용자 피드백) 명시적으로 <p> 단락 구조를 준다.
  function renderAiCommentText(el, text) {
    const lines = String(text || '').split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) { el.textContent = ''; return; }
    const [title, ...body] = lines;
    el.innerHTML = `<p class="ai-comment-title">${A.esc(title)}</p>` + body.map(line => `<p class="ai-comment-line">${A.esc(line)}</p>`).join('');
  }
  // "국면예보" 탭 좌측 "최종 스코어"와 동일하게 직전 월말 확정치를 기준으로 한다
  // (오늘자 A.finalObservation이 아님) - 두 탭이 조정치 0일 때 같은 스코어를 보여줘야
  // 한다는 사용자 확인에 따른 것. portfolio.js의 실제 목표 MP/저장 스냅샷 로직
  // (latestTarget/captureMpSnapshot)은 이 변경과 무관하게 오늘자 기준을 그대로 유지한다.
  function scoreSnapshot(settings) {
    const series = A.adjustedSeries(settings);
    const latestIdx = series.dates.length - 1;
    const monthEndIdx = A.lastMonthEndIndex(series.dates, D.scores.month_end, latestIdx);
    const score = Number(series.observed[monthEndIdx]) || 0, regime = A.regimeFromScore(score, settings);
    const daily = series.daily[monthEndIdx] || 0;
    return { series, score, regime, daily, detail:A.detailedRegimeForDate(series.dates[monthEndIdx], score, settings, A.getAdjustmentPeriods()) };
  }
  function renderPreview() {
    const s = readForm(), snapshot=scoreSnapshot(s), quantitativeSettings={...s, adjustments:Object.fromEntries(A.CATEGORY_KEYS.map(key=>[key,0]))}, quantitativeSnapshot=scoreSnapshot(quantitativeSettings), {score, detail}=snapshot;
    document.getElementById('adjust-preview-raw-score').textContent = A.formatNumber(quantitativeSnapshot.score);
    document.getElementById('adjust-preview-score').textContent = A.formatNumber(score);
    document.getElementById('adjust-preview-regime').textContent = detail;
  }
  // "기간 지정 조정" 하위 탭 - 시작일·종료일을 직접 지정해 새 기간을 추가하는 폼(항상 0부터
  // 시작, readForm()과 달리 저장된 설정값을 반영하지 않는다 - "이번에 추가할 기간의 조정값"이지
  // "조정 입력" 탭의 오늘-기준 조정과는 무관하다).
  function fillAdjustPeriodForm() {
    document.getElementById('adjust-period-list').innerHTML = A.CATEGORY_KEYS.map(key => { const m=A.CATEGORY_META[key]; return `<div class="adjust-row"><i class="score-dot" style="background:${m.color}"></i><label for="adjust-period-${key}">${m.name}</label><input id="adjust-period-${key}" data-adjust-period="${key}" type="text" min="-30" max="30" step="1" inputmode="numeric" data-comma-input="int-signed" value="0"></div>`; }).join('');
  }
  function readAdjustPeriodForm() {
    const adjustments = {};
    A.CATEGORY_KEYS.forEach(key => { adjustments[key] = A.clamp(A.number(document.querySelector(`[data-adjust-period="${key}"]`).value), -30, 30); });
    return {
      start: document.getElementById('adjust-period-start').value,
      end: document.getElementById('adjust-period-end').value,
      note: document.getElementById('adjust-period-note').value.trim(),
      adjustments,
      structural: document.getElementById('adjust-period-structural').checked,
      event: document.getElementById('adjust-period-event').checked,
      highVol: document.getElementById('adjust-period-high-vol').checked
    };
  }
  function bindAdjustPeriodForm() {
    document.getElementById('adjust-period-form').addEventListener('submit', event => {
      event.preventDefault();
      const errorEl = document.getElementById('adjust-period-error');
      try {
        const { start, end, note, adjustments, structural, event: eventToggle, highVol } = readAdjustPeriodForm();
        A.addAdjustmentPeriod({ start, end, note, adjustments, structural, event: eventToggle, highVol });
        errorEl.textContent = '';
        document.getElementById('adjust-period-form').reset();
        fillAdjustPeriodForm();
        rerenderAllAfterAdjustPeriodChange();
      } catch (err) {
        errorEl.textContent = err.message || '저장에 실패했습니다.';
      }
    });
  }
  // 기간별 조정 이력 - 표 각 행이 바로 그 기간의 저장된 값이며, 셀 안의 입력을 바꾸면
  // (change 시점에) A.updateAdjustmentPeriod로 즉시 반영된다. 시작일은 저장 당시 오늘 날짜로
  // 고정되므로 이 표에서는 읽기 전용이다.
  function periodRowHtml(p) {
    const catCells = A.CATEGORY_KEYS.map(key => `<td><input type="text" class="period-cell-input" data-period-field="${key}" data-period-id="${A.esc(p.id)}" min="-30" max="30" step="1" inputmode="numeric" data-comma-input="int-signed" value="${A.esc(p.adjustments[key])}"></td>`).join('');
    return `<tr>
        <td class="nowrap">${A.esc(A.formatDate(p.start))}</td>
        <td class="nowrap"><input type="date" class="period-cell-input" data-period-field="end" data-period-id="${A.esc(p.id)}" value="${A.esc(p.end)}"></td>
        ${catCells}
        <td class="center"><input type="checkbox" data-period-field="structural" data-period-id="${A.esc(p.id)}" ${p.structural ? 'checked' : ''}></td>
        <td class="center"><input type="checkbox" data-period-field="event" data-period-id="${A.esc(p.id)}" ${p.event ? 'checked' : ''}></td>
        <td class="center"><input type="checkbox" data-period-field="highVol" data-period-id="${A.esc(p.id)}" ${p.highVol ? 'checked' : ''}></td>
        <td><input type="text" class="period-cell-input" data-period-field="note" data-period-id="${A.esc(p.id)}" value="${A.esc(p.note || '')}" placeholder="메모"></td>
        <td class="small nowrap">${A.esc(new Date(p.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }))}</td>
        <td><button type="button" class="line-btn" data-delete-adjust-period="${A.esc(p.id)}" aria-label="이 기간 조정 삭제">삭제</button></td>
      </tr>`;
  }
  function renderAdjustPeriodHistory() {
    const list = A.getAdjustmentPeriods();
    const body = document.getElementById('adjust-period-history-body');
    if (!body) return;
    body.innerHTML = list.length ? list.map(periodRowHtml).join('') : '<tr><td colspan="13" class="small">저장된 기간 조정이 없습니다.</td></tr>';
  }
  function rerenderAllAfterAdjustPeriodChange() {
    // 기간 저장/수정/삭제는 전부 A.getSettings()(영구 설정 - 분류별 조정/세부국면축은 이제
    // 항상 0/false로 리셋됨)를 바꾸거나 기간 목록만 바꾼다. fillForm()으로 폼 입력을
    // A.getSettings()에 다시 맞춰주지 않으면, readForm()으로 DOM을 그대로 읽는
    // renderPreview()가 방금 제출/삭제된 값을 계속 들고 있어 국면예보 탭(A.getSettings()
    // 직접 사용)과 서로 다른 스코어를 보여주는 채로 새로고침 전까지 남는다(실측 확인된 버그).
    fillForm();
    renderAdjustPeriodHistory();
    renderPreview();
    renderForecast();
    renderCategoryChart();
  }
  function bindAdjustPeriodHistoryEdits() {
    const body = document.getElementById('adjust-period-history-body');
    const errorEl = document.getElementById('adjust-period-edit-error');
    body.addEventListener('change', event => {
      const target = event.target, id = target.dataset.periodId, field = target.dataset.periodField;
      if (!id || !field) return;
      const patch = {};
      if (A.CATEGORY_KEYS.includes(field)) patch.adjustments = { [field]: A.number(target.value) };
      else if (field === 'end') patch.end = target.value;
      else if (field === 'structural' || field === 'event' || field === 'highVol') patch[field] = target.checked;
      else if (field === 'note') patch.note = target.value.trim();
      else return;
      try {
        A.updateAdjustmentPeriod(id, patch);
        errorEl.textContent = '';
        rerenderAllAfterAdjustPeriodChange();
      } catch (err) {
        errorEl.textContent = err.message || '수정에 실패했습니다.';
        renderAdjustPeriodHistory(); // 실패한 입력을 저장된 값으로 되돌려 화면에 반영
      }
    });
    body.addEventListener('click', event => {
      const delBtn = event.target.closest('[data-delete-adjust-period]');
      if (!delBtn) return;
      A.deleteAdjustmentPeriod(delBtn.dataset.deleteAdjustPeriod);
      errorEl.textContent = '';
      rerenderAllAfterAdjustPeriodChange();
    });
    // 다른 탭에서 추가/삭제/수정한 경우(예: 두 창을 나란히 열어둔 경우)에도 반영되도록.
    // indicatorModeStoreKey(정량 분석 페이지의 지표별 일단위/월단위 토글)도 A.adjustedSeries()
    // 결과에 영향을 주므로 같은 재렌더 세트(renderPreview/renderForecast/renderCategoryChart)로 반영.
    window.addEventListener('storage', event => {
      if (event.key === A.adjustmentPeriodStoreKey || event.key === A.indicatorModeStoreKey) rerenderAllAfterAdjustPeriodChange();
    });
  }
  function renderForecast() {
    // 국면예보 탭 헤드라인(forecast-summary 좌측 패널)은 직전 월말(month-end) 확정
    // 스코어를 쓴다 — 오늘자 실시간 값(A.finalObservation)이 아니라 s.observed[monthEndIdx].
    // scoreSnapshot()도 동일한 월말 기준을 쓰지만 여기서 재사용하지 않는 이유는 조정치
    // 반영 방식이 다르기 때문(renderPreview는 실제/조정0 두 버전을 비교 표시).
    // 반면 forecast-grid/forecast-chart/AI 코멘트는 오늘자(최신) 인덱스를 그대로 보여주는
    // 상세 뷰이므로 latestIdx를 별도로 사용한다.
    const settings=A.getSettings(), s=A.adjustedSeries(settings);
    const latestIdx=s.dates.length-1;
    const monthEndIdx=A.lastMonthEndIndex(s.dates, D.scores.month_end, latestIdx);
    const date=s.dates[monthEndIdx], score=Number(s.observed[monthEndIdx]), detail=A.detailedRegimeForDate(date, score, settings, A.getAdjustmentPeriods());
    const minScore=A.min(s.observed), maxScore=A.max(s.observed), meanScore=A.mean(s.observed);
    // AI Comment는 좌측 "최종 스코어"(직전 월말 확정치)와 별개로 오늘자 세부 국면을 보여주는
    // 상세 뷰다 - forecastInsight()에 좌측과 같은 월말 detail을 그대로 넘기면 오늘 날짜 옆에
    // 월말 시점 세부국면이 표시되는 불일치가 생긴다(실측으로 확인된 버그). 여기서 latestIdx
    // 기준으로 다시 계산해 완전히 오늘자로 anchor한다. 스코어 수치 자체는 이 패널 위쪽
    // "최종 스코어"에 이미 보이므로 AI Comment 안에서는 반복 표시하지 않는다(사용자 지시).
    const todayDetail=A.detailedRegimeForDate(s.dates[latestIdx], Number(s.observed[latestIdx]), settings, A.getAdjustmentPeriods());
    // 라벨(최종 스코어/세부 국면)을 먼저, 값(스코어/세부국면값)을 그 다음에 나열해서
    // grid auto-flow가 "1행=라벨 전부, 2행=값 전부"로 자동 배치되게 한다 - 이렇게 해야
    // 최종 스코어(큰 폰트)와 세부 국면(작은 폰트)처럼 폰트 크기가 달라도 라벨끼리·값끼리
    // 항상 같은 가로줄에 정렬된다(사용자 지적: 폰트 크기에 따라 위치가 흔들리던 문제).
    // 통계(최저/평균/최고)도 동일한 원리로 라벨 3개 먼저, 값 3개 나중에 나열.
    document.getElementById('forecast-summary').innerHTML=`<div class="forecast-score-pane"><span>최종 스코어</span><span>세부 국면</span><strong>${A.formatNumber(score)}</strong><b>${detail}</b><div class="forecast-composite-stats"><span>최저</span><span>평균</span><span>최고</span><b>${A.formatNumber(minScore)}</b><b>${A.formatNumber(meanScore)}</b><b>${A.formatNumber(maxScore)}</b></div></div><div class="forecast-ai-pane"><span>AI Comment</span><div class="ai-comment">${forecastInsight(settings, todayDetail, latestIdx)}</div></div>`;
    document.getElementById('forecast-grid').innerHTML=A.CATEGORY_KEYS.map(key => {
      const meta=A.CATEGORY_META[key], full=s.categories[key]||[];
      const windowedMean=A.rollingMean(full, settings.observation).at(-1) ?? 0;
      return `<article class="forecast"><div class="forecast-head"><span class="score-label"><i class="score-dot" style="background:${meta.color}"></i>${A.esc(meta.name)}</span></div><div class="forecast-score">${A.formatNumber(windowedMean)}</div><div class="forecast-row"><span>최저</span><b>${A.formatNumber(A.min(full))}</b></div><div class="forecast-row"><span>최고</span><b>${A.formatNumber(A.max(full))}</b></div><div class="forecast-row"><span>평균</span><b>${A.formatNumber(A.mean(full))}</b></div></article>`;
    }).join('');
    // 분류 5개 선을 종합 스코어와 똑같은 굵기·불투명도로 겹쳐 그리면 정작 헤드라인 값인
    // 종합 스코어(검은선)가 색색의 분류선들 사이에 묻혀 잘 안 보였다 - 분류선은 옅게 깔고
    // 종합선만 굵고 진하게 둬서 어떤 선이 핵심인지 한눈에 들어오게 한다.
    const chartSeries=A.CATEGORY_KEYS.map(key => { const meta=A.CATEGORY_META[key]; return { name:meta.name, data:A.rollingMean(s.categories[key]||[], settings.observation), color:meta.color, width:1.3, opacity:0.45 }; });
    chartSeries.push({ name:'종합 스코어', data:s.observed, color:'#102a43', width:3.2 });
    forecastChart=A.createChart(document.getElementById('forecast-chart'), A.lineOption({dates:s.dates, minY:0, maxY:100, yName:'점수', series:chartSeries}));
    requestAnimationFrame(()=>forecastChart?.resize());
  }
  // 단기/장기 스트레스 포털 원자료에서 기준일 이전 가장 최근 행의 값을 읽는다.
  // renderStress()의 stressSeriesValue()와 달리 날짜 기준으로 특정 시점(오늘) 값을
  // 찾을 때 쓴다 — forecastInsight()가 월말이 아닌 오늘자 스트레스 수치를 인용하기 위함.
  function latestStressValue(source, atOrBeforeDate, names) {
    const rows=(source && source.rows) || [];
    for (let i=rows.length-1; i>=0; i--) {
      const row=rows[i], date=String((row && (row.date || row.Date)) || '');
      if (!date || date > atOrBeforeDate) continue;
      for (const name of names) {
        const raw=row[name];
        if (raw===null || raw===undefined || raw==='') continue;
        const n=Number(raw);
        if (Number.isFinite(n)) return name==='score100' ? n : n*100;
      }
      return null;
    }
    return null;
  }
  // forecast-summary AI Comment 패널 텍스트. detail은 호출부(renderForecast)가 오늘자
  // 기준으로 미리 계산해 넘겨주는 세부 국면 - 날짜·스코어 수치는 여기서 다시 표시하지
  // 않는다(사용자 지시 - 패널 위쪽에 이미 스코어 수치가 별도로 보이므로 중복 불필요).
  function forecastInsight(settings, detail, index) {
    const s=A.adjustedSeries(settings), date=s.dates[index];
    const note=FIXED_FORECAST_NOTE;
    let extraLines;
    if (note) {
      extraLines=note.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>`<p class="forecast-ai-line">▶ ${A.esc(line)}</p>`).join('');
    } else {
      const catValues=A.CATEGORY_KEYS.map(key => ({ name:A.CATEGORY_META[key].name, value:Number(s.categories[key][index])||0 }));
      const sorted=[...catValues].sort((a,b)=>b.value-a.value), strongest=sorted[0], weakest=sorted[sorted.length-1];
      const spread=strongest.value-weakest.value;
      const shortStress=latestStressValue(window.SHORT_STRESS_PORTAL, date, ['score100','score']);
      const longStress=latestStressValue(window.SMOOTH_TREND_DATA, date, ['continuous_distance_ema10_score','score100','current_step_score']);
      const alerts=[];
      if (Number.isFinite(shortStress) && shortStress>=40) alerts.push(`단기 스트레스 ${A.formatNumber(shortStress)}`);
      if (Number.isFinite(longStress) && longStress>=45) alerts.push(`장기 스트레스 ${A.formatNumber(longStress)}`);
      const toggles=A.resolvedToggles(date, settings, A.getAdjustmentPeriods());
      if (toggles.structural) alerts.push('구조적 약세장 체크');
      if (toggles.event) alerts.push('이벤트적 약세장 체크');
      if (toggles.highVol) alerts.push('고변동성 체크');
      const riskLine=alerts.length ? alerts.join(' · ') : '스트레스 임계치 미도달';
      extraLines=`최강 ${A.esc(strongest.name)} ${A.formatNumber(strongest.value)} · 최약 ${A.esc(weakest.name)} ${A.formatNumber(weakest.value)} · 격차 ${A.formatNumber(spread)}<br>${riskLine}`;
    }
    return `<b>${A.formatDate(date)} · ${detail}</b>${extraLines}`;
  }
  // 지표별 강제 소수점 자릿수(예: 경기동행지수순환변동치·원/달러 환율은 항상 둘째자리까지) -
  // 지정 안 된 지표는 기존처럼 값 크기 기반 자동 규칙을 그대로 쓴다.
  const RAW_DECIMAL_OVERRIDE = { coincident_cycle: 2, usd_krw: 2 };
  function rawNumber(value, forcedDecimals) {
    const n=Number(value); if (!Number.isFinite(n)) return '-';
    if (forcedDecimals != null) return n.toLocaleString('ko-KR',{minimumFractionDigits:forcedDecimals,maximumFractionDigits:forcedDecimals});
    const abs=Math.abs(n); const digits=abs && abs<100 ? 4 : 0; return n.toLocaleString('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:digits});
  }
  function programMoneyNumber(value) {
    const n=Number(value); if (!Number.isFinite(n)) return '-';
    const sign=n<0?'-':'', eok=Math.round(Math.abs(n)/100000000);
    if (!eok) return '0원';
    const jo=Math.floor(eok/10000), remainder=eok%10000;
    if (jo) return `${sign}${jo.toLocaleString('ko-KR')}조${remainder?` ${remainder.toLocaleString('ko-KR')}억원`:'원'}`;
    return `${sign}${eok.toLocaleString('ko-KR')}억원`;
  }
  function pctNumber(value) { const n=Number(value); return Number.isFinite(n) ? `${n.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})}%` : '-'; }
  function programCumulativeRows(rows, dates, deltaFn) {
    let cumulative=0;
    return dates.map(date=>{
      const delta=deltaFn(date);
      const d=Number.isFinite(delta)?delta:0;
      cumulative+=d;
      // delta를 같이 들고 있어야 기간(1/3/5년) 선택 시 그 구간만 다시 누적할 수 있다
      // (value는 2005년부터의 전체 누적 - 카탈로그의 "최신 누적값"에 계속 쓰임).
      return { date, raw_value:String(cumulative), value:cumulative, delta:d };
    });
  }
  function programDisplayIndicators(indicators) {
    const nonIndex=indicators.findIndex(item=>/프로그램매매\s*비차익/.test(String(item.label||''))), totalIndex=indicators.findIndex(item=>/프로그램매매\s*전체/.test(String(item.label||'')));
    if (nonIndex<0 || totalIndex<0) return indicators;
    const non=indicators[nonIndex], total=indicators[totalIndex], nonMap=new Map((non.rows||[]).map(row=>[String(row.date||''),A.number(row.value,NaN)])), totalMap=new Map((total.rows||[]).map(row=>[String(row.date||''),A.number(row.value,NaN)]));
    const dates=Array.from(new Set([...nonMap.keys(),...totalMap.keys()])).filter(Boolean).sort();
    const nonRows=programCumulativeRows(non.rows||[],dates,date=>nonMap.has(date)?nonMap.get(date):NaN);
    const arbitrageRows=programCumulativeRows(total.rows||[],dates,date=>totalMap.has(date)&&nonMap.has(date)?totalMap.get(date)-nonMap.get(date):NaN);
    const nonDisplay={...non,id:'program_non_arbitrage_cumulative',label:'프로그램매매 비차익 누적 순매수',unit:'원 누적',raw_columns:['date','cumulative_value'],latest_date:nonRows.at(-1)?.date||non.latest_date,latest:nonRows.at(-1)?.value??0,rows:nonRows};
    const arbitrageDisplay={...total,id:'program_arbitrage_cumulative',label:'프로그램매매 차익 누적 순매수',unit:'원 누적',raw_columns:['date','cumulative_value'],latest_date:arbitrageRows.at(-1)?.date||total.latest_date,latest:arbitrageRows.at(-1)?.value??0,rows:arbitrageRows};
    const first=Math.min(nonIndex,totalIndex), keep=indicators.filter((_,index)=>index!==nonIndex&&index!==totalIndex); keep.splice(first,0,arbitrageDisplay,nonDisplay); return keep;
  }
  function rawData() { const source=window.ADJUSTMENT_EXTRA || { meta:{}, indicators:[] }; return {...source,indicators:programDisplayIndicators(source.indicators||[])}; }
  function isCpi(item) { return /소비자물가지수/.test(String(item?.label || '')); }
  function hasYoyField(item) { return (item?.rows||[]).some(r => r && r.yoy != null && Number.isFinite(Number(r.yoy))); }
  function monthSerial(date) { const m=String(date||'').match(/^(\d{4})-(\d{2})$/); return m ? Number(m[1])*12 + Number(m[2])-1 : NaN; }
  function monthDate(serial) { const year=Math.floor(serial/12), month=serial%12+1; return `${year}-${String(month).padStart(2,'0')}`; }
  function cpiGrowthRows(rows) {
    const values=new Map(rows.map(r=>[String(r.date||''),A.number(r.value,NaN)]));
    return rows.map(r=>{
      const date=String(r.date||''), serial=monthSerial(date), current=values.get(date), yoyBase=values.get(monthDate(serial-12)), qoqBase=values.get(monthDate(serial-3));
      if (!Number.isFinite(serial) || !Number.isFinite(current) || !Number.isFinite(yoyBase) || !Number.isFinite(qoqBase) || yoyBase===0 || qoqBase===0) return null;
      return { date, yoy:(current/yoyBase-1)*100, qoq:(current/qoqBase-1)*100 };
    }).filter(Boolean);
  }
  function dualMetricRows(item, rows) {
    if (isCpi(item)) return cpiGrowthRows(rows);
    return rows.filter(r=>r.yoy!=null && Number.isFinite(Number(r.yoy))).map(r=>({date:String(r.date||''), yoy:A.number(r.yoy,NaN), qoq:A.number(r.value,NaN)}));
  }
  // 전체 보조 지표 목록(카탈로그) 표의 "최신 원자료" 칸 - CPI/GDP류(YoY·QoQ 파생 지표)는
  // 원자료 그 자체가 아니라 파생된 최신 YoY·QoQ 값을 보여줘야 의미가 있다. 이전엔 그 자리에
  // "YoY · QoQ 계산"이라는 안내 텍스트만 있고 실제 수치가 없었다(사용자 지적).
  function latestYoyQoqLabel(item) {
    const rows=(item.rows||[]).filter(r=>String(r.date||''));
    if (!rows.length) return '-';
    const derived=dualMetricRows(item, rows);
    if (!derived.length) return '-';
    const last=derived[derived.length-1];
    return `YoY ${pctNumber(last.yoy)} · QoQ ${pctNumber(last.qoq)}`;
  }
  function dualSlice(derived) {
    const base=rawSlice(derived.map(r=>({date:r.date,value:r.yoy}))), qoqMap=new Map(derived.map(r=>[r.date,r.qoq]));
    return { dates:base.dates, yoy:base.arrays[0], qoq:base.dates.map(date=>qoqMap.get(date) ?? null), rows:derived.filter(r=>base.dates.includes(r.date)) };
  }
  function dualChartOption(slice) {
    const option=A.lineOption({dates:slice.dates,yName:'%',series:[{name:'YoY',data:slice.yoy,color:'#1771b9',width:2.1},{name:'QoQ',data:slice.qoq,color:'#b66e00',width:2.1}]});
    option.grid={left:64,right:64,top:52,bottom:48};
    option.yAxis=[
      {type:'value',name:'YoY (%)',position:'left',scale:true,nameTextStyle:{color:'#71899a'},splitLine:{lineStyle:{color:'#e7eef3'}},axisLabel:{color:'#71899a',formatter:v=>`${v}%`}},
      {type:'value',name:'QoQ (%)',position:'right',scale:true,nameTextStyle:{color:'#71899a'},splitLine:{show:false},axisLabel:{color:'#71899a',formatter:v=>`${v}%`}}
    ];
    option.series[0].yAxisIndex=0; option.series[1].yAxisIndex=1;
    option.tooltip={trigger:'axis',axisPointer:{type:'cross'},formatter:params=>params.map(p=>`${p.marker}${p.seriesName}: ${pctNumber(p.value)}`).join('<br/>')};
    return option;
  }
  // 저빈도(월별 "YYYY-MM" 등) 날짜를 고빈도(일별 "YYYY-MM-DD") 시리즈에 정렬할 때 쓴다 -
  // 월별 날짜는 그 달 마지막 날짜("-31")로 패딩해 "그 달 안에서 가장 최근 관측치"를 찾는다
  // (portfolio.js의 nearestValueAtOrBefore와 동일한 이진탐색 아이디어, 이 파일 전용 소규모 버전).
  function alignDailyToDate(dailyRows, targetDate) {
    const key = /^\d{4}-\d{2}$/.test(targetDate) ? `${targetDate}-31` : String(targetDate);
    let lo=0, hi=dailyRows.length-1, found=-1;
    while (lo<=hi) { const mid=(lo+hi)>>1; if (String(dailyRows[mid].date||'')<=key) { found=mid; lo=mid+1; } else hi=mid-1; }
    return found>=0 ? A.number(dailyRows[found].value, null) : null;
  }
  // 미국소비자물가지수 전용 - YoY·QoQ를 같은 좌축에, 미국채 10년물 금리를 우축에 겹쳐 그린다
  // (한국 CPI·GDP 지표는 기존 dualChartOption()의 YoY좌/QoQ우 2축 그대로 유지, 이 지표만 예외).
  function usCpiTripleChartOption(slice, us10yRows) {
    const treasuryValues=slice.dates.map(d=>alignDailyToDate(us10yRows, d));
    const option=A.lineOption({dates:slice.dates,yName:'%',series:[
      {name:'YoY',data:slice.yoy,color:'#1771b9',width:2.1},
      {name:'QoQ',data:slice.qoq,color:'#b66e00',width:2.1},
      {name:'미국채 10년물',data:treasuryValues,color:'#2f9e6e',width:1.8}
    ]});
    option.grid={left:64,right:64,top:52,bottom:48};
    option.yAxis=[
      {type:'value',name:'CPI YoY·QoQ (%)',position:'left',scale:true,nameTextStyle:{color:'#71899a'},splitLine:{lineStyle:{color:'#e7eef3'}},axisLabel:{color:'#71899a',formatter:v=>`${v}%`}},
      {type:'value',name:'10년물 금리 (%)',position:'right',scale:true,nameTextStyle:{color:'#71899a'},splitLine:{show:false},axisLabel:{color:'#71899a',formatter:v=>`${v}%`}}
    ];
    option.series[0].yAxisIndex=0; option.series[1].yAxisIndex=0; option.series[2].yAxisIndex=1;
    option.tooltip={trigger:'axis',axisPointer:{type:'cross'},formatter:params=>params.map(p=>`${p.marker}${p.seriesName}: ${p.seriesName==='미국채 10년물'?rawNumber(p.value):pctNumber(p.value)}`).join('<br/>')};
    return option;
  }
  // 원/달러 환율 전용 - 원/달러(좌축)·달러인덱스(DXY, 우축) 2축 오버레이.
  function usdKrwDualChartOption(dates, krwValues, dxyRows) {
    const dxyValues=dates.map(d=>alignDailyToDate(dxyRows, d));
    const option=A.lineOption({dates,yName:'원',series:[
      {name:'원/달러',data:krwValues,color:'#1771b9',width:2.1},
      {name:'달러인덱스(DXY)',data:dxyValues,color:'#b66e00',width:1.8}
    ]});
    option.grid={left:70,right:64,top:52,bottom:48};
    option.yAxis=[
      {type:'value',name:'원/달러',position:'left',scale:true,nameTextStyle:{color:'#71899a'},splitLine:{lineStyle:{color:'#e7eef3'}},axisLabel:{color:'#71899a',formatter:v=>rawNumber(v,2)}},
      {type:'value',name:'DXY',position:'right',scale:true,nameTextStyle:{color:'#71899a'},splitLine:{show:false},axisLabel:{color:'#71899a'}}
    ];
    option.series[0].yAxisIndex=0; option.series[1].yAxisIndex=1;
    option.tooltip={trigger:'axis',axisPointer:{type:'cross'},formatter:params=>params.map(p=>`${p.marker}${p.seriesName}: ${p.seriesName==='원/달러'?rawNumber(p.value,2):rawNumber(p.value)}`).join('<br/>')};
    return option;
  }
  function rawSlice(rows) {
    const dates=rows.map(r=>String(r.date||'')), values=rows.map(r=>A.number(r.value,NaN));
    if (rawRange === 'all' || !dates.length) return { dates, arrays:[values] };
    const years=Math.max(1,Number(rawRange)||1), last=dates[dates.length-1];
    // 분기·월별 원자료 · Date.parse 보정 · 관측 주기 기준 기간 계산
    const periodsPerYear=/^\d{4}-?Q[1-4]$/.test(last) ? 4 : (/^\d{4}-\d{2}$/.test(last) ? 12 : 252);
    if (periodsPerYear !== 252) {
      const start=Math.max(0,dates.length-Math.max(1,Math.round(years*periodsPerYear)));
      return { dates:dates.slice(start), arrays:[values.slice(start)] };
    }
    try { return A.sliceDateRange(dates,[values],rawRange); }
    catch (_) { return { dates, arrays:[values] }; }
  }
  // '프로그램매매 누적 순매수' 전용: rawSlice는 이미 2005년부터 누적된 값을 그대로
  // 잘라내기만 해서 기간을 바꿔도 그래프 값이 안 바뀌는 문제가 있었다 - 여기서는 일별
  // 증감(delta)을 슬라이스한 뒤 그 구간의 시작점부터 다시 누적해 "선택한 기간 동안의
  // 누적 순매수"를 보여준다. 전체(all) 범위에서는 결과가 기존 값과 동일하다.
  function rawSliceCumulativeWindowed(rows) {
    const dates=rows.map(r=>String(r.date||'')), deltas=rows.map(r=>A.number(r.delta,0));
    if (rawRange === 'all' || !dates.length) {
      let cumulative=0;
      return { dates, arrays:[deltas.map(d=>{cumulative+=d; return cumulative;})] };
    }
    const years=Math.max(1,Number(rawRange)||1), last=dates[dates.length-1];
    const periodsPerYear=/^\d{4}-?Q[1-4]$/.test(last) ? 4 : (/^\d{4}-\d{2}$/.test(last) ? 12 : 252);
    let slicedDates, slicedDeltas;
    if (periodsPerYear !== 252) {
      const start=Math.max(0,dates.length-Math.max(1,Math.round(years*periodsPerYear)));
      slicedDates=dates.slice(start); slicedDeltas=deltas.slice(start);
    } else {
      try { const sliced=A.sliceDateRange(dates,[deltas],rawRange); slicedDates=sliced.dates; slicedDeltas=sliced.arrays[0]; }
      catch (_) { slicedDates=dates; slicedDeltas=deltas; }
    }
    let cumulative=0;
    return { dates:slicedDates, arrays:[slicedDeltas.map(d=>{cumulative+=d; return cumulative;})] };
  }
  function applyProgramMoneyDisplay(indicators,index,latest,values) {
    indicators.forEach((item,i)=>{
      if (!String(item.id||'').includes('_cumulative')) return;
      const cell=document.querySelector(`#raw-catalog-body tr[data-row-index="${i}"]`)?.querySelector('td:nth-child(4)');
      if (cell) cell.textContent=programMoneyNumber(item.latest);
    });
    const item=indicators[index];
    if (!String(item?.id||'').includes('_cumulative')) return;
    const stats=document.querySelectorAll('#raw-stats .stat-value');
    if (stats[1]) stats[1].textContent=programMoneyNumber(latest);
    if (stats[2]) stats[2].textContent=programMoneyNumber(A.min(values));
    if (stats[3]) stats[3].textContent=programMoneyNumber(A.max(values));
  }
  function arrangeRawLayout() {
    // "보조 지표" 탭에 글로벌 금리 서브탭이 추가되면서 기존 콘텐츠가 [data-raw-panel="domestic"]
    // 래퍼 안으로 한 겹 더 들어갔다 - 아래 insertBefore가 요구하는 "직계 자식" 기준도 그 래퍼로
    // 바뀌어야 한다(그대로 [data-panel="raw"]를 썼다가 NotFoundError 발생 확인·수정).
    const panel=document.querySelector('[data-raw-panel="domestic"]') || document.querySelector('[data-panel="raw"]');
    if (!panel) return;
    const filter=panel.querySelector('.filter-bar');
    const stats=document.getElementById('raw-stats');
    const chart=document.getElementById('raw-chart');
    const catalog=document.getElementById('raw-catalog-body')?.closest('.table-wrap');
    const detail=document.getElementById('raw-detail-body')?.closest('.table-wrap');
    if (!filter || !stats || !chart || !catalog || !detail) return;
    catalog.classList.add('raw-catalog-wrap');
    detail.classList.add('raw-detail-wrap', 'ts-table-scroll');
    let selectedHeading=panel.querySelector('.raw-selected-heading');
    if (!selectedHeading) {
      selectedHeading=document.createElement('div');
      selectedHeading.className='raw-selected-heading';
      selectedHeading.innerHTML='<span class="section-kicker">SELECTED INDICATOR</span><h3>선택 지표 시계열</h3>';
    }
    let catalogHeading=panel.querySelector('.raw-catalog-heading');
    if (!catalogHeading) {
      catalogHeading=document.createElement('div');
      catalogHeading.className='raw-catalog-heading';
      catalogHeading.innerHTML='<span class="section-kicker">INDICATOR CATALOG</span><h3>전체 보조 지표 목록</h3>';
    }
    // 정적 HTML은 필터바 다음에 카탈로그 테이블이 오지만, 실제로는 카탈로그를 필터바보다 앞에
    // 두고 그 위에 제목을 붙인다. 예전엔 이 5+2개 노드를 통째로 panel.append(...)해서 패널
    // 맨 끝에 재배치했는데, arrangeMarketLayout()에서 이 패턴이 나중에 추가된 형제 섹션을
    // 밀어내는 버그로 확인됐다 - 여기도 같은 구조라 위치가 실제로 바뀌어야 하는 노드만
    // 옮긴다(그래야 이 패널에 나중에 다른 섹션이 추가돼도 그 섹션을 밀어내지 않는다).
    if (filter.previousElementSibling !== catalog) panel.insertBefore(catalog, filter);
    if (catalog.previousElementSibling !== catalogHeading) catalog.before(catalogHeading);
    if (detail.previousElementSibling !== selectedHeading) detail.before(selectedHeading);
  }
  function renderRaw() {
    arrangeRawLayout();
    const raw=rawData(), indicators=raw.indicators||[], select=document.getElementById('raw-indicator');
    if (!select.options.length) select.innerHTML=indicators.map((item,i)=>`<option value="${i}">${A.esc(item.label||item.id||`지표 ${i+1}`)}</option>`).join('');
    const index=Math.max(0,Number(select.value||0)), item=indicators[index]||{}, rows=(item.rows||[]).filter(r=>String(r.date||'')); const dualMetric=isCpi(item)||hasYoyField(item), isUsdKrwOverlay=item.id==='usd_krw', cumulativeProgram=/프로그램매매.*누적 순매수/.test(String(item.label||'')), dualData=dualMetric?dualSlice(dualMetricRows(item,rows)):null, sliced=dualMetric?{dates:dualData.dates,arrays:[dualData.yoy]}:(cumulativeProgram?rawSliceCumulativeWindowed(rows):rawSlice(rows));
    document.getElementById('raw-cutoff').textContent=`원자료 기준일 ${A.formatDate(raw.meta?.data_cutoff || raw.meta?.asOf || item.latest_date || '-')}`;
    const catalogValueHeader=document.querySelector('#raw-catalog-body')?.closest('table')?.querySelector('thead th:nth-child(4)'); if (catalogValueHeader) catalogValueHeader.textContent=dualMetric?'최신 표시값':(cumulativeProgram?'최신 누적값':'최신 원자료');
    const catalogRows=indicators.map((r,i)=>({ r, i, label:r.label||r.id||'', unit:r.unit||'', latest_date:r.latest_date||'', latest:r.latest, rowCount:(r.rows||[]).length }));
    if (rawCatalogSort.key) catalogRows.sort((a,b)=>A.compareSortValues(a[rawCatalogSort.key], b[rawCatalogSort.key], rawCatalogSort.dir));
    document.getElementById('raw-catalog-body').innerHTML=catalogRows.map(({r,i})=>{const catalogValue=(isCpi(r)||hasYoyField(r))?`<span class="small">${latestYoyQoqLabel(r)}</span>`:rawNumber(r.latest, RAW_DECIMAL_OVERRIDE[r.id]); return `<tr data-row-index="${i}" ${i===index?'style="background:#f2f8fb"':''}><td>${A.esc(r.label||r.id||'-')}</td><td class="nowrap">${A.esc(r.unit||'-')}</td><td class="nowrap">${A.formatDate(r.latest_date||'-')}</td><td class="numeric">${catalogValue}</td><td class="numeric">${(r.rows||[]).length.toLocaleString('ko-KR')}</td></tr>`;}).join('') || '<tr><td colspan="5" class="small">보조 지표 원자료 · 없음</td></tr>';
    const values=sliced.arrays[0], latest=values[values.length-1], totalRows=rows.length, latestDate=sliced.dates[sliced.dates.length-1]||item.latest_date||'-';
    if (dualMetric) {
      const yoy=sliced.arrays[0], qoq=dualData.qoq, latestYoy=yoy[yoy.length-1], latestQoq=qoq[qoq.length-1];
      // 미국소비자물가지수만 YoY·QoQ 좌축 + 미국채 10년물 금리 우축(3-시리즈) 특수 차트를
      // 쓴다 - 한국 CPI·GDP 지표는 기존 YoY좌/QoQ우 dualChartOption() 그대로 유지.
      const isUsCpi=item.id==='us_cpi';
      document.getElementById('raw-stats').innerHTML=`<div class="stat"><span class="stat-label">선택 지표</span><strong class="stat-value" style="font-size:18px">${A.esc(item.label||'-')}</strong><span class="stat-sub">YoY · QoQ 파생</span></div><div class="stat"><span class="stat-label">최신 YoY</span><strong class="stat-value">${pctNumber(latestYoy)}</strong><span class="stat-sub">${A.formatDate(latestDate)}</span></div><div class="stat"><span class="stat-label">최신 QoQ</span><strong class="stat-value">${pctNumber(latestQoq)}</strong><span class="stat-sub">${A.formatDate(latestDate)}</span></div><div class="stat"><span class="stat-label">조회 기간 범위</span><strong class="stat-value" style="font-size:16px">${pctNumber(A.min(yoy))} ~ ${pctNumber(A.max(yoy))}</strong><span class="stat-sub">YoY · ${dualData.rows.length.toLocaleString('ko-KR')}개 파생 관측치</span></div>`;
      const us10yRows=isUsCpi?(indicators.find(x=>x.id==='us_10y_treasury')?.rows||[]):null;
      rawChart=A.createChart(document.getElementById('raw-chart'), isUsCpi?usCpiTripleChartOption(dualData, us10yRows):dualChartOption(dualData));
      const table=document.getElementById('raw-detail-body').closest('table');
      table.querySelector('thead').innerHTML=isUsCpi
        ? `<tr><th data-sort-key="date"${rawDetailSort.key==='date'?` data-sort-dir="${rawDetailSort.dir}"`:''}>관측일</th><th class="numeric" data-sort-key="yoy"${rawDetailSort.key==='yoy'?` data-sort-dir="${rawDetailSort.dir}"`:''}>YoY</th><th class="numeric" data-sort-key="qoq"${rawDetailSort.key==='qoq'?` data-sort-dir="${rawDetailSort.dir}"`:''}>QoQ</th><th class="numeric">미국채 10년물</th></tr>`
        : `<tr><th data-sort-key="date"${rawDetailSort.key==='date'?` data-sort-dir="${rawDetailSort.dir}"`:''}>관측일</th><th class="numeric" data-sort-key="yoy"${rawDetailSort.key==='yoy'?` data-sort-dir="${rawDetailSort.dir}"`:''}>YoY</th><th class="numeric" data-sort-key="qoq"${rawDetailSort.key==='qoq'?` data-sort-dir="${rawDetailSort.dir}"`:''}>QoQ</th></tr>`;
      { let revRows=dualData.rows.slice().reverse();
        if (rawDetailSort.key) revRows=revRows.slice().sort((a,b)=>A.compareSortValues(a[rawDetailSort.key], b[rawDetailSort.key], rawDetailSort.dir));
        const totalDetailRows=revRows.length;
        A.renderVirtualRows(document.getElementById('raw-detail-body'), totalDetailRows, i=>{ const r=revRows[i]; const extraCell=isUsCpi?`<td class="numeric">${rawNumber(alignDailyToDate(us10yRows, r.date))}</td>`:''; return `<tr><td class="nowrap">${A.formatDate(r.date||'-')}</td><td class="numeric">${pctNumber(r.yoy)}</td><td class="numeric">${pctNumber(r.qoq)}</td>${extraCell}</tr>`; }, {emptyHtml:`<tr><td colspan="${isUsCpi?4:3}" class="small">관측치 · 없음</td></tr>`}); }
    } else if (isUsdKrwOverlay) {
      // 원/달러 환율 전용 - 달러인덱스(DXY)를 우축에 겹쳐 그린다.
      const dxyRows=indicators.find(x=>x.id==='dxy')?.rows||[];
      document.getElementById('raw-stats').innerHTML=`<div class="stat"><span class="stat-label">선택 지표</span><strong class="stat-value" style="font-size:18px">${A.esc(item.label||'-')}</strong><span class="stat-sub">${A.esc(item.unit||'단위 없음')}</span></div><div class="stat"><span class="stat-label">최신 원자료</span><strong class="stat-value">${rawNumber(latest, RAW_DECIMAL_OVERRIDE.usd_krw)}</strong><span class="stat-sub">${A.formatDate(latestDate)}</span></div><div class="stat"><span class="stat-label">조회 기간 최저</span><strong class="stat-value">${rawNumber(A.min(values), RAW_DECIMAL_OVERRIDE.usd_krw)}</strong><span class="stat-sub">원자료 값</span></div><div class="stat"><span class="stat-label">조회 기간 최고</span><strong class="stat-value">${rawNumber(A.max(values), RAW_DECIMAL_OVERRIDE.usd_krw)}</strong><span class="stat-sub">총 ${totalRows.toLocaleString('ko-KR')}개 관측치</span></div>`;
      rawChart=A.createChart(document.getElementById('raw-chart'), usdKrwDualChartOption(sliced.dates, values, dxyRows));
      const table=document.getElementById('raw-detail-body').closest('table'); table.querySelector('thead').innerHTML=`<tr><th data-sort-key="date"${rawDetailSort.key==='date'?` data-sort-dir="${rawDetailSort.dir}"`:''}>관측일</th><th class="numeric" data-sort-key="value"${rawDetailSort.key==='value'?` data-sort-dir="${rawDetailSort.dir}"`:''}>원/달러</th><th class="numeric">달러인덱스(DXY)</th></tr>`;
      { const revDates=sliced.dates.slice().reverse(), revValues=sliced.arrays[0].slice().reverse();
        let detailRows=revDates.map((d,i)=>({date:d, value:revValues[i]}));
        if (rawDetailSort.key) detailRows=detailRows.slice().sort((a,b)=>A.compareSortValues(a[rawDetailSort.key], b[rawDetailSort.key], rawDetailSort.dir));
        const totalDetailRows=detailRows.length;
        A.renderVirtualRows(document.getElementById('raw-detail-body'), totalDetailRows, i=>{ const row=detailRows[i]; return `<tr><td class="nowrap">${A.formatDate(row.date||'-')}</td><td class="numeric">${rawNumber(row.value, RAW_DECIMAL_OVERRIDE.usd_krw)}</td><td class="numeric">${rawNumber(alignDailyToDate(dxyRows, row.date))}</td></tr>`; }, {emptyHtml:'<tr><td colspan="3" class="small">관측치 · 없음</td></tr>'}); }
    } else {
      const latestLabel=cumulativeProgram?'최신 누적값':'최신 원자료', valueLabel=cumulativeProgram?'누적값':'원자료 값', decimalOverride=RAW_DECIMAL_OVERRIDE[item.id];
      document.getElementById('raw-stats').innerHTML=`<div class="stat"><span class="stat-label">선택 지표</span><strong class="stat-value" style="font-size:18px">${A.esc(item.label||'-')}</strong><span class="stat-sub">${A.esc(item.unit||'단위 없음')}</span></div><div class="stat"><span class="stat-label">${latestLabel}</span><strong class="stat-value">${rawNumber(latest, decimalOverride)}</strong><span class="stat-sub">${A.formatDate(latestDate)}</span></div><div class="stat"><span class="stat-label">조회 기간 최저</span><strong class="stat-value">${rawNumber(A.min(values), decimalOverride)}</strong><span class="stat-sub">${valueLabel}</span></div><div class="stat"><span class="stat-label">조회 기간 최고</span><strong class="stat-value">${rawNumber(A.max(values), decimalOverride)}</strong><span class="stat-sub">총 ${totalRows.toLocaleString('ko-KR')}개 관측치</span></div>`;
      // KOSPI200 선물 미결제약정은 분기 만기(롤오버)일마다 원자료가 정확히 0을 찍는다 —
      // 전월물만 추적하는 원자료의 알려진 아티팩트(66회 만기 전부 재현)로, 실제 신호가
      // 아니다. 차트에서만 0을 null로 바꿔 끊어 그리고, 원자료 테이블/통계는 그대로 둔다.
      const chartValues=cumulativeProgram
        ? values.map(value => Number.isFinite(Number(value)) ? Number(value) / 100000000 : null)
        : (item.id === 'futures_open_interest' ? values.map(value => Number(value) === 0 ? null : value) : values);
      rawChart=A.createChart(document.getElementById('raw-chart'),A.lineOption({dates:sliced.dates, yName:cumulativeProgram?'억원':(item.unit||''), series:[{name:item.label||'원자료',data:chartValues,color:'#1771b9',width:2.1}]}));
      const table=document.getElementById('raw-detail-body').closest('table'), valueHeader=cumulativeProgram?'누적 순매수':'원자료 값'; table.querySelector('thead').innerHTML=`<tr><th data-sort-key="date"${rawDetailSort.key==='date'?` data-sort-dir="${rawDetailSort.dir}"`:''}>관측일</th><th class="numeric" data-sort-key="value"${rawDetailSort.key==='value'?` data-sort-dir="${rawDetailSort.dir}"`:''}>${valueHeader}</th><th>단위</th></tr>`;
      { const revDates=sliced.dates.slice().reverse(), revValues=sliced.arrays[0].slice().reverse();
        let detailRows=revDates.map((d,i)=>({date:d, value:revValues[i]}));
        if (rawDetailSort.key) detailRows=detailRows.slice().sort((a,b)=>A.compareSortValues(a[rawDetailSort.key], b[rawDetailSort.key], rawDetailSort.dir));
        const totalDetailRows=detailRows.length, valueFormatter=cumulativeProgram?programMoneyNumber:(v=>rawNumber(v, decimalOverride));
        A.renderVirtualRows(document.getElementById('raw-detail-body'), totalDetailRows, i=>{ const row=detailRows[i]; return `<tr><td class="nowrap">${A.formatDate(row.date||'-')}</td><td class="numeric">${valueFormatter(row.value)}</td><td>${A.esc(item.unit||'-')}</td></tr>`; }, {emptyHtml:'<tr><td colspan="3" class="small">관측치 · 없음</td></tr>'}); }
    }
    applyProgramMoneyDisplay(indicators,index,latest,values);
  }
  function marketData() {
    const src=window.MARKET_INDICATORS || { meta:{}, indicators:[] };
    const parts=window.MARKET_PARTS||{};
    const baseIndicators=(src.indicators&&src.indicators.length)
      ? src.indicators
      : [parts.KOSPI,parts.KOSPI200,parts.KOSDAQ,parts.KOSDAQ150].filter(Boolean);
    const cutoff=src.meta?.data_cutoff||window.DASHBOARD_DATA?.meta?.data_as_of||'';
    return {...src, indicators:baseIndicators.map(item=>{
      const rows=(item.rows||[]).map(r=>Array.isArray(r)?{date:r[0],value:r[1]}:r).filter(r=>!cutoff||String(r.date||'')<=cutoff);
      const last=rows[rows.length-1]||{};
      return {...item, rows, latest_date:last.date||item.latest_date, latest:Number.isFinite(Number(last.value))?Number(last.value):item.latest};
    })};
  }
  function marketSlice(rows) {
    const dates=rows.map(r=>String(r.date||'')), values=rows.map(r=>A.number(r.value,NaN));
    if (marketRange === 'all' || !dates.length) return { dates, arrays:[values] };
    try { return A.sliceDateRange(dates,[values],marketRange); }
    catch (_) { const years=Math.max(1,Number(marketRange)||1); return { dates:dates.slice(-years*252), arrays:[values.slice(-years*252)] }; }
  }
  // "시장 지표" 탭 패널에는 이 함수가 원래 다루던 대상(제목/필터/스탯/차트/원자료 테이블) 외에도
  // 그 아래 "지수 비교 — 수렴·발산" 섹션(별도 제목+필터+스탯+차트)이 같은 패널 안에 나란히
  // 들어있다. 예전엔 이 함수가 "필터/스탯/차트/선택헤딩/디테일 5개를 패널 맨 끝으로 옮겨붙이는"
  // 방식이었는데(수렴·발산 섹션이 추가되기 전에 짜여진 로직), 그 상태로는 렌더될 때마다 시장
  // 지표 자신의 필터·스탯·차트가 수렴·발산 섹션 뒤로 밀려나면서 두 섹션이 뒤섞여 보이는 버그가
  // 있었다(수렴·발산의 지수 선택 컨트롤이 엉뚱한 위치에 있는 것처럼 보이는 원인). 정적 HTML
  // 순서(제목→필터→스탯→차트→테이블, 그 다음 수렴·발산 섹션)는 이미 올바르므로, 이 함수가 실제로
  // 해야 할 일은 "선택 지표 시계열" 헤딩(정적 HTML에 없어 매번 새로 만들어 끼워 넣어야 함)을
  // 차트와 테이블 사이에 두는 것 하나뿐 - 나머지 요소는 절대 옮기지 않는다.
  function arrangeMarketLayout() {
    const panel=document.querySelector('[data-panel="market"]');
    if (!panel) return;
    const chart=document.getElementById('market-chart');
    const detail=document.getElementById('market-detail-body')?.closest('.table-wrap');
    if (!chart || !detail) return;
    detail.classList.add('raw-detail-wrap', 'ts-table-scroll');
    let selectedHeading=panel.querySelector('.raw-selected-heading');
    if (!selectedHeading) {
      selectedHeading=document.createElement('div');
      selectedHeading.className='raw-selected-heading';
      selectedHeading.innerHTML='<span class="section-kicker">SELECTED INDICATOR</span><h3>선택 지표 시계열</h3>';
    }
    if (chart.nextElementSibling !== selectedHeading) chart.after(selectedHeading);
  }
  // 정책금리는 계단식으로 드물게 바뀌는 시계열이라(국가마다 변경일이 전부 다름) 6개국을
  // 하나의 차트에 겹쳐 그리려면 공통 날짜축이 필요하다 - 전체 변경일 union을 만들고 각
  // 국가 값을 그 시점까지의 "가장 최근 변경값"으로 순방향 채움(step function)한다. 그
  // 나라의 첫 변경일 이전 구간은 null로 둬서(차트가 그 구간엔 선을 안 그림, 값이
  // 있다고 지어내지 않음) 실제 데이터 시작 시점 이전을 오해하게 만들지 않는다.
  const GLOBAL_RATES_COLORS = { US:'#1771b9', EU:'#7d5ba6', JP:'#c23c4a', UK:'#2f9e6e', CN:'#e08e2c', KR:'#102a43', AU:'#c2367a', CA:'#17a2b8', IN:'#b8860b', BR:'#6ba82f', MX:'#8c564b', RU:'#7f7f7f' };
  const GLOBAL_RATES_CODE_ORDER = ['US','EU','JP','UK','CN','KR','AU','CA','IN','BR','MX','RU']; // 표 헤더(adjustment.html) 열 순서와 항상 일치시킴
  let globalRatesAlignedCache = null;
  function globalRatesAligned() {
    if (globalRatesAlignedCache) return globalRatesAlignedCache;
    const data = window.GLOBAL_RATES_DATA;
    const series = (data && data.series) || {};
    const codes = Object.keys(series);
    const dateSet = new Set();
    codes.forEach(code => (series[code].rows || []).forEach(([d]) => dateSet.add(d)));
    const dates = Array.from(dateSet).sort();
    const arrays = {};
    codes.forEach(code => {
      const rows = series[code].rows || [];
      let idx = 0, current = null;
      arrays[code] = dates.map(d => {
        while (idx < rows.length && rows[idx][0] <= d) { current = rows[idx][1]; idx++; }
        return current;
      });
    });
    globalRatesAlignedCache = { dates, arrays, codes };
    return globalRatesAlignedCache;
  }
  function renderGlobalRates() {
    const data = window.GLOBAL_RATES_DATA;
    if (!data) return;
    const { series } = data;
    const codes = GLOBAL_RATES_CODE_ORDER.filter(code => series[code] && globalRatesSelected.has(code));
    const chartEl = document.getElementById('global-rates-chart'), emptyEl = document.getElementById('global-rates-empty');
    const theadEl = document.getElementById('global-rates-history-thead');
    const tableWrapEl = theadEl.closest('.table-wrap');
    if (!codes.length) {
      // 체크박스를 전부 해제하면 빈 차트/표 대신 안내 문구 하나만 보여준다(그래야
      // "고장났다"로 오해하지 않음).
      chartEl.hidden = true; tableWrapEl.hidden = true; emptyEl.hidden = false;
      return;
    }
    chartEl.hidden = false; tableWrapEl.hidden = false; emptyEl.hidden = true;
    theadEl.innerHTML = `<tr><th>관측일</th>${codes.map(code => `<th class="numeric">${A.esc(series[code].label || code)}</th>`).join('')}</tr>`;
    const { dates, arrays } = globalRatesAligned();
    let sliced;
    try { sliced = A.sliceDateRange(dates, codes.map(c => arrays[c]), globalRatesRange); }
    catch (_) { sliced = { dates, arrays: codes.map(c => arrays[c]) }; }
    const chartSeries = codes.map((code, i) => ({ name: series[code].label || code, data: sliced.arrays[i], color: GLOBAL_RATES_COLORS[code] || '#456378', width: code === 'KR' ? 2.6 : 1.8 }));
    globalRatesChart = A.createChart(chartEl, A.lineOption({ dates: sliced.dates, yName: '%', series: chartSeries }));
    requestAnimationFrame(() => globalRatesChart?.resize());
    // 시계열 표: 열은 선택된 국가별 금리, 행은 그 중 누구라도 금리를 바꾼 날짜(= sliced.dates,
    // 이미 차트와 동일하게 순방향 채움된 값) - 최신순으로 뒤집는다.
    const revDates = sliced.dates.slice().reverse();
    const revArrays = sliced.arrays.map(arr => arr.slice().reverse());
    A.renderVirtualRows(document.getElementById('global-rates-history-body'), revDates.length, i => {
      const cells = codes.map((_, ci) => {
        const v = revArrays[ci][i];
        return `<td class="numeric">${v == null ? '-' : A.formatNumber(v, 2) + '%'}</td>`;
      }).join('');
      return `<tr><td class="nowrap">${A.esc(A.formatDate(revDates[i]))}</td>${cells}</tr>`;
    }, { emptyHtml: `<tr><td colspan="${codes.length + 1}" class="small">관측치 · 없음</td></tr>` });
  }
  function bindGlobalRatesCountryToggles() {
    const root = document.getElementById('global-rates-country-toggles');
    if (!root) return;
    root.querySelectorAll('input[data-country]').forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) globalRatesSelected.add(cb.dataset.country); else globalRatesSelected.delete(cb.dataset.country);
      renderGlobalRates();
    }));
  }
  function bindRawViewTabs() {
    const root = document.getElementById('raw-view-tabs');
    if (!root) return;
    root.querySelectorAll('.subtab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.subtab').forEach(item => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      const view = tab.dataset.rawView === 'global-rates' ? 'global-rates' : 'domestic';
      document.querySelector('[data-raw-panel="domestic"]').hidden = view !== 'domestic';
      document.querySelector('[data-raw-panel="global-rates"]').hidden = view !== 'global-rates';
      if (view === 'global-rates') {
        if (!globalRatesRendered) { globalRatesRendered = true; renderGlobalRates(); }
        else requestAnimationFrame(() => globalRatesChart?.resize());
      }
    }));
  }
  // "시장 지표"/"지수 비교 — 수렴·발산" 하위 탭 - compareChart는 처음엔(페이지 로드 시)
  // "시장 지표"가 기본으로 보이는 동안 hidden 상태로 초기화되므로, echarts가 숨겨진
  // 컨테이너 크기를 0/기본값으로 잘못 측정해 찌그러진 채 굳는 문제가 있다(이미 이 차트
  // 자체에서 한 번 겪은 버그 - 최상위 탭 전환 시 resizeAllCharts()로 고쳤던 것과 동일한
  // 원인). 하위 탭 전환 시에도 동일하게 동기 resize + rAF 재확인으로 대응한다.
  function bindMarketViewTabs() {
    const root = document.getElementById('market-view-tabs');
    if (!root) return;
    root.querySelectorAll('.subtab').forEach(tab => tab.addEventListener('click', () => {
      root.querySelectorAll('.subtab').forEach(item => item.classList.toggle('active', item === tab));
      const view = tab.dataset.marketView === 'compare' ? 'compare' : 'index';
      document.querySelector('[data-market-panel="index"]').hidden = view !== 'index';
      document.querySelector('[data-market-panel="compare"]').hidden = view !== 'compare';
      resizeAllCharts();
      requestAnimationFrame(() => resizeAllCharts());
    }));
  }
  function renderMarket() {
    arrangeMarketLayout();
    const source=marketData(), indicators=source.indicators||[], select=document.getElementById('market-indicator');
    if (!select) return;
    document.getElementById('market-cutoff').textContent=`DeepSearch 원자료 최대 기준일 ${A.formatDate(source.meta?.data_cutoff||'-')}`;
    if (!select.options.length) select.innerHTML=indicators.map((item,i)=>`<option value="${i}">${A.esc(item.label||item.id||`지표 ${i+1}`)}</option>`).join('');
    const index=Math.max(0,Number(select.value||0)), item=indicators[index]||{}, rows=(item.rows||[]).filter(r=>String(r.date||'')), sliced=marketSlice(rows), values=sliced.arrays[0], latest=values[values.length-1], latestDate=sliced.dates[sliced.dates.length-1]||item.latest_date||'-';
    document.getElementById('market-stats').innerHTML=`<div class="stat"><span class="stat-label">선택 지표</span><strong class="stat-value" style="font-size:18px">${A.esc(item.label||'-')}</strong><span class="stat-sub">DeepSearch 원자료 · ${A.esc(item.frequency||'D')}</span></div><div class="stat"><span class="stat-label">최신 원자료</span><strong class="stat-value">${rawNumber(latest)}</strong><span class="stat-sub">${A.formatDate(latestDate)}</span></div><div class="stat"><span class="stat-label">조회 기간 최저</span><strong class="stat-value">${rawNumber(A.min(values))}</strong><span class="stat-sub">${A.esc(item.unit||'pt')}</span></div><div class="stat"><span class="stat-label">조회 기간 최고</span><strong class="stat-value">${rawNumber(A.max(values))}</strong><span class="stat-sub">${values.length.toLocaleString('ko-KR')}개 관측치</span></div>`;
    marketChart=A.createChart(document.getElementById('market-chart'),A.lineOption({dates:sliced.dates,yName:item.unit||'pt',series:[{name:item.label||'시장 지표',data:values,color:'#1771b9',width:2.1}]}));
    const table=document.getElementById('market-detail-body').closest('table'); table.querySelector('thead').innerHTML=`<tr><th data-sort-key="date"${marketDetailSort.key==='date'?` data-sort-dir="${marketDetailSort.dir}"`:''}>관측일</th><th class="numeric" data-sort-key="value"${marketDetailSort.key==='value'?` data-sort-dir="${marketDetailSort.dir}"`:''}>원자료 값</th><th>단위</th></tr>`;
    { const revDates=sliced.dates.slice().reverse(), revValues=sliced.arrays[0].slice().reverse();
      let detailRows=revDates.map((d,i)=>({date:d, value:revValues[i]}));
      if (marketDetailSort.key) detailRows=detailRows.slice().sort((a,b)=>A.compareSortValues(a[marketDetailSort.key], b[marketDetailSort.key], marketDetailSort.dir));
      const totalDetailRows=detailRows.length;
      A.renderVirtualRows(document.getElementById('market-detail-body'), totalDetailRows, i=>{ const row=detailRows[i]; return `<tr><td class="nowrap">${A.formatDate(row.date||'-')}</td><td class="numeric">${rawNumber(row.value)}</td><td>${A.esc(item.unit||'-')}</td></tr>`; }, {emptyHtml:'<tr><td colspan="3" class="small">관측치 · 없음</td></tr>'}); }
    requestAnimationFrame(()=>marketChart?.resize());
  }

  // 두 지수의 N개월 누적수익률 차이("상대 스프레드")를 시계열로 본다 - 0 근처면
  // 수렴(같은 방향으로 움직임), 0에서 멀어지면 발산(벌어짐)으로 해석한다.
  function nearestValueAtOrBefore(sortedDates, valueMap, targetIso) {
    let lo=0, hi=sortedDates.length-1, found=-1;
    while (lo<=hi) { const mid=(lo+hi)>>1; if (sortedDates[mid]<=targetIso) { found=mid; lo=mid+1; } else hi=mid-1; }
    return found>=0 ? valueMap.get(sortedDates[found]) : null;
  }
  function monthsAgoIso(dateStr, months) {
    const d=new Date(dateStr); d.setMonth(d.getMonth()-months); return d.toISOString().slice(0,10);
  }
  function convergenceSeries(rowsA, rowsB, months) {
    const datesA=rowsA.map(r=>r.date), datesB=rowsB.map(r=>r.date);
    const mapA=new Map(rowsA.map(r=>[r.date, A.number(r.value)])), mapB=new Map(rowsB.map(r=>[r.date, A.number(r.value)]));
    const setB=new Set(datesB);
    const commonDates=datesA.filter(d=>setB.has(d));
    const dates=[], spread=[], returnA=[], returnB=[];
    commonDates.forEach(d=>{
      const target=monthsAgoIso(d, months);
      const baseA=nearestValueAtOrBefore(datesA, mapA, target), baseB=nearestValueAtOrBefore(datesB, mapB, target);
      const curA=mapA.get(d), curB=mapB.get(d);
      if (!baseA || !baseB || !Number.isFinite(baseA) || !Number.isFinite(baseB) || !Number.isFinite(curA) || !Number.isFinite(curB)) return;
      const rA=curA/baseA-1, rB=curB/baseB-1;
      dates.push(d); returnA.push(rA); returnB.push(rB); spread.push(rA-rB);
    });
    return { dates, spread, returnA, returnB };
  }
  // 두 지수의 전체 겹치는 기간(수십 년)을 범위 선택 없이 그대로 그리면, 최근 구간의 큰
  // 변동폭(발산 급확대) 하나 때문에 y축이 그 값에 맞춰 늘어나면서 나머지 대부분의 기간이
  // 0 근처에 눌려 붙어 차트가 거의 빈 직선처럼 보이는 문제가 있었다 - 다른 모든 차트 섹션
  // (raw/market/category/quant/mp)과 동일하게 기간(1/3/5년/전체) 버튼을 추가해서 원하는
  // 구간만 확대해 볼 수 있게 한다.
  function compareSlice(dates, spread) {
    if (compareRange === 'all' || !dates.length) return { dates, arrays:[spread] };
    try { return A.sliceDateRange(dates, [spread], compareRange); }
    catch (_) { const years=Math.max(1,Number(compareRange)||1); return { dates:dates.slice(-years*252), arrays:[spread.slice(-years*252)] }; }
  }
  function renderCompare() {
    const indicators=marketData().indicators;
    const selectA=document.getElementById('compare-index-a'), selectB=document.getElementById('compare-index-b');
    if (!selectA || !selectB) return;
    if (!selectA.options.length) {
      const optionsHtml=indicators.map((item,i)=>`<option value="${i}">${A.esc(item.label||item.id||`지표 ${i+1}`)}</option>`).join('');
      selectA.innerHTML=optionsHtml; selectB.innerHTML=optionsHtml;
      const idxKospi=indicators.findIndex(i=>i.id==='KOSPI'), idxKospi200=indicators.findIndex(i=>i.id==='KOSPI200');
      selectA.value=idxKospi>=0?idxKospi:0;
      selectB.value=idxKospi200>=0?idxKospi200:Math.min(1,indicators.length-1);
    }
    const months=Math.max(1, Math.round(A.number(document.getElementById('compare-months').value, 6)));
    const itemA=indicators[Number(selectA.value)||0]||{}, itemB=indicators[Number(selectB.value)||0]||{};
    const full=convergenceSeries(itemA.rows||[], itemB.rows||[], months);
    const sliced=compareSlice(full.dates, full.spread);
    const dates=sliced.dates, spread=sliced.arrays[0];
    const latest=full.spread.length?full.spread[full.spread.length-1]:null;
    const state=latest==null?'-':(Math.abs(latest)<0.02?'수렴':`발산 · ${latest>0?A.esc(itemA.label||'A'):A.esc(itemB.label||'B')} 우위`);
    document.getElementById('compare-stats').innerHTML=`
      <div class="stat"><span class="stat-label">${months}개월 상대 스프레드</span><strong class="stat-value ${A.metricClass(latest)}">${latest==null?'-':A.formatPct(latest,2)}</strong><span class="stat-sub">${A.esc(itemA.label||'-')} 수익률 − ${A.esc(itemB.label||'-')} 수익률</span></div>
      <div class="stat"><span class="stat-label">현재 상태</span><strong class="stat-value">${state}</strong><span class="stat-sub">스프레드 |2%p| 이내면 수렴</span></div>
      <div class="stat"><span class="stat-label">공통 관측치</span><strong class="stat-value">${dates.length.toLocaleString('ko-KR')}개</strong><span class="stat-sub">선택한 기간 · 두 지수 겹치는 거래일</span></div>`;
    compareChart=A.createChart(document.getElementById('compare-chart'), A.lineOption({
      dates, yName:'%p', percent:true,
      series:[{ name:`${itemA.label||'A'} − ${itemB.label||'B'} (${months}개월 수익률차)`, data:spread.map(v=>v*100), color:'#1771b9', width:2.1 }]
    }));
    requestAnimationFrame(()=>compareChart?.resize());
  }
    function renderStressMethodology() {
      const root=document.querySelector('.stress-methodology');
      if (!root) return;
      root.innerHTML=`<article><span class="section-kicker">Short stress methodology</span><h3>단기 스트레스 · 5개 후보 합성</h3><ul class="method-list">
        <li><b>입력</b><span>KOSPI200 OHLCV · 미국 10년−3개월 금리차 · 일단위</span></li>
        <li><b>기술 70%</b><span>T1 28% · T2 24% · T3 18% · 내부 합계 70%</span></li>
        <li><b>거시 30%</b><span>M1 18% · M2 12% · 내부 합계 30%</span></li>
        <li><b>원점수</b><code>ROC5 = clip(−r5/0.07, 0, 1) · r5 = C(t)/C(t−5) − 1</code></li>
        <li><b>기술축</b><code>Stoch26(26·3·5) · Stoch52(52·5·5): clip((D−K)/30 × I(K&lt;70), 0, 1)</code></li>
        <li><b>기술축</b><code>MACD(10·20·9): clip((S−M)/(0.02×C) × I(M&lt;0), 0, 1) · ATR14/ATR120: clip((ratio−1.10)/1.10, 0, 1)</code></li>
        <li><b>시장확인</b><code>하락거래량 = clip((V/MA20V) × max(−r1,0)/0.03, 0, 1) · 갭 = clip(−(O/Cprev−1)/0.025, 0, 1)</code></li>
        <li><b>금리펄스</b><code>Δ20 = s(t)−s(t−20) · p = lagged rolling-rank756(Δ20) · pulse = 1−p</code></li>
        <li><b>후보구성</b><span>T1 = ROC5·Stoch26·MACD · T2 = ROC5·Stoch26·ATR14/120 · T3 = ROC5·Stoch52·Stoch26</span></li>
        <li><b>후보판정</b><span>T1/T2/T3: 구성 3개 중 2개 이상 ≥0.75 · M1: 하락거래량≥0.75 AND 금리펄스≥0.85 · M2: 갭≥0.65 AND 금리펄스≥0.75</span></li>
        <li><b>최종점수</b><code>0.70×[(0.28T1+0.24T2+0.18T3)/0.70] + 0.30×[(0.18M1+0.12M2)/0.30] · ×100</code></li>
        <li><b>임계치</b><span>0.40 = 40점 · 미래수익률·미래 OHLC 미사용 · 초기 창 결측 유지</span></li>
      </ul></article><article><span class="section-kicker">Long stress methodology</span><h3>장기 스트레스 · 추세·신용·자금흐름</h3><ul class="method-list">
        <li><b>입력</b><span>KOSPI200 종가 · rawCredit · rawFunding · 기존 장기 원자료 필드 · 일단위</span></li>
        <li><b>추세원점수</b><code>SMA200 = mean(C[t−199:t]) · gap = (SMA200−C)/SMA200 · 0.60×clip(gap/0.05, 0, 1)</code></li>
        <li><b>하락원점수</b><code>ret120 = C/C(t−120)−1 · 0.40×clip(−ret120/0.20, 0, 1)</code></li>
        <li><b>추세합성</b><code>rawTrend = EMA10[추세원점수 + 하락원점수]</code></li>
        <li><b>정규화</b><code>history = raw.shift(1) · expanding mean/std · 최소 756개 선행 관측치 · sigmoid((raw−mean)/(1.5×std))</code></li>
        <li><b>구성축</b><span>zTrend · zCredit · zFunding · 각 0~1 · 당일 값 제외 과거 누적분포 기준</span></li>
        <li><b>최종점수</b><code>0.35×zTrend + 0.35×zCredit + 0.30×zFunding · ×100</code></li>
        <li><b>임계치</b><span>0.45 = 45점 · 차트 배경 음영 기준</span></li>
        <li><b>확인플래그</b><span>최근 20영업일 중 45점 이상 10일 이상 · 원자료·756일 창 부족 구간 산출 제외</span></li>
        <li><b>미래참조</b><span>fwd3m·fwd6m · 성과 검증용 별도 필드 · 점수 산출 제외</span></li>
      </ul></article>`;
    }
    function stressValue(row, names) { for (const name of names) { const raw=row&&row[name]; if (raw===null || raw===undefined || raw==='') continue; const n=Number(raw); if (Number.isFinite(n)) return n; } return 0; }
  function stressSeriesValue(row, names) { for (const name of names) { const raw=row&&row[name]; if (raw===null || raw===undefined || raw==='') continue; const n=Number(raw); if (Number.isFinite(n)) return name==='score100'?n:n*100; } return null; }
    // 원자료가 최신 날짜까지 계산이 안 돼 있으면(신용/자금 소스 지연 등) 배열의
    // 마지막 행은 전부 null일 수 있다 — 그 행을 그대로 쓰면 헤드라인이 0으로
    // 떨어져 "스트레스 없음"처럼 잘못 보인다. 값이 실제로 있는 마지막 행을 찾는다.
    function lastValidStressRow(rows, names) {
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        for (const name of names) {
          const raw = row && row[name];
          if (raw === null || raw === undefined || raw === '') continue;
          if (Number.isFinite(Number(raw))) return row;
        }
      }
      return null;
    }
  function renderStress() {
    const shortPortal=window.SHORT_STRESS_PORTAL||{}, longData=window.SMOOTH_TREND_DATA||{};
    const shortRows=shortPortal.rows||[], longRows=longData.rows||[];
    const longNames=['continuous_distance_ema10_score','score100','current_step_score'];
    const shortLast=lastValidStressRow(shortRows,['score100','score'])||shortRows[shortRows.length-1]||{};
    const longLast=lastValidStressRow(longRows,longNames)||longRows[longRows.length-1]||{};
    const shortNow=stressValue(shortLast,['score100','score']) * (Number(shortLast.score100) ? 1 : 100);
    const longNow=stressValue(longLast,longNames) * (Number(longLast.continuous_distance_ema10_score) || Number(longLast.current_step_score) ? 100 : 1);
    const longStale=longRows.length && longLast.date !== longRows[longRows.length-1].date;
    const longAsOfNote=longStale ? `<small class="stress-asof">${A.formatDate(longLast.date)} 기준 · 이후 원자료 미갱신</small>` : '';
    document.getElementById('stress-band').innerHTML=`<article class="stress-card"><span class="section-kicker">Short stress</span><h3>단기 스트레스</h3><div class="stress-number ${shortNow>=50?'negative':'positive'}">${A.formatNumber(shortNow)}</div><p>점수 발생 시 하락·급락 이후 나타나는 반등 신호로 볼 수 있습니다.</p></article><article class="stress-card"><span class="section-kicker">Long stress</span><h3>장기 스트레스</h3><div class="stress-number ${longNow>=45?'negative':'positive'}">${A.formatNumber(longNow)}</div><p>시장과 역상관인 추세 지표로, 상승 추세가 이어지면 추세 하락 전환과 중장기 침체 위험이 커집니다.</p>${longAsOfNote}</article>`;
    // stress-band 카드가 이미 쓰는 50(단기)/45(장기) 경계를 그대로 재사용하고, 그
    // 아래에 40(단기)/35(장기) 주의 구간을 하나 더 둔다 — 두 임계치 모두 미달이면 안정.
    const stressState=(value,high,caution)=>value>=high?'위험':value>=caution?'주의':'안정';
    const shortState=stressState(shortNow,50,40), longState=stressState(longNow,45,35);
    document.getElementById('stress-summary-comment').innerHTML=`현재 단기 스트레스는 <b>${A.formatNumber(shortNow)}점</b>으로 <b>${shortState}</b> 구간, 장기 스트레스는 <b>${A.formatNumber(longNow)}점</b>으로 <b>${longState}</b> 구간입니다.`;
    const smap=new Map(shortRows.map(r=>[String(r.date||r.Date||''),stressSeriesValue(r,['score100','score'])]));
    const lmap=new Map(longRows.map(r=>[String(r.date||r.Date||''),stressSeriesValue(r,['continuous_distance_ema10_score'])]));
    const marketPart=window.MARKET_PARTS?.KOSPI200||{};
    const marketRows=(marketPart.rows||[]).map(r=>Array.isArray(r)?{date:r[0],value:r[1]}:r);
    const kmap=new Map(marketRows.map(r=>[String(r.date||r.Date||''),Number(r.value??r.close??r.index)]).filter(([,v])=>Number.isFinite(v)));
    // Stress is the chart's time base. Do not let the longer KOSPI200 history
    // expand the x-axis and compress the stress lines into a narrow sliver.
    const dates=Array.from(new Set([...smap.keys(),...lmap.keys()])).filter(Boolean).sort();
    const fullShortSeries=dates.map(d=>smap.get(d)??null), fullLongSeries=dates.map(d=>lmap.get(d)||null), fullKospiSeries=dates.map(d=>kmap.get(d)??null);
    let sliced={dates,arrays:[fullShortSeries,fullLongSeries,fullKospiSeries]};
    if(stressRange!=='all') {
      try { sliced=A.sliceDateRange(dates,sliced.arrays,stressRange); }
      catch (_) { const years=Math.max(1,Number(stressRange)||1), start=Math.max(0,dates.length-years*252); sliced={dates:dates.slice(start),arrays:sliced.arrays.map(a=>a.slice(start))}; }
    }
    const chartDates=sliced.dates, shortSeries=sliced.arrays[0], longSeries=sliced.arrays[1], kospiSeries=sliced.arrays[2];
    const longFinite=longSeries.filter(v=>Number.isFinite(Number(v))&&Number(v)>0).map(Number);
    const marketFinite=kospiSeries.filter(v=>Number.isFinite(Number(v))).map(Number);
    const longMin=longFinite.length?Math.min(...longFinite):0, longMax=longFinite.length?Math.max(...longFinite):100, longPad=Math.max(2,(longMax-longMin)*0.08), rightMin=Math.max(0,Math.floor((longMin-longPad)/5)*5), rightMax=Math.min(100,Math.ceil((longMax+longPad)/5)*5);
    const marketMin=marketFinite.length?Math.min(...marketFinite):0, marketMax=marketFinite.length?Math.max(...marketFinite):100, marketAxisMin=Math.max(0,Math.floor(marketMin/100)*100), marketAxisMax=Math.max(marketAxisMin+100,Math.ceil(marketMax/100)*100);
    const thresholdAreas=[]; let areaStart=null;
    chartDates.forEach((date,index)=>{
      const active=Number.isFinite(Number(longSeries[index]))&&Number(longSeries[index])>=45;
      if(active&&areaStart===null) areaStart=date;
      if(!active&&areaStart!==null){thresholdAreas.push([{xAxis:areaStart},{xAxis:chartDates[Math.max(0,index-1)]}]);areaStart=null;}
      if(active&&index===chartDates.length-1&&areaStart!==null){thresholdAreas.push([{xAxis:areaStart},{xAxis:date}]);areaStart=null;}
    });
    const stressOption=A.lineOption({dates:chartDates,minY:0,maxY:100,yName:'단기 스트레스',series:[{name:'단기 스트레스',data:shortSeries,color:'#c23c4a',width:2},{name:'장기 스트레스',data:longSeries,color:'#7454c5',width:2},{name:'KOSPI200',data:kospiSeries,color:'#1771b9',width:1.8}]});
    stressOption.grid={left:64,right:132,top:52,bottom:48};
    stressOption.yAxis=[
      {type:'value',name:'단기',position:'left',min:0,max:100,scale:false,nameTextStyle:{color:'#c23c4a'},splitLine:{lineStyle:{color:'#e7eef3'}},axisLabel:{color:'#c23c4a',formatter:v=>`${v}`}},
      {type:'value',name:'장기',position:'right',min:rightMin,max:rightMax,scale:false,nameTextStyle:{color:'#7454c5'},splitLine:{show:false},axisLabel:{color:'#7454c5',formatter:v=>`${v}`}},
      {type:'value',name:'KOSPI200',position:'right',offset:58,min:marketAxisMin,max:marketAxisMax,interval:100,minInterval:100,scale:false,nameTextStyle:{color:'#1771b9'},splitLine:{show:false},axisLabel:{hideOverlap:false,color:'#1771b9',formatter:v=>Number(v).toLocaleString('ko-KR')}}
    ];
    stressOption.series[0].yAxisIndex=0; stressOption.series[1].yAxisIndex=1; stressOption.series[2].yAxisIndex=2;
    stressOption.series[1].markArea={silent:true,itemStyle:{color:'rgba(116,84,197,.10)'},label:{show:false},data:thresholdAreas};
    stressOption.tooltip={trigger:'axis',axisPointer:{type:'cross'},formatter:params=>params.filter(p=>p.value!=null).map(p=>`${p.marker}${p.seriesName}: ${A.formatNumber(p.value,1)}`).join('<br/>')};
    // 차트 배경의 연보라 음영이 뭘 뜻하는지 범례 없이는 알 길이 없었다 - 국면별 다색 배경밴드가
    // 아니라 "장기 스트레스 45점 이상 구간" 단일 표시라 정식 범례보다는 짧은 캡션 한 줄이면 충분.
    let stressCaption=document.getElementById('stress-shading-caption');
    if (!stressCaption) {
      stressCaption=document.createElement('p');
      stressCaption.id='stress-shading-caption';
      stressCaption.className='small stress-shading-caption';
      document.getElementById('stress-chart').before(stressCaption);
    }
    stressCaption.innerHTML='<span class="regime-legend-item"><i style="background:rgba(116,84,197,.35)"></i>배경 음영 = 장기 스트레스 45점 이상(위험 구간)</span>';
    stressChart=A.createChart(document.getElementById('stress-chart'),stressOption);
    requestAnimationFrame(() => stressChart?.resize());
  }
  function renderCategoryChart() {
    const select=document.getElementById('category-indicator');
    if (!select) return;
    if (!select.options.length) select.innerHTML=A.CATEGORY_KEYS.map(key=>`<option value="${key}">${A.esc(A.CATEGORY_META[key].name)}</option>`).join('');
    const settings=A.getSettings(), s=A.adjustedSeries(settings), key=A.CATEGORY_KEYS.includes(select.value)?select.value:A.CATEGORY_KEYS[0];
    const meta=A.CATEGORY_META[key], ma=A.rollingMean(s.categories[key]||[], settings.observation);
    let sliced;
    if (categoryCustomRange) { sliced=A.sliceCustomRange(s.dates,[ma],categoryCustomRange.start,categoryCustomRange.end); }
    else { try { sliced=A.sliceDateRange(s.dates,[ma],categoryRange); } catch (_) { sliced={dates:s.dates, arrays:[ma]}; } }
    categoryChart=A.createChart(document.getElementById('category-chart'),A.lineOption({dates:sliced.dates,minY:0,maxY:100,yName:'점수',series:[{name:meta.name,data:sliced.arrays[0],color:meta.color,width:2.1}]}));
    requestAnimationFrame(()=>categoryChart?.resize());
  }
  // ---------------------------------------------------------------------
  // 히스토리 탭(기간별 세부 국면 강제): performance.html에 있던 관리 UI를 이 페이지의
  // 마지막 탭으로 이전 — regime-override.js가 저장소·판정 로직을 그대로 제공하므로
  // 이 페이지는 폼/이력 테이블 렌더링만 담당한다.
  const MODE_LABEL = { daily: '일단위', biweekly: '격주', monthly: '월말' };
  function renderOverrideHistory() {
    const select = document.getElementById('override-regime');
    if (select && !select.dataset.ready) {
      select.innerHTML = A.detailedRegimeOptions.map(r => `<option value="${A.esc(r)}">${A.esc(r)}</option>`).join('');
      select.dataset.ready = 'true';
    }
    const list = A.getRegimeOverrides();
    const body = document.getElementById('override-history-body');
    if (!body) return;
    body.innerHTML = list.length ? list.map(o => {
      const quant = A.overrideAppliesToQuant(o);
      const quantLabel = ['daily', 'biweekly', 'monthly']
        .map(m => `${MODE_LABEL[m]} ${quant[m] ? '적용' : '미적용'}`)
        .join(' · ');
      const mpApplied = A.overrideAppliesToMp(o);
      const rowLabel = `${A.formatDate(o.start)} ~ ${A.formatDate(o.end)} ${o.regime} 상세 보기`;
      return `<tr class="override-row" data-override-row="${A.esc(o.id)}" tabindex="0" role="link" aria-label="${A.esc(rowLabel)}">
        <td class="nowrap">${A.esc(A.formatDate(o.start))} ~ ${A.esc(A.formatDate(o.end))}</td>
        <td>${A.esc(o.regime)}</td>
        <td>${A.esc(o.note || '-')}</td>
        <td class="small">${quantLabel}</td>
        <td class="small">${mpApplied ? '적용' : '미적용 (리밸런싱 신호일 없음)'}</td>
        <td class="small nowrap">${A.esc(new Date(o.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }))}</td>
        <td><button type="button" class="line-btn" data-delete-override="${A.esc(o.id)}" aria-label="이 강제 설정 삭제">삭제</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="small">저장된 강제 설정이 없습니다.</td></tr>';
  }
  function rerenderAllAfterOverrideChange() {
    renderOverrideHistory();
  }
  function bindOverrideForm() {
    const form = document.getElementById('override-form');
    if (!form) return;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const start = document.getElementById('override-start').value;
      const end = document.getElementById('override-end').value;
      const regime = document.getElementById('override-regime').value;
      const note = document.getElementById('override-note').value;
      const errorEl = document.getElementById('override-error');
      try {
        A.addRegimeOverride({ start, end, regime, note });
        errorEl.textContent = '';
        document.getElementById('override-start').value = '';
        document.getElementById('override-end').value = '';
        document.getElementById('override-note').value = '';
        rerenderAllAfterOverrideChange();
      } catch (err) {
        errorEl.textContent = err.message || '저장에 실패했습니다.';
      }
    });
    function handleOverrideRowActivate(event) {
      const delBtn = event.target.closest('[data-delete-override]');
      if (delBtn) {
        A.deleteRegimeOverride(delBtn.dataset.deleteOverride);
        rerenderAllAfterOverrideChange();
        return;
      }
      const row = event.target.closest('[data-override-row]');
      if (row) window.location.href = `override-detail.html?id=${encodeURIComponent(row.dataset.overrideRow)}`;
    }
    document.getElementById('override-history-body').addEventListener('click', handleOverrideRowActivate);
    document.getElementById('override-history-body').addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      handleOverrideRowActivate(event);
    });
    // 다른 탭/페이지(override-detail.html 등)에서 추가·삭제한 경우에도 반영되도록.
    window.addEventListener('storage', event => {
      if (event.key === A.regimeOverrideStoreKey) rerenderAllAfterOverrideChange();
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{ bindTabs(); bindAdjustViewTabs(); fillForm(); fillAdjustPeriodForm(); bindAdjustPeriodForm(); renderAdjustPeriodHistory(); bindAdjustPeriodHistoryEdits(); renderOverrideHistory(); bindOverrideForm(); renderPreview(); renderForecast(); renderCategoryChart(); renderRaw(); renderMarket(); renderCompare(); renderStressMethodology(); renderStress(); activateHashTab(); document.querySelectorAll('[data-adjust],#observation,#score-hi,#score-lo,#structural-toggle,#event-toggle,#high-vol-toggle').forEach(el=>el.addEventListener('input',renderPreview)); document.getElementById('save-adjust').addEventListener('click',()=>{
    const errorEl=document.getElementById('adjust-save-error'), endInput=document.getElementById('adjust-apply-end'), end=endInput.value, start=todayISO();
    if (!end) { errorEl.textContent='적용 종료일을 입력해 주세요.'; return; }
    if (end<start) { errorEl.textContent='적용 종료일은 오늘 이후여야 합니다.'; return; }
    const form=readForm();
    try {
      A.addAdjustmentPeriod({ start, end, adjustments:form.adjustments, structural:form.structural, event:form.event, highVol:form.highVol, note:'' });
      A.saveSettings({ ...A.getSettings(), observation:form.observation, scoreHi:form.scoreHi, scoreLo:form.scoreLo, adjustments:Object.fromEntries(A.CATEGORY_KEYS.map(k=>[k,0])), structural:false, event:false, highVol:false });
      errorEl.textContent=''; endInput.value='';
      rerenderAllAfterAdjustPeriodChange();
    } catch (err) { errorEl.textContent=err.message||'저장에 실패했습니다.'; }
  }); document.getElementById('reset-adjust').addEventListener('click',()=>{A.resetSettings();fillForm();document.getElementById('adjust-apply-end').value='';document.getElementById('adjust-save-error').textContent='';renderPreview();renderForecast();}); document.getElementById('stress-methodology-toggle').addEventListener('click',()=>{const root=document.getElementById('stress-methodology');root.hidden=!root.hidden;document.getElementById('stress-methodology-toggle').textContent=root.hidden?'세부 로직 보기':'세부 로직 접기';}); bindIndicatorSelect(document.getElementById('raw-indicator'),renderRaw); bindIndicatorSelect(document.getElementById('market-indicator'),renderMarket); bindIndicatorSelect(document.getElementById('category-indicator'),renderCategoryChart); bindRawViewTabs(); bindMarketViewTabs(); bindGlobalRatesCountryToggles(); A.initRangeButtons(document.getElementById('global-rates-ranges'),range=>{globalRatesRange=range;renderGlobalRates();},'10'); A.initRangeButtons(document.getElementById('raw-ranges'),A.withScrollPreserved('#raw-detail-body',range=>{rawRange=range;renderRaw();})); A.initRangeButtons(document.getElementById('market-ranges'),A.withScrollPreserved('#market-detail-body',range=>{marketRange=range;renderMarket();})); A.initRangeButtons(document.getElementById('category-ranges'),range=>{categoryRange=range;categoryCustomRange=null;const clearBtn=document.getElementById('category-range-clear');if(clearBtn)clearBtn.hidden=true;renderCategoryChart();}); document.getElementById('category-range-apply').addEventListener('click',()=>{const start=document.getElementById('category-range-start').value,end=document.getElementById('category-range-end').value;if(!start||!end||start>end)return;categoryCustomRange={start,end};document.getElementById('category-ranges').querySelectorAll('.range-btn').forEach(btn=>btn.classList.remove('active'));document.getElementById('category-range-clear').hidden=false;renderCategoryChart();}); document.getElementById('category-range-clear').addEventListener('click',()=>{categoryCustomRange=null;document.getElementById('category-range-clear').hidden=true;const defaultBtn=document.getElementById('category-ranges').querySelector('[data-range="1"]');if(defaultBtn)defaultBtn.classList.add('active');renderCategoryChart();}); A.initRangeButtons(document.getElementById('stress-ranges'),range=>{stressRange=range;renderStress();},'all'); window.addEventListener('aip5:adjustment-change',renderCategoryChart); A.bindSortableHeaders(document.getElementById('raw-catalog-body').closest('table'), (key, dir) => { rawCatalogSort = { key, dir }; renderRaw(); }); A.bindSortableHeaders(document.getElementById('raw-detail-body').closest('table'), (key, dir) => { rawDetailSort = { key, dir }; renderRaw(); }); A.bindSortableHeaders(document.getElementById('market-detail-body').closest('table'), (key, dir) => { marketDetailSort = { key, dir }; renderMarket(); }); document.getElementById('compare-index-a').addEventListener('change', renderCompare); document.getElementById('compare-index-b').addEventListener('change', renderCompare); document.getElementById('compare-months').addEventListener('input', renderCompare); A.initRangeButtons(document.getElementById('compare-ranges'),range=>{compareRange=range;renderCompare();}); });
})();
