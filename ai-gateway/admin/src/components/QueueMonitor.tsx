import { Cpu, AlertTriangle } from 'lucide-react';

interface QueueMonitorProps {
  queue: {
    max_concurrent: number;
    active: number;
    available: number;
    waiting: number;
  };
}

export default function QueueMonitor({ queue }: QueueMonitorProps) {
  const { max_concurrent, active, available, waiting } = queue;
  const usage = max_concurrent > 0 ? (active / max_concurrent) * 100 : 0;

  const barColor =
    usage > 80
      ? 'bg-danger'
      : usage > 50
        ? 'bg-accent'
        : 'bg-success';

  const barBgColor =
    usage > 80
      ? 'bg-danger/20'
      : usage > 50
        ? 'bg-accent/20'
        : 'bg-success/20';

  return (
    <div className="bg-panel-card/80 backdrop-blur-md border border-panel-border rounded-xl p-5">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-bold text-white">大模型槽位</h3>
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-400">使用率</span>
          <span className="font-mono text-white font-semibold">
            {active} / {max_concurrent}
          </span>
        </div>
        <div className={`w-full h-3 rounded-full ${barBgColor} overflow-hidden`}>
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500 ease-out`}
            style={{ width: `${Math.min(usage, 100)}%` }}
          />
        </div>
        <div className="text-right text-xs text-gray-500 mt-1 font-mono">
          {usage.toFixed(1)}%
        </div>
      </div>

      {/* 数字统计 */}
      <div className="grid grid-cols-4 gap-3">
        <StatItem label="活跃" value={active} color="text-success" />
        <StatItem label="可用" value={available} color="text-blue-400" />
        <StatItem label="等待" value={waiting} color="text-accent" />
        <StatItem label="总共" value={max_concurrent} color="text-white" />
      </div>

      {/* 排队警告 */}
      {waiting > 0 && (
        <div className="mt-4 flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="text-sm text-accent font-medium">
            {waiting} 个请求排队中
          </span>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`font-mono text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
