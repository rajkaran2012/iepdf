"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import ToastContainer from "./ToastContainer";

import {
  NotificationContextType,
  NotificationOptions,
} from "@/lib/notificationTypes";

const ToastContext = createContext<NotificationContextType | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

const MAX_NOTIFICATIONS = 5;

export default function ToastProvider({
  children,
}: ToastProviderProps) {
  const [notifications, setNotifications] = useState<
    NotificationOptions[]
  >([]);

  // ==========================
  // Show Notification
  // ==========================

  const show = useCallback(
    (notification: NotificationOptions) => {
      const id =
        notification.id ??
        crypto.randomUUID();

      const newNotification = {
        ...notification,
        id,
      };

      setNotifications((prev) => {
        const updated = [...prev, newNotification];

        if (updated.length > MAX_NOTIFICATIONS) {
          updated.shift();
        }

        return updated;
      });

      if (!notification.persistent) {
        setTimeout(() => {
          setNotifications((prev) =>
            prev.filter((item) => item.id !== id)
          );
        }, notification.duration ?? 4000);
      }
    },
    []
  );

  // ==========================
  // Remove One
  // ==========================

  const remove = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.filter((item) => item.id !== id)
    );
  }, []);

  // ==========================
  // Clear All
  // ==========================

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      show,
      remove,
      clear,
    }),
    [notifications, show, remove, clear]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <ToastContainer
        notifications={notifications}
        remove={remove}
      />
    </ToastContext.Provider>
  );
}

// ==========================
// Hook
// ==========================

export function useToastContext() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToastContext must be used inside ToastProvider."
    );
  }

  return context;
}