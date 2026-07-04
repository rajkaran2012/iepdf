"use client";

import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  open: boolean;

  title?: string;

  message?: string;
}

export default function LoadingOverlay({
  open,
  title = "Processing...",
  message = "Please wait while we process your files.",
}: LoadingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="
        fixed
        inset-0
        z-[9999]
        flex
        items-center
        justify-center
        bg-black/40
        backdrop-blur-sm
        animate-in
        fade-in
        duration-200
      "
    >
      <div
        className="
          w-[92%]
          max-w-md
          rounded-3xl
          bg-white
          p-8
          shadow-2xl
          text-center
        "
      >
        <Loader2
          className="
            mx-auto
            h-14
            w-14
            animate-spin
            text-red-600
          "
        />

        <h2
          className="
            mt-6
            text-2xl
            font-bold
            text-gray-900
          "
        >
          {title}
        </h2>

        <p
          className="
            mt-3
            text-gray-600
          "
        >
          {message}
        </p>

        <div
          className="
            mt-8
            h-2
            overflow-hidden
            rounded-full
            bg-gray-200
          "
        >
          <div
            className="
              h-full
              w-full
              origin-left
              animate-pulse
              rounded-full
              bg-red-600
            "
          />
        </div>
      </div>
    </div>
  );
}