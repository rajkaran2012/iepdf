"use client";

interface PasswordModalProps {
  open: boolean;
  files: {
    index: number;
    name: string;
  }[];
}

export default function PasswordModal({
  open,
  files,
}: PasswordModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">

        <h2 className="text-2xl font-bold text-gray-900">
          🔒 Password Required
        </h2>

        <p className="mt-2 text-gray-600">
          Enter the password for each protected PDF.
        </p>

        <div className="mt-6 space-y-5">

          {files.map((file) => (

            <div key={file.index}>

              <label className="mb-2 block font-medium">
                {file.name}
              </label>

              <input
                type="password"
                placeholder="Enter password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-red-500 focus:outline-none"
              />

            </div>

          ))}

        </div>

        <button
          className="mt-8 w-full rounded-xl bg-red-600 py-3 font-semibold text-white"
        >
          Unlock & Merge
        </button>

      </div>
    </div>
  );
}