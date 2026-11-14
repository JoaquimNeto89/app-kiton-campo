const {call,sheets,mails,events,drive}=require('./lib.js');
sheets['Clientes'][0].push('Cadastrado por');
const show=(t,x)=>console.log(t,'=>',JSON.stringify(x).slice(0,300));
const tk=n=>{let r=call({acao:'login',nome:n,pin:'123456'});return call({acao:'trocarPin',token:r.token,novo:'482915'}).token;};
const adm=tk('Eng. Joaquim Neto'),luiz=tk('Eng. Luiz Henrique'),hb=tk('Henrique Barrocal');
const pad=n=>String(n).padStart(2,'0');const iso=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const now=new Date(), amanha=new Date(Date.now()+864e5), ontem=new Date(Date.now()-864e5);
let r=call({acao:'inicio',token:luiz});show('equipeCampo',r.equipeCampo);show('os inicio',r.os);
show('prog1',call({acao:'programarOS',token:adm,cliente:'Perfileve',tipo:'Manutenção corretiva',local:'Prensa 2',inicioPrev:iso(amanha),fimPrev:iso(new Date(amanha.getTime()+3*36e5)),tecnicos:['Eng. Luiz Henrique']}));
show('prog2 atrasada',call({acao:'programarOS',token:adm,cliente:'Cliente Teste (fictício)',tipo:'Visita técnica',inicioPrev:iso(ontem),fimPrev:iso(new Date(ontem.getTime()+2*36e5)),tecnicos:['Henrique Barrocal','Eng. Luiz Henrique']}));
show('prog fim<ini',call({acao:'programarOS',token:adm,cliente:'Perfileve',tipo:'Outro',inicioPrev:iso(amanha),fimPrev:iso(now),tecnicos:['x']}));
show('events',Object.values(events).map(e=>e.t));
show('minhas luiz',call({acao:'minhasOS',token:luiz}).abertas.map(o=>o.numero+':'+o.status+':'+o.atrasada));
// iniciar OS 1 (antes do programado)
r=call({acao:'iniciarOS',token:luiz,numero:'2026-0001',equipe:['Henrique Barrocal'],geo:{lat:-23.41,lng:-51.94,acc:10}});show('iniciar',r);
show('iniciar de novo',call({acao:'iniciarOS',token:luiz,numero:'2026-0002'}));
show('hb inicia mesma',call({acao:'iniciarOS',token:hb,numero:'2026-0001'}));
const s1=call({acao:'minhasOS',token:luiz}).sessao;show('sessao',s1);
show('apontar sem ass',call({acao:'apontarOS',token:luiz,n:s1.n,tipo:'Parcial',executado:'x'}));
const png='data:image/png;base64,'+Buffer.from('png').toString('base64'),jpg='data:image/jpeg;base64,'+Buffer.from('jpg').toString('base64');
r=call({acao:'apontarOS',token:luiz,n:s1.n,tipo:'Parcial',executado:'Desmontagem do painel',materiais:[{qtd:'2',desc:'Terminal'}],fotos:[jpg],assinatura:png,assinante:'Fábio',cargo:'Manutenção'});show('parcial',r);
show('mails',mails.slice(-1));
show('encerrar sem destino',call({acao:'encerrarAtendimento',token:luiz}));
r=call({acao:'encerrarAtendimento',token:luiz,destino:'Ida para casa'});show('encerrar',r);
show('ck',sheets['Check-ins'].slice(-1)[0].slice(-4));
// dia seguinte: Henrique Barrocal continua (envolvido)
show('minhas hb',call({acao:'minhasOS',token:hb}).abertas.map(o=>o.numero+':'+o.status));
r=call({acao:'iniciarOS',token:hb,numero:'2026-0001',geo:{lat:-23.41,lng:-51.94,acc:10}});show('hb inicia',r);
const s2=call({acao:'minhasOS',token:hb}).sessao;
r=call({acao:'apontarOS',token:hb,n:s2.n,tipo:'Final',executado:'Montagem e testes',ausente:'Fim de expediente, sem responsável',pendencias:'Trocar relé',emails:['manutencao@perfileve.test']});show('final',r);
show('mails',mails.slice(-1));
// outra OS no mesmo cliente sem novo check-in
r=call({acao:'iniciarOS',token:hb,cliente:'Perfileve',tipo:'Visita técnica',solicitacao:'Verificar disjuntor'});show('nova mesma cliente',r);
const s3=call({acao:'minhasOS',token:hb}).sessao;
call({acao:'apontarOS',token:hb,n:s3.n,tipo:'Final',executado:'ok',assinatura:png,assinante:'Fábio'});
show('outro cliente',call({acao:'encerrarAtendimento',token:hb,destino:'Outro cliente'}));
// emergência cliente novo
show('emerg novo',call({acao:'iniciarOS',token:hb,cliente:'Metalurgica Sul',novo:true,cidade:'Sarandi-PR',tipo:'Manutenção corretiva',geo:{lat:-23.44,lng:-51.87,acc:5}}));
// admin
show('editar',call({acao:'editarOS',token:adm,numero:'2026-0002',tecnicos:['Eng. Luiz Henrique'],inicioPrev:iso(amanha),fimPrev:iso(new Date(amanha.getTime()+36e5)),local:'Portaria'}));
show('cancelar sem motivo',call({acao:'cancelarOS',token:adm,numero:'2026-0002'}));
show('cancelar',call({acao:'cancelarOS',token:adm,numero:'2026-0002',motivo:'Cliente adiou'}));
const mes=new Date().toISOString().slice(0,7);
r=call({acao:'painelOS',token:adm,mes});show('painel',r.lista.map(o=>o.numero+':'+o.status+':'+o.inicioVsPrevisto+':'+o.prazo+':'+o.horas));show('portec',r.porTecnico);
show('detalhe',call({acao:'detalheOS',token:adm,numero:'2026-0001'}).apontamentos.map(a=>a.tipo+':'+a.equipe+':'+a.ausente));
show('pend',call({acao:'inicio',token:adm}).pendencias);
const k=Object.keys(drive).find(k=>/^OS 2026-0001 - Perf/.test(drive[k].name||''));require('fs').writeFileSync('os2.html',Buffer.from(drive[k].bytes).toString('utf8'));console.log(Object.values(drive).map(d=>d.name).filter(Boolean));
