"""渠道健康检查 - 参考 newapi 的测试逻辑。

核心思路：
1. 用 test_model 发送一个最小 chat 请求验证模型是否可用
2. 记录响应时间
3. 连续失败触发自动禁用
"""

import asyncio
import logging
import time

import httpx

from app.config import settings, STATUS_LABELS

logger = logging.getLogger("checker")


async def test_channel(channel_id: str) -> dict:
    """
    测试单个渠道 - 参考 newapi 的 TestChannel 逻辑。
    发送一个最小的 chat 请求来验证渠道可用性。
    """
    ch = settings.get_channel(channel_id)
    if not ch:
        return {"success": False, "error": "渠道不存在", "response_ms": 0}

    test_model = ch.get_test_model()
    base = ch.base_url.rstrip("/")
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if ch.api_key:
        headers["Authorization"] = f"Bearer {ch.api_key}"

    chat_url = f"{base}/chat/completions"
    payload = {
        "model": test_model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
        "stream": False,
    }

    timeout = settings.health_check_timeout
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(chat_url, json=payload, headers=headers)

        elapsed = int((time.monotonic() - start) * 1000)
        status = resp.status_code

        if status == 200:
            settings.record_test_result(channel_id, True, elapsed)
            logger.info("渠道测试通过: %s (%s) - %dms", ch.name, test_model, elapsed)
            return {
                "success": True,
                "response_ms": elapsed,
                "model": test_model,
                "message": f"测试通过，响应时间 {elapsed}ms",
            }

        # 解析错误信息
        try:
            body = resp.json()
            err_obj = body.get("error", {})
            if isinstance(err_obj, dict):
                err_msg = err_obj.get("message", str(body)[:200])
            else:
                err_msg = str(err_obj)[:200]
        except Exception:
            err_msg = resp.text[:200] if resp.text else f"HTTP {status}"

        settings.record_test_result(channel_id, False, elapsed, err_msg)
        logger.warning("渠道测试失败: %s - HTTP %d: %s", ch.name, status, err_msg)
        return {"success": False, "response_ms": elapsed, "error": err_msg, "http_status": status}

    except httpx.TimeoutException:
        elapsed = int((time.monotonic() - start) * 1000)
        err_msg = f"连接超时 ({timeout}s)"
        settings.record_test_result(channel_id, False, elapsed, err_msg)
        logger.warning("渠道测试超时: %s - %dms", ch.name, elapsed)
        return {"success": False, "response_ms": elapsed, "error": err_msg}

    except httpx.ConnectError as e:
        elapsed = int((time.monotonic() - start) * 1000)
        err_msg = f"连接失败: {str(e)[:100]}"
        settings.record_test_result(channel_id, False, elapsed, err_msg)
        logger.warning("渠道连接失败: %s - %s", ch.name, err_msg)
        return {"success": False, "response_ms": elapsed, "error": err_msg}

    except Exception as e:
        elapsed = int((time.monotonic() - start) * 1000)
        err_msg = str(e)[:200]
        settings.record_test_result(channel_id, False, elapsed, err_msg)
        logger.exception("渠道测试异常: %s", ch.name)
        return {"success": False, "response_ms": elapsed, "error": err_msg}


async def test_all_channels() -> dict[str, dict]:
    """批量测试所有渠道。"""
    results = {}
    tasks = {}
    async with httpx.AsyncClient(timeout=settings.health_check_timeout) as client:
        for ch in settings.channels:
            tasks[ch.id] = asyncio.create_task(_test_with_client(client, ch))
        # 等待所有任务完成（在 client 生命周期内）
        for cid, task in tasks.items():
            try:
                results[cid] = await task
            except Exception as e:
                results[cid] = {"success": False, "error": str(e)[:200], "response_ms": 0}

    ok_count = sum(1 for r in results.values() if r.get("success"))
    logger.info("批量测试完成: %d/%d 通过", ok_count, len(results))
    return results


async def _test_with_client(client: httpx.AsyncClient, ch) -> dict:
    """用共享 client 测试单个渠道。"""
    test_model = ch.get_test_model()
    base = ch.base_url.rstrip("/")
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if ch.api_key:
        headers["Authorization"] = f"Bearer {ch.api_key}"

    chat_url = f"{base}/chat/completions"
    payload = {
        "model": test_model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
        "stream": False,
    }

    start = time.monotonic()
    try:
        resp = await client.post(chat_url, json=payload, headers=headers)
        elapsed = int((time.monotonic() - start) * 1000)

        if resp.status_code == 200:
            settings.record_test_result(ch.id, True, elapsed)
            return {"success": True, "response_ms": elapsed, "model": test_model}

        try:
            body = resp.json()
            err_obj = body.get("error", {})
            err_msg = err_obj.get("message", str(body)[:200]) if isinstance(err_obj, dict) else str(err_obj)[:200]
        except Exception:
            err_msg = f"HTTP {resp.status_code}"

        settings.record_test_result(ch.id, False, elapsed, err_msg)
        return {"success": False, "response_ms": elapsed, "error": err_msg}

    except Exception as e:
        elapsed = int((time.monotonic() - start) * 1000)
        err_msg = str(e)[:200]
        settings.record_test_result(ch.id, False, elapsed, err_msg)
        return {"success": False, "response_ms": elapsed, "error": err_msg}


async def check_all() -> dict:
    """定时健康检查入口。"""
    return await test_all_channels()


# 后台定时检查
_check_task: asyncio.Task | None = None


async def _periodic_check():
    while True:
        await asyncio.sleep(settings.health_check_interval)
        try:
            await test_all_channels()
        except Exception:
            logger.exception("定时健康检查异常")


def start_background_checker() -> asyncio.Task:
    global _check_task
    _check_task = asyncio.create_task(_periodic_check())
    return _check_task


def stop_background_checker():
    global _check_task
    if _check_task and not _check_task.done():
        _check_task.cancel()
        _check_task = None


def health_snapshot() -> dict:
    """返回所有渠道的当前状态快照。"""
    return {
        ch.id: {
            "id": ch.id,
            "name": ch.name,
            "type": ch.type,
            "base_url": ch.base_url,
            "status": ch.status,
            "status_label": STATUS_LABELS.get(ch.status, "未知"),
            "healthy": ch.is_enabled and ch.response_time > 0,
            "response_time": ch.response_time,
            "test_time": ch.test_time,
            "consecutive_fails": ch.consecutive_fails,
        }
        for ch in settings.channels
    }
