/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IDeepDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Generic contract implemented by all Deep Validation detectors.
 *
 * Deep detectors inspect a single aspect of a parsed PDF document and return
 * a strongly typed detection result.
 * =============================================================================
 */

import type { ParsedPdfDocument } from "../../models/ParsedPdfDocument";

export interface IDeepDetector<TResult> {

    detect(
        file: File
    ): Promise<TResult>;

}