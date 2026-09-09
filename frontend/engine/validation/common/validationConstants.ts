/**
 * =============================================================================
 * iePDF Browser Engine
 * =============================================================================
 *
 * File        : validationConstants.ts
 * Module      : Validation Engine
 * Layer       : Common
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Centralized immutable constants used by the Validation Engine.
 *
 * This file MUST contain ONLY constants.
 *
 * =============================================================================
 */

/* =============================================================================
 * Validation Engine
 * ========================================================================== */

export const VALIDATION_ENGINE = Object.freeze({
    NAME: "iePDF Validation Engine",
    VERSION: "1.0.0",
} as const);

/* =============================================================================
 * Validation Pipeline
 * ========================================================================== */

export const VALIDATION_PIPELINE = Object.freeze({
    MAX_GATE_COUNT: 3,
    MAX_RESULT_COUNT: 100,
} as const);

/* =============================================================================
 * Boundary Validation
 * ========================================================================== */

export const BOUNDARY_VALIDATION = Object.freeze({

    /* -------------------------------------------------------------------------
     * File Size
     * ---------------------------------------------------------------------- */

    MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024,

    /* -------------------------------------------------------------------------
     * File Name
     * ---------------------------------------------------------------------- */

    MIN_FILENAME_LENGTH: 1,

    MAX_FILENAME_LENGTH: 255,

    INVALID_FILE_NAME_CHARACTERS:
        /[<>:"/\\|?*\x00-\x1F]/,

    RESERVED_FILE_NAMES: Object.freeze([
        "CON",
        "PRN",
        "AUX",
        "NUL",
        "COM1",
        "COM2",
        "COM3",
        "COM4",
        "COM5",
        "COM6",
        "COM7",
        "COM8",
        "COM9",
        "LPT1",
        "LPT2",
        "LPT3",
        "LPT4",
        "LPT5",
        "LPT6",
        "LPT7",
        "LPT8",
        "LPT9",
    ]),

    /* -------------------------------------------------------------------------
     * Extension
     * ---------------------------------------------------------------------- */

    MIN_EXTENSION_LENGTH: 2,

    MAX_EXTENSION_LENGTH: 10,

    ALLOWED_EXTENSIONS: Object.freeze([
        ".pdf",
    ]),

    /* -------------------------------------------------------------------------
     * MIME Type
     * ---------------------------------------------------------------------- */

    DEFAULT_MIME: "application/pdf",

    ALLOWED_MIME_TYPES: Object.freeze([
        "application/pdf",
        "image/jpeg",
        "image/png",
    ]),

    /* -------------------------------------------------------------------------
     * PDF Signature
     * ---------------------------------------------------------------------- */

    PDF_MAGIC_NUMBER: "%PDF-",

    PDF_MAGIC_NUMBER_LENGTH: 5,

} as const);

/* =============================================================================
 * Security Validation
 * ========================================================================== */

export const SECURITY_VALIDATION = Object.freeze({

    MAX_JAVASCRIPT_OBJECTS: 0,

    MAX_LAUNCH_ACTIONS: 0,

    MAX_EMBEDDED_FILES: 0,

    MAX_PASSWORD_ATTEMPTS: 3,

} as const);

/* =============================================================================
 * Deep Validation
 * ========================================================================== */

export const DEEP_VALIDATION = Object.freeze({

    MIN_SUPPORTED_PDF_VERSION: "1.0",

    MAX_SUPPORTED_PDF_VERSION: "2.0",

} as const);

/* =============================================================================
 * Performance
 * ========================================================================== */

export const VALIDATION_PERFORMANCE = Object.freeze({

    DEFAULT_TIMEOUT_MS: 5000,

    WARNING_TIMEOUT_MS: 2500,

    MAX_EXECUTION_TIME_MS: 10000,

} as const);

/* =============================================================================
 * Metadata
 * ========================================================================== */

export const VALIDATION_METADATA = Object.freeze({

    UNKNOWN: "UNKNOWN",

    EMPTY: "",

    NOT_AVAILABLE: "N/A",

} as const);

/* =============================================================================
 * Validation Messages
 * ========================================================================== */

export const VALIDATION_MESSAGES = Object.freeze({

    /* -------------------------------------------------------------------------
     * Generic
     * ---------------------------------------------------------------------- */

    PASSED: "Validation completed successfully.",

    FAILED: "Validation failed.",

    UNKNOWN: "Unknown validation error.",

    INVALID_CONTEXT: "Invalid validation context.",

    VALIDATOR_DISABLED: "Validator is disabled.",
    INVALID_FILE_COUNT:
          "Invalid number of uploaded files.",

     FILE_COUNT_VALIDATION_PASSED:
          "File count validation passed.",

    /* -------------------------------------------------------------------------
     * File Size
     * ---------------------------------------------------------------------- */

    FILE_SIZE_VALIDATION_PASSED:
        "File size validation passed.",

    FILE_TOO_LARGE:
        "File exceeds the maximum allowed size.",

    /* -------------------------------------------------------------------------
     * Extension
     * ---------------------------------------------------------------------- */

    EXTENSION_VALIDATION_PASSED:
        "File extension validation passed.",

    INVALID_EXTENSION:
        "Invalid file extension.",

    /* -------------------------------------------------------------------------
     * MIME Type
     * ---------------------------------------------------------------------- */

    MIME_VALIDATION_PASSED:
        "MIME type validation passed.",

    INVALID_MIME_TYPE:
        "Invalid MIME type.",

    /* -------------------------------------------------------------------------
     * PDF Signature
     * ---------------------------------------------------------------------- */

    MAGIC_NUMBER_VALIDATION_PASSED:
        "PDF signature validation passed.",

    INVALID_MAGIC_NUMBER:
        "Invalid PDF signature.",

    /* -------------------------------------------------------------------------
     * File Name
     * ---------------------------------------------------------------------- */

    FILE_NAME_VALIDATION_PASSED:
        "File name validation passed.",

    EMPTY_FILE_NAME:
        "File name cannot be empty.",

    FILE_NAME_TOO_LONG:
        "File name exceeds maximum length.",

    INVALID_FILE_NAME:
        "Invalid file name.",

    INVALID_FILE_NAME_CHARACTER:
        "File name contains invalid characters.",

    RESERVED_FILE_NAME:
        "Reserved file name is not allowed.",

    PATH_TRAVERSAL_DETECTED:
        "Path traversal detected.",

} as const);

/* =============================================================================
 * PDF Signatures
 * ========================================================================== */

export const PDF_SIGNATURES = Object.freeze({

    HEADER: "%PDF-",

    EOF: "%%EOF",

} as const);

/* =============================================================================
 * Validation Priority
 * ========================================================================== */

export const VALIDATION_PRIORITY = Object.freeze({

    LOW: 1,

    NORMAL: 5,

    HIGH: 10,

    CRITICAL: 100,

} as const);

/* =============================================================================
 * Export
 * ========================================================================== */

export const ValidationConstants = Object.freeze({

    VALIDATION_ENGINE,

    VALIDATION_PIPELINE,

    BOUNDARY_VALIDATION,

    SECURITY_VALIDATION,

    DEEP_VALIDATION,

    VALIDATION_PERFORMANCE,

    VALIDATION_METADATA,

    VALIDATION_MESSAGES,

    PDF_SIGNATURES,

    VALIDATION_PRIORITY,

} as const);

export default ValidationConstants;
