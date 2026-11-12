import { classifyCountries } from "./countries";
import type { Category, Market } from "./types";
const rules: [Category, RegExp][] = [
  [
    "Conflict",
    /\b(war|ceasefire|inva(?:de|sion)|military|missile|nuclear|strike|troops|conflict|attack|annex|hostage|bomb|peace deal)\b/i,
  ],
  ["Sanctions", /\b(sanction|sanctions|embargo)\b/i],
  ["Trade", /\b(tariff|tariffs|trade deal|trade war|export ban)\b/i],
  [
    "Elections",
    /\b(election|elections|electoral|nominee|nomination|vote|ballot|win.*presiden|parliament)\b/i,
  ],
  [
    "Leadership",
    /\b(president|prime minister|resign|removed|leader|regime|impeach|supreme leader)\b/i,
  ],
  [
    "Diplomacy",
    /\b(nato|diploma\w*|summit|treaty|recognize|recognise|negotiation|meet with|united nations)\b/i,
  ],
  [
    "Policy",
    /\b(legislation|government|congress|senate|policy|referendum|shutdown|deport|immigration|border)\b/i,
  ],
];
export function classifyCategory(text: string): Category | null {
  return rules.find(([, r]) => r.test(text))?.[0] ?? null;
}
export const numeric = (v: unknown): number | null =>
  v === null || v === undefined || v === ""
    ? null
    : Number.isFinite(Number(v))
      ? Number(v)
      : null;
export const probability = (v: unknown) => {
  const n = numeric(v);
  return n !== null && n >= 0 && n <= 1 ? n : null;
};
function arr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  try {
    const a = JSON.parse(String(v));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
// Gamma's JSON-encoded arrays preserve the positional relationship of label, price and token.
export function normalizeEvent(
  event: Record<string, any>,
  now = new Date().toISOString(),
): Market[] {
  if (event.closed || event.active === false) return [];
  return (Array.isArray(event.markets) ? event.markets : []).flatMap(
    (m: Record<string, any>) => {
      if (
        m.closed ||
        m.active === false ||
        m.archived ||
        m.enableOrderBook === false ||
        !m.id ||
        !m.question
      )
        return [];
      const context = `${event.title ?? ""} ${m.question} ${(event.tags ?? []).map((t: any) => t.label ?? "").join(" ")}`;
      const category =
        classifyCategory(context) ?? classifyCategory(m.description ?? "");
      if (!category) return [];
      const countries = classifyCountries(`${event.title ?? ""} ${m.question}`);
      let labels = arr(m.outcomes),
        tokens = arr(m.clobTokenIds),
        prices = arr(m.outcomePrices);
      if (
        m.outcomes &&
        typeof m.outcomes === "object" &&
        !Array.isArray(m.outcomes)
      ) {
        const entries = Object.entries(m.outcomes) as [string, any][];
        labels = entries.map(([k]) => k);
        tokens = entries.map(([, v]) => v.positionId ?? v.tokenId);
        prices = entries.map(([, v]) => v.price);
      }
      if (
        !labels.length ||
        labels.length !== tokens.length ||
        tokens.some((t) => !t)
      )
        return [];
      const yes = labels.findIndex((v) => String(v).toLowerCase() === "yes");
      return [
        {
          id: String(m.id),
          eventId: String(event.id),
          title: m.question,
          slug: event.slug ?? m.slug,
          countries,
          category,
          endDate: m.endDate ?? event.endDate ?? null,
          volume: numeric(m.volumeNum ?? m.volume) ?? 0,
          volume24h: numeric(m.volume24hr) ?? 0,
          liquidity: numeric(m.liquidityNum ?? m.liquidity) ?? 0,
          change1h: yes === 0 ? numeric(m.oneHourPriceChange) : null,
          change24h: yes === 0 ? numeric(m.oneDayPriceChange) : null,
          outcomes: labels.map((label, i) => ({
            label: String(label),
            tokenId: String(tokens[i]),
            price: probability(prices[i]),
            updatedAt: m.updatedAt ?? now,
            source: "Gamma" as const,
          })),
          updatedAt: m.updatedAt ?? now,
        },
      ];
    },
  );
}
export type PriceUpdate = {
  tokenId: string;
  price: number;
  source: "Trade" | "Midpoint";
  at: string;
};
export function parsePriceEvent(event: Record<string, any>): PriceUpdate[] {
  const type = event.event_type ?? event.type;
  const p = event.payload ?? event;
  const raw = p.timestamp ?? Date.now();
  const date = new Date(
    typeof raw === "string" && raw.includes("T") ? raw : Number(raw),
  );
  const at = Number.isFinite(date.getTime())
    ? date.toISOString()
    : new Date().toISOString();
  if (type === "last_trade_price") {
    const price = probability(p.price),
      tokenId = p.asset_id ?? p.assetId;
    return price !== null && tokenId
      ? [{ tokenId: String(tokenId), price, source: "Trade", at }]
      : [];
  }
  if (type === "price_change" || type === "best_bid_ask")
    return (p.price_changes ?? p.priceChanges ?? [p]).flatMap((v: any) => {
      const bid = probability(v.best_bid ?? v.bestBid),
        ask = probability(v.best_ask ?? v.bestAsk),
        tokenId = v.asset_id ?? v.assetId;
      return tokenId && bid !== null && ask !== null && bid <= ask
        ? [
            {
              tokenId: String(tokenId),
              price: (bid + ask) / 2,
              source: "Midpoint" as const,
              at,
            },
          ]
        : [];
    });
  return [];
}
