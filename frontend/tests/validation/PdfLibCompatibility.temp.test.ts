import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

describe("PDF-lib compatibility diagnostic", () => {

    it("tests both Merge PDF input files", async () => {

        const files = [
            "C:\\Users\\WELCOME\\Documents\\merged (19).pdf",
            "C:\\Users\\WELCOME\\Documents\\WorkDurationReportFourPunch anjali.pdf"
        ];

        for (const filePath of files) {

            const bytes =
                await import("node:fs/promises")
                    .then(fs => fs.readFile(filePath));

            console.log("\n========================================");
            console.log("FILE:", filePath);
            console.log("BYTES:", bytes.length);

            try {

                const pdf =
                    await PDFDocument.load(bytes);

                console.log("DEFAULT LOAD: PASS");
                console.log("PAGES:", pdf.getPageCount());

            } catch (error) {

                console.log("DEFAULT LOAD: FAIL");
                console.log(
                    "ERROR:",
                    error instanceof Error
                        ? error.message
                        : String(error)
                );

            }
        }

        expect(true).toBe(true);
    });

});
