/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : pageTreeDetector.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Detector
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Detects and validates the structural PDF Page Tree.
 *
 * Responsibilities
 * ---------------------------------------------------------------------------
 * - Reuses XRef validation.
 * - Reuses Trailer validation.
 * - Resolves the trailer /Root Catalog object.
 * - Validates the Catalog /Pages reference.
 * - Validates /Pages and /Page nodes.
 * - Validates /Kids and /Count.
 * - Validates /Parent relationships.
 * - Detects Page Tree cycles.
 * - Verifies calculated page count against /Count.
 *
 * This detector does NOT:
 * - Produce ValidationResult.
 * - Handle UI logic.
 * - Modify the source PDF.
 * - Perform security validation.
 * - Implement a general-purpose PDF parser.
 *
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
    PdfObject,
    PdfObjectReference
} from "../parsers/PdfObject";

import type {
    IXrefDetector
} from "../interfaces/IXrefDetector";

import type {
    IPageTreeDetector
} from "../interfaces/IPageTreeDetector";

import type {
    PageTreeDetectionResult
} from "../models/PageTreeDetectionResult";


interface PageTreeNode {
    readonly reference: PdfObjectReference;
    readonly type: "Page" | "Pages";
}

export class PageTreeDetector
    implements IPageTreeDetector {

    private readonly xrefDetector:
        IXrefDetector;

    private readonly trailerDetector:
        TrailerDetector;

    private readonly objectParser:
        PdfObjectParser;

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

        this.objectParser =
            new PdfObjectParser();

    }

    public async detect(
        file: File
    ): Promise<PageTreeDetectionResult> {

        try {

            const xrefResult =
                await this.xrefDetector.detect(file);

            if (!xrefResult.validXref) {

                return {
                    validPageTree: false,
                    reason:
                        xrefResult.reason ??
                        "Cannot validate Page Tree because XRef validation failed."
                };

            }

            const trailerResult =
                await this.trailerDetector.detect(file);

            if (!trailerResult.validTrailer) {

                return {
                    validPageTree: false,
                    reason:
                        trailerResult.reason ??
                        "Cannot validate Page Tree because trailer validation failed."
                };

            }

            if (
                trailerResult.rootObjectNumber === undefined ||
                trailerResult.rootGenerationNumber === undefined
            ) {

                return {
                    validPageTree: false,
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

            const objects =
                this.objectParser.collectObjects(
                    text,
                    bytes
                );

            const rootReference: PdfObjectReference = {
                objectNumber:
                    trailerResult.rootObjectNumber,
                generationNumber:
                    trailerResult.rootGenerationNumber
            };

            const catalog =
                this.objectParser.getObject(
                    objects,
                    rootReference
                );

            if (catalog === undefined) {

                return {
                    validPageTree: false,
                    reason:
                        `Catalog object ${rootReference.objectNumber} ${rootReference.generationNumber} R does not exist.`
                };

            }

            if (
                !this.hasType(
                    catalog.body,
                    "Catalog"
                )
            ) {

                return {
                    validPageTree: false,
                    reason:
                        "Trailer Root object is not a /Catalog."
                };

            }

            const pagesReference =
                this.objectParser.parseReference(
                    catalog.body,
                    "/Pages"
                );

            if (pagesReference === undefined) {

                return {
                    validPageTree: false,
                    reason:
                        "Catalog does not contain a valid /Pages reference."
                };

            }

            const rootPages =
                this.objectParser.getObject(
                    objects,
                    pagesReference
                );

            if (rootPages === undefined) {

                return {
                    validPageTree: false,
                    rootPagesObjectNumber:
                        pagesReference.objectNumber,
                    rootPagesGenerationNumber:
                        pagesReference.generationNumber,
                    reason:
                        `Root /Pages object ${pagesReference.objectNumber} ${pagesReference.generationNumber} R does not exist.`
                };

            }

            if (
                !this.hasType(
                    rootPages.body,
                    "Pages"
                )
            ) {

                return {
                    validPageTree: false,
                    rootPagesObjectNumber:
                        pagesReference.objectNumber,
                    rootPagesGenerationNumber:
                        pagesReference.generationNumber,
                    reason:
                        "Root /Pages object is not a /Pages node."
                };

            }

            const visited =
                new Set<string>();

            const result =
                this.walkPagesNode(
                    objects,
                    pagesReference,
                    undefined,
                    visited
                );

            if (!result.valid) {

                return {
                    validPageTree: false,
                    rootPagesObjectNumber:
                        pagesReference.objectNumber,
                    rootPagesGenerationNumber:
                        pagesReference.generationNumber,
                    reason:
                        result.reason
                };

            }

            const rootCount =
                this.parseCount(
                    rootPages.body
                );

            if (rootCount === undefined) {

                return {
                    validPageTree: false,
                    rootPagesObjectNumber:
                        pagesReference.objectNumber,
                    rootPagesGenerationNumber:
                        pagesReference.generationNumber,
                    reason:
                        "Root /Pages object does not contain a valid /Count."
                };

            }

            if (
                rootCount !== result.pageCount
            ) {

                return {
                    validPageTree: false,
                    pageCount:
                        result.pageCount,
                    rootPagesObjectNumber:
                        pagesReference.objectNumber,
                    rootPagesGenerationNumber:
                        pagesReference.generationNumber,
                    reason:
                        `Page Tree /Count ${rootCount} does not match calculated page count ${result.pageCount}.`
                };

            }

            return {
                validPageTree: true,
                pageCount:
                    result.pageCount,
                rootPagesObjectNumber:
                    pagesReference.objectNumber,
                rootPagesGenerationNumber:
                    pagesReference.generationNumber
            };

        }
        catch (
            error: unknown
        ) {

            return {
                validPageTree: false,
                reason:
                    error instanceof Error
                        ? error.message
                        : "Unable to inspect PDF Page Tree."
            };

        }

    }

    private hasType(
        body: string,
        type: "Catalog" | "Pages" | "Page"
    ): boolean {

        const pattern =
            new RegExp(
                `/Type\\s*/${type}(?![A-Za-z0-9])`
            );

        return pattern.test(body);

    }

    private parseCount(
        body: string
    ): number | undefined {

        const match =
            body.match(
                /\/Count\s+(\d+)/
            );

        if (match === null) {
            return undefined;
        }

        const count =
            Number(match[1]);

        if (
            !Number.isSafeInteger(count) ||
            count < 0
        ) {

            return undefined;
        }

        return count;

    }

    private parseKids(
        body: string
    ): PdfObjectReference[] | undefined {

        const match =
            body.match(
                /\/Kids\s*\[([\s\S]*?)\]/
            );

        if (match === null) {
            return undefined;
        }

        const references:
            PdfObjectReference[] = [];

        const referencePattern =
            /(\d+)\s+(\d+)\s+R/g;

        let referenceMatch:
            RegExpExecArray | null;

        while (
            (referenceMatch =
                referencePattern.exec(match[1])) !== null
        ) {

            const objectNumber =
                Number(referenceMatch[1]);

            const generationNumber =
                Number(referenceMatch[2]);

            if (
                !Number.isSafeInteger(objectNumber) ||
                objectNumber <= 0 ||
                !Number.isSafeInteger(generationNumber) ||
                generationNumber < 0
            ) {

                return undefined;

            }

            references.push({
                objectNumber,
                generationNumber
            });

        }

        if (
            references.length === 0
        ) {

            return undefined;

        }

        return references;

    }

    private walkPagesNode(
        objects: Map<string, PdfObject>,
        reference: PdfObjectReference,
        expectedParent: PdfObjectReference | undefined,
        visited: Set<string>
    ): {
        valid: boolean;
        pageCount: number;
        reason?: string;
    } {

        const key =
            `${reference.objectNumber} ${reference.generationNumber}`;

        if (
            visited.has(key)
        ) {

            return {
                valid: false,
                pageCount: 0,
                reason:
                    `Circular Page Tree reference detected at ${key} R.`
            };

        }

        const object =
            this.objectParser.getObject(
                objects,
                reference
            );

        if (object === undefined) {

            return {
                valid: false,
                pageCount: 0,
                reason:
                    `Page Tree object ${key} R does not exist.`
            };

        }

        visited.add(key);

        if (
            this.hasType(
                object.body,
                "Page"
            )
        ) {

            if (
                expectedParent !== undefined
            ) {

                const parent =
                    this.objectParser.parseReference(
                        object.body,
                        "/Parent"
                    );

                if (
                    parent === undefined ||
                    parent.objectNumber !==
                        expectedParent.objectNumber ||
                    parent.generationNumber !==
                        expectedParent.generationNumber
                ) {

                    return {
                        valid: false,
                        pageCount: 0,
                        reason:
                            `Page ${key} R has an invalid /Parent reference.`
                    };

                }

            }

            return {
                valid: true,
                pageCount: 1
            };

        }

        if (
            !this.hasType(
                object.body,
                "Pages"
            )
        ) {

            return {
                valid: false,
                pageCount: 0,
                reason:
                    `Page Tree object ${key} R is neither /Page nor /Pages.`
            };

        }

        if (
            expectedParent !== undefined
        ) {

            const parent =
                this.objectParser.parseReference(
                    object.body,
                    "/Parent"
                );

            if (
                parent === undefined ||
                parent.objectNumber !==
                    expectedParent.objectNumber ||
                parent.generationNumber !==
                    expectedParent.generationNumber
            ) {

                return {
                    valid: false,
                    pageCount: 0,
                    reason:
                        `Pages node ${key} R has an invalid /Parent reference.`
                };

            }

        }

        const count =
            this.parseCount(
                object.body
            );

        if (count === undefined) {

            return {
                valid: false,
                pageCount: 0,
                reason:
                    `Pages node ${key} R does not contain a valid /Count.`
            };

        }

        const kids =
            this.parseKids(
                object.body
            );

        if (kids === undefined) {

            return {
                valid: false,
                pageCount: 0,
                reason:
                    `Pages node ${key} R does not contain a valid /Kids array.`
            };

        }

        let pageCount = 0;

        for (
            const child
            of kids
        ) {

            const childResult =
                this.walkPagesNode(
                    objects,
                    child,
                    reference,
                    new Set(visited)
                );

            if (
                !childResult.valid
            ) {

                return childResult;

            }

            pageCount +=
                childResult.pageCount;

        }

        if (
            count !== pageCount
        ) {

            return {
                valid: false,
                pageCount,
                reason:
                    `Pages node ${key} R /Count ${count} does not match calculated page count ${pageCount}.`
            };

        }

        return {
            valid: true,
            pageCount
        };

    }

}
