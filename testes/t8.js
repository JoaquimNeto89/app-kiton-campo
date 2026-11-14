const {call,sheets,mails,drive}=require('./lib.js');require('./aprsetup.js')(sheets);
const show=(t,x)=>console.log(t,'=>',JSON.stringify(x).slice(0,240));
const tk=n=>{let r=call({acao:'login',nome:n,pin:'123456'});return call({acao:'trocarPin',token:r.token,novo:'731846'}).token;};
const hb=tk('Henrique Barrocal'),adm=tk('Eng. Joaquim Neto'),lz=tk('Eng. Luiz Henrique');
const apr=r=>({pt:'Não se aplica',triagem:{zona:false,altura:false,confinado:false,sep:false},modelo:'Reduzida',responsavel:r,respostas:{b1:'Sim',b2:'Sim',b3:'Sim',p3:'Sim',g1:'Sim',g2:'Sim',g3:'Sim',g4:'Sim',h1:'Sim'},declaracao:true});
for(const [t,n] of [[hb,'Henrique Barrocal'],[lz,'Eng. Luiz Henrique']]){call({acao:'iniciarOS',token:t,cliente:'Perfileve',tipo:'Visita técnica',equipe:[],apr:apr(n)});
 const s=call({acao:'minhasOS',token:t}).sessao;call({acao:'apontarOS',token:t,n:s.n,tipo:'Final',executado:'x',ausente:'y',emails:['c@cli.test'],incluirAPR:true});}
mails.length=0;
show('completa',call({acao:'aprovarOS',token:adm,numero:'2026-0001',enviar:true,apr:'completa',emails:['c@cli.test']}));
show('sem',call({acao:'aprovarOS',token:adm,numero:'2026-0002',enviar:false,apr:'resumida',emails:['c@cli.test']}));
show('mails',mails.map(m=>[m.to,m.cc,m.bcc,m.s,m.anexo]));
const os=sheets['Ordens de serviço'];const c=os[0].indexOf('APR no PDF do cliente');show('flags',os.slice(1).map(r=>r[c]));
const k=Object.keys(drive).filter(k=>drive[k].name&&/^OS 2026-0001 - Perfileve/.test(drive[k].name)).pop();console.log('apr pages in final:',(Buffer.from(drive[k].bytes).toString('utf8').match(/class="apr"/g)||[]).length);
show('enviar depois',call({acao:'reenviarOS',token:adm,numero:'2026-0002'}));
