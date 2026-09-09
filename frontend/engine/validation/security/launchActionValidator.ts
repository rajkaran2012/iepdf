/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : launchActionValidator.ts
 * Module     : Security Validation
 * Layer      : Security Gate
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates whether a PDF document contains Launch Actions.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Executes the Launch Action validation rule.
 * • Produces a ValidationResult.
 *
 * It MUST NOT:
 * • Open PDF documents
 * • Read PDF internals
 * • Detect Launch Actions directly
 * • Perform low-level PDF analysis
 *
 * Those responsibilities belong to dedicated detector classes.
 * =============================================================================
 */

import { BaseValidator } from "../common/baseValidator";

import type { ValidationContext } from "../pipeline/validationContext";
import type { ValidationResult } from "../pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
} from "../pipeline/validationTypes";

import type {
    ILaunchActionDetector
} from "./interfaces/ILaunchActionDetector";

export class LaunchActionValidator
extends BaseValidator {

    public override readonly name =
        "LaunchActionValidator";

    public override readonly description =
        "Validates whether the PDF contains Launch Actions.";

    public override readonly gate =
        ValidationGate.SECURITY;

    public override readonly rule =
        ValidationRule.LAUNCH_ACTION;

    protected override readonly priority = 120;

    public constructor(

        private readonly launchActionDetector:
            ILaunchActionDetector

    ) {

        super();

    }

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.launchActionDetector.detect(
                context.file
            );

        if (result.hasLaunchActions) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.LAUNCH_ACTION_DETECTED,
                "PDF contains Launch Actions."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            "No Launch Actions detected."
        );

    }

}