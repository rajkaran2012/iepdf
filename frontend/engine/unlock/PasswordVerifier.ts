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
 * =============================================================================
 */

import {
    getDocument,
    PasswordResponses,
} from "pdfjs-dist";

import type { PDFDocumentLoadingTask } from "pdfjs-dist";

import type { UnlockResult } from "./UnlockResult";

export class PasswordVerifier {

    public async verify(
        file: File,
        password: string
    ): Promise<UnlockResult> {

        const bytes = await file.arrayBuffer();

        let loadingTask: PDFDocumentLoadingTask | null = null;

        try {

            loadingTask = getDocument({

                data: bytes,

                password,

            });

            const pdf = await loadingTask.promise;

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

            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error
            ) {

                const code =
                    (error as { code: number }).code;

                if (
                    code === PasswordResponses.INCORRECT_PASSWORD
                ) {

                    return {

                        success: false,

                        passwordRequired: true,

                        passwordAccepted: false,

                        document: null,

                        message: "Incorrect password.",

                    };

                }

                if (
                    code === PasswordResponses.NEED_PASSWORD
                ) {

                    return {

                        success: false,

                        passwordRequired: true,

                        passwordAccepted: false,

                        document: null,

                        message: "Password required.",

                    };

                }

            }

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

            if (loadingTask) {

                loadingTask.destroy();

            }

        }

    }

}