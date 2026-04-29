from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from app.settings import get_settings


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_database() -> None:
    settings = get_settings()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)

    with connect() as db:
        db.executescript(
            """
            create table if not exists resumes (
              id text primary key,
              kind text not null,
              parent_id text,
              version integer not null,
              original_name text not null,
              stored_name text not null,
              mime_type text not null,
              size integer not null,
              storage_path text not null,
              text_content text not null,
              keywords text not null,
              metadata text,
              created_at text not null,
              updated_at text not null
            );

            create table if not exists applications (
              id text primary key,
              job_title text not null,
              company_name text not null,
              resume_id text not null,
              optimized_resume_id text,
              applied_at text not null
            );

            create table if not exists download_logs (
              id text primary key,
              resume_id text not null,
              file_name text not null,
              downloaded_at text not null
            );
            """
        )


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    settings = get_settings()
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_resume(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "kind": row["kind"],
        "parent_id": row["parent_id"],
        "version": row["version"],
        "original_name": row["original_name"],
        "stored_name": row["stored_name"],
        "mime_type": row["mime_type"],
        "size": row["size"],
        "storage_path": row["storage_path"],
        "text": row["text_content"],
        "keywords": json.loads(row["keywords"] or "[]"),
        "metadata": json.loads(row["metadata"] or "{}"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_resumes() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute("select * from resumes order by created_at desc").fetchall()
    return [row_to_resume(row) for row in rows]


def get_resume(resume_id: str) -> dict[str, Any] | None:
    with connect() as db:
        row = db.execute("select * from resumes where id = ?", (resume_id,)).fetchone()
    return row_to_resume(row) if row else None


def next_version(parent_id: str) -> int:
    with connect() as db:
        rows = db.execute(
            "select version from resumes where id = ? or parent_id = ?",
            (parent_id, parent_id),
        ).fetchall()
    versions = [row["version"] for row in rows] or [1]
    return max(versions) + 1


def save_resume(
    *,
    kind: str,
    original_name: str,
    mime_type: str,
    content: bytes,
    text: str,
    keywords: list[str],
    parent_id: str | None = None,
    version: int = 1,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    resume_id = str(uuid.uuid4())
    ext = Path(original_name).suffix or ".bin"
    stored_name = f"{resume_id}{ext}"
    storage_path = Path(kind) / stored_name
    full_path = settings.storage_dir / storage_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(content)

    now = utc_now()
    with connect() as db:
        db.execute(
            """
            insert into resumes (
              id, kind, parent_id, version, original_name, stored_name, mime_type,
              size, storage_path, text_content, keywords, metadata, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                resume_id,
                kind,
                parent_id,
                version,
                original_name,
                stored_name,
                mime_type,
                len(content),
                str(storage_path).replace("\\", "/"),
                text,
                json.dumps(keywords),
                json.dumps(metadata or {}),
                now,
                now,
            ),
        )

    return get_resume(resume_id) or {}


def resume_file_path(resume: dict[str, Any]) -> Path:
    return get_settings().storage_dir / resume["storage_path"]


def list_applications() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute("select * from applications order by applied_at desc").fetchall()
    return [dict(row) for row in rows]


def create_application(job_title: str, company_name: str, resume_id: str, optimized_resume_id: str | None) -> dict[str, Any]:
    application_id = str(uuid.uuid4())
    applied_at = utc_now()
    with connect() as db:
        db.execute(
            """
            insert into applications (id, job_title, company_name, resume_id, optimized_resume_id, applied_at)
            values (?, ?, ?, ?, ?, ?)
            """,
            (application_id, job_title, company_name, resume_id, optimized_resume_id, applied_at),
        )
    return {
        "id": application_id,
        "job_title": job_title,
        "company_name": company_name,
        "resume_id": resume_id,
        "optimized_resume_id": optimized_resume_id,
        "applied_at": applied_at,
    }


def create_download_log(resume_id: str, file_name: str) -> None:
    with connect() as db:
        db.execute(
            "insert into download_logs (id, resume_id, file_name, downloaded_at) values (?, ?, ?, ?)",
            (str(uuid.uuid4()), resume_id, file_name, utc_now()),
        )


def list_download_logs(limit: int = 50) -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute(
            "select * from download_logs order by downloaded_at desc limit ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]
