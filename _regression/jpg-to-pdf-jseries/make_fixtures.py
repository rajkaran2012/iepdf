from PIL import Image
from pathlib import Path
import io, os

root = Path(r"C:\iepdf\_regression\jpg-to-pdf-jseries\fixtures")
root.mkdir(parents=True, exist_ok=True)

def jpg(name, size=(1200, 900), quality=90):
    p = root / name
    img = Image.new("RGB", size, (220, 180, 80))
    img.save(p, "JPEG", quality=quality, optimize=True)
    return p

def png(name, size=(1000, 700)):
    p = root / name
    img = Image.new("RGB", size, (80, 160, 220))
    img.save(p, "PNG", optimize=True)
    return p

# Basic valid fixtures
jpg("J01-single.jpg", (1200, 900))
jpg("J02-01.jpg", (1200, 900))
jpg("J02-02.jpg", (900, 1200))
jpg("J02-03.jpg", (1600, 1000))

# 5-image fixture
for i, size in enumerate([(1200,900),(900,1200),(1600,1000),(1000,1000),(1800,1200)], 1):
    jpg(f"J03-{i:02d}.jpg", size)

# 10-image fixture
for i in range(1, 11):
    jpg(f"J04-{i:02d}.jpg", (1200 + (i*20), 800 + (i*15)))

# Mixed dimensions/orientations
jpg("J05-portrait.jpg", (800, 1400))
jpg("J05-landscape.jpg", (1600, 900))
jpg("J05-square.jpg", (1000, 1000))

# PNG and mixed JPG/PNG
png("J06-image.png", (1100, 750))
jpg("J06-photo.jpg", (1400, 900))

# Spaces + Unicode
jpg("J07 file with spaces and unicode-टेस्ट.jpg", (1200, 900))

# Malformed / negative fixtures
(root / "J08-zero-byte.jpg").write_bytes(b"")
(root / "J09-fake-jpg.jpg").write_bytes(b"this is not a jpeg file")
(root / "J10-corrupt.jpg").write_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 24)

# Valid image below 15 MB
jpg("J11-under-15MB.jpg", (3000, 2200), quality=95)

# Exact / over 15 MB. Start from a valid JPEG, then append bytes.
limit = 15 * 1024 * 1024
base = jpg("J12-temp.jpg", (4000, 3000), quality=95)
data = base.read_bytes()

if len(data) >= limit:
    raise RuntimeError(f"Base JPEG unexpectedly >= 15 MB: {len(data)}")

exact = root / "J12-exact-15MB.jpg"
exact.write_bytes(data + b"\x00" * (limit - len(data)))

over = root / "J13-over-15MB.jpg"
over.write_bytes(data + b"\x00" * (limit - len(data) + 1))

base.unlink()

print("JPG/PDF J-Series fixtures created:")
for p in sorted(root.iterdir()):
    print(f"{p.name} | {p.stat().st_size} bytes")
