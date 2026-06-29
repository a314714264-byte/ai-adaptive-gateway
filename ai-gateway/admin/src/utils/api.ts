export interface ChannelHealth {
  id: string;
  name: string;
  type: string;
  base_url: string;
  status: number;
  status_label: string;
  healthy: boolean;
  response_time: number;
  test_time: number;
  consecutive_fails: number;
}

export interface HealthResponse {
  status: string;
  channels: Record<string, ChannelHealth>;
  queue: {
    max_concurrent: number;
    active: number;
    available: number;
    waiting: number;
  };
}

export interface ChannelConfig {
  id: string;
  name: string;
  type: "light" | "big" | "judge";
  provider_type: string;
  base_url: string;
  api_key: string;
  models: string;
  test_model: string;
  model_mapping: string;
  priority: number;
  weight: number;
  max_concurrent: number;
  status: number;
  status_label: string;
  auto_ban: number;
  auto_ban_threshold: number;
  remark: string;
  response_time: number;
  test_time: number;
}

export interface TestResult {
  success: boolean;
  response_ms: number;
  error?: string;
  model?: string;
  message?: string;
  http_status?: number;
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await apiFetch("/health");
  return res.json();
}

export async function fetchChannels(): Promise<{ status: string; channels: ChannelConfig[] }> {
  const res = await apiFetch("/channels");
  return res.json();
}

export async function addChannel(data: Partial<ChannelConfig>): Promise<{ status: string; channel: ChannelConfig }> {
  const res = await apiFetch("/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateChannel(
  id: string,
  data: Partial<ChannelConfig>
): Promise<{ status: string; channel: ChannelConfig }> {
  const res = await apiFetch(`/channels/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteChannel(id: string): Promise<{ status: string }> {
  const res = await apiFetch(`/channels/${encodeURIComponent(id)}`, { method: "DELETE" });
  return res.json();
}

export async function testChannel(id: string): Promise<{ status: string; result: TestResult }> {
  const res = await apiFetch(`/channels/${encodeURIComponent(id)}/test`, { method: "POST" });
  return res.json();
}

export async function testAllChannels(): Promise<{ status: string; results: Record<string, TestResult> }> {
  const res = await apiFetch("/channels/test-all", { method: "POST" });
  return res.json();
}

export async function toggleChannel(id: string): Promise<{ status: string; channel: ChannelConfig }> {
  const res = await apiFetch(`/channels/${encodeURIComponent(id)}/toggle`, { method: "PUT" });
  return res.json();
}

// ---- History ----

export interface UsageRecord {
  id: string;
  timestamp: number;
  channel_id: string;
  channel_name: string;
  channel_type: string;
  model: string;
  mapped_model: string;
  stream: boolean;
  success: boolean;
  response_ms: number;
  error: string;
  user_msg_preview: string;
}

export interface JudgeRecord {
  id: string;
  timestamp: number;
  channel_id: string;
  channel_name: string;
  model: string;
  user_msg_preview: string;
  judge_response: string;
  result: string;
  route: string;
  success: boolean;
  response_ms: number;
  error: string;
}

export interface HistoryStats {
  usage_total: number;
  usage_today: number;
  judge_total: number;
  type_stats: Record<string, { count: number; success: number; total_ms: number; avg_ms: number }>;
  judge_stats: { total: number; simple: number; complex: number; failed: number };
}

export async function fetchUsageHistory(params?: { limit?: number; offset?: number; channel_type?: string; channel_id?: string }): Promise<{ total: number; records: UsageRecord[] }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.channel_type) qs.set("channel_type", params.channel_type);
  if (params?.channel_id) qs.set("channel_id", params.channel_id);
  const res = await apiFetch(`/history/usage?${qs}`);
  return res.json();
}

export async function fetchJudgeHistory(params?: { limit?: number; offset?: number; result?: string; channel_id?: string }): Promise<{ total: number; records: JudgeRecord[] }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.result) qs.set("result", params.result);
  if (params?.channel_id) qs.set("channel_id", params.channel_id);
  const res = await apiFetch(`/history/judge?${qs}`);
  return res.json();
}

export async function fetchHistoryStats(): Promise<HistoryStats> {
  const res = await apiFetch("/history/stats");
  return res.json();
}

// ---- Settings ----

export interface GatewaySettings {
  external_url: string;
  default_model: string;
  health_check_interval: number;
  health_check_timeout: number;
}

export async function fetchSettings(): Promise<GatewaySettings> {
  const res = await apiFetch("/settings");
  return res.json();
}

export async function updateSettings(data: Partial<GatewaySettings>): Promise<{ status: string }> {
  const res = await apiFetch("/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
