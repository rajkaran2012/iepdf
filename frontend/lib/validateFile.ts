import { ToolType, ValidationResult } from "./validationTypes";

import { TOOL_RULES } from "./validation/toolRules";

import {
  validateFileCount,
  validateEmptyFile,
  validateFileSize,
  validateMimeType,
} from "./validation";

// ======================================================
// Enterprise File Validator
// ======================================================

export function validateFiles(
  files: File[],
  toolType: ToolType
): ValidationResult {

  const rule = TOOL_RULES[toolType];

  // No file selected

  if (files.length === 0) {
    return {
      success: false,
      tool: {
        id: rule.id,
        name: rule.name,
      },
      code: "NO_FILE",
      title: "No File Selected",
      message: "Please select at least one file.",
    };
  }

  // File count

  const countResult = validateFileCount(files, rule);

  if (!countResult.success) {
    return countResult;
  }

  // Validate every file

  for (const file of files) {

    const emptyResult = validateEmptyFile(file, rule);

    if (!emptyResult.success) {
      return emptyResult;
    }

    const sizeResult = validateFileSize(file, rule);

    if (!sizeResult.success) {
      return sizeResult;
    }

    const mimeResult = validateMimeType(file, rule);

    if (!mimeResult.success) {
      return mimeResult;
    }

  }

  // Success

  return {
    success: true,

    tool: {
      id: rule.id,
      name: rule.name,
    },
  };
}