/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : encryptionValidator.ts
 * Module     : Security Validation
 * Layer      : Security Gate
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates whether a PDF document uses encryption.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Executes the Encryption validation rule.
 * • Produces a ValidationResult.
 *
 * It MUST NOT:
 * • Open PDF documents
 * • Read PDF internals
 * • Detect encryption directly
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
    IEncryptionDetector
} from "./interfaces/IEncryptionDetector";

export class EncryptionValidator
extends BaseValidator {

    public override readonly name =
        "EncryptionValidator";

    public override readonly description =
        "Validates whether the PDF is encrypted.";

    public override readonly gate =
        ValidationGate.SECURITY;

    public override readonly rule =
        ValidationRule.ENCRYPTION;

    protected override readonly priority = 140;

    public constructor(

        private readonly encryptionDetector:
            IEncryptionDetector

    ) {

        super();

    }

    protected override async execute(
    context: ValidationContext,
    startedAt: Date,
    timer: number
): Promise<ValidationResult> {

    const result =
        await this.encryptionDetector.detect(
            context.file
        );

    if (result.encrypted) {

        return this.createFailureResult(
            startedAt,
            timer,
            ValidationErrorCode.ENCRYPTED_DOCUMENT,
            "PDF is encrypted."
        );

    }

    return this.createSuccessResult(
        startedAt,
        timer,
        "PDF is not encrypted."
    );

}

}