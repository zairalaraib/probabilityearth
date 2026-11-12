import type { Snapshot, Market, FeedItem } from "../lib/types";
import { parsePriceEvent } from "../lib/normalize";
export class MarketStore {
  markets = new Map<string, Market>();
  tokens = new Map<string, { market: Market; index: number }>();
  feed: FeedItem[] = [];
  status: Snapshot["status"] = "CONNECTING";
  error: string | null = null;
  discoveredAt: string | null = null;
  discoveryComplete = false;
  pages = 0;
  lastMessageAt: string | null = null;
  replace(markets: Market[]) {
    const previous = this.tokens;
    this.markets = new Map(markets.map((m) => [m.id, m]));
    this.tokens = new Map();
    for (const m of this.markets.values())
      m.outcomes.forEach((o, index) => {
        const old = previous.get(o.tokenId)?.market.outcomes[
          previous.get(o.tokenId)!.index
        ];
        if (old && Date.parse(old.updatedAt) > Date.parse(o.updatedAt))
          m.outcomes[index] = old;
        this.tokens.set(o.tokenId, { market: m, index });
      });
    this.discoveredAt = new Date().toISOString();
  }
  ingest(event: Record<string, unknown>) {
    for (const u of parsePriceEvent(event)) {
      const entry = this.tokens.get(u.tokenId);
      if (!entry) continue;
      const o = entry.market.outcomes[entry.index];
      if (Date.parse(u.at) < Date.parse(o.updatedAt)) continue;
      const old = o.price;
      o.price = u.price;
      o.source = u.source;
      o.updatedAt = u.at;
      entry.market.updatedAt = u.at;
      if (old !== u.price) {
        this.feed.unshift({
          id: `${u.tokenId}:${u.at}:${u.price}`,
          marketId: entry.market.id,
          title: entry.market.title,
          countries: entry.market.countries,
          outcome: o.label,
          old,
          price: u.price,
          at: u.at,
          source: u.source,
        });
        this.feed = this.feed.slice(0, 100);
      }
    }
  }
  snapshot(): Snapshot {
    return {
      markets: [...this.markets.values()],
      feed: this.feed,
      status: this.status,
      error: this.error,
      discoveredAt: this.discoveredAt,
      discoveryComplete: this.discoveryComplete,
      pages: this.pages,
      lastMessageAt: this.lastMessageAt,
    };
  }
}
