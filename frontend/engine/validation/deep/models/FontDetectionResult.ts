/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : FontDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 * =============================================================================
 */

export interface FontDetectionResult {

    /**
     * Indicates whether detected PDF font structures are valid.
     */
    readonly validFont: boolean;

    /**
     * Number of Font resource entries detected.
     */
    readonly fontCount?: number;

    /**
     * Failure reason.
     */
    readonly reason?: string;

}
