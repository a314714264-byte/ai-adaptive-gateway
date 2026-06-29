"""通过轻量模型判断请求复杂度。"""

import logging
from typing import Any

import httpx

from app.config import settings
from app.models import ChatMessage

logger = logging.getLogger("complexity_judge")

JUDGE_SYSTEM_PROMPT = (
    "你是一个复杂度分类器。根据用户问题的内容判断其复杂度。\n"
    "规则：\n"
    "- 如果问题涉及推理、数学、编程、长文写作、多步骤分析、专业知识，回答 complex\n"
    "- 如果问题只是简单问答、闲聊、翻译短句、简单信息查询，回答 simple\n"
    "只回答一个词：simple 或 complex，不要有任何其他内容。"
)

JUDGE_TIMEOUT = 120.0


def _extract_last_user_message(messages: list[ChatMessage]) -> str:
    for msg in reversed(messages):
        if msg.role == "user":
            return msg.content
    return ""


async def judge_complexity(messages: list[ChatMessage], return_raw: bool = False) -> bool | tuple:
    """调用评估渠道判断复杂度。返回 True=复杂, False=简单。如果 return_raw=True，返回 (is_complex, raw_response)。"""
    user_msg = _extract_last_user_message(messages)
    if not user_msg:
        result = False
        return (result, "") if return_raw else result

    ch = settings.get_judge_channel()
    if not ch:
        result = False
        return (result, "") if return_raw else result

    # 优先用评估渠道配置的模型列表第一个，而非 test_model
    model_list = ch.model_list
    model_name = model_list[0] if model_list else ch.get_test_model()
    payload: dict[str, Any] = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.0,
        "max_tokens": 10,
        "stream": False,
    }

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if ch.api_key:
        headers["Authorization"] = f"Bearer {ch.api_key}"

    url = f"{ch.base_url}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=JUDGE_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"].strip().lower()
        is_complex = "complex" in content
        logger.info("复杂度判断: user_msg=%r -> %s", user_msg[:50], "complex" if is_complex else "simple")
        return (is_complex, content) if return_raw else is_complex

    except Exception:
        logger.warning("复杂度判断失败，默认简单", exc_info=True)
        return (False, "") if return_raw else False
