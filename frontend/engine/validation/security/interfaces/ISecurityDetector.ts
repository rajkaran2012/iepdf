/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : ISecurityDetector.ts
 * Module     : Security Interfaces
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the base contract for all security detectors.
 *
 * Every security detector must implement this interface with its own
 * detection result type.
 * =============================================================================
 */

export interface ISecurityDetector<TResult> {

    detect(
        file: File
    ): Promise<TResult>;

}