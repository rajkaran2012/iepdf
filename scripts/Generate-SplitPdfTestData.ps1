#requires -Version 5.1
$ErrorActionPreference="Stop"
$root="C:\IEPDF\frontend\_regression\split-pdf"
New-Item -ItemType Directory -Force $root | Out-Null
$py=Join-Path $root "_generate_split_test_data.py"

@"
from pathlib import Path
ROOT=Path(r"$root")
ROOT.mkdir(parents=True,exist_ok=True)
UNDER=15728639
EXACT=15728640
OVER=15728641
PASSWORD="iepdf123"

def esc(s):
    return s.replace("\\","\\\\").replace("(","\\(").replace(")","\\)")

def make_pdf(pages):
    o={1:"<< /Type /Catalog /Pages 2 0 R >>"}
    kids=[]
    nid=3
    fid=nid+(len(pages)*2)
    for w,h,text in pages:
        pid=nid; cid=nid+1; nid+=2
        stream=f"BT\n/F1 24 Tf\n72 {max(72,h-100)} Td\n({esc(text)}) Tj\nET\n"
        b=stream.encode("latin-1")
        o[cid]=f"<< /Length {len(b)} >>\nstream\n{stream}endstream"
        o[pid]=f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w} {h}] /Resources << /Font << /F1 {fid} 0 R >> >> /Contents {cid} 0 R >>"
        kids.append(pid)
    o[fid]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    o[2]=f"<< /Type /Pages /Count {len(kids)} /Kids [{' '.join(f'{x} 0 R' for x in kids)}] >>"
    m=max(o)
    out=bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    off=[0]*(m+1)
    for i in range(1,m+1):
        off[i]=len(out); out+=f"{i} 0 obj\n".encode("ascii")
        out+=o[i].encode("latin-1")+b"\nendobj\n"
    x=len(out)
    out+=f"xref\n0 {m+1}\n".encode("ascii")+b"0000000000 65535 f \n"
    for i in range(1,m+1): out+=f"{off[i]:010d} 00000 n \n".encode("ascii")
    out+=f"trailer\n<< /Size {m+1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode("ascii")
    return bytes(out)

def write_pages(name,n):
    (ROOT/name).write_bytes(make_pdf([(612,792,f"SPLIT PAGE {i+1}") for i in range(n)]))

def write_mixed():
    (ROOT/"S-05-mixed-pages.pdf").write_bytes(make_pdf([
        (612,792,"PAGE 1 - PORTRAIT - LETTER"),
        (792,612,"PAGE 2 - LANDSCAPE - LETTER"),
        (612,1008,"PAGE 3 - PORTRAIT - LEGAL"),
        (1008,612,"PAGE 4 - LANDSCAPE - LEGAL")
    ]))

def exact(name,target):
    b=make_pdf([(612,792,"SPLIT BOUNDARY TEST")])
    (ROOT/name).write_bytes(b+b" "*(target-len(b)))

write_pages("S-01-1page.pdf",1)
write_pages("S-02-2pages.pdf",2)
write_pages("S-03-5pages.pdf",5)
write_pages("S-04-10pages.pdf",10)
write_mixed()
(ROOT/"S-06-corrupted.pdf").write_bytes(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nintentionally corrupted\n")
(ROOT/"S-07-zero-byte.pdf").write_bytes(b"")
(ROOT/"S-08-renamed-nonpdf.pdf").write_bytes(b"This is not a PDF despite the .pdf extension.")

from pypdf import PdfReader,PdfWriter
src=ROOT/"_protected-source.pdf"
src.write_bytes(make_pdf([(612,792,"PROTECTED PAGE 1"),(612,792,"PROTECTED PAGE 2")]))
r=PdfReader(str(src)); w=PdfWriter()
for p in r.pages: w.add_page(p)
w.encrypt(PASSWORD)
with open(ROOT/"S-09-protected.pdf","wb") as f: w.write(f)
src.unlink(missing_ok=True)

exact("S-10-under-15MiB.pdf",UNDER)
exact("S-11-exact-15MiB.pdf",EXACT)
exact("S-12-over-15MiB.pdf",OVER)

for n in ["S-01-1page.pdf","S-02-2pages.pdf","S-03-5pages.pdf","S-04-10pages.pdf","S-05-mixed-pages.pdf","S-10-under-15MiB.pdf","S-11-exact-15MiB.pdf"]:
    rr=PdfReader(str(ROOT/n),strict=True)
    if rr.is_encrypted or len(rr.pages)<1: raise RuntimeError(f"Invalid generated PDF: {n}")

rr=PdfReader(str(ROOT/"S-09-protected.pdf"),strict=True)
if not rr.is_encrypted: raise RuntimeError("S-09 is not encrypted")

print("SPLIT TEST DATA CREATED")
for p in sorted(ROOT.glob("S-*.pdf")): print(f"{p.name} : {p.stat().st_size} bytes")
print("S-09 password : iepdf123")
print("ALL SPLIT TEST DATA VALIDATION PASSED")
"@ | Set-Content $py -Encoding UTF8

try {
    & python $py 2>&1 | ForEach-Object { Write-Host $_ }
    if($LASTEXITCODE -ne 0){throw "Python generator failed."}
} finally {
    Remove-Item $py -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "SPLIT TEST DATA READY" -ForegroundColor Green
Write-Host "Folder: $root"
