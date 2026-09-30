$ErrorActionPreference = "Continue"

$Root = "C:\IEPDF\frontend"
$RegDir = Join-Path $Root "_regression\merge-pdf"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $RegDir "merge-reorder-gate-2.3-callback-state-v3-$Stamp.txt"
$Runner = Join-Path $RegDir "merge-reorder-gate-2.3-v3-runner-$Stamp.cjs"

New-Item -ItemType Directory -Force -Path $RegDir | Out-Null

Write-Host "============================================================"
Write-Host "iePDF MERGE PDF - GATE 2.3 CALLBACK -> PARENT STATE DIAGNOSTIC V3"
Write-Host "============================================================"
Write-Host "READ-ONLY TEMPORARY INSTRUMENTATION"
Write-Host "SOURCE IS ALWAYS RESTORED"
Write-Host "NO GIT / NO DEPLOYMENT / NO CACHE DELETION"
Write-Host ""

$component = Join-Path $Root "components\MergeWorkspace.tsx"
$pageFile = Join-Path $Root "app\merge-pdf\page.tsx"

$backupDir = $null

function Read-Utf8NoBom([string]$Path) {
    [System.IO.File]::ReadAllText(
        (Resolve-Path -LiteralPath $Path),
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText(
        $Path,
        $Text,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Find-MatchingBrace([string]$Text, [int]$OpenBraceIndex) {
    $depth = 0
    $single = $false
    $double = $false
    $template = $false
    $lineComment = $false
    $blockComment = $false
    $escaped = $false

    for ($i = $OpenBraceIndex; $i -lt $Text.Length; $i++) {
        $ch = $Text[$i]
        $next = if ($i + 1 -lt $Text.Length) { $Text[$i + 1] } else { [char]0 }

        if ($lineComment) {
            if ($ch -eq "`n") { $lineComment = $false }
            continue
        }

        if ($blockComment) {
            if ($ch -eq "*" -and $next -eq "/") {
                $blockComment = $false
                $i++
            }
            continue
        }

        if ($escaped) {
            $escaped = $false
            continue
        }

        if (($single -or $double -or $template) -and $ch -eq "\") {
            $escaped = $true
            continue
        }

        if (-not $single -and -not $double -and -not $template -and $ch -eq "/" -and $next -eq "/") {
            $lineComment = $true
            $i++
            continue
        }

        if (-not $single -and -not $double -and -not $template -and $ch -eq "/" -and $next -eq "*") {
            $blockComment = $true
            $i++
            continue
        }

        if (-not $double -and -not $template -and $ch -eq "'") {
            $single = -not $single
            continue
        }

        if (-not $single -and -not $template -and $ch -eq '"') {
            $double = -not $double
            continue
        }

        if (-not $single -and -not $double -and $ch -eq '`') {
            $template = -not $template
            continue
        }

        if ($single -or $double -or $template) {
            continue
        }

        if ($ch -eq "{") {
            $depth++
        }
        elseif ($ch -eq "}") {
            $depth--
            if ($depth -eq 0) {
                return $i
            }
        }
    }

    return -1
}

try {
    if (-not (Test-Path -LiteralPath $component)) { throw "MergeWorkspace.tsx not found." }
    if (-not (Test-Path -LiteralPath $pageFile)) { throw "app/merge-pdf/page.tsx not found." }

    $wsOriginal = Read-Utf8NoBom $component
    $pageOriginal = Read-Utf8NoBom $pageFile

    Write-Host "=== SOURCE DISCOVERY ==="
    Write-Host ("WS onReorderFiles occurrences: " + ([regex]::Matches($wsOriginal, "onReorderFiles").Count))
    Write-Host ("WS reorder MIME occurrences: " + ([regex]::Matches($wsOriginal, "application/x-iepdf-reorder").Count))
    Write-Host ("PAGE handleReorderFiles occurrences: " + ([regex]::Matches($pageOriginal, "handleReorderFiles").Count))
    Write-Host ("PAGE setWorkspaceFiles occurrences: " + ([regex]::Matches($pageOriginal, "setWorkspaceFiles").Count))

    $backupDir = Join-Path $Root "_ui-backups\GATE-2.3-V3-DIAGNOSTIC-$Stamp"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item $component (Join-Path $backupDir "MergeWorkspace.tsx") -Force
    Copy-Item $pageFile (Join-Path $backupDir "page.tsx") -Force
    Write-Host "Backup: $backupDir"

    $ws = $wsOriginal
    $page = $pageOriginal

    # ------------------------------------------------------------
    # CHILD: find the actual onReorderFiles(...) call and log its
    # real arguments. No assumption about variable names.
    # ------------------------------------------------------------

    $childCalls = [regex]::Matches($ws, '(?m)(?<indent>^[ \t]*)onReorderFiles\s*\((?<arg>[^()\r\n]*)\)\s*;')

    if ($childCalls.Count -eq 0) {
        throw "Could not locate an onReorderFiles(...) call in MergeWorkspace.tsx."
    }

    Write-Host "Child callback calls found: $($childCalls.Count)"

    # Instrument all simple call-shaped occurrences. In the current
    # component the callback invocation is expected to have simple args.
    $offset = 0

    foreach ($m in $childCalls) {
        $originalIndex = $m.Index + $offset
        $argText = $m.Groups["arg"].Value.Trim()
        $indent = $m.Groups["indent"].Value

        $log = $indent + 'console.log("IEPDF_V23|CHILD_CALLBACK|" + JSON.stringify({ args: "' +
            ($argText -replace '"','\"') + '", values: [' +
            $argText + '] }));' + "`r`n"

        $ws = $ws.Insert($originalIndex, $log)
        $offset += $log.Length
    }

    # ------------------------------------------------------------
    # CHILD DROP: instrument the actual handleDrop declaration, if
    # available, without assuming its parameter list.
    # ------------------------------------------------------------

    $drop = [regex]::Match(
        $ws,
        '(?m)(?<indent>^[ \t]*)const[ \t]+handleDrop[ \t]*=[ \t]*\((?<params>[^)]*)\)[ \t]*=>[ \t]*\{'
    )

    if ($drop.Success) {
        $dropBodyStart = $drop.Index + $drop.Length
        $dropLog = $drop.Groups["indent"].Value + '  console.log("IEPDF_V23|CHILD_DROP_ENTER|" + JSON.stringify({ params: "' +
            (($drop.Groups["params"].Value) -replace '"','\"') + '" }));' + "`r`n"
        $ws = $ws.Insert($dropBodyStart, $dropLog)
        Write-Host "Child handleDrop instrumented."
    }
    else {
        Write-Host "INFO: handleDrop declaration not matched; callback logging remains active."
    }

    # ------------------------------------------------------------
    # PARENT: find actual handleReorderFiles declaration, extract its
    # real parameter names, and log those parameters at entry.
    # ------------------------------------------------------------

    $parent = [regex]::Match(
        $page,
        '(?m)(?<indent>^[ \t]*)const[ \t]+handleReorderFiles[ \t]*=[ \t]*\((?<params>[^)]*)\)[ \t]*=>[ \t]*\{'
    )

    if (-not $parent.Success) {
        throw "Could not locate parent handleReorderFiles declaration."
    }

    $parentParamsRaw = $parent.Groups["params"].Value.Trim()
    Write-Host "Parent callback parameters: $parentParamsRaw"

    $paramParts = @($parentParamsRaw -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })

    if ($paramParts.Count -eq 0) {
        throw "Parent callback parameter list is empty."
    }

    $parentObjectParts = @()
    foreach ($p in $paramParts) {
        $name = ($p -split ":" | Select-Object -First 1).Trim()
        $name = ($name -replace "\?.*$","").Trim()

        if ($name -notmatch '^[A-Za-z_$][A-Za-z0-9_$]*$') {
            Write-Host "INFO: Could not safely reference parent parameter: $p"
            continue
        }

        $parentObjectParts += ($name + ": " + $name)
    }

    $parentObject = $parentObjectParts -join ", "

    $parentInsert = $parent.Index + $parent.Length
    $parentLog = $parent.Groups["indent"].Value + '  console.log("IEPDF_V23|PARENT_CALLBACK|" + JSON.stringify({' +
        $parentObject + '}));' + "`r`n"

    $page = $page.Insert($parentInsert, $parentLog)

    # ------------------------------------------------------------
    # STATE: find setWorkspaceFiles functional updater occurring
    # inside the parent callback. Extract the actual previous-state
    # parameter name and log it. Also log every return expression
    # immediately before the updater closes.
    # ------------------------------------------------------------

    $parentOpen = $parent.Index + $parent.Length
    $parentClose = Find-MatchingBrace $page ($page.IndexOf("{", $parent.Index + $parent.Length - 1))

    if ($parentClose -gt $parentOpen) {
        $parentBodyLength = $parentClose - $parentOpen
        $parentBody = $page.Substring($parentOpen, $parentBodyLength)

        $state = [regex]::Match(
            $parentBody,
            '(?m)setWorkspaceFiles[ \t]*\([ \t]*\([ \t]*(?<prev>[A-Za-z_$][A-Za-z0-9_$]*)[ \t]*\)[ \t]*=>[ \t]*\{'
        )

        if ($state.Success) {
            $prevName = $state.Groups["prev"].Value
            $absoluteStateOpen = $parentOpen + $state.Index
            $stateBrace = $page.IndexOf("{", $absoluteStateOpen)

            $stateClose = Find-MatchingBrace $page $stateBrace

            if ($stateClose -gt $stateBrace) {
                $stateLog = '      console.log("IEPDF_V23|STATE_PREVIOUS|" + JSON.stringify({' +
                    'count: ' + $prevName + '.length, order: ' +
                    $prevName + '.map((f) => ({ id: f.id, name: f.file?.name || "" }))' +
                    '}));' + "`r`n"

                $page = $page.Insert($stateBrace + 1, "`r`n" + $stateLog)

                # Recalculate after insertion and insert a log immediately
                # before the updater's closing brace.
                $stateClose += (2 + $stateLog.Length)

                $nextLog = '      console.log("IEPDF_V23|STATE_UPDATER_EXIT|" + JSON.stringify({ note: "updater reached closing brace" }));' + "`r`n"
                $page = $page.Insert($stateClose, $nextLog)

                Write-Host "State updater instrumented with previous-state trace."
            }
            else {
                Write-Host "INFO: State updater brace matching failed."
            }
        }
        else {
            Write-Host "INFO: Functional setWorkspaceFiles updater not found inside parent callback."
        }
    }
    else {
        Write-Host "INFO: Parent callback body boundary could not be determined."
    }

    Write-Utf8NoBom $component $ws
    Write-Utf8NoBom $pageFile $page

    Write-Host ""
    Write-Host "Temporary instrumentation applied."

    Write-Host ""
    Write-Host "=== TYPESCRIPT CHECK ==="
    Push-Location $Root
    & pnpm exec tsc --noEmit
    $tsExit = $LASTEXITCODE
    Pop-Location

    if ($tsExit -ne 0) {
        throw "TypeScript failed after V3 instrumentation. No browser test will run."
    }

    Write-Host "TypeScript PASS"

    $fixtures = @(Get-ChildItem -LiteralPath $RegDir -Filter "*.pdf" -File | Sort-Object Name)
    if ($fixtures.Count -lt 3) {
        throw "Need at least 3 PDF fixtures in $RegDir. Found $($fixtures.Count)."
    }

    $A = $fixtures[0].FullName
    $B = $fixtures[1].FullName
    $C = $fixtures[2].FullName

    $runnerText = @'
const { chromium } = require("playwright");
const fs = require("fs");

const report = process.argv[2];
const A = process.argv[3];
const B = process.argv[4];
const C = process.argv[5];

const names = [
  A.split(/[\\/]/).pop(),
  B.split(/[\\/]/).pop(),
  C.split(/[\\/]/).pop()
];

const logs = [];
const errors = [];
const failed = [];

function emit(s) {
  logs.push(s);
  console.log(s);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on("console", msg => {
    const t = msg.text();
    if (t.includes("IEPDF_V23|")) emit("APP " + t);
    if (msg.type() === "error") errors.push(t);
  });

  page.on("pageerror", e => errors.push("PAGEERROR " + String(e?.stack || e)));
  page.on("requestfailed", r => failed.push(
    `${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`
  ));

  await page.goto(
    `http://localhost:3000/merge-pdf?gate23v3=${Date.now()}`,
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(1200);

  await page.locator('input[type="file"]').first().setInputFiles([A, B, C]);

  const loaded = await page.waitForFunction(
    wanted => {
      const t = document.body?.innerText || "";
      return wanted.every(n => t.includes(n));
    },
    names,
    { timeout: 20000 }
  ).then(() => true).catch(() => false);

  const rows = await page.waitForFunction(
    n => [...document.querySelectorAll("button")]
      .filter(b => /Remove PDF/i.test((b.innerText || "").trim())).length >= n,
    3,
    { timeout: 20000 }
  ).then(() => true).catch(() => false);

  emit(`LOAD loaded=${loaded} rows=${rows}`);

  const before = await page.locator("body").innerText();
  emit(`BEFORE_ORDER ${JSON.stringify(names.map(n => ({ name: n, position: before.indexOf(n) })))}`);

  const removeButtons = page.getByRole("button", { name: /Remove PDF/i });

  async function rowFor(index) {
    let row = removeButtons.nth(index).locator("..");
    for (let i = 0; i < 8; i++) {
      const txt = await row.innerText().catch(() => "");
      if (/\d+\s*Pages/i.test(txt)) break;
      row = row.locator("..");
    }
    return row;
  }

  const sourceRow = await rowFor(2);
  const targetRow = await rowFor(0);
  const handle = sourceRow.locator('[draggable="true"][aria-label*="Drag PDF"]').first();

  emit(`HANDLE_COUNT ${await handle.count()}`);
  emit(`HANDLE_ATTR ${JSON.stringify(await handle.evaluate(el => ({
    draggable: el.getAttribute("draggable"),
    aria: el.getAttribute("aria-label"),
    title: el.getAttribute("title")
  })).catch(() => null))}`);

  emit("=== PLAYWRIGHT DRAG C -> A ===");

  try {
    await handle.dragTo(targetRow, { timeout: 15000 });
    emit("DRAGTO_OK true");
  } catch (e) {
    emit("DRAGTO_OK false ERROR=" + String(e?.message || e));
  }

  await page.waitForTimeout(1800);

  const after = await page.locator("body").innerText();
  const pos = names.map(n => ({ name: n, position: after.indexOf(n) }));

  emit(`AFTER_ORDER ${JSON.stringify(pos)}`);
  emit(`C_TO_A_EXPECTED ${pos[2].position >= 0 && pos[2].position < pos[0].position && pos[0].position < pos[1].position}`);

  emit(`PAGE_ERRORS ${JSON.stringify(errors)}`);
  emit(`FAILED_REQUESTS ${JSON.stringify(failed)}`);

  fs.writeFileSync(
    report,
    [
      "iePDF MERGE PDF - GATE 2.3 CALLBACK -> PARENT STATE DIAGNOSTIC V3",
      "",
      ...logs,
      "",
      "PAGE/CONSOLE ERRORS:",
      ...(errors.length ? errors : ["NONE"]),
      "",
      "FAILED REQUESTS:",
      ...(failed.length ? failed : ["NONE"])
    ].join("\n"),
    "utf8"
  );

  await browser.close();

  console.log("");
  console.log("GATE 2.3 V3 DIAGNOSTIC COMPLETE");
  console.log("Report: " + report);
  console.log("NO SOURCE CHANGES REMAIN AFTER RESTORE");
})().catch(e => {
  console.error("GATE_2_3_V3_FATAL");
  console.error(e?.stack || e);
  process.exitCode = 3;
});
'@

    Write-Utf8NoBom $Runner $runnerText

    Write-Host ""
    Write-Host "=== BROWSER CALLBACK / STATE TRACE ==="
    Push-Location $Root
    & node $Runner $Report $A $B $C
    $runExit = $LASTEXITCODE
    Pop-Location

    Write-Host "Browser diagnostic exit code: $runExit"
}
catch {
    Write-Host ""
    Write-Host "GATE 2.3 V3 ERROR:"
    Write-Host $_.Exception.Message
}
finally {
    try {
        if ($backupDir) {
            Copy-Item (Join-Path $backupDir "MergeWorkspace.tsx") $component -Force
            Copy-Item (Join-Path $backupDir "page.tsx") $pageFile -Force
        }
        Write-Host ""
        Write-Host "Original application source restored."
    }
    catch {
        Write-Host ""
        Write-Host "CRITICAL RESTORE ERROR:"
        Write-Host $_.Exception.Message
    }

    if (Test-Path -LiteralPath $Runner) {
        Remove-Item -LiteralPath $Runner -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "=== POST-RESTORE TYPESCRIPT CHECK ==="
    Push-Location $Root
    & pnpm exec tsc --noEmit
    $restoreExit = $LASTEXITCODE
    Pop-Location

    if ($restoreExit -eq 0) {
        Write-Host "Post-restore TypeScript PASS"
    }
    else {
        Write-Host "Post-restore TypeScript FAIL"
    }

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "GATE 2.3 V3 COMPLETE"
    Write-Host "Report: $Report"
    Write-Host "NO SOURCE CHANGES"
    Write-Host "NO GIT"
    Write-Host "NO DEPLOYMENT"
    Write-Host "NO CACHE DELETION"
    Write-Host "============================================================"
}
