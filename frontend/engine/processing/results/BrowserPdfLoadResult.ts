import type { IPdfDocument } from "@/engine/pdf/interfaces/IPdfDocument";
import { PdfErrorCode } from "@/engine/processing/errors/PdfErrorCode";

export interface BrowserPdfLoadResult {

    readonly success: boolean;

    readonly document: IPdfDocument | null;

    readonly pageCount: number;

    readonly encrypted: boolean;

    readonly passwordRequired: boolean;

    readonly passwordAccepted: boolean;

    readonly errorCode: PdfErrorCode;

    readonly message: string | null;

}