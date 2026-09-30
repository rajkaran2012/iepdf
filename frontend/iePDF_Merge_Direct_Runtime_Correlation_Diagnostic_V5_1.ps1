# iePDF Merge - Direct Source/Runtime Correlation Diagnostic V5.1
# Temporary instrumentation only. ALWAYS restores app/merge-pdf/page.tsx.
# No Git. No deployment. No permanent source change.

$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$ReportDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\merge-runtime-diagnostic-v51-$Stamp"
$BackupPage = Join-Path $BackupDir "page.tsx"
$Report = Join-Path $ReportDir "merge-runtime-direct-correlation-v51-$Stamp.txt"
$Runner = Join-Path $env:TEMP "iePDF-merge-runtime-v51-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

if (-not (Test-Path -LiteralPath $Page)) { throw "Merge page not found: $Page" }

Copy-Item -LiteralPath $Page -Destination $BackupPage -Force
$original = [System.IO.File]::ReadAllText($Page, [System.Text.Encoding]::UTF8)

$marker = "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51"
if ($original.Contains($marker)) { throw "V5.1 marker already exists. Refusing to stack instrumentation." }

$patched = $original

# Instrument processSelectedFiles AFTER its parameter list / opening brace.
$p = '(?s)(const\s+processSelectedFiles\s*=\s*async\s*\(\s*files\s*:\s*File\[\]\s*\)\s*=>\s*\{)'
$r = '$1' + "`r`n" +
'    console.log("' + $marker + ' PROCESS_ENTER", { fileCount: files.length, names: files.map((f: File) => f.name), sizes: files.map((f: File) => f.size) });'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Instrument analyzer call without changing the statement.
$p = '(?m)^(\s*)(const\s+analysis\s*=\s*await\s+analyzer\.analyzeMany\(files\);)'
$r = '$1console.log("' + $marker + ' ANALYZER_BEFORE", { fileCount: files.length });' + "`r`n" +
'$1$2' + "`r`n" +
'$1console.log("' + $marker + ' ANALYZER_AFTER", { count: analysis.length, results: analysis });'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Instrument immediately after workspace mapping closes, using a marker inserted
# before the existing setWorkspaceFiles call. This does not alter state logic.
$p = '(?m)^(\s*)(setWorkspaceFiles\s*\(\s*\(\s*previous\s*\)\s*=>\s*\[\.\.\.previous,\s*\.\.\.workspace\]\s*\);)'
$r = '$1console.log("' + $marker + ' SET_WORKSPACE", { workspaceCount: workspace.length, workspace: workspace });' + "`r`n" + '$1$2'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Instrument handleFileChange AFTER its files declaration if present, otherwise
# immediately after the function opening while referencing only parameters.
$p = '(?s)(const\s+handleFileChange\s*=\s*async\s*\(\s*event\s*:\s*React\.ChangeEvent<HTMLInputElement>\s*\)\s*=>\s*\{)'
$r = '$1' + "`r`n" +
'    console.log("' + $marker + ' CHANGE_ENTER", { fileCount: event.target.files?.length ?? 0, names: event.target.files ? Array.from(event.target.files).map((f: File) => f.name) : [] });'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Instrument the call to processSelectedFiles from handleFileChange.
$p = '(?m)^(\s*)(await\s+processSelectedFiles\(files\);)'
$r = '$1console.log("' + $marker + ' PROCESS_BEFORE_FROM_CHANGE", { fileCount: files.length });' + "`r`n" +
'$1$2' + "`r`n" +
'$1console.log("' + $marker + ' PROCESS_AFTER_FROM_CHANGE");'
$patched = [regex]::Replace($patched, $p, $r, 1)

$required = @(
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51 PROCESS_ENTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51 ANALYZER_BEFORE",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51 ANALYZER_AFTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51 SET_WORKSPACE",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51 CHANGE_ENTER",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51 PROCESS_BEFORE_FROM_CHANGE",
    "IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51 PROCESS_AFTER_FROM_CHANGE"
)

foreach ($m in $required) {
    if (-not $patched.Contains($m)) {
        Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
        throw "Safe abort: instrumentation point missing: $m. Original source restored."
    }
}

[System.IO.File]::WriteAllText($Page, $patched, [System.Text.UTF8Encoding]::new($false))
Write-Host "Temporary V5.1 instrumentation applied."

$tscLog = Join-Path $env:TEMP "iepdf-merge-v51-tsc-$Stamp.txt"
$buildLog = Join-Path $env:TEMP "iepdf-merge-v51-build-$Stamp.txt"

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

    $runner = @'
const fs = require("fs");

(async () => {
  const lines = [];
  const log = x => { lines.push(x); console.log(x); };
  const report = process.env.IEPDF_REPORT;
  const fixture = process.env.IEPDF_FIXTURE;

  let chromium;
  try {
    ({ chromium } = require("@playwright/test"));
  } catch {
    ({ chromium } = require("playwright"));
  }

  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  const chrome = candidates.find(fs.existsSync);
  if (!chrome) throw new Error("Google Chrome executable not found.");

  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage();

  const diag = [];
  const errors = [];
  const failed = [];

  page.on("console", msg => {
    const t = msg.text();
    if (t.includes("IEPDF_DIRECT_RUNTIME_DIAGNOSTIC_V51")) {
      diag.push(`[${msg.type()}] ${t}`);
      log("APP " + t);
    }
  });
  page.on("pageerror", e => {
    errors.push(String(e.stack || e));
    log("PAGE_ERROR " + String(e.stack || e));
  });
  page.on("requestfailed", r => {
    failed.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`);
  });

  await page.goto("http://localhost:3000/merge-pdf", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  const input = page.locator('input[type="file"]').first();
  if (await input.count() !== 1) throw new Error("Expected one file input.");

  await page.evaluate(() => {
    window.__v51change = 0;
    const el = document.querySelector('input[type="file"]');
    if (el) el.addEventListener("change", () => { window.__v51change++; }, true);
  });

  log("SET_INPUT_FILE " + fixture);
  await input.setInputFiles(fixture);

  for (const ms of [250, 750, 1500, 3000, 5000]) {
    await page.waitForTimeout(ms);
    const state = await page.evaluate(() => {
      const text = document.body.innerText || "";
      return {
        nativeChange: window.__v51change || 0,
        inputFiles: Array.from(document.querySelectorAll('input[type="file"]'))
          .map(i => Array.from(i.files || []).map(f => ({ name:f.name, size:f.size, type:f.type }))),
        removeButtons: Array.from(document.querySelectorAll("button"))
          .filter(b => (b.textContent || "").trim() === "Remove").length,
        handles: document.querySelectorAll('[draggable="true"]').length,
        mergeDisabled: Array.from(document.querySelectorAll("button"))
          .some(b => (b.textContent || "").includes("Unlock & Merge") && b.disabled),
        counts: {
          files0: /Files\\s*0/.test(text),
          total0: /Total\\s*0/.test(text),
          ready0: /Ready\\s*0/.test(text)
        }
      };
    });
    log(`STATE_${ms}MS ` + JSON.stringify(state));
  }

  const final = await page.evaluate(() => ({
    nativeChange: window.__v51change || 0,
    body: (document.body.innerText || "").slice(0, 8000),
    removeButtons: Array.from(document.querySelectorAll("button")).filter(b => (b.textContent || "").trim() === "Remove").length,
    handles: document.querySelectorAll('[draggable="true"]').length,
    mergeDisabled: Array.from(document.querySelectorAll("button")).some(b => (b.textContent || "").includes("Unlock & Merge") && b.disabled)
  }));

  log("=== DIAGNOSTIC_MARKERS ===");
  for (const x of diag) log(x);
  log("=== PAGE_ERRORS ===");
  for (const x of errors) log(x);
  log("=== FAILED_REQUESTS ===");
  for (const x of failed) log(x);
  log("FINAL " + JSON.stringify(final));

  await browser.close();
  fs.writeFileSync(report, lines.join("\n") + "\n", "utf8");
  log("REPORT_WRITTEN " + report);
})().catch(e => {
  console.error(e.stack || e);
  process.exitCode = 1;
});
'@

    [System.IO.File]::WriteAllText($Runner, $runner, [System.Text.UTF8Encoding]::new($false))

    $env:IEPDF_REPORT = $Report
    $env:IEPDF_FIXTURE = $fixture.FullName

    Write-Host ""
    Write-Host "===== Browser direct correlation test ====="
    node $Runner
    $exit = $LASTEXITCODE

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
            $interp = "NO_V51_APP_MARKERS_CAPTURED."
        }
        Add-Content -LiteralPath $Report -Value "`r`n===== V5.1 INTERPRETATION =====`r`n$interp`r`nNodeExit=$exit"
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
