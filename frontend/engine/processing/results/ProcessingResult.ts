/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : ProcessingResult.ts
 * Module     : Processing
 * Layer      : Result
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Represents the outcome of a PDF processing operation.
 *
 * All processors return this model.
 * =============================================================================
 */

export interface ProcessingResult {

    /**
     * Indicates whether processing completed successfully.
     */
    readonly success: boolean;

    /**
     * Generated output file.
     */
    readonly outputFile?: File;

    /**
     * Error message if processing failed.
     */
    readonly error?: string;

}