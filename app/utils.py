"""SSE 工具函数。"""

import asyncio
import json
import uuid
from typing import AsyncGenerator

from app.models import ChatCompletionChunk, make_chunk


async def sse_generator(
    response_iter: AsyncGenerator[str, None],
    chunk_id: str,
    model: str,
    heartbeat_interval: float = 15.0,
) -> AsyncGenerator[str, None]:
    """将上游 SSE 行转为标准 SSE 格式，并在模型加载等待期间发送心跳。

    使用 asyncio.wait 来同时监听上游数据和心跳定时器，
    当上游长时间无数据时（如模型加载中），自动发送 SSE 注释心跳保持连接。
    """
    done_sent = False

    # 将 async generator 转为可 await 的迭代器
    ait = response_iter.__aiter__()

    while True:
        try:
            # 同时等待上游数据和心跳
            line_task = asyncio.create_task(ait.__anext__())
            heartbeat_task = asyncio.create_task(asyncio.sleep(heartbeat_interval))

            done, pending = await asyncio.wait(
                {line_task, heartbeat_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            # 取消未完成的任务
            for t in pending:
                t.cancel()
                try:
                    await t
                except asyncio.CancelledError:
                    pass

            # 处理心跳触发
            if heartbeat_task in done:
                # 上游还没返回数据，发送 SSE 注释心跳（客户端会忽略注释行）
                yield ": heartbeat\n\n"
                continue

            # 处理上游数据
            if line_task in done:
                try:
                    line = line_task.result()
                except StopAsyncIteration:
                    # 上游结束
                    break

                if line.startswith("data: "):
                    data = line[len("data: "):]
                    if data.strip() == "[DONE]":
                        finish_chunk = make_chunk(chunk_id, model, content=None, finish_reason="stop")
                        yield f"data: {finish_chunk.model_dump_json()}\n\n"
                        yield "data: [DONE]\n\n"
                        done_sent = True
                        break
                    else:
                        try:
                            chunk_data = json.loads(data)
                            chunk_data["model"] = model
                            yield f"data: {json.dumps(chunk_data, ensure_ascii=False)}\n\n"
                        except json.JSONDecodeError:
                            yield f"data: {data}\n\n"
                else:
                    yield line + "\n"

        except StopAsyncIteration:
            break

    # 确保最终有 [DONE]（上游可能没发）
    if not done_sent:
        yield "data: [DONE]\n\n"


async def sse_error(message: str, chunk_id: str, model: str) -> AsyncGenerator[str, None]:
    """生成一个错误 SSE 流。"""
    error_chunk = make_chunk(chunk_id, model, content=f"[Error] {message}", finish_reason="stop")
    yield f"data: {error_chunk.model_dump_json()}\n\n"
    yield "data: [DONE]\n\n"


def new_chunk_id() -> str:
    return f"chatcmpl-{uuid.uuid4().hex[:12]}"
