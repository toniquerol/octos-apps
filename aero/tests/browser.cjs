const assert=require('assert'),path=require('path'),fs=require('fs');
const {chromium}=require('playwright');
async function test(){
  const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
  try {
  const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const file='file://'+path.resolve(__dirname,'../index.html');
  await page.goto(file,{waitUntil:'domcontentloaded',timeout:60000});
  assert(await page.locator('#projectHome').isVisible(),'Home screen should open first');
  await page.locator('#projectEnterViewer').click();
  assert(!(await page.locator('#projectHome').isVisible()),'Viewer should remain accessible');
  await page.waitForFunction(()=>window.aeroDiagnostics?.().particles>0,{timeout:120000});
  await page.evaluate(()=>window.aeroReady());
  const start=await page.evaluate(()=>window.aeroDiagnostics());
  assert(start.triangles>0 && start.tracks===640 && start.steps===384);
  assert.equal(start.particles,12000);
  assert.deepEqual(start.emitter,[0.2,2.0]);
  const defaultInputs={
    quality:'12000',precision:'fine',flowmode:'trails',
    pointsize:'1.6',trail:'1.6',opacity:'0.6',palette:'#ffb16d',
    emitterWidth:'0.2',emitterHeight:'2.0',focus:'center',speed:'1.5'
  };
  for(const [id,value] of Object.entries(defaultInputs))
    assert.equal(await page.locator('#'+id).inputValue(),value,'default '+id);
  assert.equal(await page.locator('#tunnel').isChecked(),false);
  assert.equal(await page.locator('#speedval').textContent(),'1,5×');
  assert.deepEqual(start.emitterOffset,[0,0]);
  assert(start.emitterVisible);
  const fixedX=start.emitterX;
  assert(await page.locator('#emitterSelect').isVisible());
  await page.locator('#emitterSelect').click();
  assert((await page.evaluate(()=>window.aeroDiagnostics())).emitterSelected);
  await page.locator('#emitterOffsetY').fill('0.4');
  await page.locator('#emitterOffsetY').dispatchEvent('change');
  await page.evaluate(()=>window.aeroReady());
  await page.locator('#emitterOffsetZ').fill('0.65');
  await page.locator('#emitterOffsetZ').dispatchEvent('change');
  await page.evaluate(()=>window.aeroReady());
  const movedEmitter=await page.evaluate(()=>window.aeroDiagnostics());
  assert.deepEqual(movedEmitter.emitterOffset,[0.4,0.65]);
  assert.equal(movedEmitter.emitterX,fixedX,'moving the emitter cannot change X');
  await page.locator('#emitterReset').click();
  await page.evaluate(()=>window.aeroReady());
  assert.deepEqual((await page.evaluate(()=>window.aeroDiagnostics())).emitterOffset,[0,0]);
  assert.deepEqual((await page.evaluate(()=>window.aeroDiagnostics())).emitter,[0.2,2.0]);
  // Floating control docks must keep a usable internal scrollbar, rotation buttons and resize grips.
  assert(await page.locator('#vehicleDock .rotate-tools [data-axis="x"]').isVisible());
  assert.equal(await page.locator('#vehicleDock [data-axis]').count(),3);
  for(const id of ['vehicleDock','flowDock']){
    const sc=await page.locator('#'+id+' .dock-scroll').evaluate(el=>{
      el.scrollTop=el.scrollHeight;
      return {client:el.clientHeight,total:el.scrollHeight,position:el.scrollTop,
        overflow:getComputedStyle(el).overflowY};
    });
    assert(sc.client>80&&sc.total>sc.client+15&&sc.position>0,
      id+' should support independent vertical scrolling: '+JSON.stringify(sc));
  }
  const leftBefore=(await page.locator('#viewDock').boundingBox()).width;
  const leftGrip=await page.locator('#viewResizeHandle').boundingBox();
  await page.mouse.move(leftGrip.x+leftGrip.width/2,leftGrip.y+leftGrip.height/2);
  await page.mouse.down();await page.mouse.move(leftGrip.x+leftGrip.width/2+62,leftGrip.y+leftGrip.height/2,{steps:6});await page.mouse.up();
  assert((await page.locator('#viewDock').boundingBox()).width>leftBefore+40,
    'left camera panel width must be draggable');
  const rightBefore=(await page.locator('#rightDocks').boundingBox()).width;
  const rightGrip=await page.locator('#rightResizeHandle').boundingBox();
  await page.mouse.move(rightGrip.x+rightGrip.width/2,rightGrip.y+rightGrip.height/2);
  await page.mouse.down();await page.mouse.move(rightGrip.x+rightGrip.width/2-65,rightGrip.y+rightGrip.height/2,{steps:6});await page.mouse.up();
  assert((await page.locator('#rightDocks').boundingBox()).width>rightBefore+40,
    'right control panel width must be draggable');

  assert(await page.locator('#vehicleDock').evaluate(el=>el.open));
  await page.locator('#vehicleDock summary').click();
  assert(!(await page.locator('#vehicleDock').evaluate(el=>el.open)),'vehicle dock collapses');
  await page.locator('#vehicleDock summary').click();
  assert(await page.locator('#flowDock').evaluate(el=>el.open));
  await page.locator('#flowDock summary').click();
  assert(!(await page.locator('#flowDock').evaluate(el=>el.open)),'flow dock collapses');
  await page.locator('#flowDock summary').click();
  assert(await page.locator('#viewDock').evaluate(el=>el.open));
  await page.locator('#viewTypes select').first().selectOption('front');
  assert.equal((await page.evaluate(()=>window.aeroDiagnostics())).viewModes[0],'front');
  await page.locator('#viewTypes select').first().selectOption('3d');
  const b=await page.locator('#stage').boundingBox();
  await page.mouse.move(b.x+b.width*.5,b.y+b.height*.52);
  await page.mouse.wheel(0,-1700);
  await page.waitForTimeout(800);
  const afterZoom=await page.evaluate(()=>window.aeroDiagnostics());
  assert.equal(afterZoom.fieldRevision,start.fieldRevision,'zoom cannot rebuild the velocity atlas');
  assert(afterZoom.focused,'zoom should enable more locally concentrated tracers');
  await page.locator('#layout').selectOption('4');
  const four=await page.evaluate(()=>window.aeroDiagnostics());
  assert.equal(four.views,4);assert.equal(four.fieldRevision,start.fieldRevision);
  const viewScroll=await page.locator('#viewDock .dock-scroll').evaluate(el=>{
    el.scrollTop=el.scrollHeight;
    return {client:el.clientHeight,total:el.scrollHeight,position:el.scrollTop};
  });
  assert(viewScroll.position>0,'four-view controls must scroll vertically');

  await page.screenshot({path:path.resolve(__dirname,'aero-four-views.png')});
  await page.locator('#layout').selectOption('2');
  assert.equal((await page.evaluate(()=>window.aeroDiagnostics())).views,2);
  await page.locator('#layout').selectOption('1');
  await page.locator('#quality').selectOption('24000');
  const dense=await page.evaluate(()=>window.aeroDiagnostics());
  assert.equal(dense.particles,24000);assert.equal(dense.tracks,start.tracks);
  assert.equal(dense.fieldRevision,start.fieldRevision,'particle count is independent of precision');
  await page.locator('#precision').selectOption('balanced');
  await page.evaluate(()=>window.aeroReady());
  const balanced=await page.evaluate(()=>window.aeroDiagnostics());
  assert.equal(balanced.tracks,360);assert.equal(balanced.steps,288);
  assert(balanced.fieldRevision>start.fieldRevision);
  await page.locator('#precision').selectOption('fine');
  await page.evaluate(()=>window.aeroReady());
  const precise=await page.evaluate(()=>window.aeroDiagnostics());
  assert.equal(precise.tracks,640);assert.equal(precise.steps,384);
  assert(precise.fieldRevision>balanced.fieldRevision);
  await page.locator('#length').fill('6');
  await page.locator('#scale').click();await page.evaluate(()=>window.aeroReady());
  const scaled=await page.evaluate(()=>window.aeroDiagnostics());
  assert(Math.abs(scaled.dimensions[0]-6)<.01);assert(scaled.fieldRevision>precise.fieldRevision);
  await page.locator('[data-axis="y"]').click();await page.evaluate(()=>window.aeroReady());
  const rotated=await page.evaluate(()=>window.aeroDiagnostics());
  assert(rotated.fieldRevision>scaled.fieldRevision);
  await page.locator('#clearFocus').click();
  await page.screenshot({path:path.resolve(__dirname,'aero-detail.png')});
  await page.locator('#demo').click();await page.evaluate(()=>window.aeroReady());
  const glb=path.resolve(__dirname,'prueba_caja.glb');
  assert(fs.existsSync(glb),'GLB fixture from check.cjs');
  await page.locator('#file').setInputFiles(glb);
  await page.waitForFunction(()=>window.aeroDiagnostics?.().triangles===12,{timeout:120000});
  await page.evaluate(()=>window.aeroReady());
  assert.equal((await page.evaluate(()=>window.aeroDiagnostics())).triangles,12);
  const velocity=[];
  for(let i=0;i<11*7*9;i++)velocity.push(12,0,0);
  const volume={format:'octos-cfd-v1',units:'m/s',origin:[-7,0,-4],spacing:[1.4,.6,1],
    dimensions:[11,7,9],referenceSpeed:12,displayMaxSpeed:20,source:'Uniform test field',velocity};
  await page.locator('#cfdfile').setInputFiles({
    name:'test-cfd.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(volume))});
  await page.waitForFunction(()=>window.aeroDiagnostics?.().cfd===true,{timeout:120000});
  await page.evaluate(()=>window.aeroReady());
  assert.equal((await page.evaluate(()=>window.aeroDiagnostics())).cfdSource,'Uniform test field');
  const beforeEmitter=await page.evaluate(()=>window.aeroDiagnostics());
  await page.locator('#emitterWidth').fill('1.4');
  await page.locator('#emitterWidth').dispatchEvent('change');
  await page.evaluate(()=>window.aeroReady());
  await page.locator('#emitterHeight').fill('1.1');
  await page.locator('#emitterHeight').dispatchEvent('change');
  await page.evaluate(()=>window.aeroReady());
  const afterEmitter=await page.evaluate(()=>window.aeroDiagnostics());
  assert(afterEmitter.cfd,'emitter editing must preserve imported CFD');
  assert.equal(afterEmitter.cfdSource,beforeEmitter.cfdSource);
  assert.deepEqual(afterEmitter.emitter,[1.4,1.1]);
  assert(afterEmitter.cfd,'resizing emitter must not clear CFD');
  assert(afterEmitter.fieldRevision>beforeEmitter.fieldRevision);
  assert.equal(afterEmitter.particles,24000);
  await page.locator('#clearCFD').click();
  await page.evaluate(()=>window.aeroReady());
  assert.equal((await page.evaluate(()=>window.aeroDiagnostics())).cfd,false);
  await page.locator('#layout').selectOption('1');
  assert.equal(await page.locator('#sectionAxis').inputValue(),'y','Y should be the default cut axis');
  await page.locator('#section').click();
  assert.equal((await page.evaluate(()=>window.aeroDiagnostics())).sectionPick,true);
  const bounds=await page.locator('#stage').boundingBox();
  await page.mouse.click(bounds.x+bounds.width*.47,bounds.y+bounds.height*.70);
  const sliced=await page.evaluate(()=>window.aeroDiagnostics());
  assert.equal(sliced.sectionEnabled,true,'click should activate section');
  assert.equal(sliced.sectionAxis,'y','default section must be normal to Y');
  assert.deepEqual(sliced.sectionNormal,[0,-1,0]);
  assert(sliced.sectionCameraDirection[1]>.999,'Y section camera must face the plane');
  assert.equal(sliced.views,2,'section should open comparative second view');
  assert.deepEqual(sliced.viewModes,['3d','section'],'preserve 3D view alongside section');
  await page.locator('#sectionPosition').evaluate(el=>{el.value='0.4';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert(Math.abs((await page.evaluate(()=>window.aeroDiagnostics())).sectionValue-.4)<.011);
  const sectionViewport=await page.evaluate(()=>{
    const r=document.querySelectorAll('#panels .view')[1].getBoundingClientRect();
    // The resized right dock covers the middle of this viewport.
    // Start the orbit over the exposed canvas, not over floating controls.
    const x=r.left+r.width*.18,y=r.top+r.height*.56;
    return {x,y,hit:document.elementFromPoint(x,y)?.tagName.toLowerCase()};
  });
  assert.equal(sectionViewport.hit,'canvas','orbit gesture must start on the exposed WebGL canvas');
  await page.mouse.move(sectionViewport.x,sectionViewport.y);
  await page.mouse.down();
  await page.mouse.move(sectionViewport.x+65,sectionViewport.y+55,{steps:7});
  await page.mouse.up();
  assert((await page.evaluate(()=>window.aeroDiagnostics())).sectionCameraDirection[1]<.98,
    'dragging section viewport must orbit its camera');
  await page.locator('#sectionAxis').selectOption('x');
  const xSection=await page.evaluate(()=>window.aeroDiagnostics());
  assert.deepEqual(xSection.sectionNormal,[1,0,0]);
  assert(xSection.sectionCameraDirection[0]<-.999,'X cut camera faces the YZ plane');
  await page.locator('#sectionAxis').selectOption('z');
  const zSection=await page.evaluate(()=>window.aeroDiagnostics());
  assert.deepEqual(zSection.sectionNormal,[0,0,-1]);
  assert(zSection.sectionCameraDirection[2]>.999,'Z cut camera faces the XY plane');
  await page.locator('#sectionAxis').selectOption('y');
  await page.screenshot({path:path.resolve(__dirname,'aero-section.png')});
  await page.locator('#clearSection').click();
  assert.equal((await page.evaluate(()=>window.aeroDiagnostics())).sectionEnabled,false);
  if(errors.length)throw Error('Unhandled browser errors: '+errors.join('; '));
  console.log('PASS: Chromium WebGL2, interactive demo, local tracer zoom without field changes, 1/2/4 views, independent particle density/precision, scale, yaw, GLB import, CFD JSON loading, independent emitter size and clearing. '+JSON.stringify({initial:start,zoom:afterZoom,precise,scaled,rotated}));
  } finally {
    await browser.close();
  }
}
test().catch(e=>{console.error(e);process.exitCode=1;});
