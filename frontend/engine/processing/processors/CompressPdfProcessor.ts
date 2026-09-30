/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : CompressPdfProcessor.ts
 * Module     : Processing
 * Layer      : Browser-first / Server-backed Fallback
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Browser-first PDF compression boundary.
 *
 * Canonical validation is enforced by BasePdfProcessor before this processor
 * reaches processCore().
 *
 * Browser compression is attempted first through BrowserPdfCompressor.
 * If the browser result is rejected or the browser engine fails, the original
 * PDF is sent to the backend Ghostscript compression service.
 * =============================================================================
 */

import { API_URL } from "@/lib/api";

import { BasePdfProcessor } from "./BasePdfProcessor";
import { BrowserPdfCompressor } from "@/engine/compression/BrowserPdfCompressor";

import type { ProcessingContext } from "../ProcessingContext";
import type { ProcessingResult } from "../results/ProcessingResult";

export class CompressPdfProcessor extends BasePdfProcessor {

    protected override async processCore(
        context: ProcessingContext
    ): Promise<ProcessingResult> {

        const workspaceFile =
            context.files.find(
                file =>
                    !file.skipped &&
                    file.status !== "corrupted"
            );

        if (!workspaceFile) {

            return {
                success: false,
                error: "No valid PDF file available for compression."
            };

        }

        /*
         * ---------------------------------------------------------------------
         * C-31: Browser-first compression
         * ---------------------------------------------------------------------
         */

        try {

            const browserResult =
                await new BrowserPdfCompressor().compress(
                    workspaceFile.file
                );

            if (
                browserResult.accepted &&
                browserResult.outputFile
            ) {

                return {
                    success: true,
                    outputFile:
                        browserResult.outputFile
                };

            }

        } catch (_error: unknown) {

            /*
             * Browser compression is an optimization path.
             *
             * Any browser-side failure must fall through to the
             * established Ghostscript backend fallback.
             */

        }

        /*
         * ---------------------------------------------------------------------
         * Existing Ghostscript fallback
         * ---------------------------------------------------------------------
         */

        const formData =
            new FormData();

        formData.append(
            "file",
            workspaceFile.file
        );

        let response: Response;

        try {

            response =
                await fetch(
                    `${API_URL}/compress-pdf`,
                    {
                        method: "POST",
                        body: formData
                    }
                );

        } catch (_error: unknown) {

            return {
                success: false,
                error: "Unable to connect to the compression service."
            };

        }

        if (!response.ok) {

            let message =
                "Compression failed.";

            try {

                const errorBody =
                    await response.json();

                if (
                    errorBody &&
                    typeof errorBody.detail === "string" &&
                    errorBody.detail.length > 0
                ) {

                    message =
                        errorBody.detail;

                }

            } catch (_error: unknown) {

                // Keep the controlled fallback message.

            }

            return {
                success: false,
                error: message
            };

        }

        const blob =
            await response.blob();

        if (
            blob.size === 0
        ) {

            return {
                success: false,
                error: "Compression service returned an empty PDF."
            };

        }

        const outputFile =
            new File(
                [blob],
                "compressed.pdf",
                {
                    type: "application/pdf"
                }
            );

        return {
            success: true,
            outputFile
        };

    }

}
