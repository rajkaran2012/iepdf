"use client";

import { useState } from "react";

import Modal from "./Modal";
import PasswordInput from "../forms/PasswordInput";

type EncryptedFile = {
  index: number;
  name: string;
};

type PasswordModalProps = {
  open: boolean;
  files: EncryptedFile[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (passwords: Record<number, string>) => void;
};

export default function PasswordModal({
  open,
  files,
  loading = false,
  onClose,
  onSubmit,
}: PasswordModalProps) {

  const [passwords, setPasswords] =
    useState<Record<number, string>>({});

  const updatePassword = (
    index: number,
    value: string
  ) => {
    setPasswords((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  const handleSubmit = () => {
    onSubmit(passwords);
  };

  return (
    <Modal
      open={open}
      title="Passwords Required"
      onClose={onClose}
      width="md"
    >

      <div className="space-y-6">

        <div className="text-center">

          <div className="mb-3 text-5xl">
            🔒
          </div>

          <p className="text-gray-600">
            One or more PDFs are password protected.
            Please enter the password for each file.
          </p>

        </div>

        {files.map((file) => (

          <PasswordInput
            key={file.index}
            fileName={file.name}
            value={passwords[file.index] ?? ""}
            onChange={(value) =>
              updatePassword(file.index, value)
            }
          />

        ))}

        <div className="flex justify-end gap-4 pt-4">

          <button
            onClick={onClose}
            className="rounded-xl border px-6 py-3 font-medium hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            disabled={loading}
            onClick={handleSubmit}
            className="rounded-xl bg-red-600 px-8 py-3 font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
          >
            {loading
              ? "Unlocking..."
              : "Unlock & Merge"}
          </button>

        </div>

      </div>

    </Modal>
  );
}