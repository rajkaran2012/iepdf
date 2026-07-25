/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : javaScriptValidator.ts
 * Module     : Security Validation
 * Layer      : Security Gate
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates whether a PDF document contains JavaScript.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Executes the JavaScript validation rule.
 * • Produces a ValidationResult.
 *
 * It MUST NOT:
 * • Open PDF documents
 * • Read PDF internals
 * • Detect JavaScript directly
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
    IJavaScriptDetector
} from "./interfaces/IJavaScriptDetector";

export class JavaScriptValidator
extends BaseValidator {

    public override readonly name =
        "JavaScriptValidator";

    public override readonly description =
        "Validates whether the PDF contains JavaScript.";

    public override readonly gate =
        ValidationGate.SECURITY;

    public override readonly rule =
        ValidationRule.JAVASCRIPT;

    protected override readonly priority = 110;

    public constructor(

        private readonly javaScriptDetector:
            IJavaScriptDetector

    ) {

        super();

    }

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.javaScriptDetector.detect(
                context.file
            );

        if (result.hasJavaScript) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.JAVASCRIPT_DETECTED,
                "PDF contains JavaScript."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            "No JavaScript detected."
        );

    }

}