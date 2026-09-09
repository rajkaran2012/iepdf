"use client";

import { useRef, useState } from "react";
import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";
import { BrowserMergeProcessor } from "@/engine/processing/processors/BrowserMergeProcessor";
import { BrowserPdfUnlockService } from "@/engine/unlock/BrowserPdfUnlockService";
import useToast from "@/hooks/useToast";
import { ValidationConstants } from "@/engine/validation/common/validationConstants";

import ToolLayout from "@/components/layout/ToolLayout";
import MergeWorkspace from "@/components/MergeWorkspace";

export default function MergePDF() {

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([]);
  const [showWorkspace, setShowWorkspace] = useState(false);

  const toast = useToast();
  const MAX_FILE_SIZE = ValidationConstants.BOUNDARY_VALIDATION.MAX_FILE_SIZE_BYTES;

  const handlePasswordChange = (
    id: string,
    password: string
) => {

    setWorkspaceFiles((prev) =>
        prev.map((file) =>
            file.id === id
                ? {
                      ...file,
                      password,
                  }
                : file
        )
    );

};

  const handlePasswordBlur = async (
    id: string
  ) => {

    const targetFile =
      workspaceFiles.find(
        (file) => file.id === id
      );

    if (!targetFile) {
      return;
    }

    const password =
      targetFile.password?.trim();

    if (!password) {
      return;
    }

    if (
      targetFile.status !==
      "password_required"
    ) {
      return;
    }

    try {

      const unlockService =
        new BrowserPdfUnlockService();

      const result =
        await unlockService.unlock(
          targetFile.file,
          password
        );

      const unlockedFile =
        new File(
          [result.bytes],
          targetFile.filename,
          {
            type: "application/pdf"
          }
        );

      setWorkspaceFiles((previous) =>
        previous.map((file) =>
          file.id === id
            ? {
                ...file,

                file:
                  unlockedFile,

                size:
                  unlockedFile.size,

                status:
                  "ready",

                encrypted:
                  result.encrypted,

                corrupted:
                  false,

                message:
                  "Password accepted. PDF is ready for merge.",
              }
            : file
        )
      );

    } catch (error) {

      toast.error({
        title: "Password verification failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to unlock PDF.",
      });

      const message =
        error instanceof Error
          ? error.message
          : "Unable to unlock PDF.";

      setWorkspaceFiles((previous) =>
        previous.map((file) =>
          file.id === id
            ? {
                ...file,

                status:
                  "password_required",

                message,
            }
          : file
        )
      );

    }

  };
  const handleTogglePassword = (id: string) => {
    setWorkspaceFiles((prev) =>
      prev.map((file) =>
        file.id === id
          ? {
              ...file,
              showPassword: !file.showPassword,
            }
          : file
      )
    );
  };
  const handleSkipFile = (id: string) => {
  setWorkspaceFiles((prev) =>
    prev.map((file) =>
      file.id === id
        ? {
            ...file,
            skipped: !file.skipped,
          }
        : file
    )
  );
};

const handleRemoveFile = (id: string) => {

    setWorkspaceFiles((previous) => {

        const updated = previous.filter(
            (file) => file.id !== id
        );

        if (updated.length === 0) {

            setShowWorkspace(false);

            if (fileInputRef.current) {

                fileInputRef.current.value = "";

            }

        }

        return updated;

    });

};
    const handleUnlockMerge = async () => {

    try {


        const processor =
            new BrowserMergeProcessor();

        const result =
            await processor.process({

                files: workspaceFiles,

                toolType: "merge",

            });

        if (!result.success || !result.outputFile) {

            toast.error({
              title: "Merge failed",
              message:
                result.error ||
                "Unable to merge the selected PDFs.",
            });

            return;

        }

        const url =
            URL.createObjectURL(result.outputFile);

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            result.outputFile.name;

        document.body.appendChild(link);

        link.click();

        link.remove();

        toast.success({
          title: "Merge completed",
          message: "Your PDFs were merged successfully.",
        });

        URL.revokeObjectURL(url);

        setWorkspaceFiles([]);

        setShowWorkspace(false);

        if (fileInputRef.current) {

            fileInputRef.current.value = "";

        }

    } catch (error) {

        toast.error({
          title: "Merge failed",
          message:
            error instanceof Error
              ? error.message
              : "Unable to merge the selected PDFs.",
        });

    }

};
  const handleSelectFiles = () => {
  fileInputRef.current?.click();
};

const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
) => {

    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
        return;
    }

    const oversizedFile = files.find(
        (file) => file.size > MAX_FILE_SIZE
    );

    if (oversizedFile) {
        toast.error({
          title: "Invalid PDF",
          message: "File exceeds the maximum allowed size.",
          fileName: oversizedFile.name,
          fileSize: oversizedFile.size,
        });
        return;
    }

    const analyzer = new BrowserPdfAnalyzer();

    const analysis =
        await analyzer.analyzeMany(files);

    const workspace = analysis.map(
        (result, index) => ({

            ...result,

            // Original browser File
            file: files[index],

            // Workspace state
            password: "",
            showPassword: false,
            skipped: false,

        })
    );

    setWorkspaceFiles(workspace);

    setShowWorkspace(true);

};

  return (
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into a single PDF securely and instantly."
    >

      <div className="flex flex-col items-center justify-center py-16">

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={handleSelectFiles}
          className="rounded-xl bg-red-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-red-700"
        >
          Select PDF Files
        </button>
		{showWorkspace && (
 <MergeWorkspace
    files={workspaceFiles}
    onPasswordChange={handlePasswordChange}
    onPasswordBlur={handlePasswordBlur}
    onTogglePassword={handleTogglePassword}
    onSkipFile={handleSkipFile}
    onRemoveFile={handleRemoveFile}
    onUnlockMerge={handleUnlockMerge}
/>
)}



      </div>

    </ToolLayout>
  );
}
