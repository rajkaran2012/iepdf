/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : fileNameValidator.ts
 * Module      : Boundary Validation
 * Layer       : Browser Engine
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates uploaded file name.
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

export class FileNameValidator extends BaseValidator {

    public override readonly name = "FileNameValidator";

    public override readonly description =
        "Validates uploaded file name.";

    public override readonly gate =
        ValidationGate.BOUNDARY;

    public override readonly rule =
        ValidationRule.FILE_NAME;

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

        const fileName =
            context.file.name.trim();

        ValidationLogger.debug(
            this.name,
            `Checking file name (${fileName}).`,
            {
                fileName,
            }
        );

        /* Empty */

        if (fileName.length === 0) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.FAILED,
                passed: false,
                severity: ValidationSeverity.ERROR,
                errorCode: ValidationErrorCode.EMPTY_FILE_NAME,
                message: messages.EMPTY_FILE_NAME,
            });

        }

        /* Maximum Length */

        if (fileName.length > boundary.MAX_FILENAME_LENGTH) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.FAILED,
                passed: false,
                severity: ValidationSeverity.ERROR,
                errorCode: ValidationErrorCode.FILE_NAME_TOO_LONG,
                message: messages.FILE_NAME_TOO_LONG,
            });

        }

        /* Invalid Characters */

        if (
            boundary.INVALID_FILE_NAME_CHARACTERS.test(fileName)
        ) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.FAILED,
                passed: false,
                severity: ValidationSeverity.ERROR,
                errorCode: ValidationErrorCode.INVALID_FILE_NAME,
                message: messages.INVALID_FILE_NAME_CHARACTER,
            });

        }

        /* Path Traversal */

        if (
            fileName.includes("../") ||
            fileName.includes("..\\")
        ) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.FAILED,
                passed: false,
                severity: ValidationSeverity.ERROR,
                errorCode: ValidationErrorCode.PATH_TRAVERSAL,
                message: messages.PATH_TRAVERSAL_DETECTED,
            });

        }

        /* Reserved Name */

        const baseName =
            fileName.split(".")[0].toUpperCase();

        if (
            boundary.RESERVED_FILE_NAMES.includes(baseName)
        ) {

            return this.createResult({
                startedAt,
                timer,
                status: ValidationStatus.FAILED,
                passed: false,
                severity: ValidationSeverity.ERROR,
                errorCode: ValidationErrorCode.RESERVED_FILE_NAME,
                message: messages.RESERVED_FILE_NAME,
            });

        }

        return this.createResult({
            startedAt,
            timer,
            status: ValidationStatus.PASSED,
            passed: true,
            severity: ValidationSeverity.INFO,
            errorCode: ValidationErrorCode.NONE,
            message: messages.FILE_NAME_VALIDATION_PASSED,
        });

    }

}