import { readFile } from "node:fs/promises";
import { init } from "@embedpdf/pdfium";

const inputPath =
  "C:\\IEPDF\\frontend\\_regression\\compress-pdf\\C-04-image-heavy.pdf";

const wasmPath =
  "C:\\IEPDF\\frontend\\node_modules\\@embedpdf\\pdfium\\dist\\pdfium.wasm";

async function main() {
  console.log("=== PDFium Image Data Extraction POC v2 ===");

  const pdfBytes = await readFile(inputPath);
  const wasmBytes = await readFile(wasmPath);

  const pdfium = await init({
    locateFile: () => wasmPath,
    wasmBinary: wasmBytes,
  });

  pdfium.PDFiumExt_Init();

  const mem = pdfium.pdfium.wasmExports;

  const pdfPtr = mem.malloc(pdfBytes.length);

  try {
    for (let i = 0; i < pdfBytes.length; i++) {
      pdfium.pdfium.setValue(
        pdfPtr + i,
        pdfBytes[i],
        "i8"
      );
    }

    const docPtr = pdfium.FPDF_LoadMemDocument(
      pdfPtr,
      pdfBytes.length,
      ""
    );

    if (!docPtr) {
      throw new Error("FPDF_LoadMemDocument failed.");
    }

    try {
      const pagePtr = pdfium.FPDF_LoadPage(docPtr, 0);

      if (!pagePtr) {
        throw new Error("FPDF_LoadPage failed.");
      }

      try {
        const objectCount =
          pdfium.FPDFPage_CountObjects(pagePtr);

        let imagePtr = 0;

        for (let i = 0; i < objectCount; i++) {
          const objectPtr =
            pdfium.FPDFPage_GetObject(pagePtr, i);

          if (
            objectPtr &&
            pdfium.FPDFPageObj_GetType(objectPtr) === 3
          ) {
            imagePtr = objectPtr;
            break;
          }
        }

        if (!imagePtr) {
          throw new Error("No image object found.");
        }

        console.log("Image object:", imagePtr);

        // --------------------------------------------------
        // RAW DATA
        // --------------------------------------------------

        const rawLength =
          pdfium.FPDFImageObj_GetImageDataRaw(
            imagePtr,
            0,
            0
          );

        console.log(
          "RAW length:",
          rawLength
        );

        if (rawLength <= 0) {
          throw new Error(
            "RAW image data length is invalid."
          );
        }

        const rawPtr = mem.malloc(rawLength);

        try {
          const rawResult =
            pdfium.FPDFImageObj_GetImageDataRaw(
              imagePtr,
              rawPtr,
              rawLength
            );

          console.log(
            "RAW second-call return:",
            rawResult
          );

          const rawSample = [];

          for (
            let i = 0;
            i < Math.min(rawLength, 32);
            i++
          ) {
            rawSample.push(
              pdfium.pdfium.getValue(
                rawPtr + i,
                "i8"
              ) & 0xff
            );
          }

          console.log(
            "RAW first bytes:",
            rawSample
          );
        } finally {
          mem.free(rawPtr);
        }

        // --------------------------------------------------
        // DECODED DATA
        // --------------------------------------------------

        const decodedLength =
          pdfium.FPDFImageObj_GetImageDataDecoded(
            imagePtr,
            0,
            0
          );

        console.log(
          "DECODED length:",
          decodedLength
        );

        if (decodedLength <= 0) {
          throw new Error(
            "DECODED image data length is invalid."
          );
        }

        const decodedPtr =
          mem.malloc(decodedLength);

        try {
          const decodedResult =
            pdfium.FPDFImageObj_GetImageDataDecoded(
              imagePtr,
              decodedPtr,
              decodedLength
            );

          console.log(
            "DECODED second-call return:",
            decodedResult
          );

          const decodedSample = [];

          for (
            let i = 0;
            i < Math.min(decodedLength, 32);
            i++
          ) {
            decodedSample.push(
              pdfium.pdfium.getValue(
                decodedPtr + i,
                "i8"
              ) & 0xff
            );
          }

          console.log(
            "DECODED first bytes:",
            decodedSample
          );
        } finally {
          mem.free(decodedPtr);
        }

        console.log(
          "=== IMAGE DATA EXTRACTION SUCCESS ==="
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
