const {chromium}=require('playwright');const {call,sheets,mails}=require('./lib.js');require('./aprsetup.js')(sheets);
const tk=n=>{let r=call({acao:'login',nome:n,pin:'123456'});return call({acao:'trocarPin',token:r.token,novo:'731846'}).token;};
const lz=tk('Eng. Luiz Henrique');
const resp={};call({acao:'inicio',token:lz}).apr.itens.forEach(i=>resp[i.id]='Sim');resp.g4='N/A';
console.log(call({acao:'iniciarOS',token:lz,cliente:'Perfileve',tipo:'Manutenção corretiva',equipe:[],apr:{pt:'Sim',ptNumero:'PT-88',ptEmissor:'Carlos, segurança',triagem:{zona:true,altura:false,confinado:false,sep:false},modelo:'Completa',responsavel:'Eng. Luiz Henrique',condicao:'Desenergizada',respostas:resp,riscos:[{risco:'Ruído',medida:'Protetor auricular'}],declaracao:true},geo:{lat:-23.4,lng:-51.9}}).ok);
(async()=>{const b=await chromium.launch();
 async function abrir(nome){const c=await b.newContext({viewport:{width:390,height:844}});const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('dialog',d=>d.accept());
 await p.route('**/config.js',r=>r.fulfill({body:"window.API_URL='https://script.google.com/macros/s/X/exec';",contentType:'application/javascript'}));
 await p.route('https://fonts.**',r=>r.abort());
 await p.route('https://script.google.com/**',r=>{let res;try{res=call(JSON.parse(r.request().postData()))}catch(e){res={ok:false,erro:String(e)}};r.fulfill({body:JSON.stringify(res),contentType:'application/json'})});
 await p.goto('file:///home/claude/app-kiton-campo/index.html');await p.waitForTimeout(300);
 await p.click(`[data-n="${nome}"]`);await p.fill('#pin',nome.includes('Luiz')?'731846':'123456');await p.click('#entrar');await p.waitForTimeout(300);
 if(await p.isVisible('#p1')){await p.fill('#p1','731846');await p.fill('#p2','731846');await p.click('#ok');}
 await p.waitForTimeout(400);return p;}
 const L=await abrir('Eng. Luiz Henrique');
 await L.click('#mOS');await L.waitForTimeout(300);await L.click('#bApontar');await L.waitForTimeout(200);await L.click('[data-t="Final"]');await L.waitForTimeout(400);
 await L.fill('#aExec','Troca do contator.');await L.click('#prox');await L.waitForTimeout(150);await L.click('#prox');await L.waitForTimeout(200);
 await L.click('#aModo [data-v="1"]');await L.fill('#aMot','Sem responsável');await L.click('#aVerApr');await L.waitForTimeout(500);
 await L.screenshot({path:'f_folha.png'});await L.click('#folhaX');await L.click('#aApr [data-v="Não"]');await L.click('#prox');await L.waitForTimeout(500);
 const A=await abrir('Eng. Joaquim Neto');
 await A.click('#btnMenu');await A.click('[data-menu="a-os"]');await A.waitForTimeout(600);await A.click('#painel [data-os]');await A.waitForTimeout(500);
 await A.click('[data-apr]');await A.waitForTimeout(500);await A.screenshot({path:'f_folha2.png',fullPage:false});
 await A.evaluate(()=>document.querySelector('.folha-painel').scrollTop=2000);await A.waitForTimeout(100);await A.screenshot({path:'f_folha3.png'});
 await A.click('#folhaX');await A.click('#admCorr');await A.waitForTimeout(300);
 await A.click('#cApr [data-v="Sim"]');await A.fill('#cMot','Cliente solicitou a APR');await A.click('#cReenv [data-v="1"]');mails.length=0;await A.click('#ok');await A.waitForTimeout(700);
 console.log('mail',mails.map(m=>m.s+' | '+m.anexo));console.log('flag',sheets['Ordens de serviço'][1][sheets['Ordens de serviço'][0].indexOf('APR no PDF do cliente')]);
 await b.close();
})();
