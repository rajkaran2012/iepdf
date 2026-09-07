/**
 * =============================================================================
 * iePDF Unlock Engine
 * =============================================================================
 *
 * File       : BrowserPdfUnlockService.ts
 * Module     : Unlock
 * Layer      : Service
 *
 * Purpose
 * -------
 * Browser-level composition boundary for PDF unlocking.
 *
 * This service:
 * - Exposes no PDFium types to callers.
 * - Returns processing-ready PDF bytes.
 * - Preserves the original PDF encryption state.
 * - Owns the protected PDF engine lifecycle.
 * - Contains no UI logic.
 * - Contains no merge logic.
 * =============================================================================
 */

import { PdfiumProtectedPdfEngine }
    from "@/engine/protected/pdfium/PdfiumProtectedPdfEngine";

import { PdfiumUnlockProvider }
    from "./providers/PdfiumUnlockProvider";

import { BrowserPdfUnlockAdapter }
    from "./adapter/BrowserPdfUnlockAdapter";

import type { UnlockedPdfResult }
    from "./UnlockedPdfResult";

export class BrowserPdfUnlockService {

    public async unlock(
        file: File,
        password: string
    ): Promise<UnlockedPdfResult> {

        const protectedPdfEngine =
            new PdfiumProtectedPdfEngine();

        try {

            const unlockProvider =
                new PdfiumUnlockProvider(
                    protectedPdfEngine
                );

            const unlockAdapter =
                new BrowserPdfUnlockAdapter(
                    unlockProvider
                );

            return await unlockAdapter
                .createUnlockedBytes(
                    file,
                    password
                );

        }
        finally {

            await protectedPdfEngine.destroy();

        }

    }

}
