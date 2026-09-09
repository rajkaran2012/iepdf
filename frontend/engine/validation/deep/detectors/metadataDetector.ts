/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : metadataDetector.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Detector
 * =============================================================================
 *
 * Purpose
 * ---------------------------------------------------------------------------
 * Detects and validates PDF metadata structures.
 *
 * This detector validates PDF-level metadata references and dictionaries.
 * It does NOT attempt to validate arbitrary XMP XML semantics.
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
    IMetadataDetector
} from "../interfaces/IMetadataDetector";

import type {
    MetadataDetectionResult
} from "../models/MetadataDetectionResult";

export class MetadataDetector
    implements IMetadataDetector {

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
    ): Promise<MetadataDetectionResult> {

        try {

            const xrefResult =
                await this.xrefDetector.detect(file);

            if (
                !xrefResult.validXref
            ) {

                return {
                    validMetadata: false,
                    reason:
                        xrefResult.reason ??
                        "Cannot validate metadata because XRef validation failed."
                };

            }

            const trailerResult =
                await this.trailerDetector.detect(file);

            if (
                !trailerResult.validTrailer
            ) {

                return {
                    validMetadata: false,
                    reason:
                        trailerResult.reason ??
                        "Cannot validate metadata because trailer validation failed."
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
                    validMetadata: false,
                    reason:
                        "PDF does not contain any indirect objects."
                };

            }

            let hasInfoDictionary =
                false;

            let hasXmpMetadata =
                false;

            let metadataObjectCount =
                0;

            /*
             * -----------------------------------------------------------------
             * Trailer /Info validation
             * -----------------------------------------------------------------
             */

            const infoMatch =
                text.match(
                    /\/Info\s+(\d+)\s+(\d+)\s+R/
                );

            if (
                infoMatch !== null
            ) {

                const objectNumber =
                    Number(infoMatch[1]);

                const generationNumber =
                    Number(infoMatch[2]);

                if (
                    !Number.isSafeInteger(objectNumber) ||
                    objectNumber <= 0 ||
                    !Number.isSafeInteger(generationNumber) ||
                    generationNumber < 0
                ) {

                    return {
                        validMetadata: false,
                        metadataObjectCount,
                        reason:
                            "Trailer /Info contains an invalid object reference."
                    };

                }

                const infoObject =
                    this.objectParser.getObject(
                        objects,
                        {
                            objectNumber,
                            generationNumber
                        }
                    );

                if (
                    infoObject === undefined
                ) {

                    return {
                        validMetadata: false,
                        metadataObjectCount,
                        reason:
                            `Trailer /Info references missing object ${objectNumber} ${generationNumber} R.`
                    };

                }

                const trimmedBody =
                    infoObject.body.trim();

                if (
                    !trimmedBody.startsWith("<<") ||
                    !trimmedBody.includes(">>")
                ) {

                    return {
                        validMetadata: false,
                        metadataObjectCount,
                        reason:
                            `Trailer /Info object ${objectNumber} ${generationNumber} R is not a valid PDF dictionary.`
                    };

                }

                hasInfoDictionary =
                    true;

                metadataObjectCount++;

            }

            /*
             * -----------------------------------------------------------------
             * Catalog /Metadata validation
             * -----------------------------------------------------------------
             */

            const catalogMatch =
                text.match(
                    /\/Type\s*\/Catalog[\s\S]*?\/Metadata\s+(\d+)\s+(\d+)\s+R/
                );

            if (
                catalogMatch !== null
            ) {

                const objectNumber =
                    Number(catalogMatch[1]);

                const generationNumber =
                    Number(catalogMatch[2]);

                if (
                    !Number.isSafeInteger(objectNumber) ||
                    objectNumber <= 0 ||
                    !Number.isSafeInteger(generationNumber) ||
                    generationNumber < 0
                ) {

                    return {
                        validMetadata: false,
                        metadataObjectCount,
                        reason:
                            "Catalog /Metadata contains an invalid object reference."
                    };

                }

                const metadataObject =
                    this.objectParser.getObject(
                        objects,
                        {
                            objectNumber,
                            generationNumber
                        }
                    );

                if (
                    metadataObject === undefined
                ) {

                    return {
                        validMetadata: false,
                        metadataObjectCount,
                        reason:
                            `Catalog /Metadata references missing object ${objectNumber} ${generationNumber} R.`
                    };

                }

                if (
                    !/\/Type\s*\/Metadata(?![A-Za-z0-9])/.test(
                        metadataObject.body
                    )
                ) {

                    return {
                        validMetadata: false,
                        metadataObjectCount,
                        reason:
                            `Metadata object ${objectNumber} ${generationNumber} R does not declare /Type /Metadata.`
                    };

                }

                if (
                    !/\/Subtype\s*\/XML(?![A-Za-z0-9])/.test(
                        metadataObject.body
                    )
                ) {

                    return {
                        validMetadata: false,
                        metadataObjectCount,
                        reason:
                            `Metadata object ${objectNumber} ${generationNumber} R does not declare /Subtype /XML.`
                    };

                }

                hasXmpMetadata =
                    true;

                metadataObjectCount++;

            }

            return {
                validMetadata: true,
                hasInfoDictionary,
                hasXmpMetadata,
                metadataObjectCount
            };

        }
        catch (
            error: unknown
        ) {

            return {
                validMetadata: false,
                reason:
                    error instanceof Error
                        ? error.message
                        : "Unable to inspect PDF metadata."
            };

        }

    }

}
