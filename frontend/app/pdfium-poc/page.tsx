"use client";

import { useEffect, useState } from "react";
import { init } from "@embedpdf/pdfium";

export default function PdfiumPocPage() {
  const [output, setOutput] = useState("Starting...\n");

  useEffect(() => {
    let cancelled = false;

    const log = (...args: unknown[]) => {
      console.log(...args);

      if (!cancelled) {
        setOutput(prev => prev + args.join(" ") + "\n");
      }
    };

    async function run() {
      try {
        log("=== PDFium Browser Image Replacement POC ===");

        const response = await fetch(
          "/_pdfium-poc/C-04-image-heavy.pdf"
        );

        if (!response.ok) {
          throw new Error(
            `PDF HTTP ${response.status}`
          );
        }

        const pdfBytes =
          new Uint8Array(
            await response.arrayBuffer()
          );

        log(
          "Input PDF bytes:",
          pdfBytes.length
        );

        const pdfium = await init({});

        log(
          "PDFium wrapper initialized."
        );

        pdfium.PDFiumExt_Init();

        log(
          "PDFiumExt_Init completed."
        );

        const mem =
          pdfium.pdfium.wasmExports;

        const pdfPtr =
          mem.malloc(pdfBytes.length);

        try {
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

          log(
            "PDF copied into WASM memory."
          );

          const docPtr =
            pdfium.FPDF_LoadMemDocument(
              pdfPtr,
              pdfBytes.length,
              ""
            );

          if (!docPtr) {
            throw new Error(
              "FPDF_LoadMemDocument failed."
            );
          }

          log(
            "Document loaded:",
            docPtr
          );

          try {
            const pageCount =
              pdfium.FPDF_GetPageCount(
                docPtr
              );

            log(
              "Page count:",
              pageCount
            );

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

            log(
              "Page loaded:",
              pagePtr
            );

            try {
              const objectCount =
                pdfium.FPDFPage_CountObjects(
                  pagePtr
                );

              log(
                "Page 0 object count:",
                objectCount
              );

              let imagePtr = 0;

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

                if (!objectPtr) continue;

                const type =
                  pdfium.FPDFPageObj_GetType(
                    objectPtr
                  );

                log(
                  `Object ${i}: type=${type}, ptr=${objectPtr}`
                );

                if (type === 3) {
                  imagePtr = objectPtr;
                  break;
                }
              }

              if (!imagePtr) {
                throw new Error(
                  "No image object found."
                );
              }

              log(
                "Existing image object:",
                imagePtr
              );

              // -----------------------------
              // Image dimensions
              // -----------------------------

              const widthPtr =
                mem.malloc(4);

              const heightPtr =
                mem.malloc(4);

              let width = 0;
              let height = 0;

              try {
                const ok =
                  pdfium.FPDFImageObj_GetImagePixelSize(
                    imagePtr,
                    widthPtr,
                    heightPtr
                  );

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

                if (!ok) {
                  throw new Error(
                    "GetImagePixelSize failed."
                  );
                }
              } finally {
                mem.free(widthPtr);
                mem.free(heightPtr);
              }

              log(
                "Existing image:",
                `${width} x ${height}`
              );

              // -----------------------------
              // Decode image
              // -----------------------------

              const decodedLength =
                pdfium.FPDFImageObj_GetImageDataDecoded(
                  imagePtr,
                  0,
                  0
                );

              log(
                "Decoded bytes:",
                decodedLength
              );

              if (
                decodedLength !==
                width * height * 3
              ) {
                throw new Error(
                  `Unexpected decoded format: ${decodedLength} bytes; expected RGB24 ${width * height * 3}.`
                );
              }

              const decodedPtr =
                mem.malloc(
                  decodedLength
                );

              let rgbBytes;

              try {
                const actual =
                  pdfium.FPDFImageObj_GetImageDataDecoded(
                    imagePtr,
                    decodedPtr,
                    decodedLength
                  );

                if (actual !== decodedLength) {
                  log(
                    "WARNING decoded length:",
                    actual
                  );
                }

                rgbBytes =
                  new Uint8Array(
                    decodedLength
                  );

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

              // -----------------------------
              // RGB -> Canvas
              // -----------------------------

              const canvas =
                document.createElement(
                  "canvas"
                );

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
                  width *
                    height *
                    4
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

              // -----------------------------
              // Browser JPEG encoding
              // -----------------------------

              const jpegBlob =
                await new Promise<Blob>(
                  (resolve, reject) => {
                    canvas.toBlob(
                      blob => {
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
                "JPEG bytes:",
                jpegBytes.length
              );

              log(
                "JPEG size reduction:",
                `${((1 - jpegBytes.length / decodedLength) * 100).toFixed(2)}%`
              );

              // -----------------------------
              // Copy JPEG into PDFium
              // -----------------------------

              const jpegPtr =
                mem.malloc(
                  jpegBytes.length
                );

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

                log(
                  "JPEG copied into PDFium memory."
                );

                // -----------------------------
                // REPLACE EXISTING IMAGE
                // -----------------------------

                const replaced =
                  pdfium.EPDFImageObj_SetJpeg(
                    pagePtr,
                    0,
                    imagePtr,
                    jpegPtr,
                    jpegBytes.length
                  );

                log(
                  "EPDFImageObj_SetJpeg:",
                  replaced
                );

                if (!replaced) {
                  throw new Error(
                    "EPDFImageObj_SetJpeg returned false."
                  );
                }

                // -----------------------------
                // Generate content
                // -----------------------------

                const generated =
                  pdfium.FPDFPage_GenerateContent(
                    pagePtr
                  );

                log(
                  "FPDFPage_GenerateContent:",
                  generated
                );

                if (!generated) {
                  throw new Error(
                    "FPDFPage_GenerateContent failed."
                  );
                }

                log(
                  "=== IMAGE REPLACEMENT SUCCEEDED ==="
                );

              } finally {
                mem.free(jpegPtr);
              }

            } finally {
              pdfium.FPDF_ClosePage(
                pagePtr
              );
            }

          } finally {
            pdfium.FPDF_CloseDocument(
              docPtr
            );
          }

        } finally {
          mem.free(pdfPtr);
        }

      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setOutput(
            prev =>
              prev +
              "\nPOC FAILED:\n" +
              (error instanceof Error
                ? error.stack || error.message
                : String(error))
          );
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
      }}
    >
      <h1>PDFium Image Replacement POC</h1>
      <pre>{output}</pre>
    </main>
  );
}


