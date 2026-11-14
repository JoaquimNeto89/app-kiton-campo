const {chromium}=require('playwright');const {call,sheets}=require('./lib.js');require('./aprsetup.js')(sheets);
const S=n=>`a_${n}.png`;
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
 const shot=async(p,n,full=true)=>p.screenshot({path:S(n),fullPage:full});
 const A=await abrir('Eng. Joaquim Neto');await shot(A,'00home_adm',false);
 await A.click('#mOS');await A.waitForTimeout(300);await A.click('#bProg');await A.waitForTimeout(100);
 await A.selectOption('#pCli','Perfileve');await A.click('#pTipo [data-v="Manutenção corretiva"]');
 await A.click('#pTec [data-v="Eng. Luiz Henrique"]');await A.click('#pTec [data-v="Henrique Barrocal"]');await A.click('#ok');await A.waitForTimeout(400);
 const L=await abrir('Eng. Luiz Henrique');
 await L.click('#mOS');await L.waitForTimeout(300);await L.click('[data-os]');await L.waitForTimeout(300);
 await L.click('#ok');await L.waitForTimeout(200);await L.click('#eqIni [data-v="Henrique Barrocal"]');await L.click('#ok');await L.waitForTimeout(300);
 await shot(L,'01pt');await L.click('#prox');await L.waitForTimeout(100);await shot(L,'01b_pt_erro',false);
 await L.click('.sna [data-v="Sim"]');await L.fill('#ptN','PT-4471');await shot(L,'02pt_sim');await L.click('#prox');await L.waitForTimeout(200);
 const tri=async(k,v)=>{await L.click(`.sna[data-k="${k}"] [data-v="${v}"]`);await L.waitForTimeout(80);};
 await tri('zona','Sim');await tri('altura','Sim');await tri('confinado','Não');await tri('sep','Não');await shot(L,'03triagem');
 await L.click('#prox');await L.waitForTimeout(200);await shot(L,'04check_vazio');
 await L.click('#aResp [data-v="Eng. Luiz Henrique"]');await L.click('#cond [data-v="Desenergizada"]');await L.waitForTimeout(150);
 for(const g of await L.$$('.sna')) await (await g.$('[data-v="Sim"]')).click();
 await L.fill('[data-med="Trabalho em altura"]','Cinto paraquedista e linha de vida');
 for(const g of await L.$$('.sna')) if(!(await g.$('.sel'))) await (await g.$('[data-v="Sim"]')).click();
 await L.check('#aDecl');await shot(L,'05check_cheio');
 await L.click('#prox');await L.waitForTimeout(500);await shot(L,'06bloqueada');
 console.log('wa link',(await L.getAttribute('a[href^="https://wa.me"]','href')).slice(0,160));
 await L.click('#sairB');await L.waitForTimeout(400);await shot(L,'07lista_aprs');
 // admin
 await A.click('#ini').catch(()=>{});await A.goto('file:///home/claude/app-kiton-campo/index.html');await A.waitForTimeout(500);await shot(A,'08home_adm',false);
 await A.click('#mAdmin');await A.waitForTimeout(700);await shot(A,'09admin_os');
 await A.fill('[data-just]','NR-35 renovado, certificado em emissão. Atividade supervisionada.');await A.click('[data-dec][data-l="1"]');await A.waitForTimeout(600);
 // luiz inicia
 await L.click('#ini').catch(()=>{});await L.waitForTimeout(300);await L.click('#mOS');await L.waitForTimeout(400);await shot(L,'10liberada');
 await L.click('[data-aprn]');await L.waitForTimeout(500);await shot(L,'11iniciada',false);
 // home Joaquim aviso ASO
 await b.close();
})();
