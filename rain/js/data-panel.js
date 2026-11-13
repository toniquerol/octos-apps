import {FORMATS,identify,shapefileParts} from './formats.js';
const section=document.createElement('details');section.id='compatibilitySection';
const summary=document.createElement('summary');summary.textContent='DATOS · COMPATIBILIDAD DE FORMATOS';section.append(summary);
const hint=document.createElement('p');hint.className='hint';hint.textContent='La identificación no equivale a carga. Solo el lector de terreno confirma que un archivo puede analizarse. Los mosaicos requieren igual CRS, resolución y alineación; la reproyección entre mallas sigue siendo externa.';section.append(hint);
for(const [name,extension,status,use,processing] of FORMATS){
 const item=document.createElement('details');const title=document.createElement('summary');title.textContent=name+' · '+status;
 const body=document.createElement('p');body.textContent=extension+' — '+use+'. '+processing;item.append(title,body);section.append(item);
}
const label=document.createElement('label');label.textContent='Comprobar archivos antes de importar';
const input=document.createElement('input');input.type='file';input.multiple=true;label.append(input);section.append(label);
const results=document.createElement('div');results.setAttribute('role','status');section.append(results);
input.onchange=async()=>{
 results.replaceChildren();const files=[...input.files];
 for(const group of shapefileParts(files)){const p=document.createElement('p');p.textContent=group.name+': '+(group.missing.length?'faltan '+group.missing.join(', '):'componentes presentes; lector no disponible');results.append(p);}
 const seen=new Set();
 for(const file of files){const p=document.createElement('p');results.append(p);const key=[file.name,file.size,file.lastModified].join('|');
  if(seen.has(key)){p.textContent=file.name+': posible duplicado (nombre, tamaño y fecha).';continue;}seen.add(key);
  try{const r=await identify(file);p.textContent=file.name+' · '+r.format+' · '+r.message;}
  catch(e){p.textContent=file.name+' · '+e.message;}
 }
};
document.getElementById('terrainSection').before(section);
