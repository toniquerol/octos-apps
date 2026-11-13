const fs=require('fs');
function bundle(file, name){let s=fs.readFileSync(__dirname+'/../vendor/'+file,'utf8');s=s.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'([^']+)';/g,(_,v,p)=>`const {${v}} = ${p==='three'?'THREE':'UTILS'};`);s=s.replace(/export function /g,'function ');s=s.replace(/export\s*\{([\s\S]*?)\};/g,(_,v)=>`return {${v.replace(/(\w+)\s+as\s+(\w+)/g,'$2:$1')}};`);return `const ${name}=(()=>{${s}\n})();`;}
const code=bundle('three.module.js','THREE')+bundle('BufferGeometryUtils.js','UTILS')+bundle('GLTFLoader.js','LOADERS')+fs.readFileSync(__dirname+'/../src/app.js','utf8');
new (require('vm').Script)(code);
fs.writeFileSync(__dirname+'/../index.html',fs.readFileSync(__dirname+'/../src/template.html','utf8').replace('/*APP*/',()=>code.replace(/<\/script/gi,'<\\/script')));
console.log('HTML autónomo generado y sintaxis comprobada.');

