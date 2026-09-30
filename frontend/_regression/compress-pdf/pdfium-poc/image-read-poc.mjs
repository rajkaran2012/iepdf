import { readFile } from "node:fs/promises";
import { init } from "@embedpdf/pdfium";

const inputPath =
  "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-04-image-heavy.pdf";

const wasmPath =
  "C:\\IEPDF\\frontend\\node_modules\\@embedpdf\\pdfium\\dist\\pdfium.wasm";

async function main() {
  console.log("=== PDFium Image Read-Only POC v2 ===");

  const pdfBytes = await readFile(inputPath);
  const wasmBytes = await readFile(wasmPath);

  console.log("Input bytes:", pdfBytes.length);
  console.log("WASM bytes:", wasmBytes.length);

  const pdfium = await init({
    locateFile: () => wasmPath,
    wasmBinary: wasmBytes,
  });

  console.log("PDFium wrapper initialized.");

  // Required by EmbedPDF before PDF operations.
  pdfium.PDFiumExt_Init();

  console.log("PDFiumExt_Init completed.");

  const mem = pdfium.pdfium.wasmExports;

  const pdfPtr = mem.malloc(pdfBytes.length);

  try {
    // Copy PDF bytes into WASM memory.
    for (let i = 0; i < pdfBytes.length; i++) {
      pdfium.pdfium.setValue(
        pdfPtr + i,
        pdfBytes[i],
        "i8"
      );
    }

    console.log("PDF copied into WASM memory.");

    const docPtr = pdfium.FPDF_LoadMemDocument(
      pdfPtr,
      pdfBytes.length,
      ""
    );

    console.log("Document pointer:", docPtr);

    if (!docPtr) {
      throw new Error("FPDF_LoadMemDocument failed.");
    }

    try {
      const pageCount = pdfium.FPDF_GetPageCount(docPtr);

      console.log("Page count:", pageCount);

      const pagePtr = pdfium.FPDF_LoadPage(docPtr, 0);

      console.log("Page pointer:", pagePtr);

      if (!pagePtr) {
        throw new Error("FPDF_LoadPage failed.");
      }

      try {
        const objectCount =
          pdfium.FPDFPage_CountObjects(pagePtr);

        console.log(
          "Page 0 object count:",
          objectCount
        );

        let imageCount = 0;

        for (let i = 0; i < objectCount; i++) {
          const objectPtr =
            pdfium.FPDFPage_GetObject(pagePtr, i);

          if (!objectPtr) {
            console.log(`Object ${i}: null`);
            continue;
          }

          const type =
            pdfium.FPDFPageObj_GetType(objectPtr);

          console.log(
            `Object ${i}: ptr=${objectPtr}, type=${type}`
          );

          // PDFium FPDF_PAGEOBJ_IMAGE = 3
          if (type === 3) {
            imageCount++;

            const widthPtr = mem.malloc(4);
            const heightPtr = mem.malloc(4);

            try {
              const ok =
                pdfium.FPDFImageObj_GetImagePixelSize(
                  objectPtr,
                  widthPtr,
                  heightPtr
                );

              const width =
                pdfium.pdfium.getValue(
                  widthPtr,
                  "i32"
                );

              const height =
                pdfium.pdfium.getValue(
                  heightPtr,
                  "i32"
                );

              console.log(
                `  IMAGE: ok=${ok}, pixelSize=${width}x${height}`
              );

              const filterCount =
                pdfium.FPDFImageObj_GetImageFilterCount(
                  objectPtr
                );

              console.log(
                `  IMAGE: filterCount=${filterCount}`
              );
            } finally {
              mem.free(widthPtr);
              mem.free(heightPtr);
            }
          }
        }

        console.log(
          "Image object count:",
          imageCount
        );

        console.log(
          "=== READ-ONLY POC COMPLETE ==="
        );
      } finally {
        pdfium.FPDF_ClosePage(pagePtr);
      }
    } finally {
      pdfium.FPDF_CloseDocument(docPtr);
    }
  } finally {
    mem.free(pdfPtr);
  }
}

main().catch((error) => {
  console.error("POC FAILED");
  console.error(error);
  process.exitCode = 1;
});
