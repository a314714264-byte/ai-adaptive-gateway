"""大模型转发客户端（带排队管理）。"""

import logging
from typing import Any, AsyncGenerator

import httpx

from app.models import ChatCompletionRequest
from app.queue_manager import QueueManager

logger = logging.getLogger("big_model")


def _build_payload(request: ChatCompletionRequest, model_name: str, stream: bool) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model_name,
        "messages": [{"role": m.role, "content": m.content} for m in request.messages],
        "temperature": request.temperature,
        "stream": stream,
    }
    if request.max_tokens is not None:
        payload["max_tokens"] = request.max_tokens
    return payload


async def stream_chat(
    request: ChatCompletionRequest,
    base_url: str,
    api_key: str,
    model_name: str,
    queue: QueueManager,
) -> AsyncGenerator[str, None]:
    """流式转发到大模型，先排队获取槽位。"""
    await queue.acquire_slot()
    try:
        payload = _build_payload(request, model_name, stream=True)
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        url = f"{base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield line
    finally:
        await queue.release_slot()


async def chat(
    request: ChatCompletionRequest,
    base_url: str,
    api_key: str,
    model_name: str,
    queue: QueueManager,
) -> dict:
    """非流式转发到大模型，先排队获取槽位。"""
    await queue.acquire_slot()
    try:
        payload = _build_payload(request, model_name, stream=False)
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        url = f"{base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()
    finally:
        await queue.release_slot()
