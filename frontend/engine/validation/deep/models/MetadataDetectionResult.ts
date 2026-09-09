/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : MetadataDetectionResult.ts
 * Module     : Deep Validation
 * Layer      : Models
 * =============================================================================
 */

export interface MetadataDetectionResult {

    /**
     * Indicates whether the PDF metadata structure is valid.
     */
    readonly validMetadata: boolean;

    /**
     * Indicates whether an Info dictionary was detected.
     */
    readonly hasInfoDictionary?: boolean;

    /**
     * Indicates whether an XMP metadata stream was detected.
     */
    readonly hasXmpMetadata?: boolean;

    /**
     * Number of metadata-bearing objects detected.
     */
    readonly metadataObjectCount?: number;

    /**
     * Failure reason.
     */
    readonly reason?: string;

}
