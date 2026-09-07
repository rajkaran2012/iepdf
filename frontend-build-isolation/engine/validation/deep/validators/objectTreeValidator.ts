/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : objectTreeValidator.ts
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
    ObjectTreeDetector
} from "../detectors/objectTreeDetector";

export class ObjectTreeValidator
    extends BaseValidator {

    public override readonly name =
        "ObjectTreeValidator";

    public override readonly description =
        "Validates the PDF indirect object tree.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.OBJECT_TREE;

    protected override readonly priority =
        240;

    private readonly objectTreeDetector =
        new ObjectTreeDetector();

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.objectTreeDetector.detect(
                context.file
            );

        if (!result.validObjectTree) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_OBJECT_TREE,
                result.reason ??
                    "Invalid PDF object tree structure."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            `Valid PDF object tree (${result.objectCount} objects, Root ${result.rootObjectNumber} ${result.rootGenerationNumber} R).`
        );

    }

}
