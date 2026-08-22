/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : gateway.infrastructure.test.ts
 * Module     : Validation Gateway Tests
 *
 * Purpose
 * ---------------------------------------------------------------------------
 * Verifies that the Vitest infrastructure can load the canonical Validation
 * Gateway without executing a PDF processing operation.
 * =============================================================================
 */

import {
    describe,
    expect,
    it,
} from "vitest";

import {
    ValidationGateway,
} from "@/engine/validation/gateway/ValidationGateway";


describe(
    "Validation Gateway — infrastructure",
    () => {

        it(
            "constructs the canonical ValidationGateway",
            () => {

                const gateway =
                    new ValidationGateway();

                expect(
                    gateway
                ).toBeInstanceOf(
                    ValidationGateway
                );

            }
        );

    }
);