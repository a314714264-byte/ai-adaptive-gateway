import { useRef, useEffect, useState } from "react";
import { Trash2, Bot, Copy, Check, Link, Key, Server, ChevronDown, ChevronUp } from "lucide-react";
import { useChatStore } from "@/hooks/useChat";
import { MessageBubble } from "@/components/MessageBubble";
import ChatInput from "@/components/ChatInput";
import { fetchApiInfo, type ApiInfo } from "@/utils/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-300"
      title="复制"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

function ApiInfoPanel() {
  const [info, setInfo] = useState<ApiInfo | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchApiInfo().then(setInfo).catch(() => {});
  }, []);

  if (!info) return null;

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {/* 标题栏 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Server size={14} className="text-accent" />
            </div>
            <span className="text-sm font-medium text-text-primary">接口信息</span>
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>

        {expanded && (
          <div className="px-5 pb-4 space-y-3">
            {/* API Base URL */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Link size={12} />
                API Base URL
              </div>
              <div className="flex items-center gap-2 bg-[#111] rounded-lg px-3 py-2 border border-[#2a2a2a]">
                <code className="text-sm text-accent font-mono flex-1 break-all">{info.base_url}</code>
                <CopyButton text={info.base_url} />
              </div>
            </div>

            {/* Chat Endpoint */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Server size={12} />
                Chat 接口
              </div>
              <div className="flex items-center gap-2 bg-[#111] rounded-lg px-3 py-2 border border-[#2a2a2a]">
                <code className="text-sm text-gray-300 font-mono flex-1 break-all">{info.chat_endpoint}</code>
                <CopyButton text={info.chat_endpoint} />
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Key size={12} />
                API Key
              </div>
              <div className="flex items-center gap-2 bg-[#111] rounded-lg px-3 py-2 border border-[#2a2a2a]">
                <code className="text-sm text-gray-300 font-mono flex-1">
                  {info.api_key_required ? "sk-***（在管理后台配置）" : "无需 Key（网关直接转发）"}
                </code>
              </div>
            </div>

            {/* 可用模型 */}
            <div className="space-y-1.5">
              <div className="text-xs text-gray-500">可用模型</div>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/15 text-accent border border-accent/20">
                  {info.default_model}（自动路由）
                </span>
                {info.available_models.map((m) => (
                  <span
                    key={m}
                    className="inline-flex px-2.5 py-1 rounded-lg text-xs font-mono bg-[#111] text-gray-400 border border-[#2a2a2a]"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* 使用示例 */}
            <div className="space-y-1.5">
              <div className="text-xs text-gray-500">使用示例（Python）</div>
              <div className="relative bg-[#111] rounded-lg px-3 py-2.5 border border-[#2a2a2a]">
                <CopyButton
                  text={`from openai import OpenAI\nclient = OpenAI(base_url="${info.base_url}/v1", api_key="none")\nresp = client.chat.completions.create(model="${info.default_model}", messages=[{"role":"user","content":"你好"}])\nprint(resp.choices[0].message.content)`}
                />
                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">
{`from openai import OpenAI

client = OpenAI(
    base_url="${info.base_url}/v1",
    api_key="none"
)

resp = client.chat.completions.create(
    model="${info.default_model}",
    messages=[{"role": "user", "content": "你好"}]
)
print(resp.choices[0].message.content)`}
                </pre>
              </div>
            </div>

            {/* 提示 */}
            <div className="text-xs text-gray-600 bg-[#111] rounded-lg px-3 py-2 border border-[#2a2a2a]">
              {info.note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { messages, isStreaming, sendMessage, stopStreaming, clearMessages } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-[#2a2a2a] bg-bg-secondary/60 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
            <Bot size={18} className="text-accent" />
          </div>
          <h1 className="text-base font-semibold text-text-primary tracking-wide">AI Gateway</h1>
        </div>
        <button
          onClick={clearMessages}
          disabled={messages.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <Trash2 size={14} />
          清空对话
        </button>
      </header>

      {/* Messages */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Bot size={32} className="text-accent/60" />
              </div>
              <p className="text-text-secondary text-sm">发送消息开始对话</p>
              <ApiInfoPanel />
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && msg.id === lastAssistantId && msg.content !== undefined}
              />
            ))
          )}
        </div>
      </main>

      {/* Input */}
      <ChatInput onSend={sendMessage} onStop={stopStreaming} isStreaming={isStreaming} />
    </div>
  );
}
