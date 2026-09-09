/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : passwordProtectionValidator.ts
 * Module     : Security Validation
 * Layer      : Security Gate
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates whether a PDF document is password protected.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Executes the Password Protection validation rule.
 * • Produces a ValidationResult.
 *
 * It MUST NOT:
 * • Open PDF documents
 * • Read PDF internals
 * • Detect encryption
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
    IPasswordDetector
} from "./interfaces/IPasswordDetector";

export class PasswordProtectionValidator
extends BaseValidator {

    public override readonly name =
        "PasswordProtectionValidator";

    public override readonly description =
        "Validates whether the PDF is password protected.";

    public override readonly gate =
        ValidationGate.SECURITY;

    public override readonly rule =
        ValidationRule.PASSWORD_PROTECTION;

    protected override readonly priority = 100;

    public constructor(

        private readonly passwordDetector:
            IPasswordDetector

    ) {

        super();

    }

   protected override async execute(
    context: ValidationContext,
    startedAt: Date,
    timer: number
): Promise<ValidationResult> {

    const result =
        await this.passwordDetector.detect(
            context.file
        );

    if (result.isPasswordProtected) {

        return this.createFailureResult(
            startedAt,
            timer,
            ValidationErrorCode.PASSWORD_PROTECTED,
            "PDF is password protected."
        );

    }

    return this.createSuccessResult(
        startedAt,
        timer,
        "PDF is not password protected."
     );

}

}