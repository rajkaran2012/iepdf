import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken, getAccountPlan, setAccessToken } from "./auth";

describe("getAccountPlan", () => {
  beforeEach(() => {
    clearAccessToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAccessToken();
  });

  it("does not request the plan when there is no access token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAccountPlan("https://api.example.test")).rejects.toThrow(
      "Sign in with a verified iePDF account to view plan details.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the server-resolved plan using the bearer token", async () => {
    setAccessToken("test-token");
    const plan = {
      user_id: 42,
      plan_id: "free",
      daily_task_limit: 10,
      show_ads: true,
      watermark_enabled: true,
      priority_eligible: false,
      tools: {},
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(plan), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAccountPlan("https://api.example.test/")).resolves.toEqual(plan);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/accounts/me",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
        cache: "no-store",
      },
    );
  });

  it.each([401, 403])("shows a sign-in error for HTTP %i", async (status) => {
    setAccessToken("test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));

    await expect(getAccountPlan("https://api.example.test")).rejects.toThrow(
      "Your session is no longer authorized. Please sign in again.",
    );
  });

  it("shows a safe fallback for other server errors", async () => {
    setAccessToken("test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(getAccountPlan("https://api.example.test")).rejects.toThrow(
      "Unable to load your account plan. Please try again.",
    );
  });
});
