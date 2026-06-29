import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Zap, Globe, Save, Check } from 'lucide-react';
import { useHealthStore } from '@/hooks/useHealth';
import HealthCard from '@/components/HealthCard';
import QueueMonitor from '@/components/QueueMonitor';
import { fetchSettings, updateSettings, type GatewaySettings } from '@/utils/api';

const TYPE_LABELS: Record<string, string> = {
  light: '轻量模型',
  big: '大模型',
  judge: '评估模型',
};

function formatRefreshTime(ts: number | null) {
  if (!ts) return '--';
  return new Date(ts).toLocaleTimeString('zh-CN');
}

export default function Dashboard() {
  const { health, loading, lastRefresh, fetchHealth, triggerCheck } = useHealthStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 网关设置
  const [gwSettings, setGwSettings] = useState<GatewaySettings>({ external_url: "", default_model: "auto", health_check_interval: 60, health_check_timeout: 120 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchHealth();
    timerRef.current = setInterval(fetchHealth, 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchHealth]);

  useEffect(() => {
    fetchSettings().then(setGwSettings).catch(() => {});
  }, []);

  const handleTriggerCheck = async () => {
    await triggerCheck();
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings(gwSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  if (!health && loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="skeleton h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-52 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center text-gray-400 py-20">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">无法连接到 Gateway 服务</p>
          <p className="text-sm mt-2">请检查后端服务是否正常运行</p>
          <button
            onClick={fetchHealth}
            className="mt-4 px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors text-sm"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // 按类型分组渠道
  const channelsByType: Record<string, typeof health.channels[string][]> = {};
  Object.values(health.channels || {}).forEach((ch) => {
    if (!channelsByType[ch.type]) channelsByType[ch.type] = [];
    channelsByType[ch.type].push(ch);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-white">AI Gateway 管理面板</h1>
          {loading && <RefreshCw className="w-4 h-4 text-accent animate-spin" />}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 font-mono">
            上次刷新: {formatRefreshTime(lastRefresh)}
          </span>
          <button
            onClick={handleTriggerCheck}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            手动检查
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {['light', 'big', 'judge'].map((type) => (
          <HealthCard
            key={type}
            label={TYPE_LABELS[type] || type}
            channels={channelsByType[type] || []}
          />
        ))}
      </div>

      <QueueMonitor queue={health.queue} />

      {/* 网关设置 */}
      <div className="mt-6 bg-panel-card/80 backdrop-blur-md border border-panel-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-white">网关设置</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 对外地址 */}
          <div className="md:col-span-1">
            <label className="block text-xs text-gray-500 mb-1.5">对外访问地址</label>
            <input
              type="text"
              value={gwSettings.external_url}
              onChange={(e) => setGwSettings({ ...gwSettings, external_url: e.target.value })}
              placeholder="如 http://192.168.9.89:8000"
              className="w-full px-3 py-2 bg-[#111] border border-panel-border rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 transition-colors"
            />
            <p className="text-xs text-gray-600 mt-1">用户端显示的 API 地址，留空则自动检测</p>
          </div>
          {/* 默认模型名 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">对外默认模型名</label>
            <input
              type="text"
              value={gwSettings.default_model}
              onChange={(e) => setGwSettings({ ...gwSettings, default_model: e.target.value })}
              placeholder="auto"
              className="w-full px-3 py-2 bg-[#111] border border-panel-border rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 transition-colors"
            />
            <p className="text-xs text-gray-600 mt-1">用户端填写的 model 名，触发自动路由</p>
          </div>
          {/* 检查间隔 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">健康检查间隔（秒）</label>
            <input
              type="number"
              value={gwSettings.health_check_interval}
              onChange={(e) => setGwSettings({ ...gwSettings, health_check_interval: Number(e.target.value) })}
              min={10}
              className="w-full px-3 py-2 bg-[#111] border border-panel-border rounded-lg text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          {/* 检查超时 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">健康检查超时（秒）</label>
            <input
              type="number"
              value={gwSettings.health_check_timeout}
              onChange={(e) => setGwSettings({ ...gwSettings, health_check_timeout: Number(e.target.value) })}
              min={10}
              className="w-full px-3 py-2 bg-[#111] border border-panel-border rounded-lg text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-black rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "已保存" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
