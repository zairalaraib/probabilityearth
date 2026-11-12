import { normalizeEvent } from "../lib/normalize";
import type { Market } from "../lib/types";
export async function discover(
  onPage?: (markets: Market[], pages: number) => void,
) {
  const markets = new Map<string, Market>();
  let pages = 0;
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(
      `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100&offset=${offset}&order=volume24hr&ascending=false`,
      { signal: AbortSignal.timeout(25000) },
    );
    if (!response.ok) throw new Error(`Gamma returned ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected Gamma response");
    pages++;
    let fresh = 0;
    for (const event of data) {
      if (seen.has(String(event.id))) continue;
      seen.add(String(event.id));
      fresh++;
      for (const m of normalizeEvent(event)) markets.set(m.id, m);
    }
    onPage?.([...markets.values()], pages);
    if (data.length < 100) break;
    if (!fresh)
      throw new Error("Gamma pagination repeated a page; discovery incomplete");
    await new Promise((r) => setTimeout(r, 150));
  }
  return { markets: [...markets.values()], pages };
}
