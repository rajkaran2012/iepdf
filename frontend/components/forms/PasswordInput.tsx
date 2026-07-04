"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = {
  fileName: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export default function PasswordInput({
  fileName,
  value,
  error,
  onChange,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">

      {/* File Name */}
      <div className="mb-4 flex items-center gap-3">

        <div className="rounded-xl bg-red-100 p-2">
          <Lock size={18} className="text-red-600" />
        </div>

        <div>
          <p className="font-semibold text-gray-900">
            {fileName}
          </p>

          <p className="text-sm text-gray-500">
            Password Protected PDF
          </p>
        </div>

      </div>

      {/* Password Field */}

      <div className="relative">

        <input
          type={showPassword ? "text" : "password"}
          value={value}
          placeholder="Enter PDF password"
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border px-4 py-3 pr-12 outline-none transition
          ${
            error
              ? "border-red-500"
              : "border-gray-300 focus:border-red-500"
          }`}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
        >
          {showPassword ? (
            <EyeOff size={20} />
          ) : (
            <Eye size={20} />
          )}
        </button>

      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

    </div>
  );
}