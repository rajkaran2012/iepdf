/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IPdfDocumentService.ts
 * Module     : Validation Services
 * Layer      : Service Contract
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the contract for accessing a PDF document.
 *
 * This interface abstracts the underlying PDF library.
 * Validators and detectors MUST depend only on this contract.
 * =============================================================================
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ParsedPdfDocument } from "../models/ParsedPdfDocument";

export interface IPdfDocumentService {

    open(file: File): Promise<void>;

    close(): Promise<void>;

    isOpen(): boolean;

    getDocument(): PDFDocumentProxy;

    isEncrypted(): Promise<boolean>;

    getPageCount(): Promise<number>;

    getMetadata(): Promise<Record<string, unknown>>;

    getDocumentInfo(): Promise<Record<string, unknown>>;

}