/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : objectTreeDetector.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Detector
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Detects and validates the basic indirect-object structure of a PDF.
 *
 * Responsibilities
 * ---------------------------------------------------------------------------
 * - Reads PDF bytes client-side.
 * - Reuses XRef validation.
 * - Reuses Trailer validation.
 * - Detects indirect PDF objects.
 * - Validates object/endobj pairing.
 * - Detects duplicate object identifiers.
 * - Verifies that the trailer Root object exists.
 *
 * This detector does NOT:
 * - Produce ValidationResult.
 * - Handle UI logic.
 * - Modify the source PDF.
 * - Perform security validation.
 * - Implement a complete PDF parser.
 *
 * =============================================================================
 */

import {
    XrefDetector
} from "./xrefDetector";

import {
    TrailerDetector
} from "./trailerDetector";

import type {
    IXrefDetector
} from "../interfaces/IXrefDetector";

import type {
    IObjectTreeDetector
} from "../interfaces/IObjectTreeDetector";

import type {
    ObjectTreeDetectionResult
} from "../models/ObjectTreeDetectionResult";

export class ObjectTreeDetector
    implements IObjectTreeDetector {

    private readonly xrefDetector:
        IXrefDetector;

    private readonly trailerDetector:
        TrailerDetector;

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
    ): Promise<ObjectTreeDetectionResult> {

        try {

            const xrefResult =
                await this.xrefDetector.detect(file);

            if (!xrefResult.validXref) {

                return {
                    validObjectTree: false,
                    reason:
                        xrefResult.reason ??
                        "Cannot validate object tree because XRef validation failed."
                };

            }

            const trailerResult =
                await this.trailerDetector.detect(file);

            if (!trailerResult.validTrailer) {

                return {
                    validObjectTree: false,
                    reason:
                        trailerResult.reason ??
                        "Cannot validate object tree because trailer validation failed."
                };

            }

            if (
                trailerResult.rootObjectNumber === undefined ||
                trailerResult.rootGenerationNumber === undefined
            ) {

                return {
                    validObjectTree: false,
                    reason:
                        "Trailer Root reference is unavailable."
                };

            }

            const buffer =
                await file.arrayBuffer();

            const bytes =
                new Uint8Array(buffer);

            const text =
                new TextDecoder("latin1").decode(bytes);

            /**
             * Match indirect object declarations.
             *
             * Example:
             *
             * 1 0 obj
             * 2 0 obj
             */
            const objectPattern =
                /(?:^|\r?\n|endobj)\s*(\d+)\s+(\d+)\s+obj\b/g;

            const objects =
                new Map<string, {
                    objectNumber: number;
                    generationNumber: number;
                    startIndex: number;
                }>();

            let match:
                RegExpExecArray | null;

            while (
                (match =
                    objectPattern.exec(text)) !== null
            ) {

                const declarationOffset =
                    match[0].search(/\d/);

                const declarationStartIndex =
                    match.index +
                    declarationOffset;

                const objectNumber =
                    Number(match[1]);

                const generationNumber =
                    Number(match[2]);

                if (
                    !Number.isSafeInteger(objectNumber) ||
                    objectNumber <= 0
                ) {

                    return {
                        validObjectTree: false,
                        reason:
                            "PDF contains an invalid indirect object number."
                    };

                }

                if (
                    !Number.isSafeInteger(generationNumber) ||
                    generationNumber < 0
                ) {

                    return {
                        validObjectTree: false,
                        reason:
                            "PDF contains an invalid object generation number."
                    };

                }

                const key =
                    `${objectNumber} ${generationNumber}`;

                if (
                    objects.has(key)
                ) {

                    return {
                        validObjectTree: false,
                        objectCount:
                            objects.size,
                        reason:
                            `Duplicate indirect object: ${key}.`
                    };

                }

                objects.set(
                    key,
                    {
                        objectNumber,
                        generationNumber,
                        startIndex:
                            declarationStartIndex
                    }
                );

            }

            if (
                objects.size === 0
            ) {

                return {
                    validObjectTree: false,
                    reason:
                        "PDF does not contain any indirect objects."
                };

            }

            /**
             * Validate that every detected object has a matching endobj.
             *
             * Object boundaries are determined from the already detected
             * object declaration positions. This avoids searching from the
             * beginning of the complete PDF for every object.
             */
            const objectList =
                Array.from(
                    objects.values()
                ).sort(
                    (a, b) =>
                        a.startIndex - b.startIndex
                );

            for (
                let index = 0;
                index < objectList.length;
                index++
            ) {

                const object =
                    objectList[index];

                const objectStart =
                    object.startIndex;

                const nextObjectStart =
                    index + 1 < objectList.length
                        ? objectList[index + 1].startIndex
                        : text.length;

                const objectText =
                    text.slice(
                        objectStart,
                        nextObjectStart
                    );

                const endObjectIndex =
                    objectText.search(
                        /\bendobj\b/
                    );

                if (
                    endObjectIndex === -1
                ) {

                    return {
                        validObjectTree: false,
                        objectCount:
                            objects.size,
                        reason:
                            `Indirect object ${object.objectNumber} ${object.generationNumber} is missing endobj.`
                    };

                }

            }

            const rootKey =
                `${trailerResult.rootObjectNumber} ${trailerResult.rootGenerationNumber}`;

            if (
                !objects.has(rootKey)
            ) {

                return {
                    validObjectTree: false,
                    objectCount:
                        objects.size,
                    rootObjectNumber:
                        trailerResult.rootObjectNumber,
                    rootGenerationNumber:
                        trailerResult.rootGenerationNumber,
                    reason:
                        `Trailer Root object ${rootKey} does not exist in the PDF object tree.`
                };

            }

            return {
                validObjectTree: true,
                objectCount:
                    objects.size,
                rootObjectNumber:
                    trailerResult.rootObjectNumber,
                rootGenerationNumber:
                    trailerResult.rootGenerationNumber
            };

        }
        catch (
            error: unknown
        ) {

            return {
                validObjectTree: false,
                reason:
                    error instanceof Error
                        ? error.message
                        : "Unable to inspect PDF object tree."
            };

        }

    }

}
