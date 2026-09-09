/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IEncryptionDetector.ts
 * Module     : Security Interfaces
 * =============================================================================
 */

export interface EncryptionDetectionResult {

    readonly encrypted: boolean;

}

export interface IEncryptionDetector {

    detect(
        file: File
    ): Promise<EncryptionDetectionResult>;

}