"""路由决策：根据复杂度评估决定请求转发到轻量模型还是大模型。"""

import logging
import time
import uuid

from app.complexity_judge import judge_complexity
from app.config import settings
from app.history import history
from app.models import ChatCompletionRequest

logger = logging.getLogger("router")


def _extract_user_preview(messages) -> str:
    for msg in reversed(messages):
        if msg.role == "user":
            return msg.content[:50]
    return ""


async def route_request(request: ChatCompletionRequest, req_id: str = "") -> str:
    """判断请求应该路由到哪个模型。返回 "light" 或 "big"。"""
    if not req_id:
        req_id = f"judge-{uuid.uuid4().hex[:8]}"

    user_preview = _extract_user_preview(request.messages)
    ch = settings.get_judge_channel()
    ch_id = ch.id if ch else ""
    ch_name = ch.name if ch else ""
    model_name = ""
    if ch:
        model_list = ch.model_list
        model_name = model_list[0] if model_list else ch.get_test_model()

    start_time = time.monotonic()
    try:
        is_complex, judge_response = await judge_complexity(request.messages, return_raw=True)
        route = "big" if is_complex else "light"
        elapsed = int((time.monotonic() - start_time) * 1000)

        history.add_judge({
            "id": req_id, "timestamp": time.time(),
            "channel_id": ch_id, "channel_name": ch_name,
            "model": model_name,
            "user_msg_preview": user_preview,
            "judge_response": judge_response,
            "result": "complex" if is_complex else "simple",
            "route": route,
            "success": True, "response_ms": elapsed,
        })

        logger.info("路由决策: model=%s -> %s", request.model or "(auto)", route)
        return route

    except Exception as e:
        elapsed = int((time.monotonic() - start_time) * 1000)
        history.add_judge({
            "id": req_id, "timestamp": time.time(),
            "channel_id": ch_id, "channel_name": ch_name,
            "model": model_name,
            "user_msg_preview": user_preview,
            "judge_response": "",
            "result": "simple",  # 默认简单
            "route": "light",
            "success": False, "response_ms": elapsed,
            "error": str(e)[:200],
        })
        logger.warning("路由决策失败，默认简单: %s", e)
        return "light"
