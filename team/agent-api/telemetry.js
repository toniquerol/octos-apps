/* OcToS Team · telemetría persistente y privada para el Worker.
   Conserva únicamente metadatos de uso. No guarda prompts, respuestas ni claves.
   Costes estimados con tarifa estándar USD / millón de tokens (15-11-2026).
   No es una consulta a la facturación oficial de la cuenta OpenAI. */
const PREFIX="octos-team:telemetry:v1:";
const TTL=90*24*60*60;
const RATES=Object.freeze({
 "gpt-6-luna":{input:0.10,cached:0.01,output:0.50},
 "gpt-6.1-sol":{input:2,cached:0.10,output:10},
 "gpt-6.1-terra":{input:1,cached:0.05,output:5},
 "gpt-6-astra":{input:10,cached:1,output:50}
});
export function costEstimate(model,usage) {
 const price=RATES[model];
 if(!price)return null;
 const uncached=Math.max(0,usage.input_tokens-usage.cached_tokens);
 return (uncached*price.input+usage.cached_tokens*price.cached+
   usage.output_tokens*price.output)/1000000;
}
export async function saveMetric(env,event) {
 if(!env.TEAM_SECRETS)return;
 const at=new Date().toISOString();
 try {
  await env.TEAM_SECRETS.put(PREFIX+at+":"+crypto.randomUUID(),"1",{
   expirationTtl:TTL,metadata:{at,...event}
  });
 }catch(_) {
  // La telemetría nunca debe provocar que falle una tarea ejecutada.
 }
}
function newCount(fields={}) {
 return {calls:0,input_tokens:0,output_tokens:0,cached_tokens:0,
   estimated_usd:0,unpriced_calls:0,...fields};
}
export async function readMetrics(env,days) {
 if(!env.TEAM_SECRETS)throw new Error("Falta TEAM_SECRETS");
 if(![1,7,30].includes(days))throw new Error("Periodo inválido");
 const now=Date.now();
 // Los límites coinciden con los intervalos mostrados por el gráfico (UTC).
 const currentBucket=days===1?Math.floor(now/3600000)*3600000:
  Math.floor(now/86400000)*86400000;
 const since=currentBucket-(days===1?23*3600000:(days-1)*86400000);
 const events=[];
 let cursor,complete=false;
 // Una sola lectura de lista por página: metadatos en KV, sin descargar los valores.
 for(let n=0;n<20;n++){
  const options={prefix:PREFIX,limit:1000};
  if(cursor)options.cursor=cursor;
  const page=await env.TEAM_SECRETS.list(options);
  for(const k of page.keys||[]) {
   const e=k.metadata;
   if(!e||typeof e.at!=="string")continue;
   const time=Date.parse(e.at);
   if(time>=since&&time<=now)events.push(e);
  }
  if(page.list_complete||!page.cursor){complete=true;break}
  cursor=page.cursor;
 }
 const totals={...newCount(),successful_calls:0,failed_calls:0,
  incomplete_calls:0,tasks_completed:0,tasks_failed:0};
 const agents=new Map(),buckets=new Map(),recent=[];
 const hourly=days===1;
 for(const e of events) {
  if(e.kind==="task"){
   if(e.status==="completed")totals.tasks_completed++;
   if(e.status==="error")totals.tasks_failed++;
   continue;
  }
  if(e.kind!=="call")continue;
  const agent=String(e.agent||"unknown");
  const key=e.at.slice(0,hourly?13:10);
  if(!agents.has(agent))agents.set(agent,newCount({agent}));
  if(!buckets.has(key))buckets.set(key,newCount({period:key}));
  const input=Math.max(0,Number(e.input_tokens)||0);
  const output=Math.max(0,Number(e.output_tokens)||0);
  const cached=Math.min(input,Math.max(0,Number(e.cached_tokens)||0));
  const priced=typeof e.estimated_usd==="number"&&Number.isFinite(e.estimated_usd);
  for(const row of [totals,agents.get(agent),buckets.get(key)]){
   row.calls++;
   row.input_tokens+=input;
   row.output_tokens+=output;
   row.cached_tokens+=cached;
   if(priced)row.estimated_usd+=e.estimated_usd;
   else if(input||output)row.unpriced_calls++;
  }
  if(e.status==="completed")totals.successful_calls++;
  else if(e.status==="incomplete")totals.incomplete_calls++;
  else totals.failed_calls++;
  recent.push({at:e.at,agent,model:e.model||"—",status:e.status,
    input_tokens:input,output_tokens:output,
    estimated_usd:priced?e.estimated_usd:null});
 }
 const trend=[];
 for(let i=(hourly?23:days-1);i>=0;i--){
  const t=new Date(now-i*(hourly?3600000:86400000)).toISOString();
  const key=t.slice(0,hourly?13:10);
  trend.push(buckets.get(key)||newCount({period:key}));
 }
 recent.sort((a,b)=>b.at.localeCompare(a.at));
 return {scope:"octos-team-worker",days,generated_at:new Date(now).toISOString(),
  since:new Date(since).toISOString(),truncated:!complete,
  pricing_date:"2026-11-15",currency:"USD",cost_kind:"estimate",
  totals,trend,agents:[...agents.values()].sort((a,b)=>b.calls-a.calls),
  recent:recent.slice(0,10)};
}
