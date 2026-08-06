/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : ParsedPdfDocument.ts
 * Module     : Validation Models
 * Layer      : Domain Model
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Immutable representation of a parsed PDF document.
 *
 * This model is intentionally independent of any PDF library
 * (pdf.js, pdf-lib, etc.).
 *
 * All validators and detectors must consume this model rather than
 * depending on a third-party document implementation.
 * =============================================================================
 */

export interface ParsedPdfDocument {

    /**
     * Original PDF bytes.
     */
    readonly bytes: Uint8Array;

    /**
     * PDF Header
     * Example: %PDF-1.7
     */
    readonly header?: string;

    /**
     * PDF Version
     * Example: 1.7
     */
    readonly version?: string;

    /**
     * Raw Trailer Dictionary
     */
    readonly trailer?: unknown;

    /**
     * Cross Reference Table / Stream
     */
    readonly xref?: unknown;

    /**
     * Root Catalog
     */
    readonly catalog?: unknown;

    /**
     * Page Tree
     */
    readonly pageTree?: unknown;

    /**
     * Font Information
     */
    readonly fonts?: readonly unknown[];

    /**
     * Metadata
     */
    readonly metadata?: Record<string, unknown>;

    /**
     * Total Page Count
     */
    readonly pageCount?: number;

    /**
     * Encryption Status
     */
    readonly encrypted?: boolean;

    /**
     * Incremental Updates Present
     */
    readonly hasIncrementalUpdates?: boolean;

}