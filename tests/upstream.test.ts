import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { once } from "node:events";
import { Upstream } from "../server/upstream";
import { MarketStore } from "../server/store";
import { normalizeEvent } from "../lib/normalize";
const waitUntil = async (check: () => boolean) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 5000)
      throw Error("Timed out waiting for WebSocket event");
    await new Promise((r) => setTimeout(r, 20));
  }
};
test("subscribes once, delivers prices, reconnects and restores subscriptions", async () => {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  const store = new MarketStore();
  store.replace(
    normalizeEvent(
      {
        id: "e",
        title: "Ukraine ceasefire",
        markets: [
          {
            id: "m",
            question: "Ukraine ceasefire?",
            outcomes: ["Yes", "No"],
            clobTokenIds: ["yes", "no"],
            outcomePrices: [".2", ".8"],
          },
        ],
      },
      "2020-01-01T00:00:00Z",
    ),
  );
  let connections = 0;
  const messages: any[] = [];
  server.on("connection", (socket) => {
    connections++;
    socket.on("message", (raw) => {
      if (raw.toString() === "PING") {
        socket.send("PONG");
        return;
      }
      messages.push(JSON.parse(raw.toString()));
      socket.send(
        JSON.stringify({
          event_type: "last_trade_price",
          asset_id: "yes",
          price: ".35",
          timestamp: Date.now(),
        }),
      );
    });
  });
  const upstream = new Upstream(store, `ws://127.0.0.1:${port}`);
  try {
    upstream.connect();
    await waitUntil(() => store.status === "LIVE");
    assert.equal(store.markets.get("m")?.outcomes[0].price, 0.35);
    assert.deepEqual(messages[0].assets_ids, ["yes", "no"]);
    upstream.reconcile();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(messages.length, 1);
    for (const s of server.clients) s.terminate();
    await waitUntil(() => connections === 2 && messages.length === 2);
    assert.deepEqual(messages[1].assets_ids, ["yes", "no"]);
    assert.equal(store.feed.length, 1);
    store.replace([]);
    upstream.reconcile();
    await waitUntil(() => messages.length === 3);
    assert.equal(messages[2].operation, "unsubscribe");
  } finally {
    upstream.stop();
    for (const s of server.clients) s.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
