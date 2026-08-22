/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : deepRegistry.ts
 * Module     : Deep Validation
 * Layer      : Registry
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Registers Deep Validation validators in deterministic execution order.
 *
 * Current implemented Deep rules:
 *
 * 1. Header
 * 2. Version
 *
 * This registry:
 *
 * - Creates validator instances.
 * - Defines execution order.
 * - Returns an immutable validator collection.
 *
 * It does NOT:
 *
 * - Read PDF bytes.
 * - Parse PDF structures.
 * - Perform validation.
 * - Handle UI logic.
 * - Handle validation results.
 *
 * =============================================================================
 */

import type {
    IValidator
} from "../../common/validator";

import {
    HeaderDetector
} from "../detectors/headerDetector";

import {
    HeaderValidator
} from "../headerValidator";

import {
    VersionValidator
} from "../versionValidator";


export class DeepValidatorRegistry {

    /**
     * =========================================================================
     * Header detector dependency
     * =========================================================================
     *
     * HeaderValidator requires an IHeaderDetector.
     */
    private static readonly headerDetector =
        new HeaderDetector();


    /**
     * =========================================================================
     * Deep validators
     * =========================================================================
     *
     * Execution order:
     *
     * Header → Version
     *
     * VersionValidator currently owns its stateless VersionDetector internally,
     * therefore no VersionDetector dependency is injected here.
     */
    private static readonly validators:
        readonly IValidator[] =
        Object.freeze([

            new HeaderValidator(
                DeepValidatorRegistry.headerDetector
            ),

            new VersionValidator(),

        ]);


    /**
     * =========================================================================
     * Get Validators
     * =========================================================================
     *
     * Returns the immutable Deep Validation validator collection.
     */
    public static getValidators():
        readonly IValidator[] {

        return this.validators;

    }

}