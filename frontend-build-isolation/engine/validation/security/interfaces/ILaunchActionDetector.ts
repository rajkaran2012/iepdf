/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : ILaunchActionDetector.ts
 * Module     : Security Interfaces
 * =============================================================================
 */

import type { ISecurityDetector } from "./ISecurityDetector";

export interface LaunchActionDetectionResult {

    readonly hasLaunchActions: boolean;

}

export interface ILaunchActionDetector
    extends ISecurityDetector<LaunchActionDetectionResult> {
}