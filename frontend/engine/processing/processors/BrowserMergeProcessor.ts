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
 * ✓ Open encrypted PDFs using user passwords
 * ✓ Merge only successfully loaded PDFs
 * ✓ Return a browser File
 * =============================================================================
 */

import { BrowserPdfDocument } from "@/engine/pdf/BrowserPdfDocument";

import { BasePdfProcessor } from "./BasePdfProcessor";

import type { ProcessingContext } from "../ProcessingContext";
import type { ProcessingResult } from "../results/ProcessingResult";
import type { WorkspaceFile } from "../WorkspaceFile";

export class BrowserMergeProcessor extends BasePdfProcessor {

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
                error:
                    "Unable to merge any PDF files."
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

            const source =
                new BrowserPdfDocument();

            const buffer =
                await workspaceFile.file.arrayBuffer();

            await source.load(
                buffer,
                workspaceFile.password || undefined
            );

            await destination.appendDocument(
                source
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