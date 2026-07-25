"use client";

import { API_URL } from "@/lib/api";
import { useRef, useState } from "react";

import ToolLayout from "@/components/layout/ToolLayout";
import MergeWorkspace from "@/components/MergeWorkspace";

export default function MergePDF() {

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([]);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const handlePasswordChange = (
  filename: string,
  password: string
) => {

  setPasswords((prev) => ({
    ...prev,
    [filename]: password,
  }));

  setWorkspaceFiles((prev) =>
    prev.map((file) =>
      file.filename === filename
        ? {
            ...file,
            password,
          }
        : file
    )
  );

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
    const handleUnlockMerge = async () => {

  console.log("Unlock Merge Started");

  const formData = new FormData();

  selectedFiles.forEach((file) => {
  formData.append("files", file);
});

  formData.append(
    "passwords",
    JSON.stringify(passwords)
  );

  formData.append(
    "skipped",
    JSON.stringify(
      workspaceFiles
        .filter((file) => file.skipped)
        .map((file) => file.id)
    )
  );

 try {

  console.log("Passwords State:");
  console.log(passwords);

  const response = await fetch(
    `${API_URL}/merge-pdf/unlock`,
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  console.log(result);

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
  e: React.ChangeEvent<HTMLInputElement>
) => {

  if (!e.target.files) return;

  const files = Array.from(e.target.files);

  setSelectedFiles(files);

  const formData = new FormData();

files.forEach((file) => {
  formData.append("files", file);
});

try {
  const response = await fetch(`${API_URL}/merge-pdf/scan`, {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  console.log("Scan Result:", result);
  setWorkspaceFiles(result.files);
  setShowWorkspace(true);

} catch (error) {
  console.error("Scan Error:", error);
}

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
  onTogglePassword={handleTogglePassword}
  onSkipFile={handleSkipFile}
  onUnlockMerge={handleUnlockMerge}
/>
)}

      </div>

    </ToolLayout>
  );
}