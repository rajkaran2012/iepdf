/**
 * Server-authorized daily quota reservation for browser-processed tools.
 * The server derives the account and plan from the bearer token.
 */
import { API_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

export class TaskReservationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TaskReservationError";
    }
}

export type BrowserReservationTool =
    | "merge"
    | "split"
    | "compress"
    | "pdf-to-jpg"
    | "jpg-to-pdf";

export async function reserveBrowserTask(
    toolId: BrowserReservationTool
): Promise<void> {
    const token = getAccessToken();

    if (!token) {
        throw new TaskReservationError("Sign in with a verified iePDF account before using this tool.");
    }

    let response: Response;

    try {
        response = await fetch(`${API_URL}/accounts/reserve-task`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ tool_id: toolId }),
        });
    } catch {
        throw new TaskReservationError("Unable to verify your daily usage limit. Please try again.");
    }

    if (!response.ok) {
        let message = "Unable to reserve this task. Please try again.";

        try {
            const body: unknown = await response.json();
            if (
                typeof body === "object" &&
                body !== null &&
                "detail" in body &&
                typeof body.detail === "string"
            ) {
                message = body.detail;
            }
        } catch {
            // Keep the controlled fallback message.
        }

        throw new TaskReservationError(message);
    }
}
