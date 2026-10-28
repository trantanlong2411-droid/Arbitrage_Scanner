import assert from 'node:assert/strict';
const base=process.env.SCANNER_BASE_URL||'https://arbitrage-scanner.trantanlong2411.workers.dev';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function request(path,body){
 const r=await fetch(base+path,{method:body?'POST':'GET',
  headers:body?{'content-type':'application/json'}:undefined,
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(18000)});
 const obj=await r.json();
 if(!r.ok)throw Error(path+' returned '+r.status+': '+JSON.stringify(obj).slice(0,400));
 return obj;
}
let health;
for(let retry=0;retry<18;retry++){
 try{
  const r=await request('/api/health');
  if(r.ok&&r.chainId===688689&&r.marketSources?.includes('Coinbase')){health=r;break}
 }catch{}
 await delay(4000);
}
assert.equal(health?.readOnly,true,'Git-connected deployed worker not found');
const cfg={quantityEth:1,minNetUsd:5,coinbaseFeeBps:35,krakenFeeBps:40,slippageReserveBps:15,gasUnits:260000,assumedPhrsUsd:0.1,gasMultiplier:1.2};
for(const [mode,expected] of [['positive','SIMULATE'],['negative','SKIP']]){
 const r=await request('/api/demo/'+mode,{config:cfg});
 assert.equal(r.ok,true);assert.equal(r.scan.sourceMode,'SYNTHETIC_DEMO');
 assert.equal(r.scan.decision,expected);assert.equal(r.scan.transactionBroadcast,false);
 assert.equal(r.scan.priceSources.length,2);assert.equal(r.scan.alternatives.length,2);
 assert.equal(r.scan.network.chainId,688689);
 assert.ok(Number.isFinite(r.scan.best.netProfitUsd));
 assert.ok(Number.isFinite(r.scan.best.swapFeesUsd));
 assert.ok(Number.isFinite(r.scan.best.slippageReserveUsd));
 console.log('SYNTHETIC_DEMO_CASE',JSON.stringify({mode,decision:r.scan.decision,best:r.scan.best,
  reason:r.scan.reason}));
}
console.log('PUBLIC WORKER TEST SUCCESS',JSON.stringify({base,chainId:health.chainId,
  caveat:'Fixture cases are simulated and do not validate LIVE Coinbase/Kraken connectivity'}));
