module.exports=function(sheets){
 sheets['Clientes'][0].push('Cadastrado por');
 const c=sheets['Colaboradores'];c[0].push('Venc. NR-10','Venc. NR-10 SEP','Venc. NR-33','Venc. NR-35','Venc. ASO');
 const f=d=>{const x=new Date(Date.now()+d*864e5);return String(x.getDate()).padStart(2,'0')+'/'+String(x.getMonth()+1).padStart(2,'0')+'/'+x.getFullYear();};
 c[1].push(f(400),'', '', f(300), f(20));      // Joaquim: ASO vence em 20 dias
 c[2].push('','','','','');
 c[3].push(f(500),'','',f(-5),f(200));          // Luiz: NR-35 vencido
 c[4].push(f(100),'','','',f(150));             // Barrocal: sem NR-35
 const L=sheets['Listas'];L[0].push('Tipos de OS com APR reduzida');L[1].push('Visita técnica');for(let i=2;i<L.length;i++)L[i].push('');
};
