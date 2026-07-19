/* =========================================================================
 * tap.js — The active tap loop + juicy feedback (floating +$ and coins)
 * -------------------------------------------------------------------------
 * Renders the Home tab's tap zone and the per-tap upgrade card. Purely a
 * "view + interaction" layer; all numbers come from engine.js.
 * ========================================================================= */

const Tap = (() => {
  let tapZone, tapValueEl, upgradeCard;

  /** Build the Home-tab tap section markup once. */
  function mount(container) {
    container.innerHTML = `
      <div class="tap-wrap">
        <button id="tapZone" class="tap-zone" aria-label="Tap to earn">
          <div class="tap-coin">💰</div>
          <div class="tap-label">TAP</div>
          <div id="tapValue" class="tap-value"></div>
        </button>

        <div class="card tap-upgrade" id="tapUpgradeCard">
          <div class="card-row">
            <div>
              <div class="card-title">Per-Tap Earnings</div>
              <div class="card-sub" id="tapUpgradeSub"></div>
            </div>
            <button class="btn btn-gold" id="tapUpgradeBtn"></button>
          </div>
          <div class="progress"><div class="progress-fill" id="tapProgress"></div></div>
          <div class="progress-caption" id="tapProgressCaption"></div>
        </div>

        <!-- Phase 3: player-triggered booster + active effect chips -->
        <div class="card tap-upgrade" id="boosterCard">
          <div class="card-row">
            <div>
              <div class="card-title">${PROG.BOOSTER.icon} ${PROG.BOOSTER.name}</div>
              <div class="card-sub" id="boosterSub"></div>
            </div>
            <button class="btn" id="boosterBtn"></button>
          </div>
        </div>
        <div id="effectsRow" class="chip-row effects-row"></div>
      </div>
    `;

    tapZone = container.querySelector('#tapZone');
    tapValueEl = container.querySelector('#tapValue');
    upgradeCard = container.querySelector('#tapUpgradeCard');

    tapZone.addEventListener('pointerdown', onTap);
    container.querySelector('#tapUpgradeBtn').addEventListener('click', onUpgrade);
    container.querySelector('#boosterBtn').addEventListener('click', () => {
      if (Progression.activateBooster()) {
        UI.showToast(`${PROG.BOOSTER.icon} <b>${PROG.BOOSTER.name}!</b><br>All income ×${PROG.BOOSTER.mult} for ${PROG.BOOSTER.secs}s.`);
        refresh();
      }
    });

    refresh();
  }

  /** Handle a tap: earn, animate, spawn floaters. */
  function onTap(e) {
    const gain = doTap();

    // Pop animation on the zone.
    tapZone.classList.remove('tap-pop');
    void tapZone.offsetWidth; // reflow to restart animation
    tapZone.classList.add('tap-pop');

    spawnFloater(e, gain);
    spawnCoins(e);

    UI.renderBalance();
    refresh();
  }

  function onUpgrade() {
    if (upgradeTap()) {
      UI.renderBalance();
      refresh();
    }
  }

  /** Floating "+$X" text that drifts up and fades. */
  function spawnFloater(e, gain) {
    const el = document.createElement('div');
    el.className = 'floater';
    el.textContent = '+' + formatMoney(gain);
    positionAtPointer(el, e);
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  /** A little burst of coin emojis for extra juice. */
  function spawnCoins(e) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-fx';
      coin.textContent = '🪙';
      // Randomised horizontal drift per coin.
      const dx = (Math.random() - 0.5) * 140;
      const dy = -80 - Math.random() * 80;
      coin.style.setProperty('--dx', dx + 'px');
      coin.style.setProperty('--dy', dy + 'px');
      positionAtPointer(coin, e);
      document.body.appendChild(coin);
      coin.addEventListener('animationend', () => coin.remove());
    }
  }

  function positionAtPointer(el, e) {
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  /** Update tap value display, upgrade cost, and progress bar. */
  function refresh() {
    if (!tapValueEl) return;
    tapValueEl.textContent = '+' + formatMoney(tapValue());

    const cost = tapUpgradeCost();
    const sub = document.getElementById('tapUpgradeSub');
    const btn = document.getElementById('tapUpgradeBtn');
    const progress = document.getElementById('tapProgress');
    const caption = document.getElementById('tapProgressCaption');

    sub.textContent = `Lv ${state.tapLevel} · ${formatMoney(tapValue())} per tap`;
    btn.textContent = 'Upgrade ' + formatMoney(cost);
    const affordable = state.balance >= cost;
    btn.disabled = !affordable;

    // Progress bar = how close the balance is to affording the next upgrade.
    const pct = Math.min(100, (state.balance / cost) * 100);
    progress.style.width = pct.toFixed(1) + '%';
    caption.textContent = affordable
      ? 'Ready to upgrade!'
      : `${formatMoney(state.balance)} / ${formatMoney(cost)}`;

    refreshBooster();
    refreshEffects();
  }

  /** Booster button state: active countdown, ready, or cooldown. */
  function refreshBooster() {
    const btn = document.getElementById('boosterBtn');
    const sub = document.getElementById('boosterSub');
    if (!btn) return;
    const b = Progression.boosterInfo();
    sub.textContent = `×${b.mult} all income for ${b.secs}s · ${Math.round(b.cooldownSecs / 60)} min cooldown`;
    if (b.active) {
      btn.textContent = `Active ${formatDuration(b.secsLeft)}`;
      btn.disabled = true;
      btn.className = 'btn btn-gold';
    } else if (b.ready) {
      btn.textContent = 'Activate';
      btn.disabled = false;
      btn.className = 'btn btn-gold';
    } else {
      btn.textContent = formatDuration(b.cooldownLeft);
      btn.disabled = true;
      btn.className = 'btn';
    }
  }

  /** Chips for every active timed effect (events + booster). */
  function refreshEffects() {
    const row = document.getElementById('effectsRow');
    if (!row) return;
    const effects = Progression.activeEffects();
    row.innerHTML = effects.map((e) =>
      `<span class="chip chip-active">${e.icon} ×${e.mult} · ${formatDuration((e.endsAt - Date.now()) / 1000)}</span>`
    ).join('');
  }

  return { mount, refresh };
})();
