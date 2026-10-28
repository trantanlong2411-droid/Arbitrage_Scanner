export const NETWORK={name:'Pharos Atlantic Testnet',chainId:688689,rpc:'https://atlantic.dplabs-internal.com',gasAsset:'PHRS'};
export const DEFAULTS=Object.freeze({quantityEth:0.2,minNetUsd:2,coinbaseFeeBps:35,krakenFeeBps:40,slippageReserveBps:15,gasUnits:260000,assumedPhrsUsd:0.10,gasMultiplier:1.2,maxQuoteSkewMs:12000});
const finite=(v,k,min,max)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw new Error(k+' must be between '+min+' and '+max);return n;};
export function validateConfig(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Configuration must be an object');
 const c={...DEFAULTS,...value};
 return {
  quantityEth:finite(c.quantityEth,'quantityEth',0.001,10),
  minNetUsd:finite(c.minNetUsd,'minNetUsd',0,100000),
  coinbaseFeeBps:finite(c.coinbaseFeeBps,'coinbaseFeeBps',0,1000),
  krakenFeeBps:finite(c.krakenFeeBps,'krakenFeeBps',0,1000),
  slippageReserveBps:finite(c.slippageReserveBps,'slippageReserveBps',0,1000),
  gasUnits:Math.round(finite(c.gasUnits,'gasUnits',21000,5000000)),
  assumedPhrsUsd:finite(c.assumedPhrsUsd,'assumedPhrsUsd',0.000001,10000),
  gasMultiplier:finite(c.gasMultiplier,'gasMultiplier',1,5),
  maxQuoteSkewMs:Math.round(finite(c.maxQuoteSkewMs,'maxQuoteSkewMs',1000,60000))
 };
}
function parseLevels(input,side){
 if(!Array.isArray(input)||!input.length)throw new Error('Missing '+side+' order book levels');
 const items=input.slice(0,100).map(x=>{
  if(!Array.isArray(x)||x.length<2)throw new Error('Malformed '+side+' level');
  const p=Number(x[0]),q=Number(x[1]);
  if(!Number.isFinite(p)||!Number.isFinite(q)||p<=0||q<=0)throw Error('Invalid '+side+' price/quantity');
  return {price:p,quantity:q};
 });
 items.sort((a,b)=>side==='asks'?a.price-b.price:b.price-a.price);
 return items;
}
export function book(name,asks,bids,observedAt){
 if(!['Coinbase','Kraken'].includes(name))throw Error('Unrecognized source');
 const t=new Date(observedAt).getTime();
 if(!Number.isFinite(t))throw Error('Invalid observation timestamp');
 const a=parseLevels(asks,'asks'),b=parseLevels(bids,'bids');
 if(b[0].price>=a[0].price)throw Error(name+' crossed/invalid book');
 return {source:name,pair:'ETH/USD',asks:a,bids:b,observedAt:new Date(t).toISOString(),bestAsk:a[0].price,bestBid:b[0].price};
}
export function takeLevels(levels,qty){
 let left=qty,notional=0,baseFilled=0;
 const fills=[];
 for(const l of levels){
  const size=Math.min(left,l.quantity);
  if(size<=1e-12)continue;
  notional+=size*l.price;
  baseFilled+=size;
  left-=size;
  fills.push({price:l.price,eth:size});
  if(left<=1e-10)break;
 }
 if(left>1e-9)throw Error('Insufficient order book depth for '+qty+' ETH: short '+left.toFixed(6));
 return {notional,vwap:notional/qty,filledEth:baseFilled,fills,levelsUsed:fills.length};
}
const round=(n,d=6)=>Number(n.toFixed(d));
export function evaluatePair(books,rawConfig,gas,meta={}){
 const c=validateConfig(rawConfig);
 if(!Array.isArray(books)||books.length!==2||books[0].source===books[1].source)
  throw Error('Expected exactly two independent markets');
 if(books.some(b=>b.pair!=='ETH/USD'))throw Error('Market pairs must both be ETH/USD');
 if(Number(gas?.chainId)!==NETWORK.chainId)throw Error('Wrong chain ID: fail closed');
 const gasWei=BigInt(gas.gasPriceWei);
 if(gasWei<=0n)throw Error('Invalid Pharos gas price');
 const diff=Math.abs(new Date(books[0].observedAt)-new Date(books[1].observedAt));
 if(!Number.isFinite(diff)||diff>c.maxQuoteSkewMs)throw Error('Market snapshots too far apart; refuse execution');
 const gasPhrs=Number(gasWei)*1e-18*c.gasUnits*c.gasMultiplier;
 if(!Number.isFinite(gasPhrs))throw Error('Invalid gas conversion');
 const gasUsd=gasPhrs*c.assumedPhrsUsd;
 const alternatives=books.flatMap(buy=>books.filter(sell=>sell.source!==buy.source).map(sell=>{
  try{
   const buyFill=takeLevels(buy.asks,c.quantityEth),sellFill=takeLevels(sell.bids,c.quantityEth);
   const gross=sellFill.notional-buyFill.notional;
   const buyFeeBps=buy.source==='Coinbase'?c.coinbaseFeeBps:c.krakenFeeBps;
   const sellFeeBps=sell.source==='Coinbase'?c.coinbaseFeeBps:c.krakenFeeBps;
   const buyFeeUsd=buyFill.notional*buyFeeBps/10000;
   const sellFeeUsd=sellFill.notional*sellFeeBps/10000;
   const fees=buyFeeUsd+sellFeeUsd;
   const slipReserve=(buyFill.notional+sellFill.notional)*c.slippageReserveBps/10000;
   const net=gross-fees-slipReserve-gasUsd;
   const topGross=c.quantityEth*(sell.bestBid-buy.bestAsk);
   const bookImpactUsd=topGross-gross;
   return {buyAt:buy.source,sellAt:sell.source,available:true,
    bestAskUsd:buy.bestAsk,bestBidUsd:sell.bestBid,
    buyVwapUsd:round(buyFill.vwap),sellVwapUsd:round(sellFill.vwap),
    buyNotionalUsd:round(buyFill.notional),sellNotionalUsd:round(sellFill.notional),
    topOfBookGrossUsd:round(topGross),orderBookImpactUsd:round(bookImpactUsd),
    grossSpreadUsd:round(gross),buyFeeUsd:round(buyFeeUsd),
    sellFeeUsd:round(sellFeeUsd),swapFeesUsd:round(fees),
    slippageReserveUsd:round(slipReserve),gasCostPhrs:round(gasPhrs,10),gasCostUsd:round(gasUsd),
    netProfitUsd:round(net),levelsUsed:{buy:buyFill.levelsUsed,sell:sellFill.levelsUsed}};
  }catch(e){return {buyAt:buy.source,sellAt:sell.source,available:false,reason:String(e.message)}}
 }));
 const eligible=alternatives.filter(a=>a.available).sort((a,b)=>b.netProfitUsd-a.netProfitUsd);
 const best=eligible[0]||null;
 const decision=best && best.netProfitUsd>c.minNetUsd?'SIMULATE':'SKIP';
 const why=!best?'Neither direction has sufficient executable order book depth':
 decision==='SIMULATE'?'Net profit strictly exceeds configured threshold':
 'Estimated net profit is not strictly above the threshold after fees, slippage and Pharos gas';
 return {
  schema:'pharos-arbitrage-scan-v1',decision,reason:why,
  action:decision==='SIMULATE'?'PAPER_TRADE_PREPARED':'NO_TRADE',
  simulated:true,transactionBroadcast:false,sourceMode:meta.sourceMode||'LIVE',
  scannedAt:new Date().toISOString(),pair:'ETH/USD',quantityEth:c.quantityEth,
  priceSources:books.map(b=>({name:b.source,observedAt:b.observedAt,bestBidUsd:b.bestBid,bestAskUsd:b.bestAsk,levels:{bids:b.bids.length,asks:b.asks.length}})),
  network:{...NETWORK,gasPriceWei:gasWei.toString(),gasPriceGwei:round(Number(gasWei)/1e9),blockNumber:gas.blockNumber??null},
  gasUsdAssumption:{assumedPhrsUsd:c.assumedPhrsUsd,source:'USER_DEFINED_TESTNET_ASSUMPTION_NOT_MARKET_PRICE',gasUnits:c.gasUnits,multiplier:c.gasMultiplier},
  config:c,alternatives,best,quoteSkewMs:diff,
  paperOrder:decision==='SIMULATE'?{buyVenue:best.buyAt,sellVenue:best.sellAt,
    quantityEth:c.quantityEth,estimatedCostUsd:best.buyNotionalUsd,
    estimatedRevenueUsd:best.sellNotionalUsd,estimatedNetUsd:best.netProfitUsd,
    disclaimer:'Preparation only. No order signed or broadcast; no actual arbitrage executed.'}:null
 };
}
export function sampleBooks(mode='positive',at=new Date().toISOString()){
 // Clearly fabricated synthetic fixtures. Never label as market feed data.
 if(!['positive','negative'].includes(mode))throw Error('Unknown demo mode');
 const sell=mode==='positive'?2100:2000.3;
 return [
  book('Coinbase',[[2000,10],[2002,20]],[[1998,10],[1997,20]],at),
  book('Kraken',[[sell+1,10],[sell+2,20]],[[sell,10],[sell-1,20]],at)
 ];
}
