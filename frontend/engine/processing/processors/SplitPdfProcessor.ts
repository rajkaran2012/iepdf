import { zipSync, strToU8 } from "fflate";
import { BrowserPdfLoader } from "@/engine/loaders/BrowserPdfLoader";
import { BrowserPdfDocument } from "@/engine/pdf/BrowserPdfDocument";
import { BasePdfProcessor } from "./BasePdfProcessor";
import type { ProcessingContext } from "../ProcessingContext";
import type { ProcessingResult } from "../results/ProcessingResult";

export class SplitPdfProcessor extends BasePdfProcessor {
    private readonly loader = new BrowserPdfLoader();

    protected override async processCore(
        context: ProcessingContext
    ): Promise<ProcessingResult> {
        const workspaceFile = context.files.find(
            file =>
                !file.skipped &&
                file.status !== "corrupted"
        );

        if (!workspaceFile) {
            return {
                success: false,
                error: "No valid PDF file available for splitting."
            };
        }

        try {
            const loadResult = await this.loader.load(
                workspaceFile.file,
                workspaceFile.password || undefined
            );

            if (!loadResult.success || !loadResult.document) {
                return {
                    success: false,
                    error:
                        loadResult.message ||
                        "Unable to load the PDF for splitting."
                };
            }

            if (!(loadResult.document instanceof BrowserPdfDocument)) {
                return {
                    success: false,
                    error: "Unsupported PDF document implementation."
                };
            }

            const sourceDocument = loadResult.document;
            const pageCount = sourceDocument.getPageCount();

            if (pageCount === 0) {
                return {
                    success: false,
                    error: "The PDF contains no pages."
                };
            }

            const zipEntries: Record<string, Uint8Array> = {};

            for (let index = 0; index < pageCount; index++) {
                const singlePageDocument =
                    await BrowserPdfDocument.create();

                await singlePageDocument.copyPages(
                    sourceDocument,
                    [index]
                );

                const pageFile =
                    await singlePageDocument.toFile(
                        `page_${index + 1}.pdf`
                    );

                zipEntries[`page_${index + 1}.pdf`] =
                    new Uint8Array(
                        await pageFile.arrayBuffer()
                    );
            }

            const zipBytes = zipSync(zipEntries, {
                level: 6
            });

            const zipBlob = new Blob(
                [zipBytes],
                { type: "application/zip" }
            );

            const outputFile = new File(
                [zipBlob],
                "split_pages.zip",
                { type: "application/zip" }
            );

            return {
                success: true,
                outputFile
            };
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unable to split the PDF.";

            return {
                success: false,
                error: message
            };
        }
    }
}
