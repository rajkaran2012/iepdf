/**
 * =============================================================================
 * iePDF Browser Engine
 * =============================================================================
 *
 * File        : index.ts
 * Module      : Validation Engine
 * Layer       : Common
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Public API for the Validation Common module.
 *
 * This barrel file exposes ONLY the public contracts, utilities,
 * constants, exceptions, and logger required by other modules.
 *
 * Consumers MUST import from this file instead of importing
 * individual implementation files directly.
 *
 * Example:
 *
 * import {
 *   ValidationUtils,
 *   ValidationLogger,
 *   ValidationException,
 * } from "@/engine/validation/common";
 *
 * =============================================================================
 */

/* ============================================================================
 * Validator Contract
 * ========================================================================== */

export * from "./validator";

/* ============================================================================
 * Constants
 * ========================================================================== */

export * from "./validationConstants";

/* ============================================================================
 * Exceptions
 * ========================================================================== */

export * from "./validationException";

/* ============================================================================
 * Logger
 * ========================================================================== */

export * from "./validationLogger";

/* ============================================================================
 * Utilities
 * ========================================================================== */

export * from "./validationUtils";