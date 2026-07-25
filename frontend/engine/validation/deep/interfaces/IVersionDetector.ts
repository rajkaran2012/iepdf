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

import type { IDeepDetector } from "./IDeepDetector";

export interface VersionDetectionResult {

    readonly validVersion: boolean;

    readonly detectedVersion?: string;

    readonly reason?: string;

}

export interface IVersionDetector
extends IDeepDetector<VersionDetectionResult> {
}