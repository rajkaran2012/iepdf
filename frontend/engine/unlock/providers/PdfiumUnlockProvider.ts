/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : PdfiumUnlockProvider.ts
 * Module     : Unlock
 * Layer      : Provider Implementation
 *
 * Purpose
 * -------
 * Browser-side unlock provider backed by the protected PDF engine.
 *
 * PDFium remains the authoritative source for encryption state.
 * =============================================================================
 */

import type { IUnlockProvider }
    from "./IUnlockProvider";

import type { UnlockedPdfResult }
    from "../UnlockedPdfResult";

import {
    ProtectedPdfStatus,
} from "@/engine/protected/models/ProtectedPdfStatus";

import type {
    IProtectedPdfEngine,
} from "@/engine/protected/interfaces/IProtectedPdfEngine";

export class PdfiumUnlockProvider
    implements IUnlockProvider {

    public constructor(
        private readonly protectedPdfEngine:
            IProtectedPdfEngine
    ) {
    }

    public async unlock(
        file: File,
        password: string
    ): Promise<UnlockedPdfResult> {

        const result =
            await this.protectedPdfEngine.open(
                file,
                password
            );

        if (
            result.status !==
            ProtectedPdfStatus.OPENED
        ) {

            switch (result.status) {

                case ProtectedPdfStatus.PASSWORD_REQUIRED:

                    throw new Error(
                        result.message ??
                        "Password is required."
                    );

                case ProtectedPdfStatus.INVALID_PASSWORD:

                    throw new Error(
                        result.message ??
                        "Invalid PDF password."
                    );

                case ProtectedPdfStatus.OPEN_FAILED:

                    throw new Error(
                        result.message ??
                        "Unable to open protected PDF."
                    );

                default:

                    throw new Error(
                        "Unable to unlock protected PDF."
                    );
            }
        }

        if (result.document === null) {

            throw new Error(
                "Protected PDF opened without a document."
            );
        }

        const document =
            result.document;

        try {

            /**
             * ================================================================
             * AUTHORITATIVE ENCRYPTION STATE
             * ================================================================
             */
            const authorization =
                await this.protectedPdfEngine
                    .inspectAuthorization(
                        document
                    );

            /**
             * ================================================================
             * NORMAL / UNENCRYPTED PDF
             * ================================================================
             *
             * A password may have been supplied by the caller, but that does
             * NOT mean the source PDF is encrypted.
             *
             * Return the original bytes and report the real state.
             */
            if (!authorization.encrypted) {

                return {

                    bytes:
                        await file.arrayBuffer(),

                    encrypted:
                        false,

                };

            }

            /**
             * ================================================================
             * ENCRYPTED PDF
             * ================================================================
             */
            if (
                !authorization.encryptionRemovalAllowed
            ) {

                throw new Error(
                    "PDF encryption removal is not authorized."
                );
            }

            const removed =
                await this.protectedPdfEngine
                    .removeEncryption(
                        document
                    );

            if (!removed) {

                throw new Error(
                    "Unable to remove PDF encryption."
                );
            }

            const bytes =
                await this.protectedPdfEngine
                    .saveAsCopy(
                        document
                    );

            return {

                bytes,

                encrypted:
                    true,

            };

        }
        finally {

            await this.protectedPdfEngine.close(
                document
            );

        }

    }

}
