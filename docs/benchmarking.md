# Staging Image Benchmark

This workflow gives portfolio-friendly numbers for the image delivery change:
production or baseline uses the old third-party image host, while staging uses
the PokéSim KR image CDN on Cloudflare R2.

## 1. Deploy Staging

From `frontend/`:

```bash
pnpm build:cf
pnpm deploy:staging
```

The deploy command prints a `workers.dev` URL. Use that URL as
`--staging-site` in the benchmark.

Optional custom domain:

1. Create/verify the Cloudflare zone for `pokesim.kr`.
2. Attach `staging.pokesim.kr` to the staging Worker.
3. If managing it in code, uncomment the route example in
   `frontend/wrangler.jsonc`.

Keep production unchanged until the staging benchmark is captured.

## 2. Run The Same Benchmark

From `scripts/`:

```bash
pnpm benchmark:images -- --prod-site https://pokesim.kr --staging-site https://<staging-url> --set m4-ninja-spinner --samples 24 --runs 5
```

What it measures:

- Downloads the same `wmimages/...` card files from both hosts.
- Reports median, p75, p95, average, min, max, failures, and transferred bytes.
- Checks the production/staging Next.js bundles for old/new image CDN strings.

Default hosts:

```txt
old: https://cards.image.pokemonkorea.co.kr/data/
new: https://img.pokesim.kr/
```

Useful variants:

```bash
pnpm benchmark:images -- --samples 12 --runs 3
pnpm benchmark:images -- --set m-dream-ex --samples 24 --runs 5
pnpm benchmark:images -- --set m4-ninja-spinner --samples 24 --runs 5 --new-size 256
pnpm benchmark:images -- --prod-site https://pokesim.kr --json
```

Use `--new-size 256` after WebP variants are uploaded. Without it, the script
compares original-size files on both hosts, so R2 can look similar or slightly
slower even though the hotlinking risk is gone.

## 3. Current Local Result

Measured on 2026-05-10 KST from the local development network.

All generated variants were verified before benchmarking:

```txt
sourceImages=2538, verified=5076, missing=0, failed=0
```

Command:

```bash
pnpm benchmark:images -- --set m4-ninja-spinner --samples 24 --runs 5 --concurrency 6 --new-size 256
```

Result:

```txt
old original: median 899ms, p75 1168ms, p95 1610ms, bytes 183.1MB
new 256 WebP: median 54ms, p75 120ms, p95 187ms, bytes 2.1MB
median delta: 94.0% faster
```

Additional representative sets:

```txt
m-dream-ex
old original: median 897ms, p75 1075ms, p95 1571ms, bytes 193.7MB
new 256 WebP: median 54ms, p75 119ms, p95 156ms, bytes 2.4MB
median delta: 94.0% faster

sv8a-terastal-festa
old original: median 1238ms, p75 1389ms, p95 1726ms, bytes 240.1MB
new 256 WebP: median 56ms, p75 123ms, p95 177ms, bytes 2.6MB
median delta: 95.5% faster

sv11a-white-flare
old original: median 940ms, p75 1135ms, p95 1453ms, bytes 197.7MB
new 256 WebP: median 52ms, p75 115ms, p95 169ms, bytes 2.4MB
median delta: 94.5% faster
```

Modal/detail variant check:

```bash
pnpm benchmark:images -- --set m4-ninja-spinner --samples 24 --runs 3 --concurrency 6 --new-size 512
```

```txt
old original: median 938ms, p75 1193ms, p95 1557ms, bytes 109.9MB
new 512 WebP: median 64ms, p75 124ms, p95 211ms, bytes 4.0MB
median delta: 93.2% faster
```

## 4. Portfolio Notes

Use median and p75, not a single fastest run. Capture these conditions with the
result:

- Date and location/network.
- Sample count and run count.
- Production URL and staging URL.
- Whether both hosts were warmed by the benchmark.

Example wording:

```txt
Migrated card image delivery from third-party hotlinks to Cloudflare R2 + CDN.
Measured 24 fixed card images across 5 runs with the same benchmark script.
Median image download changed from X ms to Y ms, p75 from A ms to B ms, while
removing third-party hotlink dependency and keeping image egress predictable.
```

For a later, deeper benchmark, add a Playwright scenario that opens the
simulator, clicks "open box", and records browser resource timings for the
first 30 visible card images. The current script is intentionally smaller and
best for proving the CDN migration itself.
