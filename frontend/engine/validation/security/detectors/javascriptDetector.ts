/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : javascriptDetector.ts
 * Module     : Security Detectors
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Detects JavaScript embedded inside PDF documents.
 * =============================================================================
 */

import type { IPdfDocumentService } from "../../services/IPdfDocumentService";

import type {
    IJavaScriptDetector,
    JavaScriptDetectionResult
} from "../interfaces/IJavaScriptDetector";


export class JavaScriptDetector implements IJavaScriptDetector {

    public constructor(
        private readonly pdfDocumentService: IPdfDocumentService
    ) {
    }

    public async detect(
    file: File
): Promise<JavaScriptDetectionResult> {

    await this.pdfDocumentService.open(file);

    try {

        const document = this.pdfDocumentService.getDocument();

        const jsActions =
            await document.getJSActions();

        const hasJavaScript =
            jsActions !== null &&
            Object.keys(jsActions).length > 0;

        return {
            hasJavaScript
        };

    } finally {

        await this.pdfDocumentService.close();

  }
   }
   }