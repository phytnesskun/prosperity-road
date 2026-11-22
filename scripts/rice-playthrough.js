// Invoked step by step in an isolated WKWebView by harbor-smoke-mac.swift --rice.
// All state changes go through the same controls as the published game.
(() => {
  const $ = selector => document.querySelector(selector);
  const save = () => JSON.parse(localStorage.getItem('prosperity-road.rice-market.v1'));
  const remote = () => performance.getEntriesByType('resource').filter(item => /^(?:https?|wss?):/.test(item.name)).length;
  const checkpoints = [];
  const money = () => Number($('#cash').textContent.match(/-?\d+/)?.[0]);
  function assert(condition, description) {
    if (!condition) throw new Error(description + '; ' + JSON.stringify(save()) + '; ' + $('#line').textContent + '; qty=' + $('#quantity').value);
  }
  const shown = el => el && !el.disabled && el.getClientRects().length > 0;
  const frame = () => new Promise(resolve => setTimeout(resolve, 35));
  async function wait(test, description, seconds = 12) {
    const limit = performance.now() + seconds * 1000;
    while (performance.now() < limit) {
      if (test()) return;
      await frame();
    }
    throw new Error('Timed out: ' + description + '; visible=' + document.visibilityState + '; ' + JSON.stringify(save()));
  }
  async function click(selector, seconds) {
    await wait(() => shown($(selector)), selector, seconds);
    $(selector).click();
  }
  const action = (id, seconds) => click('[data-rice="' + id + '"]', seconds);
  function choose(count) {
    const el = $('#quantity');
    el.value = String(count);
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
    assert($('#quantity').value === String(count), 'selected bags: ' + count);
  }
  async function cross(bank) {
    await action('sail');
    await click('[data-cross-assist]');
    await click('[data-cross-load]', 40);
    await wait(() => $('.rice-game').dataset.bank === bank && save()?.bank === bank, 'arrive ' + bank);
  }
  async function restart() {
    await action('again');
    await action('confirm-again');
    await wait(() => $('.rice-game').dataset.bank === 'west' && money() === 28, 'restart with original balance');
  }
  function verifyMoney(amount, message) {
    assert(money() === amount && save().cash === amount, message + ': ' + amount);
    checkpoints.push({step:message, cash:amount});
  }
  function visiblePrices(west, east) {
    const s = save();
    assert(s.month === 2 && s.prices.west === west && s.prices.east === east, 'volume-dependent next-month prices');
    for (const bank of ['west','east']) {
      assert(Number($('#' + bank + '-price').textContent) === s.prices[bank], 'visible ' + bank + ' quote');
      assert(Number($('#' + bank + '-stock').textContent) === s.warehouses[bank], 'visible ' + bank + ' inventory');
    }
    assert(s.bank === $('.rice-game').dataset.bank, 'HUD and save bank agree');
    checkpoints.push({month:s.month, west, east, warehouses:s.warehouses});
  }
  async function stopWheat(from, until) {
    // Stop exactly the symbol presented to the player, without altering the clock or the reel data.
    for (let i = from; i < until; i++) {
      const reel = $('[data-seal-reel="' + i + '"]');
      const stop = $('[data-seal-stop]');
      await wait(() => {
        if (reel.dataset.symbol !== 'grain' || !shown(stop)) return false;
        stop.click();
        return true;
      }, 'grain stop on reel ' + i);
      assert(reel.dataset.stopped === 'true' && reel.dataset.symbol === 'grain', 'stopped at displayed grain');
    }
  }
  window.ricePilot = {
    async intro() {
      await wait(() => shown($('[data-rice="buy"]')) && money() === 28, 'first market ready');
      assert(document.documentElement.scrollWidth <= innerWidth + 1, 'no horizontal scroll');
      await wait(() => {
        const canvas = $('.rice-game canvas');
        if (!canvas || !canvas.width || !canvas.height) return false;
        const context = canvas.getContext('2d');
        return context && new Set(new Uint32Array(context.getImageData(30, 40, 140, 80).data.buffer)).size > 10;
      }, 'painted market');
    },
    chooseFour() { choose(4); },
    loaded() {
      const s = save();
      verifyMoney(4, 'four bags paid');
      assert(s.warehouses.west === 0 && s.cargo.west === 4, 'cargo taken from west bank');
    },
    async east() {
      const before = JSON.stringify(save());
      await action('sail'); await click('[data-cross-cancel]');
      assert(JSON.stringify(save()) === before, 'cancelling sailing preserves cash and cargo');
      await cross('east');
      verifyMoney(2, 'one ferry fare charged on arrival');
    },
    async fullMonth() {
      choose(4); await action('sell');
      verifyMoney(26, 'first trip including fare');
      assert(save().warehouses.east === 8 && save().warehouses.west === 0, 'full and empty warehouses');
      await action('month');
      visiblePrices(9, 4);
    },
    async fullReturn() {
      choose(4); await action('buy'); verifyMoney(10, 'discounted eastern grain');
      await cross('west');
      choose(4); await action('sell');
      verifyMoney(44, 'direct-price round trip');
      assert(save().speech === 0 && save().cargo.east === 0, 'no speech gained on plain sale');
    },
    async finishAndReplay() {
      await action('rent');
      const name = $('#stall-name'); name.value = '蓝帆米铺';
      name.dispatchEvent(new Event('input', {bubbles:true}));
      await action('confirm-rent');
      verifyMoney(36, 'eight coins for named stall');
      assert(save().ended && save().stallName === '蓝帆米铺', 'named stall persists');
      await restart();
      assert(save().stallName === null && save().speech === 0 && !save().ended, 'new trade resets only chapter progress');
    },
    async oneBag() {
      choose(1); await action('buy');
      await cross('east');
    },
    async sealCounter() {
      choose(1);
      const before = JSON.stringify(save());
      await action('haggle'); await click('[data-seal-cancel]');
      assert(JSON.stringify(save()) === before, 'leaving the counter preserves the same shipment');
      await action('haggle');
      await wait(() => !!$('[data-seal-reel="2"]'), 'three visible seals');
    },
    async keepFirst() {
      await stopWheat(0, 1);
      await click('[data-seal-cancel]');
      verifyMoney(20, 'cancelling after first stamp keeps goods and balance');
      assert(save().cargo.west === 1 && save().speech === 0, 'no settlement before third stamp');
    },
    async resumeSeals() {
      choose(1);
      await action('haggle');
      const first = $('[data-seal-reel="0"]');
      assert(first.dataset.stopped === 'true' && first.dataset.symbol === 'grain', 'first stamp preserved after closing and reloading');
    },
    async sealMatch() {
      await stopWheat(1, 3);
      await click('[data-seal-deal]');
      verifyMoney(27, 'one extra coin on one negotiated sack');
      assert(save().speech === 1, 'first completed negotiation earns oral skill');
    },
    async smallMonth() {
      await action('month');
      visiblePrices(7, 5);
      choose(1); await action('buy'); await cross('west');
    },
    async lockSeal() {
      choose(1); await action('haggle');
      await click('[data-seal-hold="sail"]');
      const first = $('[data-seal-reel="0"]');
      assert(first.dataset.stopped === 'true' && first.dataset.symbol === 'sail', 'skilled merchant locks a seal');
      await click('[data-seal-plain]');
      verifyMoney(27, 'take posted price on the return trip');
      assert(save().speech === 1, 'plain sale grants no additional skill');
      await action('end'); await action('confirm-end');
      assert(save().ended && !save().stallName, 'can finish without renting');
    },
    summary() {
      assert(remote() === 0, 'no remote requests');
      return {checkpoints, finalState: save(), observedRemoteRequests: remote(), visibleWallet: money(),
              horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth)};
    }
  };
  return true;
})()
