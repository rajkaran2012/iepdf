/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : fontValidator.ts
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
    FontDetector
} from "../detectors/fontDetector";

export class FontValidator
    extends BaseValidator {

    public override readonly name =
        "FontValidator";

    public override readonly description =
        "Validates PDF font resource references.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.FONT;

    protected override readonly priority =
        250;

    private readonly fontDetector =
        new FontDetector();

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.fontDetector.detect(
                context.file
            );

        if (
            !result.validFont
        ) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_FONT,
                result.reason ??
                    "Invalid PDF font structure."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            `Valid PDF font resources (${result.fontCount ?? 0} fonts detected).`
        );

    }

}
