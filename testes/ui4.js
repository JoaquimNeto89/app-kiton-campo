const {chromium}=require('playwright');const {call}=require('./lib.js');
(async()=>{
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));
 await p.route('**/config.js',r=>r.fulfill({body:"window.API_URL='https://script.google.com/macros/s/X/exec';",contentType:'application/javascript'}));
 await p.route('https://fonts.**',r=>r.abort());
 await p.route('https://script.google.com/**',r=>{let res;try{res=call(JSON.parse(r.request().postData()))}catch(e){res={ok:false,erro:String(e)}};r.fulfill({body:JSON.stringify(res),contentType:'application/json'})});
 await p.goto('file:///home/claude/app-kiton-campo/index.html');await p.waitForTimeout(400);await p.screenshot({path:'h1.png',fullPage:true});
 await p.click('[data-n="Eng. Joaquim Neto"]');await p.fill('#pin','123456');await p.click('#entrar');await p.waitForTimeout(300);
 await p.fill('#p1','731846');await p.fill('#p2','731846');await p.click('#ok');await p.waitForTimeout(300);
 await p.screenshot({path:'h2.png',fullPage:true});
 await p.click('#mCheckin');await p.waitForTimeout(200);
 const href=await p.evaluate(()=>{const a=document.getElementById('btnAjuda');a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return a.href;});
 console.log(decodeURIComponent(href));
 await b.close();})();
