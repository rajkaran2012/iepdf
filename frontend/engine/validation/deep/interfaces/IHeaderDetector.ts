/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IHeaderDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 * =============================================================================
 */

import type { IDeepDetector } from "./IDeepDetector";

export interface HeaderDetectionResult {

    readonly validHeader: boolean;

    readonly detectedHeader?: string;

    readonly reason?: string;

}

export interface IHeaderDetector
extends IDeepDetector<HeaderDetectionResult> {
}