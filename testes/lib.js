const crypto=require('crypto'),fs=require('fs'),vm=require('vm');
const IH=["Patrimônio","Descrição","Tipo","Grupo","Nº pintado / gravado","Uso","Responsável (uso individual)","Kit (patrimônio do kit)","Marca / modelo","Nº de série","Estado","Valor de reposição (R$)","Data de aquisição","Local de guarda","Situação","Data da calibração","Nº certificado","Periodicidade","Validade da calibração","Status da calibração","Dias para vencer","Fornecedor da calibração","Custo última calibração (R$)","Observações"];
const r=(a)=>{const o=new Array(24).fill('');a.forEach((v,i)=>o[i]=v);return o;};
const sheets={
 'Itens':[IH,
  r(["ESC-FIB-001","Escada de fibra","Ferramenta","Escada","1","Coletivo","","","","","UB",650,"","Almox","Disponível"]),
  r(["ESC-FIB-002","Escada de fibra","Ferramenta","Escada","2","Coletivo","","","","","UB",650,"","Almox","Disponível"]),
  r(["KIT-BLQ-001","Kit bloqueio","Kit","Kit de bloqueio","1","Coletivo","","","","","N",600,"","EPC","Disponível"]),
  r(["CAD-BLQ-001","Cadeado","EPC","Cadeado de bloqueio","1","Coletivo","","KIT-BLQ-001","","","N",95,"","EPC","Disponível"]),
  r(["MLT-TUS-001","Maleta de survey TUS","Instrumento","Maleta de survey","1","Coletivo","","","Kiton / TUS16","TUS-01","",5000,"","Armário","Disponível",new Date(2024,4,20),"Var","Bienal",new Date(2026,4,20),"Vencido",-177]),
  r(["ALI-AMP-003","Alicate amperímetro","Instrumento","Alicate amperímetro","3","Individual","Eng. Joaquim Neto","","Habotest","H12","",250,"","","Disponível","","","","","Sem calibração",""]),
  r(["NTB-COM-001","Notebook","Equipamento","Notebook","1","Individual","Eng. Joaquim Neto","","Dell","","",3500,"","","Disponível"]),
  r(["NTB-COM-004","Notebook","Equipamento","Notebook","4","Individual","Eng. Luiz Henrique","","Acer","","",3000,"","","Disponível"])],
 'Colaboradores':[["Nome","Perfil","PIN (cifrado, preenchido pelo app)","Troca de PIN pendente","Ativo","Telefone","Função","E-mail"],["Eng. Joaquim Neto","Administrador","","Sim","Sim","","Engenheiro","joaquim.neto@kiton.test"],["Hellen Alves","Administrador","","Sim","Sim","","Administrativo","hellen@kiton.test"],["Eng. Luiz Henrique","Campo","","Sim","Sim","","Engenheiro","luiz@kiton.test"],["Henrique Barrocal","Campo","","Sim","Sim","","Ajudante técnico",""]],
 'Clientes':[["Cliente","Cidade","Latitude","Longitude","Link da pasta no Drive","Ativo","Endereço","E-mail OS 1","E-mail OS 2","E-mail OS 3","Raio do check-in (m)"],
   ["Perfileve","Maringá","","","","Sim","","manutencao@perfileve.test","","",""],["Cliente Teste (fictício)","Maringá-PR",-23.4205,-51.9333,"","Sim","","","","",300]],
 'Saídas':[["Nº","Data e hora de saída","Colaborador","Equipe","Motivo","Destino","Veículo","Lat. saída","Long. saída","Precisão saída (m)","Mapa saída","Data e hora de retorno","Lat. retorno","Long. retorno","Precisão retorno (m)","Mapa retorno","Abastecimento","Valor abastecimento (R$)","Comprovante","Km estimados","Observações","Registrado por","Saída lançada em","Retorno lançado em","Lançamento tardio"]],
 'Itens por saída':[["Nº da saída","Patrimônio","Descrição","Quantidade","Situação","Observação na devolução","Conferido por","Data da conferência"]],
 'Listas':[["Tipo","Uso","Estado","Situação","Perfil","Sim/Não","Motivo","Veículo","Abastecimento","Legenda do estado","Situação do item na saída","Periodicidade","Tipo de OS","Categoria de despesa","Pagamento de despesa"],
  ["Ferramenta","Coletivo","N","Disponível","Administrador","Sim","Atendimento em cliente","Kiton (Doblò)","Não abasteceu","N = novo","Fora","Mensal","Manutenção corretiva","Combustível","Paguei do meu bolso (reembolso)"],
  ["Instrumento","Individual","UB","Fora","Campo","Não","Uso interno","Particular","Pago pela Kiton","UB = usado bom","Aguardando conferência","Semestral","Manutenção preventiva","Alimentação","Cartão ou dinheiro da Kiton"],
  ["Equipamento","Fixo","UR","Aguardando conferência","","","Outro","Sem veículo","Pago pelo colaborador (particular)","UR = regular","Conferido OK","Anual","Visita técnica","Pedágio",""],
  ["EPC","","","Avariado","","","","","","","","Bienal","Outro","Outro",""],["Kit","","","Extraviado","","","","","","","","Trienal","","",""]]
};
function sheet(n){const d=sheets[n];return{getDataRange:()=>({getValues:()=>d.length?d.map(r=>r.slice()):[[]]}),
 getRange:(r,c,nr,nc)=>({setValue:v=>{while(d.length<r)d.push(new Array(d[0].length).fill(''));d[r-1][c-1]=v;},setFontWeight(){return this},setBackground(){return this},setFontColor(){return this}}),
 appendRow:row=>d.push(row),getLastRow:()=>d.length,setFrozenRows(){},deleteRow:r=>d.splice(r-1,1)};}
const props={},drive={},mails=[],events={};
let fid=0;
function folder(name){const id='F'+(++fid);return {getId:()=>id,getName:()=>name,getFoldersByName:n=>({hasNext:()=>false}),createFolder:n=>folder(n),
 createFile:b=>{const i='FILE'+(++fid)+'xxxxxxxxxxxxxxxxxxxxxxxx';drive[i]=b;return{getUrl:()=>'https://drive.google.com/file/d/'+i+'/view',getId:()=>i};}};}
const blob=(bytes,mime,name)=>({bytes,mime,name,getContentType:()=>mime,getAs(m){return blob(bytes,m,name)},setName(n){this.name=n;return this},getBytes:()=>bytes,getDataAsString:()=>Buffer.from(bytes).toString('utf8')});
const ctx={console,JSON,Date,Math,Number,String,Object,Array,Error,isNaN,
 SpreadsheetApp:{flush(){},getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]?sheet(n):null,insertSheet:n=>{sheets[n]=[];return sheet(n);}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},
 ContentService:{MimeType:{JSON:1},createTextOutput:t=>({setMimeType(){return t}})},
 DriveApp:{getRootFolder:()=>folder('root'),getFolderById:id=>folder(id),getFileById:id=>({getBlob:()=>drive[id]})},
 CalendarApp:{getCalendarById:id=>({getName:()=>'GERAL',createEvent:(t,a,b,o)=>{const i='EV'+(++fid);events[i]={t,a,b,o};return{getId:()=>i}},getEventById:i=>events[i]?{setTime(a,b){events[i].a=a;events[i].b=b},setTitle(t){events[i].t=t},getTitle:()=>events[i].t,setDescription(){},deleteEvent(){delete events[i]}}:null})},
 MailApp:{sendEmail:(to,s,b,o)=>{if(process.env.FALHAR_EMAIL)throw new Error('cota');mails.push({to,s,cc:o.cc,bcc:o.bcc,inl:o.inlineImages,anexo:o.attachments?o.attachments[0].name:"",body:b,html:o.htmlBody})},getRemainingDailyQuota:()=>100},
 Logger:{log:console.log},
 Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
  computeDigest:(a,s)=>[...crypto.createHash('sha256').update(s,'utf8').digest()],
  computeHmacSha256Signature:(s,k)=>[...crypto.createHmac('sha256',k).update(s).digest()],
  base64EncodeWebSafe:b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'),
  base64DecodeWebSafe:s=>[...Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64')],
  base64Decode:s=>[...Buffer.from(s,'base64')],base64Encode:b=>Buffer.from(b).toString('base64'),
  newBlob:(x,mime,name)=>typeof x==='string'?blob([...Buffer.from(x,'utf8')],mime,name):blob(x,mime,name),
  getUuid:()=>crypto.randomUUID(),
  parseDate:(t,tz,f)=>{const m=t.match(/(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);return m?new Date(+m[1],m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)):new Date(NaN);},
  formatDate:(d,tz,f)=>{const p=n=>String(n).padStart(2,'0');return f.replace('yyyy',d.getFullYear()).replace('MM',p(d.getMonth()+1)).replace('dd',p(d.getDate())).replace('HH',p(d.getHours())).replace('mm',p(d.getMinutes()));}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('/home/claude/app-kiton-campo/apps-script/Code.gs','utf8'),ctx);
const call=req=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(req)}}));
module.exports={call,sheets,drive,mails,events};
