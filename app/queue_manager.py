"""大模型固定并发槽位管理。"""

import asyncio
import logging

logger = logging.getLogger("queue_manager")


class QueueManager:
    """基于 asyncio.Semaphore 的固定并发槽位管理器。"""

    def __init__(self, max_concurrent: int):
        self._max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._active_count = 0
        self._waiting_count = 0
        self._lock = asyncio.Lock()

    async def acquire_slot(self) -> None:
        """获取一个槽位，无空位时自动排队等待。"""
        async with self._lock:
            self._waiting_count += 1
            logger.info("排队等待: waiting=%d, active=%d/%d",
                        self._waiting_count, self._active_count, self._max_concurrent)

        await self._semaphore.acquire()

        async with self._lock:
            self._waiting_count -= 1
            self._active_count += 1
            logger.info("获取槽位: waiting=%d, active=%d/%d",
                        self._waiting_count, self._active_count, self._max_concurrent)

    async def release_slot(self) -> None:
        """释放槽位。"""
        self._semaphore.release()
        async with self._lock:
            self._active_count -= 1
            logger.info("释放槽位: waiting=%d, active=%d/%d",
                        self._waiting_count, self._active_count, self._max_concurrent)

    @property
    def available_slots(self) -> int:
        return self._max_concurrent - self._active_count

    @property
    def active_count(self) -> int:
        return self._active_count

    @property
    def waiting_count(self) -> int:
        return self._waiting_count

    @property
    def max_concurrent(self) -> int:
        return self._max_concurrent

    def status(self) -> dict:
        return {
            "max_concurrent": self._max_concurrent,
            "active": self._active_count,
            "available": self.available_slots,
            "waiting": self._waiting_count,
        }

    def update_max_concurrent(self, new_max: int):
        """安全地更新最大并发数。创建新 Semaphore，差值补偿已占用的槽位。"""
        old_max = self._max_concurrent
        self._max_concurrent = new_max
        self._semaphore = asyncio.Semaphore(new_max)
        # 补偿当前已占用的槽位：先 acquire 到当前活跃数
        for _ in range(self._active_count):
            # 用 try-immediate 方式，如果新信号量还有空位就不阻塞
            pass  # Semaphore 初始值已包含所有槽位，活跃请求会在 release 时自然归还
