/* =========================================================================
 * mechanics.js — Distinct per-business mini-mechanics
 * -------------------------------------------------------------------------
 * Each mechanic is a handler keyed by `def.mechanic.type`:
 *   mult(def, s)            -> income multiplier applied by the engine
 *   tick(def, s, dt)        -> per-tick housekeeping
 *   offline(def, s, secs)   -> apply offline time
 *   panel(def, s)           -> HTML for the card's mechanic panel
 *   action(def, s, act, arg)-> handle a button press; return true if changed
 *
 * Mechanic state is stored per-business in state.businesses[id].mech, so it
 * saves/loads with everything else. Timers use wall-clock (Date.now()) so
 * projects/missions progress while the app is closed.
 *
 * A handful of GENERIC handler types cover all 14 businesses, each shaped by
 * its own def.mechanic config (tiers, project lists, node economics) rather
 * than one bespoke implementation per business.
 * ========================================================================= */

const Mechanics = (() => {
  const WALL = () => Date.now();

  /** Mechanic state bag for a business id. */
  function mState(id) {
    return getBiz(id).mech;
  }

  /** Small deterministic per-business phase offset (not shared/exported —
   * each business with a volatility flavor gets its own independent wobble). */
  function idPhase(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    return h;
  }

  /* --------------------------- Shared helpers ---------------------------- */

  /** Clamp a success chance into a sane playable band. */
  function clampChance(c, lo, hi) {
    return Math.max(lo, Math.min(hi, c));
  }

  /* --------------------------- Handlers --------------------------------- */

  const HANDLERS = {

    /* TIER PICK — choose among unlock-gated tiers (chips), each strictly
     * better than the last. Optional per-tier `volatile` flag adds a small
     * self-contained wobble (own sine cycle, not shared across businesses). */
    tierPick: {
      fuelIndex(def) {
        const t = WALL() / 1000;
        const phase = idPhase(def.id);
        return 1 + 0.15 * Math.sin(t / 130 + phase);
      },
      activeTier(def, s) {
        const tiers = def.mechanic.tiers;
        return tiers[Math.min(s.tier || 0, tiers.length - 1)];
      },
      mult(def, s) {
        const tier = this.activeTier(def, s);
        return tier.volatile ? tier.mult * this.fuelIndex(def) : tier.mult;
      },
      panel(def, s) {
        const biz = getBiz(def.id);
        const active = s.tier || 0;
        const cfg = def.mechanic;
        const chips = cfg.tiers.map((t, i) => {
          const locked = biz.level < t.requiresLevel;
          if (locked) return `<span class="chip chip-locked">🔒 ${t.name} (Lv ${t.requiresLevel})</span>`;
          return `<button class="chip ${i === active ? 'chip-active' : ''}"
            data-biz="${def.id}" data-mech-action="tier" data-arg="${i}">${t.name} ×${t.mult}</button>`;
        }).join('');
        const tier = this.activeTier(def, s);
        const wobbleNote = tier.volatile
          ? ` <span class="muted">· volatile: ×${this.fuelIndex(def).toFixed(2)} fuel index right now</span>` : '';
        return `
          <div class="mech-head">${cfg.icon} ${cfg.label}: <b>${tier.name}</b>${wobbleNote}</div>
          <div class="mech-note">Higher tiers unlock as the business grows.</div>
          <div class="chip-row">${chips}</div>`;
      },
      action(def, s, act, arg) {
        if (act !== 'tier') return false;
        const i = parseInt(arg, 10);
        const tier = def.mechanic.tiers[i];
        if (!tier || getBiz(def.id).level < tier.requiresLevel) return false;
        s.tier = i;
        return true;
      },
    },

    /* EXPANSION — pay escalating cost to add a permanent income node
     * (seller/route/gate/distribution centre/mine...). Safe, guaranteed. */
    expansion: {
      maxNodes(def) {
        return 1 + Math.floor(getBiz(def.id).level / def.mechanic.perLevels);
      },
      nodeCost(def, s) {
        const cfg = def.mechanic;
        return def.baseCost * cfg.costX * Math.pow(cfg.costGrowth, s.nodes || 0);
      },
      mult(def, s) {
        return 1 + def.mechanic.bonusPerNode * (s.nodes || 0);
      },
      panel(def, s) {
        const cfg = def.mechanic;
        const nodes = s.nodes || 0;
        const max = this.maxNodes(def);
        const cost = this.nodeCost(def, s);
        const canOpen = nodes < max && state.balance >= cost;
        return `
          <div class="mech-head">${cfg.icon} ${cfg.noun}s: <b class="gold">${nodes}/${max}</b>
            <span class="muted">· income ×${this.mult(def, s).toFixed(2)}</span></div>
          <div class="mech-note">Each ${cfg.noun.toLowerCase()} adds +${Math.round(cfg.bonusPerNode * 100)}% income forever. More slots as you level up.</div>
          <div class="chip-row"><button class="btn btn-sm ${canOpen ? 'btn-gold' : ''}"
            data-biz="${def.id}" data-mech-action="open" ${canOpen ? '' : 'disabled'}>
            ${nodes >= max ? 'Level up for more slots' : `Open ${cfg.noun} · ${formatMoney(cost)}`}</button></div>`;
      },
      action(def, s, act) {
        if (act !== 'open') return false;
        if ((s.nodes || 0) >= this.maxNodes(def)) return false;
        const cost = this.nodeCost(def, s);
        if (state.balance < cost) return false;
        state.balance -= cost;
        s.nodes = (s.nodes || 0) + 1;
        return true;
      },
    },

    /* RISKY EXPANSION — pay to explore for a permanent node; the cost is
     * spent either way, but success (chance grows with level/staff) is what
     * actually adds the node. A gamble version of `expansion`. */
    riskyExpansion: {
      maxNodes(def) {
        return 1 + Math.floor(getBiz(def.id).level / def.mechanic.perLevels);
      },
      exploreCost(def, s) {
        const cfg = def.mechanic;
        return def.baseCost * cfg.exploreCostX * Math.pow(cfg.exploreCostGrowth, s.nodes || 0);
      },
      chance(def) {
        const cfg = def.mechanic;
        const biz = getBiz(def.id);
        return clampChance(cfg.baseChance + biz.level * cfg.chancePerLevel + biz.staff * cfg.chancePerStaff, 0.1, cfg.maxChance);
      },
      mult(def, s) {
        return 1 + def.mechanic.bonusPerNode * (s.nodes || 0);
      },
      panel(def, s) {
        const cfg = def.mechanic;
        const nodes = s.nodes || 0;
        const max = this.maxNodes(def);
        const cost = this.exploreCost(def, s);
        const chance = this.chance(def);
        const canExplore = nodes < max && state.balance >= cost;
        return `
          <div class="mech-head">${cfg.icon} ${cfg.noun}s: <b class="gold">${nodes}/${max}</b>
            <span class="muted">· income ×${this.mult(def, s).toFixed(2)}</span></div>
          <div class="mech-note">${s.lastResult || `Explore for a new ${cfg.noun.toLowerCase()}: ${Math.round(chance * 100)}% chance to strike — costs ${formatMoney(cost)} either way.`}</div>
          <div class="chip-row"><button class="btn btn-sm ${canExplore ? 'btn-gold' : ''}"
            data-biz="${def.id}" data-mech-action="explore" ${canExplore ? '' : 'disabled'}>
            ${nodes >= max ? 'Level up for more slots' : `Explore · ${formatMoney(cost)} (${Math.round(chance * 100)}%)`}</button></div>`;
      },
      action(def, s, act) {
        if (act !== 'explore') return false;
        if ((s.nodes || 0) >= this.maxNodes(def)) return false;
        const cost = this.exploreCost(def, s);
        if (state.balance < cost) return false;
        state.balance -= cost;
        const cfg = def.mechanic;
        if (Math.random() < this.chance(def)) {
          s.nodes = (s.nodes || 0) + 1;
          s.lastResult = `⛏️ Strike! New ${cfg.noun.toLowerCase()} online (+${Math.round(cfg.bonusPerNode * 100)}% income).`;
        } else {
          s.lastResult = `❌ Dry hole. Nothing found this time — level up and hire staff to improve the odds.`;
        }
        return true;
      },
    },

    /* PROJECT RUN — pick one project at a time (chip), run a wall-clock
     * timer, collect a guaranteed lump payout. Optional per-project level
     * gate alongside the existing staff gate. */
    projectRun: {
      mult() { return 1; },
      panel(def, s) {
        const biz = getBiz(def.id);
        if (s.proj) {
          const done = WALL() >= s.proj.start + s.proj.mins * 60000;
          if (done) {
            const payout = businessIncomePerSec(def) * s.proj.mins * 60 * s.proj.payoutMult;
            return `
              <div class="mech-head">${def.icon} ${s.proj.name} — <b class="up">complete!</b></div>
              <div class="chip-row"><button class="btn btn-sm btn-gold" data-biz="${def.id}"
                data-mech-action="collect">Collect ${formatMoney(payout)}</button></div>`;
          }
          const left = (s.proj.start + s.proj.mins * 60000 - WALL()) / 1000;
          return `
            <div class="mech-head">${def.icon} In progress: <b>${s.proj.name}</b></div>
            <div class="mech-note">Ready in ${formatDuration(left)}</div>`;
        }
        const chips = def.mechanic.projects.map((p) => {
          const short = biz.staff < p.staffNeeded;
          const locked = biz.level < (p.requiresLevel || 0);
          const payout = businessIncomePerSec(def) * p.mins * 60 * p.payoutMult;
          if (locked) return `<span class="chip chip-locked">🔒 ${p.name} (Lv ${p.requiresLevel})</span>`;
          return `<button class="chip" data-biz="${def.id}" data-mech-action="start" data-arg="${p.id}"
            ${short ? 'disabled' : ''}>${p.name} · ${p.mins}m · ${formatMoney(payout)}${short ? ` · needs ${p.staffNeeded} staff` : ''}</button>`;
        }).join('');
        return `
          <div class="mech-head">${def.icon} ${def.mechanic.label || 'Projects'}</div>
          <div class="mech-note">Bigger projects need more staff and level, but pay more.</div>
          <div class="chip-row">${chips}</div>`;
      },
      action(def, s, act, arg) {
        if (act === 'start' && !s.proj) {
          const p = def.mechanic.projects.find((x) => x.id === arg);
          const biz = getBiz(def.id);
          if (!p || biz.staff < p.staffNeeded || biz.level < (p.requiresLevel || 0)) return false;
          s.proj = { name: p.name, mins: p.mins, payoutMult: p.payoutMult, start: WALL() };
          return true;
        }
        if (act === 'collect' && s.proj && WALL() >= s.proj.start + s.proj.mins * 60000) {
          const payout = businessIncomePerSec(def) * s.proj.mins * 60 * s.proj.payoutMult;
          addEarnings(payout);
          s.proj = null;
          return true;
        }
        return false;
      },
    },

    /* RISK PROJECT — like projectRun, but success isn't guaranteed: a roll
     * at completion (chance grows with level/staff) decides full payout vs
     * a partial consolation. Used for Space missions and Pharma trials. */
    riskProject: {
      mult() { return 1; },
      chance(def, p) {
        const biz = getBiz(def.id);
        return clampChance(p.baseChance + biz.level * 0.003 + biz.staff * 0.02, 0.15, 0.95);
      },
      panel(def, s) {
        const biz = getBiz(def.id);
        if (s.proj) {
          const done = WALL() >= s.proj.start + s.proj.mins * 60000;
          if (done) {
            const payout = businessIncomePerSec(def) * s.proj.mins * 60 * s.proj.payoutMult;
            const failPayout = payout * def.mechanic.failPayoutFrac;
            return `
              <div class="mech-head">${def.icon} ${s.proj.name} — <b class="up">outcome ready</b>
                <span class="muted">· ${Math.round(s.proj.chance * 100)}% success chance</span></div>
              <div class="mech-note">Success pays ${formatMoney(payout)} in full; a failed attempt still recovers ${formatMoney(failPayout)}.</div>
              <div class="chip-row"><button class="btn btn-sm btn-gold" data-biz="${def.id}"
                data-mech-action="collect">Resolve mission</button></div>`;
          }
          const left = (s.proj.start + s.proj.mins * 60000 - WALL()) / 1000;
          return `
            <div class="mech-head">${def.icon} Underway: <b>${s.proj.name}</b>
              <span class="muted">· ${Math.round(s.proj.chance * 100)}% success chance</span></div>
            <div class="mech-note">${s.lastResult || 'Result in'} ${formatDuration(left)}</div>`;
        }
        const chips = def.mechanic.projects.map((p) => {
          const short = biz.staff < p.staffNeeded;
          const locked = biz.level < (p.requiresLevel || 0);
          const payout = businessIncomePerSec(def) * p.mins * 60 * p.payoutMult;
          const chance = this.chance(def, p);
          if (locked) return `<span class="chip chip-locked">🔒 ${p.name} (Lv ${p.requiresLevel})</span>`;
          return `<button class="chip" data-biz="${def.id}" data-mech-action="start" data-arg="${p.id}"
            ${short ? 'disabled' : ''}>${p.name} · ${p.mins}m · ${formatMoney(payout)} · ${Math.round(chance * 100)}%${short ? ` · needs ${p.staffNeeded} staff` : ''}</button>`;
        }).join('');
        return `
          <div class="mech-head">${def.icon} ${def.mechanic.label || 'Missions'}</div>
          <div class="mech-note">Bigger missions pay more but succeed less often — level up and staff up to improve the odds.</div>
          <div class="chip-row">${chips}</div>`;
      },
      action(def, s, act, arg) {
        if (act === 'start' && !s.proj) {
          const p = def.mechanic.projects.find((x) => x.id === arg);
          const biz = getBiz(def.id);
          if (!p || biz.staff < p.staffNeeded || biz.level < (p.requiresLevel || 0)) return false;
          s.proj = { name: p.name, mins: p.mins, payoutMult: p.payoutMult, start: WALL(), chance: this.chance(def, p) };
          s.lastResult = null;
          return true;
        }
        if (act === 'collect' && s.proj && WALL() >= s.proj.start + s.proj.mins * 60000) {
          const payout = businessIncomePerSec(def) * s.proj.mins * 60 * s.proj.payoutMult;
          if (Math.random() < s.proj.chance) {
            addEarnings(payout);
            s.missionSuccesses = (s.missionSuccesses || 0) + 1;
            s.lastResult = `✅ Success! +${formatMoney(payout)}.`;
          } else {
            const consolation = payout * def.mechanic.failPayoutFrac;
            addEarnings(consolation);
            s.lastResult = `⚠️ Setback — partial recovery +${formatMoney(consolation)}.`;
          }
          s.proj = null;
          return true;
        }
        return false;
      },
    },

    /* HOSPITALITY — Hotels & Resorts: pick a room tier (guaranteed, like
     * tierPick) PLUS host an event on cooldown for a guaranteed lump sum
     * (like the old sports championship, without the win/loss roll). */
    hospitality: {
      activeTier(def, s) {
        const tiers = def.mechanic.roomTiers;
        return tiers[Math.min(s.tier || 0, tiers.length - 1)];
      },
      mult(def, s) {
        return this.activeTier(def, s).mult;
      },
      panel(def, s) {
        const biz = getBiz(def.id);
        const cfg = def.mechanic;
        const active = s.tier || 0;
        const chips = cfg.roomTiers.map((t, i) => {
          const locked = biz.level < t.requiresLevel;
          if (locked) return `<span class="chip chip-locked">🔒 ${t.name} (Lv ${t.requiresLevel})</span>`;
          return `<button class="chip ${i === active ? 'chip-active' : ''}"
            data-biz="${def.id}" data-mech-action="tier" data-arg="${i}">${t.name} ×${t.mult}</button>`;
        }).join('');
        const cdLeft = ((s.lastEvent || 0) + cfg.eventCooldownSec * 1000 - WALL()) / 1000;
        const ready = cdLeft <= 0;
        const payout = businessIncomePerSec(def) * cfg.eventPayoutSecs;
        return `
          <div class="mech-head">🏨 Rooms: <b>${this.activeTier(def, s).name}</b></div>
          <div class="chip-row">${chips}</div>
          <div class="mech-note">${s.lastResult || 'Host a wedding or conference for a one-off payout.'}</div>
          <div class="chip-row"><button class="btn btn-sm ${ready ? 'btn-gold' : ''}"
            data-biz="${def.id}" data-mech-action="event" ${ready ? '' : 'disabled'}>
            ${ready ? `Host Event · ${formatMoney(payout)}` : 'Next booking in ' + formatDuration(cdLeft)}</button></div>`;
      },
      action(def, s, act, arg) {
        if (act === 'tier') {
          const i = parseInt(arg, 10);
          const tier = def.mechanic.roomTiers[i];
          if (!tier || getBiz(def.id).level < tier.requiresLevel) return false;
          s.tier = i;
          return true;
        }
        if (act === 'event') {
          const cfg = def.mechanic;
          if (WALL() < (s.lastEvent || 0) + cfg.eventCooldownSec * 1000) return false;
          const payout = businessIncomePerSec(def) * cfg.eventPayoutSecs;
          addEarnings(payout);
          s.lastEvent = WALL();
          s.lastResult = `🎉 Event hosted! +${formatMoney(payout)}.`;
          return true;
        }
        return false;
      },
    },
  };

  /* --------------------------- Public API -------------------------------- */

  function handler(def) {
    return def.mechanic ? HANDLERS[def.mechanic.type] : null;
  }

  /** Income multiplier for the engine (1 when no mechanic). */
  function incomeMultiplier(def) {
    const h = handler(def);
    return h && h.mult ? h.mult(def, mState(def.id)) : 1;
  }

  /** Per-tick housekeeping for all running businesses. */
  function tick(dt) {
    for (const def of BUSINESS_DEFS) {
      const h = handler(def);
      if (h && h.tick && getBiz(def.id).level > 0) h.tick(def, mState(def.id), dt);
    }
  }

  /** Apply offline time (called from state.js after computing offline income). */
  function applyOffline(secs) {
    for (const def of BUSINESS_DEFS) {
      const h = handler(def);
      if (h && h.offline && getBiz(def.id).level > 0) h.offline(def, mState(def.id), secs);
    }
  }

  /** Mechanic panel HTML for a business card ('' when no mechanic). */
  function panelHTML(def) {
    const h = handler(def);
    if (!h || !h.panel) return '';
    return `<div class="mech-panel">${h.panel(def, mState(def.id))}</div>`;
  }

  /** Route a button press to the right handler. True if state changed. */
  function action(id, act, arg) {
    const def = BUSINESS_BY_ID[id];
    const h = handler(def);
    return h && h.action ? !!h.action(def, mState(def.id), act, arg) : false;
  }

  return { incomeMultiplier, tick, applyOffline, panelHTML, action };
})();
