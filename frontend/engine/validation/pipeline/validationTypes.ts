/**
 * ============================================================
 * iePDF Validation Engine
 * ------------------------------------------------------------
 * File       : validationTypes.ts
 * Module     : Validation Pipeline
 * Layer      : Browser Engine
 * Purpose    : Shared contracts for the Validation Engine.
 *
 * Responsibilities
 * ------------------------------------------------------------
 * • Defines Validation Gates
 * • Defines Validation Rules
 * • Defines Validation Status
 * • Defines Validation Severity
 * • Defines Validator Contracts
 * • Shared by Boundary, Security and Deep Validation
 *
 * NOTE
 * ------------------------------------------------------------
 * This file MUST NOT contain:
 * • Validation Logic
 * • Browser APIs
 * • React Code
 * • PDF Processing
 * • Utility Functions
 *
 * This file only contains shared type definitions.
 * ============================================================
 */

//
// ============================================================
// Validation Gates
// ============================================================
//

export enum ValidationGate {
  BOUNDARY = "BOUNDARY",
  SECURITY = "SECURITY",
  DEEP = "DEEP",
}

//
// ============================================================
// Validation Status
// ============================================================
//

export enum ValidationStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  PASSED = "PASSED",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
}

//
// ============================================================
// Validation Severity
// ============================================================
//

export enum ValidationSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

//
// ============================================================
// Validation Rules
// ============================================================
//

export enum ValidationRule {
  // ------------------------------
  // Boundary Gate
  // ------------------------------
  FILE_COUNT = "FILE_COUNT",
  PASSWORD_PROTECTION = "PASSWORD_PROTECTION",
  FILE_SIZE = "FILE_SIZE",
  EXTENSION = "EXTENSION",
  MAGIC_NUMBER = "MAGIC_NUMBER",
  FILE_NAME = "FILE_NAME",
  MIME_TYPE = "MIME_TYPE",

  // ------------------------------
  // Security Gate
  // ------------------------------
   JAVASCRIPT = "JAVASCRIPT",
   LAUNCH_ACTION = "LAUNCH_ACTION",
   EMBEDDED_FILE = "EMBEDDED_FILE",
   ENCRYPTION = "ENCRYPTION",
   MALWARE_PATTERN = "MALWARE_PATTERN",
   PASSWORD = "PASSWORD",
  // ------------------------------
  // Deep Validation
  // ------------------------------
  HEADER = "HEADER",
  VERSION = "VERSION",
  XREF = "XREF",
  TRAILER = "TRAILER",
  OBJECT_TREE = "OBJECT_TREE",
  PAGE_TREE = "PAGE_TREE",
  FONT = "FONT",
  METADATA = "METADATA",
  INCREMENTAL_UPDATE = "INCREMENTAL_UPDATE",
}

//
// ============================================================
// Validation Error Codes
// ============================================================
//

export enum ValidationErrorCode {
  NONE = "NONE",

  FILE_TOO_LARGE = "FILE_TOO_LARGE",

  INVALID_EXTENSION = "INVALID_EXTENSION",

  INVALID_MAGIC_NUMBER = "INVALID_MAGIC_NUMBER",

  EMPTY_FILE_NAME = "EMPTY_FILE_NAME",

  FILE_NAME_TOO_LONG = "FILE_NAME_TOO_LONG",

  INVALID_FILE_NAME = "INVALID_FILE_NAME",
  INVALID_FILE_COUNT = "INVALID_FILE_COUNT",


  RESERVED_FILE_NAME = "RESERVED_FILE_NAME",

  PATH_TRAVERSAL = "PATH_TRAVERSAL",

  INVALID_MIME_TYPE = "INVALID_MIME_TYPE",

  JAVASCRIPT_DETECTED = "JAVASCRIPT_DETECTED",

LAUNCH_ACTION_DETECTED = "LAUNCH_ACTION_DETECTED",

EMBEDDED_FILE_DETECTED = "EMBEDDED_FILE_DETECTED",

ENCRYPTED_DOCUMENT = "ENCRYPTED_DOCUMENT",

MALWARE_PATTERN_DETECTED = "MALWARE_PATTERN_DETECTED",

PASSWORD_PROTECTED = "PASSWORD_PROTECTED",

  INVALID_HEADER = "INVALID_HEADER",

  INVALID_VERSION = "INVALID_VERSION",

  INVALID_XREF = "INVALID_XREF",

  INVALID_TRAILER = "INVALID_TRAILER",

  INVALID_OBJECT_TREE = "INVALID_OBJECT_TREE",

  INVALID_PAGE_TREE = "INVALID_PAGE_TREE",

  INVALID_FONT = "INVALID_FONT",

  INVALID_METADATA = "INVALID_METADATA",

  INVALID_INCREMENTAL_UPDATE = "INVALID_INCREMENTAL_UPDATE",

  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

//
// ============================================================
// Validator Interface
// ============================================================
//

export interface IValidator {
  readonly gate: ValidationGate;

  readonly rule: ValidationRule;
}

//
// ============================================================
// Immutable Helper Type
// ============================================================
//

export type ReadonlyValidator<T> = Readonly<T>;
