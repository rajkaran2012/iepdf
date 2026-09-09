/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IIncrementalUpdateDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 * =============================================================================
 */

import type {
    IncrementalUpdateDetectionResult
} from "../models/IncrementalUpdateDetectionResult";

import type {
    IDeepDetector
} from "./IDeepDetector";

export interface IIncrementalUpdateDetector
    extends IDeepDetector<IncrementalUpdateDetectionResult> {
}
