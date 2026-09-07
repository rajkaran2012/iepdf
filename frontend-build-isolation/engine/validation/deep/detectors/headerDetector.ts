/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : headerDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Detects and validates the PDF header directly from the browser File bytes.
 *
 * This detector:
 * - Runs entirely client-side.
 * - Does not depend on PDF.js.
 * - Does not depend on PDFium.
 * - Does not modify the source file.
 *
 * Expected PDF header:
 *
 *     %PDF-1.x
 *
 * =============================================================================
 */

import type {
    IHeaderDetector,
} from "../interfaces/IHeaderDetector";

import type {
    HeaderDetectionResult,
} from "../models/HeaderDetectionResult";


export class HeaderDetector
    implements IHeaderDetector {


    /**
     * =========================================================================
     * Detect PDF Header
     * =========================================================================
     */
    public async detect(
        file: File
    ): Promise<HeaderDetectionResult> {

        try {

            /**
             * Read only the beginning of the file.
             *
             * A PDF header is expected at the beginning of the file.
             */
            const headerBytes =
                new Uint8Array(
                    await file.slice(
                        0,
                        16
                    ).arrayBuffer()
                );


            /**
             * Decode the bytes as ASCII-compatible text.
             *
             * PDF headers are ASCII text.
             */
            const header =
                new TextDecoder(
                    "ascii"
                ).decode(
                    headerBytes
                );


            /**
             * PDF header format:
             *
             * %PDF-1.x
             *
             * where x is the PDF minor version digit.
             */
            const match =
                header.match(
                    /^%PDF-(\d)\.(\d)/
                );


            if (
                match === null
            ) {

                return {

                    validHeader:
                        false,

                    detectedHeader:
                        header
                            .split(
                                /\r?\n/,
                                1
                            )[0],

                    reason:
                        "PDF header is missing or invalid.",

                };

            }


            const detectedHeader =
                `%PDF-${match[1]}.${match[2]}`;


            return {

                validHeader:
                    true,

                detectedHeader,

            };

        }
        catch (
            error: unknown
        ) {

            return {

                validHeader:
                    false,

                reason:
                    error instanceof Error
                        ? error.message
                        : "Unable to inspect PDF header.",

            };

        }

    }

}