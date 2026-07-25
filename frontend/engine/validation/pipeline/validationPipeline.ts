/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : validationPipeline.ts
 * Module      : Validation Pipeline
 * Layer       : Pipeline
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Master Validation Pipeline.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Executes Validation Gates in order
 * • Collects Validation Results
 * • Stops validation when required
 * • Returns immutable validation results
 *
 * Gate Order
 * -----------------------------------------------------------------------------
 * 1. Boundary Validation
 * 2. Security Validation
 * 3. Deep Validation
 *
 * =============================================================================
 */

import { ValidationContext } from "./validationContext";
import { ValidationResult } from "./validationResult";

import { ValidationLogger } from "../common/validationLogger";
import { BoundaryValidatorRegistry } from "../boundary/boundaryRegistry";
import { ValidationContextFactory } from "./ValidationContextFactory";
import type { ToolType } from "@/lib/validationTypes";

export class ValidationPipeline {

    /**
     * =========================================================================
     * Execute Validation Pipeline
     * =========================================================================
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

    ValidationLogger.group("Validation Pipeline");

    const results: ValidationResult[] = [];

    try {

        await this.executeBoundaryValidation(
            context,
            results
        );

        return Object.freeze(results);

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
                validatorCount: validators.length,
            }
        );

        for (const validator of validators) {

            const result =
                await validator.validate(context);

            results.push(result);

            if (!result.passed) {

                ValidationLogger.warn(
                    this.constructor.name,
                    "Boundary validation failed.",
                    {
                        validator: validator.name,
                        rule: validator.rule,
                        error: result.errorCode,
                    }
                );

                /*
                 * Fail Fast
                 *
                 * Stop immediately after the
                 * first Boundary validation failure.
                 */

                break;

            }

        }

    }

}