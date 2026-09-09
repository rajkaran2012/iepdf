/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : fileCountValidator.ts
 * Module      : Boundary Validation
 * Layer       : Browser Engine
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates uploaded file count.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Validate uploaded file count
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
import { TOOL_RULES } from "@/lib/validation/toolRules";

export class FileCountValidator extends BaseValidator {

    public override readonly name =
        "FileCountValidator";

    public override readonly description =
        "Validates uploaded file count.";

    public override readonly gate =
        ValidationGate.BOUNDARY;

    public override readonly rule =
        ValidationRule.FILE_COUNT;

    protected override readonly priority =
        ValidationConstants.VALIDATION_PRIORITY.HIGH;

    protected override async execute(
    context: ValidationContext,
    startedAt: Date,
    timer: number
): Promise<ValidationResult> {

    const rules =
        TOOL_RULES[context.toolType];

    const messages =
        ValidationConstants.VALIDATION_MESSAGES;

    const fileCount =
        context.fileCount;

    ValidationLogger.debug(
        this.name,
        `Checking file count (${fileCount}).`,
        {
            fileCount,
            minFiles: rules.minFiles,
            maxFiles: rules.maxFiles,
            toolType: context.toolType,
        }
    );

    if (fileCount < rules.minFiles) {

        return this.createResult({
            startedAt,
            timer,
            status: ValidationStatus.FAILED,
            passed: false,
            severity: ValidationSeverity.ERROR,
            errorCode: ValidationErrorCode.INVALID_FILE_COUNT,
            message:
                messages.INVALID_FILE_COUNT,
            details:
                `Minimum=${rules.minFiles}; Actual=${fileCount}`,
        });

    }

    if (fileCount > rules.maxFiles) {

        return this.createResult({
            startedAt,
            timer,
            status: ValidationStatus.FAILED,
            passed: false,
            severity: ValidationSeverity.ERROR,
            errorCode: ValidationErrorCode.INVALID_FILE_COUNT,
            message:
                messages.INVALID_FILE_COUNT,
            details:
                `Maximum=${rules.maxFiles}; Actual=${fileCount}`,
        });

    }

    return this.createResult({
        startedAt,
        timer,
        status: ValidationStatus.PASSED,
        passed: true,
        severity: ValidationSeverity.INFO,
        errorCode: ValidationErrorCode.NONE,
        message:
            messages.FILE_COUNT_VALIDATION_PASSED,
    });

    }

}