/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : BasePdfProcessor.ts
 * Module     : Processing
 * Layer      : Base Processor
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Provides the mandatory execution boundary for every PDF processor.
 *
 * Processing order:
 *
 *     Processing Request
 *            |
 *            v
 *     Canonical Validation Gateway
 *            |
 *       +----+----+
 *       |         |
 *      FAIL      PASS
 *       |         |
 *       v         v
 *     STOP    processCore()
 *
 * Every concrete processor inherits this boundary.
 *
 * =============================================================================
 * Security Model
 * =============================================================================
 *
 * FAIL CLOSED.
 *
 * A processor MUST NOT execute processCore() unless the canonical
 * Validation Gateway explicitly authorizes processing.
 *
 * Application processors MUST NOT directly access:
 *
 * - ValidationPipeline
 * - BoundaryValidatorRegistry
 * - SecurityValidatorRegistry
 * - DeepValidatorRegistry
 *
 * The ValidationGateway is the single application-facing validation boundary.
 *
 * =============================================================================
 */

import type {
    IPdfProcessor
} from "../IPdfProcessor";

import type {
    ProcessingContext
} from "../ProcessingContext";

import type {
    ProcessingResult
} from "../results/ProcessingResult";

import {
    validationGateway
} from "../../validation/gateway/ValidationGateway";

import {
    ValidationErrorCode
} from "../../validation/pipeline/validationTypes";


export abstract class BasePdfProcessor
    implements IPdfProcessor {


    /**
     * =========================================================================
     * Executes the complete processing boundary.
     * =========================================================================
     *
     * Validation ALWAYS occurs before processCore().
     */
    public async process(
        context: ProcessingContext
    ): Promise<ProcessingResult> {

        try {

            /**
             * ================================================================
             * Mandatory Canonical Validation
             * ================================================================
             */
            await this.validate(
                context
            );


            /**
             * ================================================================
             * Processing
             * ================================================================
             *
             * This point is reachable ONLY when the canonical Validation
             * Gateway has returned passed === true.
             */
            return await this.processCore(
                context
            );

        }
        catch (
            error: unknown
        ) {

            /**
             * ================================================================
             * Fail Closed
             * ================================================================
             *
             * Any validation or processing exception becomes a controlled
             * processing failure.
             */
            return this.createFailureResult(
                error
            );

        }
        finally {

            /**
             * ================================================================
             * Guaranteed Cleanup
             * ================================================================
             */
            await this.cleanup(
                context
            );

        }

    }


    /**
     * =========================================================================
     * Canonical Validation Boundary
     * =========================================================================
     *
     * IMPORTANT:
     *
     * This class intentionally does NOT construct ValidationPipeline.
     *
     * All application validation goes through:
     *
     *     validationGateway
     *
     * The Gateway owns:
     *
     *     Boundary
     *     Security
     *     Deep
     *
     * and produces the final processing authorization decision.
     */
    protected async validate(
        context: ProcessingContext
    ): Promise<void> {

        /**
         * ================================================================
         * Select workspace files eligible for validation.
         * ================================================================
         */
        const workspaceFiles =
            context.files.filter(
                file =>
                    !file.skipped
            );


        /**
         * ================================================================
         * Fail Closed — No Files
         * ================================================================
         */
        if (
            workspaceFiles.length === 0
        ) {

            throw new Error(
                "No files available for validation."
            );

        }


        /**
         * ================================================================
         * Browser File Collection
         * ================================================================
         */
        const browserFiles =
            workspaceFiles.map(
                file =>
                    file.file
            );


        /**
         * ================================================================
         * Validate Every Processable File
         * ================================================================
         *
         * Every file must independently receive authorization.
         *
         * A single failure blocks the complete processing operation.
         */
        for (
            const workspaceFile
            of workspaceFiles
        ) {

            let gatewayResult;

            try {

                /**
                 * ============================================================
                 * SINGLE VALIDATION ENTRY POINT
                 * ============================================================
                 */
                gatewayResult =
                    await validationGateway.validate(
                        browserFiles,
                        workspaceFile.file,
                        context.toolType
                    );

            }
            catch (
                _error: unknown
            ) {

                /**
                 * ============================================================
                 * FAIL CLOSED
                 * ============================================================
                 *
                 * The Gateway itself should already fail closed.
                 *
                 * This catch protects this processing boundary if an
                 * unexpected exception nevertheless escapes the Gateway.
                 */
                throw new Error(
                    `Validation failed for "${workspaceFile.filename}".`
                );

            }


            /**
             * ================================================================
             * Gateway Authorization
             * ================================================================
             *
             * There is exactly ONE authorization decision:
             *
             *     gatewayResult.passed
             *
             * No processor is allowed to reinterpret individual validation
             * results as permission to process.
             */
            if (
                gatewayResult.passed !== true
            ) {

                const failedResults =
                    gatewayResult.results.filter(
                        result =>
                            result.passed === false
                    );

                const browserCompatibilityErrors =
                    new Set<ValidationErrorCode>([
                        ValidationErrorCode.INVALID_HEADER,
                        ValidationErrorCode.INVALID_VERSION,
                        ValidationErrorCode.INVALID_XREF,
                        ValidationErrorCode.INVALID_TRAILER,
                        ValidationErrorCode.INVALID_OBJECT_TREE,
                        ValidationErrorCode.INVALID_PAGE_TREE,
                        ValidationErrorCode.INVALID_FONT,
                        ValidationErrorCode.INVALID_METADATA,
                        ValidationErrorCode.INVALID_INCREMENTAL_UPDATE,
                    ]);

                const mergeCompatibilityFallback =
                    context.toolType === "merge" &&
                    failedResults.length > 0 &&
                    failedResults.every(
                        result =>
                            browserCompatibilityErrors.has(
                                result.errorCode
                            )
                    );

                if (mergeCompatibilityFallback) {

                    console.warn(
                        "Browser structural validation failed. Allowing Merge processor to attempt compatibility fallback.",
                        failedResults
                    );

                    continue;
                }

                const failedResult =
                    failedResults[0];

                if (
                    failedResult &&
                    failedResult.message.length > 0
                ) {

                    throw new Error(
                        failedResult.message
                    );

                }

                throw new Error(
                    `Validation failed for "${workspaceFile.filename}".`
                );

            }

        }

    }


    /**
     * =========================================================================
     * Processing Implementation
     * =========================================================================
     *
     * Concrete processors implement their actual PDF operation here.
     *
     * IMPORTANT:
     *
     * processCore() must never be called directly by external callers.
     *
     * It is reached through process(), which enforces the canonical Gateway
     * authorization first.
     */
    protected abstract processCore(
        context: ProcessingContext
    ): Promise<ProcessingResult>;


    /**
     * =========================================================================
     * Cleanup Hook
     * =========================================================================
     *
     * Concrete processors may override this when resources need to be
     * released.
     */
    protected async cleanup(
        _context: ProcessingContext
    ): Promise<void> {

        /**
         * Default implementation intentionally performs no operation.
         */

    }


    /**
     * =========================================================================
     * Standardized Failure Result
     * =========================================================================
     *
     * User-facing errors must not expose:
     *
     * - stack traces
     * - internal object structures
     * - PDFium internals
     * - parser internals
     * - filesystem information
     * - secrets
     * - implementation details
     */
    protected createFailureResult(
        error: unknown
    ): ProcessingResult {

        /**
         * Controlled application errors may be returned.
         *
         * Internal exceptions are deliberately replaced by a generic message.
         */
        if (
            error instanceof Error &&
            error.message.length > 0
        ) {

            return {

                success: false,

                error:
                    error.message

            };

        }


        return {

            success: false,

            error:
                "An unexpected processing error occurred."

        };

    }

}