# AI Gateway 实现计划

## 概述

创建一个 AI 网关服务，接收 OpenAI 兼容格式的 `/v1/chat/completions` 请求，通过调用轻量模型判断请求复杂度，将简单请求转发到轻量模型、复杂请求转发到大模型（带固定并发槽位排队），并支持 SSE 流式响应。

## 当前状态

- 目标目录 `c:\Users\rt09446\Desktop\code\newapi-moxingpanduan` 尚不存在，需要从零创建
- 参考了同机器上 `newapigai` 和 `aiyy` 项目的 FastAPI 模式

## 架构设计

```
客户端请求 → /v1/chat/completions
                ↓
          complexity_judge (调用轻量模型判断复杂度)
                ↓
         ┌──────┴──────┐
         ↓             ↓
    轻量模型转发    大模型转发(排队管理)
         ↓             ↓
      SSE 流式响应返回客户端
```

## 文件清单与实现细节

### 1. `ai-gateway/requirements.txt`

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
httpx==0.28.1
pydantic==2.10.4
```

### 2. `ai-gateway/app/__init__.py`

空文件。

### 3. `ai-gateway/app/config.py`

通过环境变量或 `.env` 读取配置：

```python
# 核心配置项
LIGHT_MODEL_BASE_URL    # 轻量模型 API 地址 (如 http://localhost:8000/v1)
LIGHT_MODEL_API_KEY     # 轻量模型 API Key
LIGHT_MODEL_NAME        # 轻量模型名称 (如 qwen2.5-7b)
BIG_MODEL_BASE_URL      # 大模型 API 地址
BIG_MODEL_API_KEY       # 大模型 API Key
BIG_MODEL_NAME          # 大模型名称 (如 deepseek-r1)
BIG_MODEL_MAX_CONCURRENT = 3  # 大模型最大并发数
JUDGE_MODEL_BASE_URL    # 复杂度评估用的模型地址 (可复用轻量模型)
JUDGE_MODEL_API_KEY     # 评估模型 Key
JUDGE_MODEL_NAME        # 评估模型名称
HOST = "0.0.0.0"
PORT = 8000
```

使用 pydantic-settings 的 `BaseSettings` 管理配置。

### 4. `ai-gateway/app/models.py`

定义与 OpenAI 兼容的请求/响应 Pydantic 模型：

- `ChatMessage`: role, content
- `ChatCompletionRequest`: model, messages, temperature, max_tokens, stream 等
- `ChatCompletionChoice`: index, message, finish_reason
- `ChatCompletionResponse`: id, object, created, model, choices, usage
- `ChatCompletionChunk`: 流式响应的 delta 格式

### 5. `ai-gateway/app/complexity_judge.py`

**核心逻辑**：构造一个判断 prompt，调用轻量模型来评估用户请求的复杂度。

```
判断 prompt 模板:
"请判断以下用户问题的复杂度，只回答 simple 或 complex：
问题：{user_message}"
```

- `_build_judge_prompt(messages)`: 从用户 messages 中提取最后一条用户消息，构造判断 prompt
- `judge_complexity(messages) -> bool`: 调用轻量模型，返回 True(复杂) / False(简单)
- 设置超时（如 5 秒），超时默认为简单
- 解析模型返回的 "simple" / "complex" 关键词

### 6. `ai-gateway/app/router.py`

路由决策层：

- `route_request(request: ChatCompletionRequest) -> str`: 返回 "light" 或 "big"
- 先调用 `complexity_judge.judge_complexity()` 判断
- 返回目标路由类型

### 7. `ai-gateway/app/queue_manager.py`

大模型固定并发槽位管理：

```python
class QueueManager:
    def __init__(self, max_concurrent: int):
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._queue = asyncio.Queue()  # 排队队列

    async def acquire_slot()      # 获取槽位（无空位则等待）
    def release_slot()            # 释放槽位
    @property
    def available_slots() -> int  # 当前可用槽位数
    @property
    def waiting_count() -> int   # 等待中的请求数
```

使用 `asyncio.Semaphore` 实现固定并发控制，排队自动 FIFO。

### 8. `ai-gateway/app/light_model.py`

轻量模型转发客户端：

- `async stream_chat(request, base_url, api_key) -> AsyncGenerator[str, None]`
- 使用 `httpx.AsyncClient` 向轻量模型发起 SSE 流式请求
- 逐行读取 SSE 数据并转发

### 9. `ai-gateway/app/big_model.py`

大模型转发客户端（与 light_model 类似，但经过 queue_manager 排队）：

- `async stream_chat(request, base_url, api_key, queue_manager) -> AsyncGenerator[str, None]`
- 先通过 `queue_manager.acquire_slot()` 获取槽位
- 请求完成后 `queue_manager.release_slot()`
- 使用 `httpx.AsyncClient` SSE 流式转发

### 10. `ai-gateway/app/utils.py`

SSE 工具函数：

- `sse_generator(response_iter) -> AsyncGenerator[str, None]`: 将上游 SSE 响应转为 FastAPI `StreamingResponse` 格式
- `generate_heartbeat()`: 定期发送 SSE 心跳注释（`: heartbeat\n\n`），防止连接超时断开
- `create_error_chunk()`: 生成错误时的 SSE 数据块

### 11. `ai-gateway/app/main.py`

FastAPI 应用入口：

```python
app = FastAPI(title="AI Gateway", version="1.0.0")

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    # 1. 通过 router 决定路由
    # 2. 如果 stream=true，返回 StreamingResponse(SSE)
    # 3. 如果 stream=false，收集完整响应后返回 JSON

@app.get("/v1/models")
async def list_models():
    # 返回可用模型列表

@app.get("/health")
async def health():
    # 返回网关状态 + 槽位信息
```

### 12. `ai-gateway/run.sh`

启动脚本：

```bash
#!/bin/bash
cd "$(dirname "$0")"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 关键设计决策

1. **复杂度判断**：调用轻量模型做分类，超时默认简单，避免阻塞
2. **流式优先**：默认支持 SSE 流式，非流式通过收集完整流实现
3. **排队管理**：`asyncio.Semaphore` 实现固定并发，自动 FIFO 排队
4. **心跳机制**：大模型排队等待时发送 SSE 心跳，防止客户端超时
5. **配置管理**：通过环境变量配置，灵活切换不同模型后端

## 验证步骤

1. 启动服务：`cd ai-gateway && bash run.sh`
2. 测试健康检查：`curl http://localhost:8000/health`
3. 测试简单请求（应路由到轻量模型）
4. 测试复杂请求（应路由到大模型）
5. 测试并发超限时的排队行为
6. 测试 SSE 流式响应
