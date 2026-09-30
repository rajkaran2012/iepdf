# iePDF Merge - Render Path Direct Diagnostic V6
# Purpose: identify why workspace state exists but MergeWorkspace rows are not visible.
# Temporary instrumentation. ALWAYS restores app/merge-pdf/page.tsx.
# No Git. No deployment. No permanent source change.

$ErrorActionPreference = "Stop"

$Root = "C:\IEPDF\frontend"
$Page = Join-Path $Root "app\merge-pdf\page.tsx"
$ReportDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "_ui-backups\merge-render-diagnostic-v6-$Stamp"
$BackupPage = Join-Path $BackupDir "page.tsx"
$Report = Join-Path $ReportDir "merge-render-direct-diagnostic-v6-$Stamp.txt"
$Runner = Join-Path $Root "._iepdf_merge_render_v6_$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
if (-not (Test-Path -LiteralPath $Page)) { throw "Merge page not found: $Page" }

Copy-Item -LiteralPath $Page -Destination $BackupPage -Force
$original = [System.IO.File]::ReadAllText($Page, [System.Text.Encoding]::UTF8)
$marker = "IEPDF_RENDER_DIAGNOSTIC_V6"

if ($original.Contains($marker)) { throw "V6 marker already exists. Refusing to stack instrumentation." }

$patched = $original

# Instrument the actual MergeWorkspace JSX invocation. We locate a JSX tag beginning
# with MergeWorkspace and insert a harmless console.log immediately before it.
$p = '(?m)^(\s*)(<MergeWorkspace\b)'
$r = '$1{console.log("' + $marker + ' MERGEWORKSPACE_RENDER", { workspaceFilesCount: workspaceFiles.length, showWorkspace: showWorkspace });}' + "`r`n" + '$1$2'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Instrument props that commonly determine visibility.
$p = '(?m)^(\s*)(workspaceFiles=\{workspaceFiles\})'
$r = '$1workspaceFiles={workspaceFiles}' + "`r`n" + '$1{console.log("' + $marker + ' PROP_WORKSPACE_FILES", { count: workspaceFiles.length });}'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Instrument showWorkspace prop if present.
$p = '(?m)^(\s*)(showWorkspace=\{showWorkspace\})'
$r = '$1showWorkspace={showWorkspace}' + "`r`n" + '$1{console.log("' + $marker + ' PROP_SHOW_WORKSPACE", { value: showWorkspace });}'
$patched = [regex]::Replace($patched, $p, $r, 1)

# Instrument the state setter by adding a state snapshot in the updater body if possible.
$p = '(?m)^(\s*)(setWorkspaceFiles\s*\(\s*\(\s*previous\s*\)\s*=>\s*\[\.\.\.previous,\s*\.\.\.workspace\]\s*\);)'
$r = '$1console.log("' + $marker + ' SET_STATE', { previousCount: previous?.length ?? -1, newCount: workspace.length });' + "`r`n" + '$1$2'
# Do not apply this if the statement form doesn't expose previous in scope; source check below decides.
if ($patched -match $p) {
    # Use a safer replacement that logs outside the setter and therefore does not reference previous.
    $p2 = '(?m)^(\s*)(setWorkspaceFiles\s*\(\s*\(\s*previous\s*\)\s*=>\s*\[\.\.\.previous,\s*\.\.\.workspace\]\s*\);)'
    $r2 = '$1console.log("' + $marker + ' SET_STATE_SCHEDULED", { newCount: workspace.length });' + "`r`n" + '$1$2'
    $patched = [regex]::Replace($patched, $p2, $r2, 1)
}

$required = @(
    "IEPDF_RENDER_DIAGNOSTIC_V6 MERGEWORKSPACE_RENDER",
    "IEPDF_RENDER_DIAGNOSTIC_V6 PROP_WORKSPACE_FILES"
)

foreach ($m in $required) {
    if (-not $patched.Contains($m)) {
        Copy-Item -LiteralPath $BackupPage -Destination $Page -Force
        throw "Safe abort: required render instrumentation point missing: $m"
    }
}

[System.IO.File]::WriteAllText($Page, $patched, [System.Text.UTF8Encoding]::new($false))
Write-Host "Temporary V6 render instrumentation applied."

try {
    Write-Host ""
    Write-Host "===== TypeScript validation ====="
    & pnpm exec tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed." }

    Write-Host ""
    Write-Host "===== Production build validation ====="
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed." }

    $fixture = Get-ChildItem -Path (Join-Path $Root "_regression\merge-pdf") -Filter "*.pdf" -File |
        Where-Object { $_.Length -le 15MB } |
        Select-Object -First 1
    if (-not $fixture) { throw "No <=15 MiB PDF fixture found." }

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
  } catch {
    ({ chromium } = require("playwright"));
  }

  const chromeCandidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  const chrome = chromeCandidates.find(fs.existsSync);
  if (!chrome) throw new Error("Google Chrome executable not found.");

  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage();

  const diagnostic = [];
  const errors = [];
  const failed = [];

  page.on("console", msg => {
    const t = msg.text();
    if (t.includes("IEPDF_RENDER_DIAGNOSTIC_V6")) {
      diagnostic.push(`[${msg.type()}] ${t}`);
      log("APP " + t);
    }
  });

  page.on("pageerror", e => {
    const x = String(e.stack || e);
    errors.push(x);
    log("PAGE_ERROR " + x);
  });

  page.on("requestfailed", r => {
    failed.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`);
  });

  await page.goto("http://localhost:3000/merge-pdf", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  log("ROUTE " + page.url());

  const input = page.locator('input[type="file"]').first();
  if (await input.count() !== 1) throw new Error("Expected one file input.");

  await input.setInputFiles(fixture);

  for (const ms of [250, 750, 1500, 3000, 5000]) {
    await page.waitForTimeout(ms);
    const state = await page.evaluate(() => {
      const body = document.body.innerText || "";
      const mergeButtons = Array.from(document.querySelectorAll("button"))
        .filter(b => (b.textContent || "").includes("Unlock & Merge"));
      return {
        textStart: body.slice(0, 7000),
        filesZero: /Files\s*0/.test(body),
        totalZero: /Total\s*0/.test(body),
        readyZero: /Ready\s*0/.test(body),
        removeButtons: Array.from(document.querySelectorAll("button"))
          .filter(b => (b.textContent || "").trim() === "Remove").length,
        mergeButtons: mergeButtons.length,
        mergeDisabled: mergeButtons.some(b => b.disabled),
        workspaceRowsByRole: document.querySelectorAll('[data-iepdf-workspace-file]').length,
        listItems: document.querySelectorAll("li").length
      };
    });
    log(`STATE_${ms}MS ` + JSON.stringify(state));
  }

  log("=== DIAGNOSTIC ===");
  diagnostic.forEach(x => log(x));
  log("=== PAGE_ERRORS ===");
  errors.forEach(x => log(x));
  log("=== FAILED_REQUESTS ===");
  failed.forEach(x => log(x));

  const final = await page.evaluate(() => ({
    body: (document.body.innerText || "").slice(0, 10000),
    removeButtons: Array.from(document.querySelectorAll("button"))
      .filter(b => (b.textContent || "").trim() === "Remove").length,
    mergeDisabled: Array.from(document.querySelectorAll("button"))
      .some(b => (b.textContent || "").includes("Unlock & Merge") && b.disabled)
  }));
  log("FINAL " + JSON.stringify(final));

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
    Write-Host "===== Browser render-path test ====="
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
        if ($text.Contains("MERGEWORKSPACE_RENDER")) {
            $interp = "MERGEWORKSPACE_RENDER_REACHED: inspect props and actual DOM."
        } else {
            $interp = "MERGEWORKSPACE_RENDER_MARKER_NOT_SEEN: inspect parent render condition/wiring."
        }
        Add-Content -LiteralPath $Report -Value "`r`n===== V6 INTERPRETATION =====`r`n$interp`r`nNodeExit=$nodeExit"
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
