const {chromium}=require('playwright');const {call,sheets}=require('./lib.js');require('./aprsetup.js')(sheets);
const tk=n=>{let r=call({acao:'login',nome:n,pin:'123456'});return call({acao:'trocarPin',token:r.token,novo:'731846'}).token;};
const hb=tk('Henrique Barrocal'),lz=tk('Eng. Luiz Henrique');
const apr=(r)=>({pt:'Não se aplica',triagem:{zona:false,altura:false,confinado:false,sep:false},modelo:'Reduzida',responsavel:r,respostas:{b1:'Sim',b2:'Sim',b3:'Sim',p3:'Sim',g1:'Sim',g2:'Sim',g3:'Sim',g4:'Sim',h1:'Sim'},declaracao:true});
for(const [t,n,c] of [[hb,'Henrique Barrocal','Perfileve'],[lz,'Eng. Luiz Henrique','Cliente Teste (fictício)']]){
 console.log(call({acao:'iniciarOS',token:t,cliente:c,tipo:'Visita técnica',equipe:[],apr:apr(n)}).ok);
 const s=call({acao:'minhasOS',token:t}).sessao;call({acao:'apontarOS',token:t,n:s.n,tipo:'Final',executado:'x',ausente:'y',emails:[]});}
(async()=>{
 const b=await chromium.launch();
 const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('dialog',d=>d.accept());
 await p.route('**/config.js',r=>r.fulfill({body:"window.API_URL='https://script.google.com/macros/s/X/exec';",contentType:'application/javascript'}));
 await p.route('https://fonts.**',r=>r.abort());
 await p.route('https://script.google.com/**',r=>{let res;try{res=call(JSON.parse(r.request().postData()))}catch(e){res={ok:false,erro:String(e)}};r.fulfill({body:JSON.stringify(res),contentType:'application/json'})});
 await p.goto('file:///home/claude/app-kiton-campo/index.html');await p.waitForTimeout(300);
 await p.click(`[data-n="Eng. Joaquim Neto"]`);await p.fill('#pin','123456');await p.click('#entrar');await p.waitForTimeout(300);
 await p.fill('#p1','731846');await p.fill('#p2','731846');await p.click('#ok');await p.waitForTimeout(400);
 await p.click('#mAdmin');await p.waitForTimeout(500);await p.click('[data-t="os"]');await p.waitForTimeout(600);
 await p.screenshot({path:'c_lista.png',fullPage:true});
 await p.click('#fVis [data-v="resumo"]');await p.waitForTimeout(500);await p.screenshot({path:'c_resumo.png',fullPage:true});
 await p.click('#fMais');await p.waitForTimeout(300);await p.selectOption('#fCol','Henrique Barrocal');await p.waitForTimeout(500);await p.click('#fPer [data-v="periodo"]');await p.waitForTimeout(500);
 await p.screenshot({path:'c_filtro.png',fullPage:true});
 await p.click('[data-t="seg"]');await p.waitForTimeout(500);await p.screenshot({path:'c_seg.png',fullPage:true});
 await b.close();})();
