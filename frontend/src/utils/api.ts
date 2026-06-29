export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ApiInfo {
  base_url: string;
  chat_endpoint: string;
  models_endpoint: string;
  available_models: string[];
  default_model: string;
  api_key_required: boolean;
  note: string;
}

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch("/health");
  return res.json();
}

export async function fetchApiInfo(): Promise<ApiInfo> {
  const res = await fetch("/api-info");
  return res.json();
}

export async function* streamChat(messages: ChatMessage[], model?: string) {
  const response = await fetch("/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "auto",
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} - ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const chunk = JSON.parse(data);
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed JSON
        }
      }
    }
  }
}
