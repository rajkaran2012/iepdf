"use client";

import { useEffect, useState } from "react";
import { init } from "@embedpdf/pdfium";

type PdfiumInstance = Awaited<ReturnType<typeof init>>;

type CaseResult = {
  name: string;
  size: number;
  delta: number;
};

export default function PdfiumBc06Page() {
  const [output, setOutput] = useState("Starting...\n");

  useEffect(() => {
    let cancelled = false;

    const log = (...args: unknown[]) => {
      console.log(...args);
      if (!cancelled) {
        setOutput((prev) => prev + args.join(" ") + "\n");
      }
    };

    async function run() {
      try {
        log("=== BC-06 PDFium Size Attribution ===");

        const response = await fetch(
          "/_pdfium-poc/C-04-image-heavy.pdf"
        );

        if (!response.ok) {
          throw new Error(`PDF HTTP ${response.status}`);
        }

        const pdfBytes = new Uint8Array(
          await response.arrayBuffer()
        );

        log("Input PDF bytes:", pdfBytes.length);

        const pdfium = await init({});

        log("PDFium wrapper initialized.");

        pdfium.PDFiumExt_Init();

        log("PDFiumExt_Init completed.");

        const results: CaseResult[] = [];

        // --------------------------------------------------
        // Helper: save a PDFium document and verify output
        // --------------------------------------------------

        const saveDocument = (
          docPtr: number,
          label: string
        ): number => {
          const mem = pdfium.pdfium.wasmExports;

          log(`${label}: opening file writer...`);

          const writerPtr =
            pdfium.PDFiumExt_OpenFileWriter();

          if (!writerPtr) {
            throw new Error(
              `${label}: OpenFileWriter failed.`
            );
          }

          try {
            const saveResult =
              pdfium.PDFiumExt_SaveAsCopy(
                docPtr,
                writerPtr
              );

            log(
              `${label}: SaveAsCopy:`,
              saveResult
            );

            if (!saveResult) {
              throw new Error(
                `${label}: SaveAsCopy failed.`
              );
            }

            const savedSize =
              pdfium.PDFiumExt_GetFileWriterSize(
                writerPtr
              );

            log(
              `${label}: saved size:`,
              savedSize
            );

            if (!savedSize) {
              throw new Error(
                `${label}: saved PDF has zero bytes.`
              );
            }

            const savedPtr =
              mem.malloc(savedSize);

            if (!savedPtr) {
              throw new Error(
                `${label}: output allocation failed.`
              );
            }

            try {
              const copied =
                pdfium.PDFiumExt_GetFileWriterData(
                  writerPtr,
                  savedPtr,
                  savedSize
                );

              if (!copied) {
                throw new Error(
                  `${label}: GetFileWriterData failed.`
                );
              }

              const headerBytes =
                new Uint8Array(5);

              for (let i = 0; i < 5; i++) {
                headerBytes[i] =
                  pdfium.pdfium.getValue(
                    savedPtr + i,
                    "i8"
                  ) & 255;
              }

              const header =
                String.fromCharCode(
                  headerBytes[0],
                  headerBytes[1],
                  headerBytes[2],
                  headerBytes[3],
                  headerBytes[4]
                );

              log(
                `${label}: header:`,
                header
              );

              if (header !== "%PDF-") {
                throw new Error(
                  `${label}: invalid PDF header ${header}`
                );
              }
            } finally {
              mem.free(savedPtr);
            }

            return savedSize;
          } finally {
            pdfium.PDFiumExt_CloseFileWriter(
              writerPtr
            );
          }
        };

        // --------------------------------------------------
        // Helper: load a FRESH PDFium document
        // --------------------------------------------------

        const loadFreshDocument = () => {
          const mem = pdfium.pdfium.wasmExports;

          const pdfPtr =
            mem.malloc(pdfBytes.length);

          if (!pdfPtr) {
            throw new Error(
              "Unable to allocate PDF input memory."
            );
          }

          for (
            let i = 0;
            i < pdfBytes.length;
            i++
          ) {
            pdfium.pdfium.setValue(
              pdfPtr + i,
              pdfBytes[i],
              "i8"
            );
          }

          const docPtr =
            pdfium.FPDF_LoadMemDocument(
              pdfPtr,
              pdfBytes.length,
              ""
            );

          if (!docPtr) {
            mem.free(pdfPtr);

            throw new Error(
              "FPDF_LoadMemDocument failed."
            );
          }

          return {
            docPtr,
            pdfPtr,
          };
        };

        // --------------------------------------------------
        // Helper: locate first image object
        // --------------------------------------------------

        const findImage = (
          docPtr: number
        ) => {
          const pagePtr =
            pdfium.FPDF_LoadPage(
              docPtr,
              0
            );

          if (!pagePtr) {
            throw new Error(
              "FPDF_LoadPage failed."
            );
          }

          const objectCount =
            pdfium.FPDFPage_CountObjects(
              pagePtr
            );

          log(
            "Fresh page object count:",
            objectCount
          );

          for (
            let i = 0;
            i < objectCount;
            i++
          ) {
            const objectPtr =
              pdfium.FPDFPage_GetObject(
                pagePtr,
                i
              );

            if (!objectPtr) {
              continue;
            }

            const type =
              pdfium.FPDFPageObj_GetType(
                objectPtr
              );

            if (type === 3) {
              return {
                pagePtr,
                imagePtr: objectPtr,
              };
            }
          }

          throw new Error(
            "No image object found."
          );
        };

        // --------------------------------------------------
        // Helper: create the browser JPEG
        // --------------------------------------------------

        const createJpeg = async (
          docPtr: number,
          pagePtr: number,
          imagePtr: number
        ): Promise<Uint8Array> => {
          const mem = pdfium.pdfium.wasmExports;

          const widthPtr = mem.malloc(4);
          const heightPtr = mem.malloc(4);

          if (!widthPtr || !heightPtr) {
            throw new Error(
              "Unable to allocate image dimensions."
            );
          }

          let width = 0;
          let height = 0;

          try {
            const ok =
              pdfium.FPDFImageObj_GetImagePixelSize(
                imagePtr,
                widthPtr,
                heightPtr
              );

            if (!ok) {
              throw new Error(
                "GetImagePixelSize failed."
              );
            }

            width =
              pdfium.pdfium.getValue(
                widthPtr,
                "i32"
              );

            height =
              pdfium.pdfium.getValue(
                heightPtr,
                "i32"
              );
          } finally {
            mem.free(widthPtr);
            mem.free(heightPtr);
          }

          log(
            "Image dimensions:",
            `${width} x ${height}`
          );

          const decodedLength =
            pdfium.FPDFImageObj_GetImageDataDecoded(
              imagePtr,
              0,
              0
            );

          log(
            "Decoded image bytes:",
            decodedLength
          );

          if (
            decodedLength !==
            width * height * 3
          ) {
            throw new Error(
              `Unexpected decoded format: ${decodedLength}; expected ${width * height * 3}.`
            );
          }

          const decodedPtr =
            mem.malloc(decodedLength);

          if (!decodedPtr) {
            throw new Error(
              "Unable to allocate decoded image memory."
            );
          }

          const rgbBytes =
            new Uint8Array(decodedLength);

          try {
            const actual =
              pdfium.FPDFImageObj_GetImageDataDecoded(
                imagePtr,
                decodedPtr,
                decodedLength
              );

            if (actual !== decodedLength) {
              throw new Error(
                `Decoded read returned ${actual}; expected ${decodedLength}.`
              );
            }

            for (
              let i = 0;
              i < decodedLength;
              i++
            ) {
              rgbBytes[i] =
                pdfium.pdfium.getValue(
                  decodedPtr + i,
                  "i8"
                ) & 255;
            }
          } finally {
            mem.free(decodedPtr);
          }

          const canvas =
            document.createElement("canvas");

          canvas.width = width;
          canvas.height = height;

          const ctx =
            canvas.getContext("2d");

          if (!ctx) {
            throw new Error(
              "Canvas 2D unavailable."
            );
          }

          const rgba =
            new Uint8ClampedArray(
              width * height * 4
            );

          for (
            let src = 0, dst = 0;
            src < rgbBytes.length;
            src += 3, dst += 4
          ) {
            rgba[dst] =
              rgbBytes[src];

            rgba[dst + 1] =
              rgbBytes[src + 1];

            rgba[dst + 2] =
              rgbBytes[src + 2];

            rgba[dst + 3] = 255;
          }

          ctx.putImageData(
            new ImageData(
              rgba,
              width,
              height
            ),
            0,
            0
          );

          const jpegBlob =
            await new Promise<Blob>(
              (resolve, reject) => {
                canvas.toBlob(
                  (blob) => {
                    if (blob) {
                      resolve(blob);
                    } else {
                      reject(
                        new Error(
                          "Canvas JPEG encoding failed."
                        )
                      );
                    }
                  },
                  "image/jpeg",
                  0.60
                );
              }
            );

          const jpegBytes =
            new Uint8Array(
              await jpegBlob.arrayBuffer()
            );

          log(
            "Browser JPEG bytes:",
            jpegBytes.length
          );

          return jpegBytes;
        };

        // ==================================================
        // CASE A — ORIGINAL → SAVE
        // ==================================================

        log("");
        log("========== CASE A ==========");
        log("A: Original document → SaveAsCopy");

        {
          const { docPtr, pdfPtr } =
            loadFreshDocument();

          try {
            const size =
              saveDocument(
                docPtr,
                "A"
              );

            const result = {
              name: "A",
              size,
              delta:
                size - pdfBytes.length,
            };

            results.push(result);

            log(
              "A delta:",
              `${result.delta} bytes`,
              `(${((result.delta / pdfBytes.length) * 100).toFixed(2)}%)`
            );
          } finally {
            pdfium.FPDF_CloseDocument(
              docPtr
            );

            pdfium.pdfium.wasmExports.free(
              pdfPtr
            );
          }
        }

        // ==================================================
        // CASE B — SETBITMAP → SAVE
        // ==================================================

        log("");
        log("========== CASE B ==========");
        log("B: SetBitmap → SaveAsCopy");

        {
          const { docPtr, pdfPtr } =
            loadFreshDocument();

          try {
            const {
              pagePtr,
              imagePtr,
            } = findImage(docPtr);

            const originalBitmapPtr =
              pdfium.FPDFImageObj_GetBitmap(
                imagePtr
              );

            if (!originalBitmapPtr) {
              throw new Error(
                "B: GetBitmap failed."
              );
            }

            const bitmapWidth =
              pdfium.FPDFBitmap_GetWidth(
                originalBitmapPtr
              );

            const bitmapHeight =
              pdfium.FPDFBitmap_GetHeight(
                originalBitmapPtr
              );

            const bitmapStride =
              pdfium.FPDFBitmap_GetStride(
                originalBitmapPtr
              );

            const bitmapFormat =
              pdfium.FPDFBitmap_GetFormat(
                originalBitmapPtr
              );

            const bitmapBufferPtr =
              pdfium.FPDFBitmap_GetBuffer(
                originalBitmapPtr
              );

            const bitmapByteLength =
              bitmapStride *
              bitmapHeight;

            const currentHeap =
              (
                pdfium.pdfium as unknown as {
                  HEAPU8: Uint8Array;
                }
              ).HEAPU8;

            if (
              bitmapBufferPtr < 0 ||
              bitmapBufferPtr +
                bitmapByteLength >
                currentHeap.byteLength
            ) {
              throw new Error(
                "B: bitmap buffer outside WASM memory."
              );
            }

            const bitmapPixels =
              new Uint8Array(
                bitmapByteLength
              );

            bitmapPixels.set(
              currentHeap.subarray(
                bitmapBufferPtr,
                bitmapBufferPtr +
                  bitmapByteLength
              )
            );

            const bitmapDataPtr =
              pdfium.pdfium.wasmExports.malloc(
                bitmapByteLength
              );

            if (!bitmapDataPtr) {
              throw new Error(
                "B: bitmap allocation failed."
              );
            }

            try {
              for (
                let i = 0;
                i < bitmapPixels.length;
                i++
              ) {
                pdfium.pdfium.setValue(
                  bitmapDataPtr + i,
                  bitmapPixels[i],
                  "i8"
                );
              }

              const newBitmapPtr =
                pdfium.FPDFBitmap_CreateEx(
                  bitmapWidth,
                  bitmapHeight,
                  bitmapFormat,
                  bitmapDataPtr,
                  bitmapStride
                );

              if (!newBitmapPtr) {
                throw new Error(
                  "B: CreateEx failed."
                );
              }

              try {
                const replaced =
                  pdfium.FPDFImageObj_SetBitmap(
                    pagePtr,
                    0,
                    imagePtr,
                    newBitmapPtr
                  );

                log(
                  "B SetBitmap:",
                  replaced
                );

                if (!replaced) {
                  throw new Error(
                    "B: SetBitmap failed."
                  );
                }

                const generated =
                  pdfium.FPDFPage_GenerateContent(
                    pagePtr
                  );

                log(
                  "B GenerateContent:",
                  generated
                );

                if (!generated) {
                  throw new Error(
                    "B: GenerateContent failed."
                  );
                }
              } finally {
                pdfium.FPDFBitmap_Destroy(
                  newBitmapPtr
                );
              }
            } finally {
              pdfium.pdfium.wasmExports.free(
                bitmapDataPtr
              );
            }

            const size =
              saveDocument(
                docPtr,
                "B"
              );

            const result = {
              name: "B",
              size,
              delta:
                size - pdfBytes.length,
            };

            results.push(result);

            log(
              "B delta:",
              `${result.delta} bytes`,
              `(${((result.delta / pdfBytes.length) * 100).toFixed(2)}%)`
            );
          } finally {
            pdfium.FPDF_CloseDocument(
              docPtr
            );

            pdfium.pdfium.wasmExports.free(
              pdfPtr
            );
          }
        }

        // ==================================================
        // CASE C — SETJPEG → SAVE
        // ==================================================

        log("");
        log("========== CASE C ==========");
        log("C: SetJpeg → SaveAsCopy");

        {
          const { docPtr, pdfPtr } =
            loadFreshDocument();

          try {
            const {
              pagePtr,
              imagePtr,
            } = findImage(docPtr);

            const jpegBytes =
              await createJpeg(
                docPtr,
                pagePtr,
                imagePtr
              );

            const jpegPtr =
              pdfium.pdfium.wasmExports.malloc(
                jpegBytes.length
              );

            if (!jpegPtr) {
              throw new Error(
                "C: JPEG allocation failed."
              );
            }

            try {
              for (
                let i = 0;
                i < jpegBytes.length;
                i++
              ) {
                pdfium.pdfium.setValue(
                  jpegPtr + i,
                  jpegBytes[i],
                  "i8"
                );
              }

              const replaced =
                pdfium.EPDFImageObj_SetJpeg(
                  pagePtr,
                  0,
                  imagePtr,
                  jpegPtr,
                  jpegBytes.length
                );

              log(
                "C SetJpeg:",
                replaced
              );

              if (!replaced) {
                throw new Error(
                  "C: SetJpeg failed."
                );
              }

              const generated =
                pdfium.FPDFPage_GenerateContent(
                  pagePtr
                );

              log(
                "C GenerateContent:",
                generated
              );

              if (!generated) {
                throw new Error(
                  "C: GenerateContent failed."
                );
              }
            } finally {
              pdfium.pdfium.wasmExports.free(
                jpegPtr
              );
            }

            const size =
              saveDocument(
                docPtr,
                "C"
              );

            const result = {
              name: "C",
              size,
              delta:
                size - pdfBytes.length,
            };

            results.push(result);

            log(
              "C delta:",
              `${result.delta} bytes`,
              `(${((result.delta / pdfBytes.length) * 100).toFixed(2)}%)`
            );
          } finally {
            pdfium.FPDF_CloseDocument(
              docPtr
            );

            pdfium.pdfium.wasmExports.free(
              pdfPtr
            );
          }
        }

        // ==================================================
        // CASE D — SETBITMAP + SETJPEG → SAVE
        // ==================================================

        log("");
        log("========== CASE D ==========");
        log(
          "D: SetBitmap + SetJpeg → SaveAsCopy"
        );

        {
          const { docPtr, pdfPtr } =
            loadFreshDocument();

          try {
            const {
              pagePtr,
              imagePtr,
            } = findImage(docPtr);

            // ------------------------------
            // D1: SetBitmap
            // ------------------------------

            const originalBitmapPtr =
              pdfium.FPDFImageObj_GetBitmap(
                imagePtr
              );

            if (!originalBitmapPtr) {
              throw new Error(
                "D: GetBitmap failed."
              );
            }

            const bitmapWidth =
              pdfium.FPDFBitmap_GetWidth(
                originalBitmapPtr
              );

            const bitmapHeight =
              pdfium.FPDFBitmap_GetHeight(
                originalBitmapPtr
              );

            const bitmapStride =
              pdfium.FPDFBitmap_GetStride(
                originalBitmapPtr
              );

            const bitmapFormat =
              pdfium.FPDFBitmap_GetFormat(
                originalBitmapPtr
              );

            const bitmapBufferPtr =
              pdfium.FPDFBitmap_GetBuffer(
                originalBitmapPtr
              );

            const bitmapByteLength =
              bitmapStride *
              bitmapHeight;

            const currentHeap =
              (
                pdfium.pdfium as unknown as {
                  HEAPU8: Uint8Array;
                }
              ).HEAPU8;

            if (
              bitmapBufferPtr < 0 ||
              bitmapBufferPtr +
                bitmapByteLength >
                currentHeap.byteLength
            ) {
              throw new Error(
                "D: bitmap buffer outside WASM memory."
              );
            }

            const bitmapPixels =
              new Uint8Array(
                bitmapByteLength
              );

            bitmapPixels.set(
              currentHeap.subarray(
                bitmapBufferPtr,
                bitmapBufferPtr +
                  bitmapByteLength
              )
            );

            const bitmapDataPtr =
              pdfium.pdfium.wasmExports.malloc(
                bitmapByteLength
              );

            if (!bitmapDataPtr) {
              throw new Error(
                "D: bitmap allocation failed."
              );
            }

            try {
              for (
                let i = 0;
                i < bitmapPixels.length;
                i++
              ) {
                pdfium.pdfium.setValue(
                  bitmapDataPtr + i,
                  bitmapPixels[i],
                  "i8"
                );
              }

              const newBitmapPtr =
                pdfium.FPDFBitmap_CreateEx(
                  bitmapWidth,
                  bitmapHeight,
                  bitmapFormat,
                  bitmapDataPtr,
                  bitmapStride
                );

              if (!newBitmapPtr) {
                throw new Error(
                  "D: CreateEx failed."
                );
              }

              try {
                const replaced =
                  pdfium.FPDFImageObj_SetBitmap(
                    pagePtr,
                    0,
                    imagePtr,
                    newBitmapPtr
                  );

                log(
                  "D SetBitmap:",
                  replaced
                );

                if (!replaced) {
                  throw new Error(
                    "D: SetBitmap failed."
                  );

                }

                const generated =
                  pdfium.FPDFPage_GenerateContent(
                    pagePtr
                  );

                log(
                  "D GenerateContent after SetBitmap:",
                  generated
                );

                if (!generated) {
                  throw new Error(
                    "D: GenerateContent after SetBitmap failed."
                  );
                }
              } finally {
                pdfium.FPDFBitmap_Destroy(
                  newBitmapPtr
                );
              }
            } finally {
              pdfium.pdfium.wasmExports.free(
                bitmapDataPtr
              );
            }

            // ------------------------------
            // D2: SetJpeg
            // ------------------------------

            const jpegBytes =
              await createJpeg(
                docPtr,
                pagePtr,
                imagePtr
              );

            const jpegPtr =
              pdfium.pdfium.wasmExports.malloc(
                jpegBytes.length
              );

            if (!jpegPtr) {
              throw new Error(
                "D: JPEG allocation failed."
              );
            }

            try {
              for (
                let i = 0;
                i < jpegBytes.length;
                i++
              ) {
                pdfium.pdfium.setValue(
                  jpegPtr + i,
                  jpegBytes[i],
                  "i8"
                );
              }

              const replaced =
                pdfium.EPDFImageObj_SetJpeg(
                  pagePtr,
                  0,
                  imagePtr,
                  jpegPtr,
                  jpegBytes.length
                );

              log(
                "D SetJpeg:",
                replaced
              );

              if (!replaced) {
                throw new Error(
                  "D: SetJpeg failed."
                );
              }

              const generated =
                pdfium.FPDFPage_GenerateContent(
                  pagePtr
                );

              log(
                "D GenerateContent after SetJpeg:",
                generated
              );

              if (!generated) {
                throw new Error(
                  "D: GenerateContent after SetJpeg failed."
                );
              }
            } finally {
              pdfium.pdfium.wasmExports.free(
                jpegPtr
              );
            }

            const size =
              saveDocument(
                docPtr,
                "D"
              );

            const result = {
              name: "D",
              size,
              delta:
                size - pdfBytes.length,
            };

            results.push(result);

            log(
              "D delta:",
              `${result.delta} bytes`,
              `(${((result.delta / pdfBytes.length) * 100).toFixed(2)}%)`
            );
          } finally {
            pdfium.FPDF_CloseDocument(
              docPtr
            );

            pdfium.pdfium.wasmExports.free(
              pdfPtr
            );
          }
        }

        // ==================================================
        // FINAL ATTRIBUTION
        // ==================================================

        const a =
          results.find(
            (r) => r.name === "A"
          );

        const b =
          results.find(
            (r) => r.name === "B"
          );

        const c =
          results.find(
            (r) => r.name === "C"
          );

        const d =
          results.find(
            (r) => r.name === "D"
          );

        if (!a || !b || !c || !d) {
          throw new Error(
            "BC-06: missing case result."
          );
        }

        log("");
        log(
          "========================================"
        );
        log(
          "=== BC-06 ATTRIBUTION RESULT ==="
        );
        log(
          "========================================"
        );

        log(
          "Input:",
          pdfBytes.length
        );

        log(
          "A Original Save:",
          a.size,
          "delta:",
          a.delta
        );

        log(
          "B SetBitmap Save:",
          b.size,
          "delta:",
          b.delta
        );

        log(
          "C SetJpeg Save:",
          c.size,
          "delta:",
          c.delta
        );

        log(
          "D SetBitmap + SetJpeg Save:",
          d.size,
          "delta:",
          d.delta
        );

        log("");
        log(
          "B - A:",
          `${b.size - a.size} bytes`
        );

        log(
          "C - A:",
          `${c.size - a.size} bytes`
        );

        log(
          "D - A:",
          `${d.size - a.size} bytes`
        );

        log("");
        log(
          "=== BC-06 COMPLETE ==="
        );
      } catch (error) {
        console.error(error);

        log(
          "BC-06 FAILED:",
          error instanceof Error
            ? error.stack ||
              error.message
            : String(error)
        );
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        padding: "24px",
        fontFamily:
          "monospace",
        whiteSpace:
          "pre-wrap",
      }}
    >
      <h1>
        BC-06 PDFium Size Attribution
      </h1>

      <pre>
        {output}
      </pre>
    </main>
  );
}
