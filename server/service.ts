import { MarketStore } from './store';
import { Upstream } from './upstream';
import { discover } from './discovery';

// Vercel can reuse an instance, but state is never assumed durable between instances.
// Upstream connections exist only while an HTTP stream is actively using them.
export class MarketService {
 readonly store = new MarketStore();
 private upstream = new Upstream(this.store);
 private discovery: Promise<void> | null = null;
 private clients = 0;
 private lastAttempt = 0;
 private lastSuccess = 0;
 private idleTimer: ReturnType<typeof setTimeout> | null = null;
 attach() {
  if (this.idleTimer) clearTimeout(this.idleTimer);
  this.idleTimer = null;
  if (!this.clients && this.upstream.stopped) this.upstream = new Upstream(this.store);
  this.clients++;
  if (this.store.tokens.size) this.upstream.connect();
  void this.refresh();
  let detached = false;
  return () => {if(detached)return;detached=true;this.clients=Math.max(0,this.clients-1);if(!this.clients)this.idleTimer=setTimeout(()=>{if(!this.clients)this.upstream.stop()},5000)};
 }
 async refresh() {
  if(this.discovery)return this.discovery;
  const now=Date.now();
  if(this.lastSuccess && now-this.lastSuccess<300000)return;
  if(this.lastAttempt && now-this.lastAttempt<30000)return;
  this.lastAttempt=now;this.store.discoveryComplete=false;
  this.discovery=(async()=>{
   try {
    const result=await discover((markets,pages)=>{
     this.store.pages=pages;
     const merged=new Map(this.store.markets);
     for(const m of markets)merged.set(m.id,m);
     this.store.replace([...merged.values()]);
     if(this.clients){this.upstream.reconcile();this.upstream.connect()}
    });
    this.store.replace(result.markets);this.store.pages=result.pages;this.store.discoveryComplete=true;this.store.error=null;this.lastSuccess=Date.now();
    if(this.clients){this.upstream.reconcile();this.upstream.connect()}
   }catch(error){this.store.error=`Market discovery unavailable: ${error instanceof Error?error.message:'source unreachable'}`;if(!this.store.markets.size)this.store.status='STALE';console.warn(this.store.error)}
   finally{this.discovery=null}
  })();
  return this.discovery;
 }
}
const globalService=globalThis as typeof globalThis & { earthMarketService?: MarketService };
export const marketService=globalService.earthMarketService??=new MarketService();
