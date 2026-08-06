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
 * • Opening a PDF
 * • Closing a PDF
 * • Document lifecycle
 * • Document caching
 *
 * It abstracts the underlying PDF library from validators and detectors.
 * =============================================================================
 */

import type { IPdfDocumentService } from "./IPdfDocumentService";
import type { ParsedPdfDocument } from "../models/ParsedPdfDocument";

import {
    getDocument,
    type PDFDocumentLoadingTask,
    type PDFDocumentProxy
} from "pdfjs-dist";

export class PdfDocumentService implements IPdfDocumentService {

    private loadingTask: PDFDocumentLoadingTask | null = null;

    private document: PDFDocumentProxy | null = null;

    private encrypted = false;

    public async open(
        file: File
    ): Promise<void> {

        await this.close();

        const bytes = await file.arrayBuffer();

        this.loadingTask = getDocument({
            data: bytes
        });

        try {

            this.document = await this.loadingTask.promise;

            this.encrypted = false;

        } catch (error: unknown) {

    if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name: string }).name === "PasswordException"
    ) {

        this.encrypted = true;
        this.document = null;

        return;

    }

    throw error;

}

    }

    public async close(): Promise<void> {

        if (this.loadingTask !== null) {

            await this.loadingTask.destroy();

            this.loadingTask = null;

        }

        this.document = null;
        this.encrypted = false;

    }

    public isOpen(): boolean {

        return this.document !== null;

    }

    /**
     * Returns the currently opened PDF document.
     *
     * Throws an error if no document is open.
     */
    public getDocument(): PDFDocumentProxy {

        if (this.document === null) {

            throw new Error("PDF document is not open.");

        }

        return this.document;

    }

    public async isEncrypted(): Promise<boolean> {

        return this.encrypted;

    }

    public async getPageCount(): Promise<number> {

        const document = this.getDocument();

        return document.numPages;

    }

    public async getMetadata(): Promise<Record<string, unknown>> {

        const document = this.getDocument();

        const metadata = await document.getMetadata();

        return {
            info: metadata.info,
            metadata: metadata.metadata
        };

    }

    public async getDocumentInfo(): Promise<Record<string, unknown>> {

    const document = this.getDocument();

    const metadata = await document.getMetadata();

    return metadata.info as Record<string, unknown>;

}

public getParsedDocument(): ParsedPdfDocument {

    throw new Error(
        "getParsedDocument() is not implemented for the current ParsedPdfDocument model."
    );

}

}