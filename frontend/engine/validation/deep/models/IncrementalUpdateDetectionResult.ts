/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IncrementalUpdateDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 * =============================================================================
 */

export interface IncrementalUpdateDetectionResult {

    /**
     * Indicates whether the PDF contains a structurally valid
     * incremental-update chain.
     */
    readonly validIncrementalUpdate: boolean;

    /**
     * Number of revisions detected.
     *
     * A normal non-incremental PDF has one revision.
     * An incremental PDF has two or more revisions.
     */
    readonly revisionCount?: number;

    /**
     * Number of /Prev links detected.
     */
    readonly previousRevisionCount?: number;

    /**
     * Byte offsets of the detected revisions.
     */
    readonly revisionOffsets?: readonly number[];

    /**
     * Failure reason.
     */
    readonly reason?: string;

}
