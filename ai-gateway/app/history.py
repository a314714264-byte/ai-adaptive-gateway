"""使用历史和判断历史记录模块。"""

import json
import logging
import time
from collections import deque
from pathlib import Path
from typing import Any

logger = logging.getLogger("history")

DATA_DIR = Path("data")
HISTORY_PATH = DATA_DIR / "history.json"

# 内存中保留最近 N 条记录，持久化保留全部
MAX_IN_MEMORY = 1000


class UsageRecord:
    """单次模型使用记录。"""
    def __init__(self, data: dict):
        self.id: str = data.get("id", "")
        self.timestamp: float = data.get("timestamp", 0)
        self.channel_id: str = data.get("channel_id", "")
        self.channel_name: str = data.get("channel_name", "")
        self.channel_type: str = data.get("channel_type", "")  # light/big
        self.model: str = data.get("model", "")
        self.mapped_model: str = data.get("mapped_model", "")
        self.stream: bool = data.get("stream", False)
        self.success: bool = data.get("success", True)
        self.response_ms: int = data.get("response_ms", 0)
        self.error: str = data.get("error", "")
        self.user_msg_preview: str = data.get("user_msg_preview", "")  # 用户消息前50字

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "channel_id": self.channel_id,
            "channel_name": self.channel_name,
            "channel_type": self.channel_type,
            "model": self.model,
            "mapped_model": self.mapped_model,
            "stream": self.stream,
            "success": self.success,
            "response_ms": self.response_ms,
            "error": self.error,
            "user_msg_preview": self.user_msg_preview,
        }


class JudgeRecord:
    """单次复杂度判断记录。"""
    def __init__(self, data: dict):
        self.id: str = data.get("id", "")
        self.timestamp: float = data.get("timestamp", 0)
        self.channel_id: str = data.get("channel_id", "")
        self.channel_name: str = data.get("channel_name", "")
        self.model: str = data.get("model", "")
        self.user_msg_preview: str = data.get("user_msg_preview", "")
        self.judge_response: str = data.get("judge_response", "")  # 原始响应
        self.result: str = data.get("result", "")  # simple/complex
        self.route: str = data.get("route", "")  # light/big
        self.success: bool = data.get("success", True)
        self.response_ms: int = data.get("response_ms", 0)
        self.error: str = data.get("error", "")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "channel_id": self.channel_id,
            "channel_name": self.channel_name,
            "model": self.model,
            "user_msg_preview": self.user_msg_preview,
            "judge_response": self.judge_response,
            "result": self.result,
            "route": self.route,
            "success": self.success,
            "response_ms": self.response_ms,
            "error": self.error,
        }


class HistoryManager:
    """历史记录管理器。"""
    def __init__(self):
        self.usage_records: deque[UsageRecord] = deque(maxlen=MAX_IN_MEMORY)
        self.judge_records: deque[JudgeRecord] = deque(maxlen=MAX_IN_MEMORY)
        self._load()

    def _load(self):
        if HISTORY_PATH.exists():
            try:
                data = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
                for r in data.get("usage", [])[-MAX_IN_MEMORY:]:
                    self.usage_records.append(UsageRecord(r))
                for r in data.get("judge", [])[-MAX_IN_MEMORY:]:
                    self.judge_records.append(JudgeRecord(r))
            except (json.JSONDecodeError, OSError):
                pass

    def _save(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        data = {
            "usage": [r.to_dict() for r in self.usage_records],
            "judge": [r.to_dict() for r in self.judge_records],
        }
        HISTORY_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def add_usage(self, record: dict):
        r = UsageRecord(record)
        self.usage_records.append(r)
        # 每 10 条持久化一次
        if len(self.usage_records) % 10 == 0:
            self._save()
        return r

    def add_judge(self, record: dict):
        r = JudgeRecord(record)
        self.judge_records.append(r)
        if len(self.judge_records) % 10 == 0:
            self._save()
        return r

    def get_usage_history(self, limit: int = 100, offset: int = 0,
                          channel_type: str = "", channel_id: str = "") -> dict:
        records = list(self.usage_records)
        if channel_type:
            records = [r for r in records if r.channel_type == channel_type]
        if channel_id:
            records = [r for r in records if r.channel_id == channel_id]
        total = len(records)
        # 最新的在前
        records = list(reversed(records))
        records = records[offset:offset + limit]
        return {
            "total": total,
            "records": [r.to_dict() for r in records],
        }

    def get_judge_history(self, limit: int = 100, offset: int = 0,
                          result: str = "", channel_id: str = "") -> dict:
        records = list(self.judge_records)
        if result:
            records = [r for r in records if r.result == result]
        if channel_id:
            records = [r for r in records if r.channel_id == channel_id]
        total = len(records)
        records = list(reversed(records))
        records = records[offset:offset + limit]
        return {
            "total": total,
            "records": [r.to_dict() for r in records],
        }

    def get_stats(self) -> dict:
        """获取统计摘要。"""
        usage = list(self.usage_records)
        judge = list(self.judge_records)

        # 按渠道类型统计
        type_stats: dict[str, dict] = {}
        for r in usage:
            t = r.channel_type
            if t not in type_stats:
                type_stats[t] = {"count": 0, "success": 0, "total_ms": 0}
            type_stats[t]["count"] += 1
            if r.success:
                type_stats[t]["success"] += 1
                type_stats[t]["total_ms"] += r.response_ms

        for t in type_stats:
            s = type_stats[t]
            s["avg_ms"] = s["total_ms"] // s["success"] if s["success"] > 0 else 0

        # 判断统计
        judge_stats = {"total": len(judge), "simple": 0, "complex": 0, "failed": 0}
        for r in judge:
            if not r.success:
                judge_stats["failed"] += 1
            elif r.result == "simple":
                judge_stats["simple"] += 1
            elif r.result == "complex":
                judge_stats["complex"] += 1

        return {
            "usage_total": len(usage),
            "usage_today": len([r for r in usage if r.timestamp > time.time() - 86400]),
            "judge_total": len(judge),
            "type_stats": type_stats,
            "judge_stats": judge_stats,
        }

    def flush(self):
        """强制持久化。"""
        self._save()


# 全局实例
history = HistoryManager()
