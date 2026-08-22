/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : BasePdfProcessor.validation.test.ts
 * Module     : Processing Tests
 * Layer      : Security / Authorization Boundary
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Verifies the mandatory processing authorization boundary:
 *
 *     BasePdfProcessor
 *             ↓
 *     validationGateway
 *             ↓
 *       authorization
 *             ↓
 *       processCore()
 *
 * Security invariants:
 *
 * 1. Gateway denial MUST prevent processCore().
 * 2. Gateway exception MUST prevent processCore().
 * 3. Gateway success MUST allow processCore().
 * 4. processCore() executes exactly once after authorization.
 * 5. Validation occurs before processCore().
 * 6. Cleanup still executes when validation fails.
 * 7. The complete active workspace is supplied to the Gateway.
 *
 * This test does NOT mock ValidationPipeline.
 * It tests the real canonical validationGateway boundary.
 * =============================================================================
 */

import {
    beforeEach,
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import type { ProcessingContext } from "@/engine/processing/ProcessingContext";
import type { ProcessingResult } from "@/engine/processing/results/ProcessingResult";
import type { WorkspaceFile } from "@/engine/processing/WorkspaceFile";

import type {
    ValidationGatewayResult,
} from "@/engine/validation/gateway/IValidationGateway";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
    ValidationSeverity,
    ValidationStatus,
} from "@/engine/validation/pipeline/validationTypes";

import type {
    ValidationResult,
} from "@/engine/validation/pipeline/validationResult";

import {
    validationGateway,
} from "@/engine/validation/gateway/ValidationGateway";

import {
    BasePdfProcessor,
} from "@/engine/processing/processors/BasePdfProcessor";


/**
 * =============================================================================
 * Test Processor
 * =============================================================================
 */
class TestPdfProcessor extends BasePdfProcessor {

    public readonly processCoreMock =
        vi.fn(
            async (): Promise<ProcessingResult> => ({
                success: true,
            })
        );

    protected override async processCore(
        _context: ProcessingContext
    ): Promise<ProcessingResult> {

        return this.processCoreMock();

    }

}


/**
 * =============================================================================
 * Test Data
 * =============================================================================
 */

function createFile(
    name = "processor-security-test.pdf"
): File {

    return new File(
        [
            "%PDF-1.7\n",
        ],
        name,
        {
            type: "application/pdf",
        }
    );

}


function createWorkspaceFile(
    name = "processor-security-test.pdf"
): WorkspaceFile {

    return {
        file: createFile(name),
        skipped: false,
    } as WorkspaceFile;

}


function createContext(
    files?: readonly WorkspaceFile[]
): ProcessingContext {

    return {

        files:
            files ??
            [
                createWorkspaceFile(),
            ],

        toolType: "merge",

    };

}


function createSuccessfulValidationResult(): ValidationResult {

    const now =
        new Date();

    return {

        id:
            crypto.randomUUID(),

        gate:
            ValidationGate.BOUNDARY,

        rule:
            ValidationRule.FILE_SIZE,

        validator:
            "ProcessorSecurityTestValidator",

        status:
            ValidationStatus.PASSED,

        passed:
            true,

        severity:
            ValidationSeverity.INFO,

        errorCode:
            ValidationErrorCode.NONE,

        message:
            "Validation passed.",

        startedAt:
            now,

        completedAt:
            now,

        executionTimeMs:
            0,

        order:
            1,

        metadata:
            Object.freeze({}),

        correlationId:
            undefined,

    };

}


function createGatewayResult(
    passed: boolean
): ValidationGatewayResult {

    return {

        passed,

        results:
            passed
                ? [
                    createSuccessfulValidationResult(),
                ]
                : [],

        correlationId:
            crypto.randomUUID(),

    };

}


/**
 * =============================================================================
 * Test Suite
 * =============================================================================
 */
describe(
    "BasePdfProcessor — Canonical Validation Gateway",
    () => {

        let validateSpy:
            ReturnType<typeof vi.spyOn>;


        beforeEach(
            () => {

                validateSpy =
                    vi
                        .spyOn(
                            validationGateway,
                            "validate"
                        )
                        .mockResolvedValue(
                            createGatewayResult(true)
                        );

            }
        );


        afterEach(
            () => {

                vi.restoreAllMocks();

            }
        );


        /**
         * =====================================================================
         * 1. DENIAL MUST BLOCK PROCESSING
         * =====================================================================
         */
        it(
            "does not execute processCore when Gateway denies authorization",
            async () => {

                validateSpy.mockResolvedValue(
                    createGatewayResult(false)
                );

                const processor =
                    new TestPdfProcessor();

                const result =
                    await processor.process(
                        createContext()
                    );

                expect(
                    result.success
                ).toBe(false);

                expect(
                    processor.processCoreMock
                ).not.toHaveBeenCalled();

                expect(
                    validateSpy
                ).toHaveBeenCalledTimes(1);

            }
        );


        /**
         * =====================================================================
         * 2. GATEWAY EXCEPTION MUST BLOCK PROCESSING
         * =====================================================================
         */
        it(
            "does not execute processCore when Gateway throws",
            async () => {

                validateSpy.mockRejectedValue(
                    new Error(
                        "Simulated Gateway failure."
                    )
                );

                const processor =
                    new TestPdfProcessor();

                const result =
                    await processor.process(
                        createContext()
                    );

                expect(
                    result.success
                ).toBe(false);

                expect(
                    processor.processCoreMock
                ).not.toHaveBeenCalled();

                expect(
                    validateSpy
                ).toHaveBeenCalledTimes(1);

            }
        );


        /**
         * =====================================================================
         * 3. SUCCESS MUST AUTHORIZE PROCESSING
         * =====================================================================
         */
        it(
            "executes processCore when Gateway authorizes processing",
            async () => {

                validateSpy.mockResolvedValue(
                    createGatewayResult(true)
                );

                const processor =
                    new TestPdfProcessor();

                const result =
                    await processor.process(
                        createContext()
                    );

                expect(
                    result.success
                ).toBe(true);

                expect(
                    processor.processCoreMock
                ).toHaveBeenCalledTimes(1);

                expect(
                    validateSpy
                ).toHaveBeenCalledTimes(1);

            }
        );


        /**
         * =====================================================================
         * 4. VALIDATION MUST OCCUR BEFORE processCore
         * =====================================================================
         */
        it(
            "executes validation before processCore",
            async () => {

                const executionOrder:
                    string[] = [];

                validateSpy.mockImplementation(
                    async () => {

                        executionOrder.push(
                            "gateway"
                        );

                        return createGatewayResult(
                            true
                        );

                    }
                );

                const processor =
                    new TestPdfProcessor();

                processor.processCoreMock.mockImplementation(
                    async () => {

                        executionOrder.push(
                            "processCore"
                        );

                        return {
                            success: true,
                        };

                    }
                );

                await processor.process(
                    createContext()
                );

                expect(
                    executionOrder
                ).toEqual(
                    [
                        "gateway",
                        "processCore",
                    ]
                );

            }
        );


        /**
         * =====================================================================
         * 5. processCore EXACTLY ONCE
         * =====================================================================
         */
        it(
            "executes processCore exactly once after successful authorization",
            async () => {

                const processor =
                    new TestPdfProcessor();

                await processor.process(
                    createContext()
                );

                expect(
                    processor.processCoreMock
                ).toHaveBeenCalledTimes(1);

                expect(
                    validateSpy
                ).toHaveBeenCalledTimes(1);

            }
        );


        /**
         * =====================================================================
         * 6. MULTI-FILE CONTRACT
         * =====================================================================
         */
        it(
            "passes the complete active workspace and current file separately",
            async () => {

                const firstFile =
                    createWorkspaceFile(
                        "first.pdf"
                    );

                const secondFile =
                    createWorkspaceFile(
                        "second.pdf"
                    );

                const skippedFile =
                    {
                        ...createWorkspaceFile(
                            "skipped.pdf"
                        ),
                        skipped: true,
                    } as WorkspaceFile;

                const context:
                    ProcessingContext = {

                    files:
                        [
                            firstFile,
                            secondFile,
                            skippedFile,
                        ],

                    toolType:
                        "merge",

                };

                const processor =
                    new TestPdfProcessor();

                await processor.process(
                    context
                );

                expect(
                    validateSpy
                ).toHaveBeenCalledTimes(2);

                expect(
                    validateSpy
                ).toHaveBeenNthCalledWith(
                    1,
                    [
                        firstFile.file,
                        secondFile.file,
                    ],
                    firstFile.file,
                    "merge"
                );

                expect(
                    validateSpy
                ).toHaveBeenNthCalledWith(
                    2,
                    [
                        firstFile.file,
                        secondFile.file,
                    ],
                    secondFile.file,
                    "merge"
                );

            }
        );


        /**
         * =====================================================================
         * 7. NO ACTIVE FILES
         * =====================================================================
         */
        it(
            "blocks processing when there are no active files",
            async () => {

                const skippedFile =
                    {
                        ...createWorkspaceFile(),
                        skipped: true,
                    } as WorkspaceFile;

                const processor =
                    new TestPdfProcessor();

                const result =
                    await processor.process(
                        createContext(
                            [
                                skippedFile,
                            ]
                        )
                    );

                expect(
                    result.success
                ).toBe(false);

                expect(
                    processor.processCoreMock
                ).not.toHaveBeenCalled();

                expect(
                    validateSpy
                ).not.toHaveBeenCalled();

            }
        );


        /**
         * =====================================================================
         * 8. CLEANUP AFTER VALIDATION DENIAL
         * =====================================================================
         */
        it(
            "runs cleanup when validation denies processing",
            async () => {

                validateSpy.mockResolvedValue(
                    createGatewayResult(false)
                );

                class CleanupTrackingProcessor
                    extends TestPdfProcessor {

                    public readonly cleanupMock =
                        vi.fn(
                            async () => {
                                // Intentionally empty.
                            }
                        );

                    protected override async cleanup(
                        context: ProcessingContext
                    ): Promise<void> {

                        await this.cleanupMock(
                            context
                        );

                    }

                }

                const processor =
                    new CleanupTrackingProcessor();

                const result =
                    await processor.process(
                        createContext()
                    );

                expect(
                    result.success
                ).toBe(false);

                expect(
                    processor.processCoreMock
                ).not.toHaveBeenCalled();

                expect(
                    processor.cleanupMock
                ).toHaveBeenCalledTimes(1);

            }
        );


        /**
         * =====================================================================
         * 9. CLEANUP AFTER GATEWAY EXCEPTION
         * =====================================================================
         */
        it(
            "runs cleanup when the Gateway throws",
            async () => {

                validateSpy.mockRejectedValue(
                    new Error(
                        "Simulated Gateway failure."
                    )
                );

                class CleanupTrackingProcessor
                    extends TestPdfProcessor {

                    public readonly cleanupMock =
                        vi.fn(
                            async () => {
                                // Intentionally empty.
                            }
                        );

                    protected override async cleanup(
                        context: ProcessingContext
                    ): Promise<void> {

                        await this.cleanupMock(
                            context
                        );

                    }

                }

                const processor =
                    new CleanupTrackingProcessor();

                const result =
                    await processor.process(
                        createContext()
                    );

                expect(
                    result.success
                ).toBe(false);

                expect(
                    processor.processCoreMock
                ).not.toHaveBeenCalled();

                expect(
                    processor.cleanupMock
                ).toHaveBeenCalledTimes(1);

            }
        );


        /**
         * =====================================================================
         * 10. processCore FAILURE
         * =====================================================================
         */
        it(
            "converts a processCore exception into a processing failure",
            async () => {

                const processor =
                    new TestPdfProcessor();

                processor.processCoreMock.mockRejectedValue(
                    new Error(
                        "Simulated processing failure."
                    )
                );

                const result =
                    await processor.process(
                        createContext()
                    );

                expect(
                    result.success
                ).toBe(false);

                expect(
                    result.error
                ).toBe(
                    "Simulated processing failure."
                );

                expect(
                    processor.processCoreMock
                ).toHaveBeenCalledTimes(1);

                expect(
                    validateSpy
                ).toHaveBeenCalledTimes(1);

            }
        );

    }
);