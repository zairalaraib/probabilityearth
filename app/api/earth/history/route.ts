export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,token=params.get('token')??'',interval=params.get('interval')??'1w';
 if(!/^\d{1,100}$/.test(token)||!['1d','1w','1m','max'].includes(interval))return Response.json({error:'Invalid outcome or interval',history:[]},{status:400});
 try{const response=await fetch(`https://clob.polymarket.com/prices-history?market=${token}&interval=${interval}&fidelity=${interval==='1d'?5:60}`,{signal:AbortSignal.timeout(20000),next:{revalidate:60}});if(!response.ok)throw Error(`History returned ${response.status}`);return Response.json(await response.json(),{headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'public,max-age=30'}})}catch{return Response.json({error:'History unavailable',history:[]},{status:502,headers:{'Access-Control-Allow-Origin':'*'}})}
}
