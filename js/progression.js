/* =========================================================================
 * progression.js — Phase 3 engine: reputation, titles, achievements,
 *                  random events, boosters, and the Legacy (prestige) system
 * -------------------------------------------------------------------------
 * Feeds ONE number into the economy: globalIncomeMultiplier() =
 *   reputation × achievements × legacy × active income effects
 * (engine.js applies it to every business's net income, so mechanic payouts
 * and offline earnings scale consistently).
 *
 * Design note (GAME_PLAN.md problem #6): prestige here is REWARDING —
 * player level, slots, achievements and reputation are all KEPT; you get
 * +10%/point forever plus a cash head start. Only businesses, cash, tap and
 * management reset.
 * ========================================================================= */

const Progression = (() => {
  const WALL = () => Date.now();

  /* ------------------------------ Titles -------------------------------- */

  /** Highest title whose minLevel is reached. */
  function currentTitle() {
    const level = playerLevel();
    let best = TITLES[0];
    for (const t of TITLES) if (level >= t.minLevel) best = t;
    return best;
  }

  /** The next title to chase (null at max rank). */
  function nextTitle() {
    const level = playerLevel();
    for (const t of TITLES) if (level < t.minLevel) return t;
    return null;
  }

  /* ---------------------------- Reputation ------------------------------ */

  /** Rep points: sum of completed achievements' rep + 10 per Legacy reset. */
  function reputation() {
    let rep = state.prestiges * PROG.REP_PER_PRESTIGE;
    for (const a of ACHIEVEMENT_DEFS) if (state.achievements[a.id]) rep += a.rep;
    return rep;
  }

  function repMultiplier() {
    return 1 + reputation() * PROG.REP_MULT_PER_POINT;
  }

  /* --------------------------- Achievements ----------------------------- */

  /** Product of permanent multipliers from completed achievements. */
  function achievementMultiplier() {
    let mult = 1;
    for (const a of ACHIEVEMENT_DEFS) {
      if (state.achievements[a.id] && a.reward.mult) mult *= a.reward.mult;
    }
    return mult;
  }

  /** Evaluate all incomplete achievements; grant rewards + toast on unlock. */
  function checkAchievements() {
    for (const a of ACHIEVEMENT_DEFS) {
      if (state.achievements[a.id]) continue;
      let done = false;
      try { done = a.check(); } catch (e) { /* defensive: bad check never crashes */ }
      if (!done) continue;

      state.achievements[a.id] = true;
      let rewardText = `+${a.rep} rep`;
      if (a.reward.cash) {
        addEarnings(a.reward.cash);
        rewardText += ` · +${formatMoney(a.reward.cash)}`;
      }
      if (a.reward.mult) rewardText += ` · income ×${a.reward.mult} forever`;
      if (typeof UI !== 'undefined') {
        UI.showToast(`${a.icon} <b>Achievement: ${a.name}</b><br>${rewardText}`);
      }
      saveGame();
    }
  }

  /* ------------------------ Timed effects (shared) ----------------------- */
  // state.effects: [{id, name, icon, kind:'income'|'tap', mult, endsAt}]

  function activeEffects() {
    const now = WALL();
    state.effects = (state.effects || []).filter((e) => e.endsAt > now);
    return state.effects;
  }

  function addEffect(id, name, icon, kind, mult, secs) {
    activeEffects(); // prune first
    // Re-triggering the same effect refreshes it rather than stacking.
    state.effects = state.effects.filter((e) => e.id !== id);
    state.effects.push({ id, name, icon, kind, mult, endsAt: WALL() + secs * 1000 });
  }

  function effectMultiplier(kind) {
    let mult = 1;
    for (const e of activeEffects()) if (e.kind === kind) mult *= e.mult;
    return mult;
  }

  /* ------------------------ The global multiplier ------------------------ */

  function legacyMultiplier() {
    return 1 + state.legacyPoints * PROG.LEGACY_MULT_PER_POINT;
  }

  /** Applied by engine.js to all business net income. */
  function globalIncomeMultiplier() {
    return repMultiplier() * achievementMultiplier() * legacyMultiplier() * effectMultiplier('income');
  }

  /** Applied by engine.js to tap earnings ("Gone Viral" event). */
  function tapMultiplier() {
    return effectMultiplier('tap');
  }

  /* ------------------------------ Booster -------------------------------- */

  function boosterInfo() {
    const b = PROG.BOOSTER;
    const active = activeEffects().find((e) => e.id === 'booster');
    return {
      ...b,
      active: !!active,
      secsLeft: active ? (active.endsAt - WALL()) / 1000 : 0,
      ready: WALL() >= (state.boosterReadyAt || 0),
      cooldownLeft: Math.max(0, ((state.boosterReadyAt || 0) - WALL()) / 1000),
    };
  }

  function activateBooster() {
    const b = PROG.BOOSTER;
    if (WALL() < (state.boosterReadyAt || 0)) return false;
    addEffect('booster', b.name, b.icon, 'income', b.mult, b.secs);
    state.boosterReadyAt = WALL() + b.cooldownSecs * 1000;
    saveGame();
    return true;
  }

  /* ---------------------------- Random events ---------------------------- */

  function scheduleNextEvent() {
    const gap = PROG.EVENT_MIN_GAP_SEC +
      Math.random() * (PROG.EVENT_MAX_GAP_SEC - PROG.EVENT_MIN_GAP_SEC);
    state.nextEventAt = WALL() + gap * 1000;
  }

  function pickWeightedEvent() {
    const total = EVENT_DEFS.reduce((n, e) => n + e.weight, 0);
    let roll = Math.random() * total;
    for (const e of EVENT_DEFS) {
      roll -= e.weight;
      if (roll <= 0) return e;
    }
    return EVENT_DEFS[0];
  }

  /** Fire one random event NOW (also used by tests). Returns the event. */
  function fireEvent(ev) {
    ev = ev || pickWeightedEvent();
    let detail = ev.desc;

    if (ev.kind === 'incomeMult') {
      addEffect(ev.id, ev.name, ev.icon, 'income', ev.mult, ev.secs);
      detail = `${ev.desc} (${ev.secs}s)`;
    } else if (ev.kind === 'tapMult') {
      addEffect(ev.id, ev.name, ev.icon, 'tap', ev.mult, ev.secs);
      detail = `${ev.desc} (${ev.secs}s)`;
    } else if (ev.kind === 'cash') {
      const amt = Math.max(ev.minCash, totalBusinessIncomePerSec() * ev.incomeSecs);
      addEarnings(amt);
      detail = `${ev.desc} +${formatMoney(amt)}`;
    } else if (ev.kind === 'setback') {
      // Minor, capped: never more than 10% of cash on hand, skipped when broke.
      const amt = Math.min(totalBusinessIncomePerSec() * ev.incomeSecs,
        state.balance * ev.maxBalanceFrac);
      if (amt < 100) return null; // too poor to audit — skip silently
      state.balance -= amt;       // a loss, not negative earnings
      detail = `${ev.desc} −${formatMoney(amt)}`;
    }

    if (typeof UI !== 'undefined') {
      UI.showToast(`${ev.icon} <b>${ev.name}</b><br>${detail}`, { tone: ev.kind === 'setback' ? 'bad' : 'good' });
    }
    saveGame();
    return ev;
  }

  function maybeFireEvent() {
    if (!state.nextEventAt) { scheduleNextEvent(); return; }
    if (WALL() < state.nextEventAt) return;
    // Only while the app is actually being played.
    if (typeof document !== 'undefined' && document.hidden) return;
    fireEvent();
    scheduleNextEvent();
  }

  /* ----------------------------- Legacy reset ---------------------------- */

  /** Legacy points a reset would grant right now. */
  function legacyGain() {
    return Math.floor(Math.sqrt((state.runEarned || 0) / PROG.LEGACY_DIVISOR));
  }

  /** Run earnings needed for the NEXT legacy point (for the preview UI). */
  function nextLegacyPointAt() {
    const next = legacyGain() + 1;
    return next * next * PROG.LEGACY_DIVISOR;
  }

  /**
   * Perform the Legacy reset.
   * KEEPS: player level/XP (and therefore slots), titles, achievements,
   *        reputation, legacy points, lifetime stats.
   * RESETS: businesses, cash (to a head-start amount), tap level, management.
   */
  function doPrestige() {
    const gain = legacyGain();
    if (gain < 1) return false;

    state.legacyPoints += gain;
    state.prestiges += 1;
    state.businesses = {};
    state.tapLevel = 1;
    state.managementLevel = 0;
    state.effects = [];
    state.runEarned = 0;
    state.boosterReadyAt = 0;
    state.balance = PROG.PRESTIGE_BASE_CASH + PROG.PRESTIGE_CASH_PER_POINT * state.legacyPoints;
    saveGame();
    return true;
  }

  /* ------------------------------- Tick ---------------------------------- */

  let _lastAchCheck = 0;

  /** Called from engine.tick(): events + throttled achievement checks. */
  function tick() {
    maybeFireEvent();
    const now = performance.now();
    if (now - _lastAchCheck > 2000) {
      _lastAchCheck = now;
      checkAchievements();
    }
  }

  return {
    currentTitle, nextTitle,
    reputation, repMultiplier, achievementMultiplier,
    activeEffects, effectMultiplier, globalIncomeMultiplier, tapMultiplier,
    boosterInfo, activateBooster,
    fireEvent, legacyGain, nextLegacyPointAt, legacyMultiplier, doPrestige,
    checkAchievements, tick,
  };
})();
