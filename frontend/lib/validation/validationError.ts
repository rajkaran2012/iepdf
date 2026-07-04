import { ERROR_MESSAGES } from "../errorMessages";

import {
  ValidationCode,
  ValidationFile,
  ValidationResult,
  ValidationTool,
} from "../validationTypes";

// =====================================================
// Create Standard Validation Error
// =====================================================

export function validationError(
  tool: ValidationTool,
  code: ValidationCode,
  file?: File,
  customMessage?: string
): ValidationResult {
  const error = ERROR_MESSAGES[code];

  const validationFile: ValidationFile | undefined = file
    ? {
        name: file.name,
        size: file.size,
        type: file.type,
      }
    : undefined;

  return {
    success: false,

    tool,

    code,

    title: error.title,

    message: customMessage ?? error.message,

    file: validationFile,
  };
}