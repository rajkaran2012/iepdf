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

            const suppliedPassword =
                typeof password === "string" &&
                password.trim().length > 0;

            /*
             * ================================================================
             * PASSWORD SUPPLIED
             * ================================================================
             *
             * Password handling deliberately remains on the PDFium path.
             */
            if (suppliedPassword) {

                const unlockResult =
                    await this.unlockAdapter.createUnlockedBytes(
                        file,
                        password!.trim()
                    );

                const buffer =
                    unlockResult.bytes;

                const encrypted =
                    unlockResult.encrypted;

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

                    passwordAccepted:
                        encrypted,

                    errorCode:
                        PdfErrorCode.NONE,

                    message:
                        null

                };

            }

            /*
             * ================================================================
             * NORMAL BROWSER-FIRST LOAD
             * ================================================================
             *
             * IMPORTANT:
             *
             * Do NOT initialize PDFium here.
             *
             * Normal PDFs should be handled directly by pdf-lib.
             */
            const buffer =
                await file.arrayBuffer();

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

                    encrypted: false,

                    passwordRequired: false,

                    passwordAccepted: false,

                    errorCode:
                        PdfErrorCode.INVALID_PDF,

                    message:
                        "Invalid PDF file."

                };

            }

            const document =
                new BrowserPdfDocument();

            try {

                await document.load(
                    buffer
                );

                return {

                    success: true,

                    document,

                    pageCount:
                        document.getPageCount(),

                    encrypted: false,

                    passwordRequired: false,

                    passwordAccepted: false,

                    errorCode:
                        PdfErrorCode.NONE,

                    message:
                        null

                };

            }
            catch (browserLoadError) {

                /*
                 * ============================================================
                 * PDF-LIB FAILED
                 * ============================================================
                 *
                 * Only now do we fall back to PDFium.
                 *
                 * This keeps the normal browser-first path free from
                 * unnecessary PDFium initialization.
                 */
                try {

                    const openResult =
                        await this.protectedPdfEngine.open(
                            file
                        );

                    if (
                        openResult.status ===
                        ProtectedPdfStatus.PASSWORD_REQUIRED
                    ) {

                        if (
                            openResult.document !== null
                        ) {

                            await this.protectedPdfEngine.close(
                                openResult.document
                            );

                        }

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
                                (
                                    browserLoadError instanceof Error
                                        ? browserLoadError.message
                                        : "Unable to load PDF."
                                )

                        };

                    }

                    if (
                        openResult.document !== null
                    ) {

                        await this.protectedPdfEngine.close(
                            openResult.document
                        );

                    }

                    return {

                        success: false,

                        document: null,

                        pageCount: 0,

                        encrypted: false,

                        passwordRequired: false,

                        passwordAccepted: false,

                        errorCode:
                            PdfErrorMapper.map(
                                browserLoadError
                            ),

                        message:
                            browserLoadError instanceof Error
                                ? browserLoadError.message
                                : "Unable to load PDF."

                    };

                }
                catch (pdfiumError) {

                    return {

                        success: false,

                        document: null,

                        pageCount: 0,

                        encrypted: false,

                        passwordRequired: false,

                        passwordAccepted: false,

                        errorCode:
                            PdfErrorMapper.map(
                                browserLoadError
                            ),

                        message:
                            browserLoadError instanceof Error
                                ? browserLoadError.message
                                : (
                                    pdfiumError instanceof Error
                                        ? pdfiumError.message
                                        : "Unable to load PDF."
                                )

                    };

                }

            }

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