"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";

import { NotificationType } from "@/lib/notificationTypes";

interface NotificationIconProps {
  type: NotificationType;
}

export default function NotificationIcon({
  type,
}: NotificationIconProps) {
  switch (type) {
    case "success":
      return (
        <CheckCircle2
          className="h-6 w-6 text-green-600 flex-shrink-0"
        />
      );

    case "error":
      return (
        <XCircle
          className="h-6 w-6 text-red-600 flex-shrink-0"
        />
      );

    case "warning":
      return (
        <AlertTriangle
          className="h-6 w-6 text-yellow-600 flex-shrink-0"
        />
      );

    case "info":
      return (
        <Info
          className="h-6 w-6 text-blue-600 flex-shrink-0"
        />
      );

    case "loading":
      return (
        <Loader2
          className="h-6 w-6 text-gray-600 animate-spin flex-shrink-0"
        />
      );

    default:
      return (
        <Info
          className="h-6 w-6 text-gray-600 flex-shrink-0"
        />
      );
  }
}