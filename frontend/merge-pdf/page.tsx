"use client";

import { useRef, useState } from "react";
import { BrowserPdfAnalyzer } from "@/engine/analysis/BrowserPdfAnalyzer";
import { BrowserMergeProcessor } from "@/engine/processing/processors/BrowserMergeProcessor";
import { BrowserPdfUnlockService } from "@/engine/unlock/BrowserPdfUnlockService";

import ToolLayout from "@/components/layout/ToolLayout";
import MergeWorkspace from "@/components/MergeWorkspace";

export default function MergePDF() {

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([]);
  const [showWorkspace, setShowWorkspace] = useState(false);

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

      console.error(
        "Password unlock failed:",
        error
      );

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

            console.error(result.error);

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

        URL.revokeObjectURL(url);

        setWorkspaceFiles([]);

        setShowWorkspace(false);

        if (fileInputRef.current) {

            fileInputRef.current.value = "";

        }

    } catch (error) {

        console.error(error);

    }

};
  const handleSelectFiles = () => {
  console.log("Button Clicked");
  console.log(fileInputRef.current);

  fileInputRef.current?.click();
};

const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
) => {

    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
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


  console.log("Workspace Files:", workspaceFiles);
  console.log("Show Workspace:", showWorkspace);

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
