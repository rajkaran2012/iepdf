/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : EmbeddedFileDetector.ts
 * Module     : Security Detectors
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Detects embedded files (attachments) inside PDF documents.
 * =============================================================================
 */

import type { IPdfDocumentService } from "../../services/IPdfDocumentService";

import type {
    IEmbeddedFileDetector,
    EmbeddedFileDetectionResult
} from "../interfaces/IEmbeddedFileDetector";

export class EmbeddedFileDetector implements IEmbeddedFileDetector {

    public constructor(
        private readonly pdfDocumentService: IPdfDocumentService
    ) {
    }

    public async detect(
        file: File
    ): Promise<EmbeddedFileDetectionResult> {

        await this.pdfDocumentService.open(file);

        try {

    const document = this.pdfDocumentService.getDocument();

    const attachments = await document.getAttachments();

    const fileCount = attachments?.size ?? 0;

    return {

        hasEmbeddedFiles: fileCount > 0,

        fileCount

    };

} finally {

    await this.pdfDocumentService.close();

}

    }

}