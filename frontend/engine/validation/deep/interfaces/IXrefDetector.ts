/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IXrefDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 * =============================================================================
 */

import type { XrefDetectionResult }
from "../models/XrefDetectionResult";

import type { IDeepDetector }
from "./IDeepDetector";

export interface IXrefDetector
extends IDeepDetector<XrefDetectionResult> {
}
