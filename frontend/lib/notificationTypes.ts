// =====================================================
// Tool Types
// =====================================================

export type ToolType =
  | "merge"
  | "split"
  | "compress"
  | "pdf-to-jpg"
  | "jpg-to-pdf";

// =====================================================
// Validation Codes
// =====================================================

export type ValidationCode =
  | "NO_FILE"
  | "EMPTY_FILE"
  | "INVALID_PDF"
  | "INVALID_IMAGE"
  | "FILE_TOO_LARGE"
  | "MERGE_MINIMUM"
  | "TOO_MANY_FILES"
  | "ONLY_ONE_FILE"
  | "PASSWORD_REQUIRED"
  | "NETWORK_ERROR"
  | "SERVER_ERROR";

// =====================================================
// Validation Models
// =====================================================

export interface ValidationFile {
  name: string;
  size: number;
  type: string;
}

export interface ValidationTool {
  id: ToolType;
  name: string;
}

export interface ValidationResult {
  success: boolean;

  tool?: ValidationTool;

  code?: ValidationCode;

  title?: string;

  message?: string;

  file?: ValidationFile;
}

// =====================================================
// Password Protected Files
// =====================================================

export interface PasswordProtectedFile {
  name: string;
  size: number;
}

// =====================================================
// Toast
// =====================================================

export interface ToastMessage {
  id: string;

  title: string;

  message: string;

  type: "success" | "error" | "warning" | "info";
}