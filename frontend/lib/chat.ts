/**
 * Chat API client.
 *
 * The server is fully stateless — the client owns the message list and sends
 * it in full on every request.  Responses arrive as an SSE stream of JSON
 * deltas, terminated by `data: [DONE]`.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  /** Client-side unique id — not sent to the server. */
  id: string;
  role: ChatRole;
  content: string;
}

interface SSEDelta {
  delta?: string;
  error?: string;
}

/**
 * Open an SSE chat stream and invoke `onDelta` for each text chunk.
 *
 * @param messages  Full conversation history (role + content only — id is stripped).
 * @param onDelta   Callback invoked with each arriving text delta.
 * @param signal    Optional AbortSignal to cancel mid-stream.
 */
export async function streamChat(
  messages: Array<Pick<ChatMessage, "role" | "content">>,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep the last (possibly incomplete) line in the buffer.
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as SSEDelta;
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.delta) onDelta(parsed.delta);
      } catch {
        // Malformed chunk — skip silently.
      }
    }
  }
}
