/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : validationPipeline.ts
 * Module      : Validation Pipeline
 * Layer       : Pipeline
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Master Validation Pipeline.
 *
 * Gate execution order:
 *
 *     1. Boundary
 *     2. Security
 *     3. Deep
 *
 * A later gate MUST NEVER execute when an earlier gate has failed.
 *
 * =============================================================================
 * Security Model
 * =============================================================================
 *
 * FAIL CLOSED.
 *
 * Boundary failure:
 *
 *     STOP
 *
 * Security failure:
 *
 *     STOP
 *
 * Deep failure:
 *
 *     STOP
 *
 * Empty validation result:
 *
 *     Gateway decides FAIL CLOSED.
 *
 * =============================================================================
 */

import type { ValidationContext } from "./validationContext";
import type { ValidationResult } from "./validationResult";
import type { ToolType } from "@/lib/validationTypes";

import {
    ValidationLogger
} from "../common/validationLogger";

import {
    BoundaryValidatorRegistry
} from "../boundary/boundaryRegistry";

import {
    SecurityValidatorRegistry
} from "../security/securityRegistry";

import {
    DeepValidatorRegistry
} from "../deep/validators/deepRegistry";

import {
    ValidationContextFactory
} from "./ValidationContextFactory";

export class ValidationPipeline {

    /**
     * =========================================================================
     * Execute Complete Validation Pipeline
     * =========================================================================
     *
     * Gate order:
     *
     * Boundary → Security → Deep
     */
    public async execute(
        files: ReadonlyArray<File>,
        file: File,
        toolType: ToolType
    ): Promise<readonly ValidationResult[]> {

        const context =
            ValidationContextFactory.create(
                files,
                file,
                toolType
            );

        ValidationLogger.group(
            "Validation Pipeline"
        );

        const results:
            ValidationResult[] = [];

        try {

            /**
             * ================================================================
             * Gate 1 — Boundary Validation
             * ================================================================
             */
            await this.executeBoundaryValidation(
                context,
                results
            );

            /**
             * Fail closed.
             *
             * Do NOT continue to Security if Boundary failed.
             */
            if (
                this.hasFailure(results)
            ) {

                return Object.freeze(
                    [...results]
                );

            }

            /**
             * ================================================================
             * Gate 2 — Security Validation
             * ================================================================
             */
            await this.executeSecurityValidation(
                context,
                results
            );

            /**
             * Fail closed.
             *
             * Do NOT continue to Deep if Security failed.
             */
            if (
                this.hasFailure(results)
            ) {

                return Object.freeze(
                    [...results]
                );

            }

            /**
             * ================================================================
             * Gate 3 — Deep Validation
             * ================================================================
             */
            await this.executeDeepValidation(
                context,
                results
            );

            /**
             * ================================================================
             * Final immutable result
             * ================================================================
             */
            return Object.freeze(
                [...results]
            );

        } finally {

            ValidationLogger.groupEnd();

        }

    }

    /**
     * =========================================================================
     * Boundary Validation
     * =========================================================================
     */
    private async executeBoundaryValidation(
        context: ValidationContext,
        results: ValidationResult[]
    ): Promise<void> {

        const validators =
            BoundaryValidatorRegistry.getValidators();

        ValidationLogger.info(
            this.constructor.name,
            "Executing Boundary Validation",
            {
                validatorCount:
                    validators.length,
            }
        );

        for (
            const validator
            of validators
        ) {

            const result =
                await validator.validate(
                    context
                );

            results.push(result);

            if (
                !result.passed
            ) {

                ValidationLogger.warn(
                    this.constructor.name,
                    "Boundary validation failed.",
                    {
                        validator:
                            validator.name,

                        rule:
                            validator.rule,

                        error:
                            result.errorCode,
                    }
                );

                /**
                 * Fail Fast.
                 */
                break;

            }

        }

    }

    /**
     * =========================================================================
     * Security Validation
     * =========================================================================
     */
    private async executeSecurityValidation(
        context: ValidationContext,
        results: ValidationResult[]
    ): Promise<void> {

        const validators =
            SecurityValidatorRegistry.getValidators();

        ValidationLogger.info(
            this.constructor.name,
            "Executing Security Validation",
            {
                validatorCount:
                    validators.length,
            }
        );

        for (
            const validator
            of validators
        ) {

            const result =
                await validator.validate(
                    context
                );

            results.push(result);

            if (
                !result.passed
            ) {

                ValidationLogger.warn(
                    this.constructor.name,
                    "Security validation failed.",
                    {
                        validator:
                            validator.name,

                        rule:
                            validator.rule,

                        error:
                            result.errorCode,
                    }
                );

                /**
                 * Fail Fast.
                 */
                break;

            }

        }

    }

    /**
     * =========================================================================
     * Deep Validation
     * =========================================================================
     *
     * Current implemented Deep rules:
     *
     * - Header
     * - Version
     *
     * Additional Deep rules will be registered as their detectors become
     * production-ready.
     */
    private async executeDeepValidation(
        context: ValidationContext,
        results: ValidationResult[]
    ): Promise<void> {

        const validators =
            DeepValidatorRegistry.getValidators();

        ValidationLogger.info(
            this.constructor.name,
            "Executing Deep Validation",
            {
                validatorCount:
                    validators.length,
            }
        );

        for (
            const validator
            of validators
        ) {

            const result =
                await validator.validate(
                    context
                );

            results.push(result);

            if (
                !result.passed
            ) {

                ValidationLogger.warn(
                    this.constructor.name,
                    "Deep validation failed.",
                    {
                        validator:
                            validator.name,

                        rule:
                            validator.rule,

                        error:
                            result.errorCode,
                    }
                );

                /**
                 * Fail Fast.
                 */
                break;

            }

        }

    }

    /**
     * =========================================================================
     * Failure Detection
     * =========================================================================
     */
    private hasFailure(
        results: ReadonlyArray<ValidationResult>
    ): boolean {

        return results.some(
            result =>
                result.passed === false
        );

    }

}