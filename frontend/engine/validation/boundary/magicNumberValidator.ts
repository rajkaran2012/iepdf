/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : magicNumberValidator.ts
 * Module      : Boundary Validation
 * Layer       : Browser Engine
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates the PDF file signature (Magic Number).
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Read first bytes of uploaded file
 * ✓ Verify PDF signature
 * ✓ Browser First
 * ✓ Fail Fast
 * ✓ Immutable Validation Result
 * ✓ Enterprise Logging
 *
 * =============================================================================
 */

import { BaseValidator } from "../common/baseValidator";

import type { ValidationContext } from "../pipeline/validationContext";
import type { ValidationResult } from "../pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
    ValidationSeverity,
    ValidationStatus,
} from "../pipeline/validationTypes";

import ValidationConstants from "../common/validationConstants";
import ValidationLogger from "../common/validationLogger";

export class MagicNumberValidator extends BaseValidator {

    public override readonly name = "MagicNumberValidator";

    public override readonly description =
        "Validates PDF file signature.";

    public override readonly gate =
        ValidationGate.BOUNDARY;

    public override readonly rule =
        ValidationRule.MAGIC_NUMBER;

    protected override readonly priority =
        ValidationConstants.VALIDATION_PRIORITY.NORMAL;

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const boundary =
            ValidationConstants.BOUNDARY_VALIDATION;

        const messages =
            ValidationConstants.VALIDATION_MESSAGES;

        const file = context.file;

        const headerBuffer = await file
            .slice(0, boundary.PDF_MAGIC_NUMBER_LENGTH)
            .arrayBuffer();

        const header = new TextDecoder().decode(headerBuffer);

        ValidationLogger.debug(
            this.name,
            `Checking PDF signature (${header}).`,
            {
                expected: boundary.PDF_MAGIC_NUMBER,
                actual: header,
            }
        );

        if (header === boundary.PDF_MAGIC_NUMBER) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.PASSED,
                passed: true,
                severity: ValidationSeverity.INFO,
                errorCode: ValidationErrorCode.NONE,
                message:
                    messages.MAGIC_NUMBER_VALIDATION_PASSED,
            });

        }

        ValidationLogger.warn(
            this.name,
            "Invalid PDF signature.",
            {
                expected: boundary.PDF_MAGIC_NUMBER,
                actual: header,
            }
        );

        return this.createResult({
            startedAt,
            timer,
            status: ValidationStatus.FAILED,
            passed: false,
            severity: ValidationSeverity.ERROR,
            errorCode:
                ValidationErrorCode.INVALID_MAGIC_NUMBER,
            message:
                messages.INVALID_MAGIC_NUMBER,
            details:
                `Expected="${boundary.PDF_MAGIC_NUMBER}", Actual="${header}"`,
        });

    }

}