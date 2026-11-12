export type Category =
  | "Conflict"
  | "Elections"
  | "Policy"
  | "Diplomacy"
  | "Sanctions"
  | "Trade"
  | "Leadership";
export type Outcome = {
  label: string;
  tokenId: string;
  price: number | null;
  updatedAt: string;
  source: "Gamma" | "Trade" | "Midpoint";
};
export type Market = {
  id: string;
  eventId: string;
  title: string;
  slug: string;
  countries: string[];
  category: Category;
  endDate: string | null;
  volume: number;
  volume24h: number;
  liquidity: number;
  change1h: number | null;
  change24h: number | null;
  outcomes: Outcome[];
  updatedAt: string;
};
export type FeedItem = {
  id: string;
  title: string;
  countries: string[];
  outcome: string;
  old: number | null;
  price: number;
  at: string;
  source: string;
  marketId: string;
};
export type Snapshot = {
  markets: Market[];
  feed: FeedItem[];
  status: "LIVE" | "RECONNECTING" | "STALE" | "CONNECTING";
  error: string | null;
  discoveredAt: string | null;
  discoveryComplete: boolean;
  pages: number;
  lastMessageAt: string | null;
};
export const primary = (m: Market | undefined) =>
  m?.outcomes.find((o) => o.label.toLowerCase() === "yes") ?? m?.outcomes[0];
