// =====================================================
// Notification Types
// =====================================================

/**
 * Supported notification types.
 */
export type NotificationType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading";

/**
 * Notification model used throughout the application.
 */
export interface NotificationOptions {
  id?: string;

  type: NotificationType;

  title: string;

  message: string;

  fileName?: string;

  fileSize?: number;

  duration?: number;

  persistent?: boolean;

  dismissible?: boolean;

  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Runtime notification with a guaranteed id.
 */
export interface Notification extends NotificationOptions {
  id: string;
}

/**
 * Toast Context Contract
 */
export interface NotificationContextType {
  /**
   * Active notifications.
   */
  notifications: NotificationOptions[];

  dismissible?: boolean;
   action?: {
  label: string;
  onClick: () => void;
};

  /**
   * Display a notification.
   */
  show(notification: NotificationOptions): void;

  /**
   * Remove a notification by id.
   */
  remove(id: string): void;

  /**
   * Remove all notifications.
   */
  clear(): void;
}
