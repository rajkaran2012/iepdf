import { BrowserPdfUnlockAdapter } from "@/engine/unlock/adapter/BrowserPdfUnlockAdapter";
import { BrowserPdfDocument } from "@/engine/pdf/BrowserPdfDocument";

import { PdfiumProtectedPdfEngine } from "@/engine/protected/pdfium/PdfiumProtectedPdfEngine";
import { PdfiumUnlockProvider } from "@/engine/unlock/providers/PdfiumUnlockProvider";

import { ProtectedPdfStatus } from "@/engine/protected/models/ProtectedPdfStatus";

import { PdfErrorCode } from "@/engine/processing/errors/PdfErrorCode";
import { PdfErrorMapper } from "@/engine/processing/errors/PdfErrorMapper";

import type { BrowserPdfLoadResult } from "@/engine/processing/results/BrowserPdfLoadResult";

export class BrowserPdfLoader {

    private readonly protectedPdfEngine =
        new PdfiumProtectedPdfEngine();

    private readonly unlockProvider =
        new PdfiumUnlockProvider(
            this.protectedPdfEngine
        );

    private readonly unlockAdapter =
        new BrowserPdfUnlockAdapter(
            this.unlockProvider
        );

    public async load(
        file: File,
        password?: string
    ): Promise<BrowserPdfLoadResult> {

        try {

            let buffer: ArrayBuffer;

            let encrypted = false;

            let passwordAccepted = false;

            const suppliedPassword =
                typeof password === "string" &&
                password.trim().length > 0;

            /**
             * ================================================================
             * PASSWORD SUPPLIED
             * ================================================================
             */
            if (suppliedPassword) {

                const unlockResult =
                    await this.unlockAdapter.createUnlockedBytes(
                        file,
                        password!.trim()
                    );

                buffer =
                    unlockResult.bytes;

                encrypted =
                    unlockResult.encrypted;

                /**
                 * A password was successfully processed by the provider.
                 *
                 * For an encrypted PDF it was accepted.
                 *
                 * For an unencrypted PDF no password was actually required.
                 */
                passwordAccepted =
                    encrypted;

            }
            /**
             * ================================================================
             * NO PASSWORD
             * ================================================================
             */
            else {

                const openResult =
                    await this.protectedPdfEngine.open(
                        file
                    );

                if (
                    openResult.status ===
                    ProtectedPdfStatus.PASSWORD_REQUIRED
                ) {

                    return {

                        success: false,

                        document: null,

                        pageCount: 0,

                        encrypted: true,

                        passwordRequired: true,

                        passwordAccepted: false,

                        errorCode:
                            PdfErrorCode.PASSWORD_REQUIRED,

                        message:
                            openResult.message ??
                            "Password is required."

                    };

                }

                if (
                    openResult.status !==
                    ProtectedPdfStatus.OPENED
                ) {

                    return {

                        success: false,

                        document: null,

                        pageCount: 0,

                        encrypted: false,

                        passwordRequired: false,

                        passwordAccepted: false,

                        errorCode:
                            PdfErrorCode.LOAD_FAILED,

                        message:
                            openResult.message ??
                            "Unable to open PDF."

                    };

                }

                /**
                 * PDFium successfully opened the document without a password.
                 *
                 * Therefore the source PDF is not password-protected.
                 */
                encrypted = false;

                passwordAccepted = false;

                if (
                    openResult.document !== null
                ) {

                    await this.protectedPdfEngine.close(
                        openResult.document
                    );

                }

                buffer =
                    await file.arrayBuffer();

            }

            /**
             * ================================================================
             * BASIC PDF HEADER VALIDATION
             * ================================================================
             */
            const header =
                new TextDecoder()
                    .decode(
                        buffer.slice(0, 5)
                    );

            if (header !== "%PDF-") {

                return {

                    success: false,

                    document: null,

                    pageCount: 0,

                    encrypted,

                    passwordRequired: false,

                    passwordAccepted: false,

                    errorCode:
                        PdfErrorCode.INVALID_PDF,

                    message:
                        "Invalid PDF file."

                };

            }

            /**
             * ================================================================
             * LOAD THROUGH BROWSER PDF DOCUMENT
             * ================================================================
             */
            const document =
                new BrowserPdfDocument();

            await document.load(
                buffer
            );

            return {

                success: true,

                document,

                pageCount:
                    document.getPageCount(),

                encrypted,

                passwordRequired: false,

                passwordAccepted,

                errorCode:
                    PdfErrorCode.NONE,

                message:
                    null

            };

        }
        catch (error) {

            const errorCode =
                PdfErrorMapper.map(
                    error
                );

            return {

                success: false,

                document: null,

                pageCount: 0,

                encrypted:
                    errorCode ===
                    PdfErrorCode.PASSWORD_REQUIRED ||
                    errorCode ===
                    PdfErrorCode.INVALID_PASSWORD,

                passwordRequired:
                    errorCode ===
                    PdfErrorCode.PASSWORD_REQUIRED,

                passwordAccepted: false,

                errorCode,

                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to load PDF."

            };

        }

    }

}
