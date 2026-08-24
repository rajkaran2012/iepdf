/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : PasswordVerifier.ts
 * Module     : Unlock
 * Layer      : Service
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Verifies whether a password can successfully open an encrypted PDF using
 * PDF.js.
 *
 * This class NEVER merges PDFs.
 * It ONLY verifies passwords.
 *
 * -----------------------------------------------------------------------------
 * Architecture
 * -----------------------------------------------------------------------------
 * PDF.js is loaded dynamically at runtime.
 *
 * This is intentional.
 *
 * It prevents PDF.js browser APIs such as DOMMatrix from being evaluated
 * during Next.js server-side rendering / prerendering.
 * =============================================================================
 */

import type { PDFDocumentLoadingTask } from "pdfjs-dist";

import type { UnlockResult } from "./UnlockResult";

export class PasswordVerifier {

    /**
     * =========================================================================
     * Verify PDF Password
     * =========================================================================
     */
    public async verify(
        file: File,
        password: string
    ): Promise<UnlockResult> {

        const bytes =
            await file.arrayBuffer();

        let loadingTask:
            PDFDocumentLoadingTask | null = null;

        try {

            /**
             * =================================================================
             * Load PDF.js only at runtime.
             *
             * IMPORTANT:
             * Do NOT move this import to the top of this file.
             *
             * PDF.js depends on browser APIs such as DOMMatrix.
             * Dynamic loading keeps it out of the Next.js server
             * prerendering path.
             * =================================================================
             */
            const {
                getDocument,
                PasswordResponses,
            } = await import("pdfjs-dist");

            loadingTask =
                getDocument({

                    data: bytes,

                    password,

                });

            const pdf =
                await loadingTask.promise;

            await pdf.destroy();

            return {

                success: true,

                passwordRequired: true,

                passwordAccepted: true,

                document: null,

                message: null,

            };

        }
        catch (error: unknown) {

            /**
             * ================================================================
             * PDF.js password errors
             * ================================================================
             */
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error
            ) {

                const code =
                    (error as { code: number }).code;

                /**
                 * Incorrect password.
                 */
                if (
                    code === 2
                ) {

                    return {

                        success: false,

                        passwordRequired: true,

                        passwordAccepted: false,

                        document: null,

                        message:
                            "Incorrect password.",

                    };

                }

                /**
                 * Password required.
                 */
                if (
                    code === 1
                ) {

                    return {

                        success: false,

                        passwordRequired: true,

                        passwordAccepted: false,

                        document: null,

                        message:
                            "Password required.",

                    };

                }

            }

            /**
             * ================================================================
             * Unknown PDF.js / PDF error
             * ================================================================
             */
            return {

                success: false,

                passwordRequired: false,

                passwordAccepted: false,

                document: null,

                message:
                    error instanceof Error
                        ? error.message
                        : "Unknown error.",

            };

        }
        finally {

            /**
             * ================================================================
             * Ensure PDF.js loading task is destroyed.
             * ================================================================
             */
            if (loadingTask) {

                try {

                    await loadingTask.destroy();

                }
                catch {

                    // Ignore cleanup errors.

                }

            }

        }

    }

}