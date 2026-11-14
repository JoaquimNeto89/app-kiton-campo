const {chromium}=require('playwright');const {call,sheets,mails,events,drive}=require('./lib.js');
sheets['Clientes'][0].push('Cadastrado por');
const S=n=>`o_${n}.png`;let shots=[];
(async()=>{
 const b=await chromium.launch();
 async function abrir(nome,geo){
  const c=await b.newContext({viewport:{width:390,height:844},geolocation:geo||{latitude:-23.4208,longitude:-51.9331,accuracy:12},permissions:['geolocation']});
  const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',nome,e.message));p.on('dialog',d=>d.accept(d.type()==='prompt'?'Cliente adiou':undefined));
  await p.route('**/config.js',r=>r.fulfill({body:"window.API_URL='https://script.google.com/macros/s/X/exec';",contentType:'application/javascript'}));
  await p.route('https://fonts.**',r=>r.abort());
  await p.route('https://script.google.com/**',r=>{let res;try{res=call(JSON.parse(r.request().postData()))}catch(e){res={ok:false,erro:String(e)}};r.fulfill({body:JSON.stringify(res),contentType:'application/json'})});
  await p.goto('file:///home/claude/app-kiton-campo/index.html');await p.waitForTimeout(300);
  await p.click(`[data-n="${nome}"]`);await p.fill('#pin','123456');await p.click('#entrar');await p.waitForTimeout(300);
  await p.fill('#p1','731846');await p.fill('#p2','731846');await p.click('#ok');await p.waitForTimeout(400);return p;}
 const shot=async(p,n,full=true)=>{await p.screenshot({path:S(n),fullPage:full});shots.push(n);};
 const assinar=async p=>{const box=await p.locator('#cv').boundingBox();await p.mouse.move(box.x+40,box.y+150);await p.mouse.down();for(let i=0;i<30;i++)await p.mouse.move(box.x+40+i*9,box.y+150-Math.sin(i/3)*50);await p.mouse.up();};
 // 1 admin programa
 const A=await abrir('Eng. Joaquim Neto');
 await A.click('#mOS');await A.waitForTimeout(300);await A.click('#bProg');await A.waitForTimeout(100);
 await A.selectOption('#pCli','Cliente Teste (fictício)');await A.fill('#pLocal','Quadro geral');await A.click('#pTipo [data-v="Manutenção preventiva"]');
 await A.fill('#pSolic','Reaperto e termografia do quadro geral');await A.click('#pTec [data-v="Eng. Luiz Henrique"]');await A.click('#pTec [data-v="Henrique Barrocal"]');
 await shot(A,'01prog');await A.click('#ok');await A.waitForTimeout(400);await shot(A,'02lista_adm');
 // 2 Luiz
 const L=await abrir('Eng. Luiz Henrique');await shot(L,'03home_luiz',false);
 await L.click('#mOS');await L.waitForTimeout(300);await shot(L,'04lista_luiz');
 await L.click('[data-os]');await L.waitForTimeout(300);await shot(L,'05detalhe');
 await L.click('#ok');await L.waitForTimeout(200);await L.click('#eqIni [data-v="Henrique Barrocal"]');await shot(L,'06iniciar');
 await L.click('#ok');await L.waitForTimeout(500);await shot(L,'07em_execucao');
 await L.click('#bApontar');await L.waitForTimeout(200);await shot(L,'08tipo');
 await L.click('[data-t="Parcial"]');await L.waitForTimeout(400);await L.fill('#aExec','Reaperto das conexões dos disjuntores 1 a 12.');await L.click('#prox');
 await L.setInputFiles('#aFoto',['foto.jpg']);await L.waitForTimeout(500);await L.click('#prox');await L.waitForTimeout(200);
 await assinar(L);await L.fill('#aAss','Carlos Souza');await shot(L,'09assin_parcial');
 await L.click('#prox');await L.waitForTimeout(600);await shot(L,'10e_agora');
 await L.click('#eFim');await L.waitForTimeout(100);await shot(L,'11destino');await L.click('[data-d="Ida para casa"]');await L.waitForTimeout(500);await shot(L,'12feito');
 // 3 Barrocal continua e finaliza
 const H=await abrir('Henrique Barrocal');await H.click('#mOS');await H.waitForTimeout(300);await H.click('[data-os]');await H.waitForTimeout(300);await H.click('#ok');await H.waitForTimeout(100);await H.click('#ok');await H.waitForTimeout(500);
 await H.click('#bApontar');await H.click('[data-t="Final"]');await H.waitForTimeout(400);await H.fill('#aExec','Termografia do quadro e troca do disjuntor 7.');await H.fill('[data-q]','1');await H.fill('[data-d]','Disjuntor 3P 63 A');await H.fill('#aPend','Programar nova termografia em 6 meses');
 await shot(H,'13final_servico');await H.click('#prox');await H.setInputFiles('#aFoto',['cupom.jpg']);await H.waitForTimeout(500);await H.click('#prox');await H.waitForTimeout(200);
 await H.click('#aModo [data-v="1"]');await H.fill('#aMot','Fim de expediente, sem responsável no local');await H.fill('#aExtra','manutencao@cliente.test');await shot(H,'14ausente');
 await H.click('#prox');await H.waitForTimeout(700);await shot(H,'15e_agora_final');
 await H.click('#eOutra');await H.waitForTimeout(400);await shot(H,'16outra_os');await H.click('#nova');await H.waitForTimeout(200);
 await H.click('#nTipo [data-v="Visita técnica"]');await H.fill('#nSolic','Verificar iluminação da portaria');await shot(H,'17nova_campo');await H.click('#ok');await H.waitForTimeout(500);
 await H.click('#bApontar');await H.click('[data-t="Final"]');await H.waitForTimeout(400);await H.fill('#aExec','Troca de 2 lâmpadas.');await H.click('#prox');await H.click('#prox');await H.waitForTimeout(200);await assinar(H);await H.fill('#aAss','Carlos Souza');await H.click('#prox');await H.waitForTimeout(600);
 await H.click('#eCliente');await H.waitForTimeout(500);await shot(H,'18outro_cliente');
 // 4 admin painel
 await A.click('#ini');await A.waitForTimeout(300);await shot(A,'19home_adm',false);await A.click('#mAdmin');await A.waitForTimeout(300);await A.click('[data-t="os"]');await A.waitForTimeout(400);await shot(A,'20painel');
 await A.click('#painel [data-os]');await A.waitForTimeout(400);await shot(A,'21detalhe_adm');
 console.log(JSON.stringify(mails.map(m=>m.to+' | '+m.s+' | bcc '+m.bcc)));require('fs').writeFileSync('mail_final.html',mails.find(m=>/finalizada/.test(m.s)).html);console.log(JSON.stringify(Object.values(events).map(e=>e.t)));
 console.log(JSON.stringify(sheets['Check-ins'].slice(1).map(r=>r[2]+'|'+r[11]+'|'+r[21]+'|'+r[22])));
 const k=Object.keys(drive).find(k=>/^OS 2026-0001 - Cliente/.test(drive[k].name||''));require('fs').writeFileSync('os_final.html',Buffer.from(drive[k].bytes).toString('utf8'));
 const q=await (await b.newContext()).newPage();await q.setViewportSize({width:794,height:1123});await q.goto('file://'+__dirname+'/os_final.html');await q.screenshot({path:S('22pdf'),fullPage:true});
 await b.close();
 const {execSync}=require('child_process');
})();
