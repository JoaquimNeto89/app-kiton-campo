const {call,sheets,mails,drive}=require('./lib.js');require('./aprsetup.js')(sheets);
const show=(t,x)=>console.log(t,'=>',JSON.stringify(x).slice(0,400));
const tk=n=>{let r=call({acao:'login',nome:n,pin:'123456'});return call({acao:'trocarPin',token:r.token,novo:'482915'}).token;};
const adm=tk('Eng. Joaquim Neto'),luiz=tk('Eng. Luiz Henrique'),hb=tk('Henrique Barrocal');
const pad=n=>String(n).padStart(2,'0');const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const am=new Date(Date.now()+864e5);
show('prog',call({acao:'programarOS',token:adm,cliente:'Perfileve',tipo:'Manutenção corretiva',local:'Prensa 2',inicioPrev:iso(am),fimPrev:iso(new Date(am.getTime()+3*36e5)),tecnicos:['Eng. Luiz Henrique','Henrique Barrocal']}));
let r=call({acao:'inicio',token:luiz});show('apr cfg',r.apr.reduzida);show('treinos',r.treinamentos);
const resp={};r.apr.itens.forEach(i=>resp[i.id]='Sim');
const apr=(o={})=>Object.assign({pt:'Sim',ptNumero:'PT-123',triagem:{zona:true,altura:true,confinado:false,sep:false},modelo:'Completa',responsavel:'Eng. Luiz Henrique',condicao:'Desenergizada',respostas:Object.assign({},resp),riscos:[{risco:'Trabalho em altura',medida:'Cinto paraquedista e linha de vida'}],declaracao:true},o);
show('sem apr',call({acao:'iniciarOS',token:luiz,numero:'2026-0001',equipe:['Henrique Barrocal']}));
show('pt sem dados',call({acao:'iniciarOS',token:luiz,numero:'2026-0001',apr:apr({ptNumero:''})}));
show('falta item',call({acao:'iniciarOS',token:luiz,numero:'2026-0001',apr:apr({respostas:{b1:'Sim'}})}));
r=call({acao:'iniciarOS',token:luiz,numero:'2026-0001',equipe:['Henrique Barrocal'],apr:apr(),geo:{lat:-23.4,lng:-51.9}});show('bloq treino',r);
console.log(r.resumo);
show('mail',mails.slice(-1).map(m=>[m.to,m.s]));
show('minhas aprs',call({acao:'minhasOS',token:luiz}).aprs);
show('pend adm',call({acao:'inicio',token:adm}).pendencias);
show('painel',call({acao:'aprPainel',token:adm}));
show('usar antes',call({acao:'iniciarOS',token:luiz,aprN:r.apr}));
show('decidir sem just',call({acao:'decidirAPR',token:adm,n:r.apr,liberar:true}));
show('decidir',call({acao:'decidirAPR',token:adm,n:r.apr,liberar:true,justificativa:'Treinamento NR-35 renovado, certificado em emissão. Trabalho supervisionado pelo Eng. Joaquim.'}));
show('hb usar apr do luiz',call({acao:'iniciarOS',token:hb,aprN:r.apr}));
r=call({acao:'iniciarOS',token:luiz,aprN:r.apr,geo:{lat:-23.4,lng:-51.9}});show('iniciar com liberada',r);
show('reusar',call({acao:'iniciarOS',token:luiz,aprN:'1'}));
const s=call({acao:'minhasOS',token:luiz}).sessao;
show('apontar final',call({acao:'apontarOS',token:luiz,n:s.n,tipo:'Final',executado:'Troca do contator K3.',fotos:[1,2,3,4].map(()=>'data:image/jpeg;base64,'+require('fs').readFileSync('foto.jpg').toString('base64')),assinatura:'data:image/png;base64,iVBORw0KGgo=',assinante:'Carlos Souza',cargo:'Manutenção',emails:['c@cli.test'],incluirAPR:true}));
show('APR sheet',sheets['APR'].map(x=>[x[0],x[2],x[3],x[9],x[20],x[26]]));
// OS nova em campo, reduzida, só ASO exigido; Barrocal (ASO ok)
r=call({acao:'iniciarOS',token:hb,cliente:'Perfileve',tipo:'Visita técnica',equipe:[],apr:{pt:'Não se aplica',triagem:{zona:false,altura:false,confinado:false,sep:false},modelo:'Reduzida',responsavel:'Henrique Barrocal',respostas:{b1:'Sim',b2:'Sim',b3:'Sim',p3:'Sim',g1:'Sim',g2:'N/A',g3:'Sim',g4:'Não',h1:'Sim'},declaracao:true},geo:{lat:-23.4,lng:-51.9}});show('reduzida',r);
// reduzida pedida mas tipo nao permite -> vira completa e exige itens
show('reduzida invalida',call({acao:'iniciarOS',token:adm,cliente:'Perfileve',tipo:'Manutenção corretiva',equipe:[],apr:{pt:'Não',triagem:{zona:false,altura:false,confinado:false,sep:false},modelo:'Reduzida',responsavel:'Eng. Joaquim Neto',respostas:{b1:'Sim',b2:'Sim',b3:'Sim',p3:'Sim',g1:'Sim',g2:'N/A',g3:'Sim',g4:'Não',h1:'Sim'},declaracao:true}}));
// impeditivo por resposta
const rr=Object.assign({},resp,{d2:'Não'});
show('imp resposta',call({acao:'iniciarOS',token:adm,cliente:'Perfileve',tipo:'Manutenção corretiva',equipe:[],apr:apr({responsavel:'Eng. Joaquim Neto',triagem:{zona:true,altura:false,confinado:false,sep:false},riscos:[],respostas:rr})}));
// corrige -> passa e substitui bloqueio
show('corrigido',call({acao:'iniciarOS',token:adm,cliente:'Perfileve',tipo:'Manutenção corretiva',equipe:[],apr:apr({responsavel:'Eng. Joaquim Neto',triagem:{zona:true,altura:false,confinado:false,sep:false},riscos:[]})}));
show('APR sheet2',sheets['APR'].map(x=>[x[0],x[2],x[3],x[9],x[20]]));
show('inicio adm',(()=>{const x=call({acao:'inicio',token:adm});return [x.meusTreinos,x.pendencias];})());
require('fs').writeFileSync('os_apr.html',Buffer.from(drive[Object.keys(drive).filter(k=>drive[k].name&&drive[k].name.startsWith('OS 2026-0001 -')).pop()].bytes).toString('utf8'));
const h1=require('fs').readFileSync('os_apr.html','utf8');console.log('com APR no PDF:',h1.includes('Análise preliminar de risco'),h1.includes('exceção'));
const s2=call({acao:'minhasOS',token:hb}).sessao;
show('final sem apr',call({acao:'apontarOS',token:hb,n:s2.n,tipo:'Final',executado:'Visita.',ausente:'fim de expediente',emails:[]}));
const k=Object.keys(drive).filter(k=>drive[k].name&&drive[k].name.startsWith('OS 2026-0002 -')).pop();
console.log('sem APR no PDF:',!Buffer.from(drive[k].bytes).toString('utf8').includes('Análise preliminar de risco'));
console.log('coluna OS:',sheets['Ordens de serviço'].map(r=>r[r.length-1]));
const r4=Object.assign({},resp,{p4:'Não'});
show('p4 desenerg',call({acao:'iniciarOS',token:luiz,cliente:'Perfileve',tipo:'Manutenção corretiva',equipe:[],apr:apr({responsavel:'Eng. Luiz Henrique',triagem:{zona:true,altura:false,confinado:false,sep:false},riscos:[],respostas:r4})}));
