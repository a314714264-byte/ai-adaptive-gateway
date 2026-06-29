# AI Gateway 前端技术架构

## 1. 架构设计

```mermaid
graph LR
    "用户端 (React :3000)" -->|"API 调用"| "后端 (FastAPI :8000)"
    "管理端 (React :3001)" -->|"API 调用"| "后端 (FastAPI :8000)"
```

两个前端应用完全独立，各自运行在不同端口，共享同一个后端 API。

## 2. 技术说明

- 前端框架：React 18 + TypeScript + Vite
- 样式方案：TailwindCSS 3
- 状态管理：Zustand
- 路由：react-router-dom
- HTTP 客户端：fetch（SSE 流式）+ 原生 fetch（普通请求）
- 图标：lucide-react

### 项目结构

```
ai-gateway/
├── frontend/              # 用户端（端口 3000）
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── pages/         # 页面
│   │   ├── hooks/         # 自定义 hooks
│   │   ├── utils/         # 工具函数
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── admin/                 # 管理端（端口 3001）
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── app/                   # 后端（FastAPI :8000）
```

## 3. 路由定义

### 用户端 (frontend)

| 路由 | 用途 |
|------|------|
| / | 聊天页面 |

### 管理端 (admin)

| 路由 | 用途 |
|------|------|
| / | 仪表盘（健康概览 + 槽位监控） |
| /models | 模型管理（模型列表 + 手动检查） |

## 4. API 定义

后端已有 API：

| 端点 | 方法 | 说明 |
|------|------|------|
| /v1/chat/completions | POST | OpenAI 兼容聊天接口（支持 SSE 流式） |
| /v1/models | GET | 获取模型列表 |
| /health | GET | 获取健康状态 + 槽位信息 |
| /health/check | POST | 手动触发健康检查 |

### 类型定义

```typescript
// 健康状态
interface ModelHealth {
  name: string;
  base_url: string;
  healthy: boolean;
  response_ms: number;
  last_error: string;
  last_check: number;
}

interface HealthResponse {
  status: string;
  models: {
    light: ModelHealth;
    big: ModelHealth;
    judge: ModelHealth;
  };
  queue: {
    max_concurrent: number;
    active: number;
    available: number;
    waiting: number;
  };
}

// 聊天请求
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}
```

## 5. Vite 代理配置

两个前端通过 vite.config.ts 中的 proxy 将 API 请求代理到后端 :8000，避免跨域问题。
