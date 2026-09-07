/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : ObjectTreeDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 * =============================================================================
 */

export interface ObjectTreeDetectionResult {

    /**
     * Indicates whether the PDF indirect-object structure is valid.
     */
    readonly validObjectTree: boolean;

    /**
     * Number of indirect objects detected.
     */
    readonly objectCount?: number;

    /**
     * Root PDF object number from the trailer.
     */
    readonly rootObjectNumber?: number;

    /**
     * Root PDF object generation number from the trailer.
     */
    readonly rootGenerationNumber?: number;

    /**
     * Failure reason.
     */
    readonly reason?: string;

}
