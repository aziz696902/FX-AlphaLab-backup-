"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import { ChatPanel } from "./ChatPanel";

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const chat = useChat();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* ── Chat Panel ─────────────────────────────────────────────────── */}
      {open && (
        <div
          className={cn(
            "w-[460px] h-[640px] rounded-2xl border border-border bg-background",
            "shadow-[0_8px_40px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden",
            "animate-in fade-in-0 slide-in-from-bottom-4 duration-200",
          )}
        >
          <ChatPanel {...chat} onClose={() => setOpen(false)} />
        </div>
      )}

      {/* ── Toggle Button ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close analyst chat" : "Open analyst chat"}
        className={cn(
          "rounded-full w-14 h-14 shadow-lg flex items-center justify-center relative",
          "bg-primary text-primary-foreground",
          "transition-transform active:scale-95",
        )}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
        {/* Unread indicator */}
        {!open && chat.messages.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-destructive border-2 border-background" />
        )}
      </button>
    </div>
  );
}
