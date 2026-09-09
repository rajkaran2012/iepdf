/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : mimeTypeValidator.ts
 * Module      : Boundary Validation
 * Layer       : Browser Engine
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates uploaded file MIME type.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Validate browser reported MIME type
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

export class MimeTypeValidator extends BaseValidator {

    public override readonly name = "MimeTypeValidator";

    public override readonly description =
        "Validates uploaded file MIME type.";

    public override readonly gate =
        ValidationGate.BOUNDARY;

    public override readonly rule =
        ValidationRule.MIME_TYPE;

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

        const mimeType =
            context.file.type || boundary.DEFAULT_MIME;

        const allowedMimeTypes =
            boundary.ALLOWED_MIME_TYPES;

        ValidationLogger.debug(
            this.name,
            `Checking MIME type (${mimeType}).`,
            {
                mimeType,
                allowedMimeTypes,
            }
        );

        if (allowedMimeTypes.includes(mimeType)) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.PASSED,
                passed: true,
                severity: ValidationSeverity.INFO,
                errorCode: ValidationErrorCode.NONE,
                message:
                    messages.MIME_VALIDATION_PASSED,
            });

        }

        ValidationLogger.warn(
            this.name,
            "Invalid MIME type.",
            {
                mimeType,
                allowedMimeTypes,
            }
        );

        return this.createResult({
            startedAt,
            timer,
            status: ValidationStatus.FAILED,
            passed: false,
            severity: ValidationSeverity.ERROR,
            errorCode:
                ValidationErrorCode.INVALID_MIME_TYPE,
            message:
                messages.INVALID_MIME_TYPE,
            details:
                `Received MIME=${mimeType}`,
        });

    }

}