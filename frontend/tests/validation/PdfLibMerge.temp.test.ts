import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

describe("PDF-lib merge diagnostic", () => {

    it("merges the two real iePDF test PDFs", async () => {

        const filePaths = [
            "C:\\Users\\WELCOME\\Documents\\merged (19).pdf",
            "C:\\Users\\WELCOME\\Documents\\WorkDurationReportFourPunch anjali.pdf"
        ];

        const destination =
            await PDFDocument.create();

        for (const filePath of filePaths) {

            const bytes =
                await import("node:fs/promises")
                    .then(fs => fs.readFile(filePath));

            console.log("\n========================================");
            console.log("LOADING:", filePath);

            const source =
                await PDFDocument.load(bytes);

            console.log(
                "SOURCE PAGES:",
                source.getPageCount()
            );

            console.log("COPYING PAGES...");

            const pages =
                await destination.copyPages(
                    source,
                    source.getPageIndices()
                );

            console.log(
                "COPIED PAGES:",
                pages.length
            );

            for (const page of pages) {
                destination.addPage(page);
            }

            console.log(
                "DESTINATION PAGES:",
                destination.getPageCount()
            );
        }

        const output =
            await destination.save();

        console.log("\n========================================");
        console.log("MERGE: PASS");
        console.log("OUTPUT BYTES:", output.length);
        console.log(
            "OUTPUT PAGES:",
            destination.getPageCount()
        );

        expect(destination.getPageCount()).toBe(3);
        expect(output.length).toBeGreaterThan(0);
    });

});
