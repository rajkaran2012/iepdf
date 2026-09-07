import { describe, expect, it } from "vitest";
import { BrowserMergeProcessor } from "@/engine/processing/processors/BrowserMergeProcessor";

describe("BrowserMergeProcessor diagnostic", () => {

    it("merges the two real workspace PDFs", async () => {

        const paths = [
            "C:\\Users\\WELCOME\\Documents\\merged (19).pdf",
            "C:\\Users\\WELCOME\\Documents\\WorkDurationReportFourPunch anjali.pdf"
        ];

        const files = [];

        for (const filePath of paths) {

            const bytes =
                await import("node:fs/promises")
                    .then(fs => fs.readFile(filePath));

            files.push(
                new File(
                    [bytes],
                    filePath.split("\\").pop()!,
                    {
                        type: "application/pdf"
                    }
                )
            );
        }

        const workspaceFiles =
            files.map((file, index) => ({
                id: `diagnostic-${index}`,
                file,
                filename: file.name,
                extension: ".pdf",
                size: file.size,
                pages: index === 0 ? 2 : 1,
                status: "ready" as const,
                encrypted: false,
                corrupted: false,
                password: "",
                showPassword: false,
                skipped: false
            }));

        console.log("\n===== BROWSER MERGE PROCESSOR =====");

        const processor =
            new BrowserMergeProcessor();

        const result =
            await processor.process({
                files: workspaceFiles,
                toolType: "merge"
            });

        console.log("SUCCESS:", result.success);
        console.log("ERROR:", result.error ?? null);
        console.log(
            "OUTPUT:",
            result.outputFile
                ? {
                    name: result.outputFile.name,
                    size: result.outputFile.size
                }
                : null
        );

        expect(result.success).toBe(true);
        expect(result.outputFile).toBeDefined();
    });

});
