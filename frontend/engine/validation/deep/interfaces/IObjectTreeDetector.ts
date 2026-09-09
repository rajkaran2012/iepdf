/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IObjectTreeDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 * =============================================================================
 */

import type {
    ObjectTreeDetectionResult
} from "../models/ObjectTreeDetectionResult";

import type {
    IDeepDetector
} from "./IDeepDetector";

export interface IObjectTreeDetector
    extends IDeepDetector<ObjectTreeDetectionResult> {
}
