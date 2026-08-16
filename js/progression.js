/* =========================================================================
 * progression.js — Phase 3 engine: reputation, titles, achievements,
 *                  random events, boosters
 * -------------------------------------------------------------------------
 * Feeds ONE number into the economy: globalIncomeMultiplier() =
 *   reputation × achievements × active income effects
 * (engine.js applies it to every business's net income, so mechanic payouts
 * and offline earnings scale consistently).
 *
 * The Legacy (prestige) system has been removed entirely, at explicit
 * request — not just hidden. There is no reset loop anymore: player
 * level/XP, achievements, reputation and businesses just keep growing.
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

  /** Rep points: sum of completed achievements' rep. */
  function reputation() {
    let rep = 0;
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

  /** Applied by engine.js to all business net income. */
  function globalIncomeMultiplier() {
    // Luxury set bonuses (Phase 5) join the product when Assets is loaded.
    const lux = typeof Assets !== 'undefined' ? Assets.luxuryMultiplier() : 1;
    return repMultiplier() * achievementMultiplier() * lux * effectMultiplier('income');
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
    fireEvent,
    checkAchievements, tick,
  };
})();
