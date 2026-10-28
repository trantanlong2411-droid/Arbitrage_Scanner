---
name: pharos-arbitrage-scanner
description: Read-only ETH/USD cross-venue paper arbitrage skill: scans Coinbase and Kraken books concurrently, factors VWAP, fees, conservative slippage and explicitly assumed Pharos Atlantic testnet gas, prepares simulation only if strictly profitable.
---
# Arbitrage Scanner

Use the deployed Cloudflare Worker `/api/scan` for market-data read and strictly simulated results. Do not claim this is an executable on-chain arbitrage or a Pharos DEX integration. The price sources are two distinct off-chain CEXs. Pharos Atlantic provides only read-only gas price/chain information in this tutorial.

For each scan:
1. Validate numeric config: ETH size > 0, minimum USD profit >= 0, venue-specific fee bps, slippage bps, gas units, gas multiplier, and explicit hypothetical PHRS/USD (not a market quote).
2. Read Coinbase Exchange ETH-USD L2 asks/bids and Kraken ETHUSD asks/bids in the same concurrent request, timestamp independently. Reject quote skew and malformed, crossed or shallow books. Never invent replacement quotes on provider failures.
3. Read `eth_chainId`, `eth_gasPrice` and `eth_blockNumber` from Pharos Atlantic Testnet; verify ID 688689.
4. For both buy/sell directions, consume real order-book depth for configured ETH quantity; compute VWAP buy cost, sell revenue, fee on both legs, additional slippage reserve, and assumed PHRS gas converted to hypothetical USD.
5. Compute `net = sellRevenue - buyCost - buyFee - sellFee - slippageReserve - assumedGasUsd`.
6. If the best viable direction `net > minNetUsd`, return `SIMULATE` and paper order preparation. Otherwise `SKIP` with explicit reason.
7. Log every completed scan and sourceMode. `SYNTHETIC_DEMO` is educational fixtures only; never represent it as real market observations.
8. There is no actual exchange execution. No transaction is signed, sent, or funded. Cross-exchange settlement economics are not fully modeled.
9. Provide `GET /api/health` and front-end export JSON for reviewer audit.
