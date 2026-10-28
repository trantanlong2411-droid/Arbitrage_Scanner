# Arbitrage Scanner — Pharos Agent Arena (Hard / 200 points)

**Live demo (Git-linked Cloudflare Worker):** https://arbitrage-scanner.trantanlong2411.workers.dev/

**Repository:** https://github.com/trantanlong2411-droid/Arbitrage_Scanner

## Scope and disclosure

This is a conservative **PAPER TRADING / SIMULATED EXECUTION** scanner. It compares **two independent public ETH/USD spot order books**, Coinbase Exchange and Kraken, at approximately the same wall-clock time, computes the more favorable direction with actual order-book depth, deducts fees, slippage and Pharos Atlantic testnet gas, and only prepares a non-binding paper order if net profit exceeds a configurable threshold.

Crucially: ETH/USD markets here are on **off-chain centralized exchanges**, **not two Pharos DEX pools**. Gas from Pharos Atlantic is shown for task demonstration; it would **not be a real fee for an off-chain Coinbase/Kraken trade**. The native testnet gas token PHRS has **no claimed USD market price** here: the user must enter an **assumed PHRS/USD** to illustrate the cost. This is a what-if calculation, **NOT an executable real arbitrage opportunity**. Exchange transfers, deposit delays, account balances, funding/rebalancing, regulatory and settlement costs are excluded. Quotes are point-in-time indicative, not guaranteed fills. Trading fee assumptions are user-supplied estimates. No actual orders, swaps or blockchain transactions occur.

## Browser-exported audit proof

- [October 28 browser audit — 17 scans](./proof/README.md) from a user-submitted latest 17-scan JSON export (7 LIVE attempts, 10 synthetic demos). All 5 completed LIVE scans correctly SKIP; two Coinbase HTTP 429 errors fail closed.
- The public website now limits repeated LIVE scans with a short cooldown after each request, retaining fail-closed behavior and separate synthetic test buttons.

## Public verified evidence

- [Automated tests + actual live two-source scan](https://github.com/trantanlong2411-droid/Arbitrage_Scanner/actions/workflows/verify.yml).
- The `live-market-read` job calls the deployed `/api/scan` route, confirms provider names Coinbase/Kraken, two valid ETH/USD bid/ask books, Pharos Atlantic chain ID 688689, a positive on-chain gas quote, complete fee/slippage/gas analysis, and a risk-gated decision.
- Download artifact `verified-live-arbitrage-scan` from the most recent successful run to obtain a date-stamped `live-scan.json` (GitHub artifacts expire after 30 days).
- A recent real scan correctly returned `SKIP`. No claim is made that an arbitrage opportunity exists or that a simulated fill was executed in real markets.
- The deterministic positive demo triggers `SIMULATE` with fully labeled synthetic price sources; deterministic negative demo triggers `SKIP`. Neither is live market proof.

## Challenge mapping

| Challenge requirement | Implementation |
|---|---|
| Reads two price/rate sources in one scan | `GET https://api.exchange.coinbase.com/products/ETH-USD/book?level=2` and `GET https://api.kraken.com/0/public/Depth?pair=ETHUSD&count=100`. Both fetched concurrently server-side; source timestamps are recorded on fetch completion. |
| Net profit after fees, slippage, gas | Walk real bid/ask depth to compute executable VWAP per leg. `gross = ETH × (sellVWAP - buyVWAP)`. Subtract venue-specific buy/sell trading fees, separately configured conservative slippage buffer on both notionals, and `eth_gasPrice × gasUnits × gasMultiplier × assumed PHRS/USD`. |
| Acts only above a configurable threshold | Strict comparison `netProfitUsd > minNetUsd` prepares an explicit `PAPER_TRADE_PREPARED` in JSON. Otherwise `SKIP` and `NO_TRADE`. Real broadcast impossible. |
| Every scan logged | JSON includes timestamp, separate sources and bid/ask, observation times, direction alternatives, gross, VWAP impact, fees, slippage buffer, gas assumption, final net, decision and reason. Last 50 scans stored in browser and exportable as JSON. |
| Safe testnet or simulated | `SIMULATE` and `SKIP` only. Live data mode obtains `eth_chainId`, `eth_gasPrice`, `eth_blockNumber` from Pharos Atlantic chain 688689. Clearly labeled synthetic demonstration modes also available for deterministic passing and skipping. |

Pharos hosted MCP is read-only and on **Pharos Mainnet 1672** (https://github.com/PharosNetwork/pharos-mcp). For chain **688689 Atlantic testnet**, this web skill uses its public **read-only JSON-RPC**. Neither public quotes nor the scanner represent a Pharos DeFi arbitrage contract.

## Reviewer test instructions

1. Open the deployed website. Inputs are editable: ETH size, minimum USD net threshold, two trading fees (basis points), slippage reserve, gas units, PHRS/USD assumption, safety multiplier.
2. Select **Scan LIVE books**. The backend contacts both independently-operated providers and Pharos Atlantic RPC in the same scan. If any source fails, it reports `ERROR_NO_TRADE` and does not invent replacement data.
3. Check **two-direction comparison**. The engine compares Coinbase buy → Kraken sell with Kraken buy → Coinbase sell; uses asks to buy and bids to sell, orderbook depth for requested volume and both fees, slippage and gas.
4. With normal market prices the scan will often yield **SKIP**, which is the correct risk-conscious outcome. Increase the min threshold (e.g. $10000) to demonstrate a configurable SKIP.
5. Click **Demo: profitable** to see a *clearly labeled synthetic* positive spread with `PAPER_TRADE_PREPARED`. Click **Demo: skip** to see a *clearly labeled synthetic* negative outcome, without blockchain or real-money transactions.
6. Click **Export JSON evidence**. Each log contains sourceMode `LIVE` or `SYNTHETIC_DEMO`, source prices, calculations, testnet gas cost assumptions and reasons for `SIMULATE` or `SKIP`.

### Quantitative example (illustration only)

With `Q=1 ETH`, sell book VWAP $2100 and buy book VWAP $2000, gross spread $100. Fee in USD = buy notional × buy fee rate + sell notional × sell fee rate. Additional conservative slippage reserve = (buy notional + sell notional) × slippageReserveBps / 10,000. Pharos what-if gas USD = gasPriceWei / 10^18 × gasUnits × multiplier × assumed PHRS/USD. Net = gross - fees - slippage reserve - gas cost. Sample books are deterministic fixture data, not spot market facts.

### Error handling and integrity

- Reject malformed, crossed or empty books; underfilled depth; identical providers; invalid market config; non-positive gas; wrong Pharos chain ID.
- Fetch providers concurrently and reject observation skew beyond the configured maximum.
- No API keys, wallet prompts, smart-contract approvals, live trading or broadcasting.
- `cf.cacheTtl=0` and `cache-control: no-store` avoid persisting stale snapshots in Worker; provider-side freshness and order execution are not guaranteed.
- Live source APIs may rate-limit/geo-block Cloudflare or CI; return an error instead of silently using synthetic data.
- Missing venue funding, non-atomic execution, CEX withdrawal costs and Pharos gas mismatch make this solely educational.

## Developer and CI

```sh
npm install
npm test
npm run build-check
npx wrangler deploy
```

Git-linked Cloudflare Worker named `arbitrage-scanner`; Wrangler config is checked into the repo. Connected Cloudflare Workers Builds deploys automatically on `main` pushes.

**Endpoints**
- `GET /` — dashboard
- `GET /api/health` — read-only health metadata
- `POST /api/scan` — genuine Coinbase + Kraken books + Pharos testnet RPC, with configuration in JSON
- `POST /api/demo/positive` and `POST /api/demo/negative` — explicitly synthetic paper cases only

Sample JSON:
```json
{
  "config": {
    "quantityEth": 0.2,
    "minNetUsd": 2,
    "coinbaseFeeBps": 35,
    "krakenFeeBps": 40,
    "slippageReserveBps": 15,
    "gasUnits": 260000,
    "assumedPhrsUsd": 0.1,
    "gasMultiplier": 1.2
  }
}
```

The `SKILL.md` file documents the agent-level workflow. CI runs offline calculation tests, Worker build, deployed endpoint checks, and genuine live scan connectivity separately. Offline synthetic tests must **not** be represented as evidence of live third-party market availability.

## Official references
- [Arbitrage Scanner task](https://pharos-agent-arena.vercel.app/tasks/arbitrage-scanner)
- [Coinbase Exchange product order book](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-book)
- [Kraken REST Get Order Book](https://docs.kraken.com/api-reference/market-data/get-order-book)
- [Pharos Atlantic RPC network](https://www.alchemy.com/rpc/pharos-atlantic)
- [Pharos MCP](https://github.com/PharosNetwork/pharos-mcp)
