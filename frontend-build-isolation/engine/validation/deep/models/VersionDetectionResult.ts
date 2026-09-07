/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : VersionDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 *
 * =============================================================================
 */

export interface VersionDetectionResult {

    /**
     * Indicates whether the PDF version is valid.
     */
    readonly validVersion: boolean;

    /**
     * Version detected from the document.
     */
    readonly detectedVersion?: string;

    /**
     * Failure reason.
     */
    readonly reason?: string;

}