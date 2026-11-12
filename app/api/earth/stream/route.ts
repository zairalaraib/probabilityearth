import { marketService as service } from '@/server/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export function GET(request: Request) {
 const encoder=new TextEncoder();let cleanup=()=>{};
 const stream=new ReadableStream<Uint8Array>({
  start(controller){
   const detach=service.attach();let closed=false,previous='',ticks=0;
   let timer:ReturnType<typeof setInterval>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
   cleanup=()=>{if(closed)return;closed=true;if(timer)clearInterval(timer);if(deadline)clearTimeout(deadline);request.signal.removeEventListener('abort',cleanup);detach();try{controller.close()}catch{}};
   const send=()=>{if(closed)return;try{const data=JSON.stringify(service.store.snapshot());if(data!==previous){controller.enqueue(encoder.encode(`data: ${data}\n\n`));previous=data}else if(++ticks%10===0)controller.enqueue(encoder.encode(': heartbeat\n\n'));if(ticks%30===0)void service.refresh()}catch{cleanup()}};
   send();timer=setInterval(send,1000);
   // Graceful rotation before the platform deadline. EventSource reconnects automatically.
   deadline=setTimeout(cleanup,240000);request.signal.addEventListener('abort',cleanup,{once:true});if(request.signal.aborted)cleanup();
  },cancel(){cleanup()}
 });
 return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no','Access-Control-Allow-Origin':'*'}});
}
