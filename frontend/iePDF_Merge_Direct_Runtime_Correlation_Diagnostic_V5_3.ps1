# iePDF Merge - Direct Source/Runtime Correlation Diagnostic V5.3
# Uses the project's own Node module resolution from C:\IEPDF\frontend.
# Temporary instrumentation only. ALWAYS restores page.tsx.
# No Git. No deployment. No permanent source change.

$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$ReportDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\merge-runtime-diagnostic-v53-$Stamp"
$BackupPage = Join-Path $BackupDir "page.tsx"
$Report = Join-Path $ReportDir "merge-runtime-direct-correlation-v53-$Stamp.txt"
$Runner = Join-Path $Root "._iepdf_merge_runtime_v53_$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

if (-not (Test-Path -LiteralPath $Page)) { throw "Merge page not found: $Page" }
Copy-Item -LiteralPath $Page -Destination $BackupPage -Force

$original = [System.IO.File]::ReadAllText($Page, [System.Text.Encoding]::UTF8)
$marker = "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53"

if ($original.Contains($marker)) { throw "V5.3 marker already exists. Refusing to stack instrumentation." }

$patched = $original

# Handler entry. This pattern only references event, which is in scope.
$p = '(?s)(const\s+handleFileChange\s*=\s*async\s*\(\s*event\s*:\s*React\.ChangeEvent<HTMLInputElement>\s*\)\s*=>\s*\{)'
$r = '$1' + "`r`n" +
'    console.log("' + $marker + ' CHANGE_ENTER", { fileCount: event.target.files?.length ?? 0, names: event.target.files ? Array.from(event.target.files).map((f: File) => f.name) : [] });'
$patched = [regex]::Replace($patched, $p, $r, 1)

# processSelectedFiles entry. Parameter is safely in scope.
$p = '(?s)(const\s+processSelectedFiles\s*=\s*async\s*\(\s*files\s*:\s*File\[\]\s*\)\s*=>\s*\{)'
$r = '$1' + "`r`n" +
'    console.log("' + $marker + ' PROCESS_ENTER", { fileCount: files.length, names: files.map((f: File) => f.name), sizes: files.map((f: File) => f.size) });'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Existing analyzer statement.
$p = '(?m)^(\s*)(const\s+analysis\s*=\s*await\s+analyzer\.analyzeMany\(files\);)'
$r = '$1console.log("' + $marker + ' ANALYZER_BEFORE", { fileCount: files.length });' + "`r`n" +
'$1$2' + "`r`n" +
'$1console.log("' + $marker + ' ANALYZER_AFTER", { count: analysis.length, results: analysis });'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Existing workspace state setter.
$p = '(?m)^(\s*)(setWorkspaceFiles\s*\(\s*\(\s*previous\s*\)\s*=>\s*\[\.\.\.previous,\s*\.\.\.workspace\]\s*\);)'
$r = '$1console.log("' + $marker + ' SET_WORKSPACE", { workspaceCount: workspace.length, workspace: workspace });' + "`r`n" +
'$1$2'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Existing processSelectedFiles call from change handler.
$p = '(?m)^(\s*)(await\s+processSelectedFiles\(files\);)'
$r = '$1console.log("' + $marker + ' PROCESS_BEFORE_FROM_CHANGE", { fileCount: files.length });' + "`r`n" +
'$1$2' + "`r`n" +
'$1console.log("' + $marker + ' PROCESS_AFTER_FROM_CHANGE");'
$patched = [regex]::Replace($patched, $p, $r, 1)

$required = @(
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53 CHANGE_ENTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53 PROCESS_ENTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53 ANALYZER_BEFORE",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53 ANALYZER_AFTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53 SET_WORKSPACE",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53 PROCESS_BEFORE_FROM_CHANGE",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53 PROCESS_AFTER_FROM_CHANGE"
)

foreach ($m in $required) {
    if (-not $patched.Contains($m)) {
        Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
        throw "Safe abort: instrumentation point missing: $m. Original source restored."
    }
}

[System.IO.File]::WriteAllText($Page, $patched, [System.Text.UTF8Encoding]::new($false))
Write-Host "Temporary V5.3 instrumentation applied."

$tscLog = Join-Path $env:TEMP "iepdf-merge-v53-tsc-$Stamp.txt"
$buildLog = Join-Path $env:TEMP "iepdf-merge-v53-build-$Stamp.txt"

try {
    Write-Host ""
    Write-Host "===== TypeScript validation ====="
    & pnpm exec tsc --noEmit 2>&1 | Tee-Object -FilePath $tscLog
    if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed." }

    Write-Host ""
    Write-Host "===== Production build validation ====="
    & pnpm build 2>&1 | Tee-Object -FilePath $buildLog
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

    $fixture = Get-ChildItem -Path (Join-Path $Root "_regression\merge-pdf") -Filter "*.pdf" -File |
        Where-Object { $_.Length -le 15MB } |
        Select-Object -First 1
    if (-not $fixture) { throw "No <=15 MiB PDF fixture found." }

    # Runner is physically inside the frontend project so require() resolves
    # the project's pnpm/node_modules tree.
    $runnerContent = @'
const fs = require("fs");

(async () => {
  const lines = [];
  const log = x => { lines.push(x); console.log(x); };

  const report = process.env.IEPDF_REPORT;
  const fixture = process.env.IEPDF_FIXTURE;

  let chromium;
  try {
    ({ chromium } = require("@playwright/test"));
  } catch (e1) {
    try {
      ({ chromium } = require("playwright"));
    } catch (e2) {
      throw new Error("Could not load project Playwright. @playwright/test: " + e1.message + " | playwright: " + e2.message);
    }
  }

  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  const chrome = candidates.find(fs.existsSync);
  if (!chrome) throw new Error("Google Chrome executable not found.");

  log("PLAYWRIGHT_MODULE_OK");
  log("CHROME=" + chrome);

  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage();

  const diag = [];
  const errors = [];
  const failed = [];
  const consoleAll = [];

  page.on("console", msg => {
    const t = msg.text();
    consoleAll.push(`[${msg.type()}] ${t}`);
    if (t.includes("IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V53")) {
      diag.push(`[${msg.type()}] ${t}`);
      log("APP " + t);
    }
  });

  page.on("pageerror", e => {
    const x = String(e.stack || e);
    errors.push(x);
    log("PAGE_ERROR " + x);
  });

  page.on("requestfailed", r => {
    const x = `${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`;
    failed.push(x);
  });

  await page.goto("http://localhost:3000/merge-pdf", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  log("ROUTE_OK " + (await page.title()) + " " + page.url());

  const input = page.locator('input[type="file"]').first();
  if (await input.count() !== 1) throw new Error("Expected exactly one file input.");

  await page.evaluate(() => {
    window.__v53change = 0;
    const el = document.querySelector('input[type="file"]');
    if (el) {
      el.addEventListener("change", () => { window.__v53change++; }, true);
    }
  });

  log("SET_INPUT_FILE=" + fixture);
  await input.setInputFiles(fixture);

  for (const ms of [250, 750, 1500, 3000, 5000, 8000]) {
    await page.waitForTimeout(ms);

    const state = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const buttons = Array.from(document.querySelectorAll("button"));
      return {
        nativeChange: window.__v53change || 0,
        inputFiles: Array.from(document.querySelectorAll('input[type="file"]')).map(i =>
          Array.from(i.files || []).map(f => ({name:f.name,size:f.size,type:f.type}))
        ),
        removeButtons: buttons.filter(b => (b.textContent || "").trim() === "Remove").length,
        handles: document.querySelectorAll('[draggable="true"]').length,
        mergeDisabled: buttons.some(b => (b.textContent || "").includes("Unlock & Merge") && b.disabled),
        counts: {
          files0: /Files\s*0/.test(text),
          total0: /Total\s*0/.test(text),
          ready0: /Ready\s*0/.test(text)
        }
      };
    });

    log(`STATE_${ms}MS ` + JSON.stringify(state));
  }

  log("=== APP_DIAGNOSTIC_MARKERS ===");
  for (const x of diag) log(x);

  log("=== PAGE_ERRORS ===");
  for (const x of errors) log(x);

  log("=== FAILED_REQUESTS ===");
  for (const x of failed) log(x);

  log("FINAL " + JSON.stringify(await page.evaluate(() => ({
    nativeChange: window.__v53change || 0,
    removeButtons: Array.from(document.querySelectorAll("button")).filter(b => (b.textContent || "").trim() === "Remove").length,
    handles: document.querySelectorAll('[draggable="true"]').length,
    mergeDisabled: Array.from(document.querySelectorAll("button")).some(b => (b.textContent || "").includes("Unlock & Merge") && b.disabled)
  }))));

  await browser.close();

  fs.writeFileSync(report, lines.join("\n") + "\n", "utf8");
  console.log("REPORT_WRITTEN=" + report);
})().catch(e => {
  console.error(e.stack || e);
  process.exitCode = 1;
});
'@

    [System.IO.File]::WriteAllText($Runner, $runnerContent, [System.Text.UTF8Encoding]::new($false))

    $env:IEPDF_REPORT = $Report
    $env:IEPDF_FIXTURE = $fixture.FullName

    Write-Host ""
    Write-Host "===== Browser direct correlation test ====="
    Push-Location $Root
    try {
        node $Runner
        $nodeExit = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if (Test-Path $Report) {
        $text = [System.IO.File]::ReadAllText($Report, [System.Text.Encoding]::UTF8)

        if ($text.Contains("ANALYZER_AFTER")) {
            $interp = "ANALYZER_RETURNED: inspect ANALYZER_AFTER and SET_WORKSPACE."
        } elseif ($text.Contains("ANALYZER_BEFORE")) {
            $interp = "ANALYZER_STARTED_BUT_DID_NOT_RETURN."
        } elseif ($text.Contains("PROCESS_ENTER")) {
            $interp = "PROCESS_STARTED_BUT_ANALYZER_NOT_REACHED."
        } elseif ($text.Contains("CHANGE_ENTER")) {
            $interp = "CHANGE_HANDLER_REACHED_BUT_PROCESS_NOT_STARTED."
        } else {
            $interp = "NO_V53_APP_MARKERS_CAPTURED."
        }

        Add-Content -LiteralPath $Report -Value "`r`n===== V5.3 INTERPRETATION =====`r`n$interp`r`nNodeExit=$nodeExit"
    }
}
finally {
    Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
    Remove-Item Env:IEPDF_REPORT -ErrorAction SilentlyContinue
    Remove-Item Env:IEPDF_FIXTURE -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "Original Merge page restored from backup."
}

Write-Host ""
Write-Host "===== FINAL ====="
Write-Host "Report: $Report"
Write-Host "Backup: $BackupPage"
Write-Host "NO PERMANENT SOURCE CHANGES."
Write-Host "NO LIVE DEPLOYMENT."
