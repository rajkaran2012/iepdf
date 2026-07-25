/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : extensionValidator.ts
 * Module      : Boundary Validation
 * Layer       : Browser Engine
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates uploaded file extension.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Validate file extension
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

export class ExtensionValidator extends BaseValidator {

    public override readonly name = "ExtensionValidator";

    public override readonly description =
        "Validates uploaded file extension.";

    public override readonly gate =
        ValidationGate.BOUNDARY;

    public override readonly rule =
        ValidationRule.EXTENSION;

    protected override readonly priority =
        ValidationConstants.VALIDATION_PRIORITY.NORMAL;

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const messages =
            ValidationConstants.VALIDATION_MESSAGES;

        const fileName = context.file.name;

        const extension =
            fileName.substring(fileName.lastIndexOf("."))
                .toLowerCase();

        const allowedExtensions = [".pdf"];

        ValidationLogger.debug(
            this.name,
            `Checking extension (${extension}).`,
            {
                fileName,
                extension,
            }
        );

        if (allowedExtensions.includes(extension)) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.PASSED,
                passed: true,
                severity: ValidationSeverity.INFO,
                errorCode: ValidationErrorCode.NONE,
                message:
                    messages.PASSED,
            });

        }

        ValidationLogger.warn(
            this.name,
            "Invalid file extension.",
            {
                extension,
            }
        );

        return this.createResult({
            startedAt,
            timer,
            status: ValidationStatus.FAILED,
            passed: false,
            severity: ValidationSeverity.ERROR,
            errorCode:
                ValidationErrorCode.INVALID_EXTENSION,
            message:
                "Only PDF files are allowed.",
            details:
                `Received Extension=${extension}`,
        });

    }

}