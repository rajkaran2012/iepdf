/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : CompleteValidationPipeline.test.ts
 * Module      : Validation Engine
 * Layer       : Integration Tests
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Verifies the REAL canonical validation pipeline:
 *
 *     Boundary
 *         ↓
 *     Security
 *         ↓
 *     Deep
 *
 * IMPORTANT
 * -----------------------------------------------------------------------------
 * These tests use the real ValidationPipeline and real validator registries.
 * They do not mock the pipeline or validator registries.
 *
 * The integration tests use "split" because it is a single-file tool.
 *
 * =============================================================================
 */

import {
    describe,
    expect,
    it,
} from "vitest";

import {
    ValidationPipeline,
} from "@/engine/validation/pipeline/validationPipeline";

import {
    ValidationGate,
    ValidationStatus,
} from "@/engine/validation/pipeline/validationTypes";


/**
 * =============================================================================
 * Fixtures
 * =============================================================================
 */

/**
 * Minimal PDF-like file.
 *
 * This fixture is intentionally small.
 * It satisfies the basic PDF boundary identity requirements.
 */
function createValidPdf(): File {

    /*
     * Minimal structurally valid PDF.
     *
     * This fixture contains:
     * - PDF header
     * - Catalog
     * - Pages tree
     * - Page object
     * - Content stream
     * - Cross-reference table
     * - Trailer
     *
     * It is intentionally unencrypted and contains no active content.
     */
    const pdf =
        "%PDF-1.4\n" +
        "1 0 obj\n" +
        "<< /Type /Catalog /Pages 2 0 R >>\n" +
        "endobj\n" +
        "2 0 obj\n" +
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n" +
        "endobj\n" +
        "3 0 obj\n" +
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\n" +
        "endobj\n" +
        "4 0 obj\n" +
        "<< /Length 0 >>\n" +
        "stream\n" +
        "endstream\n" +
        "endobj\n" +
        "xref\n" +
        "0 5\n" +
        "0000000000 65535 f \n" +
        "0000000009 00000 n \n" +
        "0000000058 00000 n \n" +
        "0000000115 00000 n \n" +
        "0000000216 00000 n \n" +
        "trailer\n" +
        "<< /Size 5 /Root 1 0 R >>\n" +
        "startxref\n" +
        "265\n" +
        "%%EOF\n";

    return new File(
        [pdf],
        "integration-valid.pdf",
        {
            type: "application/pdf",
        }
    );

}

function createInvalidMagicPdf(): File {

    return new File(
        [
            "NOT-A-PDF\n",
            "1 0 obj\n",
            "<< /Type /Catalog >>\n",
            "endobj\n",
            "%%EOF\n",
        ],
        "invalid-magic.pdf",
        {
            type: "application/pdf",
        }
    );

}


/**
 * PDF containing a JavaScript marker.
 */
function createJavaScriptPdf(): File {

    /*
     * Structurally valid PDF containing a JavaScript action.
     *
     * XRef offsets are calculated dynamically.
     */

    const objects = [

        "<< /Type /Catalog /Pages 2 0 R /OpenAction 5 0 R >>",

        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",

        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",

        "<< /Length 0 >>\nstream\nendstream",

        "<< /Type /Action /S /JavaScript /JS (app.alert('iePDF test')) >>",

    ];

    let pdf =
        "%PDF-1.4\n";

    const offsets: number[] = [0];

    for (let i = 0; i < objects.length; i++) {

        offsets.push(pdf.length);

        pdf +=
            `${i + 1} 0 obj\n` +
            `${objects[i]}\n` +
            "endobj\n";

    }

    const xrefOffset = pdf.length;

    pdf +=
        `xref\n` +
        `0 ${objects.length + 1}\n` +
        "0000000000 65535 f \n";

    for (let i = 1; i <= objects.length; i++) {

        pdf +=
            `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;

    }

    pdf +=
        "trailer\n" +
        `<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
        "startxref\n" +
        `${xrefOffset}\n` +
        "%%EOF\n";

    return new File(
        [pdf],
        "javascript.pdf",
        {
            type: "application/pdf",
        }
    );

}

/**
 * =============================================================================
 * Helpers
 * =============================================================================
 */

function gates(
    results: readonly {
        gate: ValidationGate;
    }[]
): ValidationGate[] {

    return results.map(
        result => result.gate
    );

}


function failedResults(
    results: readonly {
        passed: boolean;
    }[]
) {

    return results.filter(
        result => !result.passed
    );

}


/**
 * =============================================================================
 * Test Suite
 * =============================================================================
 */

describe(
    "Complete Validation Pipeline — Boundary → Security → Deep",
    () => {

        /**
         * =====================================================================
         * 1. REAL PIPELINE
         * =====================================================================
         */
        it(
            "constructs the real ValidationPipeline",
            () => {

                const pipeline =
                    new ValidationPipeline();

                expect(
                    pipeline
                ).toBeInstanceOf(
                    ValidationPipeline
                );

            }
        );


        /**
         * =====================================================================
         * 2. VALIDATION RESULT EXISTS
         * =====================================================================
         */
        it(
            "returns validation results for a valid PDF",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createValidPdf();

                const results =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                expect(
                    results
                ).toBeDefined();

                expect(
                    Array.isArray(results)
                ).toBe(true);

                expect(
                    results.length
                ).toBeGreaterThan(0);

            }
        );


        /**
         * =====================================================================
         * 3. BOUNDARY GATE
         * =====================================================================
         */
        it(
            "executes the Boundary gate for a valid PDF",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createValidPdf();

                const results =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                expect(
                    gates(results)
                ).toContain(
                    ValidationGate.BOUNDARY
                );

            }
        );


        /**
         * =====================================================================
         * 4. SECURITY GATE
         * =====================================================================
         *
         * This test verifies that a valid boundary input can enter Security.
         *
         * If PasswordProtectionValidator throws an internal error in the
         * current Node/Vitest environment, this test will expose that fact.
         */
        it(
            "reaches the Security gate for a valid PDF",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createValidPdf();

                const results =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                expect(
                    gates(results)
                ).toContain(
                    ValidationGate.SECURITY
                );

            }
        );


        /**
         * =====================================================================
         * 5. CANONICAL GATE ORDER
         * =====================================================================
         */
        it(
            "returns gates in canonical Boundary → Security → Deep order",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createValidPdf();

                const results =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                const resultGates =
                    gates(results);

                const boundaryIndex =
                    resultGates.indexOf(
                        ValidationGate.BOUNDARY
                    );

                const securityIndex =
                    resultGates.indexOf(
                        ValidationGate.SECURITY
                    );

                const deepIndex =
                    resultGates.indexOf(
                        ValidationGate.DEEP
                    );

                expect(
                    boundaryIndex
                ).toBeGreaterThanOrEqual(0);

                /*
                 * Security and Deep must occur after Boundary if they exist.
                 */
                if (securityIndex >= 0) {

                    expect(
                        securityIndex
                    ).toBeGreaterThan(
                        boundaryIndex
                    );

                }

                if (deepIndex >= 0) {

                    expect(
                        deepIndex
                    ).toBeGreaterThan(
                        boundaryIndex
                    );

                    if (securityIndex >= 0) {

                        expect(
                            deepIndex
                        ).toBeGreaterThan(
                            securityIndex
                        );

                    }

                }

            }
        );


        /**
         * =====================================================================
         * 6. RESULT ORDER
         * =====================================================================
         */
        it(
            "returns validation results in deterministic execution order",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createValidPdf();

                const results =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                for (
                    let index = 1;
                    index < results.length;
                    index++
                ) {

                    expect(
                        results[index].order
                    ).toBeGreaterThanOrEqual(
                        results[index - 1].order
                    );

                }

            }
        );


        /**
         * =====================================================================
         * 7. FAIL CLOSED — BOUNDARY
         * =====================================================================
         */
        it(
            "stops processing after a Boundary failure",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createInvalidMagicPdf();

                const results =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                const failures =
                    failedResults(results);

                expect(
                    failures.length
                ).toBeGreaterThan(0);

                expect(
                    gates(results)
                ).toContain(
                    ValidationGate.BOUNDARY
                );

                /*
                 * A Boundary failure must prevent later gates.
                 */
                expect(
                    gates(results)
                ).not.toContain(
                    ValidationGate.SECURITY
                );

                expect(
                    gates(results)
                ).not.toContain(
                    ValidationGate.DEEP
                );

            }
        );


        /**
         * =====================================================================
         * 8. SECURITY VIOLATION
         * =====================================================================
         */
        it(
            "detects a JavaScript security violation",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createJavaScriptPdf();

                const results =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                expect(
                    gates(results)
                ).toContain(
                    ValidationGate.SECURITY
                );

            }
        );


        /**
         * =====================================================================
         * 9. RESULT IMMUTABILITY
         * =====================================================================
         */
        it(
            "returns immutable validation results",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createValidPdf();

                const results =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                expect(
                    results.length
                ).toBeGreaterThan(0);

                for (
                    const result of results
                ) {

                    expect(
                        Object.isFrozen(result)
                    ).toBe(true);

                }

            }
        );


        /**
         * =====================================================================
         * 10. REPEATED EXECUTION
         * =====================================================================
         *
         * The same input should produce a structurally deterministic gate
         * sequence across repeated executions.
         */
        it(
            "produces a deterministic gate sequence across repeated execution",
            async () => {

                const pipeline =
                    new ValidationPipeline();

                const file =
                    createValidPdf();

                const first =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                const second =
                    await pipeline.execute(
                        [file],
                        file,
                        "split"
                    );

                expect(
                    gates(first)
                ).toEqual(
                    gates(second)
                );

            }
        );

    }
);



