# Probability Earth

A live geopolitical prediction-market terminal: Next.js, TypeScript, Tailwind, MapLibre, Recharts, and Node-managed Polymarket WebSocket connections.

## Local development

Node 22.12+ and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No wallet, trading credentials, database, or API key required.

```sh
npm test
npm run typecheck
npm run build
npm start
```

## Vercel deployment

Import `zairalaraib/probabilityearth` into Vercel as a Next.js project. The frontend and native `/api/earth/*` route handlers deploy together. No loopback backend URL or environment variables are needed. `vercel.json` uses the `iad1` region and the tested webpack build.

**Runtime model:** live server-side upstream connections run while clients maintain an HTTP event stream. Vercel Functions are time-limited, so the stream closes gracefully after four minutes; EventSource reconnects automatically. Warm instances reuse discovered state, but instances are not durable. Discovery restarts on cold instances and refreshes every five minutes during use. Failed discovery retries after 30 seconds. Last-known prices stay in the browser during reconnection.

This hosted mode replaces the original always-on Node architecture with request-scoped streaming. It provides live updates while the app is open, not a permanent background collector. It stores no durable tick history; historical charts query Polymarket directly. The standalone backend (`npm run start:backend`, `Dockerfile.backend`) remains available for a true persistent-server deployment.

## GitHub Pages option

`.github/workflows/pages.yml` can deploy a static frontend backed by the Vercel API:

1. Enable Pages with GitHub Actions as its source.
2. Set the repository Actions variable `DATA_SERVICE_URL` to `https://YOUR-VERCEL-DOMAIN/api/earth`.
3. Run the workflow. It requires a real LIVE stream with market prices before publishing. No localhost or placeholder backend is substituted.

The workflow configures the repository path automatically. `build:pages` temporarily excludes server-only route handlers during static export and restores them afterward. For a local export check:

```sh
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/probabilityearth NEXT_PUBLIC_DATA_SERVICE_URL=https://YOUR-VERCEL-DOMAIN/api/earth npm run build:pages
```

These NEXT_PUBLIC values are public URL configuration, never credentials. GitHub Pages cannot run the backend itself.

## Features and interpretation

- Locally bundled country boundaries, hover, click, zoom, reset, fullscreen
- Activity, 24-hour movement, and category map modes
- Every matching country market in a scrollable sidebar
- Search, category and country filters, rising/falling movers, volume rankings
- Browser-saved watchlist, real historical charts, one-second live-update batches
- Distinct Gamma outcome, executed trade, and bid/ask midpoint source labels
- Visible LIVE, RECONNECTING, STALE, discovery completeness, and errors
- Graphite and slate interface with clear white text, restrained blue data accents, and amber highlights

Gamma discovery uses documented keyset cursors to scan all nonclosed events, excluding inactive events, deduplicates by market ID, and excludes closed/invalid markets. Outcome labels, IDs, and prices retain their positional relationship; multi-outcome and position-ID objects are supported. Missing prices remain unavailable. Rule-based classification uses event title, market question, and tags; explicit country names and listed political aliases define associations. Description-only matches, unassociated corporate leadership contracts, and obvious sports contracts are excluded. Rules are conservative, incomplete, and not a curated intelligence feed.

A market may belong to several countries; country aggregates can overlap. The map never represents a geopolitical risk score. Moves are percentage-point differences, not percent growth. Source-provided changes are shown only when their outcome interpretation is supported. A healthy heartbeat indicates transport health; each outcome timestamp indicates price freshness. No synthetic live updates or fabricated markets are served.

## Sources

- https://gamma-api.polymarket.com/events
- https://clob.polymarket.com/prices-history
- wss://ws-subscriptions-clob.polymarket.com/ws/market
- https://docs.polymarket.com/market-data/realtime-data

Some local network requests initially returned ECONNRESET; connection errors are surfaced instead of replacing real data. Verify the deployed stream and history separately on the destination network.

Country geometry is simplified from datasets/geo-countries, using Natural Earth public-domain data. Boundaries are not a statement on sovereignty.

## Code

`app/` frontend and API routes; `components/` map and chart; `lib/` normalization, types, country rules; `server/` discovery/store/upstream management; `tests/` normalization, pagination, and WebSocket recovery. Fixtures exist only in tests.
