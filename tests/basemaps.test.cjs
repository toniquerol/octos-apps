const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const catalog=JSON.parse(fs.readFileSync('layers/basemaps.json','utf8'));
function boot(drafts=[],ok=true){const context={URL,document:{currentScript:{src:'https://example.org/octos-apps/shared/basemaps.js'}},location:{href:'https://example.org/octos-apps/rain/'},localStorage:{getItem:()=>JSON.stringify(drafts)},fetch:async()=>({ok,status:503,json:async()=>catalog}),window:{},L:{tileLayer:(url,options)=>({url,options})}};vm.runInNewContext(fs.readFileSync('shared/basemaps.js','utf8'),context);return context.window.OcToSBasemaps}
test('published catalog and stable unique identifiers',async()=>{const api=boot();const c=await api.ready;assert.equal(c.version,'2.8.0');assert.equal(new Set(c.items.map(b=>b.id)).size,c.items.length);assert.equal(api.entries(c).find(b=>b.id==='drive-liberty').status,'aprobada')});
test('local approval and revocation reach consumer without changing published data',async()=>{for(const status of ['aprobada','error']){const api=boot([{basemapId:'ign-base',name:'IGN local',url:'https://example.org/{z}/{x}/{-y}',status}]);const c=await api.ready;assert.equal(api.entries(c).find(b=>b.id==='ign-base').status,status);assert.equal(c.items.find(b=>b.id==='ign-base').status,'pendiente')}});
test('inverted Y template is not inverted twice',async()=>{const api=boot();const b=catalog.items.find(b=>b.id==='ign-base');const layer=await api.leafletLayer(b,'tilePane');assert.equal(layer.options.tms,false);assert.equal(layer.url,b.url);const regular=await api.leafletLayer({...b,url:'https://example.org/{z}/{x}/{y}'},'tilePane');assert.equal(regular.options.tms,true)});
test('HTTP failures remain visible instead of reporting empty success',async()=>{await assert.rejects(boot([],false).ready,/503/)});

