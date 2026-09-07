"use client";

import { memo } from "react";

import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/**
 * React-PDF Worker
 */
pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PdfThumbnailProps {

    file: File;

    /**
     * True when the Validation Engine has already
     * detected this PDF is password protected.
     */
    locked?: boolean;

    className?: string;

    width?: number;

}

function PdfThumbnail({

    file,

    locked = false,

    className = "",

    width = 140,

}: PdfThumbnailProps) {

    /*
    ------------------------------------------------------------------------
    Password Protected PDF

    Never render <Document />.

    Otherwise pdf.js immediately asks for the password,
    trapping the user before they can choose:

    • Unlock
    • Skip
    • Remove
    ------------------------------------------------------------------------
    */

    if (locked) {

        return (

            <div
                className={`flex h-48 items-center justify-center rounded-xl border bg-gray-50 text-center shadow-sm ${className}`}
            >

                <div>

                    <div className="text-4xl">

                        🔒

                    </div>

                    <div className="mt-3 font-semibold text-gray-800">

                        Preview Locked

                    </div>

                    <div className="mt-1 text-xs text-gray-500">

                        Enter the password to enable preview.

                    </div>

                </div>

            </div>

        );

    }

    /*
    ------------------------------------------------------------------------
    Normal PDF
    ------------------------------------------------------------------------
    */

    return (

        <div
            className={`overflow-hidden rounded-xl border bg-white shadow-sm ${className}`}
        >

            <Document

                file={file}

                loading={

                    <div className="flex h-48 items-center justify-center text-sm text-gray-500">

                        Loading Preview...

                    </div>

                }

                error={

                    <div className="flex h-48 items-center justify-center px-3 text-center text-sm text-red-600">

                        Preview unavailable

                    </div>

                }

                noData={

                    <div className="flex h-48 items-center justify-center text-sm text-gray-500">

                        No PDF selected

                    </div>

                }

            >

                <Page

                    pageNumber={1}

                    width={width}

                    renderAnnotationLayer={false}

                    renderTextLayer={false}

                    loading={

                        <div className="flex h-48 items-center justify-center text-sm text-gray-500">

                            Rendering...

                        </div>

                    }

                />

            </Document>

        </div>

    );

}

export default memo(PdfThumbnail);