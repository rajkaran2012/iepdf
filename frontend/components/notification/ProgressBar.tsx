"use client";

import { NotificationType } from "@/lib/notificationTypes";

interface ProgressBarProps {
  type: NotificationType;
  duration?: number;
}

export default function ProgressBar({
  type,
  duration = 4000,
}: ProgressBarProps) {
  const colors = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
    loading: "bg-gray-500",
  };

  return (
    <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className={`h-full rounded-full ${colors[type]} animate-progress`}
        style={{
          animationDuration: `${duration}ms`,
        }}
      />
    </div>
  );
}