const fs=require("fs"),path=require("path"),{chromium}=require("playwright");
const target="http://127.0.0.1:3000/merge-pdf", sla=30000, runs=5;
const root=process.cwd(), A=path.join(root,"_regression","merge-pdf","A-2-pages.pdf"), B=path.join(root,"_regression","merge-pdf","B-1-page.pdf");
const report=process.env.IEPDF_PROFILE_REPORT;
function out(x){console.log(x);fs.appendFileSync(report,x+"\n")}
function stat(a){a=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return{n:0,p50:null,p95:null,max:null};const p=q=>Math.round(a[Math.min(a.length-1,Math.ceil(a.length*q)-1)]);return{n:a.length,p50:p(.5),p95:p(.95),max:a[a.length-1]}}
async function run(browser,id){
 const t=Date.now(), r={id,status:"FAIL",marks:{},errors:[],pageErrors:0,requestFailures:0,consoleErrors:0};
 let c;
 try{
  c=await browser.newContext({acceptDownloads:true}); const p=await c.newPage();
  p.on("pageerror",e=>{r.pageErrors++;r.errors.push("PAGE:"+e)});
  p.on("requestfailed",q=>{r.requestFailures++;r.errors.push("REQ:"+String(q.failure()?.errorText||"failed"))});
  p.on("console",m=>{const z=m.text();if(m.type()==="error")r.consoleErrors++;if(z.includes("[IEPDF_PROFILE]")){const a=z.split("|");if(a.length===2)r.marks[a[0].replace("[IEPDF_PROFILE] ","")]=Number(a[1])}});
  r.navStart=Date.now(); await p.goto(target,{waitUntil:"domcontentloaded",timeout:sla}); r.navigation=Date.now();
  const input=p.locator('input[type="file"][accept=".pdf"]'); await input.waitFor({state:"attached",timeout:Math.max(1,sla-(Date.now()-t))}); r.inputAttached=Date.now();
  const dlp=p.waitForEvent("download",{timeout:Math.max(1,sla-(Date.now()-t))}).catch(()=>null);
  await input.setInputFiles([A,B]); r.filesSelected=Date.now();
  await p.getByText("A-2-pages.pdf",{exact:false}).first().waitFor({state:"visible",timeout:Math.max(1,sla-(Date.now()-t))});
  await p.getByText("B-1-page.pdf",{exact:false}).first().waitFor({state:"visible",timeout:Math.max(1,sla-(Date.now()-t))}); r.rowsRendered=Date.now();
  const b=p.getByRole("button",{name:/Unlock & Merge/i}); await b.waitFor({state:"visible",timeout:Math.max(1,sla-(Date.now()-t))});
  await p.waitForFunction(()=>{const b=[...document.querySelectorAll("button")].find(x=>/Unlock\s*&\s*Merge/i.test(x.textContent||""));return b&&!b.disabled},{timeout:Math.max(1,sla-(Date.now()-t))}); r.mergeEnabled=Date.now();
  await b.click(); r.mergeClicked=Date.now();
  const dl=await dlp;if(!dl)throw Error("download event timeout");r.downloadEvent=Date.now();
  const f=path.join(root,"_regression","merge-pdf",`_profile-${id}-${Date.now()}.pdf`);await dl.saveAs(f);r.downloadSaved=Date.now();r.bytes=fs.statSync(f).size;fs.unlinkSync(f);r.downloadVerified=Date.now();
  r.status=r.downloadVerified-t<=sla?"PASS":"FAIL_SLA";
 }catch(e){r.errors.push(String(e))}finally{r.elapsedMs=Date.now()-t;if(c)await c.close().catch(()=>{})}
 const m=r.marks;
 if(Number.isFinite(m.PROCESS_START)&&Number.isFinite(m.PROCESS_END))r.processorDurationMs=m.PROCESS_END-m.PROCESS_START;
 if(Number.isFinite(m.PROCESS_END)&&Number.isFinite(m.BLOB_START))r.processToBlobMs=m.BLOB_START-m.PROCESS_END;
 if(Number.isFinite(m.BLOB_START)&&Number.isFinite(m.BLOB_END))r.blobDurationMs=m.BLOB_END-m.BLOB_START;
 if(Number.isFinite(r.mergeClicked)&&Number.isFinite(r.downloadEvent))r.clickToDownloadEventMs=r.downloadEvent-r.mergeClicked;
 return r;
}
(async()=>{
 fs.writeFileSync(report,"iePDF Merge PDF - Controlled Performance Profile\n");
 out("MODE|single browser, sequential real merges");out("RUNS|"+runs);out("SLA_MS|"+sla);
 if(!fs.existsSync(A)||!fs.existsSync(B))throw Error("Required PDF fixtures missing.");
 const browser=await chromium.launch({headless:true,executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",args:["--disable-gpu"]});
 const rs=[];for(let i=1;i<=runs;i++){out("RUN_START|"+i);const r=await run(browser,i);rs.push(r);out("RUN|"+JSON.stringify(r))}
 await browser.close();
 const s={runs,passed:rs.filter(x=>x.status==="PASS").length,failed:rs.filter(x=>x.status!=="PASS").length,elapsedMs:stat(rs.map(x=>x.elapsedMs)),navigationMs:stat(rs.map(x=>x.navigation-x.navStart)),inputToRowsMs:stat(rs.map(x=>x.rowsRendered-x.filesSelected)),rowsToReadyMs:stat(rs.map(x=>x.mergeEnabled-x.rowsRendered)),processorMs:stat(rs.map(x=>x.processorDurationMs)),processToBlobMs:stat(rs.map(x=>x.processToBlobMs)),blobMs:stat(rs.map(x=>x.blobDurationMs)),clickToDownloadEventMs:stat(rs.map(x=>x.clickToDownloadEventMs)),pageErrors:rs.reduce((n,x)=>n+x.pageErrors,0),requestFailures:rs.reduce((n,x)=>n+x.requestFailures,0),consoleErrors:rs.reduce((n,x)=>n+x.consoleErrors,0)};
 out("SUMMARY|"+JSON.stringify(s));out("RESULT|"+(s.failed===0?"PASS":"FAIL"));out("REPORT|"+report);
})().catch(e=>{out("FATAL|"+e);process.exit(2)});
