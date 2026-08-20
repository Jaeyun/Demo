(function () {
  'use strict';
  const header = document.querySelector('.aip-site-header');
  if (!header) return;
  // 이 페이지가 aip_3engine_strategy_overview 폴더 "안"(형제 페이지)인지, 그 밖의 상위
  // 포털(dashboard/index.html 등)에서 이 스크립트를 하위 폴더 경로로 불러온 건지 판별해야
  // 링크에 접두 경로를 붙일지 결정할 수 있다. 예전엔 window.location.pathname에 폴더
  // 이름이 리터럴로 들어있는지로 판별했는데, 이러면 (1) 폴더를 다른 이름으로 복사/배포하거나
  // (2) 이 폴더 자체를 웹 루트로 서빙하면(경로에 폴더 이름 자체가 아예 안 나타남) 전부
  // 오판해서 헤더 메뉴 링크가 전부 깨진다(실사용자 피드백: 독립실행 압축파일에서 헤더
  // 메뉴 클릭이 안 됨 - 압축 폴더 이름이 aip_3engine_strategy_overview가 아니라서 발생).
  // 훨씬 더 견고한 신호: 이 스크립트 자신이 실제로 "어떤 경로로 로드됐는지"(현재 실행 중인
  // <script> 태그의 src)를 직접 보면 된다 - 형제 페이지는 접두 경로 없이
  // "header-runtime.js"로, 상위 포털은 "aip_3engine_strategy_overview/header-runtime.js"로
  // 부르므로, 폴더 이름이 뭐든 어떤 프로토콜로 열리든 항상 정확하다.
  const scriptSrc = (document.currentScript && document.currentScript.getAttribute('src')) || '';
  const inSet = !scriptSrc.startsWith('aip_3engine_strategy_overview/');
  const prefix = inSet ? '' : 'aip_3engine_strategy_overview/';
  const active = document.body && document.body.dataset ? document.body.dataset.page || '' : '';
  const labels = [
    ['quantitative', '\uC815\uB7C9 \uBD84\uC11D', 'quantitative.html'],
    ['adjustment', 'Adjustment', 'adjustment.html'],
    ['portfolio', '\uD3EC\uD2B8\uD3F4\uB9AC\uC624', 'portfolio.html'],
    ['performance', '\uC131\uACFC \uBD84\uC11D', 'performance.html']
  ];
  const data = window.DASHBOARD_DATA || {};
  const asOf = String(data.meta && (data.meta.data_as_of || data.meta.as_of) || '2026-07-31').slice(0, 10).replace(/-/g, '.');
  const inner = document.createElement('div'); inner.className = 'aip-header-inner';
  const brand = document.createElement('a'); brand.className = 'aip-brand'; brand.href = inSet ? 'index.html' : `${prefix}index.html`; brand.setAttribute('aria-label', '\uC804\uB7B5 \uAC1C\uC694 \uD648');
  const logo = document.createElement('img'); logo.src = `${prefix}favicon.svg`; logo.alt = 'AIP';
  const brandText = document.createElement('span'); brandText.textContent = 'AIP X DeepSearch 3-Engine Solution'; brand.append(logo, brandText);
  const nav = document.createElement('nav'); nav.className = 'aip-primary-nav'; nav.setAttribute('aria-label', '\uC8FC\uC694 \uBA54\uB274');
  labels.forEach(([key, label, href]) => { const link = document.createElement('a'); link.className = 'aip-nav-link'; if (active === key) link.classList.add('active'); link.href = `${prefix}${href}`; link.textContent = label; nav.append(link); });
  const status = document.createElement('div'); status.className = 'aip-header-status'; const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
  const statusText = document.createElement('span'); statusText.textContent = `\uAE30\uC900\uC77C ${asOf}`; status.append(dot, statusText);
  inner.append(brand, nav, status); header.replaceChildren(inner);
})();
