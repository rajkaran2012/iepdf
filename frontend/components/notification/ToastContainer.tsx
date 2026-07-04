"use client";

import Toast from "./Toast";
import { NotificationOptions } from "@/lib/notificationTypes";

interface ToastContainerProps {
  notifications: NotificationOptions[];
  remove: (id: string) => void;
}

export default function ToastContainer({
  notifications,
  remove,
}: ToastContainerProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className="
        fixed
        top-5
        right-5
        z-[9999]
        flex
        w-full
        max-w-md
        flex-col
        gap-4
        px-4
        md:px-0
      "
    >
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          onClose={remove}
        />
      ))}
    </div>
  );
}