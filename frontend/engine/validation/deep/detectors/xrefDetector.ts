/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : xrefDetector.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Detector
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Detects and validates PDF cross-reference tables and XRef streams.
 *
 * =============================================================================
 */

import { unzlibSync } from "fflate";

import type {
    IXrefDetector
} from "../interfaces/IXrefDetector";

import type {
    XrefDetectionResult
} from "../models/XrefDetectionResult";

export class XrefDetector implements IXrefDetector {

    public async detect(
        file: File
    ): Promise<XrefDetectionResult> {

        const buffer =
            await file.arrayBuffer();

        const bytes =
            new Uint8Array(buffer);

        const text =
            new TextDecoder("latin1").decode(bytes);

        const startXrefMarker =
            "startxref";

        const startXrefIndex =
            text.lastIndexOf(startXrefMarker);

        if (startXrefIndex === -1) {

            return {
                validXref: false,
                reason:
                    "PDF does not contain a startxref marker."
            };

        }

        const afterStartXref =
            text.slice(
                startXrefIndex + startXrefMarker.length
            );

        const offsetMatch =
            afterStartXref.match(
                /^\s*(\d+)/
            );

        if (offsetMatch === null) {

            return {
                validXref: false,
                reason:
                    "startxref does not contain a valid byte offset."
            };

        }

        const xrefOffset =
            Number(offsetMatch[1]);

        if (
            !Number.isSafeInteger(xrefOffset) ||
            xrefOffset < 0 ||
            xrefOffset >= bytes.length
        ) {

            return {
                validXref: false,
                xrefOffset,
                reason:
                    "startxref points outside the PDF."
            };

        }

        const xrefSection =
            text.slice(xrefOffset);

        /*
         * -----------------------------------------------------------------------
         * Traditional XRef table
         * -----------------------------------------------------------------------
         */

        if (xrefSection.startsWith("xref")) {

            return this.detectTraditionalXref(
                text,
                bytes,
                xrefOffset
            );

        }

        /*
         * -----------------------------------------------------------------------
         * Direct XRef stream
         *
         * startxref points directly at:
         *
         *   objectNumber generationNumber obj
         *   <<
         *      /Type /XRef
         *      /Size ...
         *      /W [...]
         *      /Length ...
         *   >>
         *   stream
         *   ...
         *   endstream
         *   endobj
         * -----------------------------------------------------------------------
         */

        return this.detectXrefStream(
            text,
            bytes,
            xrefOffset
        );

    }

    private detectTraditionalXref(
        text: string,
        bytes: Uint8Array,
        xrefOffset: number
    ): XrefDetectionResult {

        const xrefSection =
            text.slice(xrefOffset);

        const lines =
            xrefSection.split(/\r?\n/);

        if (
            lines.length < 4 ||
            lines[0] !== "xref"
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "table",
                reason:
                    "XRef table is incomplete."
            };

        }

        const subsection =
            lines[1].trim().match(
                /^(\d+)\s+(\d+)$/
            );

        if (subsection === null) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "table",
                reason:
                    "XRef subsection header is invalid."
            };

        }

        const firstObject =
            Number(subsection[1]);

        const entryCount =
            Number(subsection[2]);

        if (
            !Number.isSafeInteger(firstObject) ||
            !Number.isSafeInteger(entryCount) ||
            firstObject < 0 ||
            entryCount < 0
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "table",
                reason:
                    "XRef subsection values are invalid."
            };

        }

        /*
         * A zero-entry traditional XRef table is valid only when it
         * represents a hybrid/incremental continuation.
         */

        if (entryCount === 0) {

            const trailerCandidate =
                lines
                    .slice(2)
                    .join("\n");

            const trailerDictionaryMatch =
                trailerCandidate.match(
                    /trailer\s*<<([\s\S]*?)>>/
                );

            if (trailerDictionaryMatch === null) {

                return {
                    validXref: false,
                    xrefOffset,
                    xrefType: "table",
                    entryCount,
                    reason:
                        "Zero-entry XRef table is missing a valid trailer continuation."
                };

            }

            const trailerDictionary =
                trailerDictionaryMatch[1];

            const previousMatch =
                trailerDictionary.match(
                    /\/Prev\s+(\d+)/
                );

            const xrefStreamMatch =
                trailerDictionary.match(
                    /\/XRefStm\s+(\d+)/
                );

            if (
                previousMatch === null &&
                xrefStreamMatch === null
            ) {

                return {
                    validXref: false,
                    xrefOffset,
                    xrefType: "table",
                    entryCount,
                    reason:
                        "Zero-entry XRef table does not reference a previous revision or XRef stream."
                };

            }

            if (previousMatch !== null) {

                const previousOffset =
                    Number(previousMatch[1]);

                if (
                    !Number.isSafeInteger(previousOffset) ||
                    previousOffset < 0 ||
                    previousOffset >= bytes.length
                ) {

                    return {
                        validXref: false,
                        xrefOffset,
                        xrefType: "table",
                        entryCount,
                        reason:
                            "XRef /Prev offset is outside the PDF."
                    };

                }

            }

            if (xrefStreamMatch !== null) {

                const xrefStreamOffset =
                    Number(xrefStreamMatch[1]);

                if (
                    !Number.isSafeInteger(xrefStreamOffset) ||
                    xrefStreamOffset < 0 ||
                    xrefStreamOffset >= bytes.length
                ) {

                    return {
                        validXref: false,
                        xrefOffset,
                        xrefType: "table",
                        entryCount,
                        reason:
                            "XRef /XRefStm offset is outside the PDF."
                    };

                }

                const xrefStreamSection =
                    text.slice(xrefStreamOffset);

                if (
                    !/^\s*\d+\s+\d+\s+obj\b/.test(
                        xrefStreamSection
                    ) ||
                    !/\/Type\s*\/XRef\b/.test(
                        xrefStreamSection
                    ) ||
                    !/\bstream\b/.test(
                        xrefStreamSection
                    )
                ) {

                    return {
                        validXref: false,
                        xrefOffset,
                        xrefType: "table",
                        entryCount,
                        reason:
                            "XRef /XRefStm does not point to a valid XRef stream object."
                    };

                }

            }

            return {
                validXref: true,
                xrefOffset,
                xrefType: "table",
                entryCount
            };

        }

        const entryStart = 2;

        const entryEnd =
            entryStart + entryCount;

        if (
            lines.length < entryEnd + 1
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "table",
                entryCount,
                reason:
                    "XRef table contains fewer entries than declared."
            };

        }

        const entryPattern =
            /^(\d{10})\s+(\d{5})\s+([fn])\s*$/;

        for (
            let index = entryStart;
            index < entryEnd;
            index++
        ) {

            const entry =
                lines[index].trim();

            if (
                !entryPattern.test(entry)
            ) {

                return {
                    validXref: false,
                    xrefOffset,
                    xrefType: "table",
                    entryCount,
                    reason:
                        `Invalid XRef entry at index ${index - entryStart}.`
                };

            }

        }

        const trailerLine =
            lines[entryEnd]?.trim();

        if (
            trailerLine !== "trailer" &&
            !trailerLine?.startsWith("trailer <<")
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "table",
                entryCount,
                reason:
                    "XRef table is not followed by a trailer."
            };

        }

        return {
            validXref: true,
            xrefOffset,
            xrefType: "table",
            entryCount
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
    private detectXrefStream(
        text: string,
        bytes: Uint8Array,
        xrefOffset: number
    ): XrefDetectionResult {

        const section =
            text.slice(xrefOffset);

        const objectHeaderMatch =
            section.match(
                /^(\d+)\s+(\d+)\s+obj\b/
            );

        if (objectHeaderMatch === null) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "startxref does not point to a valid XRef table or XRef stream object."
            };

        }

        const dictionaryStart =
            section.indexOf("<<", objectHeaderMatch[0].length);

        if (dictionaryStart === -1) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream object is missing its dictionary."
            };

        }

        const dictionaryEnd =
            this.findDictionaryEnd(
                section,
                dictionaryStart
            );

        if (dictionaryEnd === -1) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream dictionary is incomplete."
            };

        }

        const dictionary =
            section.slice(
                dictionaryStart + 2,
                dictionaryEnd
            );

        if (
            !/\/Type\s*\/XRef\b/.test(dictionary)
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream dictionary does not contain /Type /XRef."
            };

        }

        const sizeMatch =
            dictionary.match(
                /\/Size\s+(\d+)/
            );

        if (sizeMatch === null) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream dictionary does not contain a valid /Size entry."
            };

        }

        const size =
            Number(sizeMatch[1]);

        if (
            !Number.isSafeInteger(size) ||
            size <= 0
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream /Size value is invalid."
            };

        }

        const widthMatch =
            dictionary.match(
                /\/W\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s*\]/
            );

        if (widthMatch === null) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream dictionary does not contain a valid /W array."
            };

        }

        const widths = [
            Number(widthMatch[1]),
            Number(widthMatch[2]),
            Number(widthMatch[3])
        ];

        if (
            widths.some(
                width =>
                    !Number.isSafeInteger(width) ||
                    width < 0
            ) ||
            widths.every(
                width => width === 0
            )
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream /W array contains invalid field widths."
            };

        }

        const lengthMatch =
            dictionary.match(
                /\/Length\s+(\d+)/
            );

        if (lengthMatch === null) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream dictionary does not contain a valid /Length entry."
            };

        }

        const encodedLength =
            Number(lengthMatch[1]);

        if (
            !Number.isSafeInteger(encodedLength) ||
            encodedLength < 0
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream /Length value is invalid."
            };

        }

        const streamKeywordRelative =
            section.indexOf(
                "stream",
                dictionaryEnd + 2
            );

        if (streamKeywordRelative === -1) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream object does not contain a stream."
            };

        }

        const streamDataStart =
            xrefOffset +
            streamKeywordRelative +
            "stream".length;

        let dataStart =
            streamDataStart;

        if (
            bytes[dataStart] === 0x0d &&
            bytes[dataStart + 1] === 0x0a
        ) {

            dataStart += 2;

        } else if (
            bytes[dataStart] === 0x0a ||
            bytes[dataStart] === 0x0d
        ) {

            dataStart += 1;

        } else {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream is not followed by a valid end-of-line marker."
            };

        }

        const dataEnd =
            dataStart + encodedLength;

        if (
            dataEnd > bytes.length
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream data extends beyond the PDF."
            };

        }

        const streamData =
            bytes.slice(
                dataStart,
                dataEnd
            );

        const filterMatch =
            dictionary.match(
                /\/Filter\s*\/([A-Za-z0-9]+)/
            );

        let decodedData: Uint8Array;

        try {

            if (
                filterMatch !== null &&
                filterMatch[1] === "FlateDecode"
            ) {

                decodedData =
                    unzlibSync(streamData);

            } else if (
                filterMatch === null
            ) {

                decodedData =
                    streamData;

            } else {

                return {
                    validXref: false,
                    xrefOffset,
                    xrefType: "stream",
                    reason:
                        `Unsupported XRef stream filter: ${filterMatch[1]}.`
                };

            }

        } catch (_error: unknown) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                reason:
                    "XRef stream could not be decoded."
            };

        }

        const decodeParmsMatch =
            dictionary.match(
                /\/DecodeParms\s*<<([\s\S]*?)>>/
            );

        let predictor =
            1;

        let columns =
            widths[0] +
            widths[1] +
            widths[2];

        if (decodeParmsMatch !== null) {

            const decodeParms =
                decodeParmsMatch[1];

            const predictorMatch =
                decodeParms.match(
                    /\/Predictor\s+(\d+)/
                );

            const columnsMatch =
                decodeParms.match(
                    /\/Columns\s+(\d+)/
                );

            if (predictorMatch !== null) {

                predictor =
                    Number(
                        predictorMatch[1]
                    );

            }

            if (columnsMatch !== null) {

                columns =
                    Number(
                        columnsMatch[1]
                    );

            }

            if (
                !Number.isSafeInteger(predictor) ||
                predictor < 1
            ) {

                return {
                    validXref: false,
                    xrefOffset,
                    xrefType: "stream",
                    reason:
                        "XRef stream /Predictor value is invalid."
                };

            }

            if (
                !Number.isSafeInteger(columns) ||
                columns <= 0
            ) {

                return {
                    validXref: false,
                    xrefOffset,
                    xrefType: "stream",
                    reason:
                        "XRef stream /Columns value is invalid."
                };

            }

        }

        const indexMatch =
            dictionary.match(
                /\/Index\s*\[([\s\S]*?)\]/
            );

        let entryCount =
            size;

        if (indexMatch !== null) {

            const indexValues =
                indexMatch[1]
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map(Number);

            if (
                indexValues.length === 0 ||
                indexValues.length % 2 !== 0 ||
                indexValues.some(
                    value =>
                        !Number.isSafeInteger(value) ||
                        value < 0
                )
            ) {

                return {
                    validXref: false,
                    xrefOffset,
                    xrefType: "stream",
                    reason:
                        "XRef stream /Index array is invalid."
                };

            }

            entryCount = 0;

            for (
                let index = 0;
                index < indexValues.length;
                index += 2
            ) {

                entryCount +=
                    indexValues[index + 1];

            }

        }

        let predictorData =
            decodedData;

        if (
            predictor >= 10 &&
            predictor <= 15
        ) {

            const rowLength =
                columns + 1;

            if (
                decodedData.length % rowLength !== 0
            ) {

                return {
                    validXref: false,
                    xrefOffset,
                    xrefType: "stream",
                    entryCount,
                    reason:
                        "XRef stream predictor data has an invalid row length."
                };

            }

            const rows =
                decodedData.length / rowLength;

            const reconstructed =
                new Uint8Array(
                    rows * columns
                );

            for (
                let row = 0;
                row < rows;
                row++
            ) {

                const rowStart =
                    row * rowLength;

                const outputStart =
                    row * columns;

                const filterType =
                    decodedData[rowStart];

                if (
                    filterType > 4
                ) {

                    return {
                        validXref: false,
                        xrefOffset,
                        xrefType: "stream",
                        entryCount,
                        reason:
                            `XRef stream contains an invalid PNG predictor filter type: ${filterType}.`
                    };

                }

                for (
                    let column = 0;
                    column < columns;
                    column++
                ) {

                    const raw =
                        decodedData[
                            rowStart +
                            1 +
                            column
                        ];

                    const left =
                        column > 0
                            ? reconstructed[
                                outputStart +
                                column -
                                1
                            ]
                            : 0;

                    const above =
                        row > 0
                            ? reconstructed[
                                outputStart -
                                columns +
                                column
                            ]
                            : 0;

                    const upperLeft =
                        row > 0 &&
                        column > 0
                            ? reconstructed[
                                outputStart -
                                columns +
                                column -
                                1
                            ]
                            : 0;

                    let value =
                        raw;

                    if (
                        filterType === 1
                    ) {

                        value =
                            raw +
                            left;

                    } else if (
                        filterType === 2
                    ) {

                        value =
                            raw +
                            above;

                    } else if (
                        filterType === 3
                    ) {

                        value =
                            raw +
                            Math.floor(
                                (left + above) /
                                2
                            );

                    } else if (
                        filterType === 4
                    ) {

                        const p =
                            left +
                            above -
                            upperLeft;

                        const pa =
                            Math.abs(
                                p - left
                            );

                        const pb =
                            Math.abs(
                                p - above
                            );

                        const pc =
                            Math.abs(
                                p - upperLeft
                            );

                        const predictorValue =
                            pa <= pb &&
                            pa <= pc
                                ? left
                                : pb <= pc
                                    ? above
                                    : upperLeft;

                        value =
                            raw +
                            predictorValue;

                    }

                    reconstructed[
                        outputStart +
                        column
                    ] =
                        value & 0xff;

                }

            }

            predictorData =
                reconstructed;

        } else if (
            predictor !== 1
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                entryCount,
                reason:
                    `Unsupported XRef stream predictor: ${predictor}.`
            };

        }

        const entryWidth =
            widths[0] +
            widths[1] +
            widths[2];

        const expectedDecodedLength =
            entryCount * entryWidth;

        if (
            predictorData.length !== expectedDecodedLength
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "stream",
                entryCount,
                reason:
                    `XRef stream decoded length is invalid. Expected ${expectedDecodedLength} bytes, received ${predictorData.length}.`
            };

        }

        return {
            validXref: true,
            xrefOffset,
            xrefType: "stream",
            entryCount
        };

    }

}
