import type {Snapshot} from './types';
// A new server instance may be discovering while the browser still has valid last-known prices.
export function mergeSnapshot(previous:Snapshot,incoming:Snapshot):Snapshot {
 if(incoming.discoveryComplete || !previous.markets.length)return incoming;
 const markets=new Map(previous.markets.map(m=>[m.id,m]));
 for(const market of incoming.markets)markets.set(market.id,market);
 return {...incoming,markets:[...markets.values()],feed:incoming.feed.length?incoming.feed:previous.feed};
}
