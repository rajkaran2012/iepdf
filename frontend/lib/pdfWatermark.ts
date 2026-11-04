import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

export async function watermarkPdfFile(file: File): Promise<File> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Watermarking requires a PDF file.");
  }

  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const label = "iePDF Free";
  const fontSize = 34;

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(label, {
      x: width * 0.12,
      y: height * 0.48,
      size: fontSize,
      font,
      color: rgb(0.45, 0.45, 0.45),
      opacity: 0.22,
      rotate: degrees(35),
    });
  }

  const bytes = await pdf.save();
  const output = new Uint8Array(bytes);
  return new File([output], file.name, { type: "application/pdf" });
}
