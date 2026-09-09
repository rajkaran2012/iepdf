/**
 * =============================================================================
 * iePDF Browser Engine
 * =============================================================================
 *
 * File        : validationContext.ts
 * Module      : Validation Engine
 * Layer       : Pipeline
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Immutable execution context shared by every validator in the Validation
 * Engine.
 *
 * The ValidationContext is the single source of truth during validation.
 *
 * It is created once by the Validation Pipeline and passed through:
 *
 * Boundary
 *      ↓
 * Security
 *      ↓
 * Deep Validation
 *
 * Validators MUST NEVER mutate this object.
 *
 * =============================================================================
 */

import type { ValidationResult } from "./validationResult";
import type { ToolType } from "@/lib/validationTypes";
import type { ParsedPdfDocument } from "../models/ParsedPdfDocument";

/**
 * Shared execution context.
 */
export interface ValidationContext {

    /**
     * Unique validation execution identifier.
     */
    readonly id: string;

    /**
     * Uploaded browser files.
     */
    readonly files: ReadonlyArray<File>;

    /**
     * Total uploaded files.
     */
    readonly fileCount: number;

    /**
     * Current tool type.
     */
    readonly toolType: ToolType;

    /**
     * Current file being validated.
     */
    readonly file: File;

    /**
     * Parsed PDF document shared across validators.
     */

    /**
     * Original filename.
     */
    readonly fileName: string;

    /**
     * File extension.
     *
     * Example:
     * pdf
     */
    readonly extension: string;

    /**
     * Browser MIME type.
     */
    readonly mimeType: string;

    /**
     * File size (bytes).
     */
    readonly fileSize: number;

    /**
     * Validation start time.
     */
    readonly startedAt: Date;

    /**
     * Correlation identifier.
     *
     * Reserved for future telemetry.
     */
    readonly correlationId: string;

    /**
     * Ordered validation results.
     *
     * Validators append results through the pipeline.
     */
    readonly results: ReadonlyArray<ValidationResult>;

    /**
     * Shared metadata between validators.
     */
    readonly metadata: Readonly<Record<string, unknown>>;

    /**
     * Indicates whether validation has been cancelled.
     *
     * Reserved for future Worker support.
     */
    readonly cancelled: boolean;

    /**
     * Indicates whether the pipeline should stop executing.
     */
    readonly stopPipeline: boolean;
}

/**
 * Immutable collection.
 */
export type ValidationContexts =
    ReadonlyArray<ValidationContext>;
