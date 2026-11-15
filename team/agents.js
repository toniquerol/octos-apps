/* OcToS Team · formulario para probar 3 agentes; sin clave OpenAI en navegador. */
(function(){
 "use strict";
 const form=document.getElementById("agents-form");
 if(!form)return;
 const endpoint=document.getElementById("agents-endpoint");
 const token=document.getElementById("agents-token");
 const task=document.getElementById("agents-task");
 const trace=document.getElementById("agents-trace");
 const result=document.getElementById("agents-result");
 const notice=document.getElementById("agents-notice");
 const send=document.getElementById("agents-send");
 const demo=document.getElementById("agents-demo");
 const health=document.getElementById("agents-health");
 const setupButton=document.getElementById("agents-setup");
 const setupToken=document.getElementById("agents-setup-token");
 const openaiKey=document.getElementById("agents-openai-key");
 const firstUse=document.getElementById("agents-first-use");
 const storeKey="octos-team-agent-endpoint-v1";
 const three=["chief","agent-3","agent-4"];
 let busy=false;
 try{endpoint.value=localStorage.getItem(storeKey)||""}catch(_){}
 endpoint.addEventListener("change",()=>{try{localStorage.setItem(storeKey,endpoint.value.trim())}catch(_){}});
 function state(id,status){
  if(typeof window.octosTeamSetRuntimeState==="function")window.octosTeamSetRuntimeState(id,status);
  const el=document.querySelector('[data-agent-live="'+id+'"]');
  if(el)el.textContent=({idle:"Disponible",waiting:"En espera",running:"Trabajando",completed:"Finalizado"}[status]||"Sin datos");
 }
 function line(message){trace.textContent+=(trace.textContent?"\n":"")+message;trace.scrollTop=trace.scrollHeight}
 function setBusy(v){
  busy=v;send.disabled=v;demo.disabled=v;health.disabled=v;setupButton.disabled=v;
  notice.textContent=v?"Petición en ejecución; no cierres la pestaña.":notice.textContent;
 }
 function baseUrl(){
  let url;try{url=new URL(endpoint.value.trim())}catch{throw Error("Introduce la URL HTTPS del servidor de agentes.")}
  if(url.protocol!=="https:")throw Error("El servidor de agentes debe utilizar HTTPS.");
  if(url.username||url.password)throw Error("La URL no debe incluir contraseñas.");
  if(url.search||url.hash)throw Error("Introduce la URL del servidor sin parámetros.");
  return url.origin+url.pathname.replace(/\/+(run|health)\/?$/,"").replace(/\/+$/,"");
 }
 function serviceToken(){
  const value=token.value.trim();
  if(!value)throw Error("Introduce la clave privada del servicio (NO la clave OpenAI).");
  return value;
 }
 function begin(title){
  trace.textContent=title;result.textContent="Pendiente.";
  notice.textContent="Estados visibles solo en este navegador.";
  three.forEach(id=>state(id,"idle"));
 }
 function processEvent(event){
  if(event.type==="state") {
   if(three.includes(event.agent))state(event.agent,event.state);
   line(({"chief":"Dirección","agent-3":"A03 · Cartografía","agent-4":"A04 · Integración"}[event.agent]||event.agent)+": "+event.state);
  }else if(event.type==="report"){
   line("\n"+event.label+" — informe:\n"+event.text+"\n");
  }else if(event.type==="done"){
   result.textContent=event.result||"Sin conclusión.";
   const usage=event.usage||{};
   line("FINALIZADO · Modelo: "+String(event.model||"—")+
    " · Entrada: "+(usage.input_tokens??"—")+" tokens · Salida: "+(usage.output_tokens??"—")+" tokens");
   notice.textContent="Consulta real finalizada. Tokens mostrados según respuesta de la API.";
  }else if(event.type==="error"){
   throw Error(event.message||"Error del servicio");
  }
 }
 async function run(){
  if(busy)return;
  let base,auth;
  try{base=baseUrl();auth=serviceToken()}catch(e){notice.textContent=e.message;return}
  const question=task.value.trim();
  if(question.length<8||question.length>2500){notice.textContent="La petición debe tener entre 8 y 2500 caracteres.";return}
  setBusy(true);begin("API REAL · Coordinación de tres agentes");
  try{
   const response=await fetch(base+"/run",{method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+auth},
    body:JSON.stringify({task:question}),cache:"no-store"});
   if(!response.ok){
    let body={};try{body=await response.json()}catch(_){}
    throw Error(body.error||"HTTP "+response.status);
   }
   if(!response.body)throw Error("El servidor no devolvió un flujo de datos.");
   const reader=response.body.getReader(),decoder=new TextDecoder();
   let buffer="",finished=false;
   async function accept(str){
    if(!str.trim())return;
    const obj=JSON.parse(str);
    if(obj.type==="done")finished=true;
    processEvent(obj);
   }
   for(;;){
    const {value,done}=await reader.read();
    if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    const rows=buffer.split("\n");buffer=rows.pop()||"";
    for(const row of rows)await accept(row);
   }
   buffer+=decoder.decode();
   if(buffer.trim())await accept(buffer);
   if(!finished)throw Error("El servidor terminó sin respuesta final.");
  }catch(e){
   notice.textContent="No se ha completado la consulta: "+e.message;
   line("ERROR · "+e.message);
   three.forEach(id=>state(id,"idle"));
  }finally{setBusy(false)}
 }
 async function check(){
  if(busy)return;
  let base,auth;
  try{base=baseUrl();auth=serviceToken()}catch(e){notice.textContent=e.message;return}
  setBusy(true);notice.textContent="Comprobando conexión...";
  try{
   const response=await fetch(base+"/health",{headers:{"Authorization":"Bearer "+auth},cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"HTTP "+response.status);
   notice.textContent=data.ready
     ?"Worker conectado y clave API configurada. Modelo: "+data.model+". Agentes: Dirección, A03 y A04."
     :"Worker conectado, pero falta registrar la clave OpenAI. Abre «Primera conexión».";
  }catch(e){notice.textContent="Servicio no conectado: "+e.message}
  finally{setBusy(false)}
 }
 async function registerKey(){
  if(busy)return;
  let base;
  try{base=baseUrl()}catch(error){notice.textContent=error.message;return}
  const adminSecret=setupToken.value.trim();
  const key=openaiKey.value.trim();
  if(adminSecret.length<20){notice.textContent="Introduce TEAM_SETUP_TOKEN, generado previamente como secreto de Cloudflare.";return}
  if(!key.startsWith("sk-")||key.length<25||key.length>600){
   notice.textContent="Introduce una clave válida de OpenAI; solo se envía al Worker mediante HTTPS.";return
  }
  setBusy(true);
  notice.textContent="Enviando clave al Worker por HTTPS...";
  try{
   const response=await fetch(base+"/setup",{
    method:"POST",cache:"no-store",referrerPolicy:"no-referrer",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+adminSecret},
    body:JSON.stringify({openai_api_key:key})
   });
   let data={};try{data=await response.json()}catch(_){}
   if(!response.ok||!data.configured)throw Error(data.error||"HTTP "+response.status);
   notice.textContent="Clave cifrada y almacenada en Cloudflare. La clave no se conserva en la página.";
   line("CONFIGURACIÓN · Clave API registrada en el Worker sin mostrar su contenido.");
   firstUse.open=false;
  }catch(error){
   notice.textContent="No se pudo configurar la clave: "+error.message;
  }finally{
   openaiKey.value="";setupToken.value="";
   setBusy(false);
  }
 }
 [setupToken,openaiKey].forEach(el=>el.addEventListener("keydown",event=>{
  if(event.key==="Enter")event.preventDefault();
 }));
 setupButton.addEventListener("click",()=>{void registerKey()});
 function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
 async function simulate(){
  if(busy)return;
  setBusy(true);begin("SIMULACIÓN LOCAL · Sin API ni gasto de tokens");
  try{
   state("chief","waiting");line("Dirección recibe solicitud (simulada).");await sleep(350);
   state("agent-3","running");state("agent-4","running");
   line("A03 y A04 reciben tareas (simuladas).");await sleep(550);
   state("agent-3","completed");line("A03 entrega informe de prueba (sin IA).");await sleep(260);
   state("agent-4","completed");line("A04 entrega informe de prueba (sin IA).");await sleep(300);
   state("chief","running");line("Dirección consolida resultados (simulado).");await sleep(450);
   state("chief","completed");
   result.textContent="La comunicación visual se ha comprobado. No se ha consultado la API de OpenAI ni se han generado respuestas técnicas.";
   notice.textContent="Recorrido local completado. Coste API: 0 tokens.";
  }finally{setBusy(false)}
 }
 form.addEventListener("submit",e=>{e.preventDefault();void run()});
 demo.addEventListener("click",()=>{void simulate()});
 health.addEventListener("click",()=>{void check()});
})();
