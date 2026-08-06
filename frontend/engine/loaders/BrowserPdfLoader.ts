import { BrowserPdfUnlocker } from "@/engine/unlock/BrowserPdfUnlocker";
import { BrowserPdfDocument } from "@/engine/pdf/BrowserPdfDocument";

import { PdfErrorCode } from "@/engine/processing/errors/PdfErrorCode";
import { PdfErrorMapper } from "@/engine/processing/errors/PdfErrorMapper";

import type { BrowserPdfLoadResult } from "@/engine/processing/results/BrowserPdfLoadResult";

export class BrowserPdfLoader {

    private readonly unlocker =
        new BrowserPdfUnlocker();

    public async load(
        file: File,
        password?: string
    ): Promise<BrowserPdfLoadResult> {


        try {

            /**
             * Read file.
             */
            const buffer = await file.arrayBuffer();

/**
 * Password verification
 */
if (password) {

    const unlockResult =
        await this.unlocker.unlock(
            file,
            password
        );

    if (!unlockResult.success) {

        return {

            success: false,

            document: null,

            pageCount: 0,

            encrypted: true,

            passwordRequired: true,

            passwordAccepted: false,

            errorCode: PdfErrorCode.INVALID_PASSWORD,

            message:
                unlockResult.message ??
                "Invalid PDF password."

        };

    }

}

            /**
             * Basic PDF header validation.
             */
            const header = new TextDecoder()
                .decode(buffer.slice(0, 5));

            if (header !== "%PDF-") {

                return {
                    success: false,
                    document: null,
                    pageCount: 0,
                    encrypted: false,
                    passwordRequired: false,
                    passwordAccepted: false,
                    errorCode: PdfErrorCode.INVALID_PDF,
                    message: "Invalid PDF file."
                };

            }

            /**
             * Load document.
             */
            const document = new BrowserPdfDocument();

            await document.load(buffer);

            /**
             * Success.
             */
            return {

                success: true,

                document,

                pageCount: document.getPageCount(),

                encrypted: false,

                passwordRequired: false,

                passwordAccepted: true,

                errorCode: PdfErrorCode.NONE,

                message: null

            };

        }
        catch (error) {

            const errorCode =
                PdfErrorMapper.map(error);

            return {

                success: false,

                document: null,

                pageCount: 0,

                encrypted: false,

                passwordRequired: false,

                passwordAccepted: false,

                errorCode,

                message:
                    error instanceof Error
                        ? error.message
                        : "Unknown error."

            };

        }

    }

}