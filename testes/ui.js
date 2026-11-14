const {chromium}=require('playwright');const {call,sheets,mails}=require('./lib.js');
const S=n=>`s_${n}.png`;
(async()=>{
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844},geolocation:{latitude:-23.4208,longitude:-51.9331,accuracy:12},permissions:['geolocation']});
 const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error'&&!/TUNNEL|fonts/.test(m.text()))console.log('CONSOLE',m.text())});
 p.on('dialog',d=>d.accept(d.type()==='prompt'?'sem nota fiscal':undefined));
 await p.route('**/config.js',r=>r.fulfill({body:"window.API_URL='https://script.google.com/macros/s/X/exec';",contentType:'application/javascript'}));
 await p.route('https://fonts.**',r=>r.abort());
 await p.route('https://script.google.com/**',r=>{let res;try{res=call(JSON.parse(r.request().postData()))}catch(e){res={ok:false,erro:String(e)}};r.fulfill({body:JSON.stringify(res),contentType:'application/json'})});
 await p.goto('file:///home/claude/app-kiton-campo/index.html');await p.waitForTimeout(300);
 await p.click('[data-n="Eng. Joaquim Neto"]');await p.fill('#pin','123456');await p.click('#entrar');await p.waitForTimeout(300);
 await p.fill('#p1','731846');await p.fill('#p2','731846');await p.click('#ok');await p.waitForTimeout(300);
 await p.screenshot({path:S('home'),fullPage:true});
 await p.click('#mMeus');await p.waitForTimeout(150);await p.screenshot({path:S('meus'),fullPage:true});await p.click('#ini');
 // check-in
 await p.click('#mCheckin');await p.waitForTimeout(700);await p.screenshot({path:S('ck1'),fullPage:true});
 await p.click('[data-c="Cliente Teste (fictício)"]');await p.waitForTimeout(200);await p.screenshot({path:S('ck2'),fullPage:true});
 await p.fill('#obs','Manutenção no quadro geral');await p.click('#ok');await p.waitForTimeout(500);await p.screenshot({path:S('ck3')});
 await p.click('#fim');await p.waitForTimeout(300);await p.screenshot({path:S('home2'),fullPage:true});
 await p.click('#mCheckin');await p.waitForTimeout(200);await p.screenshot({path:S('ck4'),fullPage:true});
 // OS a partir do check-in
 await p.click('#bOS');await p.waitForTimeout(200);
 await p.click('#oTipo [data-v="Manutenção corretiva"]');await p.fill('#oLocal','Quadro geral');await p.fill('#oSol','Carlos');await p.fill('#oIni','08:00');await p.fill('#oFim','11:30');
 await p.click('#oTec [data-v="Henrique Barrocal"]');await p.screenshot({path:S('os1'),fullPage:true});
 await p.click('#prox');await p.fill('#oSolic','Disjuntor geral desarmando');await p.fill('#oExec','Reaperto das conexões do barramento.\nTroca do disjuntor de 125 A.');
 await p.fill('[data-q]','1');await p.fill('[data-d]','Disjuntor 3P 125 A');await p.click('#addMat');await p.locator('[data-q]').nth(1).fill('2');await p.locator('[data-d]').nth(1).fill('Terminal 35 mm²');
 await p.fill('#oPend','Recomendar termografia em 30 dias');await p.screenshot({path:S('os2'),fullPage:true});
 await p.click('#prox');await p.setInputFiles('#oFoto',['foto.jpg','cupom.jpg']);await p.waitForTimeout(600);await p.screenshot({path:S('os3'),fullPage:true});
 await p.click('#prox');await p.waitForTimeout(200);
 const box=await p.locator('#cv').boundingBox();await p.mouse.move(box.x+40,box.y+150);await p.mouse.down();
 for(let i=0;i<30;i++)await p.mouse.move(box.x+40+i*9,box.y+150-Math.sin(i/3)*50);await p.mouse.up();
 await p.fill('#oAss','Carlos Souza');await p.fill('#oCargo','Manutenção');await p.screenshot({path:S('os4'),fullPage:true});
 await p.click('#prox');await p.waitForTimeout(600);await p.screenshot({path:S('os5')});
 console.log('mails',JSON.stringify(mails));
 // despesas
 await p.click('#fim');await p.waitForTimeout(300);await p.click('#mDesp');await p.waitForTimeout(300);await p.click('#nova');
 await p.click('#dCat [data-v="Alimentação"]');await p.fill('#dValor','58,90');await p.fill('#dDesc','Almoço equipe');await p.setInputFiles('#dFoto','cupom.jpg');await p.waitForTimeout(500);
 await p.screenshot({path:S('d1'),fullPage:true});await p.click('#ok');await p.waitForTimeout(400);await p.click('#fim');await p.waitForTimeout(300);
 await p.click('#mDesp');await p.waitForTimeout(300);await p.screenshot({path:S('d2'),fullPage:true});await p.click('#ini');
 // checkout
 await p.click('#mCheckin');await p.click('#bSai');await p.click('#ok');await p.waitForTimeout(400);await p.click('#fim');await p.waitForTimeout(300);
 // admin
 await p.click('#mAdmin');await p.waitForTimeout(300);await p.click('[data-t="desp"]');await p.waitForTimeout(300);await p.screenshot({path:S('a1'),fullPage:true});
 await p.click('.cartao [data-v="Aprovada"]');await p.waitForTimeout(300);
 await p.click('[data-t="pres"]');await p.waitForTimeout(300);await p.screenshot({path:S('a2'),fullPage:true});
 await p.click('[data-t="fech"]');await p.waitForTimeout(300);await p.screenshot({path:S('a3'),fullPage:true});
 await p.click('#ant');await p.waitForTimeout(300);
 // novo item
 await p.click('#mCad');await p.click('#novoItem');await p.waitForTimeout(300);
 await p.selectOption('#nGrupo','Escada');await p.fill('#nQtd','2');await p.fill('#nIdent','5');await p.fill('#nValor','700');await p.waitForTimeout(100);
 await p.screenshot({path:S('n1'),fullPage:true});await p.click('#ok');await p.waitForTimeout(300);await p.screenshot({path:S('n2')});
 // OS lista
 await p.click('#fim');await p.click('#ini');await p.waitForTimeout(300);await p.click('#mOS');await p.waitForTimeout(300);await p.screenshot({path:S('os6'),fullPage:true});
 const fs=require('fs');const {drive}=require('./lib.js');const k=Object.keys(drive).find(k=>/^OS /.test(drive[k].name));fs.writeFileSync('os.html',Buffer.from(drive[k].bytes).toString('utf8'));
 const q=await c.newPage();await q.goto('file://'+__dirname+'/os.html');await q.pdf({path:'os.pdf',format:'A4'});await q.setViewportSize({width:794,height:1123});await q.screenshot({path:S('pdf'),fullPage:true});
 await b.close();})();
