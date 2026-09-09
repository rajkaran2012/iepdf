import { ToolType, ValidationResult } from "./validationTypes";

import { TOOL_RULES } from "./validation/toolRules";

import { ValidationPipeline } from "@/engine/validation/pipeline/validationPipeline";

export async function validateFiles(
    files: File[],
    toolType: ToolType
): Promise<ValidationResult> {

    const rule = TOOL_RULES[toolType];

    // No file selected

    if (files.length === 0) {

        return {
            success: false,
            tool: {
                id: rule.id,
                name: rule.name,
            },
            code: "NO_FILE",
            title: "No File Selected",
            message: "Please select at least one file.",
        };

    }



    // Execute Validation Engine

    const pipeline = new ValidationPipeline();

    for (const file of files) {

         const results = await pipeline.execute(
          files,
          file,
          toolType
        );

        const failed =
            results.find(result => !result.passed);

        if (failed) {

            return {
                success: false,

                tool: {
                    id: rule.id,
                    name: rule.name,
                },

                code: failed.errorCode as any,

                title: failed.rule,

                message:
                    failed.message ??
                    "Validation failed.",

                file: {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                },

            };

        }

    }

    return {
        success: true,

        tool: {
            id: rule.id,
            name: rule.name,
        },

    };

}
