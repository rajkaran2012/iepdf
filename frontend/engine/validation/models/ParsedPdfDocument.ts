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
 * This model acts as the shared source of truth for validators and detectors.
 * It contains the parsed PDF document along with any extracted information
 * required by the Validation Engine.
 *
 * The model should be treated as read-only after creation.
 * =============================================================================
 */

import type { PDFDocumentProxy } from "pdfjs-dist";

export interface ParsedPdfDocument {

    readonly document: PDFDocumentProxy;

    readonly header?: string;

    readonly version?: string;

    readonly trailer?: unknown;

    readonly xref?: unknown;

    readonly catalog?: unknown;

    readonly pageTree?: unknown;

    readonly fonts?: readonly unknown[];

    readonly metadata?: Record<string, unknown>;

    readonly hasIncrementalUpdates?: boolean;

}