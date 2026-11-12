import { marketService as service } from '@/server/service';
export const dynamic='force-dynamic';
export function GET(){return Response.json({ok:true,status:service.store.status,markets:service.store.markets.size,error:service.store.error})}
