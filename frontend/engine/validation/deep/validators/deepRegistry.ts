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
 * 3. XRef
 * 4. Trailer
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

import {
    XrefValidator
} from "./xrefValidator";

import {
    TrailerValidator
} from "./trailerValidator";

import {
    ObjectTreeValidator
} from "./objectTreeValidator";

import {
    PageTreeValidator
} from "./pageTreeValidator";

import {
    FontValidator
} from "./fontValidator";

import {
    MetadataValidator
} from "./metadataValidator";

import {
    IncrementalUpdateValidator
} from "./incrementalUpdateValidator";


export class DeepValidatorRegistry {

    /**
     * =========================================================================
     * Header detector dependency
     * =========================================================================
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
     * Header → Version → XRef → Trailer
     */
    private static readonly validators:
        readonly IValidator[] =
        Object.freeze([

            new HeaderValidator(
                DeepValidatorRegistry.headerDetector
            ),

            new VersionValidator(),

            new XrefValidator(),

            new TrailerValidator(),

            new ObjectTreeValidator(),

            new PageTreeValidator(),

            new FontValidator(),

            new MetadataValidator(),

            new IncrementalUpdateValidator(),

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
