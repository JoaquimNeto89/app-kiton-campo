const {chromium}=require('playwright');const {call,sheets}=require('./lib.js');
sheets['Clientes'][0].push('Cadastrado por');
(async()=>{
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844},geolocation:{latitude:-23.44,longitude:-51.87,accuracy:12},permissions:['geolocation']});
 const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('dialog',d=>d.accept());
 await p.route('**/config.js',r=>r.fulfill({body:"window.API_URL='https://script.google.com/macros/s/X/exec';",contentType:'application/javascript'}));
 await p.route('https://fonts.**',r=>r.abort());
 await p.route('https://script.google.com/**',r=>{let res;try{res=call(JSON.parse(r.request().postData()))}catch(e){res={ok:false,erro:String(e)}};r.fulfill({body:JSON.stringify(res),contentType:'application/json'})});
 await p.goto('file:///home/claude/app-kiton-campo/index.html');await p.waitForTimeout(300);
 await p.click('[data-n="Henrique Barrocal"]');await p.fill('#pin','123456');await p.click('#entrar');await p.waitForTimeout(300);
 await p.fill('#p1','731846');await p.fill('#p2','731846');await p.click('#ok');await p.waitForTimeout(300);
 await p.click('#mCheckin');await p.waitForTimeout(600);await p.fill('#buscaCli','perfilev');await p.waitForTimeout(100);await p.screenshot({path:'c1.png'});
 await p.click('#cliNovo');await p.waitForTimeout(100);await p.screenshot({path:'c2.png',fullPage:true});
 await p.fill('#cnNome','perfil sul industria ltda');await p.fill('#cnCid','sarandi-PR');await p.screenshot({path:'c3.png',fullPage:true});
 await p.click('#ok');await p.waitForTimeout(100);await p.click('#ok');await p.waitForTimeout(400);await p.screenshot({path:'c4.png'});
 console.log(JSON.stringify(sheets['Clientes'].slice(-1)), JSON.stringify(sheets['Check-ins'].slice(-1)[0].slice(0,11)));
 await b.close();})();
