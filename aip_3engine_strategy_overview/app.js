(() => {
  const D = window.DASHBOARD_DATA;
  if (!D) throw new Error("대시보드 데이터 · 없음");

  const $ = (selector) => document.querySelector(selector);
  const fmtDate = (value) => value ? String(value).slice(0, 10).replace(/-/g, ".") : "-";

  function syncSharedHeader() {
    const header = document.querySelector('.aip-site-header');
    if (!header) return;
    // header-runtime.js가 나중에 이 헤더를 덮어쓰지만 이 함수도 여전히 호출된다 - 폴더를
    // 다른 이름으로 배포하거나 이 폴더를 웹 루트로 서빙하면 오판하는 문자열 매칭을
    // document.currentScript 기반으로 교체(header-runtime.js/app-common.js와 동일한 수정).
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
    const logo = document.createElement('img'); logo.src = `${prefix}favicon.svg`; logo.alt = 'AIP';
    const brandText = document.createElement('span'); brandText.textContent = 'AIP X DeepSearch Indicator';
    brand.append(logo, brandText);
    const nav = document.createElement('nav'); nav.className = 'aip-primary-nav'; nav.setAttribute('aria-label', '\uC8FC\uC694 \uBA54\uB274');
    links.forEach(([key, label, href]) => { const link = document.createElement('a'); link.className = 'aip-nav-link'; if (active === key) link.classList.add('active'); link.href = `${prefix}${href}`; link.textContent = label; nav.append(link); });
    const status = document.createElement('div'); status.className = 'aip-header-status';
    const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
    const statusText = document.createElement('span'); const asOf = String(D.meta?.data_as_of || D.meta?.as_of || '2026-07-31').slice(0, 10).replace(/-/g, '.'); statusText.textContent = `\uAE30\uC900\uC77C ${asOf}`;
    status.append(dot, statusText); inner.append(brand, nav, status); header.replaceChildren(inner);
  }

  function renderFooter() {
    const generated = String(D.meta?.generated_at || "-").replace("T", " ").slice(0, 16);
    $("#footer-period").textContent = `성과 기준 ${fmtDate(D.strategy?.metrics?.start)} ~ ${fmtDate(D.strategy?.metrics?.end)}`;
    $("#footer-generated").textContent = `페이지 생성 ${generated} KST`;
  }

  function applyHighVolVisibility() {
    let highVol = false;
    try { highVol = JSON.parse(localStorage.getItem("aip-five-menu-adjustment-v1") || "{}").highVol === true; } catch (_) { highVol = false; }
    const item = document.getElementById("high-vol-regime-item");
    if (item && !highVol) item.style.display = "none";
  }

  syncSharedHeader();
  renderFooter();
  applyHighVolVisibility();
})();
