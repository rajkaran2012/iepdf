import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getAccessToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    getAccessToken: mocks.getAccessToken,
}));

import {
    reserveBrowserTask,
    TaskReservationError,
} from "./taskReservation";

describe("reserveBrowserTask", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("rejects when no access token exists without making a request", async () => {
        mocks.getAccessToken.mockReturnValue(null);
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        await expect(reserveBrowserTask("split")).rejects.toThrow(
            "Sign in with a verified iePDF account before using this tool.",
        );

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects network failures with a controlled error", async () => {
        mocks.getAccessToken.mockReturnValue("test-token");
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

        await expect(reserveBrowserTask("pdf-to-jpg")).rejects.toThrow(
            "Unable to verify your daily usage limit. Please try again.",
        );
    });

    it("rejects backend quota errors and preserves the backend detail", async () => {
        mocks.getAccessToken.mockReturnValue("test-token");
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ detail: "Daily task limit reached." }), {
                status: 429,
                headers: { "Content-Type": "application/json" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        await expect(reserveBrowserTask("jpg-to-pdf")).rejects.toThrow(
            "Daily task limit reached.",
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            method: "POST",
            headers: {
                Authorization: "Bearer test-token",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ tool_id: "jpg-to-pdf" }),
        });
    });

    it("uses a fallback message when an error response has no readable detail", async () => {
        mocks.getAccessToken.mockReturnValue("test-token");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
            new Response("not-json", { status: 503 }),
        ));

        await expect(reserveBrowserTask("merge")).rejects.toThrow(
            "Unable to reserve this task. Please try again.",
        );
    });

    it("resolves when the server confirms reservation", async () => {
        mocks.getAccessToken.mockReturnValue("test-token");
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(null, { status: 204 }),
        );
        vi.stubGlobal("fetch", fetchMock);

        await expect(reserveBrowserTask("merge")).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws the dedicated reservation error type", async () => {
        mocks.getAccessToken.mockReturnValue(null);

        try {
            await reserveBrowserTask("split");
            throw new Error("Expected reservation to fail.");
        } catch (error) {
            expect(error).toBeInstanceOf(TaskReservationError);
        }
    });
});
