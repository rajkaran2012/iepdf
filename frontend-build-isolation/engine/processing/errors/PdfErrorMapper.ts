/**
 * =============================================================================
 * iePDF Processing Engine
 * =============================================================================
 *
 * File    : PdfErrorMapper.ts
 * Module  : Processing
 *
 * Purpose
 * ---------------------------------------------------------------------------
 * Converts JavaScript / library exceptions into standardized PdfErrorCode
 * values.
 *
 * This is the centralized exception-to-error-code mapping boundary.
 * =============================================================================
 */

import { PdfErrorCode } from "./PdfErrorCode";

export class PdfErrorMapper {

    public static map(
        error: unknown
    ): PdfErrorCode {

        if (!(error instanceof Error)) {

            return PdfErrorCode.UNKNOWN;

        }

        const message =
            error.message.toLowerCase().trim();

        /**
         * ================================================================
         * INVALID PASSWORD
         * ================================================================
         *
         * IMPORTANT:
         * This rule MUST appear before INVALID_PDF because:
         *
         * "Invalid PDF password."
         *
         * contains both:
         *
         * - "invalid pdf"
         * - "password"
         */
        if (
            message.includes("invalid password") ||
            message.includes("invalid pdf password") ||
            message.includes("incorrect password") ||
            message.includes("wrong password")
        ) {

            return PdfErrorCode.INVALID_PASSWORD;

        }

        /**
         * ================================================================
         * PASSWORD REQUIRED
         * ================================================================
         */
        if (
            message.includes("password required") ||
            message.includes("password is required") ||
            message.includes("encrypted")
        ) {

            return PdfErrorCode.PASSWORD_REQUIRED;

        }

        /**
         * ================================================================
         * INVALID PDF
         * ================================================================
         */
        if (
            message.includes("invalid pdf")
        ) {

            return PdfErrorCode.INVALID_PDF;

        }

        /**
         * ================================================================
         * CORRUPTED PDF
         * ================================================================
         */
        if (
            message.includes("corrupt")
        ) {

            return PdfErrorCode.CORRUPTED_PDF;

        }

        /**
         * ================================================================
         * GENERIC LOAD FAILURE
         * ================================================================
         */
        if (
            message.includes("failed")
        ) {

            return PdfErrorCode.LOAD_FAILED;

        }

        return PdfErrorCode.UNKNOWN;

    }

}
