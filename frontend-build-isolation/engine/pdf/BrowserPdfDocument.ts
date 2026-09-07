import { PDFDocument } from "pdf-lib";
import type { IPdfDocument } from "./interfaces/IPdfDocument";

export class BrowserPdfDocument implements IPdfDocument {

    private document: PDFDocument | null = null;

    /**
     * Creates a new empty PDF document.
     */
    public static async create(): Promise<BrowserPdfDocument> {

        const pdf = new BrowserPdfDocument();

        pdf.document = await PDFDocument.create();

        return pdf;

    }

    /**
     * Loads a PDF from memory.
     *
     * Note:
     * Password-protected PDFs will be handled by BrowserPdfLoader.
     */
    public async load(
        data: ArrayBuffer
    ): Promise<void> {

        this.document = await PDFDocument.load(data);

    }

    /**
     * Returns true if a PDF has been loaded.
     */
    public isLoaded(): boolean {

        return this.document !== null;

    }

    /**
     * Saves the PDF.
     */
    public async save(): Promise<Uint8Array> {

        const document = this.ensureLoaded();

        return await document.save();

    }

    /**
     * Returns the total number of pages.
     */
    public getPageCount(): number {

        return this.ensureLoaded().getPageCount();

    }

    /**
     * Returns every page index.
     */
    public getPageIndices(): readonly number[] {

        const document = this.ensureLoaded();

        return Array.from(
            { length: document.getPageCount() },
            (_, index) => index
        );

    }

    /**
     * Copies specific pages from another document.
     */
    public async copyPages(
        source: BrowserPdfDocument,
        pageIndices: readonly number[]
    ): Promise<void> {

        const document = this.ensureLoaded();

        const pages = await document.copyPages(
            source.getInternalDocument(),
            [...pageIndices]
        );

        for (const page of pages) {

            document.addPage(page);

        }

    }

    /**
     * Appends another PDF document.
     */
    public async appendDocument(
        source: IPdfDocument
    ): Promise<void> {

        const document = this.ensureLoaded();

        if (!(source instanceof BrowserPdfDocument)) {

            throw new Error(
                "Unsupported PDF document implementation."
            );

        }

        const copiedPages = await document.copyPages(
            source.getInternalDocument(),
            [...source.getPageIndices()]
        );

        for (const page of copiedPages) {

            document.addPage(page);

        }

    }

    /**
     * Converts the document into a browser File.
     */
    public async toFile(
        fileName: string
    ): Promise<File> {

        const bytes = await this.save();

        const buffer = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;

        return new File(
            [buffer],
            fileName,
            {
                type: "application/pdf",
            }
        );

    }

    /**
     * Returns the internal pdf-lib document.
     */
    public getInternalDocument(): PDFDocument {

        return this.ensureLoaded();

    }

    /**
     * Returns the loaded document or throws if none exists.
     */
    private ensureLoaded(): PDFDocument {

        if (this.document === null) {

            throw new Error(
                "PDF document has not been loaded."
            );

        }

        return this.document;

    }

}