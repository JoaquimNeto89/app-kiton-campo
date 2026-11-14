const {chromium}=require('playwright');const {call,sheets}=require('./lib.js');require('./aprsetup.js')(sheets);
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();
 let resp=true;p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('dialog',d=>{console.log('DIALOG',d.message().slice(0,40),resp);resp?d.accept():d.dismiss();});
 await p.route('**/config.js',r=>r.fulfill({body:"window.API_URL='https://script.google.com/macros/s/X/exec';",contentType:'application/javascript'}));
 await p.route('https://fonts.**',r=>r.abort());
 await p.route('https://script.google.com/**',r=>{let res;try{res=call(JSON.parse(r.request().postData()))}catch(e){res={ok:false,erro:String(e)}};r.fulfill({body:JSON.stringify(res),contentType:'application/json'})});
 await p.goto('file:///home/claude/app-kiton-campo/index.html');await p.waitForTimeout(300);
 await p.click(`[data-n="Eng. Joaquim Neto"]`);await p.fill('#pin','123456');await p.click('#entrar');await p.waitForTimeout(300);
 await p.fill('#p1','731846');await p.fill('#p2','731846');await p.click('#ok');await p.waitForTimeout(400);
 await p.click('#btnMenu');await p.waitForTimeout(200);await p.screenshot({path:'e_menu.png'});
 await p.click('[data-menu="a-os"]');await p.waitForTimeout(600);await p.screenshot({path:'e_os.png'});
 // filtro nao deve sujar
 await p.click('#fPer [data-v="ano"]');await p.waitForTimeout(400);await p.click('#ant');await p.waitForTimeout(400);console.log('home sem dialog:',await p.isVisible('#mOS'));
 // despesa: digita e tenta sair pelo menu, cancela
 await p.click('#mDesp');await p.waitForTimeout(300);
 const nova=await p.$('#nova, #bNova, [id*="ova"]');console.log('botao nova',!!nova);
 await p.click('#mDesp').catch(()=>{});
 await p.click('#irInicio');await p.waitForTimeout(300);
 await p.click('#mOS');await p.waitForTimeout(300);await p.click('#bAgora');await p.waitForTimeout(200);await p.fill('#nLocal','Prensa');
 resp=false;await p.click('#btnMenu');await p.waitForTimeout(200);await p.click('[data-menu="desp"]');await p.waitForTimeout(300);
 console.log('ficou na OS:',await p.isVisible('#nLocal'));
 resp=false;await p.click('#ant');await p.waitForTimeout(200);console.log('ficou2:',await p.isVisible('#nLocal'));
 resp=true;await p.click('#ant');await p.waitForTimeout(400);console.log('saiu:',!(await p.isVisible('#nLocal')));
 await b.close();})();
