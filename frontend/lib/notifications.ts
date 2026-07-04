import useToast from "@/hooks/useToast";
import {
  ValidationFile,
  ValidationResult,
} from "@/lib/validationTypes";

export function createNotifications(toast: ReturnType<typeof useToast>) {
  return {
    // ===========================
    // FILE VALIDATION
    // ===========================

    noFile() {
      toast.warning({
        title: "No File Selected",
        message: "Please select at least one file.",
      });
    },

    
    invalidPDF(file: ValidationFile) {
  toast.error({
    title: "Invalid PDF",
    message: "Only PDF files are allowed.",
    fileName: file.name,
    fileSize: file.size,
  });
},

invalidImage(file: ValidationFile) {
  toast.error({
    title: "Invalid Image",
    message: "Only JPG, JPEG, PNG and WEBP images are allowed.",
    fileName: file.name,
    fileSize: file.size,
  });
},

emptyFile(file: ValidationFile) {
  toast.error({
    title: "Empty File",
    message: "Selected file is empty.",
    fileName: file.name,
    fileSize: file.size,
  });
},

fileTooLarge(file: ValidationFile) {
  toast.error({
    title: "File Too Large",
    message: "Maximum allowed size is 15 MB.",
    fileName: file.name,
    fileSize: file.size,
  });
},

    // ===========================
    // MERGE PDF
    // ===========================

    mergeMinimum() {
      toast.warning({
        title: "Not Enough Files",
        message: "Please select at least two PDF files.",
      });
    },

    mergeSuccess(fileName = "merged.pdf") {
      toast.success({
        title: "Merge Successful",
        message: "Your PDF has been merged successfully.",
        fileName,
      });
    },

    // ===========================
    // PASSWORD
    // ===========================

    passwordRequired(fileName: string, size?: number) {
      toast.warning({
        title: "Password Required",
        message: "This PDF is password protected.",
        fileName,
        fileSize: size,
      });
    },

    // ===========================
// VALIDATION RESULT
// ===========================

fromValidation(result: ValidationResult) {
  if (result.success) return;

  switch (result.code) {
    case "NO_FILE":
      return this.noFile();

    case "MERGE_MINIMUM":
      return this.mergeMinimum();

    case "FILE_TOO_LARGE":
      if (result.file) return this.fileTooLarge(result.file);
      break;

    case "INVALID_PDF":
      if (result.file) return this.invalidPDF(result.file);
      break;

    case "INVALID_IMAGE":
      if (result.file) return this.invalidImage(result.file);
      break;

    case "EMPTY_FILE":
      if (result.file) return this.emptyFile(result.file);
      break;

    default:
      toast.error({
        title: result.title ?? "Validation Error",
        message: result.message ?? "Please check your files.",
      });
  }
},
    networkError() {
      toast.error({
        title: "Connection Failed",
        message: "Unable to connect to the server.",
      });
    },

    serverError() {
      toast.error({
        title: "Server Error",
        message: "Something went wrong. Please try again.",
      });
    },

    processing(tool: string) {
      toast.loading({
        title: `${tool}`,
        message: "Processing your files...",
        persistent: true,
      });
    },

    completed(tool: string) {
      toast.success({
        title: `${tool}`,
        message: "Completed successfully.",
      });
    },
  };
}