/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : BasePdfProcessor.ts
 * Module     : Processing
 * Layer      : Base Processor
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Provides the common execution pipeline for all PDF processors.
 *
 * Responsibilities:
 *   • Execute the processing pipeline
 *   • Invoke validation hook
 *   • Handle expected and unexpected exceptions
 *   • Ensure cleanup
 *   • Return a standardized ProcessingResult
 *
 * Child processors should only implement processCore().
 * =============================================================================
 */

import type { IPdfProcessor } from "../IPdfProcessor";
import type { ProcessingContext } from "../ProcessingContext";
import type { ProcessingResult } from "../results/ProcessingResult";

export abstract class BasePdfProcessor implements IPdfProcessor {

    /**
     * Executes the processing pipeline.
     */
    public async process(
        context: ProcessingContext
    ): Promise<ProcessingResult> {

        try {

            await this.validate(context);

            return await this.processCore(context);

        } catch (error) {

            return this.createFailureResult(error);

        } finally {

            await this.cleanup(context);

        }

    }

    /**
     * Validation hook.
     *
     * Child classes may override if additional validation is required.
     */
    protected async validate(
        _context: ProcessingContext
    ): Promise<void> {

        // Validation Engine integration will be added here.

    }

    /**
     * Processing implementation.
     *
     * Every processor must implement its own business logic.
     */
    protected abstract processCore(
        context: ProcessingContext
    ): Promise<ProcessingResult>;

    /**
     * Cleanup hook.
     *
     * Override only when resources must be released.
     */
    protected async cleanup(
        _context: ProcessingContext
    ): Promise<void> {

        // Default: nothing to clean.

    }

    /**
     * Creates a standardized failure result.
     */
    protected createFailureResult(
        error: unknown
    ): ProcessingResult {

        return {

            success: false,

            error:
                error instanceof Error
                    ? error.message
                    : "An unexpected processing error occurred."

        };

    }

}