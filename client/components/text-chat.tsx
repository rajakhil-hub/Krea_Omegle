"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";

interface TextChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
}

export function TextChat({ messages, onSend }: TextChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-[var(--card)] rounded-xl border border-[var(--card-border)]">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll"
      >
        {messages.length === 0 && (
          <p className="text-center text-[var(--muted)] text-sm py-8">
            Say hello to your match!
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.sender === "you" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.sender === "you"
                  ? "bg-purple-600 text-white"
                  : "bg-[var(--card-border)] text-[var(--foreground)]"
              }`}
            >
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--card-border)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 rounded-lg bg-[var(--background)] border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
