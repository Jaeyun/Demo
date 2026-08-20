(function () {
  'use strict';

  const A = window.AIP;
  const MODE_LABEL = { daily: '일단위', biweekly: '격주', monthly: '월말' };
  const MODE_ORDER = ['daily', 'biweekly', 'monthly'];
  const MP_MODE = 'daily'; // MP 기준 임팩트는 대표로 노출모드 하나만 본다 - performance.html MP 기준 탭 기본값과 동일.

  function getOverrideFromQuery() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return null;
    return A.getRegimeOverrides().find(o => o.id === id) || null;
  }

  function dayCount(start, end) {
    return Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
  }

  function renderMeta(o, quant, mpApplied) {
    document.getElementById('detail-title').textContent = `${A.formatDate(o.start)} ~ ${A.formatDate(o.end)} · ${o.regime}`;
    document.title = `${o.regime} 상세 · AIP X DeepSearch Indicator`;

    const quantLabel = MODE_ORDER.map(m => `${MODE_LABEL[m]} ${quant[m] ? '적용' : '미적용'}`).join(' · ');
    const createdText = o.createdAt ? new Date(o.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

    document.getElementById('detail-meta-stats').innerHTML = `
      <div class="stat"><span class="stat-label">적용 기간</span><strong class="stat-value">${dayCount(o.start, o.end)}일</strong><span class="stat-sub">${A.esc(A.formatDate(o.start))} ~ ${A.esc(A.formatDate(o.end))}</span></div>
      <div class="stat"><span class="stat-label">세부 국면</span><strong class="stat-value" style="font-size:19px;">${A.esc(o.regime)}</strong><span class="stat-sub">강제 지정값</span></div>
      <div class="stat"><span class="stat-label">정량 스코어 적용</span><strong class="stat-value" style="font-size:14px;">${A.esc(quantLabel)}</strong><span class="stat-sub">리밸런싱 신호일 기준</span></div>
      <div class="stat"><span class="stat-label">MP 기준 적용</span><strong class="stat-value" style="font-size:16px;">${mpApplied ? '적용' : '미적용'}</strong><span class="stat-sub">${mpApplied ? '월말 신호일 존재' : '리밸런싱 신호일 없음'}</span></div>
      <div class="stat"><span class="stat-label">저장 시각</span><strong class="stat-value" style="font-size:14px;">${A.esc(createdText)}</strong><span class="stat-sub">등록 시점</span></div>`;

    const noteWrap = document.getElementById('detail-note-wrap');
    if (o.note) {
      noteWrap.hidden = false;
      document.getElementById('detail-note').textContent = o.note;
    } else {
      noteWrap.hidden = true;
    }
  }

  // 시계열(dates/equity/returns 배열)을 강제설정 기간([o.start, o.end])만 잘라
  // A.dailyMetrics로 요약한다 - 정량 스코어(computeQuantBacktest, {dates,equity,strategy_return}
  // 형태)와 MP 기준(computeEtfBacktest, row 객체 배열 형태) 둘 다 여기로 정규화해서 넘긴다.
  function metricsForRange(dates, equity, returns, start, end) {
    const sliced = A.sliceCustomRange(dates, [equity, returns], start, end);
    return A.dailyMetrics(sliced.dates, sliced.arrays[0], sliced.arrays[1]);
  }

  function quantSeries(mode, overridesOverride) {
    const ledger = A.computeQuantBacktest(mode, A.getSettings(), overridesOverride);
    return { dates: ledger.dates, equity: ledger.equity, returns: ledger.strategy_return };
  }

  function mpSeries(overridesOverride) {
    const rows = A.computeEtfBacktest(MP_MODE, A.getSettings(), overridesOverride);
    return { dates: rows.map(r => r.date), equity: rows.map(r => r.equity), returns: rows.map(r => r.strategy_return) };
  }

  // 시작일 기준(=1.0)으로 다시 맞춘다 - equity 곡선 자체는 데이터셋 전체 시작일부터 누적된
  // 값이라 강제설정 구간만 잘라 비교하면 "자연"과 "적용" 두 곡선의 시작 레벨이 서로 달라
  // 시각적으로 비교가 안 된다(값 자체가 아니라 이 구간 동안의 등락만 보고 싶은 것이므로).
  function rebase(dates, equity, start, end) {
    const sliced = A.sliceCustomRange(dates, [equity], start, end);
    const eq = sliced.arrays[0];
    if (!eq.length || !eq[0]) return { dates: [], values: [] };
    return { dates: sliced.dates, values: eq.map(v => v / eq[0]) };
  }

  function renderImpact(o, quant, mpApplied) {
    const applicableQuantModes = MODE_ORDER.filter(m => quant[m]);
    // storage 이벤트로 다시 그려질 수 있으므로(다른 탭에서 강제 설정이 바뀐 경우) 매번 모든
    // 표시 상태를 리셋한 뒤 이번 결과에 맞게 다시 켠다 - 이전 렌더의 흔적이 남지 않도록.
    document.getElementById('detail-impact-empty').hidden = true;
    document.getElementById('detail-impact-short-window').hidden = true;
    document.getElementById('detail-impact-table-wrap').hidden = true;
    document.getElementById('detail-impact-chart-wrap').hidden = true;
    if (!applicableQuantModes.length && !mpApplied) {
      document.getElementById('detail-impact-empty').hidden = false;
      return;
    }

    // with/without 원시 시계열(dates/equity/returns)을 행마다 보관해 뒀다가 아래 대표 차트에서
    // 그대로 재사용한다 - 예전엔 차트 그릴 때 같은 모드를 또 계산했는데(A.computeQuantBacktest/
    // computeEtfBacktest는 캐시가 없어 매번 전체 이력을 처음부터 훑는 무거운 연산이라 낭비였다).
    const rows = [];
    applicableQuantModes.forEach(mode => {
      const withThis = quantSeries(mode, [o]);
      const without = quantSeries(mode, []);
      rows.push({
        label: `정량 스코어 · ${MODE_LABEL[mode]}`,
        withThis, without,
        withMetrics: metricsForRange(withThis.dates, withThis.equity, withThis.returns, o.start, o.end),
        withoutMetrics: metricsForRange(without.dates, without.equity, without.returns, o.start, o.end)
      });
    });
    if (mpApplied) {
      const withThis = mpSeries([o]);
      const without = mpSeries([]);
      rows.push({
        label: `MP 기준 (${MODE_LABEL[MP_MODE]} 노출)`,
        withThis, without,
        withMetrics: metricsForRange(withThis.dates, withThis.equity, withThis.returns, o.start, o.end),
        withoutMetrics: metricsForRange(without.dates, without.equity, without.returns, o.start, o.end)
      });
    }

    // 기간이 너무 짧으면(구간 내 실제 거래일이 2일 미만) 강제 국면이 다음 영업일 시가부터
    // 반영되는 실행 지연 특성상 이 구간 안에서는 효과가 아예 안 보이고, dailyMetrics 자체도
    // 표본 2개 미만이면 전부 0으로 반환한다 - "0% 변화"가 "효과 없음"이 아니라 "이 짧은
    // 구간으로는 측정 불가"일 수 있다는 걸 알려야 사용자가 오해하지 않는다.
    const sampleDays = A.sliceCustomRange(rows[0].withThis.dates, [], o.start, o.end).dates.length;
    document.getElementById('detail-impact-short-window').hidden = sampleDays >= 2;

    const fmtPair = (withoutV, withV) => `${A.formatPct(withoutV, 1)} → ${A.formatPct(withV, 1)}`;
    document.getElementById('detail-impact-body').innerHTML = rows.map(r => `<tr>
      <td>${A.esc(r.label)}</td>
      <td class="numeric">${fmtPair(r.withoutMetrics.total_return, r.withMetrics.total_return)}</td>
      <td class="numeric">${fmtPair(r.withoutMetrics.cagr, r.withMetrics.cagr)}</td>
      <td class="numeric">${fmtPair(r.withoutMetrics.mdd, r.withMetrics.mdd)}</td>
      <td class="numeric">${A.formatNumber(r.withoutMetrics.sharpe_rf0, 2)} → ${A.formatNumber(r.withMetrics.sharpe_rf0, 2)}</td>
    </tr>`).join('');
    document.getElementById('detail-impact-table-wrap').hidden = false;

    // 대표 차트 1개 - 정량 스코어 중 먼저 적용되는 모드(일단위 우선), 없으면 MP 기준.
    // rows[0]이 바로 그 우선순위(위에서 정량 모드부터 순서대로 push하고 MP는 맨 뒤에 push했으므로).
    const primary = rows[0];
    const withRebased = rebase(primary.withThis.dates, primary.withThis.equity, o.start, o.end);
    const withoutRebased = rebase(primary.without.dates, primary.without.equity, o.start, o.end);
    if (withRebased.dates.length && withoutRebased.dates.length) {
      const option = A.lineOption({
        dates: withRebased.dates,
        series: [
          { name: '자연 국면', data: withoutRebased.values, color: '#8ba0b0' },
          { name: '이 설정 적용', data: withRebased.values, color: '#1771b9' }
        ],
        yName: `${primary.label} · 누적 배수(구간 시작=1.0)`
      });
      A.createChart(document.getElementById('detail-impact-chart'), option);
      document.getElementById('detail-impact-chart-wrap').hidden = false;
    }
  }

  function render() {
    const o = getOverrideFromQuery();
    if (!o) {
      document.getElementById('detail-not-found').hidden = false;
      document.getElementById('detail-content').hidden = true;
      return;
    }
    document.getElementById('detail-not-found').hidden = true;
    document.getElementById('detail-content').hidden = false;

    const quant = A.overrideAppliesToQuant(o);
    const mpApplied = A.overrideAppliesToMp(o);
    renderMeta(o, quant, mpApplied);
    renderImpact(o, quant, mpApplied);
  }

  // 삭제 버튼은 페이지 로드 시 한 번만 바인딩한다(render()가 storage 이벤트로 여러 번 다시
  // 불릴 수 있으므로, render() 안에서 매번 새 리스너를 추가하면 클릭 한 번에 삭제+리다이렉트가
  // 중복 실행된다) - 클릭 시점에 쿼리스트링의 id를 다시 읽어 항상 최신 상태를 지운다.
  function bindDelete() {
    document.getElementById('detail-delete').addEventListener('click', () => {
      const o = getOverrideFromQuery();
      if (o) A.deleteRegimeOverride(o.id);
      window.location.href = 'adjustment.html#history';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    bindDelete();
    // 다른 탭(adjustment.html 히스토리 탭 등)에서 이 설정을 포함해 강제 설정 목록이 바뀌면
    // 새로고침 없이 이 페이지도 다시 그린다 - 그대로 두면 이미 삭제/변경된 설정을 계속
    // 보여주게 된다. quantSeries/mpSeries가 A.getSettings()의 highVol/structural/event
    // 토글로 자연 국면을 정하므로, adjustment.html에서 그 토글(전역 또는 기간별)을 바꿔도
    // 다시 그려야 한다.
    window.addEventListener('storage', event => {
      if (event.key === A.regimeOverrideStoreKey || event.key === A.adjustmentSettingsStoreKey || event.key === A.adjustmentPeriodStoreKey || event.key === A.indicatorModeStoreKey) render();
    });
  });
})();
