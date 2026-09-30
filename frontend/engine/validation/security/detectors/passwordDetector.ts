/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 */

import type {
    IPasswordDetector,
    PasswordDetectionResult
} from "../interfaces/IPasswordDetector";

import type { IPdfDocumentService } from "../../services/IPdfDocumentService";

export class PasswordDetector implements IPasswordDetector {

    public constructor(
        private readonly pdfDocumentService: IPdfDocumentService
    ) {
    }

    public async detect(
        file: File
    ): Promise<PasswordDetectionResult> {

        try {

            await this.pdfDocumentService.open(file);

        } catch (error: unknown) {

            console.error(
                "[PASSWORD-DIAGNOSTIC] PdfDocumentService.open() failed",
                error
            );

            throw error;

        }

        try {

            const encrypted =
                await this.pdfDocumentService.isEncrypted();

            return {
                isPasswordProtected: encrypted,
                isEncrypted: encrypted,
                encryptionType: undefined
            };

        } finally {

            await this.pdfDocumentService.close();

        }

    }

}
