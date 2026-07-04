import { ToolRule } from "./toolRules";
import { validationError } from "./validationError";
import { ValidationResult } from "../validationTypes";

// ======================================================
// Validate File Count
// ======================================================

export function validateFileCount(
  files: File[],
  rule: ToolRule
): ValidationResult {
  if (files.length < rule.minFiles) {
    return validationError(
      {
        id: rule.id,
        name: rule.name,
      },
      "MERGE_MINIMUM"
    );
  }

  if (files.length > rule.maxFiles) {
    return validationError(
      {
        id: rule.id,
        name: rule.name,
      },
      "TOO_MANY_FILES",
      undefined,
      `Maximum ${rule.maxFiles} files are allowed.`
    );
  }

  return {
    success: true,
    tool: {
      id: rule.id,
      name: rule.name,
    },
  };
}

// ======================================================
// Validate Empty File
// ======================================================

export function validateEmptyFile(
  file: File,
  rule: ToolRule
): ValidationResult {
  if (file.size === 0) {
    return validationError(
      {
        id: rule.id,
        name: rule.name,
      },
      "EMPTY_FILE",
      file
    );
  }

  return {
    success: true,
    tool: {
      id: rule.id,
      name: rule.name,
    },
  };
}

// ======================================================
// Validate File Size
// ======================================================

export function validateFileSize(
  file: File,
  rule: ToolRule
): ValidationResult {
  if (file.size > rule.maxFileSize) {
    return validationError(
      {
        id: rule.id,
        name: rule.name,
      },
      "FILE_TOO_LARGE",
      file
    );
  }

  return {
    success: true,
    tool: {
      id: rule.id,
      name: rule.name,
    },
  };
}

// ======================================================
// Validate MIME Type
// ======================================================

export function validateMimeType(
  file: File,
  rule: ToolRule
): ValidationResult {
  if (!rule.acceptedTypes.includes(file.type)) {
    return validationError(
      {
        id: rule.id,
        name: rule.name,
      },
      rule.acceptedTypes.includes("application/pdf")
        ? "INVALID_PDF"
        : "INVALID_IMAGE",
      file
    );
  }

  return {
    success: true,
    tool: {
      id: rule.id,
      name: rule.name,
    },
  };
}