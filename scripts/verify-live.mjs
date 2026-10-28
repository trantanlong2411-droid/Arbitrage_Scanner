import assert from 'node:assert/strict';
const base=process.env.SCANNER_BASE_URL||'https://arbitrage-scanner.trantanlong2411.workers.dev';
const config={quantityEth:0.2,minNetUsd:2,coinbaseFeeBps:35,krakenFeeBps:40,
 slippageReserveBps:15,gasUnits:260000,assumedPhrsUsd:0.1,gasMultiplier:1.2};
let response,last;
for(let attempt=1;attempt<=3;attempt++){
 try{
  const r=await fetch(base+'/api/scan',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({config}),signal:AbortSignal.timeout(25000)});
  response=await r.json();
  if(!r.ok||!response.ok)throw Error('LIVE API '+r.status+' '+JSON.stringify(response).slice(0,450));
  break;
 }catch(e){last=e;response=null; if(attempt<3)await new Promise(r=>setTimeout(r,4000))}
}
if(!response)throw Error('LIVE MARKET UNVERIFIED (no fixtures substituted): '+last?.message);
const s=response.scan;
assert.equal(s.sourceMode,'LIVE');assert.equal(s.transactionBroadcast,false);
assert.equal(s.network.chainId,688689);assert.ok(BigInt(s.network.gasPriceWei)>0n);
assert.deepEqual(s.priceSources.map(x=>x.name),['Coinbase','Kraken']);
assert.ok(s.priceSources.every(x=>x.bestAskUsd>x.bestBidUsd));
assert.ok(['SIMULATE','SKIP'].includes(s.decision));assert.equal(s.alternatives.length,2);
console.log('LIVE TWO-SOURCE SCAN VERIFIED',JSON.stringify({
 sourceMode:s.sourceMode,scannedAt:s.scannedAt,
 books:s.priceSources,gasPriceGwei:s.network.gasPriceGwei,
 simulated:s.simulated,decision:s.decision,
 bestDirection:s.best,quoteSkewMs:s.quoteSkewMs,
 caveat:'CEX public price quotes and testnet PHRS/USD assumption. NOT executable on-chain arbitrage.'
},null,2));
