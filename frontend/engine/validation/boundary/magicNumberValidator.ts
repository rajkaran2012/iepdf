import type { ValidationContext } from "../pipeline/validationContext";
import type { ValidationResult } from "../pipeline/validationResult";
import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
} from "../pipeline/validationTypes";
import { BaseValidator } from "../common/baseValidator";

export class MagicNumberValidator extends BaseValidator {

    public readonly gate = ValidationGate.BOUNDARY;
    public readonly rule = ValidationRule.MAGIC_NUMBER;
    public readonly name = "Magic Number Validator";
    public readonly description =
        "Validates the file signature against the expected format for the selected tool.";
    public readonly enabled = true;

    protected async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const file =
            context.file;

        if (context.toolType === "jpg-to-pdf") {

            const headerBuffer =
                await file
                    .slice(0, 8)
                    .arrayBuffer();

            const bytes =
                new Uint8Array(headerBuffer);

            const isJpeg =
                bytes.length >= 3 &&
                bytes[0] === 0xFF &&
                bytes[1] === 0xD8 &&
                bytes[2] === 0xFF;

            const isPng =
                bytes.length >= 8 &&
                bytes[0] === 0x89 &&
                bytes[1] === 0x50 &&
                bytes[2] === 0x4E &&
                bytes[3] === 0x47 &&
                bytes[4] === 0x0D &&
                bytes[5] === 0x0A &&
                bytes[6] === 0x1A &&
                bytes[7] === 0x0A;

            if (isJpeg || isPng) {

                return this.createSuccessResult(
                    startedAt,
                    timer,
                    isJpeg
                        ? "JPEG file signature is valid."
                        : "PNG file signature is valid.",
                    `Detected=${isJpeg ? "JPEG" : "PNG"}, ` +
                    `Tool="${context.toolType}"`
                );

            }

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_MAGIC_NUMBER,
                "Invalid image file signature.",
                `Expected=JPEG(FF D8 FF) or ` +
                `PNG(89 50 4E 47 0D 0A 1A 0A), ` +
                `File="${file.name}"`
            );

        }

        // ---------------------------------------------------------------------
        // Existing PDF behavior
        // ---------------------------------------------------------------------

        const headerBuffer =
            await file
                .slice(0, 5)
                .arrayBuffer();

        const header =
            new TextDecoder().decode(
                headerBuffer
            );

        if (header === "%PDF-") {

            return this.createSuccessResult(
                startedAt,
                timer,
                "PDF file signature is valid.",
                `Expected="%PDF-", Actual="${header}"`
            );

        }

        return this.createFailureResult(
            startedAt,
            timer,
            ValidationErrorCode.INVALID_MAGIC_NUMBER,
            "Invalid PDF file signature.",
            `Expected="%PDF-", Actual="${header}"`
        );

    }

}
