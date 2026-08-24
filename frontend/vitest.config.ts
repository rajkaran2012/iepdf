/**
 * =============================================================================
 * iePDF Test Configuration
 * =============================================================================
 *
 * File       : vitest.config.ts
 * Module     : Test Infrastructure
 *
 * Purpose
 * ---------------------------------------------------------------------------
 * Configuration for iePDF Validation Engine unit and security tests.
 *
 * Security principles
 * ---------------------------------------------------------------------------
 * - Node environment for deterministic engine tests.
 * - No browser DOM dependency.
 * - No production code modification.
 * - Test files remain outside the production application bundle.
 * =============================================================================
 */

import {
    defineConfig
} from "vitest/config";

import {
    fileURLToPath
} from "node:url";

import {
    dirname,
    resolve
} from "node:path";


const rootDirectory =
    dirname(
        fileURLToPath(
            import.meta.url
        )
    );


export default defineConfig({

    resolve: {

        alias: {

            "@":
                resolve(
                    rootDirectory,
                    "."
                ),

        },

    },

    test: {

        environment:
            "node",

        globals:
            false,

        clearMocks:
            true,

        restoreMocks:
            true,

        mockReset:
            true,

        testTimeout:
            10_000,

        include: [

            "tests/**/*.test.ts",

            "tests/**/*.spec.ts",

        ],

        exclude: [

            "node_modules/**",

            ".next/**",

        ],

    },

});