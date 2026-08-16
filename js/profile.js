/* =========================================================================
 * profile.js — Profile tab: title, level/XP, reputation, stats,
 *              achievements grid
 * -------------------------------------------------------------------------
 * Pure view layer over Progression + engine. Event delegation on the
 * container survives the periodic re-render (for live countdowns).
 *
 * The Legacy (prestige) system that used to have a card here has been
 * removed entirely, at explicit request.
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
    if (btn.dataset.settings !== undefined) UI.switchTab('settings');
  }

  /* ------------------------------ Render ------------------------------ */

  function render() {
    if (!container) return;
    container.innerHTML = `
      ${identityHTML()}
      <button class="settings-link" data-settings>
        <span>⚙️ Settings</span><span class="chev">›</span>
      </button>
      ${multipliersHTML()}
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
        <div class="mult-row"><span>⭐ Reputation (${Progression.reputation()} pts)</span><b>×${Progression.repMultiplier().toFixed(2)}</b></div>
        <div class="mult-row"><span>🏆 Achievements</span><b>×${Progression.achievementMultiplier().toFixed(2)}</b></div>
        <div class="mult-row"><span>💎 Luxury sets</span><b>×${Assets.luxuryMultiplier().toFixed(2)}</b></div>
        ${effectRows}
        <div class="mult-row mult-total"><span>Total</span><b class="gold">×${Progression.globalIncomeMultiplier().toFixed(2)}</b></div>
      </div>`;
  }

  /** Lifetime stats grid. */
  function statsHTML() {
    const staff = BUSINESS_DEFS.reduce((n, d) => n + getBiz(d.id).staff, 0);
    const done = ACHIEVEMENT_DEFS.filter((a) => state.achievements[a.id]).length;
    const cells = [
      ['Lifetime earned', formatMoney(state.totalEarned)],
      ['Businesses', `${usedSlots()}/${maxSlots()} slots`],
      ['Employees', formatNumber(staff)],
      ['Taps', formatNumber(state.stats.taps || 0)],
      ['Tap level', state.tapLevel],
      ['Achievements', `${done}/${ACHIEVEMENT_DEFS.length}`],
    ];
    // Tech companies under management feed net worth via their valuation.
    if (typeof TechCo !== 'undefined' && TechCo.managedCount() > 0) {
      cells.push(['Companies run', String(TechCo.managedCount())]);
      cells.push(['Empire value', formatMoney(TechCo.empireValue())]);
    }
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

  return { mount, render };
})();
