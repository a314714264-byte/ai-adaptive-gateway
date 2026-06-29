"""OpenAI 兼容的请求/响应 Pydantic 模型。"""

import time
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str | list[dict] = ""


class ChatCompletionRequest(BaseModel):
    model: str = ""
    messages: list[ChatMessage]
    temperature: float = 0.7
    max_tokens: int | None = None
    stream: bool = False
    top_p: float = 1.0
    n: int = 1


class ChatCompletionChoiceMessage(BaseModel):
    role: str = "assistant"
    content: str


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatCompletionChoiceMessage
    finish_reason: str | None = "stop"


class UsageInfo(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:12]}")
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str = ""
    choices: list[ChatCompletionChoice]
    usage: UsageInfo = Field(default_factory=UsageInfo)


# ---- 流式响应 (SSE chunk) ----

class DeltaContent(BaseModel):
    role: str | None = None
    content: str | None = None


class ChunkChoice(BaseModel):
    index: int = 0
    delta: DeltaContent
    finish_reason: str | None = None


class ChatCompletionChunk(BaseModel):
    id: str = ""
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str = ""
    choices: list[ChunkChoice]


def make_chunk(chunk_id: str, model: str, content: str | None, finish_reason: str | None = None) -> ChatCompletionChunk:
    """快速构造一个流式 chunk。"""
    return ChatCompletionChunk(
        id=chunk_id,
        model=model,
        choices=[
            ChunkChoice(
                delta=DeltaContent(content=content),
                finish_reason=finish_reason,
            )
        ],
    )
