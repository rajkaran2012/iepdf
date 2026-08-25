/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : LaunchActionDetector.ts
 * Module     : Security Detectors
 *
 * ---------------------------------------------------------------------------
 * Purpose
 * ---------------------------------------------------------------------------
 * Detects Open / Launch actions embedded inside PDF documents.
 *
 * PDF.js is used first for structural inspection.
 * A raw PDF signature fallback is used because PDF.js may not expose every
 * security action through getOpenAction().
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

        let structuralDetection = false;

        try {

            await this.pdfDocumentService.open(file);

            try {

                const document =
                    this.pdfDocumentService.getDocument();

                const openAction =
                    await document.getOpenAction();

                structuralDetection =
                    openAction !== null;

            } finally {

                await this.pdfDocumentService.close();

            }

        } catch {

            /*
             * Raw signature inspection below remains authoritative for
             * security detection when PDF.js cannot expose the action.
             */

            try {
                await this.pdfDocumentService.close();
            } catch {
                // Ignore cleanup errors.
            }

        }

        /*
         * Security fallback:
         *
         * Detect the PDF Launch action directly from the PDF bytes.
         *
         * This is intentionally token-based rather than a generic substring
         * search so ordinary text containing the word "Launch" is less likely
         * to trigger the detector.
         */
        const bytes =
            new Uint8Array(
                await file.arrayBuffer()
            );

        const text =
            new TextDecoder(
                "latin1"
            ).decode(bytes);

        const launchActionPattern =
            /\/S\s*\/Launch(?:\s|\/|>|\[|\(|<)/;

        const rawLaunchDetection =
            launchActionPattern.test(text);

        return {
            hasLaunchActions:
                structuralDetection ||
                rawLaunchDetection
        };

    }

}