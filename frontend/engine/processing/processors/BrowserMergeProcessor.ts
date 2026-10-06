import { createPdfiumDirectEngine } from "@embedpdf/engines";
import type { PdfFile } from "@embedpdf/models";

import { API_URL } from "@/lib/api";

import { BasePdfProcessor } from "./BasePdfProcessor";

import type { ProcessingContext } from "../ProcessingContext";
import type { ProcessingResult } from "../results/ProcessingResult";

export class BrowserMergeProcessor extends BasePdfProcessor {

    protected override async processCore(
        context: ProcessingContext
    ): Promise<ProcessingResult> {

        const candidates = context.files.filter(
            file =>
                !file.skipped &&
                file.status !== "corrupted"
        );

        if (candidates.length < 2) {
            return {
                success: false,
                error:
                    "At least two valid PDF files are required for merging."
            };
        }

        /*
         * ================================================================
         * BROWSER-FIRST
         * ================================================================
         */

        let engine:
            Awaited<
                ReturnType<typeof createPdfiumDirectEngine>
            > | null = null;

        try {

            engine =
                await createPdfiumDirectEngine(
                    "/wasm/pdfium.wasm"
                );

            const pdfFiles: PdfFile[] = [];

            for (const workspaceFile of candidates) {

                pdfFiles.push({
                    id: crypto.randomUUID(),
                    content:
                        await workspaceFile.file.arrayBuffer()
                });

            }

            try {

                const task =
                    engine.merge(
                        pdfFiles
                    );

                const mergedFile =
                    await task.toPromise();

                if (
                    mergedFile &&
                    mergedFile.content
                ) {

                    return {
                        success: true,

                        outputFile:
                            new File(
                                [mergedFile.content],
                                "iepdf-merged.pdf",
                                {
                                    type:
                                        "application/pdf"
                                }
                            )
                    };

                }

                throw new Error(
                    "PDFium returned an empty merged PDF."
                );

            } catch (browserError) {

                console.warn(
                    "Browser merge failed. Switching to server fallback.",
                    browserError
                );

            }

        } catch (engineError) {

            console.warn(
                "PDFium initialization failed. Switching to server fallback.",
                engineError
            );

        } finally {

            if (engine) {

                try {

                    await engine.destroy();

                } catch (destroyError) {

                    console.warn(
                        "Unable to destroy PDFium engine.",
                        destroyError
                    );

                }

            }

        }

        /*
         * ================================================================
         * SERVER FALLBACK
         * ================================================================
         */

        return await this.mergeOnServer(
            candidates
        );
    }


    /**
     * Server-side merge fallback.
     */
    private async mergeOnServer(
        candidates: ProcessingContext["files"]
    ): Promise<ProcessingResult> {

        try {

            const formData =
                new FormData();

            for (const workspaceFile of candidates) {

                formData.append(
                    "files",
                    workspaceFile.file,
                    workspaceFile.filename
                );

            }

            const response =
                await fetch(
                    `${API_URL}/merge-pdf`,
                    {
                        method: "POST",
                        body: formData
                    }
                );

            if (!response.ok) {

                let detail =
                    `Server merge failed with HTTP ${response.status}.`;

                try {

                    const errorBody =
                        await response.text();

                    if (
                        errorBody.trim()
                    ) {

                        detail =
                            errorBody;

                    }

                } catch {
                    // Preserve HTTP error.
                }

                throw new Error(
                    detail
                );
            }

            const blob =
                await response.blob();

            if (
                blob.size === 0
            ) {

                throw new Error(
                    "Server returned an empty merged PDF."
                );

            }

            return {
                success: true,

                outputFile:
                    new File(
                        [blob],
                        "iepdf-merged.pdf",
                        {
                            type:
                                "application/pdf"
                        }
                    )
            };

        } catch (error) {

            console.error(
                "Server merge fallback failed.",
                error
            );

            return {
                success: false,

                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to merge the selected PDFs."
            };
        }
    }
}
