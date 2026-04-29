from __future__ import annotations

import json
from typing import Any

import requests

from app.settings import get_settings

OPENAI_BASE_URL = "https://api.openai.com/v1"


def call_openai_json(system: str, user: dict[str, Any], schema: dict[str, Any], schema_name: str) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.openai_api_key:
        return None

    response = requests.post(
        f"{OPENAI_BASE_URL}/responses",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.openai_model,
            "input": [
                {"role": "system", "content": [{"type": "input_text", "text": system}]},
                {"role": "user", "content": [{"type": "input_text", "text": json.dumps(user)}]},
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "schema": schema,
                    "strict": True,
                }
            },
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    output_text = data.get("output_text") or ""

    if not output_text:
        chunks: list[str] = []
        for item in data.get("output", []):
            for part in item.get("content", []):
                if part.get("text"):
                    chunks.append(part["text"])
        output_text = "\n".join(chunks)

    return json.loads(output_text) if output_text else None


def embed_texts(texts: list[str]) -> list[list[float]] | None:
    settings = get_settings()
    if not settings.openai_api_key or not texts:
        return None

    response = requests.post(
        f"{OPENAI_BASE_URL}/embeddings",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.openai_embedding_model,
            "input": [text[:8000] for text in texts],
        },
        timeout=45,
    )
    if not response.ok:
        return None
    data = response.json().get("data", [])
    embeddings = [item.get("embedding", []) for item in data]
    return embeddings if len(embeddings) == len(texts) else None
