/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : PdfObject.ts
 * Module     : Deep Validation
 * Layer      : Shared PDF Object Model
 * =============================================================================
 */

export interface PdfObjectReference {

    readonly objectNumber: number;

    readonly generationNumber: number;

}

export interface PdfObject {

    readonly objectNumber: number;

    readonly generationNumber: number;

    readonly body: string;

}
