import {
    PDFArray,
    PDFDict,
    PDFDocument,
    PDFName,
    PDFRef,
} from "pdf-lib";

import type { IPdfDocumentService } from "../../services/IPdfDocumentService";

import type {
    ILaunchActionDetector,
    LaunchActionDetectionResult,
} from "../interfaces/ILaunchActionDetector";

export class LaunchActionDetector implements ILaunchActionDetector {

    public constructor(
        _pdfDocumentService?: IPdfDocumentService
    ) {
    }

    public async detect(
        file: File
    ): Promise<LaunchActionDetectionResult> {

        const bytes = new Uint8Array(await file.arrayBuffer());

        const document = await PDFDocument.load(bytes, {
            ignoreEncryption: false,
            throwOnInvalidObject: true,
        });

        const context = document.context;
        const visitedActions = new Set<object>();

        const resolve = (value: unknown): unknown => {
            if (value instanceof PDFRef) {
                return context.lookup(value);
            }
            return value;
        };

        const inspectAction = (input: unknown): boolean => {
            const value = resolve(input);

            if (!(value instanceof PDFDict)) {
                return false;
            }

            if (visitedActions.has(value)) {
                return false;
            }

            visitedActions.add(value);

            const actionType = value.lookup(PDFName.of("S"));

            if (
                actionType instanceof PDFName &&
                actionType.asString() === "/Launch"
            ) {
                return true;
            }

            return inspectNext(value.lookup(PDFName.of("Next")));
        };

        const inspectNext = (input: unknown): boolean => {
            const value = resolve(input);

            if (value instanceof PDFArray) {
                for (const child of value.asArray()) {
                    if (inspectAction(child)) {
                        return true;
                    }
                }
                return false;
            }

            return inspectAction(value);
        };

        const inspectAdditionalActions = (input: unknown): boolean => {
            const value = resolve(input);

            if (!(value instanceof PDFDict)) {
                return false;
            }

            for (const [, action] of value.entries()) {
                if (inspectAction(action)) {
                    return true;
                }
            }

            return false;
        };

        const inspectActionEntries = (value: unknown): boolean => {
            const dictionary = resolve(value);

            if (!(dictionary instanceof PDFDict)) {
                return false;
            }

            for (const [key, child] of dictionary.entries()) {
                const name = key.asString();

                if (
                    (name === "/A" || name === "/OpenAction") &&
                    inspectAction(child)
                ) {
                    return true;
                }

                if (
                    name === "/AA" &&
                    inspectAdditionalActions(child)
                ) {
                    return true;
                }
            }

            return false;
        };

        for (const [, object] of context.enumerateIndirectObjects()) {
            if (inspectActionEntries(object)) {
                return { hasLaunchActions: true };
            }
        }

        if (inspectActionEntries(document.catalog)) {
            return { hasLaunchActions: true };
        }

        return { hasLaunchActions: false };
    }
}