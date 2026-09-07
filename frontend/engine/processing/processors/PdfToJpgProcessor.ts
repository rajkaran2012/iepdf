import { zipSync } from "fflate";

import { PdfiumPageRenderer } from "@/engine/rendering/PdfiumPageRenderer";
import { JpegEncoder } from "@/engine/rendering/JpegEncoder";

import { BasePdfProcessor } from "./BasePdfProcessor";

import type { ProcessingContext } from "../ProcessingContext";
import type { ProcessingResult } from "../results/ProcessingResult";

export class PdfToJpgProcessor extends BasePdfProcessor {
    private readonly renderer =
        new PdfiumPageRenderer();

    private readonly encoder =
        new JpegEncoder();

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
                error:
                    "No valid PDF file available for conversion."
            };
        }

        try {
            await this.renderer.openDocument(
                workspaceFile.file
            );

            const pageCount =
                this.renderer.getPageCount();

            if (pageCount <= 0) {
                return {
                    success: false,
                    error:
                        "The PDF contains no pages."
                };
            }

            const zipEntries:
                Record<string, Uint8Array> = {};

            for (
                let index = 0;
                index < pageCount;
                index++
            ) {
                const renderedPage =
                    this.renderer.renderPage(
                        index,
                        150
                    );

                const jpegBlob =
                    await this.encoder.encode(
                        renderedPage,
                        0.9
                    );

                const jpegBytes =
                    new Uint8Array(
                        await jpegBlob.arrayBuffer()
                    );

                zipEntries[
                    `page_${index + 1}.jpg`
                ] = jpegBytes;
            }

            const zipBytes =
                zipSync(zipEntries, {
                    level: 6
                });

            const zipBlob =
                new Blob(
                    [zipBytes],
                    {
                        type:
                            "application/zip"
                    }
                );

            const outputFile =
                new File(
                    [zipBlob],
                    "jpg_pages.zip",
                    {
                        type:
                            "application/zip"
                    }
                );

            return {
                success: true,
                outputFile
            };
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to convert the PDF to JPG.";

            return {
                success: false,
                error: message
            };
        } finally {
            this.renderer.closeDocument();
        }
    }
}
