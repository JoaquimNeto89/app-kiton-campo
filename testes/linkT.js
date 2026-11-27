const L=require('./lib.js');const {call,sheets}=L;require('./aprsetup.js')(sheets);const fs=require('fs');
const C=sheets['Colaboradores'];
if(!C.some(r=>r[0]==='Eng. Henrique Treumann')){const r=C[1].slice();r[0]='Eng. Henrique Treumann';r[1]='Campo';r[6]='Engenheiro';C.push(r);}
['Vínculo','Grupo PCMSO','CNPJ/MEI','Início da prestação','Razão social do prestador','CPF','RG','Nome completo'].forEach(h=>{if(C[0].indexOf(h)<0)C[0].push(h)});C.forEach(r=>{while(r.length<C[0].length)r.push('')});
const ix=h=>C[0].indexOf(h);C.forEach(r=>{if(/Treumann/.test(r[0])){r[ix('Vínculo')]='Contrato (prestador)';r[ix('CPF')]='025.068.855-79';r[ix('Nome completo')]='Henrique Treumann Andrade';}});
sheets['EPI - Catálogo']=[['Código','Descrição','CA','Validade do CA','Fabricante','Tamanhos','Troca a cada (dias)','Ativo','Observações','Rastreável','Vida útil (anos)'],['EPI-CAP-001','Capacete','29638',new Date(2027,9,14),'','U','','Sim','','Não','']];
sheets['EPI - Entregas']=[['Nº','Data','Colaborador','Código EPI','Descrição','CA','Tamanho','Quantidade','Motivo','Entregue por','Assinatura','Próxima troca','Situação','Devolvido em','Observações','Data de compra','Nº de série / lote','Vida útil até'],
 ['1',new Date(2026,10,23),'Eng. Henrique Treumann','EPI-CAP-001','Capacete','29638','U',1,'Regularização','Eng. Joaquim Neto','','','Aguardando assinatura','','x','','','']];
const I=sheets['Itens'];const hi=h=>I[0].indexOf(h);const nr=new Array(I[0].length).fill('');nr[hi('Patrimônio')]='ALI-AMP-003';nr[hi('Descrição')]='Alicate amperímetro';nr[hi('Uso')]='Individual';nr[hi('Responsável (uso individual)')]='Eng. Henrique Treumann';nr[hi('Situação')]='Disponível';nr[hi('Valor de reposição (R$)')]=314;I.push(nr);
const tk=require('./boot.js')(call,sheets);const adm=tk('Eng. Joaquim Neto');
const g=call({acao:'gerarLinkAssinatura',token:adm,colaborador:'Eng. Henrique Treumann',base:'https://hub.kitonengenharia.com.br/'});console.log('gerar',g.ok,g.erro,g.link&&g.link.slice(0,60),g.epi,g.termo,g.temCPF);
const t=g.link.split('#assinar=')[1];
const i=call({acao:'linkAssinatura',token:t});console.log('info',i.ok,i.erro,i.nome,i.epi&&i.epi.length,i.termo&&i.termo.length,i.pedeCPF);
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
console.log('cpf errado',JSON.stringify(call({acao:'assinarPorLink',token:t,assinatura:png,cpf3:'111'})));
const a=call({acao:'assinarPorLink',token:t,assinatura:png,cpf3:'025',ua:'teste'});console.log('assinar',JSON.stringify(a));
console.log('reuso',JSON.stringify(call({acao:'linkAssinatura',token:t})));
console.log('ent',JSON.stringify(sheets['EPI - Entregas'][1].slice(9,15)));
console.log('termos',sheets['Termos de ferramentas'].length,JSON.stringify(sheets['Termos de ferramentas'][1]&&sheets['Termos de ferramentas'][1].slice(2,8)));
console.log('links',JSON.stringify(sheets['Links de assinatura'][1]));
console.log('invalido',JSON.stringify(call({acao:'linkAssinatura',token:'abc'})));
console.log('nao-admin',JSON.stringify(call({acao:'gerarLinkAssinatura',token:'x',colaborador:'Eng. Henrique Treumann'})));
// escopo: só termo
sheets['EPI - Entregas'].push(['2',new Date(),'Eng. Henrique Treumann','EPI-CAP-001','Capacete','29638','U',1,'Regularização','Eng. Joaquim Neto','','','Aguardando assinatura','','','','','']);
sheets['Termos de ferramentas'].splice(1);
const g2=call({acao:'gerarLinkAssinatura',token:adm,colaborador:'Eng. Henrique Treumann',docs:['termo']});console.log('g2',g2.ok,g2.erro,g2.epi,g2.termo);
const t2=g2.link.split('#assinar=')[1];const i2=call({acao:'linkAssinatura',token:t2});console.log('i2',i2.epi.length,i2.termo.length);
console.log('a2',JSON.stringify(call({acao:'assinarPorLink',token:t2,assinatura:png,cpf3:'025'})));
console.log('epi ainda aguardando?',sheets['EPI - Entregas'][2][12]);
const g3=call({acao:'gerarLinkAssinatura',token:adm,colaborador:'Eng. Henrique Treumann',docs:['termo']});console.log('g3 (termo ja assinado)',g3.ok,g3.erro);
