/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : CompressPdfProcessor.ts
 * Module     : Processing
 * Layer      : Server-backed Processor
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Browser-side processing boundary for PDF compression.
 *
 * Canonical validation is enforced by BasePdfProcessor before this processor
 * reaches processCore().
 *
 * Actual PDF recompression is delegated to the backend Ghostscript engine.
 * =============================================================================
 */

import { API_URL } from "@/lib/api";

import { BasePdfProcessor } from "./BasePdfProcessor";

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
