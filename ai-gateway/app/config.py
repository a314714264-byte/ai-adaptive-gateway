"""AI Gateway 渠道配置管理 - 参考 newapi 的 Channel 模型。"""

import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger("config")

DATA_DIR = Path("data")
CONFIG_PATH = DATA_DIR / "config.json"

# 渠道类型
CHANNEL_TYPES = ["light", "big", "judge"]

# 服务商类型
PROVIDER_TYPES = ["openai", "anthropic", "azure", "custom"]

# 渠道状态
STATUS_ENABLED = 1      # 正常启用
STATUS_DISABLED = 2     # 手动禁用
STATUS_AUTO_BANNED = 3  # 自动禁用（连续失败触发）

STATUS_LABELS = {STATUS_ENABLED: "已启用", STATUS_DISABLED: "已禁用", STATUS_AUTO_BANNED: "自动禁用"}


class ChannelConfig:
    """单个渠道配置 - 参考 newapi Channel 模型。"""
    def __init__(self, data: dict):
        self.id: str = data.get("id", "")
        self.name: str = data.get("name", "")                # 渠道名称
        self.type: str = data.get("type", "light")           # light/big/judge
        self.provider_type: str = data.get("provider_type", "openai")  # openai/anthropic/azure/custom
        self.base_url: str = data.get("base_url", "")        # API 基础地址
        self.api_key: str = data.get("api_key", "")          # API Key
        self.models: str = data.get("models", "")            # 支持的模型列表，逗号分隔
        self.test_model: str = data.get("test_model", "")    # 测试用的模型名
        self.model_mapping: str = data.get("model_mapping", "")  # 模型映射 JSON
        self.priority: int = data.get("priority", 0)         # 优先级（越高越优先）
        self.weight: int = data.get("weight", 1)             # 权重（同优先级随机）
        self.max_concurrent: int = data.get("max_concurrent", 0)  # 最大并发（0=不限）
        self.status: int = data.get("status", STATUS_ENABLED)  # 状态
        self.auto_ban: int = data.get("auto_ban", 1)         # 是否自动禁用
        self.auto_ban_threshold: int = data.get("auto_ban_threshold", 5)  # 连续失败几次自动禁用
        self.remark: str = data.get("remark", "")            # 备注
        # 运行时统计（不持久化）
        self.response_time: int = 0  # 最后一次测试响应时间(ms)
        self.test_time: int = 0      # 最后一次测试时间戳
        self.consecutive_fails: int = 0  # 连续失败次数

    @property
    def is_enabled(self) -> bool:
        return self.status == STATUS_ENABLED

    @property
    def model_list(self) -> list[str]:
        """返回支持的模型名列表。"""
        if not self.models:
            return []
        return [m.strip() for m in self.models.split(",") if m.strip()]

    def get_test_model(self) -> str:
        """获取用于测试的模型名。优先用 test_model，否则用模型列表第一个。"""
        if self.test_model:
            return self.test_model
        models = self.model_list
        return models[0] if models else self.name

    def get_mapped_model(self, model_name: str) -> str:
        """模型名映射。如果配置了 model_mapping，将请求中的模型名映射为实际模型名。"""
        if not self.model_mapping:
            return model_name
        try:
            mapping = json.loads(self.model_mapping)
            return mapping.get(model_name, model_name)
        except (json.JSONDecodeError, AttributeError):
            return model_name

    def to_dict(self, mask_key: bool = False) -> dict:
        d = {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "provider_type": self.provider_type,
            "base_url": self.base_url,
            "models": self.models,
            "test_model": self.test_model,
            "model_mapping": self.model_mapping,
            "priority": self.priority,
            "weight": self.weight,
            "max_concurrent": self.max_concurrent,
            "status": self.status,
            "status_label": STATUS_LABELS.get(self.status, "未知"),
            "auto_ban": self.auto_ban,
            "auto_ban_threshold": self.auto_ban_threshold,
            "remark": self.remark,
            "response_time": self.response_time,
            "test_time": self.test_time,
        }
        if mask_key and self.api_key:
            d["api_key"] = self.api_key[:4] + "****" + self.api_key[-4:] if len(self.api_key) > 8 else "****"
        else:
            d["api_key"] = self.api_key
        return d


# 默认渠道
DEFAULT_CHANNELS: list[dict[str, Any]] = [
    {
        "id": "light-default",
        "name": "轻量模型-默认",
        "type": "light",
        "provider_type": "openai",
        "base_url": "http://localhost:8001/v1",
        "api_key": "",
        "models": "qwen2.5-7b",
        "test_model": "qwen2.5-7b",
        "priority": 0,
        "weight": 1,
        "max_concurrent": 0,
        "status": STATUS_ENABLED,
        "auto_ban": 1,
        "auto_ban_threshold": 5,
    },
    {
        "id": "big-default",
        "name": "大模型-默认",
        "type": "big",
        "provider_type": "openai",
        "base_url": "http://localhost:8002/v1",
        "api_key": "",
        "models": "deepseek-r1",
        "test_model": "deepseek-r1",
        "priority": 0,
        "weight": 1,
        "max_concurrent": 3,
        "status": STATUS_ENABLED,
        "auto_ban": 1,
        "auto_ban_threshold": 5,
    },
]


class Settings:
    """全局配置管理。"""
    def __init__(self):
        self.channels: list[ChannelConfig] = []
        self.health_check_interval: int = 60
        self.health_check_timeout: int = 120
        self.host: str = "0.0.0.0"
        self.port: int = 8000
        self.external_url: str = ""  # 对外访问地址，如 http://192.168.9.89:8000
        self.default_model: str = "auto"  # 对外显示的默认模型名
        self._load()

    def _load(self):
        if CONFIG_PATH.exists():
            try:
                data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                self.channels = [ChannelConfig(c) for c in data.get("channels", DEFAULT_CHANNELS)]
                self.health_check_interval = data.get("health_check_interval", 60)
                self.health_check_timeout = data.get("health_check_timeout", 120)
                self.external_url = data.get("external_url", "")
                self.default_model = data.get("default_model", "auto")
            except (json.JSONDecodeError, OSError):
                self.channels = [ChannelConfig(c) for c in DEFAULT_CHANNELS]
        else:
            self.channels = [ChannelConfig(c) for c in DEFAULT_CHANNELS]

    def _save(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        data = {
            "channels": [c.to_dict(mask_key=False) for c in self.channels],
            "health_check_interval": self.health_check_interval,
            "health_check_timeout": self.health_check_timeout,
            "external_url": self.external_url,
            "default_model": self.default_model,
        }
        CONFIG_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def get_channel(self, channel_id: str) -> ChannelConfig | None:
        for c in self.channels:
            if c.id == channel_id:
                return c
        return None

    def get_channels_by_type(self, channel_type: str, enabled_only: bool = True) -> list[ChannelConfig]:
        channels = [c for c in self.channels if c.type == channel_type]
        if enabled_only:
            channels = [c for c in channels if c.is_enabled]
        return channels

    def get_light_channel(self) -> ChannelConfig | None:
        """获取可用的轻量模型渠道（按优先级+权重选择）。"""
        channels = self.get_channels_by_type("light", enabled_only=True)
        return self._select_by_priority(channels)

    def get_big_channel(self) -> ChannelConfig | None:
        channels = self.get_channels_by_type("big", enabled_only=True)
        return self._select_by_priority(channels)

    def get_judge_channel(self) -> ChannelConfig | None:
        """获取评估渠道，没有则用轻量模型。"""
        channels = self.get_channels_by_type("judge", enabled_only=True)
        if channels:
            return self._select_by_priority(channels)
        return self.get_light_channel()

    def _select_by_priority(self, channels: list[ChannelConfig]) -> ChannelConfig | None:
        """按优先级和权重选择渠道。"""
        if not channels:
            return None
        # 按优先级分组
        max_priority = max(c.priority for c in channels)
        top = [c for c in channels if c.priority == max_priority]
        if len(top) == 1:
            return top[0]
        # 按权重随机（简化：直接返回第一个权重最大的）
        top.sort(key=lambda c: c.weight, reverse=True)
        return top[0]

    def add_channel(self, data: dict) -> ChannelConfig:
        ch = ChannelConfig(data)
        if not ch.id:
            ch.id = f"ch-{uuid.uuid4().hex[:8]}"
        self.channels.append(ch)
        self._save()
        logger.info("添加渠道: id=%s, name=%s, type=%s", ch.id, ch.name, ch.type)
        return ch

    def update_channel(self, channel_id: str, data: dict) -> ChannelConfig | None:
        ch = self.get_channel(channel_id)
        if not ch:
            return None
        for key, value in data.items():
            if key == "id":
                continue
            if hasattr(ch, key):
                setattr(ch, key, value)
        self._save()
        logger.info("更新渠道: id=%s", channel_id)
        return ch

    def delete_channel(self, channel_id: str) -> bool:
        ch = self.get_channel(channel_id)
        if not ch:
            return False
        self.channels.remove(ch)
        self._save()
        logger.info("删除渠道: id=%s", channel_id)
        return True

    def toggle_channel(self, channel_id: str) -> ChannelConfig | None:
        """切换渠道启用/禁用状态。"""
        ch = self.get_channel(channel_id)
        if not ch:
            return None
        if ch.status == STATUS_ENABLED:
            ch.status = STATUS_DISABLED
        else:
            ch.status = STATUS_ENABLED
            ch.consecutive_fails = 0
        self._save()
        logger.info("切换渠道状态: id=%s -> %s", channel_id, STATUS_LABELS[ch.status])
        return ch

    def record_test_result(self, channel_id: str, success: bool, response_ms: int, error: str = ""):
        """记录测试结果，处理自动禁用逻辑。"""
        ch = self.get_channel(channel_id)
        if not ch:
            return
        ch.test_time = int(time.time())
        ch.response_time = response_ms if success else 0
        if success:
            ch.consecutive_fails = 0
        else:
            ch.consecutive_fails += 1
            if ch.auto_ban and ch.consecutive_fails >= ch.auto_ban_threshold:
                if ch.status == STATUS_ENABLED:
                    ch.status = STATUS_AUTO_BANNED
                    logger.warning("渠道 %s 连续失败 %d 次，自动禁用", ch.name, ch.consecutive_fails)
        self._save()

    def list_channels(self, mask_key: bool = True) -> list[dict]:
        return [c.to_dict(mask_key=mask_key) for c in self.channels]


settings = Settings()
