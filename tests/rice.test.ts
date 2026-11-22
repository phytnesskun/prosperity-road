import assert from 'node:assert/strict';
import test from 'node:test';
import { canHold, canRent, cargoTotal, fare, maxBuy, maxSell, restoreRice, startRice, trade } from '../src/rice/model.ts';
import type { RiceAction, RiceState } from '../src/rice/model.ts';

function play(s: RiceState, ...actions: RiceAction[]): RiceState {
  for (const action of actions) {
    const before = JSON.stringify(s);
    const result = trade(s, action);
    assert.equal(result.ok, true, result.text);
    assert.equal(JSON.stringify(s), before, 'a trade cannot mutate its input snapshot');
    s = result.state;
    assert.deepEqual(restoreRice(JSON.parse(JSON.stringify(s))), s);
  }
  return s;
}

function reject(s: RiceState, action: RiceAction) {
  const result = trade(s, action);
  assert.equal(result.ok, false);
  assert.equal(result.state, s);
}
function sellEast(n: number, free = false): RiceState {
  return play(startRice(free), {type:'buy',qty:n}, {type:'sail'}, {type:'sell',qty:n});
}

test('physical stock changes at once; both public boards change together at the month boundary', () => {
  const light = sellEast(1);
  assert.deepEqual(light.warehouses, {west:3,east:5});
  assert.deepEqual(light.prices, {west:6,east:6});
  assert.deepEqual(play(light, {type:'close'}).prices, {west:7,east:5});
  assert.deepEqual(play(startRice(), {type:'close'}).prices, {west:6,east:6});
  const evening = sellEast(4);
  assert.equal(evening.cash, 26);
  assert.deepEqual(evening.warehouses, {west:0,east:8});
  const morning = play(evening, {type:'close'});
  assert.deepEqual(morning.prices, {west:9,east:4});
  const west = play(morning, {type:'buy',qty:4}, {type:'sail'}, {type:'sell',qty:4});
  assert.equal(west.cash, 44);
  assert.equal(west.paidFares, 4);
  assert.equal(west.speech, 0);
  assert.equal(west.talkBonus, 0);
  assert.equal(west.ended, false);
  assert.equal(play(west, {type:'close'}).ended, true);
  assert.equal(canRent(west), true);
  reject(west, {type:'rent',name:'<>摊'});
  const shop = play(west, {type:'rent',name:'  麦香  '});
  assert.equal(shop.stallName, '麦香');
  assert.equal(shop.cash, 36);
  reject(shop, {type:'close'});
});

test('only imported sacks fill finite orders; a cancelled or malformed offer has no ledger effect', () => {
  const first = play(startRice(), {type:'buy',qty:4});
  assert.equal(maxSell(first), 0);
  assert.equal(maxBuy(first), 0);
  reject(first, {type:'sell',qty:1,stamps:[0,0,0]});
  const east = play(first,{type:'sail'});
  assert.equal(canHold(east), false);
  reject(east, {type:'sell',qty:1,stamps:[0,0]});
  reject(east, {type:'sell',qty:0,stamps:[1,1,1]});
  reject(east, {type:'sell',qty:5});
  const practised = play(east,{type:'sell',qty:1,stamps:[0,1,2]});
  assert.equal(canHold(practised), true);
  assert.equal(practised.talkBonus, 0);
  const deal = play(practised,{type:'sell',qty:3,stamps:[2,2,2]});
  assert.equal(deal.speech, 2);
  assert.equal(deal.talkBonus, 3);
  assert.equal(deal.cash, 29);
  assert.deepEqual(deal.prices, {west:6,east:6});
  assert.equal(deal.demand.east, 0);
  reject(deal,{type:'sell',qty:1});
  const returned = play(sellEast(4), {type:'close'}, {type:'buy',qty:4}, {type:'sail'}, {type:'sell',qty:4,stamps:[1,1,1]});
  assert.equal(returned.cash, 48);
});

test('one promised ferry fare, free labor passage when broke, and voluntary closing with unsold cargo', () => {
  const gift = startRice(true);
  assert.equal(fare(gift), 0);
  const first = play(gift,{type:'sail'});
  assert.equal(first.cash, 28);
  assert.equal(first.freePass, false);
  assert.equal(fare(first), 2);
  let poor = startRice();
  for (let i=0;i<14;i++) poor=play(poor,{type:'sail'});
  assert.equal(poor.cash, 0);
  assert.equal(fare(poor), 0);
  poor = play(poor,{type:'sail'}, {type:'close'});
  assert.equal(maxBuy(poor), 0);
  assert.equal(canRent(poor), false);
  assert.equal(play(poor,{type:'close'}).ended, true);
  const stranded = play(startRice(),{type:'buy',qty:2},{type:'close'},{type:'close'});
  assert.equal(cargoTotal(stranded), 2);
  assert.equal(maxSell(stranded), 0);
  assert.equal(maxBuy(stranded), 0);
});

test('validate persisted money, goods, quotes, dates and rewards', () => {
  const s = play(sellEast(4),{type:'close'}, {type:'buy',qty:4});
  for (const bad of [null, [], {}, {...s, cash:s.cash+1}, {...s, prices:{west:6,east:6}}, {...s, paidFares:-2},
    {...s, warehouses:{west:1,east:4}}, {...s,cargo:{west:3,east:3}}, {...s, month:3}, {...s, speech:30},
    {...s, stallName:'尚未租摊'}, {...s, bank:'pier'}, {...s, freePass:'true'}]) assert.equal(restoreRice(bad),null);
  for (const qty of [-1,0,0.5,5,NaN,Infinity]) reject(startRice(),{type:'buy',qty});
});
