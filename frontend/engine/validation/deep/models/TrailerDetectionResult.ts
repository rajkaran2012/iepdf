/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : TrailerDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 * =============================================================================
 */

export interface TrailerDetectionResult {

    /**
     * Indicates whether the PDF trailer structure is valid.
     */
    readonly validTrailer: boolean;

    /**
     * Byte offset where the trailer keyword begins.
     */
    readonly trailerOffset?: number;

    /**
     * Value of the /Size trailer entry.
     */
    readonly size?: number;

    /**
     * Root PDF object number.
     */
    readonly rootObjectNumber?: number;

    /**
     * Root PDF object generation number.
     */
    readonly rootGenerationNumber?: number;

    /**
     * Failure reason.
     */
    readonly reason?: string;

}
