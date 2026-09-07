import { describe, it, expect } from "vitest";

describe(
    "PDFium import diagnostic",
    () => {

        it(
            "loads PDFium package without adapter",
            async () => {

                console.log("STEP 1: before import");

                const pdfium =
                    await import("@embedpdf/pdfium");

                console.log(
                    "STEP 2: package imported"
                );

                console.log(
                    "STEP 3: exports:",
                    Object.keys(pdfium)
                );

                expect(
                    Object.keys(pdfium).length
                ).toBeGreaterThan(0);

            }
        );

    }
);
