/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : pageTreeValidator.ts
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
    PageTreeDetector
} from "../detectors/pageTreeDetector";

export class PageTreeValidator
    extends BaseValidator {

    public override readonly name =
        "PageTreeValidator";

    public override readonly description =
        "Validates the PDF Page Tree.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.PAGE_TREE;

    protected override readonly priority =
        250;

    private readonly pageTreeDetector =
        new PageTreeDetector();

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.pageTreeDetector.detect(
                context.file
            );

        if (!result.validPageTree) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_PAGE_TREE,
                result.reason ??
                    "Invalid PDF Page Tree structure."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            `Valid PDF Page Tree (${result.pageCount} pages, Root /Pages ${result.rootPagesObjectNumber} ${result.rootPagesGenerationNumber} R).`
        );

    }

}
