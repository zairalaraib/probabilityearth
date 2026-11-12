import WebSocket from "ws";
import type { MarketStore } from "./store";
export class Upstream {
  socket: WebSocket | null = null;
  attempt = 0;
  stopped = false;
  timer: ReturnType<typeof setTimeout> | null = null;
  heartbeat: ReturnType<typeof setInterval> | null = null;
  lastReceived = 0;
  subscribed = new Set<string>();
  constructor(
    private store: MarketStore,
    private url = "wss://ws-subscriptions-clob.polymarket.com/ws/market",
  ) {}
  connect() {
    if (
      this.stopped ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    )
      return;
    this.store.status = this.attempt ? "RECONNECTING" : "CONNECTING";
    const ws = (this.socket = new WebSocket(this.url, {
      handshakeTimeout: 15000,
    }));
    ws.on("open", () => {
      this.attempt = 0;
      this.lastReceived = Date.now();
      this.subscribed.clear();
      this.reconcile(true);
      this.heartbeat = setInterval(() => {
        if (Date.now() - this.lastReceived > 45000) {
          this.store.status = "STALE";
          ws.terminate();
          return;
        }
        if (ws.readyState === WebSocket.OPEN) ws.send("PING");
      }, 10000);
    });
    ws.on("message", (raw) => {
      this.lastReceived = Date.now();
      this.store.lastMessageAt = new Date().toISOString();
      this.store.status = "LIVE";
      if (raw.toString() === "PONG") return;
      try {
        const data = JSON.parse(raw.toString());
        for (const e of Array.isArray(data) ? data : [data]) {
          if ((e.event_type ?? e.type) === "market_resolved") {
            const payload = e.payload ?? e;
            const id = payload.id;
            for (const m of this.store.markets.values())
              if (
                m.outcomes.some((o) =>
                  (
                    payload.assets_ids ??
                    payload.assetIds ??
                    payload.asset_ids ??
                    []
                  ).includes(o.tokenId),
                ) ||
                m.id === id
              )
                this.store.markets.delete(m.id);
            this.store.replace([...this.store.markets.values()]);
            this.reconcile();
          } else this.store.ingest(e);
        }
      } catch {
        /* Ignore non-JSON heartbeat frames. */
      }
    });
    ws.on("error", (err) => {
      console.warn("Upstream:", err.message);
    });
    ws.on("close", () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.subscribed.clear();
      this.socket = null;
      if (!this.stopped) {
        this.store.status = "RECONNECTING";
        const delay = Math.min(30000, 1000 * 2 ** this.attempt++);
        this.timer = setTimeout(() => this.connect(), delay);
      }
    });
  }
  reconcile(initial = false) {
    const ws = this.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const desired = new Set(this.store.tokens.keys());
    const add = [...desired].filter((id) => !this.subscribed.has(id)),
      remove = [...this.subscribed].filter((id) => !desired.has(id));
    if (initial) {
      if (desired.size)
        ws.send(
          JSON.stringify({
            assets_ids: [...desired],
            type: "market",
            custom_feature_enabled: true,
          }),
        );
    } else {
      if (remove.length)
        ws.send(
          JSON.stringify({ assets_ids: remove, operation: "unsubscribe" }),
        );
      if (add.length)
        ws.send(
          JSON.stringify({
            assets_ids: add,
            operation: "subscribe",
            custom_feature_enabled: true,
          }),
        );
    }
    this.subscribed = desired;
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.socket?.close();
  }
}
