import { useEffect, useState, useCallback } from "react";
import { History, Clock, CheckCircle, XCircle, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import {
  fetchUsageHistory, fetchJudgeHistory, fetchHistoryStats,
  type UsageRecord, type JudgeRecord, type HistoryStats,
} from "@/utils/api";

function formatTime(ts: number) {
  if (!ts) return "--";
  return new Date(ts * 1000).toLocaleString("zh-CN");
}

const TYPE_COLORS: Record<string, string> = {
  light: "bg-emerald-500/15 text-emerald-400",
  big: "bg-blue-500/15 text-blue-400",
};

const RESULT_COLORS: Record<string, string> = {
  simple: "bg-emerald-500/15 text-emerald-400",
  complex: "bg-orange-500/15 text-orange-400",
};

export default function HistoryPage() {
  const [tab, setTab] = useState<"usage" | "judge">("usage");
  const [usageData, setUsageData] = useState<{ total: number; records: UsageRecord[] }>({ total: 0, records: [] });
  const [judgeData, setJudgeData] = useState<{ total: number; records: JudgeRecord[] }>({ total: 0, records: [] });
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const loadUsage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsageHistory({ limit: 100, channel_type: filter });
      setUsageData(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadJudge = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJudgeHistory({ limit: 100, result: filter });
      setJudgeData(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchHistoryStats();
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === "usage") loadUsage();
    else loadJudge();
  }, [tab, loadUsage, loadJudge]);

  const handleRefresh = () => {
    loadStats();
    if (tab === "usage") loadUsage();
    else loadJudge();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-white">历史记录</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-panel-card border border-panel-border rounded-lg hover:border-gray-500 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="总请求数" value={stats.usage_total} color="text-accent" />
          <StatCard label="今日请求" value={stats.usage_today} color="text-green-400" />
          <StatCard label="判断总数" value={stats.judge_total} color="text-blue-400" />
          <StatCard
            label="简单/复杂"
            value={`${stats.judge_stats.simple}/${stats.judge_stats.complex}`}
            color="text-purple-400"
          />
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 mb-4 bg-panel-card/60 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setTab("usage"); setFilter(""); }}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${tab === "usage" ? "bg-accent text-black font-medium" : "text-gray-400 hover:text-white"}`}
        >
          模型使用历史
        </button>
        <button
          onClick={() => { setTab("judge"); setFilter(""); }}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${tab === "judge" ? "bg-accent text-black font-medium" : "text-gray-400 hover:text-white"}`}
        >
          判断历史
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-2 mb-4">
        {tab === "usage" ? (
          <>
            <span className="text-xs text-gray-500">筛选类型:</span>
            {["", "light", "big"].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter === t ? "bg-accent/20 text-accent border-accent/30" : "text-gray-400 border-panel-border hover:border-gray-500"}`}
              >
                {t || "全部"}
              </button>
            ))}
          </>
        ) : (
          <>
            <span className="text-xs text-gray-500">筛选结果:</span>
            {["", "simple", "complex"].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter === t ? "bg-accent/20 text-accent border-accent/30" : "text-gray-400 border-panel-border hover:border-gray-500"}`}
              >
                {t || "全部"}
              </button>
            ))}
          </>
        )}
        <span className="text-xs text-gray-500 ml-auto">共 {tab === "usage" ? usageData.total : judgeData.total} 条</span>
      </div>

      {/* 表格 */}
      {tab === "usage" ? (
        <UsageTable records={usageData.records} />
      ) : (
        <JudgeTable records={judgeData.records} />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-panel-card/80 backdrop-blur-md border border-panel-border rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-mono text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function UsageTable({ records }: { records: UsageRecord[] }) {
  if (records.length === 0) {
    return <div className="text-center text-gray-500 py-12">暂无使用记录</div>;
  }
  return (
    <div className="bg-panel-card/80 backdrop-blur-md border border-panel-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-panel-border">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">时间</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">渠道</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">类型</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">模型</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">用户消息</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">流式</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">状态</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">耗时</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-panel-border/50 last:border-b-0 hover:bg-panel-secondary/50 transition-colors">
              <td className="px-4 py-3 text-xs text-gray-400 font-mono">{formatTime(r.timestamp)}</td>
              <td className="px-4 py-3 text-sm text-gray-300">{r.channel_name}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[r.channel_type] || "text-gray-400"}`}>
                  {r.channel_type === "light" ? "轻量" : "大模型"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="text-sm text-white">{r.model || "-"}</div>
                {r.model !== r.mapped_model && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />{r.mapped_model}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">{r.user_msg_preview || "-"}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{r.stream ? "流式" : "非流式"}</td>
              <td className="px-4 py-3">
                {r.success ? (
                  <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle className="w-3.5 h-3.5" />成功</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400 text-xs" title={r.error}><XCircle className="w-3.5 h-3.5" />失败</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`font-mono text-sm ${r.response_ms > 3000 ? "text-red-400" : r.response_ms > 1000 ? "text-yellow-400" : "text-green-400"}`}>
                  {r.response_ms}ms
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JudgeTable({ records }: { records: JudgeRecord[] }) {
  if (records.length === 0) {
    return <div className="text-center text-gray-500 py-12">暂无判断记录</div>;
  }
  return (
    <div className="bg-panel-card/80 backdrop-blur-md border border-panel-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-panel-border">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">时间</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">评估渠道</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">用户消息</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">判断结果</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">路由</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">原始响应</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">状态</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">耗时</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-panel-border/50 last:border-b-0 hover:bg-panel-secondary/50 transition-colors">
              <td className="px-4 py-3 text-xs text-gray-400 font-mono">{formatTime(r.timestamp)}</td>
              <td className="px-4 py-3 text-sm text-gray-300">{r.channel_name}</td>
              <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">{r.user_msg_preview || "-"}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLORS[r.result] || "text-gray-400"}`}>
                  {r.result === "simple" ? "简单" : "复杂"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 text-xs ${r.route === "light" ? "text-emerald-400" : "text-blue-400"}`}>
                  <ArrowRight className="w-3 h-3" />
                  {r.route === "light" ? "轻量模型" : "大模型"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-[150px] truncate" title={r.judge_response}>
                {r.judge_response || "-"}
              </td>
              <td className="px-4 py-3">
                {r.success ? (
                  <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle className="w-3.5 h-3.5" />成功</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-400 text-xs" title={r.error}><XCircle className="w-3.5 h-3.5" />失败</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-sm text-gray-300">{r.response_ms}ms</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
