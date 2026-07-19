/* =========================================================================
 * mechanics.js — Distinct per-business mini-mechanics (Phase 2)
 * -------------------------------------------------------------------------
 * Each mechanic is a handler keyed by `def.mechanic.type`:
 *   mult(def, s)            -> income multiplier applied by the engine
 *   tick(def, s, dt)        -> per-tick housekeeping (e.g. vault interest)
 *   offline(def, s, secs)   -> apply offline time (e.g. compound interest)
 *   panel(def, s)           -> HTML for the card's mechanic panel
 *   action(def, s, act, arg)-> handle a button press; return true if changed
 *
 * Mechanic state is stored per-business in state.businesses[id].mech, so it
 * saves/loads with everything else. Timers use wall-clock (Date.now()) so
 * projects/builds progress while the app is closed.
 * ========================================================================= */

const Mechanics = (() => {
  const WALL = () => Date.now();

  /** Mechanic state bag for a business id. */
  function mState(id) {
    return getBiz(id).mech;
  }

  /* ---------------- Shared market simulations (deterministic) ----------- */

  /**
   * Oil price factor ~0.35..1.8, a smooth deterministic cycle of wall time.
   * Deterministic = consistent across reloads, no state to save.
   */
  function oilPrice(offsetSec = 0) {
    const t = WALL() / 1000 - offsetSec;
    const p = 1.1 + 0.45 * Math.sin(t / 149) + 0.25 * Math.sin(t / 47 + 2);
    return Math.max(0.35, p);
  }

  // Fashion trends rotate on a fixed wall-clock schedule.
  const TREND_STYLES = ['🧢 Streetwear', '👔 Formal', '🕰️ Vintage', '🏃 Athletic'];

  function trendIndex(def) {
    const period = def.mechanic.periodMin * 60 * 1000;
    return Math.floor(WALL() / period) % TREND_STYLES.length;
  }

  function trendSecsLeft(def) {
    const period = def.mechanic.periodMin * 60 * 1000;
    return (period - (WALL() % period)) / 1000;
  }

  /* --------------------------- Handlers --------------------------------- */

  const HANDLERS = {

    /* BANK — deposit cash: vault earns interest AND boosts bank income. */
    interest: {
      ratePerSec(def) {
        return Math.pow(1 + def.mechanic.ratePerHour, 1 / 3600) - 1;
      },
      mult(def, s) {
        return 1 + Math.min(1, (s.vault || 0) / (def.baseCost * def.mechanic.vaultTargetX));
      },
      tick(def, s, dt) {
        if (s.vault) s.vault *= Math.pow(1 + this.ratePerSec(def), dt);
      },
      offline(def, s, secs) {
        if (s.vault) s.vault *= Math.pow(1 + this.ratePerSec(def), secs);
      },
      panel(def, s) {
        const vault = s.vault || 0;
        const boost = this.mult(def, s);
        return `
          <div class="mech-head">🏦 Vault: <b class="gold">${formatMoney(vault)}</b>
            <span class="muted">· ${Math.round(def.mechanic.ratePerHour * 100)}%/hr interest</span></div>
          <div class="mech-note">Deposits boost bank income (now ×${boost.toFixed(2)}, max ×2)</div>
          <div class="chip-row">
            <button class="btn btn-sm" data-biz="${def.id}" data-mech-action="deposit" data-arg="0.25">Deposit 25%</button>
            <button class="btn btn-sm" data-biz="${def.id}" data-mech-action="deposit" data-arg="0.5">Deposit 50%</button>
            <button class="btn btn-sm" data-biz="${def.id}" data-mech-action="withdraw" ${vault > 0 ? '' : 'disabled'}>Withdraw all</button>
          </div>`;
      },
      action(def, s, act, arg) {
        if (act === 'deposit') {
          const amt = state.balance * parseFloat(arg);
          if (amt <= 0) return false;
          state.balance -= amt;
          s.vault = (s.vault || 0) + amt;
          return true;
        }
        if (act === 'withdraw' && s.vault > 0) {
          state.balance += s.vault;
          s.vault = 0;
          return true;
        }
        return false;
      },
    },

    /* TRANSPORT — pick a route; fuel cost moves against the oil price. */
    routes: {
      fuelFactor() {
        return Math.min(1.25, Math.max(0.8, 1.45 - 0.35 * oilPrice()));
      },
      mult(def, s) {
        const route = def.mechanic.routes[s.route || 0];
        return route.mult * this.fuelFactor();
      },
      panel(def, s) {
        const biz = getBiz(def.id);
        const active = s.route || 0;
        const fuel = this.fuelFactor();
        const chips = def.mechanic.routes.map((r, i) => {
          const locked = biz.level < r.requiresLevel;
          if (locked) return `<span class="chip chip-locked">🔒 ${r.name} (Lv ${r.requiresLevel})</span>`;
          return `<button class="chip ${i === active ? 'chip-active' : ''}"
            data-biz="${def.id}" data-mech-action="route" data-arg="${i}">${r.name} ×${r.mult}</button>`;
        }).join('');
        return `
          <div class="mech-head">🗺️ Route: <b>${def.mechanic.routes[active].name}</b>
            <span class="muted">· fuel index ×${fuel.toFixed(2)}</span></div>
          <div class="mech-note">Fuel gets cheap when oil is cheap — watch the market.</div>
          <div class="chip-row">${chips}</div>`;
      },
      action(def, s, act, arg) {
        if (act !== 'route') return false;
        const i = parseInt(arg, 10);
        const route = def.mechanic.routes[i];
        if (!route || getBiz(def.id).level < route.requiresLevel) return false;
        s.route = i;
        return true;
      },
    },

    /* OIL & GAS — income rides the live commodity price. */
    commodity: {
      mult() {
        return oilPrice();
      },
      panel() {
        const p = oilPrice();
        const prev = oilPrice(30); // 30s ago, to show direction
        const arrow = p >= prev ? '<span class="up">▲ rising</span>' : '<span class="down">▼ falling</span>';
        return `
          <div class="mech-head">🛢️ Oil price: <b class="gold">×${p.toFixed(2)}</b> ${arrow}</div>
          <div class="mech-note">Income multiplies by the market price. Ride the highs.</div>`;
      },
    },

    /* IT COMPANY — run one software project at a time for a lump payout. */
    projects: {
      mult() { return 1; },
      panel(def, s) {
        const biz = getBiz(def.id);
        if (s.proj) {
          const done = WALL() >= s.proj.start + s.proj.mins * 60000;
          if (done) {
            const payout = businessIncomePerSec(def) * s.proj.mins * 60 * s.proj.payoutMult;
            return `
              <div class="mech-head">💻 ${s.proj.name} — <b class="up">shipped!</b></div>
              <div class="chip-row"><button class="btn btn-sm btn-gold" data-biz="${def.id}"
                data-mech-action="collect">Collect ${formatMoney(payout)}</button></div>`;
          }
          const left = (s.proj.start + s.proj.mins * 60000 - WALL()) / 1000;
          return `
            <div class="mech-head">💻 Building: <b>${s.proj.name}</b></div>
            <div class="mech-note">Ships in ${formatDuration(left)}</div>`;
        }
        const chips = def.mechanic.projects.map((p) => {
          const short = biz.staff < p.staffNeeded;
          const payout = businessIncomePerSec(def) * p.mins * 60 * p.payoutMult;
          return `<button class="chip" data-biz="${def.id}" data-mech-action="start" data-arg="${p.id}"
            ${short ? 'disabled' : ''}>${p.name} · ${p.mins}m · ${formatMoney(payout)}${short ? ` · needs ${p.staffNeeded} staff` : ''}</button>`;
        }).join('');
        return `
          <div class="mech-head">💻 Software projects</div>
          <div class="mech-note">Bigger projects need more staff and pay more per minute.</div>
          <div class="chip-row">${chips}</div>`;
      },
      action(def, s, act, arg) {
        if (act === 'start' && !s.proj) {
          const p = def.mechanic.projects.find((x) => x.id === arg);
          if (!p || getBiz(def.id).staff < p.staffNeeded) return false;
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

    /* CONSTRUCTION — buy materials, wait out the build, deliver for profit. */
    construction: {
      mult() { return 1; },
      materialsCost(def) {
        return Math.max(500, businessIncomePerSec(def) * def.mechanic.materialsSecs);
      },
      panel(def, s) {
        const cfg = def.mechanic;
        if (s.job) {
          const end = s.job.start + cfg.buildMin * 60000;
          if (WALL() >= end) {
            return `
              <div class="mech-head">🏗️ Project <b class="up">complete!</b></div>
              <div class="chip-row"><button class="btn btn-sm btn-gold" data-biz="${def.id}"
                data-mech-action="deliver">Deliver ${formatMoney(s.job.materials * cfg.payoutMult)}</button></div>`;
          }
          return `
            <div class="mech-head">🏗️ Building…</div>
            <div class="mech-note">Delivers ${formatMoney(s.job.materials * cfg.payoutMult)} in ${formatDuration((end - WALL()) / 1000)}</div>`;
        }
        const cost = this.materialsCost(def);
        return `
          <div class="mech-head">🏗️ Construction project</div>
          <div class="mech-note">Buy materials, build ${cfg.buildMin} min, deliver for ×${cfg.payoutMult}.</div>
          <div class="chip-row"><button class="btn btn-sm ${state.balance >= cost ? 'btn-gold' : ''}"
            data-biz="${def.id}" data-mech-action="build" ${state.balance >= cost ? '' : 'disabled'}>
            Materials ${formatMoney(cost)} → ${formatMoney(cost * cfg.payoutMult)}</button></div>`;
      },
      action(def, s, act) {
        const cfg = def.mechanic;
        if (act === 'build' && !s.job) {
          const cost = this.materialsCost(def);
          if (state.balance < cost) return false;
          state.balance -= cost;
          s.job = { start: WALL(), materials: cost };
          return true;
        }
        if (act === 'deliver' && s.job && WALL() >= s.job.start + cfg.buildMin * 60000) {
          const payout = s.job.materials * cfg.payoutMult;
          addEarnings(payout);
          s.job = null;
          return true;
        }
        return false;
      },
    },

    /* CLOTHING — match the rotating fashion trend for x2, miss for x0.75. */
    trends: {
      mult(def, s) {
        return (s.line || 0) === trendIndex(def) ? def.mechanic.matchMult : def.mechanic.missMult;
      },
      panel(def, s) {
        const now = trendIndex(def);
        const line = s.line || 0;
        const match = line === now;
        const chips = TREND_STYLES.map((name, i) =>
          `<button class="chip ${i === line ? 'chip-active' : ''}"
            data-biz="${def.id}" data-mech-action="line" data-arg="${i}">${name}</button>`).join('');
        return `
          <div class="mech-head">✨ Trend now: <b>${TREND_STYLES[now]}</b>
            <span class="muted">· changes in ${formatDuration(trendSecsLeft(def))}</span></div>
          <div class="mech-note">Your line: ${TREND_STYLES[line]} —
            ${match ? '<span class="up">on trend ×' + def.mechanic.matchMult + '</span>'
                    : '<span class="down">off trend ×' + def.mechanic.missMult + '</span>'}</div>
          <div class="chip-row">${chips}</div>`;
      },
      action(def, s, act, arg) {
        if (act !== 'line') return false;
        s.line = parseInt(arg, 10) % TREND_STYLES.length;
        return true;
      },
    },

    /* SPORTS CLUB — play matches, win fans, land championship sponsorships. */
    sports: {
      mult(def, s) {
        const cfg = def.mechanic;
        return Math.min(cfg.maxFanMult, 1 + (s.fans || 0) / cfg.fansDivisor);
      },
      winChance(def) {
        const biz = getBiz(def.id);
        return Math.min(0.75, 0.45 + biz.level * 0.004 + biz.staff * 0.01);
      },
      panel(def, s) {
        const cfg = def.mechanic;
        const cdLeft = ((s.lastMatch || 0) + cfg.cooldownSec * 1000 - WALL()) / 1000;
        const ready = cdLeft <= 0;
        const untilChamp = cfg.winsPerChampionship - ((s.wins || 0) % cfg.winsPerChampionship);
        return `
          <div class="mech-head">🏟️ Fans: <b class="gold">${formatNumber(s.fans || 0)}</b>
            <span class="muted">· income ×${this.mult(def, s).toFixed(2)} · ${s.wins || 0}W</span></div>
          <div class="mech-note">${s.lastResult || 'Win matches to grow the fanbase.'}
            Championship in ${untilChamp} more win${untilChamp === 1 ? '' : 's'} → sponsorship payout.</div>
          <div class="chip-row"><button class="btn btn-sm ${ready ? 'btn-gold' : ''}"
            data-biz="${def.id}" data-mech-action="play" ${ready ? '' : 'disabled'}>
            ${ready ? `Play Match (${Math.round(this.winChance(def) * 100)}% win)` : 'Next match in ' + formatDuration(cdLeft)}</button></div>`;
      },
      action(def, s, act) {
        const cfg = def.mechanic;
        if (act !== 'play') return false;
        if (WALL() < (s.lastMatch || 0) + cfg.cooldownSec * 1000) return false;
        s.lastMatch = WALL();
        const biz = getBiz(def.id);
        if (Math.random() < this.winChance(def)) {
          s.wins = (s.wins || 0) + 1;
          const gained = cfg.fansPerWin + biz.level;
          s.fans = (s.fans || 0) + gained;
          s.lastResult = `🏆 WIN! +${formatNumber(gained)} fans.`;
          if (s.wins % cfg.winsPerChampionship === 0) {
            const lump = businessIncomePerSec(def) * cfg.sponsorSecs;
            addEarnings(lump);
            s.lastResult = `🏆 CHAMPIONSHIP! Sponsorship deal: +${formatMoney(lump)}.`;
          }
        } else {
          s.lastResult = '❌ Lost. Level up and hire staff to raise your win chance.';
        }
        return true;
      },
    },

    /* AIRLINE — open escalatingly-priced routes; each adds permanent income. */
    airline: {
      maxRoutes(def) {
        return 1 + Math.floor(getBiz(def.id).level / 10);
      },
      routeCost(def, s) {
        const cfg = def.mechanic;
        return def.baseCost * cfg.routeCostX * Math.pow(cfg.routeCostGrowth, s.routes || 0);
      },
      mult(def, s) {
        return 1 + def.mechanic.routeBonus * (s.routes || 0);
      },
      panel(def, s) {
        const routes = s.routes || 0;
        const max = this.maxRoutes(def);
        const cost = this.routeCost(def, s);
        const canOpen = routes < max && state.balance >= cost;
        return `
          <div class="mech-head">✈️ Routes: <b class="gold">${routes}/${max}</b>
            <span class="muted">· income ×${this.mult(def, s).toFixed(2)}</span></div>
          <div class="mech-note">Each route adds +${Math.round(def.mechanic.routeBonus * 100)}% income forever. More slots every 10 levels.</div>
          <div class="chip-row"><button class="btn btn-sm ${canOpen ? 'btn-gold' : ''}"
            data-biz="${def.id}" data-mech-action="open" ${canOpen ? '' : 'disabled'}>
            ${routes >= max ? 'Level up for more slots' : 'Open Route ' + formatMoney(cost)}</button></div>`;
      },
      action(def, s, act) {
        if (act !== 'open') return false;
        if ((s.routes || 0) >= this.maxRoutes(def)) return false;
        const cost = this.routeCost(def, s);
        if (state.balance < cost) return false;
        state.balance -= cost;
        s.routes = (s.routes || 0) + 1;
        return true;
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

  // oilPrice is exported so the Market (Phase 4 Crude Oil asset) can share
  // the exact same price cycle the Oil & Gas / Transport businesses use.
  return { incomeMultiplier, tick, applyOffline, panelHTML, action, oilPrice };
})();
