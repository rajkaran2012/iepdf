"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PDFIUM_WASM_URL,
  init,
} from "@embedpdf/pdfium";

type RenderResult = {
  page: number;
  original: string;
  compressed: string;
  originalSize: string;
  compressedSize: string;
  differentPixels: number;
  comparedPixels: number;
  differencePercent: number;
};

export default function PdfiumBC08Page() {
  const [logs, setLogs] = useState<string[]>([
    "Starting BC-08...",
  ]);

  useEffect(() => {
    let cancelled = false;

    const log = (message: string) => {
      console.log(message);

      if (!cancelled) {
        setLogs((previous) => [
          ...previous,
          message,
        ]);
      }
    };

    const run = async () => {
      try {
        log("=== BC-08 PDFium Visual Verification ===");

        const pdfium = await init({
          locateFile: (filename: string) =>
            filename === "pdfium.wasm"
              ? DEFAULT_PDFIUM_WASM_URL
              : filename,
        });

        log("PDFium wrapper initialized.");

        pdfium.PDFiumExt_Init();

        log("PDFiumExt_Init completed.");

        const mem =
          pdfium.pdfium.wasmExports;

        const loadPdf = async (
          url: string
        ) => {
          const response =
            await fetch(url);

          if (!response.ok) {
            throw new Error(
              `Fetch failed: ${response.status} ${response.statusText}`
            );
          }

          const bytes = new Uint8Array(
            await response.arrayBuffer()
          );

          const pdfPtr =
            mem.malloc(bytes.length);

          if (!pdfPtr) {
            throw new Error(
              "PDF input allocation failed."
            );
          }

          try {
            for (
              let i = 0;
              i < bytes.length;
              i++
            ) {
              pdfium.pdfium.setValue(
                pdfPtr + i,
                bytes[i],
                "i8"
              );
            }

            const docPtr =
              pdfium.FPDF_LoadMemDocument(
                pdfPtr,
                bytes.length,
                ""
              );

            if (!docPtr) {
              throw new Error(
                "FPDF_LoadMemDocument failed."
              );
            }

            return {
              docPtr,
              pdfPtr,
              bytes,
            };
          } catch (error) {
            mem.free(pdfPtr);
            throw error;
          }
        };

        const renderPage = (
          docPtr: number,
          pageIndex: number,
          label: string
        ) => {
          const pagePtr =
            pdfium.FPDF_LoadPage(
              docPtr,
              pageIndex
            );

          if (!pagePtr) {
            throw new Error(
              `${label}: FPDF_LoadPage failed.`
            );
          }

          try {
            const pageWidth =
              pdfium.FPDF_GetPageWidth(
                pagePtr
              );

            const pageHeight =
              pdfium.FPDF_GetPageHeight(
                pagePtr
              );

            if (
              !Number.isFinite(pageWidth) ||
              !Number.isFinite(pageHeight) ||
              pageWidth <= 0 ||
              pageHeight <= 0
            ) {
              throw new Error(
                `${label}: invalid page dimensions.`
              );
            }

            const dpi = 150;
            const scale = dpi / 72;

            const width = Math.max(
              1,
              Math.ceil(
                pageWidth * scale
              )
            );

            const height = Math.max(
              1,
              Math.ceil(
                pageHeight * scale
              )
            );

            const bitmapPtr =
              pdfium.FPDFBitmap_Create(
                width,
                height,
                1
              );

            if (!bitmapPtr) {
              throw new Error(
                `${label}: bitmap creation failed.`
              );
            }

            try {
              pdfium.FPDF_RenderPageBitmap(
                bitmapPtr,
                pagePtr,
                0,
                0,
                width,
                height,
                0,
                0
              );

              const bufferPtr =
                pdfium.FPDFBitmap_GetBuffer(
                  bitmapPtr
                );

              const stride =
                pdfium.FPDFBitmap_GetStride(
                  bitmapPtr
                );

              const bitmapWidth =
                pdfium.FPDFBitmap_GetWidth(
                  bitmapPtr
                );

              const bitmapHeight =
                pdfium.FPDFBitmap_GetHeight(
                  bitmapPtr
                );

              if (
                !bufferPtr ||
                stride <= 0 ||
                bitmapWidth <= 0 ||
                bitmapHeight <= 0
              ) {
                throw new Error(
                  `${label}: invalid rendered bitmap.`
                );
              }

              const byteLength =
                stride * bitmapHeight;

              const heap =
                (
                  pdfium.pdfium as unknown as {
                    HEAPU8: Uint8Array;
                  }
                ).HEAPU8;

              if (
                bufferPtr + byteLength >
                heap.byteLength
              ) {
                throw new Error(
                  `${label}: bitmap outside WASM memory.`
                );
              }

              const pixels =
                new Uint8Array(
                  byteLength
                );

              pixels.set(
                heap.subarray(
                  bufferPtr,
                  bufferPtr +
                    byteLength
                )
              );

              return {
                width: bitmapWidth,
                height: bitmapHeight,
                stride,
                pixels,
              };
            } finally {
              pdfium.FPDFBitmap_Destroy(
                bitmapPtr
              );
            }
          } finally {
            pdfium.FPDF_ClosePage(
              pagePtr
            );
          }
        };

        const saveDocument = (
          docPtr: number
        ) => {
          const writerPtr =
            pdfium.PDFiumExt_OpenFileWriter();

          if (!writerPtr) {
            throw new Error(
              "OpenFileWriter failed."
            );
          }

          try {
            const saved =
              pdfium.PDFiumExt_SaveAsCopy(
                docPtr,
                writerPtr
              );

            if (!saved) {
              throw new Error(
                "SaveAsCopy failed."
              );
            }

            const savedSize =
              pdfium.PDFiumExt_GetFileWriterSize(
                writerPtr
              );

            if (!savedSize) {
              throw new Error(
                "Saved PDF has zero bytes."
              );
            }

            const savedPtr =
              mem.malloc(savedSize);

            if (!savedPtr) {
              throw new Error(
                "Saved PDF allocation failed."
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
                  "GetFileWriterData failed."
                );
              }

              const bytes =
                new Uint8Array(
                  savedSize
                );

              for (
                let i = 0;
                i < savedSize;
                i++
              ) {
                bytes[i] =
                  pdfium.pdfium.getValue(
                    savedPtr + i,
                    "i8"
                  ) & 255;
              }

              return bytes;
            } finally {
              mem.free(savedPtr);
            }
          } finally {
            pdfium.PDFiumExt_CloseFileWriter(
              writerPtr
            );
          }
        };

        const compressWithSetBitmap = (
          inputBytes: Uint8Array
        ) => {
          const pdfPtr =
            mem.malloc(
              inputBytes.length
            );

          if (!pdfPtr) {
            throw new Error(
              "Compression input allocation failed."
            );
          }

          try {
            for (
              let i = 0;
              i < inputBytes.length;
              i++
            ) {
              pdfium.pdfium.setValue(
                pdfPtr + i,
                inputBytes[i],
                "i8"
              );
            }

            const docPtr =
              pdfium.FPDF_LoadMemDocument(
                pdfPtr,
                inputBytes.length,
                ""
              );

            if (!docPtr) {
              throw new Error(
                "Compression document load failed."
              );
            }

            try {
              const pageCount =
                pdfium.FPDF_GetPageCount(
                  docPtr
                );

              for (
                let pageIndex = 0;
                pageIndex < pageCount;
                pageIndex++
              ) {
                const pagePtr =
                  pdfium.FPDF_LoadPage(
                    docPtr,
                    pageIndex
                  );

                if (!pagePtr) {
                  throw new Error(
                    `Compression page ${pageIndex + 1} load failed.`
                  );
                }

                try {
                  const objectCount =
                    pdfium.FPDFPage_CountObjects(
                      pagePtr
                    );

                  for (
                    let objectIndex = 0;
                    objectIndex <
                    objectCount;
                    objectIndex++
                  ) {
                    const objectPtr =
                      pdfium.FPDFPage_GetObject(
                        pagePtr,
                        objectIndex
                      );

                    if (!objectPtr) {
                      continue;
                    }

                    const type =
                      pdfium.FPDFPageObj_GetType(
                        objectPtr
                      );

                    if (type !== 3) {
                      continue;
                    }

                    const bitmapPtr =
                      pdfium.FPDFImageObj_GetBitmap(
                        objectPtr
                      );

                    if (!bitmapPtr) {
                      continue;
                    }

                    const width =
                      pdfium.FPDFBitmap_GetWidth(
                        bitmapPtr
                      );

                    const height =
                      pdfium.FPDFBitmap_GetHeight(
                        bitmapPtr
                      );

                    const stride =
                      pdfium.FPDFBitmap_GetStride(
                        bitmapPtr
                      );

                    const sourceBuffer =
                      pdfium.FPDFBitmap_GetBuffer(
                        bitmapPtr
                      );

                    if (
                      !sourceBuffer ||
                      stride <= 0 ||
                      width <= 0 ||
                      height <= 0
                    ) {
                      throw new Error(
                        `Invalid image bitmap on page ${pageIndex + 1}.`
                      );
                    }

                    const byteLength =
                      stride * height;

                    const sourceHeap =
                      (
                        pdfium.pdfium as unknown as {
                          HEAPU8: Uint8Array;
                        }
                      ).HEAPU8;

                    if (
                      sourceBuffer +
                        byteLength >
                      sourceHeap.byteLength
                    ) {
                      throw new Error(
                        `Image bitmap outside WASM memory on page ${pageIndex + 1}.`
                      );
                    }

                    const pixels =
                      new Uint8Array(
                        byteLength
                      );

                    pixels.set(
                      sourceHeap.subarray(
                        sourceBuffer,
                        sourceBuffer +
                          byteLength
                      )
                    );

                    const newBitmap =
                      pdfium.FPDFBitmap_CreateEx(
                        width,
                        height,
                        2,
                        0,
                        stride
                      );

                    if (!newBitmap) {
                      throw new Error(
                        `Replacement bitmap creation failed on page ${pageIndex + 1}.`
                      );
                    }

                    try {
                      const destination =
                        pdfium.FPDFBitmap_GetBuffer(
                          newBitmap
                        );

                      if (!destination) {
                        throw new Error(
                          `Replacement bitmap buffer failed on page ${pageIndex + 1}.`
                        );
                      }

                      for (
                        let i = 0;
                        i < pixels.length;
                        i++
                      ) {
                        pdfium.pdfium.setValue(
                          destination + i,
                          pixels[i],
                          "i8"
                        );
                      }

                      const setResult =
                        pdfium.FPDFImageObj_SetBitmap(
                          pagePtr,
                          objectIndex,
                          objectPtr,
                          newBitmap
                        );

                      if (!setResult) {
                        throw new Error(
                          `SetBitmap failed on page ${pageIndex + 1}.`
                        );
                      }

                      const generated =
                        pdfium.FPDFPage_GenerateContent(
                          pagePtr
                        );

                      if (!generated) {
                        throw new Error(
                          `GenerateContent failed on page ${pageIndex + 1}.`
                        );
                      }
                    } finally {
                      pdfium.FPDFBitmap_Destroy(
                        newBitmap
                      );
                    }
                  }
                } finally {
                  pdfium.FPDF_ClosePage(
                    pagePtr
                  );
                }
              }

              return saveDocument(
                docPtr
              );
            } finally {
              pdfium.FPDF_CloseDocument(
                docPtr
              );
            }
          } finally {
            mem.free(pdfPtr);
          }
        };

        log("");
        log("========== ORIGINAL ==========");

        const original =
          await loadPdf(
            "/_pdfium-bc07/C-04-image-heavy.pdf"
          );

        const originalPages =
          pdfium.FPDF_GetPageCount(
            original.docPtr
          );

        log(
          `Original bytes: ${original.bytes.length}`
        );

        log(
          `Original pages: ${originalPages}`
        );

        const originalRenders = [];

        for (
          let page = 0;
          page < originalPages;
          page++
        ) {
          const rendered =
            renderPage(
              original.docPtr,
              page,
              `Original page ${page + 1}`
            );

          originalRenders.push(
            rendered
          );

          log(
            `Original page ${page + 1}: render PASS ${rendered.width}x${rendered.height}`
          );
        }

        pdfium.FPDF_CloseDocument(
          original.docPtr
        );

        mem.free(
          original.pdfPtr
        );

        log("");
        log(
          "========== COMPRESS =========="
        );

        const compressedBytes =
          compressWithSetBitmap(
            original.bytes
          );

        log(
          `Compressed bytes: ${compressedBytes.length}`
        );

        const reduction =
          (
            (
              original.bytes.length -
              compressedBytes.length
            ) /
            original.bytes.length
          ) *
          100;

        log(
          `Reduction: ${reduction.toFixed(2)}%`
        );

        log("");
        log(
          "========== REOPEN =========="
        );

        const compressedPtr =
          mem.malloc(
            compressedBytes.length
          );

        if (!compressedPtr) {
          throw new Error(
            "Compressed PDF allocation failed."
          );
        }

        for (
          let i = 0;
          i < compressedBytes.length;
          i++
        ) {
          pdfium.pdfium.setValue(
            compressedPtr + i,
            compressedBytes[i],
            "i8"
          );
        }

        const compressedDoc =
          pdfium.FPDF_LoadMemDocument(
            compressedPtr,
            compressedBytes.length,
            ""
          );

        if (!compressedDoc) {
          throw new Error(
            "Compressed PDF failed to reopen."
          );
        }

        const compressedPages =
          pdfium.FPDF_GetPageCount(
            compressedDoc
          );

        log(
          `Compressed pages: ${compressedPages}`
        );

        if (
          compressedPages !==
          originalPages
        ) {
          throw new Error(
            `Page count mismatch: ${originalPages} -> ${compressedPages}`
          );
        }

        const compressedRenders = [];

        for (
          let page = 0;
          page < compressedPages;
          page++
        ) {
          const rendered =
            renderPage(
              compressedDoc,
              page,
              `Compressed page ${page + 1}`
            );

          compressedRenders.push(
            rendered
          );

          log(
            `Compressed page ${page + 1}: render PASS ${rendered.width}x${rendered.height}`
          );
        }

        log("");
        log(
          "========== PIXEL COMPARISON =========="
        );

        const results: RenderResult[] =
          [];

        for (
          let i = 0;
          i < originalRenders.length;
          i++
        ) {
          const originalPage =
            originalRenders[i];

          const compressedPage =
            compressedRenders[i];

          if (
            originalPage.width !==
              compressedPage.width ||
            originalPage.height !==
              compressedPage.height
          ) {
            results.push({
              page: i + 1,
              original: "PASS",
              compressed: "PASS",
              originalSize:
                `${originalPage.width}x${originalPage.height}`,
              compressedSize:
                `${compressedPage.width}x${compressedPage.height}`,
              differentPixels: -1,
              comparedPixels: 0,
              differencePercent: 100,
            });

            log(
              `Page ${i + 1}: DIMENSION MISMATCH`
            );

            continue;
          }

          /*
           * PDFium format 1 is BGRA.
           * Compare pixels while ignoring the alpha byte.
           */
          const pixelCount =
            originalPage.width *
            originalPage.height;

          const originalStride =
            originalPage.stride;

          const compressedStride =
            compressedPage.stride;

          let differentPixels = 0;

          for (
            let y = 0;
            y < originalPage.height;
            y++
          ) {
            const originalRow =
              y * originalStride;

            const compressedRow =
              y * compressedStride;

            for (
              let x = 0;
              x < originalPage.width;
              x++
            ) {
              const originalOffset =
                originalRow + x * 4;

              const compressedOffset =
                compressedRow + x * 4;

              const b0 =
                originalPage.pixels[
                  originalOffset
                ];

              const g0 =
                originalPage.pixels[
                  originalOffset + 1
                ];

              const r0 =
                originalPage.pixels[
                  originalOffset + 2
                ];

              const b1 =
                compressedPage.pixels[
                  compressedOffset
                ];

              const g1 =
                compressedPage.pixels[
                  compressedOffset + 1
                ];

              const r1 =
                compressedPage.pixels[
                  compressedOffset + 2
                ];

              if (
                b0 !== b1 ||
                g0 !== g1 ||
                r0 !== r1
              ) {
                differentPixels++;
              }
            }
          }

          const differencePercent =
            (
              differentPixels /
              pixelCount
            ) *
            100;

          results.push({
            page: i + 1,
            original: "PASS",
            compressed: "PASS",
            originalSize:
              `${originalPage.width}x${originalPage.height}`,
            compressedSize:
              `${compressedPage.width}x${compressedPage.height}`,
            differentPixels,
            comparedPixels:
              pixelCount,
            differencePercent,
          });

          log(
            `Page ${i + 1}: ` +
              `${originalPage.width}x${originalPage.height} → ` +
              `${compressedPage.width}x${compressedPage.height} | ` +
              `Different pixels: ${differentPixels}/${pixelCount} ` +
              `(${differencePercent.toFixed(4)}%)`
          );
        }

        log("");
        log(
          "========================================"
        );
        log(
          "=== BC-08 RESULT ==="
        );
        log(
          "========================================"
        );

        const renderPass =
          results.length ===
            originalPages &&
          results.every(
            (result) =>
              result.original === "PASS" &&
              result.compressed === "PASS" &&
              result.differencePercent <
                5
          );

        log(
          `Original bytes: ${original.bytes.length}`
        );

        log(
          `Compressed bytes: ${compressedBytes.length}`
        );

        log(
          `Reduction: ${reduction.toFixed(2)}%`
        );

        log(
          `Pages: ${originalPages} -> ${compressedPages}`
        );

        log(
          `Render verification: ${
            renderPass ? "PASS" : "REVIEW"
          }`
        );

        log(
          "=== BC-08 COMPLETE ==="
        );

        pdfium.FPDF_CloseDocument(
          compressedDoc
        );

        mem.free(
          compressedPtr
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        log(
          `POC FAILED: ${message}`
        );
      }
    };

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
      {logs.join("\n")}
    </main>
  );
}
