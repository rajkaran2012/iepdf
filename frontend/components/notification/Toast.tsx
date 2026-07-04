"use client";

import { X, FileText } from "lucide-react";

import NotificationIcon from "./NotificationIcon";
import ProgressBar from "./ProgressBar";

import { NotificationOptions } from "@/lib/notificationTypes";

interface ToastProps {
  notification: NotificationOptions;
  onClose: (id: string) => void;
}

export default function Toast({
  notification,
  onClose,
}: ToastProps) {
  const {
    id = "",
    type,
    title,
    message,
    fileName,
    fileSize,
    dismissible = true,
    duration = 4000,
    action,
  } = notification;

  const borderColor = {
    success: "border-green-500",
    error: "border-red-500",
    warning: "border-yellow-500",
    info: "border-blue-500",
    loading: "border-gray-500",
  };

  return (
    <div
      className={`
        w-full
        max-w-md
        rounded-2xl
        border-l-4
        ${borderColor[type]}
        bg-white
        shadow-2xl
        overflow-hidden
        animate-in
        slide-in-from-right
        duration-300
      `}
    >
      <div className="p-5">

        {/* Header */}

        <div className="flex items-start gap-3">

          <NotificationIcon type={type} />

          <div className="flex-1">

            <h3 className="text-base font-bold text-gray-900">
              {title}
            </h3>

          </div>

          {dismissible && (
            <button
              onClick={() => onClose(id)}
              className="rounded-lg p-1 hover:bg-gray-100 transition"
            >
              <X
                size={18}
                className="text-gray-500"
              />
            </button>
          )}

        </div>

        {/* File */}

        {fileName && (

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3">

            <FileText
              size={18}
              className="text-red-600"
            />

            <div className="flex-1">

              <p className="font-medium text-gray-900 truncate">

                {fileName}

              </p>

              {fileSize && (

                <p className="text-xs text-gray-500">

                  {(fileSize / 1024 / 1024).toFixed(2)} MB

                </p>

              )}

            </div>

          </div>

        )}

        {/* Message */}

        <p className="mt-4 text-sm leading-6 text-gray-600">

          {message}

        </p>

        {/* Action */}

        {action && (

          <button
            onClick={action.onClick}
            className="
              mt-5
              w-full
              rounded-xl
              bg-red-600
              py-3
              font-semibold
              text-white
              transition
              hover:bg-red-700
            "
          >
            {action.label}
          </button>

        )}

      </div>

      {/* Progress */}

      {!notification.persistent && (

        <ProgressBar
          type={type}
          duration={duration}
        />

      )}

    </div>
  );
}