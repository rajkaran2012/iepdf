import type { ValidationContext } from "../pipeline/validationContext";
import type { ValidationResult } from "../pipeline/validationResult";
import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
} from "../pipeline/validationTypes";
import { BaseValidator } from "../common/baseValidator";

export class ExtensionValidator extends BaseValidator {

    public readonly gate = ValidationGate.BOUNDARY;
    public readonly rule = ValidationRule.EXTENSION;
    public readonly name = "Extension Validator";
    public readonly description =
        "Validates whether the file extension is allowed for the selected tool.";
    public readonly enabled = true;

    protected async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const fileName =
            context.file.name;

        const extension =
            fileName.substring(
                fileName.lastIndexOf(".")
            ).toLowerCase();

        const allowedExtensions =
            context.toolType === "jpg-to-pdf"
                ? [".jpg", ".jpeg", ".png"]
                : [".pdf"];

        if (
            allowedExtensions.includes(extension)
        ) {

            return this.createSuccessResult(
                startedAt,
                timer,
                "File extension is valid.",
                `Extension="${extension}", Tool="${context.toolType}"`
            );

        }

        return this.createFailureResult(
            startedAt,
            timer,
            ValidationErrorCode.INVALID_EXTENSION,
            context.toolType === "jpg-to-pdf"
                ? "Only JPG, JPEG, and PNG files are allowed."
                : "Only PDF files are allowed.",
            `Extension="${extension}", Tool="${context.toolType}"`
        );

    }

}
