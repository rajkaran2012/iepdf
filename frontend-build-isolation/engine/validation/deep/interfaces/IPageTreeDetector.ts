/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IPageTreeDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 * =============================================================================
 */

import type {
    PageTreeDetectionResult
} from "../models/PageTreeDetectionResult";

import type {
    IDeepDetector
} from "./IDeepDetector";

export interface IPageTreeDetector
    extends IDeepDetector<PageTreeDetectionResult> {
}
