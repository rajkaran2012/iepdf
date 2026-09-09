/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : encryptionDetector.ts
 * Module     : Security Detectors
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Detects whether a PDF document is encrypted.
 *
 * The detector delegates PDF access to IPdfDocumentService.
 * It performs no low-level PDF parsing itself.
 * =============================================================================
 */

import type { IPdfDocumentService } from "../../services/IPdfDocumentService";

import type {
    IEncryptionDetector,
    EncryptionDetectionResult
} from "../interfaces/IEncryptionDetector";

export class EncryptionDetector
    implements IEncryptionDetector {

    public constructor(
        private readonly pdfDocumentService: IPdfDocumentService
    ) {
    }

    public async detect(
        file: File
    ): Promise<EncryptionDetectionResult> {

        await this.pdfDocumentService.open(file);

        try {

            const encrypted =
                await this.pdfDocumentService.isEncrypted();

            return {
                encrypted
            };

        } finally {

            await this.pdfDocumentService.close();

        }

    }

}