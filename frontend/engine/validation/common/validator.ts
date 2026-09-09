77/**
 * =============================================================================
 * iePDF Browser Engine
 * =============================================================================
 *
 * File        : validator.ts
 * Module      : Validation Engine
 * Layer       : Common
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the base contract for every validator in the iePDF Validation Engine.
 *
 * Every validator MUST implement this interface.
 *
 * Boundary Validators
 * -------------------
 * • File Size
 * • Extension
 * • Magic Number
 * • Filename
 * • MIME
 *
 * Security Validators
 * -------------------
 * • JavaScript
 * • Launch Actions
 * • Embedded Files
 * • Encryption
 * • Malware Patterns
 * • Password Detection
 *
 * Deep Validators
 * ---------------
 * • Header
 * • Version
 * • XREF
 * • Trailer
 * • Object Tree
 * • Page Tree
 * • Fonts
 * • Metadata
 * • Incremental Updates
 *
 * -----------------------------------------------------------------------------
 * Design Principles
 * -----------------------------------------------------------------------------
 * ✓ Browser First
 * ✓ Client First
 * ✓ Single Responsibility
 * ✓ Open / Closed Principle
 * ✓ Strong Typing
 * ✓ Dependency Inversion
 * ✓ Backward Compatible
 * ✓ Enterprise Ready
 *
 * -----------------------------------------------------------------------------
 * IMPORTANT
 * -----------------------------------------------------------------------------
 * This file contains ONLY contracts.
 *
 * NO:
 *   • Validation Logic
 *   • Browser API Calls
 *   • PDF Parsing
 *   • Business Logic
 * =============================================================================
 */

import type { ValidationContext } from "../pipeline/validationContext";
import type { ValidationResult } from "../pipeline/validationResult";
import {
  ValidationGate,
  ValidationRule,
} from "../pipeline/validationTypes";


/**
 * Base contract implemented by every validator.
 */
export interface IValidator {
  /**
   * Validation gate this validator belongs to.
   */
  readonly gate: ValidationGate;

  /**
   * Validation rule implemented by this validator.
   */
  readonly rule: ValidationRule;

  /**
   * Human-readable validator name.
   *
   * Example:
   * File Size Validator
   */
  readonly name: string;

  /**
   * Short description of the validator.
   */
  readonly description: string;

  /**
   * Determines whether this validator is currently enabled.
   *
   * Future:
   * • Feature Flags
   * • Capability Engine
   * • Enterprise Edition
   */
  readonly enabled: boolean;

  /**
   * Executes validation.
   *
   * Must NEVER throw uncaught exceptions.
   *
   * All failures must be converted into ValidationResult.
   */
  validate(
    context: ValidationContext
  ): Promise<ValidationResult>;
}

/**
 * Read-only collection of validators.
 */
export type ValidatorCollection = ReadonlyArray<IValidator>;
