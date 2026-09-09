/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : IPasswordDetector.ts
 * Module     : Security Interfaces
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the contract for password detection.
 * =============================================================================
 */

import type {
    ISecurityDetector
} from "./ISecurityDetector";

export interface PasswordDetectionResult {

    readonly isPasswordProtected: boolean;

    readonly isEncrypted: boolean;

    readonly encryptionType?: string;

}

export interface IPasswordDetector
    extends ISecurityDetector<PasswordDetectionResult> {
}