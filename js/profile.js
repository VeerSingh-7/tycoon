/* =========================================================================
 * profile.js — Profile tab: title, level/XP, reputation, stats,
 *              Legacy (prestige) screen, achievements grid
 * -------------------------------------------------------------------------
 * Pure view layer over Progression + engine. Event delegation on the
 * container survives the periodic re-render (for live countdowns).
 * ========================================================================= */

const Profile = (() => {
  let container;

  function mount(el) {
    container = el;
    container.addEventListener('click', onClick);
    render();
  }

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.prestige !== undefined) showPrestigeConfirm();
  }

  /* ------------------------------ Render ------------------------------ */

  function render() {
    if (!container) return;
    container.innerHTML = `
      ${identityHTML()}
      ${multipliersHTML()}
      ${legacyHTML()}
      ${statsHTML()}
      ${achievementsHTML()}
    `;
  }

  /** Title, level, XP progress, reputation. */
  function identityHTML() {
    const level = playerLevel();
    const title = Progression.currentTitle();
    const next = Progression.nextTitle();
    const pct = (playerLevelProgress() * 100).toFixed(1);
    return `
      <div class="card profile-head">
        <div class="title-icon">${title.icon}</div>
        <div class="title-name">${title.name}</div>
        <div class="title-sub">Level ${level} · ⭐ ${Progression.reputation()} reputation</div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-caption">Level ${level + 1} at ${formatMoney(xpForLevel(level + 1))} lifetime earnings
          ${next ? `· next rank <b>${next.name}</b> at Lv ${next.minLevel}` : '· max rank reached 👑'}</div>
      </div>`;
  }

  /** Where the global income multiplier comes from — full transparency. */
  function multipliersHTML() {
    const effects = Progression.activeEffects();
    const effectRows = effects.map((e) =>
      `<div class="mult-row"><span>${e.icon} ${e.name} (${formatDuration((e.endsAt - Date.now()) / 1000)})</span><b class="up">×${e.mult}</b></div>`).join('');
    return `
      <div class="card">
        <div class="card-title">💫 Income Multipliers</div>
        <div class="mult-row"><span>♻️ Legacy (${state.legacyPoints} pts)</span><b>×${Progression.legacyMultiplier().toFixed(2)}</b></div>
        <div class="mult-row"><span>⭐ Reputation (${Progression.reputation()} pts)</span><b>×${Progression.repMultiplier().toFixed(2)}</b></div>
        <div class="mult-row"><span>🏆 Achievements</span><b>×${Progression.achievementMultiplier().toFixed(2)}</b></div>
        ${effectRows}
        <div class="mult-row mult-total"><span>Total</span><b class="gold">×${Progression.globalIncomeMultiplier().toFixed(2)}</b></div>
      </div>`;
  }

  /** Legacy / prestige card with a full preview BEFORE any commitment. */
  function legacyHTML() {
    const gain = Progression.legacyGain();
    const newMult = 1 + (state.legacyPoints + gain) * PROG.LEGACY_MULT_PER_POINT;
    const startCash = PROG.PRESTIGE_BASE_CASH + PROG.PRESTIGE_CASH_PER_POINT * (state.legacyPoints + gain);
    return `
      <div class="card legacy-card">
        <div class="card-title">♻️ Legacy</div>
        <div class="card-sub">Reset your businesses for permanent Legacy points —
          each is <b>+10% income forever</b>. You KEEP your level, slots, achievements and reputation.</div>
        <div class="legacy-preview">
          <div class="mult-row"><span>This run earned</span><b>${formatMoney(state.runEarned)}</b></div>
          <div class="mult-row"><span>Reset now grants</span><b class="gold">+${gain} Legacy point${gain === 1 ? '' : 's'}</b></div>
          <div class="mult-row"><span>New income multiplier</span><b class="up">×${Progression.legacyMultiplier().toFixed(2)} → ×${newMult.toFixed(2)}</b></div>
          <div class="mult-row"><span>Restart cash</span><b>${formatMoney(startCash)}</b></div>
        </div>
        ${gain >= 1
          ? `<button class="btn btn-gold btn-wide" data-prestige>Legacy Reset · +${gain} points</button>`
          : `<button class="btn btn-wide" disabled>Earn ${formatMoney(Progression.nextLegacyPointAt())} this run to unlock</button>`}
        <div class="progress-caption">Next point at ${formatMoney(Progression.nextLegacyPointAt())} run earnings · resets: businesses, cash, tap, management</div>
      </div>`;
  }

  /** Lifetime stats grid. */
  function statsHTML() {
    const staff = BUSINESS_DEFS.reduce((n, d) => n + getBiz(d.id).staff, 0);
    const done = ACHIEVEMENT_DEFS.filter((a) => state.achievements[a.id]).length;
    const cells = [
      ['Lifetime earned', formatMoney(state.totalEarned)],
      ['This run', formatMoney(state.runEarned)],
      ['Businesses', `${usedSlots()}/${maxSlots()} slots`],
      ['Employees', formatNumber(staff)],
      ['Taps', formatNumber(state.stats.taps || 0)],
      ['Tap level', state.tapLevel],
      ['Legacy resets', state.prestiges],
      ['Achievements', `${done}/${ACHIEVEMENT_DEFS.length}`],
    ];
    return `
      <div class="card">
        <div class="card-title">📊 Lifetime Stats</div>
        <div class="stat-grid">
          ${cells.map(([k, v]) => `<div class="stat-cell"><span class="muted">${k}</span><b>${v}</b></div>`).join('')}
        </div>
      </div>`;
  }

  /** Achievements grid with locked/unlocked state + reward text. */
  function achievementsHTML() {
    const cards = ACHIEVEMENT_DEFS.map((a) => {
      const done = !!state.achievements[a.id];
      const reward = a.reward.cash ? `+${formatMoney(a.reward.cash)}` : `income ×${a.reward.mult}`;
      return `
        <div class="ach-card ${done ? 'ach-done' : 'ach-locked'}">
          <div class="ach-icon">${done ? a.icon : '🔒'}</div>
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
          <div class="ach-reward">${reward} · ${a.rep}⭐</div>
        </div>`;
    }).join('');
    return `
      <div class="section-head" style="margin-top:6px"><h2>Achievements</h2>
        <div class="section-stat">${ACHIEVEMENT_DEFS.filter((a) => state.achievements[a.id]).length}/${ACHIEVEMENT_DEFS.length}</div></div>
      <div class="ach-grid">${cards}</div>`;
  }

  /* ---------------------- Prestige confirmation ---------------------- */

  function showPrestigeConfirm() {
    const gain = Progression.legacyGain();
    if (gain < 1) return;
    const newMult = 1 + (state.legacyPoints + gain) * PROG.LEGACY_MULT_PER_POINT;
    const startCash = PROG.PRESTIGE_BASE_CASH + PROG.PRESTIGE_CASH_PER_POINT * (state.legacyPoints + gain);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-emoji">♻️</div>
        <h2>Legacy Reset</h2>
        <div class="legacy-preview" style="text-align:left">
          <div class="mult-row"><span>You gain</span><b class="gold">+${gain} Legacy points</b></div>
          <div class="mult-row"><span>Income forever</span><b class="up">×${newMult.toFixed(2)}</b></div>
          <div class="mult-row"><span>Restart cash</span><b>${formatMoney(startCash)}</b></div>
          <div class="mult-row"><span>You keep</span><b>level · slots · achievements · rep</b></div>
          <div class="mult-row"><span>You reset</span><b>businesses · cash · tap · mgmt</b></div>
        </div>
        <button class="btn btn-gold btn-wide" id="prestigeGo">Start New Legacy</button>
        <button class="btn btn-wide" id="prestigeCancel">Not yet</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#prestigeCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#prestigeGo').addEventListener('click', () => {
      if (Progression.doPrestige()) {
        overlay.remove();
        UI.renderBalance();
        render();
        UI.showToast(`♻️ <b>New Legacy begins!</b><br>All income ×${Progression.legacyMultiplier().toFixed(2)} forever.`);
      }
    });
  }

  return { mount, render };
})();
