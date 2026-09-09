/**
 * =============================================================================
 * iePDF Protected Document Engine
 * =============================================================================
 *
 * File       : PdfiumProtectedPdfEngine.ts
 * Module     : Protected Document
 * Layer      : PDFium Adapter
 *
 * Purpose
 * -------
 * Adapts EmbedPDF/PDFium to the technology-independent
 * IProtectedPdfEngine contract.
 *
 * Responsibilities
 * ----------------
 * - Initialize PDFium
 * - Open PDF documents
 * - Pass passwords to PDFium
 * - Map PDFium password errors
 * - Inspect protected PDF authorization
 * - Remove encryption only when authorized
 * - Save opened documents
 * - Close opened documents
 * - Destroy the PDFium engine
 *
 * This class contains NO UI logic.
 * This class contains NO merge logic.
 * =============================================================================
 */

import {
    createPdfiumDirectEngine,
} from "@embedpdf/engines";

import type {
    PdfEngine,
} from "@embedpdf/engines";

import type {
    PdfDocumentObject,
    PdfFile,
} from "@embedpdf/models";

import {
    ProtectedPdfStatus,
} from "../models/ProtectedPdfStatus";

import type {
    ProtectedPdfOpenResult,
} from "../models/ProtectedPdfOpenResult";

import type {
    ProtectedPdfAuthorization,
} from "../models/ProtectedPdfAuthorization";

import type {
    IProtectedPdfEngine,
} from "../interfaces/IProtectedPdfEngine";

import type {
    IProtectedPdfDocument,
} from "../interfaces/IProtectedPdfDocument";

import {
    PdfiumProtectedPdfDocument,
} from "./PdfiumProtectedPdfDocument";


export class PdfiumProtectedPdfEngine
    implements IProtectedPdfEngine {


    private engine:
        PdfEngine<Blob> | null = null;


    /**
     * PDFium WASM location.
     *
     * This is intentionally configurable through the constructor.
     */
    private readonly wasmUrl: string;


    public constructor(
        wasmUrl: string = "/wasm/pdfium.wasm"
    ) {

        this.wasmUrl =
            wasmUrl;

    }


    /**
     * Initializes PDFium.
     */
    private async initialize(): Promise<
        PdfEngine<Blob>
    > {

        if (this.engine !== null) {

            return this.engine;

        }

        this.engine =
            await createPdfiumDirectEngine(
                this.wasmUrl
            );

        return this.engine;

    }


    /**
     * =========================================================================
     * Protected PDF Authorization
     * =========================================================================
     *
     * Returns technology-independent authorization information for an
     * already-opened protected document.
     *
     * PDFium-specific permission values never leave this adapter.
     * =========================================================================
     */
    public async inspectAuthorization(
        document: IProtectedPdfDocument
    ): Promise<ProtectedPdfAuthorization> {

        if (
            !(document instanceof PdfiumProtectedPdfDocument)
        ) {

            throw new Error(
                "Unsupported protected PDF document implementation."
            );

        }

        const engine =
            await this.initialize();

        const internalDocument =
            document.getInternalDocument();

        const encrypted =
            await engine
                .isEncrypted(
                    internalDocument
                )
                .toPromise();

        const ownerUnlocked =
            await engine
                .isOwnerUnlocked(
                    internalDocument
                )
                .toPromise();

        return {

            encrypted,

            ownerUnlocked,

            encryptionRemovalAllowed:
                encrypted &&
                ownerUnlocked,

        };

    }


    /**
     * =========================================================================
     * Protected PDF Encryption Removal
     * =========================================================================
     *
     * Encryption removal is an authorization-controlled operation.
     *
     * Authorization is checked inside this method before PDFium is
     * instructed to remove encryption.
     *
     * This prevents callers from bypassing the authorization requirement
     * by calling removeEncryption() directly.
     * =========================================================================
     */
    public async removeEncryption(
        document: IProtectedPdfDocument
    ): Promise<boolean> {

        if (
            !(document instanceof PdfiumProtectedPdfDocument)
        ) {

            throw new Error(
                "Unsupported protected PDF document implementation."
            );

        }

        const authorization =
            await this.inspectAuthorization(
                document
            );

        if (
            !authorization.encryptionRemovalAllowed
        ) {

            return false;

        }

        const engine =
            await this.initialize();

        const internalDocument =
            document.getInternalDocument();

        return await engine
            .removeEncryption(
                internalDocument
            )
            .toPromise();

    }


    /**
     * =========================================================================
     * Open Protected PDF
     * =========================================================================
     *
     * Password handling policy
     * ------------------------
     *
     * Do NOT reject an empty password before opening.
     *
     * PDFium must determine whether the document:
     *
     * - opens without a password
     * - requires a password
     * - rejects the supplied password
     * - is invalid/corrupted/unsupported
     *
     * This is important because an unprotected PDF must successfully
     * open even when no password is supplied.
     * =========================================================================
     */
    public async open(
        file: File,
        password?: string
    ): Promise<ProtectedPdfOpenResult> {

        const suppliedPassword =
            typeof password === "string" &&
            password.trim().length > 0;


        try {

            const engine =
                await this.initialize();

            const bytes =
                await file.arrayBuffer();


            /**
             * PDFium expects PdfFile.content to be ArrayBuffer.
             */
            const pdfFile: PdfFile = {

                id:
                    crypto.randomUUID(),

                content:
                    bytes,

            };


            /**
             * Only provide the password option when the caller
             * actually supplied one.
             *
             * This allows PDFium to distinguish:
             *
             * no password
             * versus
             * supplied password.
             */
            const openOptions =
                suppliedPassword
                    ? {
                        password:
                            password!.trim(),
                    }
                    : undefined;


            const task =
                engine.openDocumentBuffer(
                    pdfFile,
                    openOptions
                );


            const pdfDocument:
                PdfDocumentObject =
                    await task.toPromise();


            const document =
                new PdfiumProtectedPdfDocument(
                    pdfFile.id,
                    pdfDocument
                );


            return {

                status:
                    ProtectedPdfStatus.OPENED,

                document,

                pageCount:
                    document.pageCount,

                message: null,

            };

        }
        catch (error: unknown) {

            /**
             * PDFium PdfErrorCode.Password = 4.
             *
             * The meaning depends on whether a password was
             * supplied by the caller.
             *
             * No password:
             *     PASSWORD_REQUIRED
             *
             * Password supplied:
             *     INVALID_PASSWORD
             */
            if (
                this.isPdfiumPasswordError(
                    error
                )
            ) {

                return {

                    status:
                        suppliedPassword
                            ? ProtectedPdfStatus.INVALID_PASSWORD
                            : ProtectedPdfStatus.PASSWORD_REQUIRED,

                    document: null,

                    pageCount: 0,

                    message:
                        suppliedPassword
                            ? "Invalid PDF password."
                            : "Password is required.",

                };

            }


            /**
             * All other PDFium failures are converted
             * to a controlled application-level message.
             */
            return {

                status:
                    ProtectedPdfStatus.OPEN_FAILED,

                document: null,

                pageCount: 0,

                message:
                    this.getErrorMessage(
                        error
                    ),

            };

        }

    }


    /**
     * =========================================================================
     * Save As Copy
     * =========================================================================
     *
     * Saves a PDFium document as a new PDF.
     *
     * IMPORTANT:
     * The return value is the native ArrayBuffer returned by PDFium.
     *
     * No additional conversion or normalization is performed here.
     * =========================================================================
     */
    public async saveAsCopy(
        document: IProtectedPdfDocument
    ): Promise<ArrayBuffer> {

        const pdfiumDocument =
            this.getPdfiumDocument(
                document
            );

        const engine =
            await this.initialize();

        const task =
            engine.saveAsCopy(
                pdfiumDocument
            );

        return await task.toPromise();

    }


    /**
     * =========================================================================
     * Close
     * =========================================================================
     *
     * Closes one PDF document.
     * =========================================================================
     */
    public async close(
        document: IProtectedPdfDocument
    ): Promise<void> {

        const pdfiumDocument =
            this.getPdfiumDocument(
                document
            );

        const engine =
            await this.initialize();

        const task =
            engine.closeDocument(
                pdfiumDocument
            );

        await task.toPromise();

    }


    /**
     * =========================================================================
     * Destroy
     * =========================================================================
     *
     * Destroys PDFium.
     * =========================================================================
     */
    public async destroy(): Promise<void> {

        if (this.engine === null) {

            return;

        }


        const engine =
            this.engine;


        this.engine =
            null;


        try {

            await engine.destroy();

        }
        catch {

            /**
             * Cleanup must not hide the original
             * processing error.
             */

        }

    }


    /**
     * =========================================================================
     * Internal PDFium Document Access
     * =========================================================================
     *
     * Returns the internal PDFium document.
     *
     * PDFium implementation details remain inside this adapter.
     * =========================================================================
     */
    private getPdfiumDocument(
        document: IProtectedPdfDocument
    ): PdfDocumentObject {

        if (
            !(document instanceof
                PdfiumProtectedPdfDocument)
        ) {

            throw new Error(
                "Unsupported protected PDF document implementation."
            );

        }

        return document.getInternalDocument();

    }


    /**
     * =========================================================================
     * PDFium Password Error Detection
     * =========================================================================
     *
     * Determines whether the error represents
     * a PDFium password failure.
     * =========================================================================
     */
    private isPdfiumPasswordError(
        error: unknown
    ): boolean {

        if (
            typeof error !== "object" ||
            error === null
        ) {

            return false;

        }


        if (
            "code" in error &&
            typeof (
                error as {
                    code?: unknown;
                }
            ).code === "number"
        ) {

            return (
                (
                    error as {
                        code: number;
                    }
                ).code === 4
            );

        }


        /**
         * Some EmbedPDF task failures may wrap
         * the PDFium error inside a nested value.
         */
        if (
            "reason" in error
        ) {

            const reason =
                (
                    error as {
                        reason?: unknown;
                    }
                ).reason;


            if (
                typeof reason === "object" &&
                reason !== null &&
                "code" in reason &&
                typeof (
                    reason as {
                        code?: unknown;
                    }
                ).code === "number"
            ) {

                return (
                    (
                        reason as {
                            code: number;
                        }
                    ).code === 4
                );

            }

        }


        return false;

    }


    /**
     * =========================================================================
     * Safe Error Message
     * =========================================================================
     *
     * Converts an unknown error into a safe application-level message.
     * =========================================================================
     */
    private getErrorMessage(
        error: unknown
    ): string {

        if (
            error instanceof Error
        ) {

            return error.message;

        }


        if (
            typeof error === "object" &&
            error !== null &&
            "message" in error
        ) {

            const message =
                (
                    error as {
                        message?: unknown;
                    }
                ).message;


            if (
                typeof message === "string"
            ) {

                return message;

            }

        }


        return "Unable to open PDF.";

    }

}