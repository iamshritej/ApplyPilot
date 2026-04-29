from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database_path: Path
    storage_dir: Path
    openai_api_key: str | None
    openai_model: str
    openai_embedding_model: str


def get_settings() -> Settings:
    return Settings(
        database_path=Path(os.getenv("APP_DATABASE_PATH", ".data/applypilot.sqlite3")),
        storage_dir=Path(os.getenv("APP_STORAGE_DIR", ".data/storage")),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-5.2"),
        openai_embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
    )
