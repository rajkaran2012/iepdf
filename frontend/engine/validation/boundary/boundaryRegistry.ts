/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : boundaryValidatorRegistry.ts
 * Module     : Boundary Validation
 * Layer      : Registry
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Registers all Boundary Gate validators in their execution order.
 *
 * This registry:
 * • Creates validator instances
 * • Defines execution order
 * • Returns an immutable collection
 *
 * It MUST NOT:
 * • Perform validation
 * • Contain business logic
 * • Handle exceptions
 * =============================================================================
 */

import { IValidator } from "../common/validator";

import { FileSizeValidator } from "./fileSizeValidator";
import { FileCountValidator } from "./fileCountValidator";
import { ExtensionValidator } from "./extensionValidator";
import { MimeTypeValidator } from "./mimeTypeValidator";
import { MagicNumberValidator } from "./magicNumberValidator";
import { FileNameValidator } from "./filenameValidator";

export class BoundaryValidatorRegistry {

    private static readonly validators: readonly IValidator[] = Object.freeze([

    new FileCountValidator(),

    new FileNameValidator(),

    new ExtensionValidator(),

    new MimeTypeValidator(),

    new MagicNumberValidator(),

    new FileSizeValidator(),

]);

    public static getValidators(): readonly IValidator[] {

        return this.validators;

    }

}