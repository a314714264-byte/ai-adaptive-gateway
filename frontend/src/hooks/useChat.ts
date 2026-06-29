import { create } from "zustand";
import { streamChat, fetchApiInfo } from "@/utils/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  abortController: AbortController | null;
  defaultModel: string;
  sendMessage: (text: string) => void;
  stopStreaming: () => void;
  clearMessages: () => void;
}

let msgCounter = 0;
function genId() {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  abortController: null,
  defaultModel: "auto",

  sendMessage(text: string) {
    const userMsg: Message = {
      id: genId(),
      role: "user",
      content: text,
    };

    const assistantMsg: Message = {
      id: genId(),
      role: "assistant",
      content: "",
    };

    set((state) => ({
      messages: [...state.messages, userMsg, assistantMsg],
      isStreaming: true,
    }));

    const allMessages = [
      ...get().messages.filter((m) => m.role === "user" || (m.role === "assistant" && m.content !== "")),
    ].map((m) => ({ role: m.role, content: m.content }));

    const assistantId = assistantMsg.id;

    (async () => {
      try {
        // 首次发送时获取 default_model 配置
        if (get().defaultModel === "auto") {
          try {
            const info = await fetchApiInfo();
            if (info.default_model) {
              set({ defaultModel: info.default_model });
            }
          } catch { /* ignore */ }
        }
        for await (const chunk of streamChat(allMessages, get().defaultModel)) {
          const current = get().messages.find((m) => m.id === assistantId);
          if (!current || !get().isStreaming) break;
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            ),
          }));
        }
      } catch {
        // streaming error - keep partial content
      } finally {
        set({ isStreaming: false });
      }
    })();
  },

  stopStreaming() {
    set({ isStreaming: false });
  },

  clearMessages() {
    set({ messages: [], isStreaming: false });
  },
}));
