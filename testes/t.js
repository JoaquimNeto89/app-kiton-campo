const {call,sheets,drive,mails}=require('./lib.js');
const show=(t,x)=>console.log(t,'=>',JSON.stringify(x).slice(0,260));
const login=(n)=>{let r=call({acao:'login',nome:n,pin:'123456'});r=call({acao:'trocarPin',token:r.token,novo:'482915'});return r.token;};
const adm=login('Eng. Joaquim Neto'), luiz=login('Eng. Luiz Henrique');
let r=call({acao:'inicio',token:adm});
show('meus adm',r.meus.map(i=>i.pat)); show('itens saída',r.itens.map(i=>i.pat)); show('listas',[r.tiposOS.length,r.categoriasDespesa,r.pagamentosDespesa]);
show('clientesInfo',r.clientesInfo);
// check-in
show('ck perto',call({acao:'checkin',token:luiz,cliente:'Cliente Teste (fictício)',geo:{lat:-23.4210,lng:-51.9335,acc:15}}));
show('ck duplo',call({acao:'checkin',token:luiz,cliente:'Perfileve'}));
r=call({acao:'inicio',token:luiz});show('aberto',r.checkin);
show('checkout',call({acao:'checkout',token:luiz,n:r.checkin.n,geo:{lat:-23.43,lng:-51.95,acc:10}}));
show('ck sem local',call({acao:'checkin',token:luiz,cliente:'Perfileve',geo:{lat:-23.39,lng:-51.92,acc:20}}));
const mes=new Date().toISOString().slice(0,7);
r=call({acao:'presenca',token:adm,mes});show('presenca',r);
show('def local',call({acao:'definirLocalCliente',token:adm,n:'2'}));
show('ck após def',sheets['Check-ins'].map(x=>x[9]+'|'+x[8]));
show('ck fora',(()=>{call({acao:'checkout',token:luiz,n:'2'});return call({acao:'checkin',token:luiz,cliente:'Perfileve',geo:{lat:-23.45,lng:-51.92,acc:20}})})());
// OS
const png='data:image/png;base64,'+Buffer.from('fakepng').toString('base64');
r=call({acao:'salvarOS',token:luiz,cliente:'Perfileve',tipo:'Visita técnica',executado:'Troca de contator',assinatura:png,assinante:'Fábio',emails:['manutencao@perfileve.test'],materiais:[{desc:'Contator',qtd:'1'}],fotos:[png],checkin:'3'});
show('OS',r); show('mails',mails); show('OS sheet',sheets['Ordens de serviço'][1].slice(0,24));
show('OS sem ass',call({acao:'salvarOS',token:luiz,cliente:'Perfileve',executado:'x'}));
show('OS mail inválido',call({acao:'salvarOS',token:luiz,cliente:'Perfileve',executado:'x',assinatura:png,assinante:'a',emails:['x@']}));
show('listar',call({acao:'listarOS',token:luiz}));
show('reenviar',call({acao:'reenviarOS',token:luiz,numero:r.numero}));
const html=Buffer.from(drive[Object.keys(drive).find(k=>/OS /.test(drive[k].name))].bytes).toString('utf8');
require('fs').writeFileSync('os.html',html);
// despesas
show('desp sem foto',call({acao:'salvarDespesa',token:luiz,categoria:'Alimentação',valor:45.5}));
show('desp',call({acao:'salvarDespesa',token:luiz,categoria:'Alimentação',valor:45.5,cliente:'Perfileve',foto:'data:image/jpeg;base64,'+Buffer.from('jpg').toString('base64')}));
show('desp sem comp',call({acao:'salvarDespesa',token:luiz,categoria:'Pedágio',valor:12.3,semFotoMotivo:'cabine automática'}));
// saída + retorno com combustível
let s=call({acao:'registrarSaida',token:luiz,motivo:'Atendimento em cliente',destino:'Perfileve',veiculo:'Particular',itens:[{pat:'ESC-FIB-001'}]});
show('retorno',call({acao:'registrarRetorno',token:luiz,n:s.n,abastecimento:'Pago pelo colaborador (particular)',valor:150,foto:'data:image/jpeg;base64,'+Buffer.from('cupom').toString('base64')}));
show('minhas',call({acao:'minhasDespesas',token:luiz}).lista.map(x=>x.n+':'+x.categoria+':'+x.valor+':'+x.situacao));
show('pendentes',call({acao:'despesasPendentes',token:adm}).lista.length);
show('recusar sem motivo',call({acao:'conferirDespesa',token:adm,n:'1',resultado:'Recusada'}));
call({acao:'conferirDespesa',token:adm,n:'1',resultado:'Aprovada'});call({acao:'conferirDespesa',token:adm,n:'3',resultado:'Aprovada'});call({acao:'conferirDespesa',token:adm,n:'2',resultado:'Recusada',motivo:'sem nota'});
show('fech',call({acao:'fechamento',token:adm,mes}).pessoas);
show('reemb',call({acao:'marcarReembolso',token:adm,mes,nome:'Eng. Luiz Henrique'}));
show('fech2',call({acao:'fechamento',token:adm,mes}).pessoas.find(p=>p.nome==='Eng. Luiz Henrique'));
show('campo admin negado',call({acao:'despesasPendentes',token:luiz}));
// novo item
r=call({acao:'cadastroInfo',token:adm});show('info',{g:r.grupos.map(g=>g.grupo+':'+g.prefixos),ult:r.ultimos,kits:r.kits,locais:r.locais});
show('novo',call({acao:'novoItem',token:adm,prefixo:'esc-fib',descricao:'Escada nova',tipo:'Ferramenta',grupo:'Escada',quantidade:2,ident:'5',estado:'N',valor:700,local:'Almox'}));
show('novo ruim',call({acao:'novoItem',token:adm,prefixo:'ES-FIB',descricao:'x',tipo:'Ferramenta'}));
show('novo indiv sem resp',call({acao:'novoItem',token:adm,prefixo:'MUL-DIG',descricao:'x',tipo:'Instrumento',uso:'Individual'}));
console.log(sheets['Itens'].slice(-2).map(x=>x.slice(0,15).join('|')));
