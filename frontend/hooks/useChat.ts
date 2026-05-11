"use client";

import { useCallback, useRef, useState } from "react";

import { type ChatMessage, streamChat } from "@/lib/chat";

export interface UseChatReturn {
  messages: ChatMessage[];
  streaming: boolean;
  send: (content: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

/**
 * Chat state hook. Conversation lives in component memory — it resets on
 * page refresh (no server-side persistence is needed or desired).
 *
 * Design: the hook owns one AbortController per in-flight request. `send`
 * appends the user message and a placeholder assistant message immediately,
 * then fills the placeholder character-by-character via SSE deltas.
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (content: string) => {
      if (streaming || !content.trim()) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      // Snapshot the history that will be sent to the server — includes the
      // new user message, excludes the empty assistant placeholder.
      const historyForServer = [...messages, userMsg].map(({ role, content: c }) => ({
        role,
        content: c,
      }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          historyForServer,
          (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m,
              ),
            );
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: "Error: could not reach the analysis assistant. Please try again." }
              : m,
          ),
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  }, []);

  return { messages, streaming, send, stop, clear };
}
