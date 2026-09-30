const { chromium } = require("playwright");
const fs=require("fs");
const path=require("path");

const ROOT=process.env.SPLIT_REGRESSION_ROOT;
const FRONTEND=process.env.SPLIT_FRONTEND_URL || "http://127.0.0.1:3000/split-pdf";
const PASSWORD="iepdf123";

const files={
 one:path.join(ROOT,"S-01-1page.pdf"), two:path.join(ROOT,"S-02-2pages.pdf"),
 five:path.join(ROOT,"S-03-5pages.pdf"), ten:path.join(ROOT,"S-04-10pages.pdf"),
 mixed:path.join(ROOT,"S-05-mixed-pages.pdf"), corrupt:path.join(ROOT,"S-06-corrupted.pdf"),
 zero:path.join(ROOT,"S-07-zero-byte.pdf"), fake:path.join(ROOT,"S-08-renamed-nonpdf.pdf"),
 protected:path.join(ROOT,"S-09-protected.pdf"), under:path.join(ROOT,"S-10-under-15MiB.pdf"),
 exact:path.join(ROOT,"S-11-exact-15MiB.pdf"), over:path.join(ROOT,"S-12-over-15MiB.pdf")
};

function r(id,ok,message,extra={}){return {id,ok,message,...extra};}

async function bodyHas(page,pattern,timeout=8000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
   const text=await page.locator("body").innerText();
   if(pattern.test(text)) return true;
   await page.waitForTimeout(100);
 }
 return false;
}

async function caseRun(browser,id,fn){
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 page.on("pageerror",e=>console.log(`PAGE_ERROR ${id}: ${e.message}`));
 try{
   await page.goto(FRONTEND,{waitUntil:"domcontentloaded",timeout:30000});
   await page.waitForTimeout(400);
   return await fn(page);
 }catch(e){return r(id,false,e&&e.stack?e.stack:String(e));}
 finally{await context.close();}
}

async function getZip(page,filePath){
 const input=page.locator('input[type="file"]').first();
 await input.setInputFiles(filePath);
 await page.waitForTimeout(500);
 const button=page.getByRole("button",{name:/^Split PDF$/}).first();
 if(await button.count()===0) return {button:null,download:null};
 const downloadPromise=page.waitForEvent("download",{timeout:20000});
 await button.click();
 const download=await downloadPromise;
 return {button,download};
}

async function inspectZip(download){
 const tmp=await download.path();
 if(!tmp) throw new Error("Download path unavailable.");
 const data=fs.readFileSync(tmp);
 const out=path.join(ROOT,`__split-${Date.now()}.zip`);
 fs.writeFileSync(out,data);
 return {tmp,out,bytes:data.length,name:download.suggestedFilename()};
}

async function unzipAndInspect(zipPath){
 const AdmZip=require("adm-zip");
 const zip=new AdmZip(zipPath);
 const entries=zip.getEntries().filter(e=>!e.isDirectory);
 const info=[];
 for(const e of entries){
   const b=e.getData();
   const t=b.toString("latin1");
   const pageCount=(t.match(/\/Type\s*\/Page\b/g)||[]).length;
   info.push({name:e.entryName,bytes:b.length,header:b.subarray(0,5).toString("ascii"),eof:t.lastIndexOf("%%EOF")>=0,startxref:t.lastIndexOf("startxref")>=0,pageCount,data:b});
 }
 return {entries,info};
}

async function run(){
 const browser=await chromium.launch({headless:true,executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"});
 const out=[];

 out.push(await caseRun(browser,"S-01",async page=>{
   const x=await getZip(page,files.one);
   if(!x.download)return r("S-01",false,"1-page split produced no download.");
   return r("S-01",true,"1-page PDF split successfully.");
 }));

 for(const spec of [
   ["S-02",files.two,2],["S-03",files.five,5],["S-04",files.ten,10]
 ]){
   out.push(await caseRun(browser,spec[0],async page=>{
     const x=await getZip(page,spec[1]);
     if(!x.download)return r(spec[0],false,"No ZIP download.");
     const z=await inspectZip(x.download);
     const zi=await unzipAndInspect(z.out);
     const expected=spec[2];
     const names=zi.info.map(v=>v.name);
     const correctCount=zi.info.length===expected;
     const correctNames=zi.info.every((v,i)=>v.name===`page_${i+1}.pdf`);
     const valid=zi.info.every(v=>v.bytes>0 && v.header==="%PDF-" && v.eof && v.startxref && v.pageCount===1);
     return r(spec[0],correctCount&&correctNames&&valid,`entries=${zi.info.length}, expected=${expected}, names=${correctNames}, outputsValid=${valid}.`,{entries:zi.info.length});
   }));
 }

 out.push(await caseRun(browser,"S-05",async page=>{
   const x=await getZip(page,files.mixed);
   if(!x.download)return r("S-05",false,"Mixed-pages PDF produced no ZIP.");
   const z=await inspectZip(x.download); const zi=await unzipAndInspect(z.out);
   const texts=zi.info.map(v=>v.data.toString("latin1"));
   const labels=[/PAGE 1 - PORTRAIT - LETTER/i,/PAGE 2 - LANDSCAPE - LETTER/i,/PAGE 3 - PORTRAIT - LEGAL/i,/PAGE 4 - LANDSCAPE - LEGAL/i];
   const order=labels.every((p,i)=>p.test(texts[i]||""));
   const valid=zi.info.every(v=>v.header==="%PDF-"&&v.pageCount===1&&v.eof&&v.startxref);
   return r("S-05",zi.info.length===4&&order&&valid,`entries=${zi.info.length}, order=${order}, outputsValid=${valid}.`);
 }));

 for(const spec of [
   ["S-06",files.corrupt],["S-07",files.zero],["S-08",files.fake]
 ]){
   out.push(await caseRun(browser,spec[0],async page=>{
     const input=page.locator('input[type="file"]').first();
     await input.setInputFiles(spec[1]); await page.waitForTimeout(500);
     const count=await page.getByRole("button",{name:/^Split PDF$/}).count();
     if(count===0)return r(spec[0],true,"Invalid PDF blocked before Split action.");
     const dp=page.waitForEvent("download",{timeout:3000}).catch(()=>null);
     await page.getByRole("button",{name:/^Split PDF$/}).first().click();
     const noDownload=!(await dp);
     const failure=await bodyHas(page,/Split failed|Invalid PDF|Unable to load|password is required/i,5000);
     return r(spec[0],noDownload&&failure,`noDownload=${noDownload},failureFeedback=${failure}.`);
   }));
 }

 out.push(await caseRun(browser,"S-09",async page=>{
   const input=page.locator('input[type="file"]').first();
   await input.setInputFiles(files.protected); await page.waitForTimeout(1000);
   const text=await page.locator("body").innerText();
   const buttonCount=await page.getByRole("button",{name:/^Split PDF$/}).count();
   const blocked=buttonCount===0;
   const passwordHint=/password|required|protected/i.test(text);
   return r("S-09",blocked||passwordHint,`splitButtonCount=${buttonCount}, passwordHint=${passwordHint}.`);
 }));

 for(const spec of [
   ["S-10",files.under,true],["S-11",files.exact,true],["S-12",files.over,false]
 ]){
   out.push(await caseRun(browser,spec[0],async page=>{
     const input=page.locator('input[type="file"]').first();
     await input.setInputFiles(spec[1]); await page.waitForTimeout(700);
     const count=await page.getByRole("button",{name:/^Split PDF$/}).count();
     const accepted=count>0;
     if(!accepted) return r(spec[0],!spec[2],spec[2]?"Boundary file unexpectedly rejected.":"Above-limit file correctly rejected.");
     if(!spec[2]) return r(spec[0],false,"Above-limit file exposed Split action.");
     const dp=page.waitForEvent("download",{timeout:20000}); await page.getByRole("button",{name:/^Split PDF$/}).first().click();
     const dl=await dp; return r(spec[0],true,`Boundary file accepted; downloaded ${dl.suggestedFilename()}.`);
   }));
 }

 out.push(await caseRun(browser,"S-13",async page=>{
   const x=await getZip(page,files.two); if(!x.download)return r("S-13",false,"No ZIP download.");
   const z=await inspectZip(x.download); return r("S-13",z.name==="split_pages.zip",`filename=${z.name}.`);
 }));

 out.push(await caseRun(browser,"S-14",async page=>{
   const x=await getZip(page,files.five); if(!x.download)return r("S-14",false,"No ZIP download.");
   const z=await inspectZip(x.download); const zi=await unzipAndInspect(z.out);
   return r("S-14",zi.info.length===5&&zi.info.every(v=>v.bytes>0),`ZIP entries=${zi.info.length}.`);
 }));

 out.push(await caseRun(browser,"S-15",async page=>{
   const x=await getZip(page,files.two); if(!x.download)return r("S-15",false,"No ZIP download.");
   const z=await inspectZip(x.download); const zi=await unzipAndInspect(z.out);
   const ok=zi.info.every((v,i)=>v.name===`page_${i+1}.pdf`);
   return r("S-15",ok,`namesCorrect=${ok}.`);
 }));

 out.push(await caseRun(browser,"S-16",async page=>{
   const x=await getZip(page,files.five); if(!x.download)return r("S-16",false,"No ZIP download.");
   const z=await inspectZip(x.download); const zi=await unzipAndInspect(z.out);
   const ok=zi.info.every(v=>v.header==="%PDF-");
   return r("S-16",ok,`allPdfHeadersValid=${ok}.`);
 }));

 out.push(await caseRun(browser,"S-17",async page=>{
   const x=await getZip(page,files.five); if(!x.download)return r("S-17",false,"No ZIP download.");
   const z=await inspectZip(x.download); const zi=await unzipAndInspect(z.out);
   const ok=zi.info.every(v=>v.bytes>0);
   return r("S-17",ok,`allOutputsNonEmpty=${ok}.`);
 }));

 out.push(await caseRun(browser,"S-18",async page=>{
   const x=await getZip(page,files.five); if(!x.download)return r("S-18",false,"No ZIP download.");
   const z=await inspectZip(x.download); const zi=await unzipAndInspect(z.out);
   const ok=zi.info.every(v=>v.header==="%PDF-"&&v.eof&&v.startxref&&v.pageCount===1);
   return r("S-18",ok,`allOutputsStructurallyValid=${ok}.`);
 }));

 out.push(await caseRun(browser,"S-19",async page=>{
   const input=page.locator('input[type="file"]').first(); await input.setInputFiles(files.five);
   await page.waitForTimeout(500); const dp=page.waitForEvent("download",{timeout:20000});
   await page.getByRole("button",{name:/^Split PDF$/}).first().click(); const dl=await dp;
   const z=await inspectZip(dl); const zi=await unzipAndInspect(z.out);
   const ok=zi.info.every(v=>v.pageCount===1);
   return r("S-19",ok,`onePagePerOutput=${ok}.`);
 }));

 out.push(await caseRun(browser,"S-20",async page=>{
   const input=page.locator('input[type="file"]').first(); await input.setInputFiles(files.five);
   await page.waitForTimeout(500); const before=await page.getByText("S-03-5pages.pdf").count();
   const dp=page.waitForEvent("download",{timeout:20000}); await page.getByRole("button",{name:/^Split PDF$/}).first().click(); await dp;
   await page.waitForTimeout(500); const after=await page.getByText("S-03-5pages.pdf").count();
   return r("S-20",before>0&&after===0,`workspaceBefore=${before}, workspaceAfter=${after}.`);
 }));

 out.push(await caseRun(browser,"S-21",async page=>{
   const x=await getZip(page,files.five); if(!x.download)return r("S-21",false,"No ZIP download.");
   const z=await inspectZip(x.download); const zi=await unzipAndInspect(z.out);
   const text=zi.info.map(v=>v.data.toString("latin1"));
   const order=text.every((t,i)=>new RegExp(`SPLIT PAGE ${i+1}`,"i").test(t));
   return r("S-21",order,`pageOrder=${order}.`);
 }));

 out.push(await caseRun(browser,"S-22",async page=>{
   const x=await getZip(page,files.one); if(!x.download)return r("S-22",false,"No ZIP download.");
   const ok=await bodyHas(page,/Split completed/i,8000);
   return r("S-22",ok,`successToast=${ok}.`);
 }));

 out.push(await caseRun(browser,"S-23",async page=>{
   const x=await getZip(page,files.one); return r("S-23",!!x.download,`downloaded=${!!x.download}.`);
 }));

 out.push(await caseRun(browser,"S-24",async page=>{
   const input=page.locator('input[type="file"]').first(); await input.setInputFiles(files.mixed);
   const btn=page.getByRole("button",{name:/^Split PDF$/}).first(); const dp=page.waitForEvent("download",{timeout:20000});
   await btn.click(); const count=await page.getByRole("button",{name:/Splitting\.\.\./i}).count(); await dp;
   return r("S-24",count>0,`loadingStateObserved=${count>0}.`);
 }));

 out.push(await caseRun(browser,"S-25",async page=>{
   const count=await page.getByRole("button",{name:/^Split PDF$/}).count();
   return r("S-25",count===0,`splitButtonCount=${count} without selected file.`);
 }));

 out.push(await caseRun(browser,"S-27",async page=>{
   const input=page.locator('input[type="file"]').first(); const filesToRun=[files.one,files.two,files.five];
   let ok=true; let messages=[];
   for(const fp of filesToRun){
     await input.setInputFiles(fp); await page.waitForTimeout(300);
     const button=page.getByRole("button",{name:/^Split PDF$/}).first();
     if(await button.count()===0){ok=false;messages.push("button missing");break;}
     const dp=page.waitForEvent("download",{timeout:20000}); await button.click(); const dl=await dp;
     if(dl.suggestedFilename()!=="split_pages.zip"){ok=false;messages.push(dl.suggestedFilename());break;}
     await page.waitForTimeout(300);
   }
   return r("S-27",ok,ok?"Three sequential split runs completed cleanly.":messages.join(", "));
 }));

 await browser.close();
 process.stdout.write(JSON.stringify(out));
}

run().catch(e=>{
 console.error("BROWSER_FATAL",e && e.stack ? e.stack : String(e));
 process.exit(1);
});
