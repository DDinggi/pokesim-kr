# Reference Price Pipeline

PokéSim KR uses `price_ref_krw` as a reference value for value-based luck scoring.
Prices are not Korean real-time market prices. They are reference prices from
allowed external APIs or manually verified sources.

## Source Policy

1. `fullahead`: default bulk source for Japanese raw-card shop prices. The
   `fetch:fullahead-prices` script maps `PK-<set>-<number>` to our set JSON.
2. `manual_jpy`: optional override for a manually verified Japanese raw-card
   reference price in JPY and the script converts it to KRW.
3. `dorasuta`: experimental direct fetch for DoraStar raw-card pages. Some shop
   pages can block script requests, so prefer `manual_jpy` after verifying the URL
   in a browser.
4. `manual`: verified KRW reference price with a source note.
5. `pokemontcgio`: fallback only. This uses PokemonTCG.io's embedded TCGplayer or
   Cardmarket prices, but North American/European set economics can diverge from
   Japanese/Korean pull-rate assumptions.

C2C marketplace crawling is not allowed. Do not scrape resale platforms.
For Japanese prices, prefer raw-card shop/list prices or buylist/sale prices from
ordinary shops such as Yuyutei, Card Rush, DoraStar, Cardshop Serra, etc. Do not use
graded slab listings for raw-card luck scoring.

## Scope

Do not try to price every card. By default, prices below `settings.min_price_ref_krw`
are skipped. The target scope is AR/CHR-ish 1,000 KRW+ hits and above.

When a verified source price is unusually low, rarity floors are applied after
currency conversion:

- AR: 1,000 KRW
- SR: 2,000 KRW
- SAR: 5,000 KRW

Bulk cards, ordinary RR/RRR, and low-value item/energy UR cards should usually remain
unpriced unless there is a clear reason to include them.

## Bulk FullAhead Import

Run this for active sets:

```bash
pnpm --dir scripts fetch:fullahead-prices -- --dry-run
pnpm --dir scripts fetch:fullahead-prices -- --force
```

Use `--set <set-code>` to limit updates. The importer reads the Japanese code from
card image paths such as `S11_118.png`, fetches the matching FullAhead category,
and applies prices from entries such as `PK-S11-118`.

## Manual Override File

`price-matches.json` stores exchange rates, Korean discount factors, rarity floors,
and optional manual overrides by our `card_num`:

```json
{
  "exchange_rates": {
    "jpy_krw": 9.5,
    "usd_krw": 1350,
    "eur_krw": 1450,
    "updated_at": "2026-06-07",
    "source": "manual config; override with PRICE_JPY_KRW / PRICE_USD_KRW / PRICE_EUR_KRW"
  },
  "settings": {
    "min_price_ref_krw": 1000,
    "jp_to_kr_estimate_factor": 0.65,
    "rarity_floor_krw": {
      "AR": 1000,
      "SR": 2000,
      "SAR": 5000
    }
  },
  "cards": {}
}
```

Manual override runs:

```bash
pnpm --dir scripts fetch:prices -- --dry-run
pnpm --dir scripts fetch:prices
```

Use `--set <set-code>` or `--card <card_num>` to limit updates. Use `--include-low`
only when deliberately including sub-1,000 KRW cards.

Japanese raw prices are not copied 1:1 into Korean estimates. The script converts
JPY to KRW and then applies `jp_to_kr_estimate_factor` because Korean singles are
usually cheaper than Japanese singles. The current default is `0.65`.

Do not generate proxy prices from rarity alone. `price_ref_krw` should come from a
verified source or a manual source-backed estimate, with the rarity floor applied only
as a minimum value.
