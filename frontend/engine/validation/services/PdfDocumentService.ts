/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : PdfDocumentService.ts
 * Module     : Validation Services
 * Layer      : Service
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Centralized PDF document access for the Validation Engine.
 *
 * This service owns:
 *
 * - Opening a PDF
 * - Closing a PDF
 * - Document lifecycle
 * - Document caching
 *
 * It abstracts the underlying PDF library from validators and detectors.
 *
 * -----------------------------------------------------------------------------
 * Browser-First Architecture
 * -----------------------------------------------------------------------------
 * PDF.js is loaded dynamically at runtime.
 *
 * This prevents PDF.js browser APIs such as DOMMatrix from being evaluated
 * during Next.js server-side rendering or prerendering.
 * =============================================================================
 */

import type { IPdfDocumentService } from "./IPdfDocumentService";
import type { ParsedPdfDocument } from "../models/ParsedPdfDocument";

import type {
    PDFDocumentLoadingTask,
    PDFDocumentProxy
} from "pdfjs-dist";

export class PdfDocumentService implements IPdfDocumentService {

    private loadingTask:
        PDFDocumentLoadingTask | null = null;

    private document:
        PDFDocumentProxy | null = null;

    private encrypted = false;

    /**
     * =========================================================================
     * Opens a PDF document.
     * =========================================================================
     */
    public async open(
        file: File
    ): Promise<void> {

        await this.close();

        const bytes =
            await file.arrayBuffer();

        /*
         * IMPORTANT:
         *
         * PDF.js must be loaded dynamically.
         *
         * Never move this import to the top of this file.
         */
        const {
            getDocument,
            GlobalWorkerOptions,
            version,
        } = await import("pdfjs-dist/legacy/build/pdf.mjs");

        /*
         * Browser:
         * Use the PDF.js worker through the browser.
         *
         * Vitest / Node:
         * Do not configure an HTTPS worker URL. PDF.js will use
         * its non-browser fallback path.
         */
        if (
            typeof window !== "undefined"
        ) {

            GlobalWorkerOptions.workerSrc =
                `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        }

        this.loadingTask =
            getDocument({
                data: bytes
            });

        try {

            this.document =
                await this.loadingTask.promise;

            this.encrypted = false;

        } catch (error: unknown) {

            if (
                typeof error === "object" &&
                error !== null &&
                "name" in error &&
                (error as { name: string }).name ===
                    "PasswordException"
            ) {

                this.encrypted = true;

                this.document = null;

                return;

            }

            throw error;

        }

    }

    /**
     * =========================================================================
     * Closes the currently opened PDF.
     * =========================================================================
     */
    public async close(): Promise<void> {

        if (this.loadingTask !== null) {

            try {

                await this.loadingTask.destroy();

            } catch {

                // Ignore cleanup errors.

            }

            this.loadingTask = null;

        }

        this.document = null;

        this.encrypted = false;

    }

    /**
     * =========================================================================
     * Returns whether a PDF document is currently open.
     * =========================================================================
     */
    public isOpen(): boolean {

        return this.document !== null;

    }

    /**
     * =========================================================================
     * Returns the currently opened PDF.js document.
     * =========================================================================
     */
    public getDocument(): PDFDocumentProxy {

        if (this.document === null) {

            throw new Error(
                "PDF document is not open."
            );

        }

        return this.document;

    }

    /**
     * =========================================================================
     * Returns whether the current PDF is encrypted.
     * =========================================================================
     */
    public async isEncrypted(): Promise<boolean> {

        return this.encrypted;

    }

    /**
     * =========================================================================
     * Returns the number of pages.
     * =========================================================================
     */
    public async getPageCount(): Promise<number> {

        const document =
            this.getDocument();

        return document.numPages;

    }

    /**
     * =========================================================================
     * Returns PDF metadata.
     * =========================================================================
     */
    public async getMetadata(): Promise<Record<string, unknown>> {

        const document =
            this.getDocument();

        const metadata =
            await document.getMetadata();

        return {

            info: metadata.info,

            metadata: metadata.metadata

        };

    }

    /**
     * =========================================================================
     * Returns PDF document information.
     * =========================================================================
     */
    public async getDocumentInfo(): Promise<Record<string, unknown>> {

        const document =
            this.getDocument();

        const metadata =
            await document.getMetadata();

        return metadata.info as Record<string, unknown>;

    }

    /**
     * =========================================================================
     * Returns parsed PDF document.
     *
     * Reserved for Deep Validation.
     * =========================================================================
     */
    public getParsedDocument(): ParsedPdfDocument {

        throw new Error(
            "getParsedDocument() is not implemented for the current ParsedPdfDocument model."
        );

    }

}
