/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : IPdfProcessor.ts
 * Module     : Processing
 * Layer      : Interface
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the common contract implemented by every PDF processing tool.
 *
 * Examples:
 *  • PDF Merge
 *  • PDF Split
 *  • PDF Compress
 *  • JPG ↔ PDF
 *  • PDF → Word
 *
 * Every processor receives a ProcessingContext and produces a
 * ProcessingResult.
 * =============================================================================
 */

import type { ProcessingContext } from "./ProcessingContext";
import type { ProcessingResult } from "./results/ProcessingResult";

export interface IPdfProcessor {

    process(
        context: ProcessingContext
    ): Promise<ProcessingResult>;

}