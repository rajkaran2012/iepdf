from pathlib import Path
import struct

base = Path(r"C:\iepdf\frontend\_branding\favicon-v2")
files = [
    (16, base / "favicon-16.png"),
    (32, base / "favicon-32.png"),
    (48, base / "favicon-48.png"),
]

images = [p.read_bytes() for _, p in files]

header = struct.pack("<HHH", 0, 1, len(images))
entries = []
offset = 6 + (16 * len(images))

for (size, _), data in zip(files, images):
    width = 0 if size == 256 else size
    height = 0 if size == 256 else size

    entries.append(
        struct.pack(
            "<BBBBHHII",
            width,
            height,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
    )

    offset += len(data)

output = base / "favicon-v2-multires.ico"
output.write_bytes(header + b"".join(entries) + b"".join(images))

print(f"Created: {output}")
print(f"Size: {output.stat().st_size} bytes")
