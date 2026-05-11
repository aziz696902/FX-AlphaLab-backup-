"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bot, RotateCcw, Send, Square, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { UseChatReturn } from "@/hooks/useChat";
import { ChatMessageItem } from "./ChatMessage";

interface ChatPanelProps extends UseChatReturn {
  onClose: () => void;
}

export function ChatPanel({ messages, streaming, send, stop, clear, onClose }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    await send(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Bot size={14} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">Alpha Analyst</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Powered by Gemini</p>
          </div>
          {streaming && (
            <span className="flex items-center gap-1 text-[10px] text-primary ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              thinking
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clear}
            title="Clear conversation"
            className="text-muted-foreground hover:text-foreground hover:bg-accent transition-colors p-1.5 rounded-md"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="text-muted-foreground hover:text-foreground hover:bg-accent transition-colors p-1.5 rounded-md"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Ask me anything</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-[220px] leading-relaxed">
                Agent signals · trade parameters · risk context · market regime
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-1 max-w-[260px]">
              {["What's the top trade?", "Explain EURUSD signal", "Current risk regime"].map((hint) => (
                <button
                  key={hint}
                  onClick={() => send(hint)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-accent hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            isStreaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-border shrink-0 bg-card/60 backdrop-blur-sm">
        <div className="flex items-end gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about signals, risk, or trade ideas…"
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-foreground text-sm",
              "placeholder:text-muted-foreground/60 focus:outline-none",
              "overflow-y-auto leading-relaxed min-h-[22px]",
            )}
          />
          {streaming ? (
            <button
              onClick={stop}
              title="Stop generation"
              className="shrink-0 rounded-lg bg-destructive text-destructive-foreground p-1.5 hover:bg-destructive/90 transition-colors mb-0.5"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              title="Send message"
              className={cn(
                "shrink-0 rounded-lg bg-primary text-primary-foreground p-1.5 transition-colors mb-0.5",
                "hover:bg-primary/90",
                "disabled:opacity-30 disabled:cursor-not-allowed",
              )}
            >
              <Send size={13} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
