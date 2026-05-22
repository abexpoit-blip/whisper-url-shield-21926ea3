import { refreshSupabaseSessionOnce, waitForStoredSession } from "@/lib/auth-session";

function isAuthTokenError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return /Unauthorized: Invalid token|JWT expired|Invalid JWT/i.test(message);
}

function isMissingAuthHeaderError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return /No authorization header provided/i.test(message);
}

export function isSupabaseAuthTokenError(error: unknown) {
  return isAuthTokenError(error);
}

export async function withFreshSupabaseAuth<T extends { error: { message?: string } | null }>(
  operation: () => PromiseLike<T>,
) {
  const first = await operation();
  if (!first.error || !isAuthTokenError(first.error)) return first;

  const accessToken = await refreshSupabaseSessionOnce();
  if (!accessToken) {
    return first;
  }

  return operation();
}

export async function withFreshServerFnAuth<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isMissingAuthHeaderError(error)) {
      const restoredToken = await waitForStoredSession(null, 3_000);
      if (restoredToken) return operation();
      throw new Error("Your session is loading. Please try again.");
    }
    if (!isAuthTokenError(error)) throw error;
  }

  const accessToken = await refreshSupabaseSessionOnce({ force: true });
  if (!accessToken) {
    throw new Error("Your session expired. Please sign in again.");
  }

  try {
    return await operation();
  } catch (error) {
    if (!isAuthTokenError(error)) throw error;
    throw new Error("Your session expired. Please sign in again.");
  }
}
