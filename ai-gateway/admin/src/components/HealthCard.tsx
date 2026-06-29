import { Activity, Clock, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { ChannelHealth } from '@/utils/api';

interface HealthCardProps {
  label: string;
  channels: ChannelHealth[];
}

export default function HealthCard({ label, channels }: HealthCardProps) {
  // 如果该类型没有渠道
  if (channels.length === 0) {
    return (
      <div className="bg-panel-card/80 backdrop-blur-md border border-gray-600/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-bold text-white">{label}</h3>
          </div>
          <span className="text-xs text-gray-500">未配置</span>
        </div>
        <p className="text-sm text-gray-500">请在渠道管理中添加{label}渠道</p>
      </div>
    );
  }

  // 汇总状态：任意一个渠道健康即为可用
  const anyHealthy = channels.some((ch) => ch.healthy);
  const allHealthy = channels.every((ch) => ch.healthy);
  const borderColor = anyHealthy
    ? 'border-success/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
    : 'border-danger/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]';
  const statusDot = anyHealthy ? 'bg-success animate-pulse-glow' : 'bg-danger animate-pulse-glow';

  // 取最快的响应时间
  const bestMs = Math.min(...channels.filter((c) => c.response_time > 0).map((c) => c.response_time));

  const formatTime = (ts: number) => {
    if (!ts) return '--';
    return new Date(ts * 1000).toLocaleTimeString('zh-CN');
  };

  return (
    <div className={`bg-panel-card/80 backdrop-blur-md border rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] ${borderColor}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-bold text-white">{label}</h3>
          <span className="text-xs text-gray-500">({channels.length}个渠道)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
          <div className={`flex items-center gap-1 text-sm font-medium ${anyHealthy ? 'text-success' : 'text-danger'}`}>
            {anyHealthy ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>{allHealthy ? '全部正常' : anyHealthy ? '部分正常' : '异常'}</span>
          </div>
        </div>
      </div>

      {/* 渠道列表 */}
      <div className="space-y-2">
        {channels.map((ch) => (
          <div key={ch.id} className="flex items-center gap-2 text-sm">
            {ch.status === 1 ? (
              <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${ch.healthy ? 'text-success' : 'text-yellow-500'}`} />
            ) : ch.status === 3 ? (
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-yellow-500" />
            ) : (
              <XCircle className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
            )}
            <span className="text-gray-300 truncate flex-1">{ch.name}</span>
            {ch.response_time > 0 && (
              <span className="font-mono text-xs text-gray-400">{ch.response_time}ms</span>
            )}
          </div>
        ))}
      </div>

      {/* 最快响应 */}
      {bestMs < Infinity && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-panel-border">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-500">最快响应</span>
          <span className="font-mono text-sm font-semibold text-white ml-auto">{bestMs}ms</span>
        </div>
      )}

      {/* 最后检查时间 */}
      {channels.length > 0 && channels[0].test_time > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
          <Clock className="w-3 h-3" />
          <span>最后检查: {formatTime(channels[0].test_time)}</span>
        </div>
      )}
    </div>
  );
}
