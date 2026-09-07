/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : XrefDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 * =============================================================================
 */

export interface XrefDetectionResult {

    /**
     * Indicates whether the PDF XRef structure is valid.
     */
    readonly validXref: boolean;

    /**
     * Byte offset referenced by startxref.
     */
    readonly xrefOffset?: number;

    /**
     * Type of XRef structure detected.
     */
    readonly xrefType?: "table" | "stream";

    /**
     * Number of entries when available.
     */
    readonly entryCount?: number;

    /**
     * Failure reason.
     */
    readonly reason?: string;

}
