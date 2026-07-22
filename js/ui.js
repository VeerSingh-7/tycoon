/* =========================================================================
 * ui.js — App shell: top bar, tab switching, balance render, popups
 * -------------------------------------------------------------------------
 * Tabs are registered in TAB_DEFS. "Coming soon" tabs become real screens in
 * later phases just by pointing `render` at a real module — no shell rewrite.
 * ========================================================================= */

const UI = (() => {
  // Registry of tabs. `render(container)` builds the tab body.
  const TAB_DEFS = [
    { id: 'home',    label: 'Home',     icon: '🏠', render: renderHome },
    { id: 'business', label: 'Business', icon: '🏢', render: (el) => Businesses.mount(el) },
    { id: 'invest',  label: 'Invest',   icon: '📈', render: (el) => Invest.mount(el) },
    { id: 'assets',  label: 'Luxury',   icon: '💎', render: (el) => AssetsTab.mount(el) },
    { id: 'profile', label: 'Profile',  icon: '👤', render: (el) => Profile.mount(el) },
  ];

  let activeTab = 'home';
  let displayedBalance = 0; // for smooth counting animation
  let balanceEl, incomeEl, tabBodyEl;

  function init() {
    balanceEl = document.getElementById('balanceValue');
    incomeEl = document.getElementById('incomeRate');
    tabBodyEl = document.getElementById('tabBody');
    displayedBalance = state.balance;

    buildNav();
    switchTab('home');

    // Smooth balance counter — eases the displayed number toward the real one.
    requestAnimationFrame(animateBalance);
  }

  /* ------------------- Navigation ------------------- */

  function buildNav() {
    const nav = document.getElementById('bottomNav');
    nav.innerHTML = TAB_DEFS.map((t) => `
      <button class="nav-btn" data-tab="${t.id}">
        <span class="nav-icon">${t.icon}</span>
        <span class="nav-label">${t.label}</span>
      </button>
    `).join('');

    nav.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(id) {
    activeTab = id;
    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === id);
    });
    const def = TAB_DEFS.find((t) => t.id === id);
    tabBodyEl.innerHTML = '';
    def.render(tabBodyEl);
  }

  /** Re-render the active tab (used after purchases elsewhere if needed). */
  function refreshActiveTab() {
    switchTab(activeTab);
  }

  /* ------------------- Home tab ------------------- */

  function renderHome(el) {
    const wrap = document.createElement('div');
    el.appendChild(wrap);
    Tap.mount(wrap);
  }

  function comingSoon(el, title, desc) {
    el.innerHTML = `
      <div class="coming-soon">
        <div class="cs-badge">COMING SOON</div>
        <h2>${title}</h2>
        <p>${desc}</p>
        <p class="muted">Unlocks in a later update.</p>
      </div>
    `;
  }

  /* ------------------- Balance rendering ------------------- */

  function renderBalance() {
    // Keep tap upgrade + business affordability visuals fresh.
    if (activeTab === 'home') Tap.refresh();
  }

  function animateBalance() {
    // Ease displayed value toward the true balance for a smooth "counting" feel.
    const target = state.balance;
    const diff = target - displayedBalance;
    if (Math.abs(diff) < 0.5) {
      displayedBalance = target;
    } else {
      displayedBalance += diff * 0.18; // easing factor
    }
    if (balanceEl) balanceEl.textContent = formatMoney(displayedBalance);
    if (incomeEl) incomeEl.textContent = formatRate(totalPassiveIncomePerSec());

    // Player level badge (levels come from lifetime earnings — engine.js).
    const badge = document.getElementById('levelBadge');
    if (badge) badge.textContent = 'LV ' + playerLevel();

    // Keep the active tab's timers/affordability fresh (throttled).
    if (activeTab === 'business') throttled('biz', 500, () => Businesses.render());
    if (activeTab === 'home') throttled('home', 500, () => Tap.refresh());
    if (activeTab === 'profile') throttled('profile', 2000, () => Profile.render());
    if (activeTab === 'invest') throttled('invest', 1000, () => Invest.refresh());
    if (activeTab === 'assets') throttled('assets', 2000, () => AssetsTab.render());

    requestAnimationFrame(animateBalance);
  }

  // Generic per-key throttle for periodic tab refreshes.
  const _lastRun = {};
  function throttled(key, ms, fn) {
    const t = performance.now();
    if (!(key in _lastRun) || t - _lastRun[key] > ms) {
      _lastRun[key] = t;
      fn();
    }
  }

  /* ------------------- Toasts (events, achievements) ------------------- */

  /** Non-blocking popup banner. Tap to dismiss; auto-fades after ~6s. */
  function showToast(html, opts = {}) {
    let stack = document.getElementById('toastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toastStack';
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const toast = document.createElement('div');
    toast.className = 'toast' + (opts.tone === 'bad' ? ' toast-bad' : '');
    toast.innerHTML = html;
    stack.appendChild(toast);

    const dismiss = () => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 350);
    };
    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, opts.ms || 6000);
  }

  /* ------------------- Offline popup ------------------- */

  function showOfflinePopup(away) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-emoji">🌙</div>
        <h2>While you were away</h2>
        <p class="modal-time">Gone for ${formatDuration(away.seconds)}</p>
        <div class="modal-earned">${formatMoney(away.earned)}</div>
        <p class="muted">Earned at ${formatRate(away.rate)}${
          away.seconds > away.cappedSeconds
            ? `<br>(capped at ${formatDuration(away.cappedSeconds)} offline)`
            : ''
        }</p>
        <button class="btn btn-gold btn-wide" id="collectBtn">Collect</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#collectBtn').addEventListener('click', () => {
      overlay.remove();
      renderBalance();
    });
  }

  return { init, renderBalance, refreshActiveTab, showOfflinePopup, showToast };
})();
