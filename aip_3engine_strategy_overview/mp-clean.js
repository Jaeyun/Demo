(function () {
  'use strict';
  function hideSummaryCards() {
    const node = document.getElementById('mp-metrics');
    if (node) {
      node.textContent = '';
      node.style.display = 'none';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideSummaryCards, { once: true });
  else hideSummaryCards();
})();
