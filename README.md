# Probability Earth

A map-first geopolitical prediction-market terminal built with Next.js, TypeScript, Tailwind, MapLibre, Recharts, and a persistent Node.js market-data service.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The persistent data service binds to 127.0.0.1:4001. Next proxies `/api/earth/*` to it; no browser CORS workaround, API keys, wallet, or authentication required. Both processes stop together with Ctrl+C.

```sh
npm test
npm run typecheck
npm run build
npm start
```

Production builds use Next's webpack compiler for compatibility with restricted environments. Deploy both processes on a persistent Node host or container. The data service cannot be replaced by a short-lived serverless invocation. Put the frontend behind your normal HTTPS reverse proxy; the backend is loopback-only. No hosted deployment is included.

## Features

- Locally bundled country boundaries; zoom, pan, hover, country selection, fullscreen, and reset
- Activity and 24-hour movement choropleths with category and country filtering
- Country market panels with actual outcome labels, volume, liquidity, expiry, source timestamps, and Polymarket links
- Search, top movers, most active contracts, ≥5pp daily movement count, persistent browser watchlist
- Historical outcome charts with selectable timeframes
- Server-owned WebSocket subscriptions, dynamic reconciliation, 10-second PING/PONG heartbeat, stale connection detection, and exponential reconnect
- One-second SSE snapshots, retained prices across disconnects, bounded live movement feed
- Gamma discovery scans all active-event pages with limit/offset, deduplication, five-minute refresh, and visible discovery completeness

## Data integrity and interpretation

Public sources:

- https://gamma-api.polymarket.com/events
- https://clob.polymarket.com/prices-history
- wss://ws-subscriptions-clob.polymarket.com/ws/market
- https://docs.polymarket.com/market-data/realtime-data
- https://docs.polymarket.com/market-data/discover-markets

Gamma arrays are parsed positionally: labels, outcome prices, and token IDs remain aligned. A YES outcome is only labeled YES if the source says so. Multi-outcome contracts retain every outcome. Object-shaped outcomes also support position identifiers when supplied. Missing or invalid probabilities remain unavailable.

Executed trade events use the actual trade price. `price_change` and `best_bid_ask` only update the displayed midpoint when both valid best quotes exist; raw order prices are never mistaken for trades. Source labels distinguish Gamma outcome prices, executed trades, and midpoint estimates. A healthy heartbeat means the transport is live; the individual outcome timestamp indicates price freshness. There are no fabricated markets or artificial updates.

Country attribution is deliberately conservative and incomplete: explicit country names, adjectival forms, and listed political entities/leaders in event titles and market questions. Rules live in `lib/countries.ts`; a market can match several countries. Descriptions are excluded from attribution to reduce incidental references. Ambiguous terms such as Georgia are not mapped without a specific alias. Countries outside the dictionary can still be selected on the map and show no data. Unassigned geopolitical contracts remain in global lists.

Categories use ordered, transparent expressions over question, event title, tags, and description; see `lib/normalize.ts`. This heuristic is not a curated intelligence feed and may misclassify ambiguous contracts.

One-hour and daily changes come from Gamma's outcome-price change fields only when YES is the first outcome, avoiding an unsupported outcome assumption. Values are displayed in percentage points, not percentage growth. Historical charts use actual CLOB history and display unavailable states when insufficient. Volume and liquidity are source-reported contract metrics. Country aggregates can overlap because one contract may belong to several countries; global totals deduplicate by market ID.

The map displays market activity or largest absolute daily probability movement, never geopolitical risk. Market prices are not verified real-world probabilities. Countries without usable observations show no data.

## Network and verification limitations

During implementation on November 12, 2026, this environment reset direct connections to Gamma (`ECONNRESET`). The application correctly displays STALE and a discovery error instead of mock data. Live upstream probabilities and historical responses could therefore not be verified here. Discovery retries every 30 seconds after errors and refreshes every five minutes after success; run on a network where public Polymarket endpoints are reachable. No proxy or alternate data provider is silently substituted.

Local integration tests verify token-correct updates, no duplicate subscription, reconnection, resubscription, and unsubscribe using an isolated WebSocket test server. Fixtures are used only in tests and are never served by the app.

## Structure

- `app/`: Next layout and terminal UI
- `components/`: MapLibre atlas and historical chart
- `lib/`: shared types, country rules, normalization, event parsing
- `server/`: discovery, market store, WebSocket manager, HTTP/SSE endpoints
- `tests/`: data-integrity and local WebSocket integration tests

Country geometry is simplified from datasets/geo-countries, based on Natural Earth public-domain data. The map is a visualization, not a statement on sovereignty or disputed borders.

## GitHub Pages + persistent live backend

The repository includes `.github/workflows/pages.yml` and `Dockerfile.backend`. Publication still requires repository access and a separately hosted persistent backend; no deployment has been performed.

1. Run the backend container on a persistent Node/container host with HTTPS. Set `ALLOWED_ORIGINS=https://YOUR-USERNAME.github.io` (origin only, without repository path). The container listens on port 4001; a platform can override `PORT`. Do not put private credentials into public build variables.
2. Set the repository Actions variable `DATA_SERVICE_URL` to the backend's HTTPS base URL, without `/api/earth`. The backend exposes `/stream`, `/snapshot`, `/history`, and `/health`.
3. Enable GitHub Pages with GitHub Actions as the publishing source. Push to `main` or run the publication workflow. It tests the app, verifies the backend is delivering live prices, builds the static frontend, and deploys `out/`.
4. The workflow configures the repository base path from Pages metadata, so map geometry and navigation work under `username.github.io/repository/`.

For a local static export check:

```sh
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/probability-earth NEXT_PUBLIC_DATA_SERVICE_URL=https://YOUR-BACKEND.example npm run build
```

The placeholder URL above demonstrates build configuration only; it is not a working data source. Local development continues using the same-origin Next proxy. Public deployments must use the real HTTPS backend; GitHub Pages cannot run the Node service. The workflow refuses publication when that backend is missing or not live.
