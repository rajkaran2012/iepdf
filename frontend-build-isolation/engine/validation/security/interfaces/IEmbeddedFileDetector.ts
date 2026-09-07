/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IEmbeddedFileDetector.ts
 * Module     : Security Interfaces
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the contract for embedded file detection.
 * =============================================================================
 */

export interface EmbeddedFileDetectionResult {

    readonly hasEmbeddedFiles: boolean;

    readonly fileCount: number;

}

export interface IEmbeddedFileDetector {

    detect(
        file: File
    ): Promise<EmbeddedFileDetectionResult>;

}