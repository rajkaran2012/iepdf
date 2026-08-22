/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : ValidationGateway.security.test.ts
 * Module      : Validation Gateway
 * Layer       : Security / Adversarial Tests
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Security tests for the canonical ValidationGateway.
 *
 * These tests verify the POSITIVE authorization model:
 *
 *     ALLOW only when:
 *
 *     passed    === true
 *     status    === PASSED
 *     severity  === INFO
 *     errorCode === NONE
 *
 * Every other state MUST be denied.
 *
 * These tests intentionally do not parse real PDFs.
 *
 * The ValidationPipeline is replaced with a controlled test double so that
 * individual validation states can be tested deterministically.
 *
 * =============================================================================
 */

import {
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    ValidationGateway,
} from "@/engine/validation/gateway/ValidationGateway";

import type {
    ValidationResult,
} from "@/engine/validation/pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
    ValidationSeverity,
    ValidationStatus,
} from "@/engine/validation/pipeline/validationTypes";

import type {
    ValidationPipeline,
} from "@/engine/validation/pipeline/validationPipeline";


/**
 * =============================================================================
 * Test File Factory
 * =============================================================================
 *
 * Creates a real browser-compatible File object.
 *
 * Node 24 provides the File API required by the validation boundary.
 */
function createTestFile(): File {

    return new File(
        [
            "%PDF-1.7\n"
        ],
        "security-test.pdf",
        {
            type: "application/pdf",
        }
    );

}


/**
 * =============================================================================
 * Validation Result Factory
 * =============================================================================
 *
 * Creates a structurally valid ValidationResult.
 *
 * Individual tests override only the security-relevant property being tested.
 */
function createResult(
    overrides: Partial<ValidationResult> = {}
): ValidationResult {

    const startedAt =
        new Date();

    const completedAt =
        new Date();


    return {

        id:
            crypto.randomUUID(),

        gate:
            ValidationGate.BOUNDARY,

        rule:
            ValidationRule.FILE_SIZE,

        validator:
            "AdversarialTestValidator",

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

        startedAt,

        completedAt,

        executionTimeMs:
            0,

        order:
            1,

        metadata:
            Object.freeze({}),

        correlationId:
            undefined,

        ...overrides,

    };

}


/**
 * =============================================================================
 * Controlled Pipeline Factory
 * =============================================================================
 *
 * The Gateway accepts a ValidationPipeline dependency.
 *
 * We replace only its public execute() method.
 *
 * No production validation logic is bypassed inside the Gateway itself.
 */
function createControlledPipeline(
    results: readonly ValidationResult[]
): ValidationPipeline {

    return {

        execute:
            vi.fn(
                async () => results
            ),

    } as unknown as ValidationPipeline;

}


/**
 * =============================================================================
 * Gateway Execution Helper
 * =============================================================================
 */
async function executeGateway(
    results: readonly ValidationResult[]
) {

    const file =
        createTestFile();

    const pipeline =
        createControlledPipeline(
            results
        );

    const gateway =
        new ValidationGateway(
            pipeline
        );

    return gateway.validate(
        [file],
        file,
        "merge"
    );

}


/**
 * =============================================================================
 * Test Suite
 * =============================================================================
 */
describe(
    "ValidationGateway — adversarial authorization",
    () => {


        /**
         * =====================================================================
         * EXACT SUCCESS
         * =====================================================================
         */
        it(
            "allows processing for the exact successful validation state",
            async () => {

                const result =
                    createResult();


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(true);


                expect(
                    gatewayResult.results
                ).toHaveLength(1);

            }
        );


        /**
         * =====================================================================
         * EMPTY RESULT SET
         * =====================================================================
         */
        it(
            "denies processing when the pipeline returns no results",
            async () => {

                const gatewayResult =
                    await executeGateway(
                        []
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * passed === false
         * =====================================================================
         */
        it(
            "denies processing when passed is false",
            async () => {

                const result =
                    createResult({

                        passed:
                            false,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * FAILED STATUS
         * =====================================================================
         */
        it(
            "denies processing when status is FAILED",
            async () => {

                const result =
                    createResult({

                        status:
                            ValidationStatus.FAILED,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * SKIPPED STATUS
         * =====================================================================
         */
        it(
            "denies processing when status is SKIPPED",
            async () => {

                const result =
                    createResult({

                        status:
                            ValidationStatus.SKIPPED,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * WARNING SEVERITY
         * =====================================================================
         */
        it(
            "denies processing when severity is WARNING",
            async () => {

                const result =
                    createResult({

                        severity:
                            ValidationSeverity.WARNING,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * ERROR SEVERITY
         * =====================================================================
         */
        it(
            "denies processing when severity is ERROR",
            async () => {

                const result =
                    createResult({

                        severity:
                            ValidationSeverity.ERROR,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * CRITICAL SEVERITY
         * =====================================================================
         */
        it(
            "denies processing when severity is CRITICAL",
            async () => {

                const result =
                    createResult({

                        severity:
                            ValidationSeverity.CRITICAL,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * NON-NONE ERROR CODE
         * =====================================================================
         */
        it(
            "denies processing when errorCode is not NONE",
            async () => {

                const result =
                    createResult({

                        errorCode:
                            ValidationErrorCode.INVALID_HEADER,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * PASSED TRUE + FAILED STATUS
         * =====================================================================
         *
         * This is an important confused-state test.
         *
         * A future or buggy validator must not be able to authorize processing
         * merely because passed === true.
         */
        it(
            "denies passed=true combined with FAILED status",
            async () => {

                const result =
                    createResult({

                        passed:
                            true,

                        status:
                            ValidationStatus.FAILED,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * PASSED TRUE + ERROR SEVERITY
         * =====================================================================
         */
        it(
            "denies passed=true combined with ERROR severity",
            async () => {

                const result =
                    createResult({

                        passed:
                            true,

                        severity:
                            ValidationSeverity.ERROR,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * PASSED TRUE + NON-NONE ERROR
         * =====================================================================
         */
        it(
            "denies passed=true combined with a non-NONE error code",
            async () => {

                const result =
                    createResult({

                        passed:
                            true,

                        errorCode:
                            ValidationErrorCode.UNKNOWN_ERROR,

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * MIXED RESULTS
         * =====================================================================
         *
         * One successful result MUST NOT compensate for one failed result.
         */
        it(
            "denies processing when even one result fails",
            async () => {

                const successfulResult =
                    createResult({

                        order:
                            1,

                    });


                const failedResult =
                    createResult({

                        order:
                            2,

                        passed:
                            false,

                        status:
                            ValidationStatus.FAILED,

                        errorCode:
                            ValidationErrorCode.INVALID_HEADER,

                    });


                const gatewayResult =
                    await executeGateway(
                        [
                            successfulResult,
                            failedResult,
                        ]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * UNKNOWN FUTURE STATUS
         * =====================================================================
         *
         * TypeScript cannot prevent a future runtime value from arriving.
         *
         * The Gateway must therefore fail closed.
         */
        it(
            "denies an unknown runtime status",
            async () => {

                const result =
                    createResult({

                        status:
                            ("FUTURE_UNKNOWN_STATUS" as ValidationStatus),

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * UNKNOWN FUTURE SEVERITY
         * =====================================================================
         */
        it(
            "denies an unknown runtime severity",
            async () => {

                const result =
                    createResult({

                        severity:
                            ("FUTURE_UNKNOWN_SEVERITY" as ValidationSeverity),

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * UNKNOWN FUTURE ERROR CODE
         * =====================================================================
         */
        it(
            "denies an unknown runtime error code",
            async () => {

                const result =
                    createResult({

                        errorCode:
                            ("FUTURE_UNKNOWN_ERROR" as ValidationErrorCode),

                    });


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);

            }
        );


        /**
         * =====================================================================
         * PIPELINE EXCEPTION
         * =====================================================================
         *
         * Unexpected internal validation failures MUST NEVER authorize
         * processing.
         */
        it(
            "fails closed when the validation pipeline throws",
            async () => {

                const file =
                    createTestFile();


                const pipeline = {

                    execute:
                        vi.fn(
                            async () => {

                                throw new Error(
                                    "Simulated internal pipeline failure."
                                );

                            }
                        ),

                } as unknown as ValidationPipeline;


                const gateway =
                    new ValidationGateway(
                        pipeline
                    );


                const gatewayResult =
                    await gateway.validate(
                        [file],
                        file,
                        "merge"
                    );


                expect(
                    gatewayResult.passed
                ).toBe(false);


                expect(
                    gatewayResult.results
                ).toHaveLength(0);


                expect(
                    gatewayResult.correlationId
                ).toBeTruthy();

            }
        );


        /**
         * =====================================================================
         * MULTIPLE SUCCESSFUL RESULTS
         * =====================================================================
         *
         * All validators must succeed.
         */
        it(
            "allows processing when every validation result is exactly successful",
            async () => {

                const results =
                    [
                        createResult({

                            order:
                                1,

                            rule:
                                ValidationRule.FILE_SIZE,

                        }),

                        createResult({

                            order:
                                2,

                            rule:
                                ValidationRule.EXTENSION,

                        }),

                        createResult({

                            order:
                                3,

                            rule:
                                ValidationRule.HEADER,

                            gate:
                                ValidationGate.DEEP,

                        }),
                    ];


                const gatewayResult =
                    await executeGateway(
                        results
                    );


                expect(
                    gatewayResult.passed
                ).toBe(true);


                expect(
                    gatewayResult.results
                ).toHaveLength(3);

            }
        );


        /**
         * =====================================================================
         * RESULT IMMUTABILITY
         * =====================================================================
         *
         * The Gateway must return immutable validation results.
         */
        it(
            "returns frozen validation results",
            async () => {

                const result =
                    createResult();


                const gatewayResult =
                    await executeGateway(
                        [result]
                    );


                expect(
                    Object.isFrozen(
                        gatewayResult
                    )
                ).toBe(true);


                expect(
                    Object.isFrozen(
                        gatewayResult.results
                    )
                ).toBe(true);


                expect(
                    Object.isFrozen(
                        gatewayResult.results[0]
                    )
                ).toBe(true);

            }
        );

    }
);
