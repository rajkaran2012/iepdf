/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : fileSizeValidator.ts
 * Module      : Boundary Validation
 * Layer       : Browser Engine
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates uploaded file size.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Validate uploaded file size
 * ✓ Fail Fast
 * ✓ Browser First
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

export class FileSizeValidator extends BaseValidator {

    public override readonly name = "FileSizeValidator";

    public override readonly description =
        "Validates uploaded file size.";

    public override readonly gate =
        ValidationGate.BOUNDARY;

    public override readonly rule =
        ValidationRule.FILE_SIZE;

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

        const fileSize = context.file.size;

        const maxFileSize =
            boundary.MAX_FILE_SIZE_BYTES;

        ValidationLogger.debug(
            this.name,
            `Checking file size (${fileSize} bytes).`,
            {
                fileSize,
                maxFileSize,
            }
        );

        if (fileSize <= maxFileSize) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.PASSED,
                passed: true,
                severity: ValidationSeverity.INFO,
                errorCode: ValidationErrorCode.NONE,
                message:
                    messages.FILE_SIZE_VALIDATION_PASSED,
            });

        }

        ValidationLogger.warn(
            this.name,
            "File exceeds maximum allowed size.",
            {
                fileSize,
                maxFileSize,
            }
        );

        return this.createResult({
            startedAt,
            timer,
            status: ValidationStatus.FAILED,
            passed: false,
            severity: ValidationSeverity.ERROR,
            errorCode:
                ValidationErrorCode.FILE_TOO_LARGE,
            message:
                messages.FILE_TOO_LARGE,
            details:
                `Actual=${fileSize}B; Limit=${maxFileSize}B`,
        });

    }

}