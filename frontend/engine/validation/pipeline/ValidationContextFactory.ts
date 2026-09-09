/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : ValidationContextFactory.ts
 * Module      : Validation Engine
 * Layer       : Pipeline
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Creates immutable ValidationContext objects from uploaded browser files.
 *
 * =============================================================================
 */

import { ValidationContext } from "./validationContext";
import { ValidationResult } from "./validationResult";
import type { ToolType } from "@/lib/validationTypes";

export class ValidationContextFactory {

    /**
     * Create Validation Context
     */
    public static create(
        files: ReadonlyArray<File>,
        file: File,
        toolType: ToolType
    ): ValidationContext {

        const extension =
            file.name.includes(".")
                ? file.name.split(".").pop()!.toLowerCase()
                : "";

    return Object.freeze({

    id: crypto.randomUUID(),

    files,

    fileCount: files.length,

    toolType,

    file,

    fileName: file.name,

    extension,

    mimeType: file.type,

    fileSize: file.size,

    startedAt: new Date(),

    correlationId: crypto.randomUUID(),

    results: Object.freeze([]) as readonly ValidationResult[],

    metadata: Object.freeze({}),

    cancelled: false,

    stopPipeline: false,

});

    }

}