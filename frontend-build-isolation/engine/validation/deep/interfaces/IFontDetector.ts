/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IFontDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 * =============================================================================
 */

import type {
    IDeepDetector
} from "./IDeepDetector";

import type {
    FontDetectionResult
} from "../models/FontDetectionResult";

export interface IFontDetector
    extends IDeepDetector<FontDetectionResult> {
}
