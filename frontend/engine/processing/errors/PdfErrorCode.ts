/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File    : PdfErrorCode.ts
 * Module  : Processing
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines all standardized PDF processing error codes.
 * Every processor, loader and validator should use these values instead of
 * hard-coded strings.
 * =============================================================================
 */

export enum PdfErrorCode {

    NONE = "NONE",

    INVALID_PDF = "INVALID_PDF",

    CORRUPTED_PDF = "CORRUPTED_PDF",

    PASSWORD_REQUIRED = "PASSWORD_REQUIRED",

    INVALID_PASSWORD = "INVALID_PASSWORD",

    UNSUPPORTED_VERSION = "UNSUPPORTED_VERSION",

    FILE_TOO_LARGE = "FILE_TOO_LARGE",

    LOAD_FAILED = "LOAD_FAILED",

    VALIDATION_FAILED = "VALIDATION_FAILED",

    SECURITY_CHECK_FAILED = "SECURITY_CHECK_FAILED",

    CANCELLED = "CANCELLED",

    UNKNOWN = "UNKNOWN",

}