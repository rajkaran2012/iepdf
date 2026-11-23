import { describe, expect, it } from "vitest";
import { FileCountValidator } from "./fileCountValidator";
import type { ValidationContext } from "../pipeline/validationContext";

function createContext(
    fileCount: number,
    maxFiles?: number,
    toolType: ValidationContext["toolType"] = "merge"
): ValidationContext {
    const file = new File([], "test.pdf", {
        type: "application/pdf",
    });

    return {
        id: "file-count-test",
        files: Array.from({ length: fileCount }, () => file),
        fileCount,
        toolType,
        maxFileSizeBytes: 15 * 1024 * 1024,
        maxFiles,
        file,
        fileName: file.name,
        extension: "pdf",
        mimeType: file.type,
        fileSize: 0,
        startedAt: new Date(),
        correlationId: "file-count-test",
        results: [],
        metadata: {},
        cancelled: false,
        stopPipeline: false,
    };
}

describe("FileCountValidator", () => {
    const validator = new FileCountValidator();

    it("accepts 29 Merge files when the account limit is 100", async () => {
        const result = await validator.validate(createContext(29, 100));

        expect(result.passed).toBe(true);
    });

    it("rejects 6 Merge files when the account limit is 5", async () => {
        const result = await validator.validate(createContext(6, 5));

        expect(result.passed).toBe(false);
        expect(result.details).toContain("Maximum=5");
    });

    it("rejects 101 Merge files when the account limit is 100", async () => {
        const result = await validator.validate(createContext(101, 100));

        expect(result.passed).toBe(false);
        expect(result.details).toContain("Maximum=100");
    });

    it("retains the static Merge limit when no account limit is supplied", async () => {
        const result = await validator.validate(createContext(21));

        expect(result.passed).toBe(false);
        expect(result.details).toContain("Maximum=20");
    });

    it("retains the existing JPG-to-PDF limit when no account limit is supplied", async () => {
        const result = await validator.validate(
            createContext(50, undefined, "jpg-to-pdf")
        );

        expect(result.passed).toBe(true);
    });
});
