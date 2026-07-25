/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : LaunchActionDetector.ts
 * Module     : Security Detectors
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Detects Open/Launch actions embedded inside PDF documents.
 * =============================================================================
 */

import type { IPdfDocumentService } from "../../services/IPdfDocumentService";

import type {
    ILaunchActionDetector,
    LaunchActionDetectionResult
} from "../interfaces/ILaunchActionDetector";

export class LaunchActionDetector implements ILaunchActionDetector {

    public constructor(
        private readonly pdfDocumentService: IPdfDocumentService
    ) {
    }

    public async detect(
        file: File
    ): Promise<LaunchActionDetectionResult> {

        await this.pdfDocumentService.open(file);

        try {

            const document = this.pdfDocumentService.getDocument();

            const openAction = await document.getOpenAction();

            return {
                hasLaunchAction: openAction !== null
            };

        } finally {

            await this.pdfDocumentService.close();

        }

    }

}