/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : PageTreeDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 * =============================================================================
 */

export interface PageTreeDetectionResult {

    /**
     * Indicates whether the PDF Page Tree is structurally valid.
     */
    readonly validPageTree: boolean;

    /**
     * Calculated number of leaf Page objects.
     */
    readonly pageCount?: number;

    /**
     * Root /Pages object number.
     */
    readonly rootPagesObjectNumber?: number;

    /**
     * Root /Pages object generation number.
     */
    readonly rootPagesGenerationNumber?: number;

    /**
     * Failure reason.
     */
    readonly reason?: string;

}
