/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : BrowserPdfUnlocker.ts
 * Module     : Unlock
 * Layer      : Service
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Coordinates password verification before a protected PDF enters
 * the loading pipeline.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Verify password
 * ✓ Return standardized UnlockResult
 * ✓ No merge logic
 * ✓ No UI logic
 * =============================================================================
 */

import { PasswordVerifier } from "./PasswordVerifier";

import type { UnlockResult } from "./UnlockResult";

export class BrowserPdfUnlocker {

    private readonly verifier =
        new PasswordVerifier();

    /**
     * Attempts to unlock a PDF.
     */
    public async unlock(
        file: File,
        password: string
    ): Promise<UnlockResult> {

        if (!password.trim()) {

            return {

                success: false,

                passwordRequired: true,

                passwordAccepted: false,

                document: null,

                message: "Password is required."

            };

        }

        const result =
            await this.verifier.verify(
                file,
                password
            );

        if (!result.success) {

            return result;

        }

        /**
         * Stage 1:
         * Password has been verified.
         *
         * Stage 2 (next step):
         * BrowserPdfLoader will create a BrowserPdfDocument
         * using this verified password.
         */

        return {

            success: true,

            passwordRequired: true,

            passwordAccepted: true,

            document: null,

            message: null

        };

    }

}