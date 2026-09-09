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
 * Every processor receives the complete workspace state together with
 * the tool type required by the Validation Engine.
 * =============================================================================
 */

import type { WorkspaceFile } from "./WorkspaceFile";
import type { ToolType } from "@/lib/validationTypes";

export interface ProcessingContext {

    /**
     * Workspace files selected for processing.
     */
    readonly files: readonly WorkspaceFile[];

    /**
     * Tool currently being executed.
     *
     * Example:
     * "merge"
     */
    readonly toolType: ToolType;

}