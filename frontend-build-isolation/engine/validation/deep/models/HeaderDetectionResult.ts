/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : HeaderDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 *
 * =============================================================================
 */

export interface HeaderDetectionResult {

    /**
     * Indicates whether the PDF header is valid.
     */
    readonly validHeader: boolean;

    /**
     * Header detected from the document.
     */
    readonly detectedHeader?: string;

    /**
     * Failure reason.
     */
    readonly reason?: string;

}