/**
 * In-memory authentication state for iePDF.
 *
 * Access tokens are intentionally not persisted to browser storage.
 */

type AuthSession = {
  accessToken: string;
  expiresAt: number;
};

let session: AuthSession | null = null;

export function setAccessToken(
  accessToken: string,
  expiresInSeconds = 3600
): void {
  if (!accessToken.trim()) {
    throw new Error("An access token is required.");
  }

  if (
    !Number.isFinite(expiresInSeconds) ||
    expiresInSeconds <= 0
  ) {
    throw new Error("A valid token lifetime is required.");
  }

  session = {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
}

export function getAccessToken(): string | null {
  if (!session) {
    return null;
  }

  if (Date.now() >= session.expiresAt) {
    session = null;
    return null;
  }

  return session.accessToken;
}

export function clearAccessToken(): void {
  session = null;
}
export type AccountToolLimit = {
  min_files: number;
  max_files: number;
  max_file_size_bytes: number;
  max_total_size_bytes: number;
};

export type AccountPlan = {
  user_id: number;
  plan_id: "free" | "paid";
  daily_task_limit: number | null;
  show_ads: boolean;
  watermark_enabled: boolean;
  priority_eligible: boolean;
  tools: Record<"merge" | "split" | "compress" | "pdf-to-jpg" | "jpg-to-pdf", AccountToolLimit>;
};

export async function getAccountPlan(apiUrl: string): Promise<AccountPlan> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Sign in with a verified iePDF account to view plan details.");
  }

  const baseUrl = apiUrl.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/accounts/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Your session is no longer authorized. Please sign in again."
        : "Unable to load your account plan. Please try again."
    );
  }

  return (await response.json()) as AccountPlan;
}
