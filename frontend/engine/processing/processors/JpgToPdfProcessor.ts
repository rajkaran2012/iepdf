import {
    PDFDocument,
    PageSizes,
} from "pdf-lib";

import { BasePdfProcessor } from "./BasePdfProcessor";

import type { ProcessingContext } from "../ProcessingContext";
import type { ProcessingResult } from "../results/ProcessingResult";

export class JpgToPdfProcessor extends BasePdfProcessor {
    protected override async processCore(
        context: ProcessingContext
    ): Promise<ProcessingResult> {
        const workspaceFiles =
            context.files.filter(
                file =>
                    !file.skipped &&
                    file.status !== "corrupted"
            );

        if (workspaceFiles.length === 0) {
            return {
                success: false,
                error:
                    "No valid image files available for conversion."
            };
        }

        try {
            const pdf =
                await PDFDocument.create();

            const [
                pageWidth,
                pageHeight,
            ] = PageSizes.A4;

            for (const workspaceFile of workspaceFiles) {
                const bytes =
                    await workspaceFile.file.arrayBuffer();

                const imageType =
                    this.getImageType(
                        workspaceFile.file
                    );

                const image =
                    imageType === "jpeg"
                        ? await pdf.embedJpg(bytes)
                        : await pdf.embedPng(bytes);

                const page =
                    pdf.addPage([
                        pageWidth,
                        pageHeight,
                    ]);

                const imageWidth =
                    image.width;

                const imageHeight =
                    image.height;

                if (
                    imageWidth <= 0 ||
                    imageHeight <= 0
                ) {
                    throw new Error(
                        `Invalid image dimensions: ${workspaceFile.filename}`
                    );
                }

                const margin = 36;

                const maxWidth =
                    pageWidth -
                    margin * 2;

                const maxHeight =
                    pageHeight -
                    margin * 2;

                const scale =
                    Math.min(
                        maxWidth / imageWidth,
                        maxHeight / imageHeight
                    );

                const drawWidth =
                    imageWidth * scale;

                const drawHeight =
                    imageHeight * scale;

                const x =
                    (pageWidth -
                        drawWidth) /
                    2;

                const y =
                    (pageHeight -
                        drawHeight) /
                    2;

                page.drawImage(
                    image,
                    {
                        x,
                        y,
                        width: drawWidth,
                        height: drawHeight,
                    }
                );
            }

            const pdfBytes =
                await pdf.save();

            if (pdfBytes.length === 0) {
                return {
                    success: false,
                    error:
                        "PDF generation returned an empty file."
                };
            }

            const buffer =
                pdfBytes.buffer.slice(
                    pdfBytes.byteOffset,
                    pdfBytes.byteOffset +
                        pdfBytes.byteLength
                ) as ArrayBuffer;

            const outputFile =
                new File(
                    [buffer],
                    "converted.pdf",
                    {
                        type:
                            "application/pdf"
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
                    : "Unable to convert the images to PDF.";

            return {
                success: false,
                error: message
            };
        }
    }

    private getImageType(
        file: File
    ): "jpeg" | "png" {
        const mimeType =
            file.type.toLowerCase();

        if (
            mimeType === "image/jpeg" ||
            mimeType === "image/jpg"
        ) {
            return "jpeg";
        }

        if (
            mimeType === "image/png"
        ) {
            return "png";
        }

        const filename =
            file.name.toLowerCase();

        if (
            filename.endsWith(".jpg") ||
            filename.endsWith(".jpeg")
        ) {
            return "jpeg";
        }

        if (
            filename.endsWith(".png")
        ) {
            return "png";
        }

        throw new Error(
            `"${file.name}" is not a supported JPG or PNG image.`
        );
    }
}
