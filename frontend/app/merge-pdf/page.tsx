"use client";

import { useRef, useState } from "react";



import useToast from "@/hooks/useToast";
import { ValidationConstants } from "@/engine/validation/common/validationConstants";

import ToolLayout from "@/components/layout/ToolLayout";
import MergeWorkspace from "@/components/MergeWorkspace";

export default function MergePDF() {

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([]);
  const [showWorkspace, setShowWorkspace] = useState(true);

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

      const { BrowserPdfUnlockService } = await import(
        "@/engine/unlock/BrowserPdfUnlockService"
      );

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

const handleReorderFiles = (
    draggedId: string,
    targetId: string
) => {

    if (!draggedId || !targetId || draggedId === targetId) {
        return;
    }

    setWorkspaceFiles((previous) => {

        const draggedIndex = previous.findIndex(
            (file) => file.id === draggedId
        );

        const targetIndex = previous.findIndex(
            (file) => file.id === targetId
        );

        if (
            draggedIndex === -1 ||
            targetIndex === -1 ||
            draggedIndex === targetIndex
        ) {
            return previous;
        }

        const updated = [...previous];

        const [movedFile] = updated.splice(
            draggedIndex,
            1
        );

        updated.splice(
            targetIndex,
            0,
            movedFile
        );

        return updated;

    });
};
const handleRemoveFile = (id: string) => {

    setWorkspaceFiles((previous) => {

        const updated = previous.filter(
            (file) => file.id !== id
        );

        if (updated.length === 0) {

            setShowWorkspace(true);

            if (fileInputRef.current) {

                fileInputRef.current.value = "";

            }

        }

        return updated;

    });

};
    const handleUnlockMerge = async () => {

    try {


        const { BrowserMergeProcessor } = await import(
            "@/engine/processing/processors/BrowserMergeProcessor"
        );

        const processor =
            new BrowserMergeProcessor();

        console.info("[IEPDF_FORENSIC_V3] PROCESS_START|" + performance.now().toFixed(3));
const result =
            await processor.process({

                files: workspaceFiles,

                toolType: "merge",

            });
console.info("[IEPDF_FORENSIC_V3] PROCESS_END|" + performance.now().toFixed(3));

        if (!result.success || !result.outputFile) {

            toast.error({
              title: "Merge failed",
              message:
                result.error ||
                "Unable to merge the selected PDFs.",
            });

            return;

        }

        console.info("[IEPDF_FORENSIC_V3] BLOB_START|" + performance.now().toFixed(3));
const url =
            URL.createObjectURL(result.outputFile);
console.info("[IEPDF_FORENSIC_V3] BLOB_END|" + performance.now().toFixed(3));

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            result.outputFile.name;

        document.body.appendChild(link);

        console.info("[IEPDF_FORENSIC_V3] DOWNLOAD_CLICK|" + performance.now().toFixed(3));
link.click();

        link.remove();

        toast.success({
          title: "Merge completed",
          message: "Your PDFs were merged successfully.",
        });

        URL.revokeObjectURL(url);

        setWorkspaceFiles([]);

        setShowWorkspace(true);

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
const handleWorkspaceDragEnter = (
    event: React.DragEvent<HTMLDivElement>
) => {

    event.preventDefault();

    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
        return;
    }

    if (event.dataTransfer.types.includes("Files")) {
        setIsWorkspaceDragOver(true);
    }

};

const handleWorkspaceDragOver = (
    event: React.DragEvent<HTMLDivElement>
) => {

    event.preventDefault();

    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
        event.dataTransfer.dropEffect = "move";
        return;
    }

    if (event.dataTransfer.types.includes("Files")) {
        event.dataTransfer.dropEffect = "copy";
        setIsWorkspaceDragOver(true);
    }

};

const handleWorkspaceDragLeave = (
    event: React.DragEvent<HTMLDivElement>
) => {

    if (
        event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget)
    ) {
        return;
    }

    setIsWorkspaceDragOver(false);

};

const handleWorkspaceDrop = async (
    event: React.DragEvent<HTMLDivElement>
) => {

    event.preventDefault();

    if (event.dataTransfer.types.includes("application/x-iepdf-reorder")) {
        event.stopPropagation();
        return;
    }

    setIsWorkspaceDragOver(false);

    const files = Array.from(
        event.dataTransfer.files ?? []
    );

    if (files.length === 0) {
        return;
    }

    await processSelectedFiles(files);

};


const [isWorkspaceDragOver, setIsWorkspaceDragOver] =
    useState(false);
const processSelectedFiles = async (
    files: File[]
) => {

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

    const { BrowserPdfAnalyzer } = await import(
        "@/engine/analysis/BrowserPdfAnalyzer"
    );

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

    setWorkspaceFiles((previous) => [...previous, ...workspace]);

    setShowWorkspace(true);

};
const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
) => {

    const files = Array.from(
        event.target.files ?? []
    );

    await processSelectedFiles(files);

    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }

};
  return (
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into a single PDF securely and instantly."
      wide
    >

      <div className="flex w-full flex-col items-center justify-start">

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

		{showWorkspace && (
 <div
    onDragEnter={handleWorkspaceDragEnter}
    onDragOver={handleWorkspaceDragOver}
    onDragLeave={handleWorkspaceDragLeave}
    onDrop={handleWorkspaceDrop}
    className="relative w-full"
>

    {isWorkspaceDragOver && (
        <div
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed border-blue-400 bg-blue-50/90"
        >
            <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-xl">
                <div className="text-lg font-bold text-gray-900">
                    Drop PDFs here
                </div>

                <div className="mt-1 text-sm text-gray-500">
                    Release to add PDFs to your merge workspace
                </div>
            </div>
        </div>
    )}
<MergeWorkspace
    files={workspaceFiles}
    onPasswordChange={handlePasswordChange}
    onPasswordBlur={handlePasswordBlur}
    onTogglePassword={handleTogglePassword}
    onSkipFile={handleSkipFile}
    onRemoveFile={handleRemoveFile}
          onAddFiles={handleSelectFiles}
          onReorderFiles={handleReorderFiles}
    onUnlockMerge={handleUnlockMerge}
/>
</div>
)}



      </div>

    </ToolLayout>
  );
}







