const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:794,height:1123}});
await p.goto('file://'+__dirname+'/os_final.html');await p.pdf({path:'os_final.pdf',format:'A4',printBackground:false});
await p.goto('file://'+__dirname+'/mail_final.html');await p.setViewportSize({width:700,height:900});await p.screenshot({path:'mail.png',fullPage:true});await b.close();})();
