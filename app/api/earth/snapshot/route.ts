import { marketService as service } from '@/server/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(){await service.refresh();return Response.json(service.store.snapshot(),{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
