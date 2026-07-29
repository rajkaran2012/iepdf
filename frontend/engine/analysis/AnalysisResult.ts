import { PdfStatus } from "./PdfStatus";

export interface AnalysisResult {
  id: string;

  filename: string;
  extension: string;

  size: number;
  pages: number;

  encrypted: boolean;
  corrupted: boolean;

  version?: string;

  status: PdfStatus;

  error?: string;
}