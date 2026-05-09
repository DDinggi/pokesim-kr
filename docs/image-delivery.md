# Image Delivery

PokéSim KR card images are served from Cloudflare R2 through `img.pokesim.kr`.
The app should store image keys such as `wmimages/MEGA/M4/M4_001.png` or
`external/m4-ninja-spinner/BS2026003084.jpg`, not third-party hotlink URLs.

## Goals

1. Keep traffic cost predictable as usage grows.
2. Load card images quickly during pack and box simulation.
3. Avoid hotlinking third-party image hosts.

## Runtime Path

```txt
browser
  -> img.pokesim.kr
  -> Cloudflare cache
  -> R2 object, only on cache miss
```

The frontend resolves relative card image keys with
`NEXT_PUBLIC_CARD_IMAGE_CDN_BASE`, defaulting to `https://img.pokesim.kr/`.
Card tiles use the R2 CDN URL directly and bypass Next.js image optimization.
This avoids Worker-side image transformation during high-card-count views.

## Migration

Run from `scripts/`:

```bash
pnpm migrate-to-r2 -- --dry-run
pnpm migrate-to-r2
pnpm migrate-to-r2 -- --verify-only
```

Environment variables:

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=pokesim-kr-cards
NEXT_PUBLIC_CARD_IMAGE_CDN_BASE=https://img.pokesim.kr/
```

Behavior:

- `wmimages/...` keys are downloaded from pokemonkorea and uploaded to R2 with
  the same key.
- Absolute third-party URLs are uploaded to `external/{setCode}/{cardNum}.{ext}`
  and the set JSON is rewritten to the internal key.
- Uploaded objects use `Cache-Control: public, max-age=31536000, immutable`.
- `--verify-only` checks the public CDN URL for every referenced object.

## WebP Variants

The CDN migration removes hotlinking, but it does not shrink the original image
bytes. Generate WebP variants after originals are present in R2:

```bash
cd scripts
pnpm optimize:images -- --set m4-ninja-spinner --dry-run
pnpm optimize:images -- --set m4-ninja-spinner
pnpm optimize:images -- --set m4-ninja-spinner --verify-only
```

For all sets, omit `--set` after the single-set smoke test passes:

```bash
pnpm optimize:images -- --dry-run
pnpm optimize:images
pnpm optimize:images -- --verify-only
```

Variant keys:

```txt
cards/256/{original-key-without-extension}.webp  # pack/grid card tiles
cards/512/{original-key-without-extension}.webp  # modal/detail image
```

The original image remains at its existing key, for example
`wmimages/MEGA/M4/M4_001.png`. The frontend falls back to that original URL if a
variant is missing or fails to load.

Only enable variants after `--verify-only` passes for the target sets:

```bash
NEXT_PUBLIC_CARD_IMAGE_VARIANTS=1
```

Benchmark the variant path explicitly:

```bash
cd scripts
pnpm benchmark:images -- --set m4-ninja-spinner --samples 24 --runs 5 --new-size 256
```

## Cloudflare Settings

For `img.pokesim.kr`:

- Use an R2 custom domain, not the `r2.dev` public development URL.
- Add a Cache Rule for `img.pokesim.kr/*`:
  - Eligible for cache: on
  - Browser TTL: respect origin
  - Edge TTL: 1 month or longer
- Disable public `r2.dev` access after the custom domain is verified.

Optional hotlink rule:

```txt
hostname eq "img.pokesim.kr"
and not http.referer contains "pokesim.kr"
and http.referer ne ""
```

Action: block or managed challenge.

Keep empty referers allowed. Some browsers, privacy extensions, and messaging
apps omit the referer header, and blocking those would hurt legitimate users.

## Next Step

Run `optimize:images` for every active set, verify the public CDN URLs, then
deploy with `NEXT_PUBLIC_CARD_IMAGE_VARIANTS=1`.
