/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : metadataValidator.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Gate
 * =============================================================================
 */

import { BaseValidator } from "../../common/baseValidator";

import type {
    ValidationContext
} from "../../pipeline/validationContext";

import type {
    ValidationResult
} from "../../pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule
} from "../../pipeline/validationTypes";

import {
    MetadataDetector
} from "../detectors/metadataDetector";

export class MetadataValidator
    extends BaseValidator {

    public override readonly name =
        "MetadataValidator";

    public override readonly description =
        "Validates PDF metadata structures and references.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.METADATA;

    protected override readonly priority =
        260;

    private readonly metadataDetector =
        new MetadataDetector();

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.metadataDetector.detect(
                context.file
            );

        if (
            !result.validMetadata
        ) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_METADATA,
                result.reason ??
                    "Invalid PDF metadata structure."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            `Valid PDF metadata (${result.metadataObjectCount ?? 0} metadata objects detected).`
        );

    }

}
