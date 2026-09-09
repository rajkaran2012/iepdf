/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : pdfSecuritySignatures.ts
 * Module     : Security Signatures
 * Layer      : Constants
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Centralized PDF security signatures used by malware detection rules.
 *
 * This file contains only constants.
 * No business logic should be added here.
 * =============================================================================
 */

export const PdfSecuritySignatures = Object.freeze({

    Actions: Object.freeze({

        Launch: "/Launch",

        OpenAction: "/OpenAction",

        AdditionalActions: "/AA",

        SubmitForm: "/SubmitForm",

        ImportData: "/ImportData"

    }),

    JavaScript: Object.freeze({

        JavaScript: "/JavaScript",

        ShortName: "/JS"

    }),

    EmbeddedContent: Object.freeze({

        EmbeddedFiles: "/EmbeddedFiles",

        RichMedia: "/RichMedia"

    }),

    Network: Object.freeze({

        URI: "/URI"

    })

});