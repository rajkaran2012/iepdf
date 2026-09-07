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
 * Detects and validates the traditional PDF cross-reference table.
 *
 * Responsibilities
 * ---------------------------------------------------------------------------
 * - Reads PDF bytes.
 * - Locates startxref.
 * - Resolves the referenced XRef offset.
 * - Validates the XRef table marker.
 * - Validates the subsection header.
 * - Validates XRef entry structure.
 *
 * This detector does NOT:
 * - Produce ValidationResult.
 * - Handle UI logic.
 * - Modify the source PDF.
 * - Perform security validation.
 *
 * =============================================================================
 */

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

        if (
            !xrefSection.startsWith("xref")
        ) {

            return {
                validXref: false,
                xrefOffset,
                reason:
                    "startxref does not point to an XRef table."
            };

        }

        const lines =
            xrefSection.split(/\r?\n/);

        /*
         * Expected structure:
         *
         * xref
         * 0 N
         * 0000000000 65535 f
         * ...
         * trailer
         */

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
            entryCount <= 0
        ) {

            return {
                validXref: false,
                xrefOffset,
                xrefType: "table",
                reason:
                    "XRef subsection values are invalid."
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
            trailerLine !== "trailer"
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

}
