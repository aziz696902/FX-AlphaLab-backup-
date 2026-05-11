"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat";

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessageItem({ message, isStreaming }: ChatMessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2.5 mb-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Bot size={14} className="text-primary" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted/60 text-foreground border border-border/50 rounded-bl-sm",
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-foreground/80">{children}</em>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <code className="block w-full bg-background border border-border rounded-md px-3 py-2 my-2 font-mono text-xs text-foreground overflow-x-auto whitespace-pre">
                      {children}
                    </code>
                  ) : (
                    <code className="bg-background border border-border rounded px-1.5 py-0.5 font-mono text-xs text-foreground">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="not-prose my-2">{children}</pre>
                ),
                ul: ({ children }) => (
                  <ul className="mb-2 ml-4 space-y-1 list-disc">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 ml-4 space-y-1 list-decimal">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                h1: ({ children }) => (
                  <h1 className="text-base font-semibold mb-2 mt-1">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-sm font-semibold mb-1.5 mt-1">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-medium mb-1 mt-1">{children}</h3>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
                    {children}
                  </a>
                ),
                hr: () => <hr className="border-border my-2" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-foreground/70 italic">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {isStreaming && (
          <span className="inline-block w-2 h-3.5 bg-current opacity-60 animate-pulse align-text-bottom ml-0.5 rounded-sm" />
        )}
      </div>
    </div>
  );
}
