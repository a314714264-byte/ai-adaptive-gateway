import { memo } from "react";
import type { Message } from "@/hooks/useChat";

function renderMarkdown(text: string) {
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const content = part.slice(3, -3);
      const firstNewline = content.indexOf("\n");
      const lang = firstNewline > -1 ? content.slice(0, firstNewline).trim() : "";
      const code = firstNewline > -1 ? content.slice(firstNewline + 1) : content;
      return (
        <pre key={i} className="bg-[#0a0a0a] rounded-lg p-3 my-2 overflow-x-auto border border-[#2a2a2a]">
          {lang && (
            <div className="text-xs text-[#9ca3af] mb-2 font-mono">{lang}</div>
          )}
          <code className="text-sm text-[#d4d4d4] font-mono whitespace-pre">{code}</code>
        </pre>
      );
    }

    // Inline processing
    const lines = part.split("\n");
    return lines.map((line, j) => {
      // Process inline code
      let processed = line.replace(/`([^`]+)`/g, '<code class="bg-[#2a2a2a] px-1.5 py-0.5 rounded text-sm font-mono text-accent">$1</code>');
      // Bold
      processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      return (
        <span key={`${i}-${j}`}>
          <span dangerouslySetInnerHTML={{ __html: processed }} />
          {j < lines.length - 1 && <br />}
        </span>
      );
    });
  });
}

function MessageBubbleComponent({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-[#1a2e1a] border border-accent/30 text-text-primary"
            : "bg-bg-card border border-[#2a2a2a] text-text-primary"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              AI
            </span>
          </div>
        )}
        <div className="text-sm leading-relaxed font-mono whitespace-pre-wrap break-words">
          {renderMarkdown(message.content)}
          {isStreaming && !isUser && (
            <span className="cursor-blink text-accent ml-0.5">▊</span>
          )}
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);
