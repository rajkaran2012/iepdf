/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : PdfObjectParser.ts
 * Module     : Deep Validation
 * Layer      : Shared PDF Object Parser
 * =============================================================================
 *
 * Purpose
 * ---------------------------------------------------------------------------
 * Provides bounded PDF indirect-object collection and reference resolution.
 *
 * Supports:
 * - Normal indirect objects.
 * - Compressed objects stored inside PDF object streams (ObjStm).
 *
 * This is NOT a general-purpose PDF parser.
 * =============================================================================
 */

import { unzlibSync } from "fflate";

import type {
    PdfObject,
    PdfObjectReference
} from "./PdfObject";

export class PdfObjectParser {

    public collectObjects(
        text: string,
        bytes?: Uint8Array
    ): Map<string, PdfObject> {

        const objects =
            this.collectIndirectObjects(text);

        if (bytes !== undefined) {
            this.collectCompressedObjects(
                text,
                bytes,
                objects
            );
        }

        return objects;

    }

    public getObject(
        objects: Map<string, PdfObject>,
        reference: PdfObjectReference
    ): PdfObject | undefined {

        return objects.get(
            `${reference.objectNumber} ${reference.generationNumber}`
        );

    }

    public parseReference(
        body: string,
        key: string
    ): PdfObjectReference | undefined {

        const escapedKey =
            key.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const match =
            body.match(
                new RegExp(
                    `${escapedKey}\\s+(\\d+)\\s+(\\d+)\\s+R`
                )
            );

        if (
            match === null
        ) {
            return undefined;
        }

        const objectNumber =
            Number(match[1]);

        const generationNumber =
            Number(match[2]);

        if (
            !Number.isSafeInteger(objectNumber) ||
            objectNumber <= 0 ||
            !Number.isSafeInteger(generationNumber) ||
            generationNumber < 0
        ) {
            return undefined;
        }

        return {
            objectNumber,
            generationNumber
        };

    }

    private collectIndirectObjects(
        text: string
    ): Map<string, PdfObject> {

        const objects =
            new Map<string, PdfObject>();

        const pattern =
            /(?:^|\r?\n|endobj)\s*(\d+)\s+(\d+)\s+obj\b/g;

        const matches:
            Array<{
                objectNumber: number;
                generationNumber: number;
                startIndex: number;
            }> = [];

        let match:
            RegExpExecArray | null;

        while (
            (match =
                pattern.exec(text)) !== null
        ) {

            const objectNumber =
                Number(match[1]);

            const generationNumber =
                Number(match[2]);

            if (
                !Number.isSafeInteger(objectNumber) ||
                objectNumber <= 0 ||
                !Number.isSafeInteger(generationNumber) ||
                generationNumber < 0
            ) {
                continue;
            }

            const declarationOffset =
                match[0].search(/\d/);

            const declarationStartIndex =
                match.index + declarationOffset;

            matches.push({
                objectNumber,
                generationNumber,
                startIndex:
                    declarationStartIndex
            });

        }

        for (
            let index = 0;
            index < matches.length;
            index++
        ) {

            const current =
                matches[index];

            const nextStart =
                index + 1 < matches.length
                    ? matches[index + 1].startIndex
                    : text.length;

            const objectText =
                text.slice(
                    current.startIndex,
                    nextStart
                );

            const endObjectIndex =
                objectText.search(
                    /\bendobj\b/
                );

            if (
                endObjectIndex === -1
            ) {
                continue;
            }

            const objectKeywordIndex =
                objectText.indexOf("obj");

            if (
                objectKeywordIndex === -1
            ) {
                continue;
            }

            const body =
                objectText.slice(
                    objectKeywordIndex + 3,
                    endObjectIndex
                );

            const key =
                `${current.objectNumber} ${current.generationNumber}`;

            objects.set(
                key,
                {
                    objectNumber:
                        current.objectNumber,
                    generationNumber:
                        current.generationNumber,
                    body
                }
            );

        }

        return objects;

    }

    private collectCompressedObjects(
        text: string,
        bytes: Uint8Array,
        objects: Map<string, PdfObject>
    ): void {

        const objectPattern =
            /(?:^|\r?\n|endobj)\s*(\d+)\s+(\d+)\s+obj\b/g;

        let match:
            RegExpExecArray | null;

        while (
            (match =
                objectPattern.exec(text)) !== null
        ) {

            const objectNumber =
                Number(match[1]);

            const generationNumber =
                Number(match[2]);

            if (
                !Number.isSafeInteger(objectNumber) ||
                objectNumber <= 0 ||
                !Number.isSafeInteger(generationNumber) ||
                generationNumber < 0
            ) {
                continue;
            }

            const declarationOffset =
                match[0].search(/\d/);

            const declarationStartIndex =
                match.index + declarationOffset;

            const objectEnd =
                text.indexOf(
                    "endobj",
                    declarationStartIndex
                );

            if (objectEnd === -1) {
                continue;
            }

            const dictionaryEnd =
                this.findDictionaryEnd(
                    text,
                    text.indexOf(
                        "<<",
                        declarationStartIndex
                    )
                );

            if (dictionaryEnd === -1) {
                continue;
            }

            const dictionary =
                text.slice(
                    text.indexOf(
                        "<<",
                        declarationStartIndex
                    ),
                    dictionaryEnd + 2
                );

            if (
                !this.hasDictionaryName(
                    dictionary,
                    "/Type",
                    "/ObjStm"
                )
            ) {
                continue;
            }

            const count =
                this.readInteger(
                    dictionary,
                    "/N"
                );

            const first =
                this.readInteger(
                    dictionary,
                    "/First"
                );

            if (
                count === undefined ||
                first === undefined ||
                count <= 0 ||
                first < 0
            ) {
                continue;
            }

            const filter =
                this.readFilter(
                    dictionary
                );

            if (
                filter !== undefined &&
                filter !== "FlateDecode"
            ) {
                continue;
            }

            const streamKeywordIndex =
                text.indexOf(
                    "stream",
                    dictionaryEnd + 2
                );

            if (streamKeywordIndex === -1) {
                continue;
            }

            let streamStart =
                streamKeywordIndex + "stream".length;

            if (
                text.slice(
                    streamStart,
                    streamStart + 2
                ) === "\r\n"
            ) {
                streamStart += 2;
            } else if (
                text[streamStart] === "\n"
            ) {
                streamStart += 1;
            } else if (
                text[streamStart] === "\r"
            ) {
                streamStart += 1;
            }

            const length =
                this.readInteger(
                    dictionary,
                    "/Length"
                );

            if (
                length === undefined ||
                length < 0
            ) {
                continue;
            }

            const streamEnd =
                streamStart + length;

            if (
                streamStart < 0 ||
                streamEnd <= streamStart ||
                streamEnd > bytes.length
            ) {
                continue;
            }

            const streamBytes =
                bytes.slice(
                    streamStart,
                    streamEnd
                );

            let decodedStream:
                Uint8Array;

            try {

                decodedStream =
                    filter === "FlateDecode"
                        ? unzlibSync(streamBytes)
                        : streamBytes;

            } catch (_error: unknown) {

                continue;

            }

            this.parseObjectStream(
                decodedStream,
                count,
                first,
                objects
            );

        }

    }

    private parseObjectStream(
        bytes: Uint8Array,
        objectCount: number,
        firstOffset: number,
        objects: Map<string, PdfObject>
    ): void {

        if (
            firstOffset < 0 ||
            firstOffset > bytes.length ||
            objectCount <= 0
        ) {
            return;
        }

        const text =
            new TextDecoder("latin1").decode(bytes);

        const header =
            text.slice(
                0,
                firstOffset
            );

        const tokens =
            header.match(/\d+/g) ?? [];

        if (
            tokens.length < objectCount * 2
        ) {
            return;
        }

        const entries:
            Array<{
                objectNumber: number;
                offset: number;
            }> = [];

        for (
            let index = 0;
            index < objectCount;
            index++
        ) {

            const objectNumber =
                Number(
                    tokens[index * 2]
                );

            const offset =
                Number(
                    tokens[index * 2 + 1]
                );

            if (
                !Number.isSafeInteger(objectNumber) ||
                objectNumber <= 0 ||
                !Number.isSafeInteger(offset) ||
                offset < 0
            ) {
                return;
            }

            entries.push({
                objectNumber,
                offset
            });

        }

        for (
            let index = 0;
            index < entries.length;
            index++
        ) {

            const current =
                entries[index];

            const next =
                index + 1 < entries.length
                    ? entries[index + 1]
                    : undefined;

            const start =
                firstOffset +
                current.offset;

            const end =
                next !== undefined
                    ? firstOffset + next.offset
                    : bytes.length;

            if (
                start < firstOffset ||
                start > bytes.length ||
                end < start ||
                end > bytes.length
            ) {
                continue;
            }

            const body =
                text.slice(
                    start,
                    end
                ).trim();

            const key =
                `${current.objectNumber} 0`;

            if (
                objects.has(key)
            ) {
                continue;
            }

            objects.set(
                key,
                {
                    objectNumber:
                        current.objectNumber,
                    generationNumber: 0,
                    body
                }
            );

        }

    }

    private findDictionaryEnd(
        text: string,
        dictionaryStart: number
    ): number {

        if (
            dictionaryStart < 0
        ) {
            return -1;
        }

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

            if (
                pair === "<<"
            ) {

                depth++;
                index++;
                continue;

            }

            if (
                pair === ">>"
            ) {

                depth--;

                if (
                    depth === 0
                ) {
                    return index;
                }

                index++;

            }

        }

        return -1;

    }

    private hasDictionaryName(
        dictionary: string,
        key: string,
        expectedValue: string
    ): boolean {

        const pattern =
            new RegExp(
                `${this.escapeRegExp(key)}\\s*${this.escapeRegExp(expectedValue)}(?:\\s|/|>)`
            );

        return pattern.test(
            dictionary
        );

    }

    private readInteger(
        dictionary: string,
        key: string
    ): number | undefined {

        const match =
            dictionary.match(
                new RegExp(
                    `${this.escapeRegExp(key)}\\s+(\\d+)`
                )
            );

        if (
            match === null
        ) {
            return undefined;
        }

        const value =
            Number(match[1]);

        if (
            !Number.isSafeInteger(value)
        ) {
            return undefined;
        }

        return value;

    }

    private readFilter(
        dictionary: string
    ): string | undefined {

        const match =
            dictionary.match(
                /\/Filter\s*(?:\/([A-Za-z0-9]+)|\[\s*\/([A-Za-z0-9]+))/
            );

        if (
            match === null
        ) {
            return undefined;
        }

        return (
            match[1] ??
            match[2]
        );

    }

    private escapeRegExp(
        value: string
    ): string {

        return value.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

    }

}
