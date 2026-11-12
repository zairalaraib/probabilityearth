import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEvent, parsePriceEvent } from "../lib/normalize";
import { classifyCountries } from "../lib/countries";
import { MarketStore } from "../server/store";
const event = {
  id: "e1",
  title: "Taiwan election",
  slug: "taiwan-election",
  markets: [
    {
      id: "m1",
      question: "Will Taiwan hold an election?",
      active: true,
      outcomes: '["No","Yes"]',
      outcomePrices: '["0.7","0.3"]',
      clobTokenIds: '["n","y"]',
      oneDayPriceChange: 0.1,
    },
  ],
};
test("outcome labels and token IDs remain aligned when YES is second", () => {
  const m = normalizeEvent(event)[0];
  assert.equal(m.outcomes[1].label, "Yes");
  assert.equal(m.outcomes[1].tokenId, "y");
  assert.equal(m.outcomes[1].price, 0.3);
  assert.equal(m.change24h, null);
});
test("handles multi-outcome contracts without labeling the first YES", () => {
  const m = normalizeEvent({
    ...event,
    markets: [
      {
        ...event.markets[0],
        outcomes: ["A", "B", "C"],
        clobTokenIds: ["a", "b", "c"],
        outcomePrices: [".2", ".3", ".5"],
      },
    ],
  })[0];
  assert.equal(m.outcomes.length, 3);
  assert.equal(m.outcomes[0].label, "A");
  assert.equal(m.change24h, null);
});
test("excludes closed and malformed markets", () => {
  assert.equal(normalizeEvent({ ...event, closed: true }).length, 0);
  assert.equal(
    normalizeEvent({
      ...event,
      markets: [{ ...event.markets[0], clobTokenIds: "[]" }],
    }).length,
    0,
  );
});
test("classification matches country boundaries and multiple participants", () => {
  assert.deepEqual(classifyCountries("Will Russia invade Ukraine?"), [
    "RU",
    "UA",
  ]);
  assert.deepEqual(classifyCountries("Australian election"), ["AU"]);
  assert.deepEqual(classifyCountries("A Georgia football game"), []);
});
test("does not mistake raw book or raw order updates for executed prices", () => {
  assert.deepEqual(
    parsePriceEvent({ event_type: "book", asset_id: "y", price: ".9" }),
    [],
  );
  assert.deepEqual(
    parsePriceEvent({
      event_type: "price_change",
      price_changes: [{ asset_id: "y", price: ".9" }],
    }),
    [],
  );
});
test("midpoint uses best bid and ask and rejects crossed prices", () => {
  assert.equal(
    parsePriceEvent({
      event_type: "price_change",
      price_changes: [
        { asset_id: "y", price: ".9", best_bid: ".2", best_ask: ".4" },
      ],
    })[0].price,
    0.30000000000000004,
  );
  assert.deepEqual(
    parsePriceEvent({
      event_type: "best_bid_ask",
      asset_id: "y",
      best_bid: ".6",
      best_ask: ".4",
    }),
    [],
  );
});
test("trade updates affect only the correct outcome and emit actual changes", () => {
  const s = new MarketStore();
  s.replace(normalizeEvent(event, "2020-01-01T00:00:00Z"));
  s.ingest({
    event_type: "last_trade_price",
    asset_id: "y",
    price: ".4",
    timestamp: Date.now(),
  });
  assert.equal(s.markets.get("m1")!.outcomes[0].price, 0.7);
  assert.equal(s.markets.get("m1")!.outcomes[1].price, 0.4);
  assert.equal(s.feed[0].old, 0.3);
  assert.equal(s.feed[0].source, "Trade");
  s.ingest({
    event_type: "last_trade_price",
    asset_id: "y",
    price: ".4",
    timestamp: Date.now(),
  });
  assert.equal(s.feed.length, 1);
});
test("missing and invalid probabilities stay unavailable", () => {
  const m = normalizeEvent({
    ...event,
    markets: [{ ...event.markets[0], outcomePrices: ["", "2"] }],
  })[0];
  assert.equal(m.outcomes[0].price, null);
  assert.equal(m.outcomes[1].price, null);
});
test("object-shaped outcomes support protocol position IDs", () => {
  const m = normalizeEvent({
    ...event,
    markets: [
      {
        ...event.markets[0],
        outcomes: {
          yes: { positionId: "position-yes", tokenId: null, price: 0.6 },
          no: { positionId: "position-no", tokenId: null, price: 0.4 },
        },
      },
    ],
  })[0];
  assert.equal(m.outcomes[0].tokenId, "position-yes");
  assert.equal(m.outcomes[0].label, "yes");
  assert.equal(m.outcomes[0].price, 0.6);
});
test("unified trade envelopes preserve supplied ISO timestamps", () => {
  const p = parsePriceEvent({
    type: "last_trade_price",
    payload: { assetId: "y", price: ".3", timestamp: "2026-11-12T00:00:00Z" },
  })[0];
  assert.equal(p.at, "2026-11-12T00:00:00.000Z");
  assert.equal(p.source, "Trade");
});
test('does not include unrelated corporate resignations or sports contracts',()=>{assert.equal(normalizeEvent({...event,title:'Technology leadership',markets:[{...event.markets[0],question:'Will a corporate CEO resign?'}]}).length,0);assert.equal(normalizeEvent({...event,title:'US NBA election',markets:[{...event.markets[0],question:'Will the US NBA team win?'}]}).length,0)});
