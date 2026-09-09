/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : securityRegistry.ts
 * Module     : Security Validation
 * Layer      : Registry
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Registers Security Gate validators in their execution order.
 *
 * The registry is responsible only for:
 *
 * - Creating validator dependencies
 * - Creating validator instances
 * - Defining validator execution order
 * - Returning an immutable validator collection
 *
 * It MUST NOT:
 *
 * - Perform validation
 * - Read PDF internals
 * - Handle validation results
 * - Handle exceptions
 * =============================================================================
 */

import type { IValidator } from "../common/validator";

import { PdfDocumentService } from "../services/PdfDocumentService";

import { JavaScriptDetector } from "./detectors/javascriptDetector";
import { LaunchActionDetector } from "./detectors/launchActionDetector";
import { EmbeddedFileDetector } from "./detectors/embeddedFileDetector";
import { PasswordDetector } from "./detectors/passwordDetector";

import { JavaScriptValidator } from "./javaScriptValidator";
import { LaunchActionValidator } from "./launchActionValidator";
import { EmbeddedFilesValidator } from "./embeddedFileValidator";
import { PasswordProtectionValidator } from "./passwordProtectionValidator";

export class SecurityValidatorRegistry {

    /**
     * =========================================================================
     * Shared PDF document service.
     * =========================================================================
     *
     * The detectors use the service to open and inspect PDF documents.
     */
    private static readonly pdfDocumentService =
        new PdfDocumentService();

    /**
     * =========================================================================
     * Detector instances.
     * =========================================================================
     */

    private static readonly javaScriptDetector =
        new JavaScriptDetector(
            SecurityValidatorRegistry.pdfDocumentService
        );

    private static readonly launchActionDetector =
        new LaunchActionDetector(
            SecurityValidatorRegistry.pdfDocumentService
        );

    private static readonly embeddedFileDetector =
        new EmbeddedFileDetector(
            SecurityValidatorRegistry.pdfDocumentService
        );

    private static readonly passwordDetector =
        new PasswordDetector(
            SecurityValidatorRegistry.pdfDocumentService
        );

    /**
     * =========================================================================
     * Security Validators
     * =========================================================================
     *
     * Execution order:
     *
     * 1. Password Protection
     * 2. JavaScript
     * 3. Launch Action
     * 4. Embedded Files
     *
     * Encryption and Malware Pattern validation will be registered
     * after their detector implementations are complete.
     */
    private static readonly validators: readonly IValidator[] =
        Object.freeze([

            new PasswordProtectionValidator(
                SecurityValidatorRegistry.passwordDetector
            ),

            new JavaScriptValidator(
                SecurityValidatorRegistry.javaScriptDetector
            ),

            new LaunchActionValidator(
                SecurityValidatorRegistry.launchActionDetector
            ),

            new EmbeddedFilesValidator(
                SecurityValidatorRegistry.embeddedFileDetector
            ),

        ]);

    /**
     * =========================================================================
     * Returns registered Security validators.
     * =========================================================================
     */
    public static getValidators(): readonly IValidator[] {

        return this.validators;

    }

}