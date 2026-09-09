/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : incrementalUpdateDetector.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Detector
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Detects structural PDF incremental updates.
 *
 * Responsibilities
 * ---------------------------------------------------------------------------
 * - Reads PDF bytes client-side.
 * - Detects all startxref markers.
 * - Detects trailer dictionaries.
 * - Detects /Prev references.
 * - Validates the /Prev chain.
 * - Verifies that each referenced previous revision points to an XRef
 *   structure.
 *
 * This detector does NOT:
 * - Produce ValidationResult.
 * - Handle UI logic.
 * - Modify the PDF.
 * - Perform security validation.
 * - Implement a complete PDF parser.
 *
 * =============================================================================
 */

import type {
    IIncrementalUpdateDetector
} from "../interfaces/IIncrementalUpdateDetector";

import type {
    IncrementalUpdateDetectionResult
} from "../models/IncrementalUpdateDetectionResult";

interface TrailerInfo {

    readonly offset: number;

    readonly previousOffset?: number;

}

export class IncrementalUpdateDetector
    implements IIncrementalUpdateDetector {

    public async detect(
        file: File
    ): Promise<IncrementalUpdateDetectionResult> {

        try {

            const buffer =
                await file.arrayBuffer();

            const bytes =
                new Uint8Array(buffer);

            const text =
                new TextDecoder("latin1").decode(bytes);

            const revisionOffsets =
                this.findStartXrefOffsets(text);

            if (
                revisionOffsets.length === 0
            ) {

                return {
                    validIncrementalUpdate: false,
                    reason:
                        "PDF does not contain a startxref marker."
                };

            }

            const trailers = [
                ...this.findTrailers(text),
                ...this.findXrefStreamTrailers(
                    text,
                    revisionOffsets
                )
            ].sort(
                (a, b) =>
                    a.offset - b.offset
            );

            if (
                trailers.length === 0
            ) {

                return {
                    validIncrementalUpdate: false,
                    revisionCount:
                        revisionOffsets.length,
                    revisionOffsets,
                    reason:
                        "PDF does not contain a trailer dictionary."
                };

            }

            const previousLinks =
                trailers.filter(
                    (trailer) =>
                        trailer.previousOffset !== undefined
                );

            /*
             * A PDF without /Prev is a normal single-revision PDF.
             * That is not an incremental update.
             */
            if (
                previousLinks.length === 0
            ) {

                /*
                 * A PDF without /Prev is a valid
                 * single-revision PDF.
                 *
                 * No incremental update is present,
                 * but there is no incremental-update
                 * structural error to report.
                 */
                return {
                    validIncrementalUpdate:
                        true,
                    revisionCount:
                        revisionOffsets.length,
                    previousRevisionCount: 0,
                    revisionOffsets
                };

            }

            if (
                previousLinks.length !==
                revisionOffsets.length - 1
            ) {

                return {
                    validIncrementalUpdate: false,
                    revisionCount:
                        revisionOffsets.length,
                    previousRevisionCount:
                        previousLinks.length,
                    revisionOffsets,
                    reason:
                        "Incremental revision count and /Prev chain are inconsistent."
                };

            }

            /*
             * Each /Prev value must reference an earlier XRef position.
             */
            for (
                const trailer of previousLinks
            ) {

                const previousOffset =
                    trailer.previousOffset!;

                if (
                    !revisionOffsets.includes(
                        previousOffset
                    )
                ) {

                    return {
                        validIncrementalUpdate: false,
                        revisionCount:
                            revisionOffsets.length,
                        previousRevisionCount:
                            previousLinks.length,
                        revisionOffsets,
                        reason:
                            `Trailer /Prev offset ${previousOffset} does not reference a detected startxref position.`
                    };

                }

                if (
                    previousOffset >=
                    trailer.offset
                ) {

                    return {
                        validIncrementalUpdate: false,
                        revisionCount:
                            revisionOffsets.length,
                        previousRevisionCount:
                            previousLinks.length,
                        revisionOffsets,
                        reason:
                            `Trailer /Prev offset ${previousOffset} does not point to an earlier revision.`
                    };

                }

            }

            /*
             * A structurally valid incremental chain requires at least
             * two revisions.
             */
            if (
                revisionOffsets.length < 2
            ) {

                return {
                    validIncrementalUpdate: false,
                    revisionCount:
                        revisionOffsets.length,
                    previousRevisionCount:
                        previousLinks.length,
                    revisionOffsets,
                    reason:
                        "Incremental update requires at least two PDF revisions."
                };

            }

            return {
                validIncrementalUpdate: true,
                revisionCount:
                    revisionOffsets.length,
                previousRevisionCount:
                    previousLinks.length,
                revisionOffsets
            };

        }
        catch (
            error: unknown
        ) {

            return {
                validIncrementalUpdate: false,
                reason:
                    error instanceof Error
                        ? error.message
                        : "Unable to inspect PDF incremental updates."
            };

        }

    }

    private findStartXrefOffsets(
        text: string
    ): number[] {

        const offsets: number[] = [];

        const pattern =
            /startxref\s+(\d+)/g;

        let match:
            RegExpExecArray | null;

        while (
            (match =
                pattern.exec(text)) !== null
        ) {

            const offset =
                Number(match[1]);

            if (
                Number.isSafeInteger(offset) &&
                offset >= 0
            ) {

                offsets.push(offset);

            }

        }

        return offsets;

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
                text.slice(index, index + 2);

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
    private findXrefStreamTrailers(
        text: string,
        revisionOffsets: readonly number[]
    ): TrailerInfo[] {

        const trailers: TrailerInfo[] = [];

        for (
            const revisionOffset of revisionOffsets
        ) {

            if (
                revisionOffset < 0 ||
                revisionOffset >= text.length
            ) {
                continue;
            }

            const section =
                text.slice(revisionOffset);

            const objectHeaderMatch =
                section.match(
                    /^(\d+)\s+(\d+)\s+obj\b/
                );

            if (
                objectHeaderMatch === null
            ) {
                continue;
            }

            const dictionaryStart =
                section.indexOf(
                    "<<",
                    objectHeaderMatch[0].length
                );

            if (
                dictionaryStart === -1
            ) {
                continue;
            }

            const dictionaryEnd =
                this.findDictionaryEnd(
                    section,
                    dictionaryStart
                );

            if (
                dictionaryEnd === -1
            ) {
                continue;
            }

            const dictionary =
                section.slice(
                    dictionaryStart + 2,
                    dictionaryEnd
                );

            if (
                !/\/Type\s*\/XRef\b/.test(
                    dictionary
                )
            ) {
                continue;
            }

            const previousMatch =
                dictionary.match(
                    /\/Prev\s+(\d+)/
                );

            const previousOffset =
                previousMatch === null
                    ? undefined
                    : Number(
                        previousMatch[1]
                    );

            trailers.push({
                offset:
                    revisionOffset,
                ...(previousOffset !== undefined
                    ? {
                        previousOffset
                    }
                    : {})
            });

        }

        return trailers;

    }
    private findTrailers(
        text: string
    ): TrailerInfo[] {

        const trailers: TrailerInfo[] = [];

        const pattern =
            /trailer\s*<<([\s\S]*?)>>/g;

        let match:
            RegExpExecArray | null;

        while (
            (match =
                pattern.exec(text)) !== null
        ) {

            const dictionary =
                match[1];

            const previousMatch =
                dictionary.match(
                    /\/Prev\s+(\d+)/
                );

            const previousOffset =
                previousMatch === null
                    ? undefined
                    : Number(previousMatch[1]);

            trailers.push({
                offset:
                    match.index,
                ...(previousOffset !== undefined
                    ? {
                        previousOffset
                    }
                    : {})
            });

        }

        return trailers;

    }

}
