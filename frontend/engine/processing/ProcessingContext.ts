/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : ProcessingContext.ts
 * Module     : Processing
 * Layer      : Context
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Shared processing context passed to every processing engine.
 *
 * Every processor receives the complete workspace state rather than
 * only raw browser File objects.
 * =============================================================================
 */

import type { WorkspaceFile } from "./WorkspaceFile";

export interface ProcessingContext {

    /**
     * Workspace files selected for processing.
     */
    readonly files: readonly WorkspaceFile[];

}