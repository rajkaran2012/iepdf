const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async()=>{
  const root=process.env.IEPDF_ROOT;
  const chrome=process.env.IEPDF_CHROME;
  const pageUrl="http://localhost:3000/merge-pdf";
  const browser=await chromium.launch({headless:true,executablePath:chrome});
  const context=await browser.newContext();
  const page=await context.newPage();

  const consoleErrors=[], failedRequests=[], results=[];
  page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text())});
  page.on("pageerror",e=>consoleErrors.push("PAGEERROR: "+e.message));
  page.on("requestfailed",r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||""}));

  const PASS=(n,v="")=>{results.push({n,ok:true,v});console.log("PASS "+n+(v!==""?" = "+v:""))};
  const FAIL=(n,v="")=>{results.push({n,ok:false,v});console.log("FAIL "+n+(v!==""?" = "+v:""))};
  const now=()=>performance.now(), ms=t=>Math.round(performance.now()-t);

  function collect(dir,a=[]){
    if(!fs.existsSync(dir))return a;
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name);
      if(e.isDirectory())collect(p,a);
      else if(/\.pdf$/i.test(e.name))a.push(p);
    }
    return a;
  }
  const roots=[path.join(root,"_regression"),path.join(root,"public"),path.join(root,"test-fixtures")];
  const pdfs=[...new Set(roots.flatMap(x=>collect(x)))];
  if(pdfs.length<3){
    FAIL("FIXTURES","Need 3 PDFs under _regression/public/test-fixtures");
    await browser.close();process.exit(2);
  }
  const pick=(re,i)=>pdfs.find(x=>re.test(path.basename(x)))||pdfs[i];
  const A=pick(/^A[-_]|A-2-pages/i,0);
  const B=pick(/^B[-_]|B-1-page/i,1);
  const C=pick(/^C[-_]|C-1-page/i,2);
  const names=[path.basename(A),path.basename(B),path.basename(C)];
  console.log("FIXTURE A",A);console.log("FIXTURE B",B);console.log("FIXTURE C",C);

  let t=now();
  await page.goto(pageUrl,{waitUntil:"domcontentloaded"});
  await page.locator('input[type="file"]').waitFor();
  PASS("PAGE_DOM_READY_MS",ms(t));

  t=now();
  await page.reload({waitUntil:"load"});
  PASS("PAGE_LOAD_MS",ms(t));

  const input=page.locator('input[type="file"]');
  const merge=page.getByRole("button",{name:/Unlock & Merge/i});
  const handles=page.locator('[aria-label^="Drag PDF "]');

  PASS("ONE_FILE_INPUT",await page.locator('input[type="file"]').count()===1);
  PASS("EMPTY_ROWS",await handles.count()===0);
  PASS("EMPTY_MERGE_DISABLED",await merge.isDisabled());

  t=now();
  await input.setInputFiles([A,B,C]);
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Drag PDF "]').length===3);
  PASS("UPLOAD_ABC_MS",ms(t));
  PASS("ABC_ROWS",await handles.count()===3);
  PASS("MERGE_ENABLED",!(await merge.isDisabled()));

  const body=()=>page.locator("body").innerText();
  let s=await body();
  let pa=s.indexOf(names[0]),pb=s.indexOf(names[1]),pc=s.indexOf(names[2]);
  PASS("INITIAL_ORDER_A_B_C",pa>=0&&pb>=0&&pc>=0&&pa<pb&&pb<pc,`A=${pa},B=${pb},C=${pc}`);

  for(let i=1;i<=3;i++){
    const h=page.locator(`[aria-label="Drag PDF ${i} to reorder"]`);
    PASS(`HANDLE_${i}`,await h.count()===1&&await h.getAttribute("draggable")==="true");
  }

  // Exact C handle -> exact A handle.
  t=now();
  const cHandle=page.locator('[aria-label="Drag PDF 3 to reorder"]');
  const aHandle=page.locator('[aria-label="Drag PDF 1 to reorder"]');
  console.log("C_HANDLE_COUNT",await cHandle.count());
  console.log("A_HANDLE_COUNT",await aHandle.count());
  console.log("C_ARIA",await cHandle.getAttribute("aria-label"));
  console.log("A_ARIA",await aHandle.getAttribute("aria-label"));
  await cHandle.dragTo(aHandle);
  await page.waitForTimeout(350);

  s=await body();
  pc=s.indexOf(names[2]);pa=s.indexOf(names[0]);pb=s.indexOf(names[1]);
  PASS("REORDER_C_TO_A",pc>=0&&pa>=0&&pb>=0&&pc<pa&&pa<pb,`C=${pc},A=${pa},B=${pb}`);
  PASS("REORDER_TIME_MS",ms(t));

  // Fresh page: one file -> handle hidden; second -> handles visible; third -> 3.
  await page.goto(pageUrl,{waitUntil:"load"});
  const fresh=page.locator('input[type="file"]');
  await fresh.setInputFiles(A);
  await page.waitForTimeout(250);
  PASS("ONE_FILE_HANDLE_HIDDEN",await page.locator('[aria-label^="Drag PDF "]').count()===0);

  await fresh.setInputFiles(B);
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Drag PDF "]').length===2);
  PASS("TWO_FILE_HANDLES_VISIBLE",await page.locator('[aria-label^="Drag PDF "]').count()===2);

  await fresh.setInputFiles(C);
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Drag PDF "]').length===3);
  PASS("THREE_FILE_HANDLES_VISIBLE",await page.locator('[aria-label^="Drag PDF "]').count()===3);

  // Three complete fresh cycles.
  const cycle=[];
  for(let i=1;i<=3;i++){
    await page.goto(pageUrl,{waitUntil:"load"});
    t=now();
    await page.locator('input[type="file"]').setInputFiles([A,B,C]);
    await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Drag PDF "]').length===3);
    cycle.push(ms(t));
    console.log(`CYCLE_${i}_ABC_MS=${cycle[cycle.length-1]}`);
  }
  PASS("REPEATED_3_CYCLES",cycle.join(","));

  const nav=await page.evaluate(()=>{
    const n=performance.getEntriesByType("navigation")[0];
    return {domContentLoaded:Math.round(n.domContentLoadedEventEnd),loadEvent:Math.round(n.loadEventEnd),resources:performance.getEntriesByType("resource").length};
  });
  console.log("NAV_TIMING",JSON.stringify(nav));

  const nonWorker=failedRequests.filter(x=>!/pdf\.worker|min\.mjs/i.test(x.url));
  const worker=failedRequests.filter(x=>/pdf\.worker|min\.mjs/i.test(x.url));
  PASS("NON_WORKER_FAILED_REQUESTS",nonWorker.length===0,nonWorker.length);
  PASS("PDFJS_WORKER_FAILED_REQUESTS",worker.length===0,worker.length);
  PASS("CONSOLE_ERRORS",consoleErrors.length===0,consoleErrors.length);

  const heap=await page.evaluate(()=>{
    const m=performance.memory;
    return m?{usedJSHeapSize:m.usedJSHeapSize,totalJSHeapSize:m.totalJSHeapSize,jsHeapSizeLimit:m.jsHeapSizeLimit}:null;
  });
  console.log("HEAP",JSON.stringify(heap));
  console.log("CYCLES",JSON.stringify(cycle));
  console.log("ERRORS",JSON.stringify(consoleErrors));
  console.log("FAILED_REQUESTS",JSON.stringify(failedRequests));

  const bad=results.filter(x=>!x.ok);
  console.log("SUMMARY PASS="+(results.length-bad.length)+" FAIL="+bad.length);
  await browser.close();
  process.exit(bad.length?1:0);
})().catch(e=>{console.error("FATAL",e.stack||String(e));process.exit(3)});
