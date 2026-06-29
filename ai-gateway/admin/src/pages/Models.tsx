import { useEffect, useRef, useState, useCallback } from "react";
import {
  Server, RefreshCw, Plus, Pencil, Trash2, X, Zap, ZapOff,
  Play, Clock, AlertTriangle, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import {
  fetchChannels, addChannel, updateChannel, deleteChannel,
  testChannel, testAllChannels, toggleChannel,
  type ChannelConfig, type TestResult,
} from "@/utils/api";

const TYPE_LABELS: Record<string, string> = { light: "轻量", big: "大模型", judge: "评估" };
const TYPE_COLORS: Record<string, string> = {
  light: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  big: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  judge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};
const STATUS_ENABLED = 1;
const STATUS_DISABLED = 2;
const STATUS_AUTO_BANNED = 3;

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI 兼容" },
  { value: "anthropic", label: "Anthropic" },
  { value: "azure", label: "Azure OpenAI" },
  { value: "custom", label: "自定义" },
];

interface ChannelForm {
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
  auto_ban: number;
  auto_ban_threshold: number;
  remark: string;
}

function emptyForm(): ChannelForm {
  return {
    name: "", type: "light", provider_type: "openai",
    base_url: "", api_key: "", models: "", test_model: "",
    model_mapping: "", priority: 0, weight: 1, max_concurrent: 0,
    auto_ban: 1, auto_ban_threshold: 5, remark: "",
  };
}

export default function Models() {
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ChannelConfig | null>(null);
  const [form, setForm] = useState<ChannelForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [testAllLoading, setTestAllLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchChannels();
      setChannels(data.channels || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (ch: ChannelConfig) => {
    setEditing(ch);
    setForm({
      name: ch.name, type: ch.type, provider_type: ch.provider_type,
      base_url: ch.base_url, api_key: "", models: ch.models,
      test_model: ch.test_model, model_mapping: ch.model_mapping,
      priority: ch.priority, weight: ch.weight, max_concurrent: ch.max_concurrent,
      auto_ban: ch.auto_ban, auto_ban_threshold: ch.auto_ban_threshold,
      remark: ch.remark,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.base_url) {
      flash("err", "名称和 API 地址不能为空");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload: any = { ...form };
        if (!payload.api_key) delete payload.api_key;
        await updateChannel(editing.id, payload);
        flash("ok", "渠道已更新");
      } else {
        await addChannel(form);
        flash("ok", "渠道已添加");
      }
      setShowModal(false);
      load();
    } catch {
      flash("err", "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ch: ChannelConfig) => {
    if (!confirm(`确定删除渠道「${ch.name}」？`)) return;
    try {
      await deleteChannel(ch.id);
      flash("ok", "渠道已删除");
      load();
    } catch {
      flash("err", "删除失败");
    }
  };

  const handleTest = async (ch: ChannelConfig) => {
    setTestingIds((prev) => new Set(prev).add(ch.id));
    try {
      const res = await testChannel(ch.id);
      setTestResults((prev) => ({ ...prev, [ch.id]: res.result }));
      if (res.result.success) {
        flash("ok", `${ch.name}: 测试通过 (${res.result.response_ms}ms)`);
      } else {
        flash("err", `${ch.name}: ${res.result.error || "测试失败"}`);
      }
      load();
    } catch {
      flash("err", "测试请求失败");
    } finally {
      setTestingIds((prev) => { const n = new Set(prev); n.delete(ch.id); return n; });
    }
  };

  const handleTestAll = async () => {
    setTestAllLoading(true);
    try {
      const res = await testAllChannels();
      setTestResults(res.results || {});
      const okCount = Object.values(res.results).filter((r) => r.success).length;
      flash("ok", `批量测试完成: ${okCount}/${channels.length} 通过`);
      load();
    } catch {
      flash("err", "批量测试失败");
    } finally {
      setTestAllLoading(false);
    }
  };

  const handleToggle = async (ch: ChannelConfig) => {
    try {
      await toggleChannel(ch.id);
      load();
    } catch {
      flash("err", "操作失败");
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return "--";
    return new Date(ts * 1000).toLocaleString("zh-CN");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-white">渠道管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestAll}
            disabled={testAllLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-panel-card border border-panel-border rounded-lg hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {testAllLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            测试所有渠道
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-black bg-accent hover:bg-accent/80 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> 添加渠道
          </button>
        </div>
      </div>

      {/* 消息 */}
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msg.type === "ok" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          {msg.text}
        </div>
      )}

      {/* 表格 */}
      <div className="bg-panel-card/80 backdrop-blur-md border border-panel-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-panel-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">状态</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">名称</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">类型</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">模型</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">API 地址</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">响应时间</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">最后测试</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => {
              const isTesting = testingIds.has(ch.id);
              const tr = testResults[ch.id];
              return (
                <tr key={ch.id} className="border-b border-panel-border/50 last:border-b-0 hover:bg-panel-secondary/50 transition-colors">
                  {/* 状态 */}
                  <td className="px-4 py-3">
                    <StatusDot status={ch.status} responseTime={ch.response_time} />
                  </td>
                  {/* 名称 */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-white text-sm">{ch.name}</div>
                    {ch.remark && <div className="text-xs text-gray-500 mt-0.5">{ch.remark}</div>}
                  </td>
                  {/* 类型 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[ch.type] || ""}`}>
                      {TYPE_LABELS[ch.type] || ch.type}
                    </span>
                  </td>
                  {/* 模型 */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {ch.models.split(",").filter(Boolean).map((m) => (
                        <span key={m.trim()} className="inline-block px-1.5 py-0.5 text-xs bg-panel-primary rounded text-gray-300">{m.trim()}</span>
                      ))}
                    </div>
                  </td>
                  {/* 地址 */}
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-gray-400 bg-panel-primary/60 px-2 py-1 rounded max-w-[180px] truncate block">
                      {ch.base_url}
                    </code>
                  </td>
                  {/* 响应时间 */}
                  <td className="px-4 py-3">
                    <ResponseTimeBadge ms={ch.response_time} />
                  </td>
                  {/* 最后测试 */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500">{formatTime(ch.test_time)}</span>
                  </td>
                  {/* 操作 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => handleTest(ch)}
                        disabled={isTesting}
                        className="p-1.5 text-gray-400 hover:text-green-400 rounded-lg hover:bg-panel-primary/60 transition-colors disabled:opacity-50"
                        title="测试"
                      >
                        {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleToggle(ch)}
                        className="p-1.5 text-gray-400 hover:text-yellow-400 rounded-lg hover:bg-panel-primary/60 transition-colors"
                        title={ch.status === STATUS_ENABLED ? "禁用" : "启用"}
                      >
                        {ch.status === STATUS_ENABLED ? <Zap className="w-4 h-4 text-green-400" /> : <ZapOff className="w-4 h-4 text-gray-500" />}
                      </button>
                      <button onClick={() => openEdit(ch)} className="p-1.5 text-gray-400 hover:text-accent rounded-lg hover:bg-panel-primary/60 transition-colors" title="编辑">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(ch)} className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-panel-primary/60 transition-colors" title="删除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {channels.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  暂无渠道，点击「添加渠道」开始配置
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 添加/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div
            className="bg-panel-secondary border border-panel-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">{editing ? "编辑渠道" : "添加渠道"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">渠道名称 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如: OpenAI-主渠道"
                    className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">服务商类型</label>
                  <select
                    value={form.provider_type}
                    onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
                    className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
                  >
                    {PROVIDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">渠道类型 *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                    className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
                  >
                    <option value="light">轻量模型 (light)</option>
                    <option value="big">大模型 (big)</option>
                    <option value="judge">评估模型 (judge)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">API 地址 *</label>
                  <input
                    value={form.base_url}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    placeholder="http://192.168.9.89/v1"
                    className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">API Key{editing ? "（留空不修改）" : ""}</label>
                <input
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent/50"
                />
              </div>

              {/* 模型配置 */}
              <div className="border-t border-panel-border pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">模型配置</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">支持的模型（逗号分隔）</label>
                    <input
                      value={form.models}
                      onChange={(e) => setForm({ ...form, models: e.target.value })}
                      placeholder="qwen2.5-7b, qwen2.5-14b"
                      className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">测试模型</label>
                    <input
                      value={form.test_model}
                      onChange={(e) => setForm({ ...form, test_model: e.target.value })}
                      placeholder="留空默认用第一个模型"
                      className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent/50"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-400 mb-1">模型映射（JSON，可选）</label>
                  <input
                    value={form.model_mapping}
                    onChange={(e) => setForm({ ...form, model_mapping: e.target.value })}
                    placeholder='{"gpt-4": "deepseek-r1"}'
                    className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>

              {/* 高级配置 */}
              <div className="border-t border-panel-border pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">高级配置</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">优先级</label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                      className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">权重</label>
                    <input
                      type="number"
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                      min={1}
                      className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">最大并发</label>
                    <input
                      type="number"
                      value={form.max_concurrent}
                      onChange={(e) => setForm({ ...form, max_concurrent: Number(e.target.value) })}
                      min={0}
                      placeholder="0=不限"
                      className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">自动禁用阈值</label>
                    <input
                      type="number"
                      value={form.auto_ban_threshold}
                      onChange={(e) => setForm({ ...form, auto_ban_threshold: Number(e.target.value) })}
                      min={1}
                      className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.auto_ban === 1}
                      onChange={(e) => setForm({ ...form, auto_ban: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded border-gray-600 bg-panel-primary text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-gray-300">连续失败自动禁用</span>
                  </label>
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">备注</label>
                <input
                  value={form.remark}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
                  placeholder="可选备注信息"
                  className="w-full bg-panel-primary border border-panel-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-panel-card border border-panel-border rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-black bg-accent hover:bg-accent/80 rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : editing ? "保存修改" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status, responseTime }: { status: number; responseTime: number }) {
  if (status === STATUS_ENABLED) {
    const color = responseTime > 0 ? "bg-green-500" : "bg-yellow-500";
    const label = responseTime > 0 ? "正常" : "未测试";
    return (
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
        <span className="text-xs text-gray-300">{label}</span>
      </span>
    );
  }
  if (status === STATUS_AUTO_BANNED) {
    return (
      <span className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
        <span className="text-xs text-yellow-500">自动禁用</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <XCircle className="w-3.5 h-3.5 text-red-400" />
      <span className="text-xs text-red-400">已禁用</span>
    </span>
  );
}

function ResponseTimeBadge({ ms }: { ms: number }) {
  if (!ms) return <span className="text-xs text-gray-600">--</span>;
  let color = "text-green-400";
  if (ms > 3000) color = "text-red-400";
  else if (ms > 1000) color = "text-yellow-400";
  return (
    <div className="flex items-center gap-1">
      <Clock className="w-3 h-3 text-gray-500" />
      <span className={`font-mono text-sm ${color}`}>{ms}ms</span>
    </div>
  );
}
