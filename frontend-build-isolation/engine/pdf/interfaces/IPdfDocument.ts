/**
 * =============================================================================
 * iePDF
 * =============================================================================
 *
 * File       : IPdfDocument.ts
 * Module     : PDF
 * Layer      : Interface
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Represents a mutable PDF document.
 *
 * This interface defines only generic document capabilities.
 * It intentionally contains no tool-specific business logic.
 * =============================================================================
 */

export interface IPdfDocument {

    load(data: ArrayBuffer): Promise<void>;

    save(): Promise<Uint8Array>;

    getPageCount(): number;

    getPageIndices(): readonly number[];

    appendDocument(
        source: IPdfDocument
    ): Promise<void>;

    toFile(
        fileName: string
    ): Promise<File>;

}