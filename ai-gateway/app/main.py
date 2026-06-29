"""AI Gateway - FastAPI 应用入口。"""

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.checker import (
    check_all, health_snapshot, start_background_checker,
    stop_background_checker, test_channel, test_all_channels,
)
from app.config import settings
from app.history import history
from app.models import ChatCompletionRequest
from app.queue_manager import QueueManager
from app.router import route_request
from app.utils import new_chunk_id, sse_generator

import app.light_model as light_model
import app.big_model as big_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("main")

queue_manager: QueueManager | None = None


def _extract_user_preview(messages) -> str:
    """提取用户消息预览。"""
    for msg in reversed(messages):
        if msg.role == "user":
            return msg.content[:50]
    return ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    global queue_manager

    # 取所有 big 渠道中最大的 max_concurrent
    big_channels = settings.get_channels_by_type("big", enabled_only=False)
    max_concurrent = 3
    for bc in big_channels:
        if bc.max_concurrent > max_concurrent:
            max_concurrent = bc.max_concurrent
    queue_manager = QueueManager(max_concurrent=max_concurrent)

    logger.info("正在测试渠道连通性...")
    await check_all()

    start_background_checker()
    yield
    stop_background_checker()
    history.flush()
    logger.info("AI Gateway 关闭")


app = FastAPI(title="AI Gateway", version="1.0.0", lifespan=lifespan)


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """OpenAI 兼容的聊天补全接口。"""
    start_time = time.monotonic()
    req_id = f"req-{uuid.uuid4().hex[:8]}"
    user_preview = _extract_user_preview(request.messages)

    route = await route_request(request, req_id=req_id)
    chunk_id = new_chunk_id()

    # 对外默认模型名（如 "auto"）视为空，使用渠道配置的实际模型
    effective_model = request.model if request.model and request.model != settings.default_model else ""

    if route == "light":
        ch = settings.get_light_channel()
        if not ch:
            return JSONResponse(status_code=503, content={"error": "没有可用的轻量模型渠道"})
        model_name = ch.get_mapped_model(effective_model) if effective_model else ch.get_test_model()
        logger.info("路由到轻量模型: %s -> %s (渠道: %s)", request.model, model_name, ch.name)

        try:
            if request.stream:
                response_iter = light_model.stream_chat(request, ch.base_url, ch.api_key, model_name)
                # 流式请求：记录使用（响应时间用启动时间估算）
                elapsed = int((time.monotonic() - start_time) * 1000)
                history.add_usage({
                    "id": req_id, "timestamp": time.time(),
                    "channel_id": ch.id, "channel_name": ch.name,
                    "channel_type": "light", "model": request.model or "",
                    "mapped_model": model_name, "stream": True,
                    "success": True, "response_ms": elapsed,
                    "user_msg_preview": user_preview,
                })
                return StreamingResponse(
                    sse_generator(response_iter, chunk_id, model_name),
                    media_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
                )
            else:
                data = await light_model.chat(request, ch.base_url, ch.api_key, model_name)
                elapsed = int((time.monotonic() - start_time) * 1000)
                history.add_usage({
                    "id": req_id, "timestamp": time.time(),
                    "channel_id": ch.id, "channel_name": ch.name,
                    "channel_type": "light", "model": request.model or "",
                    "mapped_model": model_name, "stream": False,
                    "success": True, "response_ms": elapsed,
                    "user_msg_preview": user_preview,
                })
                return JSONResponse(content=data)
        except Exception as e:
            elapsed = int((time.monotonic() - start_time) * 1000)
            history.add_usage({
                "id": req_id, "timestamp": time.time(),
                "channel_id": ch.id, "channel_name": ch.name,
                "channel_type": "light", "model": request.model or "",
                "mapped_model": model_name, "stream": request.stream,
                "success": False, "response_ms": elapsed,
                "error": str(e)[:200], "user_msg_preview": user_preview,
            })
            raise

    else:  # big
        ch = settings.get_big_channel()
        if not ch:
            return JSONResponse(status_code=503, content={"error": "没有可用的大模型渠道"})
        model_name = ch.get_mapped_model(effective_model) if effective_model else ch.get_test_model()
        logger.info("路由到大模型: %s -> %s (渠道: %s)", request.model, model_name, ch.name)

        try:
            if request.stream:
                response_iter = big_model.stream_chat(request, ch.base_url, ch.api_key, model_name, queue_manager)
                elapsed = int((time.monotonic() - start_time) * 1000)
                history.add_usage({
                    "id": req_id, "timestamp": time.time(),
                    "channel_id": ch.id, "channel_name": ch.name,
                    "channel_type": "big", "model": request.model or "",
                    "mapped_model": model_name, "stream": True,
                    "success": True, "response_ms": elapsed,
                    "user_msg_preview": user_preview,
                })
                return StreamingResponse(
                    sse_generator(response_iter, chunk_id, model_name),
                    media_type="text/event-stream",
                    headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
                )
            else:
                data = await big_model.chat(request, ch.base_url, ch.api_key, model_name, queue_manager)
                elapsed = int((time.monotonic() - start_time) * 1000)
                history.add_usage({
                    "id": req_id, "timestamp": time.time(),
                    "channel_id": ch.id, "channel_name": ch.name,
                    "channel_type": "big", "model": request.model or "",
                    "mapped_model": model_name, "stream": False,
                    "success": True, "response_ms": elapsed,
                    "user_msg_preview": user_preview,
                })
                return JSONResponse(content=data)
        except Exception as e:
            elapsed = int((time.monotonic() - start_time) * 1000)
            history.add_usage({
                "id": req_id, "timestamp": time.time(),
                "channel_id": ch.id, "channel_name": ch.name,
                "channel_type": "big", "model": request.model or "",
                "mapped_model": model_name, "stream": request.stream,
                "success": False, "response_ms": elapsed,
                "error": str(e)[:200], "user_msg_preview": user_preview,
            })
            raise


@app.get("/v1/models")
async def list_models():
    """返回可用模型列表（OpenAI 格式）。"""
    model_set = set()
    for ch in settings.channels:
        if ch.is_enabled:
            for m in ch.model_list:
                model_set.add(m)
    return {
        "object": "list",
        "data": [{"id": m, "object": "model", "owned_by": "ai-gateway"} for m in sorted(model_set)],
    }


@app.get("/health")
async def health():
    """健康检查。"""
    return {
        "status": "ok",
        "channels": health_snapshot(),
        "queue": queue_manager.status() if queue_manager else None,
    }


# ---- 渠道管理 API ----

@app.get("/channels")
async def api_list_channels():
    """获取所有渠道列表。"""
    return {"status": "ok", "channels": settings.list_channels(mask_key=True)}


@app.post("/channels")
async def api_add_channel(request: Request):
    """添加渠道。"""
    body = await request.json()
    if not body:
        return JSONResponse(status_code=400, content={"error": "请求体不能为空"})
    required = ["name", "type", "base_url"]
    for f in required:
        if not body.get(f):
            return JSONResponse(status_code=400, content={"error": f"缺少必填字段: {f}"})
    if body.get("type") not in ("light", "big", "judge"):
        return JSONResponse(status_code=400, content={"error": "type 必须是 light/big/judge"})

    ch = settings.add_channel(body)
    return {"status": "ok", "channel": ch.to_dict(mask_key=True)}


@app.put("/channels/{channel_id}")
async def api_update_channel(channel_id: str, request: Request):
    """更新渠道配置。"""
    body = await request.json()
    ch = settings.update_channel(channel_id, body)
    if not ch:
        return JSONResponse(status_code=404, content={"error": f"渠道不存在: {channel_id}"})

    # 更新大模型并发数
    if ch.type == "big" and "max_concurrent" in body and queue_manager:
        new_max = body.get("max_concurrent", 0)
        if new_max and new_max > 0:
            queue_manager.update_max_concurrent(new_max)

    return {"status": "ok", "channel": ch.to_dict(mask_key=True)}


@app.delete("/channels/{channel_id}")
async def api_delete_channel(channel_id: str):
    """删除渠道。"""
    ok = settings.delete_channel(channel_id)
    if not ok:
        return JSONResponse(status_code=404, content={"error": f"渠道不存在: {channel_id}"})
    return {"status": "ok"}


@app.post("/channels/{channel_id}/test")
async def api_test_channel(channel_id: str):
    """测试单个渠道。"""
    result = await test_channel(channel_id)
    return {"status": "ok", "result": result}


@app.post("/channels/test-all")
async def api_test_all_channels():
    """测试所有渠道。"""
    results = await test_all_channels()
    return {"status": "ok", "results": results}


@app.put("/channels/{channel_id}/toggle")
async def api_toggle_channel(channel_id: str):
    """切换渠道启用/禁用。"""
    ch = settings.toggle_channel(channel_id)
    if not ch:
        return JSONResponse(status_code=404, content={"error": f"渠道不存在: {channel_id}"})
    return {"status": "ok", "channel": ch.to_dict(mask_key=True)}


# ---- 网关设置 API ----

@app.get("/settings")
async def api_get_settings():
    """获取网关全局设置。"""
    return {
        "external_url": settings.external_url,
        "default_model": settings.default_model,
        "health_check_interval": settings.health_check_interval,
        "health_check_timeout": settings.health_check_timeout,
    }


@app.put("/settings")
async def api_update_settings(request: Request):
    """更新网关全局设置。"""
    body = await request.json()
    if "external_url" in body:
        settings.external_url = body["external_url"].strip()
    if "default_model" in body:
        settings.default_model = body["default_model"].strip() or "auto"
    if "health_check_interval" in body:
        settings.health_check_interval = int(body["health_check_interval"])
    if "health_check_timeout" in body:
        settings.health_check_timeout = int(body["health_check_timeout"])
    settings._save()
    return {"status": "ok"}


# ---- API 信息接口 ----

@app.get("/api-info")
async def api_info(request: Request):
    """返回网关对外接口信息，供前端展示。"""
    # 优先使用管理员配置的对外地址
    if settings.external_url:
        base_url = settings.external_url.rstrip("/")
    else:
        host = request.headers.get("host", f"localhost:{settings.port}")
        scheme = "https" if request.url.scheme == "https" else "http"
        base_url = f"{scheme}://{host}"

    # 收集所有可用模型
    model_list = []
    for ch in settings.channels:
        if ch.is_enabled:
            for m in ch.model_list:
                if m not in model_list:
                    model_list.append(m)

    return {
        "base_url": base_url,
        "chat_endpoint": f"{base_url}/v1/chat/completions",
        "models_endpoint": f"{base_url}/v1/models",
        "available_models": model_list,
        "default_model": settings.default_model,
        "api_key_required": False,
        "note": f"将此地址作为 OpenAI API Base URL 使用即可，model 填 {settings.default_model} 自动路由",
    }


# ---- 历史记录 API ----

@app.get("/history/usage")
async def api_usage_history(limit: int = 50, offset: int = 0,
                             channel_type: str = "", channel_id: str = ""):
    """获取模型使用历史。"""
    return history.get_usage_history(limit, offset, channel_type, channel_id)


@app.get("/history/judge")
async def api_judge_history(limit: int = 50, offset: int = 0,
                             result: str = "", channel_id: str = ""):
    """获取判断历史。"""
    return history.get_judge_history(limit, offset, result, channel_id)


@app.get("/history/stats")
async def api_history_stats():
    """获取历史统计摘要。"""
    return history.get_stats()


# ---- 静态文件（Docker 生产环境） ----

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
FRONTEND_DIR = STATIC_DIR / "frontend"
ADMIN_DIR = STATIC_DIR / "admin"

if FRONTEND_DIR.exists():
    app.mount("/user", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

if ADMIN_DIR.exists():
    app.mount("/admin", StaticFiles(directory=str(ADMIN_DIR), html=True), name="admin")
