FROM python:3.12-slim AS backend

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

# 构建前端
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 构建管理端
FROM node:20-slim AS admin-build
WORKDIR /build
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

# 最终镜像
FROM python:3.12-slim

WORKDIR /app

COPY --from=backend /app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

# 前端静态文件 -> /app/static/frontend
COPY --from=frontend-build /build/dist /app/static/frontend

# 管理端静态文件 -> /app/static/admin
COPY --from=admin-build /build/dist /app/static/admin

# 数据目录
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "300"]
