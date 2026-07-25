/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : ILaunchActionDetector.ts
 * Module     : Security Interfaces
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Detects launch/open actions embedded inside PDF documents.
 * =============================================================================
 */

export interface LaunchActionDetectionResult {

    hasLaunchAction: boolean;

}

export interface ILaunchActionDetector {

    detect(
        file: File
    ): Promise<LaunchActionDetectionResult>;

}