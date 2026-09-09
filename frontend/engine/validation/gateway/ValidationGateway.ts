/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : ValidationGateway.ts
 * Module      : Validation Gateway
 * Layer       : Application Boundary
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Single application-facing entry point for PDF validation.
 *
 * Application and processing code MUST use this gateway instead of directly
 * accessing:
 *
 * - ValidationPipeline
 * - BoundaryValidatorRegistry
 * - SecurityValidatorRegistry
 * - DeepValidatorRegistry
 * - PDF parsing services
 * - Security detectors
 *
 * =============================================================================
 * Security Model
 * =============================================================================
 *
 * FAIL CLOSED.
 *
 * Processing is allowed ONLY when ALL of the following are true:
 *
 * 1. Gateway input is valid.
 * 2. Validation pipeline completes successfully.
 * 3. At least one validation result exists.
 * 4. Every result is structurally valid.
 * 5. Every result has passed === true.
 * 6. Every result has status === PASSED.
 * 7. Every result has severity === INFO.
 * 8. Every result has errorCode === NONE.
 *
 * This is a POSITIVE authorization model.
 *
 * Anything not explicitly representing a successful validation is denied.
 *
 * =============================================================================
 * Important Security Principle
 * =============================================================================
 *
 * DO NOT use a negative blacklist such as:
 *
 *     "reject FAILED"
 *     "reject CRITICAL"
 *     "reject UNKNOWN_ERROR"
 *
 * because new failure states could accidentally become authorized.
 *
 * Instead:
 *
 *     ALLOW only the exact successful state.
 *
 * =============================================================================
 */

import type { ToolType } from "@/lib/validationTypes";

import type {
    IValidationGateway,
    ValidationGatewayResult,
} from "./IValidationGateway";

import type {
    ValidationResult,
} from "../pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationSeverity,
    ValidationStatus,
} from "../pipeline/validationTypes";

import {
    ValidationPipeline,
} from "../pipeline/validationPipeline";

import {
    ValidationEngineException,
} from "../common/validationException";

import {
    ValidationLogger,
} from "../common/validationLogger";


/**
 * =============================================================================
 * Validation Gateway
 * =============================================================================
 */
export class ValidationGateway
    implements IValidationGateway {


    /**
     * =========================================================================
     * Canonical Validation Pipeline
     * =========================================================================
     *
     * Private by design.
     *
     * Application code cannot access the pipeline through this gateway.
     *
     * Constructor injection is retained so the Gateway can be tested with a
     * controlled pipeline implementation.
     */
    private readonly pipeline: ValidationPipeline;


    /**
     * =========================================================================
     * Constructor
     * =========================================================================
     */
    public constructor(
        pipeline?: ValidationPipeline
    ) {

        this.pipeline =
            pipeline ??
            new ValidationPipeline();

    }


    /**
     * =========================================================================
     * Validate
     * =========================================================================
     *
     * Canonical application validation entry point.
     *
     * This method:
     *
     * - validates the Gateway input contract
     * - executes the canonical 3-Gate Validation Pipeline
     * - normalizes the results
     * - makes the final authorization decision
     * - fails closed on unexpected errors
     *
     * It NEVER:
     *
     * - performs PDF processing
     * - modifies uploaded files
     * - exposes internal exceptions
     */
    public async validate(
        files: ReadonlyArray<File>,
        file: File,
        toolType: ToolType
    ): Promise<ValidationGatewayResult> {

        const correlationId =
            crypto.randomUUID();


        ValidationLogger.group(
            "Validation Gateway"
        );


        try {

            /**
             * ================================================================
             * Application Boundary
             * ================================================================
             *
             * Protect the Gateway contract before entering the Validation
             * Pipeline.
             */
            this.validateInput(
                files,
                file,
                toolType
            );


            ValidationLogger.info(
                "ValidationGateway",
                "Starting canonical validation.",
                {
                    correlationId,
                    fileCount: files.length,
                    fileName: file.name,
                    toolType,
                }
            );


            /**
             * ================================================================
             * Canonical 3-Gate Pipeline
             * ================================================================
             *
             * Boundary
             *     ↓
             * Security
             *     ↓
             * Deep
             */
            const pipelineResults =
                await this.pipeline.execute(
                    files,
                    file,
                    toolType
                );


            /**
             * ================================================================
             * Normalize Results
             * ================================================================
             */
            const results =
                this.normalizeResults(
                    pipelineResults,
                    correlationId
                );


            /**
             * ================================================================
             * Final Authorization Decision
             * ================================================================
             *
             * IMPORTANT:
             *
             * The Gateway is the ONLY component that decides whether PDF
             * processing may proceed.
             */
            const passed =
                this.isProcessingAllowed(
                    results
                );


            ValidationLogger.info(
                "ValidationGateway",
                passed
                    ? "Validation passed. Processing is authorized."
                    : "Validation failed. Processing is blocked.",
                {
                    correlationId,
                    resultCount: results.length,
                    passed,
                }
            );


            return Object.freeze({

                passed,

                results,

                correlationId,

            });

        }
        catch (
            error: unknown
        ) {

            /**
             * ================================================================
             * FAIL CLOSED
             * ================================================================
             *
             * Any unexpected Gateway failure MUST result in DENY.
             *
             * NEVER return:
             *
             *     passed: true
             *
             * from this branch.
             *
             * Internal exception details are written only to the centralized
             * logger.
             */
            ValidationLogger.error(
                "ValidationGateway",
                "Validation could not be completed. Processing blocked.",
                error,
                {
                    correlationId,
                    toolType,
                }
            );


            return Object.freeze({

                passed: false,

                results:
                    Object.freeze(
                        []
                    ) as readonly ValidationResult[],

                correlationId,

            });

        }
        finally {

            ValidationLogger.groupEnd();

        }

    }


    /**
     * =========================================================================
     * Application Input Validation
     * =========================================================================
     *
     * This protects the Gateway contract itself.
     *
     * It does NOT replace the Boundary Gate.
     *
     * The Boundary Gate remains responsible for PDF/file validation.
     */
    private validateInput(
        files: ReadonlyArray<File>,
        file: File,
        toolType: ToolType
    ): void {

        /**
         * ---------------------------------------------------------------
         * File collection
         * ---------------------------------------------------------------
         */
        if (
            !Array.isArray(files)
        ) {

            throw new ValidationEngineException({

                message:
                    "Validation file collection is invalid.",

            });

        }


        /**
         * ---------------------------------------------------------------
         * Empty collection
         * ---------------------------------------------------------------
         */
        if (
            files.length === 0
        ) {

            throw new ValidationEngineException({

                message:
                    "No files were supplied for validation.",

            });

        }


        /**
         * ---------------------------------------------------------------
         * Current file
         * ---------------------------------------------------------------
         *
         * Only inspect the minimum browser File contract here.
         */
        if (
            !file ||
            typeof file.name !== "string" ||
            typeof file.size !== "number" ||
            !Number.isFinite(file.size) ||
            file.size < 0 ||
            typeof file.slice !== "function"
        ) {

            throw new ValidationEngineException({

                message:
                    "Validation file is invalid.",

            });

        }


        /**
         * ---------------------------------------------------------------
         * Tool type
         * ---------------------------------------------------------------
         */
        if (
            !toolType ||
            typeof toolType !== "string"
        ) {

            throw new ValidationEngineException({

                message:
                    "Validation tool type is required.",

            });

        }


        /**
         * ---------------------------------------------------------------
         * File identity
         * ---------------------------------------------------------------
         *
         * The current file MUST belong to the supplied workspace collection.
         *
         * Identity comparison is deliberate.
         *
         * Filename comparison is insufficient because duplicate filenames
         * are legal.
         */
        if (
            !files.some(
                candidate =>
                    candidate === file
            )
        ) {

            throw new ValidationEngineException({

                message:
                    "Validation file is not part of the supplied file collection.",

            });

        }

    }


    /**
     * =========================================================================
     * Normalize Pipeline Results
     * =========================================================================
     *
     * Converts the Pipeline output into the immutable Gateway representation.
     *
     * IMPORTANT:
     *
     * The Gateway does not "repair" invalid validation results.
     *
     * Invalid results cause a Gateway exception and therefore FAIL CLOSED.
     */
    private normalizeResults(
        pipelineResults:
            readonly ValidationResult[],
        correlationId: string
    ): ReadonlyArray<ValidationResult> {


        /**
         * Empty results are a security failure.
         */
        if (
            !Array.isArray(pipelineResults) ||
            pipelineResults.length === 0
        ) {

            throw new ValidationEngineException({

                message:
                    "Validation pipeline returned no validation results.",

            });

        }


        const normalized =
            pipelineResults.map(
                (
                    result,
                    index
                ) => {

                    /**
                     * ---------------------------------------------------------
                     * Result object validation
                     * ---------------------------------------------------------
                     */
                    if (
                        !result ||
                        typeof result !== "object"
                    ) {

                        throw new ValidationEngineException({

                            message:
                                "Validation pipeline returned an invalid validation result.",

                        });

                    }


                    /**
                     * ---------------------------------------------------------
                     * Explicit pass/fail decision
                     * ---------------------------------------------------------
                     */
                    if (
                        typeof result.passed !== "boolean"
                    ) {

                        throw new ValidationEngineException({

                            message:
                                "Validation result has no valid pass/fail decision.",

                        });

                    }


                    /**
                     * ---------------------------------------------------------
                     * Status
                     * ---------------------------------------------------------
                     */
                    if (
                        typeof result.status !== "string"
                    ) {

                        throw new ValidationEngineException({

                            message:
                                "Validation result has no valid status.",

                        });

                    }


                    /**
                     * ---------------------------------------------------------
                     * Severity
                     * ---------------------------------------------------------
                     */
                    if (
                        typeof result.severity !== "string"
                    ) {

                        throw new ValidationEngineException({

                            message:
                                "Validation result has no valid severity.",

                        });

                    }


                    /**
                     * ---------------------------------------------------------
                     * Error code
                     * ---------------------------------------------------------
                     */
                    if (
                        typeof result.errorCode !== "string"
                    ) {

                        throw new ValidationEngineException({

                            message:
                                "Validation result has no valid error code.",

                        });

                    }


                    /**
                     * ---------------------------------------------------------
                     * Immutable normalized result
                     * ---------------------------------------------------------
                     */
                    return Object.freeze({

                        ...result,

                        order:
                            Number.isFinite(
                                result.order
                            )
                                ? result.order
                                : index + 1,

                        correlationId,

                        metadata:
                            Object.freeze({
                                ...(result.metadata ?? {}),
                            }),

                    });

                }
            );


        return Object.freeze(
            normalized
        );

    }


    /**
     * =========================================================================
     * Processing Authorization
     * =========================================================================
     *
     * THIS IS THE SECURITY CRITICAL METHOD.
     *
     * It answers exactly one question:
     *
     *     "May PDF processing begin?"
     *
     * Default answer:
     *
     *     NO
     *
     * =========================================================================
     *
     * POSITIVE SECURITY MODEL
     * =========================================================================
     *
     * Processing is authorized ONLY when EVERY result satisfies ALL four
     * conditions:
     *
     *     passed    === true
     *     status    === PASSED
     *     severity  === INFO
     *     errorCode === NONE
     *
     * This is intentionally stricter than checking for known failures.
     *
     * New future failure states automatically fail closed.
     *
     * Example:
     *
     *     passed: true
     *     status: PASSED
     *     severity: ERROR
     *     errorCode: SOME_NEW_ERROR
     *
     * MUST be rejected.
     *
     * =========================================================================
     */
    private isProcessingAllowed(
        results: ReadonlyArray<ValidationResult>
    ): boolean {

        /**
         * ---------------------------------------------------------------
         * Rule 1 — Empty validation = BLOCK
         * ---------------------------------------------------------------
         */
        if (
            results.length === 0
        ) {

            return false;

        }


        /**
         * ---------------------------------------------------------------
         * Rule 2 — Positive authorization invariant
         * ---------------------------------------------------------------
         *
         * Every result must represent an unequivocally successful validation.
         */
        return results.every(
            result =>

                result.passed === true &&

                result.status ===
                    ValidationStatus.PASSED &&

                result.severity ===
                    ValidationSeverity.INFO &&

                result.errorCode ===
                    ValidationErrorCode.NONE
        );

    }

}


/**
 * =============================================================================
 * Canonical Gateway Instance
 * =============================================================================
 *
 * Application code should use this instance.
 *
 * Do NOT create separate gateways throughout the application.
 * =============================================================================
 */
export const validationGateway =
    new ValidationGateway();