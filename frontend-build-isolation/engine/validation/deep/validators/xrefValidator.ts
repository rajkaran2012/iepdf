/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : xrefValidator.ts
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
    XrefDetector
} from "../detectors/xrefDetector";

export class XrefValidator
    extends BaseValidator {

    public override readonly name =
        "XrefValidator";

    public override readonly description =
        "Validates the PDF cross-reference structure.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.XREF;

    protected override readonly priority =
        220;

    private readonly xrefDetector =
        new XrefDetector();

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.xrefDetector.detect(
                context.file
            );

        if (!result.validXref) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_XREF,
                result.reason ??
                    "Invalid PDF cross-reference structure."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            `Valid PDF XRef table (${result.entryCount} entries).`
        );

    }

}
