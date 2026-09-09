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

import type { HeaderDetectionResult }
from "../models/HeaderDetectionResult";

import type { IDeepDetector }
from "./IDeepDetector";

export interface IHeaderDetector
extends IDeepDetector<HeaderDetectionResult> {
}