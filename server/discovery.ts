import { normalizeEvent } from '../lib/normalize';
import type { Market } from '../lib/types';
export async function discover(onPage?: (markets:Market[],pages:number)=>void) {
 const markets=new Map<string,Market>(),seenEvents=new Set<string>(),seenCursors=new Set<string>();
 let pages=0,cursor:string|undefined;
 do {
  const params=new URLSearchParams({closed:'false',limit:'100',order:'id',ascending:'false'});
  if(cursor)params.set('after_cursor',cursor);
  const response=await fetch(`https://gamma-api.polymarket.com/events/keyset?${params}`,{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error(`Gamma returned ${response.status}`);
  const data=await response.json();
  if(!Array.isArray(data.events))throw Error('Unexpected Gamma cursor response');
  pages++;let fresh=0;
  for(const event of data.events){if(seenEvents.has(String(event.id)))continue;seenEvents.add(String(event.id));fresh++;for(const m of normalizeEvent(event))markets.set(m.id,m)}
  onPage?.([...markets.values()],pages);
  cursor=data.next_cursor||undefined;
  if(cursor){if(seenCursors.has(cursor)||!fresh)throw Error('Gamma pagination repeated a page or cursor; discovery incomplete');seenCursors.add(cursor);await new Promise(r=>setTimeout(r,100))}
 } while(cursor);
 return {markets:[...markets.values()],pages};
}
