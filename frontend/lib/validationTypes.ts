// =====================================================
// Validation Types
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

export interface ValidationResult {
  success: boolean;

  code?: ValidationCode;

  title?: string;

  message?: string;

  fileName?: string;

  fileSize?: number;
}

export interface PasswordProtectedFile {
  name: string;
  size: number;
}

export interface ToastMessage {
  id: string;

  title: string;

  message: string;

  type: "success" | "error" | "warning" | "info";
}