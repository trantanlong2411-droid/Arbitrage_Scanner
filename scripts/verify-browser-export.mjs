import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import expected from '../proof/browser-audit-summary-2026-10-28-1759.json' with {type:'json'};
const p=process.argv[2];
if(!p){console.error('Usage: node scripts/verify-browser-export.mjs /path/to/pharos-arbitrage-scans-1793210365013.json');process.exit(2)}
const bytes=fs.readFileSync(p);
const sha=createHash('sha256').update(bytes).digest('hex');
assert.equal(sha,expected.rawFileSHA256,'This is not the same immutable user-exported JSON source');
const file=JSON.parse(bytes.toString('utf8'));
assert.equal(file.project,'Pharos Arbitrage Scanner');
assert.equal(file.exportedAt,expected.originalExportedAt);
assert.equal(file.scans.length,expected.scanCount);
const cross={LIVE:{SIMULATE:0,SKIP:0,ERROR_NO_TRADE:0},SYNTHETIC_DEMO:{SIMULATE:0,SKIP:0,ERROR_NO_TRADE:0}};
let validated=0;
for(const [i,scan] of file.scans.entries()){
 assert.ok(Object.hasOwn(cross,scan.sourceMode),'unexpected source mode');
 assert.ok(Object.hasOwn(cross[scan.sourceMode],scan.decision),'unexpected decision');
 cross[scan.sourceMode][scan.decision]++;
 const compact=expected.records[i];
 assert.equal(scan.scannedAt,compact.scannedAt);
 assert.equal(scan.sourceMode,compact.sourceMode);
 assert.equal(scan.decision,compact.decision);
 assert.equal(scan.best?.netProfitUsd??null,compact.bestNetUsd);
 assert.equal(scan.transactionBroadcast,false,'no actual trade may be claimed');
 if(scan.decision==='ERROR_NO_TRADE'){
   assert.equal(scan.action,'NO_TRADE');
   assert.equal(scan.best,null);
   continue;
 }
 assert.ok(scan.best);
 const a=scan.best;
 const residual=a.grossSpreadUsd-a.swapFeesUsd-a.slippageReserveUsd-a.gasCostUsd-a.netProfitUsd;
 assert.ok(Math.abs(residual)<0.00001,'profit formula mismatch in scan '+i);
 assert.equal(scan.priceSources.length,2);
 assert.equal(scan.network.chainId,688689);
 assert.ok(scan.quoteSkewMs <= scan.config.maxQuoteSkewMs);
 if(scan.decision==='SIMULATE'){
   assert.equal(scan.sourceMode,'SYNTHETIC_DEMO','positive scan must not be passed off as live historical trade');
   assert.ok(scan.best.netProfitUsd>scan.config.minNetUsd);
   assert.equal(scan.action,'PAPER_TRADE_PREPARED');
   assert.ok(scan.paperOrder);
 }else{
   assert.equal(scan.action,'NO_TRADE');
   assert.ok(scan.best.netProfitUsd <= scan.config.minNetUsd);
 }
 validated++;
}
assert.deepEqual(cross,expected.crossTab);
console.log(JSON.stringify({result:'PASS',sourceSHA256:sha,scans:file.scans.length,validProfitRows:validated,crossTab:cross,
  caveat:'Verified internal consistency of user-exported browser JSON; not external proof that past quotes were genuine or executable.'},null,2));
