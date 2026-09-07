/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : versionDetector.ts
 * Module     : Deep Validation
 * Layer      : Detector
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Detects and validates the PDF version from the PDF header.
 *
 * This detector:
 * - Runs entirely client-side.
 * - Does not depend on PDF.js.
 * - Does not depend on PDFium.
 * - Does not modify the source file.
 *
 * =============================================================================
 */

import type {
    IVersionDetector,
} from "../interfaces/IVersionDetector";

import type {
    VersionDetectionResult,
} from "../models/VersionDetectionResult";


export class VersionDetector
    implements IVersionDetector {


    /**
     * =========================================================================
     * Supported PDF versions
     * =========================================================================
     *
     * The detector recognizes the PDF versions represented by the standard
     * PDF header format currently used by iePDF.
     */
    private static readonly supportedVersions =
        new Set<string>([
            "1.0",
            "1.1",
            "1.2",
            "1.3",
            "1.4",
            "1.5",
            "1.6",
            "1.7",
            "2.0",
        ]);


    /**
     * =========================================================================
     * Detect PDF Version
     * =========================================================================
     */
    public async detect(
        file: File
    ): Promise<VersionDetectionResult> {

        try {

            /**
             * Read only the beginning of the PDF.
             */
            const headerBytes =
                new Uint8Array(
                    await file.slice(
                        0,
                        16
                    ).arrayBuffer()
                );


            /**
             * PDF header is ASCII text.
             */
            const header =
                new TextDecoder(
                    "ascii"
                ).decode(
                    headerBytes
                );


            /**
             * Extract:
             *
             * %PDF-1.7
             *       │
             *       └── 1.7
             */
            const match =
                header.match(
                    /^%PDF-(\d)\.(\d)/
                );


            if (
                match === null
            ) {

                return {

                    validVersion:
                        false,

                    reason:
                        "Unable to determine PDF version because the PDF header is invalid.",

                };

            }


            const detectedVersion =
                `${match[1]}.${match[2]}`;


            if (
                !VersionDetector.supportedVersions.has(
                    detectedVersion
                )
            ) {

                return {

                    validVersion:
                        false,

                    detectedVersion,

                    reason:
                        `Unsupported PDF version: ${detectedVersion}.`,

                };

            }


            return {

                validVersion:
                    true,

                detectedVersion,

            };

        }
        catch (
            error: unknown
        ) {

            return {

                validVersion:
                    false,

                reason:
                    error instanceof Error
                        ? error.message
                        : "Unable to inspect PDF version.",

            };

        }

    }

}