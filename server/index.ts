import express from "express";
import { MarketStore } from "./store";
import { Upstream } from "./upstream";
import { discover } from "./discovery";
const app = express(),
  store = new MarketStore(),
  upstream = new Upstream(store);
app.disable("x-powered-by");
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? "").split(",").map(v=>v.trim()).filter(Boolean));
app.use((req,res,next)=>{
 const origin=req.headers.origin;
 if(origin && allowedOrigins.has(origin)) {res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");}
 if(req.method==="OPTIONS"){res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");res.sendStatus(origin && !allowedOrigins.has(origin)?403:204);return;}
 next();
});
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    status: store.status,
    markets: store.markets.size,
    error: store.error,
  }),
);
app.get("/snapshot", (_req, res) => res.json(store.snapshot()));
app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  let previous = "";
  let ticks = 0;
  const send = () => {
    const current = JSON.stringify(store.snapshot());
    if (current !== previous) {
      res.write(`data: ${current}\n\n`);
      previous = current;
    } else if (++ticks % 15 === 0) res.write(": heartbeat\n\n");
  };
  send();
  const interval = setInterval(send, 1000);
  req.on("close", () => clearInterval(interval));
});
const historyCache = new Map<string, { at: number; data: unknown }>();
app.get("/history", async (req, res) => {
  const token = String(req.query.token ?? ""),
    interval = String(req.query.interval ?? "1w");
  if (
    !store.tokens.has(token) ||
    !["1d", "1w", "1m", "max"].includes(interval)
  ) {
    res.status(400).json({ error: "Unknown outcome or interval", history: [] });
    return;
  }
  const key = `${token}:${interval}`,
    cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < 60000) {
    res.json(cached.data);
    return;
  }
  try {
    const r = await fetch(
      `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(token)}&interval=${interval}&fidelity=${interval === "1d" ? 5 : 60}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) throw new Error(`History API returned ${r.status}`);
    const data = await r.json();
    historyCache.set(key, { at: Date.now(), data });
    if (historyCache.size > 300)
      historyCache.delete(historyCache.keys().next().value!);
    res.json(data);
  } catch (err) {
    res
      .status(502)
      .json({
        error: err instanceof Error ? err.message : "History unavailable",
        history: [],
      });
  }
});
let discovering = false;
async function refresh() {
  if (discovering) return;
  discovering = true;
  store.discoveryComplete = false;
  try {
    const result = await discover((markets, pages) => {
      store.pages = pages;
      for (const m of markets)
        if (!store.markets.has(m.id)) store.markets.set(m.id, m);
      store.replace([...store.markets.values()]);
      upstream.reconcile();
      if (store.tokens.size) upstream.connect();
    });
    store.replace(result.markets);
    store.pages = result.pages;
    store.discoveryComplete = true;
    store.error = null;
    upstream.reconcile();
    if (store.tokens.size) upstream.connect();
  } catch (err) {
    store.error = `Market discovery unavailable: ${err instanceof Error ? err.message : "connection failed"}`;
    if (!store.markets.size) store.status = "STALE";
    console.warn(
      store.error,
      err instanceof Error ? ((err.cause as Error)?.message ?? "") : "",
    );
  } finally {
    discovering = false;
  }
}
const port = Number(process.env.PORT ?? process.env.DATA_PORT ?? 4001);
const server = app.listen(port, process.env.HOST ?? "127.0.0.1", () => {
  console.log(`Probability Earth data service on http://127.0.0.1:${port}`);
  void refresh();
});
const refreshTimer = setInterval(() => {
  if (
    store.error ||
    !store.discoveredAt ||
    Date.now() - Date.parse(store.discoveredAt) >= 300000
  )
    void refresh();
}, 30000);
for (const sig of ["SIGTERM", "SIGINT"] as const)
  process.on(sig, () => {
    clearInterval(refreshTimer);
    upstream.stop();
    server.close(() => process.exit(0));
  });
