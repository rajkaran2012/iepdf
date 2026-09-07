"use client";

import { useToastContext } from "@/components/notification/ToastProvider";

import { NotificationOptions } from "@/lib/notificationTypes";

export default function useToast() {
  const { show, remove, clear } = useToastContext();

  return {
    success: (notification: Omit<NotificationOptions, "type">) =>
      show({
        ...notification,
        type: "success",
      }),

    error: (notification: Omit<NotificationOptions, "type">) =>
      show({
        ...notification,
        type: "error",
      }),

    warning: (notification: Omit<NotificationOptions, "type">) =>
      show({
        ...notification,
        type: "warning",
      }),

    info: (notification: Omit<NotificationOptions, "type">) =>
      show({
        ...notification,
        type: "info",
      }),

    loading: (notification: Omit<NotificationOptions, "type">) =>
      show({
        ...notification,
        type: "loading",
      }),

    remove,

    clear,
  };
}