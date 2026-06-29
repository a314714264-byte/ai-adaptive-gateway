"""轻量模型转发客户端。"""

import logging
from typing import Any, AsyncGenerator

import httpx

from app.models import ChatCompletionRequest

logger = logging.getLogger("light_model")


def _serialize_content(content: str | list[dict]) -> str | list[dict]:
    """序列化消息内容，处理图片等多模态格式。"""
    return content


def _build_payload(request: ChatCompletionRequest, model_name: str, stream: bool) -> dict[str, Any]:
    """构造转发到上游的请求体。"""
    payload: dict[str, Any] = {
        "model": model_name,
        "messages": [{"role": m.role, "content": _serialize_content(m.content)} for m in request.messages],
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
) -> AsyncGenerator[str, None]:
    """流式转发到轻量模型，逐行 yield SSE 数据行。"""
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


async def chat(
    request: ChatCompletionRequest,
    base_url: str,
    api_key: str,
    model_name: str,
) -> dict:
    """非流式转发到轻量模型，返回完整响应 JSON。"""
    payload = _build_payload(request, model_name, stream=False)
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    url = f"{base_url}/chat/completions"

    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()
