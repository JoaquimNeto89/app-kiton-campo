const crypto=require('crypto');
module.exports=(call,sheets)=>n=>{const C=sheets['Colaboradores'];const ci=C[0].indexOf('PIN (cifrado, preenchido pelo app)');const r=C.find(x=>x[0]===n);const sal='s'+Math.random().toString(36).slice(2,9);
r[ci]=sal+'$'+crypto.createHash('sha256').update(sal+':482915','utf8').digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const l=call({acao:'login',nome:n,pin:'482915'});return call({acao:'trocarPin',token:l.token,novo:'731846'}).token;};
