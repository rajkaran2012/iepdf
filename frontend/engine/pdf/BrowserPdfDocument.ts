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
     * Supports both normal and password-protected PDFs.
     */
    public async load(
        data: ArrayBuffer,
        password?: string
    ): Promise<void> {

        this.document = await PDFDocument.load(
            data,
            {
                password,
            }
        );

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

        this.ensureLoaded();

        return await this.document.save();

    }

    /**
     * Total pages.
     */
    public getPageCount(): number {

        this.ensureLoaded();

        return this.document.getPageCount();

    }

    /**
     * Returns every page index.
     */
    public getPageIndices(): readonly number[] {

        this.ensureLoaded();

        return Array.from(
            { length: this.document.getPageCount() },
            (_, index) => index
        );

    }

    /**
     * Copies specific pages from another BrowserPdfDocument.
     */
    public async copyPages(
        source: BrowserPdfDocument,
        pageIndices: readonly number[]
    ): Promise<void> {

        this.ensureLoaded();

        const pages = await this.document.copyPages(
            source.getInternalDocument(),
            [...pageIndices]
        );

        for (const page of pages) {

            this.document.addPage(page);

        }

    }

    /**
     * Appends an entire PDF.
     */
    public async appendDocument(
        source: IPdfDocument
    ): Promise<void> {

        this.ensureLoaded();

        if (!(source instanceof BrowserPdfDocument)) {

            throw new Error(
                "Unsupported PDF document implementation."
            );

        }

        const copiedPages = await this.document.copyPages(
            source.getInternalDocument(),
            [...source.getPageIndices()]
        );

        for (const page of copiedPages) {

            this.document.addPage(page);

        }

    }

    /**
     * Converts the PDF into a browser File.
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

        this.ensureLoaded();

        return this.document;

    }

    /**
     * Throws if no PDF has been loaded.
     */
    private ensureLoaded(): asserts this is {

        document: PDFDocument;

    } {

        if (this.document === null) {

            throw new Error(
                "PDF document has not been loaded."
            );

        }

    }

}