/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File       : BrowserMergeProcessor.ts
 * Module     : Processing
 * Layer      : Browser Processor
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Browser implementation of the Merge PDF processor.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * ✓ Browser-first processing
 * ✓ Skip skipped files
 * ✓ Skip corrupted files
 * ✓ Delegate PDF loading to BrowserPdfLoader
 * ✓ Merge only successfully loaded PDFs
 * ✓ Return a browser File
 * =============================================================================
 */

import { BrowserPdfDocument } from "@/engine/pdf/BrowserPdfDocument";
import { BrowserPdfLoader } from "@/engine/loaders/BrowserPdfLoader";

import { BasePdfProcessor } from "./BasePdfProcessor";

import type { ProcessingContext } from "../ProcessingContext";
import type { ProcessingResult } from "../results/ProcessingResult";
import type { WorkspaceFile } from "../WorkspaceFile";

export class BrowserMergeProcessor extends BasePdfProcessor {

    private readonly loader = new BrowserPdfLoader();

    protected override async processCore(
        context: ProcessingContext
    ): Promise<ProcessingResult> {

        const candidates = context.files.filter(
            file =>
                !file.skipped &&
                file.status !== "corrupted"
        );

        if (candidates.length === 0) {

            return {
                success: false,
                error: "No valid PDF files available for merging."
            };

        }

        const mergedDocument =
            await BrowserPdfDocument.create();

        let mergedCount = 0;

        for (const workspaceFile of candidates) {

            const merged =
                await this.tryMergeFile(
                    mergedDocument,
                    workspaceFile
                );

            if (merged) {

                mergedCount++;

            }

        }

        if (mergedCount === 0) {

            return {
                success: false,
                error: "Unable to merge any PDF files."
            };

        }

        const outputFile =
            await mergedDocument.toFile(
                "iepdf-merged.pdf"
            );

        return {
            success: true,
            outputFile
        };

    }

    /**
     * Attempts to merge one PDF.
     */
    private async tryMergeFile(
        destination: BrowserPdfDocument,
        workspaceFile: WorkspaceFile
    ): Promise<boolean> {

        try {

            const result = await this.loader.load(
                workspaceFile.file,
                workspaceFile.password || undefined
            );

            if (
                !result.success ||
                result.document === null
            ) {

                console.warn(
                    `Unable to load "${workspaceFile.filename}": ${result.message}`
                );

                return false;

            }

            await destination.appendDocument(
                result.document
            );

            return true;

        } catch (error) {

            console.warn(
                `Unable to merge "${workspaceFile.filename}".`,
                error
            );

            return false;

        }

    }

}