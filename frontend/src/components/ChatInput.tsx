import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

export default function ChatInput({ onSend, onStop, isStreaming }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const hasText = text.trim().length > 0;

  return (
    <div className="border-t border-[#2a2a2a] bg-bg-secondary/80 backdrop-blur-sm px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          rows={1}
          className="flex-1 resize-none bg-bg-card border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-colors"
            title="停止生成"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!hasText}
            className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border transition-colors ${
              hasText
                ? "bg-accent/20 border-accent/40 text-accent hover:bg-accent/30"
                : "bg-bg-card border-[#2a2a2a] text-text-secondary/30 cursor-not-allowed"
            }`}
            title="发送"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
