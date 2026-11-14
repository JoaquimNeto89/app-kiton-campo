const {chromium}=require('playwright');const {call,sheets}=require('./lib.js');require('./aprsetup.js')(sheets);
(async()=>{
 const b=await chromium.launch();
 async function abrir(nome){
  const c=await b.newContext({viewport:{width:390,height:844},geolocation:{latitude:-23.4208,longitude:-51.9331,accuracy:12},permissions:['geolocation']});
  const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',nome,e.message));p.on('dialog',d=>d.accept());
  await p.route('**/config.js',r=>r.fulfill({body:"window.API_URL='https://script.google.com/macros/s/X/exec';",contentType:'application/javascript'}));
  await p.route('https://fonts.**',r=>r.abort());
  await p.route('https://script.google.com/**',r=>{let res;try{res=call(JSON.parse(r.request().postData()))}catch(e){res={ok:false,erro:String(e)}};r.fulfill({body:JSON.stringify(res),contentType:'application/json'})});
  await p.goto('file:///home/claude/app-kiton-campo/index.html');await p.waitForTimeout(300);
  await p.click(`[data-n="${nome}"]`);await p.fill('#pin','123456');await p.click('#entrar');await p.waitForTimeout(300);
  await p.fill('#p1','731846');await p.fill('#p2','731846');await p.click('#ok');await p.waitForTimeout(400);return p;}
 const H=await abrir('Henrique Barrocal');
 await H.click('#mOS');await H.waitForTimeout(300);await H.click('#bAgora');await H.waitForTimeout(200);
 await H.selectOption('#nCli','Perfileve');await H.click('#nTipo [data-v="Visita técnica"]');await H.click('#ok');await H.waitForTimeout(300);
 await H.click('.sna [data-v="Não se aplica"]');await H.click('#prox');await H.waitForTimeout(150);
 for(const k of ['zona','altura','confinado','sep']) await H.click(`.sna[data-k="${k}"] [data-v="Não"]`);
 await H.click('#prox');await H.waitForTimeout(200);
 for(const g of await H.$$('.sna')) await (await g.$('[data-v="Sim"]')).click();
 await H.check('#aDecl');await H.click('#prox');await H.waitForTimeout(500);
 await H.click('#bApontar');await H.waitForTimeout(200);await H.click('[data-t="Final"]');await H.waitForTimeout(400);
 await H.fill('#aExec','Visita.');await H.click('#prox');await H.waitForTimeout(150);
 await H.screenshot({path:'b_fotos.png'});
 await H.setInputFiles('#aFotoG',['foto.jpg']);await H.waitForTimeout(400);await H.click('#prox');await H.waitForTimeout(200);
 await H.click('#aModo [data-v="1"]');await H.fill('#aMot','Sem responsável');
 await H.click('#prox');await H.waitForTimeout(300);await H.screenshot({path:'b_semapr.png'});
 await H.click('#aApr [data-v="Não"]');await H.screenshot({path:'b_final.png',fullPage:true});await H.click('#prox');await H.waitForTimeout(600);
 const A=await abrir('Eng. Joaquim Neto');
 await A.click('#mAdmin');await A.waitForTimeout(500);await A.click('[data-t="os"]');await A.waitForTimeout(600);
 await A.click('#painel [data-os]');await A.waitForTimeout(400);await A.screenshot({path:'b_det.png',fullPage:true});
 await A.click('#admCorr');await A.waitForTimeout(300);await A.click('[data-vf]');await A.waitForTimeout(400);
 await A.fill('#cMot','Material não informado');await A.click('#cReenv [data-v="0"]');await A.screenshot({path:'b_corr.png',fullPage:true});
 await A.click('#ok');await A.waitForTimeout(600);await A.click('#admReab');await A.waitForTimeout(300);await A.fill('#rMot','Retorno');await A.click('#ok');await A.waitForTimeout(500);
 await A.screenshot({path:'b_reab.png',fullPage:true});
 await b.close();})();
