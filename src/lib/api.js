/**
 * The only place the browser talks to the server.
 * Every failure comes out as an AppError with a `kind` the UI can switch on.
 */
const API_BASE = (
  import.meta.env.VITE_API_URL || ""
).replace(/\/$/, "");
export class AppError extends Error {
  constructor(kind, message, { retryable = true, details = null } = {}) {
    super(message);
    this.name = "AppError";
    this.kind = kind;
    this.retryable = retryable;
    this.details = details; // e.g. a snippet of the bad model output, shown under "Details"
  }
}

export async function fetchConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ raw: string, finishReason: string|null, model: string }>}
 */
export async function requestDeck({ text, count, simulate, signal }) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, count, simulate: simulate || undefined }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err; // the hook decides whether that was a cancel or a timeout
    throw new AppError("NETWORK", "Couldn't reach the server. Is it running, and are you online?");
  }

  // The body might not be JSON (e.g. a proxy error page), so read text first.
  const bodyText = await res.text();
  let body = null;
  try {
    body = JSON.parse(bodyText);
  } catch {
    /* handled below */
  }

  if (!res.ok) {
    const code = body?.code || "SERVER";
    const message = body?.error || `The server returned an error (${res.status}).`;
    // Bad input or a missing key won't fix themselves on retry.
    const retryable = !["BAD_INPUT", "NO_KEY", "BLOCKED"].includes(code);
    throw new AppError(code, message, { retryable });
  }

  if (!body || typeof body.raw !== "string") {
    throw new AppError("SERVER", "The server sent back something unexpected.", { details: bodyText.slice(0, 300) });
  }
  return body;
}
