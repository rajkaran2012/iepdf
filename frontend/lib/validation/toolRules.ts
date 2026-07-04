import {
  MAX_FILE_SIZE,
  MAX_MERGE_FILES,
  PDF_MIME,
  IMAGE_MIME_TYPES,
} from "../constants";

import { ToolType } from "../validationTypes";

// ======================================================
// Tool Rule Interface
// ======================================================

export interface ToolRule {
  id: ToolType;

  name: string;

  minFiles: number;

  maxFiles: number;

  acceptedTypes: string[];

  maxFileSize: number;
}

// ======================================================
// Tool Rules
// ======================================================

export const TOOL_RULES: Record<ToolType, ToolRule> = {
  merge: {
    id: "merge",
    name: "Merge PDF",

    minFiles: 2,
    maxFiles: MAX_MERGE_FILES,

    acceptedTypes: [PDF_MIME],

    maxFileSize: MAX_FILE_SIZE,
  },

  split: {
    id: "split",
    name: "Split PDF",

    minFiles: 1,
    maxFiles: 1,

    acceptedTypes: [PDF_MIME],

    maxFileSize: MAX_FILE_SIZE,
  },

  compress: {
    id: "compress",
    name: "Compress PDF",

    minFiles: 1,
    maxFiles: 1,

    acceptedTypes: [PDF_MIME],

    maxFileSize: MAX_FILE_SIZE,
  },

  "pdf-to-jpg": {
    id: "pdf-to-jpg",
    name: "PDF to JPG",

    minFiles: 1,
    maxFiles: 1,

    acceptedTypes: [PDF_MIME],

    maxFileSize: MAX_FILE_SIZE,
  },

  "jpg-to-pdf": {
    id: "jpg-to-pdf",
    name: "JPG to PDF",

    minFiles: 1,
    maxFiles: 50,

    acceptedTypes: IMAGE_MIME_TYPES,

    maxFileSize: MAX_FILE_SIZE,
  },
};