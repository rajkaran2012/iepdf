"use client";

import type { RenderedPdfPage } from "./PdfiumPageRenderer";

export class JpegEncoder {
    public async encode(
        page: RenderedPdfPage,
        quality = 0.9
    ): Promise<Blob> {
        if (
            page.width <= 0 ||
            page.height <= 0 ||
            page.stride <= 0
        ) {
            throw new Error(
                "Invalid rendered page dimensions."
            );
        }

        const canvas = document.createElement("canvas");

        canvas.width = page.width;
        canvas.height = page.height;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error(
                "Unable to create a 2D canvas context."
            );
        }

        const imageData =
            context.createImageData(
                page.width,
                page.height
            );

        const source = page.pixels;
        const destination = imageData.data;

        for (
            let y = 0;
            y < page.height;
            y++
        ) {
            const sourceRow =
                y * page.stride;

            const destinationRow =
                y * page.width * 4;

            for (
                let x = 0;
                x < page.width;
                x++
            ) {
                const sourceOffset =
                    sourceRow + x * 4;

                const destinationOffset =
                    destinationRow + x * 4;

                const blue =
                    source[sourceOffset];

                const green =
                    source[sourceOffset + 1];

                const red =
                    source[sourceOffset + 2];

                destination[destinationOffset] =
                    red;

                destination[destinationOffset + 1] =
                    green;

                destination[destinationOffset + 2] =
                    blue;

                destination[destinationOffset + 3] =
                    255;
            }
        }

        context.putImageData(
            imageData,
            0,
            0
        );

        const normalizedQuality = Math.min(
            1,
            Math.max(0, quality)
        );

        const blob =
            await this.canvasToBlob(
                canvas,
                normalizedQuality
            );

        if (!blob || blob.size === 0) {
            throw new Error(
                "Unable to encode the rendered page as JPEG."
            );
        }

        return blob;
    }

    private canvasToBlob(
        canvas: HTMLCanvasElement,
        quality: number
    ): Promise<Blob> {
        return new Promise(
            (resolve, reject) => {
                canvas.toBlob(
                    blob => {
                        if (!blob) {
                            reject(
                                new Error(
                                    "Browser JPEG encoding failed."
                                )
                            );
                            return;
                        }

                        resolve(blob);
                    },
                    "image/jpeg",
                    quality
                );
            }
        );
    }
}
