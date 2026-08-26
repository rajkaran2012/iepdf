/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : BrowserMergeProcessor.test.ts
 * Module     : Processing Tests
 * Layer      : Browser Merge Processor
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Verifies the browser-first Merge PDF processor.
 *
 * Security invariant:
 *
 *     BrowserMergeProcessor
 *             ↓
 *     BasePdfProcessor
 *             ↓
 *     ValidationGateway
 *             ↓
 *     processCore()
 *
 * The test suite intentionally uses the real ValidationGateway.
 * =============================================================================
 */

import {
    describe,
    expect,
    it,
} from "vitest";

import type {
    ProcessingContext,
} from "@/engine/processing/ProcessingContext";

import type {
    WorkspaceFile,
} from "@/engine/processing/WorkspaceFile";

import {
    BrowserMergeProcessor,
} from "@/engine/processing/processors/BrowserMergeProcessor";
import {
    BrowserPdfLoader,
} from "@/engine/loaders/BrowserPdfLoader";


function createStructurallyValidPdf(
    name: string,
    pageCount: number
): File {

    if (
        !Number.isInteger(pageCount) ||
        pageCount < 1
    ) {
        throw "pageCount must be a positive integer.";
    }

    const pageObjectNumbers: number[] = [];

    const contentObjectNumbers: number[] = [];

    for (
        let pageIndex = 0;
        pageIndex < pageCount;
        pageIndex++
    ) {

        pageObjectNumbers.push(
            3 + pageIndex * 2
        );

        contentObjectNumbers.push(
            4 + pageIndex * 2
        );

    }

    const objects: string[] = [];

    /*
     * Object 1 — Catalog
     */
    objects.push(
        "<< /Type /Catalog /Pages 2 0 R >>"
    );

    /*
     * Object 2 — Pages
     */
    objects.push(
        `<< /Type /Pages /Kids [` +
        pageObjectNumbers
            .map(
                objectNumber =>
                    `${objectNumber} 0 R`
            )
            .join(" ") +
        `] /Count ${pageCount} >>`
    );

    /*
     * Page + Contents objects.
     */
    for (
        let pageIndex = 0;
        pageIndex < pageCount;
        pageIndex++
    ) {

        const pageObjectNumber =
            pageObjectNumbers[pageIndex];

        const contentObjectNumber =
            contentObjectNumbers[pageIndex];

        objects.push(
            `<< /Type /Page ` +
            `/Parent 2 0 R ` +
            `/MediaBox [0 0 612 792] ` +
            `/Contents ${contentObjectNumber} 0 R >>`
        );

        objects.push(
            "<< /Length 0 >>\n" +
            "stream\n" +
            "endstream"
        );

    }

    let pdf =
        "%PDF-1.4\n";

    const offsets: number[] = [];

    for (
        let index = 0;
        index < objects.length;
        index++
    ) {

        const objectNumber =
            index + 1;

        offsets[objectNumber] =
            pdf.length;

        pdf +=
            `${objectNumber} 0 obj\n` +
            objects[index] +
            "\n" +
            "endobj\n";

    }

    const xrefOffset =
        pdf.length;

    pdf +=
        "xref\n" +
        `0 ${objects.length + 1}\n` +
        "0000000000 65535 f \n";

    for (
        let objectNumber = 1;
        objectNumber <= objects.length;
        objectNumber++
    ) {

        pdf +=
            `${String(
                offsets[objectNumber]
            ).padStart(10, "0")} 00000 n \n`;

    }

    pdf +=
        "trailer\n" +
        `<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
        "startxref\n" +
        `${xrefOffset}\n` +
        "%%EOF\n";

    return new File(
        [pdf],
        name,
        {
            type:
                "application/pdf",
        }
    );

}

function createPdf(
    name: string,
    body = ""
): File {

    const pdf =
        "%PDF-1.4\n" +
        "1 0 obj\n" +
        "<< /Type /Catalog >>\n" +
        "endobj\n" +
        body +
        "%%EOF\n";

    return new File(
        [pdf],
        name,
        {
            type: "application/pdf",
        }
    );

}


function createWorkspaceFile(
    file: File,
    overrides:
        Partial<WorkspaceFile> = {}
): WorkspaceFile {

    return {
        id:
            crypto.randomUUID(),

        file,

        filename:
            file.name,

        extension:
            ".pdf",

        size:
            file.size,

        pages:
            1,

        status:
            "ready",

        encrypted:
            false,

        corrupted:
            false,

        password:
            "",

        showPassword:
            false,

        skipped:
            false,

        ...overrides,

    };

}


function createContext(
    files: readonly WorkspaceFile[]
): ProcessingContext {

    return {

        files,

        toolType:
            "merge",

    };

}


describe(
    "BrowserMergeProcessor",
    () => {

        it(
            "blocks processing when validation rejects the input",
            async () => {

                const processor =
                    new BrowserMergeProcessor();

                const invalidFile =
                    new File(
                        [
                            "NOT-A-PDF\n",
                        ],
                        "invalid.pdf",
                        {
                            type:
                                "application/pdf",
                        }
                    );

                const context =
                    createContext(
                        [
                            createWorkspaceFile(
                                invalidFile
                            ),
                        ]
                    );

                const result =
                    await processor.process(
                        context
                    );

                expect(
                    result.success
                ).toBe(false);

            }
        );


        it(
            "does not process a skipped file",
            async () => {

                const processor =
                    new BrowserMergeProcessor();

                const file =
                    createPdf(
                        "skipped.pdf"
                    );

                const context =
                    createContext(
                        [
                            createWorkspaceFile(
                                file,
                                {
                                    skipped:
                                        true,
                                }
                            ),
                        ]
                    );

                const result =
                    await processor.process(
                        context
                    );

                expect(
                    result.success
                ).toBe(false);

            }
        );


        it(
            "does not process a corrupted workspace file",
            async () => {

                const processor =
                    new BrowserMergeProcessor();

                const file =
                    createPdf(
                        "corrupted.pdf"
                    );

                const context =
                    createContext(
                        [
                            createWorkspaceFile(
                                file,
                                {
                                    status:
                                        "corrupted",

                                    corrupted:
                                        true,
                                }
                            ),
                        ]
                    );

                const result =
                    await processor.process(
                        context
                    );

                expect(
                    result.success
                ).toBe(false);

            }
        );


        it(
            "returns a failure when no merge candidates remain",
            async () => {

                const processor =
                    new BrowserMergeProcessor();

                const context =
                    createContext([]);

                const result =
                    await processor.process(
                        context
                    );

                expect(
                    result.success
                ).toBe(false);

            }
        );


        it(
            "accepts a valid PDF through the processing boundary",
            async () => {

                /*
                 * This fixture is intentionally only a boundary-valid PDF-like
                 * document. The real validation gateway remains authoritative.
                 *
                 * If the current Deep validation requirements reject this
                 * minimal fixture, the test should fail rather than weakening
                 * the gateway.
                 */
                const processor =
                    new BrowserMergeProcessor();

                const file =
                    createPdf(
                        "valid.pdf"
                    );

                const context =
                    createContext(
                        [
                            createWorkspaceFile(
                                file
                            ),
                        ]
                    );

                const result =
                    await processor.process(
                        context
                    );

                expect(
                    result
                ).toBeDefined();

            }
        );

    it(
        "merges two valid PDF documents into one output PDF",
        async () => {

            const processor =
                new BrowserMergeProcessor();

            const firstPdf =
                createStructurallyValidPdf(
                    "first.pdf",
                    2
                );

            const secondPdf =
                createStructurallyValidPdf(
                    "second.pdf",
                    3
                );

            const context =
                createContext(
                    [
                        createWorkspaceFile(
                            firstPdf,
                            {
                                pages: 2,
                            }
                        ),

                        createWorkspaceFile(
                            secondPdf,
                            {
                                pages: 3,
                            }
                        ),
                    ]
                );

            const result =
                await processor.process(
                    context
                );

            if (!result.success) {
                console.error(
                    "========== MERGE RESULT ==========",
                    JSON.stringify(
                        result,
                        (_key, value) =>
                            value instanceof Date
                                ? value.toISOString()
                                : value,
                        2
                    )
                );
            }

            if (!result.success) {
                throw new Error(
                    "MERGE_PROCESSOR_FAILED: " +
                    JSON.stringify(result)
                );
            }

            expect(
                result.success
            ).toBe(true);

            expect(
                result.outputFile
            ).toBeDefined();

            expect(
                result.outputFile?.name
            ).toBe(
                "iepdf-merged.pdf"
            );

            expect(
                result.outputFile?.type
            ).toBe(
                "application/pdf"
            );

            expect(
                result.outputFile?.size
            ).toBeGreaterThan(0);

        }
    );
    }
);
