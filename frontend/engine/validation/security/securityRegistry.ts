/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : securityRegistry.ts
 * Module     : Security Validation
 * Layer      : Registry
 * =============================================================================
 */

import { IValidator } from "../common/validator";

import { PasswordProtectionValidator } from "./passwordProtectionValidator";

export class SecurityValidatorRegistry {

    private static readonly validators: readonly IValidator[] =
        Object.freeze([]);

    public static getValidators(): readonly IValidator[] {

        return this.validators;

    }

}