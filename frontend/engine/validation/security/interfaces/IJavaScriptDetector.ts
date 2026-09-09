/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IJavaScriptDetector.ts
 * Module     : Security Interfaces
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the contract for JavaScript detection.
 * =============================================================================
 */

import type {
    ISecurityDetector
} from "./ISecurityDetector";

export interface JavaScriptDetectionResult {

    readonly hasJavaScript: boolean;

}

export interface IJavaScriptDetector
    extends ISecurityDetector<JavaScriptDetectionResult> {
}