import test from 'node:test';
import assert from 'node:assert/strict';
import {book,evaluatePair,sampleBooks,DEFAULTS,validateConfig,takeLevels} from '../src/core.mjs';
const gas={chainId:688689,gasPriceWei:'10000000000',blockNumber:'123456'};
const c={...DEFAULTS,quantityEth:1,minNetUsd:5};
test('normalizes both books and computes top of book',()=>{
 const b=book('Coinbase',[[2010,3],[2000,2]],[[1990,1],[1998,2]],new Date().toISOString());
 assert.equal(b.bestAsk,2000);assert.equal(b.bestBid,1998);
});
test('VWAP properly walks depth, not just best tick',()=>{
 const p=takeLevels([{price:100,quantity:1},{price:120,quantity:2}],2);
 assert.equal(p.notional,220);assert.equal(p.vwap,110);assert.equal(p.levelsUsed,2);
});
test('throws on insufficient depth',()=>assert.throws(()=>takeLevels([{price:1,quantity:0.2}],1),/Insufficient/));
test('positive synthetic case prepares paper order with exact accounting',()=>{
 const r=evaluatePair(sampleBooks('positive'),c,gas,{sourceMode:'SYNTHETIC_DEMO'});
 assert.equal(r.decision,'SIMULATE');assert.equal(r.simulated,true);
 assert.equal(r.paperOrder.buyVenue,'Coinbase');assert.equal(r.paperOrder.sellVenue,'Kraken');
 assert.ok(r.best.netProfitUsd>c.minNetUsd);
 assert.equal(r.best.netProfitUsd,Number((r.best.grossSpreadUsd-r.best.swapFeesUsd-r.best.slippageReserveUsd-r.best.gasCostUsd).toFixed(6)));
 assert.equal(r.transactionBroadcast,false);
});
test('negative case skips even though buy and sell prices differ',()=>{
 const r=evaluatePair(sampleBooks('negative'),c,gas,{sourceMode:'SYNTHETIC_DEMO'});
 assert.equal(r.decision,'SKIP');assert.equal(r.paperOrder,null);
});
test('huge minimum profit forces SKIP',()=>{
 const r=evaluatePair(sampleBooks('positive'),{...c,minNetUsd:10000},gas);
 assert.equal(r.decision,'SKIP');
});
test('fees and conservative slippage reserve reduce net',()=>{
 const b=sampleBooks('positive');
 const a=evaluatePair(b,{...c,coinbaseFeeBps:0,krakenFeeBps:0,slippageReserveBps:0},gas);
 const high=evaluatePair(b,{...c,coinbaseFeeBps:100,krakenFeeBps:100,slippageReserveBps:100},gas);
 assert.ok(high.best.netProfitUsd<a.best.netProfitUsd);
});
test('gas price and PHRS conversion matter',()=>{
 const b=sampleBooks('positive');
 const cheap=evaluatePair(b,c,{...gas,gasPriceWei:'1000000000'});
 const costly=evaluatePair(b,c,{...gas,gasPriceWei:'100000000000'});
 assert.ok(costly.best.netProfitUsd<cheap.best.netProfitUsd);
});
test('fails closed on wrong chain id',()=>assert.throws(()=>evaluatePair(sampleBooks('positive'),c,{...gas,chainId:1}),/Wrong chain/));
test('fails closed on stale/mismatched snapshots',()=>{
 let b=sampleBooks('positive');
 b[1].observedAt='2020-01-01T00:00:00Z';
 assert.throws(()=>evaluatePair(b,c,gas),/snapshots/);
});
test('fails closed on invalid or duplicated sources',()=>{
 const b=sampleBooks('positive');
 assert.throws(()=>evaluatePair([b[0],b[0]],c,gas),/independent/);
});
test('does not accept crossed book or non-numeric prices',()=>{
 assert.throws(()=>book('Kraken',[[1,1]],[[2,2]],new Date().toISOString()),/crossed/);
 assert.throws(()=>book('Kraken',[['NaN',1]],[[1,2]],new Date().toISOString()),/Invalid/);
});
test('config validates size and PHRS assumption',()=>{
 assert.throws(()=>validateConfig({assumedPhrsUsd:0}),/assumedPhrsUsd/);
 assert.throws(()=>validateConfig({quantityEth:0}),/quantityEth/);
 assert.equal(validateConfig({quantityEth:0.5}).quantityEth,0.5);
});
test('loudly separates synthetic fixtures from live market data',()=>{
 const r=evaluatePair(sampleBooks('positive'),c,gas,{sourceMode:'SYNTHETIC_DEMO'});
 assert.equal(r.sourceMode,'SYNTHETIC_DEMO');
 assert.equal(r.gasUsdAssumption.source,'USER_DEFINED_TESTNET_ASSUMPTION_NOT_MARKET_PRICE');
});
