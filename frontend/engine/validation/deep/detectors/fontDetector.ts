/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : fontDetector.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Detector
 * =============================================================================
 *
 * Purpose
 * ---------------------------------------------------------------------------
 * Detects malformed PDF Font resource references.
 *
 * This detector validates PDF-level Font resource integrity.
 * It does NOT parse embedded TrueType/OpenType/CFF binaries.
 * =============================================================================
 */

import {
    XrefDetector
} from "./xrefDetector";

import {
    TrailerDetector
} from "./trailerDetector";

import {
    PdfObjectParser
} from "../parsers/PdfObjectParser";

import type {
    IXrefDetector
} from "../interfaces/IXrefDetector";

import type {
    IFontDetector
} from "../interfaces/IFontDetector";

import type {
    FontDetectionResult
} from "../models/FontDetectionResult";

export class FontDetector
    implements IFontDetector {

    private readonly xrefDetector:
        IXrefDetector;

    private readonly trailerDetector:
        TrailerDetector;

    private readonly objectParser =
        new PdfObjectParser();

    public constructor(
        xrefDetector: IXrefDetector =
            new XrefDetector(),

        trailerDetector: TrailerDetector =
            new TrailerDetector(
                xrefDetector
            )
    ) {

        this.xrefDetector =
            xrefDetector;

        this.trailerDetector =
            trailerDetector;

    }

    public async detect(
        file: File
    ): Promise<FontDetectionResult> {

        try {

            const xrefResult =
                await this.xrefDetector.detect(file);

            if (
                !xrefResult.validXref
            ) {

                return {
                    validFont: false,
                    reason:
                        xrefResult.reason ??
                        "Cannot validate fonts because XRef validation failed."
                };

            }

            const trailerResult =
                await this.trailerDetector.detect(file);

            if (
                !trailerResult.validTrailer
            ) {

                return {
                    validFont: false,
                    reason:
                        trailerResult.reason ??
                        "Cannot validate fonts because trailer validation failed."
                };

            }

            const buffer =
                await file.arrayBuffer();

            const bytes =
                new Uint8Array(buffer);

            const text =
                new TextDecoder("latin1").decode(bytes);

            const objects =
                this.objectParser.collectObjects(
                    text,
                    bytes
                );

            if (
                objects.size === 0
            ) {

                return {
                    validFont: false,
                    reason:
                        "PDF does not contain any indirect objects."
                };

            }

            let fontCount = 0;

            /**
             * Detect /Font dictionaries.
             *
             * Example:
             *
             * /Font <<
             *     /F1 5 0 R
             * >>
             */
            const fontDictionaryPattern =
                /\/Font\s*<<([\s\S]*?)>>/g;

            for (const [, parsedObject] of objects) {

                fontDictionaryPattern.lastIndex = 0;

                let dictionaryMatch:
                    RegExpExecArray | null;

                while (
                    (dictionaryMatch =
                        fontDictionaryPattern.exec(
                            parsedObject.body
                        )
                    ) !== null
                ) {

                    const dictionary =
                        dictionaryMatch[1];

                    const referencePattern =
                        /\/([A-Za-z0-9_.-]+)\s+(\d+)\s+(\d+)\s+R/g;

                    let referenceMatch:
                        RegExpExecArray | null;

                    while (
                        (referenceMatch =
                            referencePattern.exec(dictionary)
                        ) !== null
                    ) {

                        const resourceName =
                            referenceMatch[1];

                        const objectNumber =
                            Number(referenceMatch[2]);

                        const generationNumber =
                            Number(referenceMatch[3]);

                        if (
                            !Number.isSafeInteger(objectNumber) ||
                            objectNumber <= 0 ||
                            !Number.isSafeInteger(generationNumber) ||
                            generationNumber < 0
                        ) {

                            return {
                                validFont: false,
                                fontCount,
                                reason:
                                    `Font resource /${resourceName} contains an invalid object reference.`
                            };

                        }

                        const object =
                            this.objectParser.getObject(
                                objects,
                                {
                                    objectNumber,
                                    generationNumber
                                }
                            );

                        if (
                            object === undefined
                        ) {

                            return {
                                validFont: false,
                                fontCount,
                                reason:
                                    `Font resource /${resourceName} references missing object ${objectNumber} ${generationNumber} R.`
                            };

                        }

                        if (
                            !/\/Type\s*\/Font(?![A-Za-z0-9])/.test(
                                object.body
                            )
                        ) {

                            return {
                                validFont: false,
                                fontCount,
                                reason:
                                    `Font resource /${resourceName} references object ${objectNumber} ${generationNumber} R which is not a /Font object.`
                            };

                        }

                        fontCount++;

                    }

                }

            }
            return {
                validFont: true,
                fontCount
            };

        }
        catch (
            error: unknown
        ) {

            return {
                validFont: false,
                reason:
                    error instanceof Error
                        ? error.message
                        : "Unable to inspect PDF font structures."
            };

        }

    }

}
