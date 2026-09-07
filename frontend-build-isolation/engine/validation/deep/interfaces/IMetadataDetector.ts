/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IMetadataDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector Contract
 * =============================================================================
 */

import type {
    IDeepDetector
} from "./IDeepDetector";

import type {
    MetadataDetectionResult
} from "../models/MetadataDetectionResult";

export interface IMetadataDetector
    extends IDeepDetector<MetadataDetectionResult> {
}
