import {book,evaluatePair,sampleBooks,validateConfig,NETWORK} from './core.mjs';
import {HTML} from './page.mjs';
const URLs={
 Coinbase:'https://api.exchange.coinbase.com/products/ETH-USD/book?level=2',
 Kraken:'https://api.kraken.com/0/public/Depth?pair=ETHUSD&count=100'
};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','access-control-allow-origin':'same-origin'}});
async function fetchJson(url,opts={}){
 const r=await fetch(url,{...opts,signal:AbortSignal.timeout(12000),
  headers:{'accept':'application/json','user-agent':'PharosArbitrageScanner/1.0 public read-only demo',...(opts.headers||{})},
  cf:{cacheTtl:0,cacheEverything:false}});
 if(!r.ok)throw Error(new URL(url).hostname+' returned HTTP '+r.status);
 const data=await r.json();
 return {data,observedAt:new Date().toISOString()};
}
async function fetchBooks(){
 const [c,k]=await Promise.all([fetchJson(URLs.Coinbase),fetchJson(URLs.Kraken)]);
 if(!c.data?.asks||!c.data?.bids)throw Error('Coinbase book unavailable; no trade');
 if(k.data?.error?.length)throw Error('Kraken API: '+k.data.error.join(', '));
 const key=Object.keys(k.data?.result||{})[0];
 if(!key)throw Error('Kraken order book unavailable; no trade');
 return [book('Coinbase',c.data.asks,c.data.bids,c.observedAt),
   book('Kraken',k.data.result[key]?.asks,k.data.result[key]?.bids,k.observedAt)];
}
async function pharos(method){
 const r=await fetchJson(NETWORK.rpc,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:[]})});
 if(r.data?.error)throw Error('Pharos RPC '+method+': '+r.data.error.message);
 if(r.data?.result==null)throw Error('Pharos RPC returned no '+method);
 return r.data.result;
}
async function liveGas(){
 const [chain,gas,block]=await Promise.all([pharos('eth_chainId'),pharos('eth_gasPrice'),pharos('eth_blockNumber')]);
 const id=Number(BigInt(chain));
 if(id!==NETWORK.chainId)throw Error('Pharos Atlantic chain ID mismatch; no trade');
 const gasWei=BigInt(gas);
 if(gasWei<=0n)throw Error('Bad Pharos gas value');
 return {chainId:id,gasPriceWei:gasWei.toString(),blockNumber:BigInt(block).toString()};
}
export default {
 async fetch(req){
  const url=new URL(req.url);
  if(req.method==='GET'&&url.pathname==='/')return new Response(HTML,{headers:{
   'content-type':'text/html;charset=UTF-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(req.method==='GET'&&url.pathname==='/api/health')return reply({ok:true,service:'arbitrage-scanner',
   network:NETWORK.name,chainId:NETWORK.chainId,marketSources:Object.keys(URLs),
   readOnly:true,liveExecution:false});
  const isLive=url.pathname==='/api/scan';
  const match=url.pathname.match(/^\/api\/demo\/(positive|negative)$/);
  if(req.method!=='POST'||(!isLive&&!match))return reply({ok:false,error:'Not found'},404);
  if(Number(req.headers.get('content-length')||0)>5000)return reply({ok:false,error:'Request too large'},413);
  let config;
  try{const body=await req.json();config=validateConfig(body?.config);}
  catch(e){return reply({ok:false,error:'Invalid configuration: '+e.message},400);}
  try{
   if(match){
    const gas={chainId:NETWORK.chainId,gasPriceWei:'10000000000',blockNumber:'DEMO_NOT_REAL'};
    const scan=evaluatePair(sampleBooks(match[1]),config,gas,{sourceMode:'SYNTHETIC_DEMO'});
    return reply({ok:true,scan});
   }
   const [books,gas]=await Promise.all([fetchBooks(),liveGas()]);
   return reply({ok:true,scan:evaluatePair(books,config,gas,{sourceMode:'LIVE'})});
  }catch(e){
   return reply({ok:false,decision:'ERROR_NO_TRADE',sourceMode:isLive?'LIVE':'SYNTHETIC_DEMO',
    error:'Scan failed closed, nothing executed: '+String(e.message).slice(0,360)},502);
  }
 }
};