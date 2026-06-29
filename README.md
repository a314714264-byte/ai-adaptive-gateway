# AI Adaptive Gateway

**AI自适应判断网关** — 一个智能 API 网关，根据请求复杂度自动路由到合适的大模型或轻量模型。

[English](#english) | [中文](#chinese)

---

## Chinese

### 概述

AI Adaptive Gateway 是一个基于 FastAPI 构建的智能 AI 请求网关，对外暴露兼容 OpenAI API 格式的 `/v1/chat/completions` 接口。它通过一个小型语言模型（Judge Model）判断用户请求的复杂度，自动将简单请求路由到轻量模型（快速、低成本），复杂请求路由到大模型（强推理能力、带并发队列）。

### 核心特性

- **智能路由** — 自动判断请求复杂度，分配最优模型
- **OpenAI 兼容** — 完全兼容 OpenAI API 格式，可直接替换 base_url
- **多通道管理** — 支持配置多个上游通道（light/big/judge），支持 OpenAI、Anthropic、Azure、自定义端点
- **并发控制** — 大模型使用信号量控制并发，防止上游过载
- **健康检查** — 定时检测通道可用性，自动禁用故障通道
- **流式响应** — 支持 SSE 流式输出，含心跳保活机制
- **管理面板** — 内置 React 管理后台，可视化配置
- **用户界面** — 内置聊天界面，开箱即用
- **历史记录** — 记录请求日志和判断记录，支持统计查询

### 架构

```
客户端 (OpenAI SDK / Web UI)
        │
        ▼
┌────────────────────────────────────┐
│         AI Gateway (FastAPI)        │
│                                     │
│  ┌────────┐   ┌──────────┐         │
│  │ Router  │──▶│Judge LLM │         │
│  │         │   │(复杂度判断)│         │
│  │ light  ◀──┘ └──────────┘         │
│  │   or   │                         │
│  │  big   │    ┌──────────────┐     │
│  └────┬───┘    │ QueueManager  │     │
│       │        │ (并发队列)     │     │
│       ▼        └──────────────┘     │
│  ┌──────────┐  ┌──────────┐        │
│  │ 轻量模型  │  │  大模型   │        │
│  │ (无队列)  │  │ (有队列)  │        │
│  └────┬─────┘  └────┬─────┘        │
│       │              │              │
│       ▼              ▼              │
│  ┌──────────────────────────┐       │
│  │  上游 LLM 提供商 (通道)    │       │
│  │  OpenAI / 阿里云 / 本地   │       │
│  └──────────────────────────┘       │
└────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Python 3.12+, FastAPI |
| ASGI 服务器 | Uvicorn |
| HTTP 客户端 | httpx (异步) |
| 数据验证 | Pydantic |
| 前端 | React 18 + TypeScript, Vite, Zustand, Tailwind CSS |
| 容器化 | Docker + Docker Compose |
| 数据存储 | JSON 文件 |

### 快速开始

#### 开发模式

```bash
# 后端
cd ai-gateway
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 前端（新终端）
cd ai-gateway/frontend
npm install
npm run dev
```

#### Docker 部署

```bash
docker-compose up -d
```

### 配置

编辑 `data/config.json` 配置上游通道：

- **light** — 轻量模型通道（快速响应，无并发限制）
- **big** — 大模型通道（强推理能力，有限并发）
- **judge** — 判断模型通道（用于复杂度分析）

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/chat/completions` | 聊天补全（兼容 OpenAI 格式） |
| GET | `/v1/models` | 获取模型列表 |
| GET | `/health` | 健康检查 |
| GET/POST/PUT/DELETE | `/channels` | 通道 CRUD |
| POST | `/channels/{id}/test` | 测试通道 |
| GET | `/history/stats` | 统计信息 |

### 文档

更多详细文档见 `docs/` 目录：

- [项目实现计划](docs/01-plan.md) — 架构设计、文件清单、实现细节
- [前端 PRD](docs/02-frontend-prd.md) — 产品需求文档
- [前端技术架构](docs/03-frontend-tech.md) — 技术选型、组件设计

---

## English

### Overview

AI Adaptive Gateway is an intelligent API gateway built with FastAPI that exposes an OpenAI-compatible `/v1/chat/completions` endpoint. It uses a small judge LLM to evaluate request complexity and automatically routes simple queries to lightweight models (fast, low-cost) and complex queries to powerful models (strong reasoning, with concurrency queue).

### Key Features

- **Smart Routing** — Automatically classifies request complexity and routes to the optimal model
- **OpenAI Compatible** — Drop-in replacement for OpenAI API, just change the base URL
- **Multi-Channel Management** — Supports multiple upstream channels (light/big/judge) with OpenAI, Anthropic, Azure, or custom endpoints
- **Concurrency Control** — Semaphore-based queue for big model requests
- **Health Checking** — Periodic channel health checks with auto-disable
- **Streaming** — SSE streaming with heartbeat keepalive
- **Admin Panel** — Built-in React admin dashboard
- **Chat UI** — Built-in chat interface, ready to use
- **History & Stats** — Request logging and usage statistics

### Architecture

```
Client (OpenAI SDK / Web UI)
        │
        ▼
┌────────────────────────────────────┐
│         AI Gateway (FastAPI)        │
│                                     │
│  ┌────────┐   ┌──────────┐         │
│  │ Router  │──▶│Judge LLM │         │
│  │         │   │(complexity)│       │
│  │ light  ◀──┘ └──────────┘         │
│  │   or   │                         │
│  │  big   │    ┌──────────────┐     │
│  └────┬───┘    │ QueueManager  │     │
│       │        │  (semaphore)  │     │
│       ▼        └──────────────┘     │
│  ┌──────────┐  ┌──────────┐        │
│  │  Light   │  │   Big    │        │
│  │  Model   │  │  Model   │        │
│  │ (no queue)│  │ (queued) │        │
│  └────┬─────┘  └────┬─────┘        │
│       │              │              │
│       ▼              ▼              │
│  ┌──────────────────────────┐       │
│  │  Upstream LLM Providers   │       │
│  │  (Channels)               │       │
│  └──────────────────────────┘       │
└────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12+, FastAPI, Uvicorn |
| HTTP Client | httpx (async) |
| Validation | Pydantic |
| Frontend | React 18, TypeScript, Vite, Zustand, Tailwind CSS |
| Container | Docker, Docker Compose |
| Storage | JSON files |

### Quick Start

#### Development

```bash
# Backend
cd ai-gateway
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (separate terminal)
cd ai-gateway/frontend
npm install
npm run dev
```

#### Docker

```bash
docker-compose up -d
```

### Configuration

Edit `data/config.json` to configure upstream channels:

- **light** — Fast, low-cost model (no concurrency limit)
- **big** — Powerful model (limited concurrency, queued)
- **judge** — Model used for complexity classification

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | Chat completion (OpenAI compatible) |
| GET | `/v1/models` | List available models |
| GET | `/health` | Health check |
| GET/POST/PUT/DELETE | `/channels` | Channel CRUD |
| POST | `/channels/{id}/test` | Test a channel |
| GET | `/history/stats` | Usage statistics |

### Documentation

More detailed documents are available in the `docs/` directory:

- [Project Plan](docs/01-plan.md) — Architecture, file structure, and implementation details
- [Frontend PRD](docs/02-frontend-prd.md) — Product requirements for the frontend and admin panel
- [Frontend Tech Spec](docs/03-frontend-tech.md) — Frontend technology architecture and component design

### License

MIT
