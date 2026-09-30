"use client";

import { useState } from "react";

import {
  BrowserPdfCompressor,
} from "@/engine/compression/BrowserPdfCompressor";

type CorpusResult = {
  source: string;
  originalBytes: number;
  accepted: boolean;
  outputBytes?: number;
  reduction?: number;
  reason?: string;
};

const corpus = [
  {
    source: "embedpdf-test.pdf",
    url: "/_pdfium-bc09/embedpdf-test.pdf",
  },
  {
    source: "iepdf-merged.pdf",
    url: "/_pdfium-bc09/iepdf-merged.pdf",
  },
  {
    source: "iepdf-merged-1.pdf",
    url: "/_pdfium-bc09/iepdf-merged-1.pdf",
  },
];

export default function PdfiumC29Page() {
  const [status, setStatus] =
    useState("Ready.");

  const [results, setResults] =
    useState<CorpusResult[]>([]);

  const runTest = async () => {
    setStatus(
      "Running C-30 BrowserPdfCompressor corpus..."
    );

    setResults([]);

    const compressor =
      new BrowserPdfCompressor();

    const resultsLocal: CorpusResult[] = [];

    for (const fixture of corpus) {
      try {
        setStatus(
          `Compressing ${fixture.source}...`
        );

        const response =
          await fetch(fixture.url);

        if (!response.ok) {
          throw new Error(
            `Fixture fetch failed: ${response.status}`
          );
        }

        const blob =
          await response.blob();

        const file =
          new File(
            [blob],
            fixture.source,
            {
              type: "application/pdf",
            }
          );

        const compressionResult =
          await compressor.compress(file);

        const result: CorpusResult = {
          source: fixture.source,
          originalBytes: file.size,
          accepted: compressionResult.accepted,
          outputBytes:
            compressionResult.outputBytes,
          reduction:
            compressionResult.reduction,
          reason:
            compressionResult.reason,
        };

        resultsLocal.push(result);

        setResults(
          [...resultsLocal]
        );

        console.log(
          "C-30 BrowserPdfCompressor:",
          result
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown C-30 error.";

        const result: CorpusResult = {
          source: fixture.source,
          originalBytes: 0,
          accepted: false,
          reason: message,
        };

        resultsLocal.push(result);

        setResults(
          [...resultsLocal]
        );

        console.error(
          "C-30 BrowserPdfCompressor error:",
          fixture.source,
          error
        );
      }
    }

    const acceptedCount =
      resultsLocal.filter(
        result => result.accepted
      ).length;

    setStatus(
      `C-30 complete: ${acceptedCount}/${resultsLocal.length} browser results accepted.`
    );
  };

  return (
    <main
      style={{
        padding: 32,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>
        C-30 — Browser PDF Compressor Corpus
      </h1>

      <p>
        Isolated runtime validation.
        Production Compress processor is not used.
      </p>

      <button
        type="button"
        onClick={runTest}
        style={{
          padding: "10px 16px",
          cursor: "pointer",
        }}
      >
        Run C-30 Corpus Test
      </button>

      <p>
        <strong>Status:</strong>{" "}
        {status}
      </p>

      {results.length > 0 && (
        <pre>
          {JSON.stringify(
            results,
            null,
            2
          )}
        </pre>
      )}
    </main>
  );
}
