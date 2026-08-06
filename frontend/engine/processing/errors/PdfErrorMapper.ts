/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File    : PdfErrorMapper.ts
 * Module  : Processing
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Converts JavaScript / library exceptions into standardized PdfErrorCode values.
 *
 * NOTE:
 * This is the ONLY place in the processing engine that should inspect
 * exception messages.
 * =============================================================================
 */

import { PdfErrorCode } from "./PdfErrorCode";

export class PdfErrorMapper {

    /**
     * Maps an unknown exception to a standardized PdfErrorCode.
     */
    public static map(
        error: unknown
    ): PdfErrorCode {

        if (!(error instanceof Error)) {

            return PdfErrorCode.UNKNOWN;

        }

        const message = error.message.toLowerCase();

        if (message.includes("password")) {

            return PdfErrorCode.PASSWORD_REQUIRED;

        }

        if (
            message.includes("encrypted")
        ) {

            return PdfErrorCode.PASSWORD_REQUIRED;

        }

        if (
            message.includes("invalid pdf")
        ) {

            return PdfErrorCode.INVALID_PDF;

        }

        if (
            message.includes("failed")
        ) {

            return PdfErrorCode.LOAD_FAILED;

        }

        if (
            message.includes("corrupt")
        ) {

            return PdfErrorCode.CORRUPTED_PDF;

        }

        return PdfErrorCode.UNKNOWN;

    }

}