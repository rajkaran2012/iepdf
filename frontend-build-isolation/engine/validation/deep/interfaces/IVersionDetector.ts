/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IVersionDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 * =============================================================================
 */

import type { VersionDetectionResult }
from "../models/VersionDetectionResult";

import type { IDeepDetector }
from "./IDeepDetector";

export interface IVersionDetector
extends IDeepDetector<VersionDetectionResult> {
}