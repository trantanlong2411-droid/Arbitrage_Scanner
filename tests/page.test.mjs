import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {HTML} from '../src/page.mjs';
test('Dashboard exposes configuration, both data sources, scan, skip and JSON evidence export',()=>{
 for(const tag of ['id="live"','id="positive"','id="negative"','id="export"',
  'id="coinbaseFeeBps"','id="krakenFeeBps"','id="slippageReserveBps"',
  'id="minNetUsd"','id="assumedPhrsUsd"'])
  assert.ok(HTML.includes(tag),tag);
 assert.match(HTML,/SYNTHETIC_DEMO/);
 assert.match(HTML,/No wallet, private keys/);
});
test('Inline javascript syntax parses successfully',()=>{
 const script=[...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.ok(script.length);
 for(const [,body] of script)new Script(body,{filename:'scanner-inline.js'});
});
