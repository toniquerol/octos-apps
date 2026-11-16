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
 const demoSimple=document.getElementById("agents-demo-simple");
 const health=document.getElementById("agents-health");
 const setupButton=document.getElementById("agents-setup");
 const setupToken=document.getElementById("agents-setup-token");
 const openaiKey=document.getElementById("agents-openai-key");
 const firstUse=document.getElementById("agents-first-use");
 const storeKey="octos-team-agent-endpoint-v1";
 const three=["jarvis","agent-7"];
 let busy=false;

 // Dictado opcional del navegador: solo escribe; nunca envía la petición.
 const speechStyles=document.createElement("style");
 speechStyles.textContent=`
 .agents-dictation{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:12px 0}
 .agents-dictation button{width:44px;height:44px;min-height:44px;flex:0 0 44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line,#383a40);border-radius:8px;padding:0;background:var(--panel2,#2a2b2f);color:var(--ink,#f1f1ef);font:inherit}
 .agents-dictation button[aria-pressed="true"]{border-color:var(--accent,#ff6a1a);color:var(--accent,#ff6a1a)}
 .agents-dictation button:focus-visible{outline:2px solid var(--accent,#ff6a1a);outline-offset:3px}
 .agents-dictation button:disabled{opacity:.6;cursor:not-allowed}
 .agents-dictation p{flex:1 1 220px;margin:0;color:var(--ink,#f1f1ef);font-size:12px;line-height:1.6;overflow-wrap:anywhere}
 .agents-dictation small{flex-basis:100%;color:var(--ink,#f1f1ef);font-size:11px;line-height:1.5}
 `;
 document.head.append(speechStyles);
 const speechBox=document.createElement("div");
 speechBox.className="agents-dictation";
 const dictate=document.createElement("button");
 dictate.id="agents-dictate";dictate.type="button";
 dictate.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
 function labelDictation(label){
  dictate.setAttribute("aria-label",label);
  dictate.title=label;
 }
 labelDictation("Dictar consulta");
 dictate.setAttribute("aria-pressed","false");
 dictate.setAttribute("aria-controls","agents-task");
 dictate.setAttribute("aria-describedby","agents-dictation-status agents-dictation-help");
 const speechStatus=document.createElement("p");
 speechStatus.id="agents-dictation-status";
 speechStatus.setAttribute("role","status");
 speechStatus.setAttribute("aria-live","polite");
 speechStatus.textContent="El dictado se añade al final. Revisa el texto antes de enviarlo.";
 const speechHelp=document.createElement("small");
 speechHelp.id="agents-dictation-help";
 speechHelp.textContent="Español · Requiere permiso de micrófono. El navegador puede enviar el audio a su servicio de voz. No usa tu API de OpenAI.";
 speechBox.append(dictate,speechStatus,speechHelp);
 task.insertAdjacentElement("afterend",speechBox);
 const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let speechSession=null;
 function speechControls(){
  const active=!!speechSession;
  task.readOnly=active;
  dictate.disabled=busy||!SpeechRecognition;
  dictate.setAttribute("aria-pressed",String(active));
  labelDictation(active?"Detener dictado":"Dictar consulta");
  [send,demo,demoSimple,health,setupButton].forEach(el=>el.disabled=busy||active);
 }
 function finishSpeech(session,message){
  if(speechSession!==session)return;
  clearTimeout(session.timer);
  speechSession=null;speechControls();
  speechStatus.textContent=message||"Dictado terminado. Revisa el texto y pulsa Enviar con API cuando quieras.";
 }
 function cancelSpeech(message){
  const session=speechSession;if(!session)return;
  finishSpeech(session,message);
  try{session.recognition.abort()}catch(_){}
 }
 function stopSpeech(){
  const session=speechSession;if(!session)return;
  dictate.disabled=true;labelDictation("Terminando dictado…");
  speechStatus.textContent="Terminando la transcripción…";
  try{session.recognition.stop()}catch(_){cancelSpeech("Dictado detenido. El texto confirmado se conserva.");return}
  clearTimeout(session.timer);
  session.timer=setTimeout(()=>cancelSpeech("Dictado detenido. Revisa el texto confirmado antes de enviarlo."),5000);
 }
 dictate.addEventListener("click",()=>{
  if(busy)return;
  if(speechSession){stopSpeech();return}
  if(!SpeechRecognition)return;
  const limit=task.maxLength>0?task.maxLength:2500;
  if(task.value.length>=limit){speechStatus.textContent="Has alcanzado los 2500 caracteres. Acorta el texto antes de dictar.";return}
  let recognition;
  try{recognition=new SpeechRecognition()}catch(_){speechStatus.textContent="No se pudo iniciar el dictado. Puedes escribir la consulta.";return}
  const session={recognition,base:task.value,timer:null};
  speechSession=session;speechControls();
  speechStatus.textContent="Iniciando micrófono… Si se solicita, permite el acceso para dictar.";
  recognition.lang="es-ES";recognition.continuous=true;recognition.interimResults=true;
  recognition.onstart=()=>{
   if(speechSession!==session)return;
   speechStatus.textContent="Escuchando… Habla en español y pulsa Detener dictado al terminar.";
  };
  recognition.onresult=event=>{
   if(speechSession!==session)return;
   const finals=[],interim=[];
   for(let i=0;i<event.results.length;i++){
    const text=event.results[i][0].transcript.trim();
    (event.results[i].isFinal?finals:interim).push(text);
   }
   const transcript=finals.filter(Boolean).join(" ");
   const separator=session.base&&!/\s$/.test(session.base)?" ":"";
   const merged=transcript?session.base+separator+transcript:session.base;
   task.value=merged.slice(0,limit);
   task.dispatchEvent(new Event("input",{bubbles:true}));
   if(merged.length>=limit){
    cancelSpeech("Se alcanzó el límite de 2500 caracteres. Revisa el final del texto antes de enviarlo.");return;
   }
   speechStatus.textContent=interim.length?"Escuchando: "+interim.join(" "):"Escuchando… Texto añadido. Pulsa Detener dictado al terminar.";
  };
  recognition.onerror=event=>{
   if(speechSession!==session)return;
   const messages={
    "not-allowed":"Permiso de micrófono denegado. Permítelo en los ajustes del sitio o escribe la consulta.",
    "service-not-allowed":"El navegador no permite el servicio de dictado. Puedes escribir la consulta.",
    "audio-capture":"No se detecta un micrófono disponible. Comprueba que esté conectado.",
    "network":"No se pudo conectar con el servicio de voz. Comprueba tu conexión y vuelve a intentarlo.",
    "no-speech":"No se ha detectado voz. Pulsa Dictar consulta para volver a intentarlo.",
    "aborted":"Dictado detenido. El texto confirmado se conserva."
   };
   cancelSpeech(messages[event.error]||"El dictado no pudo continuar. El texto confirmado se conserva.");
  };
  recognition.onend=()=>finishSpeech(session);
  session.timer=setTimeout(stopSpeech,90000);
  try{recognition.start()}catch(_){cancelSpeech("No se pudo iniciar el dictado. Vuelve a intentarlo o escribe la consulta.")}
 });
 document.addEventListener("visibilitychange",()=>{if(document.hidden)cancelSpeech("Dictado detenido al salir de la pestaña. El texto confirmado se conserva.")});
 window.addEventListener("pagehide",()=>cancelSpeech("Dictado detenido."));
 window.addEventListener("hashchange",()=>cancelSpeech("Dictado detenido al cambiar de pantalla."));
 task.addEventListener("keydown",event=>{if(event.key==="Escape"&&speechSession){event.preventDefault();stopSpeech()}});
 if(!SpeechRecognition)speechStatus.textContent="Este navegador no admite dictado. Puedes escribir o usar el dictado de tu dispositivo.";
 speechControls();

 try{endpoint.value=localStorage.getItem(storeKey)||""}catch(_){}
 endpoint.addEventListener("change",()=>{try{localStorage.setItem(storeKey,endpoint.value.trim())}catch(_){}});
 function state(id,status){
  if(typeof window.octosTeamSetRuntimeState==="function")window.octosTeamSetRuntimeState(id,status);
  const el=document.querySelector('[data-agent-live="'+id+'"]');
  if(el)el.textContent=({idle:"Disponible",waiting:"En espera",running:"Trabajando",completed:"Finalizado"}[status]||"Sin datos");
 }
 function line(message){trace.textContent+=(trace.textContent?"\n":"")+message;trace.scrollTop=trace.scrollHeight}
 function setBusy(v){
  busy=v;speechControls();
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
   line(({"jarvis":"Jarvis · Coordinador","agent-7":"A07 · Investigación"}[event.agent]||event.agent)+": "+event.state);
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
  if(busy||speechSession)return;
  let base,auth;
  try{base=baseUrl();auth=serviceToken()}catch(e){notice.textContent=e.message;return}
  const question=task.value.trim();
  if(question.length<8||question.length>2500){notice.textContent="La petición debe tener entre 8 y 2500 caracteres.";return}
  setBusy(true);begin("API REAL · Piloto Jarvis + A07 Investigación");
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
  if(busy||speechSession)return;
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
  if(busy||speechSession)return;
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
 async function simulate(mode){
  if(busy||speechSession)return;
  setBusy(true);begin("SIMULACIÓN LOCAL · "+(mode==="simple"?"Consulta breve":"Proyecto departamental")+" · 0 tokens API");
  try{
   line("01 · Controlador recibe la petición y registra su objetivo.");await sleep(350);
   line("02 · Controlador clasifica: "+(mode==="simple"?"tarea breve para Jarvis.":"proyecto con intervención de equipo."));await sleep(450);
   if(mode==="simple"){
    line("03 · Jarvis realiza una revisión breve (simulada, sin modelo IA).");await sleep(450);
    line("04 · Jarvis devuelve el resultado a Controlador.");await sleep(320);
    line("05 · Controlador prepara la salida para el propietario.");
    result.textContent="Ruta corta comprobada: Controlador → Jarvis → Controlador → propietario. Sin IA, sin cambios de archivos y sin llamadas API.";
   }else{
    line("03 · Gestor evalúa tiempo, recursos, memoria y presupuesto de tokens.");await sleep(360);
    line("04 · Mesa de reuniones: responsable A03 representa a Cartografía e Integración. En otros proyectos se convoca a los responsables afectados (A01, A05 o A07).");await sleep(450);
    state("chief","waiting");line("05 · Dirección recibe el plan; A03 distribuye investigación e integración.");await sleep(370);
    state("agent-3","running");state("agent-4","running");
    line("06 · A03 y A04 trabajan en sus tareas (estados visuales simulados).");await sleep(500);
    state("agent-4","completed");state("agent-3","completed");
    line("07 · Los agentes entregan resultados a A03, responsable del grupo.");await sleep(360);
    state("chief","running");line("08 · Dirección valida la conclusión del responsable y resolvería dudas pendientes.");await sleep(400);
    state("chief","completed");line("09 · Gestor registra el cierre y Controlador prepara salida. Si Dirección no resuelve una duda, se eleva al propietario.");
    result.textContent="Ruta de equipo comprobada: Controlador → Gestor y reunión → A03 (responsable) → A03/A04 → Dirección → Controlador → propietario. Sin trabajo técnico real ni llamadas API.";
   }
   notice.textContent="Simulación completada. Consumo de API: 0 tokens.";
  }finally{setBusy(false)}
 }
 form.addEventListener("submit",e=>{e.preventDefault();void run()});
 demo.addEventListener("click",()=>{void simulate("team")});
 demoSimple.addEventListener("click",()=>{void simulate("simple")});
 health.addEventListener("click",()=>{void check()});
})();
