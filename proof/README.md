# User browser audit — 28 October 2026

This report summarizes a user-supplied exported JSON from the deployed Arbitrage Scanner interface. It is not an independently authenticated historical market-data archive and should be considered **browser-generated evidence**. For a reproducible, independently collected scan, see the [GitHub Actions live-market-read job](https://github.com/trantanlong2411-droid/Arbitrage_Scanner/actions/workflows/verify.yml), which uploads a separate 30-day JSON artifact.

## Summary

- 14 scans recorded between 17:31:13 and 17:32:07 UTC on 28 October 2026.
- 6 LIVE attempts: 4 SKIP (net-negative), 2 ERROR_NO_TRADE (Coinbase HTTP 429); **0 live profitable opportunities**.
- 8 SYNTHETIC_DEMO runs: 4 SIMULATE (simulated positive), 4 SKIP (simulated negative).
- No transactions were signed or broadcast, as intended.

| Case | Gross spread | Swap fees | Slippage reserve | Assumed testnet gas | Net result | Decision |
|---|---:|---:|---:|---:|---:|---|
| Live ETH/USD, 0.2 ETH | $0.024 | $6.295236 | $1.398924 | $0.000312 | -$7.670472 | SKIP |
| Synthetic demo, 0.2 ETH | $20.00 | $5.60 | $1.23 | $0.000312 | +$13.169688 | SIMULATE |
| Live Coinbase 429 | n/a | n/a | n/a | n/a | n/a | ERROR_NO_TRADE |

The testnet gas USD valuation is a **user-configured assumption**, not a market price and not an actual cost of Coinbase/Kraken orders. The code and page label this as non-executable paper-trading / educational comparison.

[Machine-readable condensed 14-scan audit summary](./browser-audit-summary-2026-10-28.json)

## Coinbase HTTP 429

Coinbase documents IP-based public API limits and HTTP 429. The Worker does not silently substitute synthetic books on a failed live source. The UI now enforces a short client-side LIVE scan cooldown; on a provider 429 response it respects a bounded server-provided retry interval when available. This reduces accidental repeated calls, but does not guarantee elimination of global IP-level limits.

See [official Coinbase API rate limits](https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits).

## How to reproduce for reviewer

1. Open [live public app](https://arbitrage-scanner.trantanlong2411.workers.dev/).
2. Run Scan LIVE books. Examine two source timestamps, VWAP, spread, fees, slippage, assumed testnet gas, net and decision.
3. Run Demo: profitable, then Demo: skip. Both use clearly labeled synthetic samples and never real trades.
4. Export JSON evidence and cross-check with [GitHub CI](https://github.com/trantanlong2411-droid/Arbitrage_Scanner/actions).

Simulation is explicitly accepted by the challenge, but the comparison across two centralized exchanges does not constitute an on-chain DEX arbitrage and may be assessed differently by reviewers.
