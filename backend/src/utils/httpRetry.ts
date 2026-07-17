export type RetryOptions = {
  /** Total attempts including the first try (default 4 = 1 + 3 retries). */
  maxAttempts?: number;
  /** Base delay in ms before retry; doubles each attempt (default 500). */
  baseDelayMs?: number;
};

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an async operation with exponential backoff retries.
 * Throws the last error when all attempts fail.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Request failed after retries");
}
