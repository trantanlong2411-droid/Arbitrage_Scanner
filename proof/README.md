# Browser audit evidence: 17 scans (28 October 2026)

This is a condensed summary from a user-exported JSON file from the [deployed Arbitrage Scanner](https://arbitrage-scanner.trantanlong2411.workers.dev/). It is **not** an independent historical market price archive. All results are read-only paper-trade calculations with no wallet signatures.

## Latest evidence

- Original browser export: `pharos-arbitrage-scans-1793210365013.json`, exported at `2026-10-28T17:59:25.011Z`.
- SHA-256 of the original unmodified file: `0f557f467109804bc2c151c3ac25f71474c48f817d196647401817d026ebd339`. The original full JSON is held by the user; only a derived summary is committed here.
- **17 scans**: 7 LIVE (5 SKIP, 2 `ERROR_NO_TRADE`) and 10 SYNTHETIC_DEMO (5 SIMULATE, 5 SKIP).
- No positive-profit LIVE scan and no broadcast trade. Positive outcomes are distinctly labeled synthetic.
- Two Coinbase HTTP 429 rate limits occurred earlier; source failure was logged and caused no trade.

| Example | Gross spread | Exchange fees | Slippage reserve | Illustrative Pharos gas | Net | Decision |
|---|---:|---:|---:|---:|---:|---|
| LIVE, 2026-10-28 17:59:12Z | $0.116 | $3.512924 | $1.405158 | $0.000312 | -$4.802394 | SKIP |
| SYNTHETIC_DEMO, 2026-10-28 17:59:13Z | $20.000 | $3.080000 | $1.230000 | $0.000312 | +$15.689688 | SIMULATE |

`gasCostUsd` is a **testnet PHRS/USD assumption**, not the real gas fee for a centralized exchange transaction. Coinbase and Kraken provide public off-chain price books, not Pharos DEX pools.

The file is consistent with the threshold rule `netProfitUsd > minNetUsd` for SIMULATE. LIVE losses and HTTP errors correctly produce SKIP/ERROR_NO_TRADE. Coinbase documents public API IP rate-limiting and HTTP 429 ([official docs](https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits)).

[Machine-readable 17-scan summary](./browser-audit-summary-2026-10-28-1759.json)

Reviewers can independently check the **internal arithmetic and file integrity** if given the exported original file:

```sh
node scripts/verify-browser-export.mjs pharos-arbitrage-scans-1793210365013.json
```

The verifier checks SHA-256, all 17 decisions, source labels, fee/slippage/gas arithmetic, no transaction broadcast and the threshold. It does not authenticate external historical orderbook prices.

## Separate CI-verified LIVE evidence

[GitHub Actions runs](https://github.com/trantanlong2411-droid/Arbitrage_Scanner/actions/workflows/verify.yml) independently call the two live market APIs plus Pharos Atlantic testnet RPC. The latest successful `live-market-read` job uploads `verified-live-arbitrage-scan` for download. These CI artifacts are the best separate evidence of actually contacting two market sources, and are not interchangeable with synthetic demo results.

## Previous export

[14-scan summary (earlier export, preserved)](./browser-audit-summary-2026-10-28.json) — this earlier evidence was superseded by the newer 17-scan user export but remains available for auditing the progression.

## Reviewer walkthrough

Open the public website, click **Scan LIVE books**, verify the separate source quotes and decision after costs. Then use **Demo: profitable** (synthetic profitable `SIMULATE`) and **Demo: skip** (synthetic unprofitable `SKIP`), and export JSON. A missing live source must fail closed rather than switching to fake data.

The task accepts simulated execution, but reviewers may assess cross-CEX quotes differently from actual on-chain Pharos DEX arbitrage.
