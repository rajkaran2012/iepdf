import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

import { ValidationPipeline } from "@/engine/validation/pipeline/validationPipeline";
import {
    ValidationGate,
    ValidationRule,
    ValidationStatus,
} from "@/engine/validation/pipeline/validationTypes";

describe("Hybrid XRef real PDF diagnostic", () => {

    it("validates the two previously failing real PDFs", async () => {

        const filePaths = [
            "C:\\Users\\WELCOME\\Desktop\\CLASS 7 COMPUTER.pdf",
            "C:\\Users\\WELCOME\\Desktop\\english literature class 1.pdf",
        ];

        const pipeline =
            new ValidationPipeline();

        for (const filePath of filePaths) {

            const bytes =
                await readFile(filePath);

            const file =
                new File(
                    [bytes],
                    filePath.split("\\").pop()!,
                    {
                        type: "application/pdf",
                    }
                );

            console.log("\n========================================");
            console.log("FILE:", file.name);
            console.log("BYTES:", bytes.length);

            const results =
                await pipeline.execute(
                    [file],
                    file,
                    "split"
                );

            const xrefResult =
                results.find(
                    (result) =>
                        result.gate === ValidationGate.DEEP &&
                        result.rule === ValidationRule.XREF
                );

            console.log(
                "XREF RESULT:",
                JSON.stringify(xrefResult, null, 2)
            );

            expect(xrefResult).toBeDefined();
            expect(xrefResult?.status).toBe(
                ValidationStatus.PASSED
            );
            expect(xrefResult?.passed).toBe(true);
        }
    });
});
