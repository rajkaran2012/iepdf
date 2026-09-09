/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : trailerDetector.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Detector
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Detects and validates the PDF trailer dictionary or the trailer-equivalent
 * dictionary contained in a direct XRef stream.
 *
 * =============================================================================
 */

import {
    XrefDetector
} from "./xrefDetector";

import type {
    IXrefDetector
} from "../interfaces/IXrefDetector";

import type {
    TrailerDetectionResult
} from "../models/TrailerDetectionResult";

export class TrailerDetector {

    private readonly xrefDetector:
        IXrefDetector;

    public constructor(
        xrefDetector: IXrefDetector =
            new XrefDetector()
    ) {

        this.xrefDetector =
            xrefDetector;

    }

    public async detect(
        file: File
    ): Promise<TrailerDetectionResult> {

        const xrefResult =
            await this.xrefDetector.detect(file);

        if (!xrefResult.validXref) {

            return {
                validTrailer: false,
                reason:
                    xrefResult.reason ??
                    "Cannot validate trailer because XRef validation failed."
            };

        }

        if (
            xrefResult.xrefOffset === undefined
        ) {

            return {
                validTrailer: false,
                reason:
                    "XRef validation succeeded but did not provide an XRef offset."
            };

        }

        const buffer =
            await file.arrayBuffer();

        const bytes =
            new Uint8Array(buffer);

        const text =
            new TextDecoder("latin1").decode(bytes);

        /*
         * -----------------------------------------------------------------------
         * Direct XRef stream
         *
         * The XRef stream dictionary contains the trailer-equivalent entries.
         * -----------------------------------------------------------------------
         */

        if (
            xrefResult.xrefType === "stream"
        ) {

            const section =
                text.slice(
                    xrefResult.xrefOffset
                );

            const dictionaryStart =
                section.indexOf("<<");

            const dictionaryEnd =
                dictionaryStart === -1
                    ? -1
                    : this.findDictionaryEnd(
                        section,
                        dictionaryStart
                    );

            if (
                dictionaryStart === -1 ||
                dictionaryEnd === -1
            ) {

                return {
                    validTrailer: false,
                    reason:
                        "XRef stream trailer-equivalent dictionary is missing or malformed."
                };

            }

            const dictionary =
                section.slice(
                    dictionaryStart + 2,
                    dictionaryEnd
                );

            return this.validateTrailerDictionary(
                dictionary,
                xrefResult.xrefOffset
            );

        }

        /*
         * -----------------------------------------------------------------------
         * Traditional XRef table
         * -----------------------------------------------------------------------
         */

        const xrefSection =
            text.slice(
                xrefResult.xrefOffset
            );

        const lines =
            xrefSection.split(/\r?\n/);

        const trailerLineIndex =
            this.findTrailerLineIndex(lines);

        if (
            trailerLineIndex === -1
        ) {

            return {
                validTrailer: false,
                reason:
                    "Validated XRef table does not contain a trailer keyword."
            };

        }

        const trailerKeywordOffset =
            xrefResult.xrefOffset +
            this.byteLength(
                lines
                    .slice(
                        0,
                        trailerLineIndex
                    )
                    .join("\n")
            );

        const trailerLine =
            lines[trailerLineIndex]?.trim() ?? "";

        const trailerDictionaryText =
            trailerLine === "trailer"
                ? lines
                    .slice(
                        trailerLineIndex + 1
                    )
                    .join("\n")
                    .trim()
                : trailerLine
                    .slice(
                        "trailer".length
                    )
                    .trim();

        const dictionaryMatch =
            trailerDictionaryText.match(
                /^<<([\s\S]*?)>>/
            );

        if (
            dictionaryMatch === null
        ) {

            return {
                validTrailer: false,
                trailerOffset:
                    trailerKeywordOffset,
                reason:
                    "Trailer dictionary is missing or malformed."
            };

        }

        return this.validateTrailerDictionary(
            dictionaryMatch[1],
            trailerKeywordOffset
        );

    }

    private validateTrailerDictionary(
        dictionary: string,
        trailerOffset: number
    ): TrailerDetectionResult {

        const sizeMatch =
            dictionary.match(
                /\/Size\s+(\d+)/
            );

        if (
            sizeMatch === null
        ) {

            return {
                validTrailer: false,
                trailerOffset,
                reason:
                    "Trailer dictionary does not contain a valid /Size entry."
            };

        }

        const size =
            Number(
                sizeMatch[1]
            );

        if (
            !Number.isSafeInteger(size) ||
            size <= 0
        ) {

            return {
                validTrailer: false,
                trailerOffset,
                reason:
                    "Trailer /Size value is invalid."
            };

        }

        const rootMatch =
            dictionary.match(
                /\/Root\s+(\d+)\s+(\d+)\s+R/
            );

        if (
            rootMatch === null
        ) {

            return {
                validTrailer: false,
                trailerOffset,
                size,
                reason:
                    "Trailer dictionary does not contain a valid /Root reference."
            };

        }

        const rootObjectNumber =
            Number(
                rootMatch[1]
            );

        const rootGenerationNumber =
            Number(
                rootMatch[2]
            );

        if (
            !Number.isSafeInteger(rootObjectNumber) ||
            rootObjectNumber <= 0 ||
            !Number.isSafeInteger(rootGenerationNumber) ||
            rootGenerationNumber < 0
        ) {

            return {
                validTrailer: false,
                trailerOffset,
                size,
                reason:
                    "Trailer /Root reference is invalid."
            };

        }

        return {
            validTrailer: true,
            trailerOffset,
            size,
            rootObjectNumber,
            rootGenerationNumber
        };

    }

    private findDictionaryEnd(
        text: string,
        dictionaryStart: number
    ): number {

        let depth = 0;

        for (
            let index = dictionaryStart;
            index < text.length - 1;
            index++
        ) {

            const pair =
                text.slice(
                    index,
                    index + 2
                );

            if (pair === "<<") {

                depth++;
                index++;

                continue;

            }

            if (pair === ">>") {

                depth--;

                if (depth === 0) {
                    return index;
                }

                index++;

            }

        }

        return -1;

    }
    private findTrailerLineIndex(
        lines: string[]
    ): number {

        for (
            let index = 0;
            index < lines.length;
            index++
        ) {

            const line =
                lines[index]?.trim();

            if (
                line === "trailer" ||
                line?.startsWith("trailer <<")
            ) {

                return index;

            }

        }

        return -1;

    }

    private byteLength(
        value: string
    ): number {

        return new TextEncoder().encode(
            value
        ).length;

    }

}
