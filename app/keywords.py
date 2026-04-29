from __future__ import annotations

import re
from collections import Counter

STOPWORDS = {
    "a",
    "about",
    "above",
    "after",
    "all",
    "also",
    "an",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "been",
    "being",
    "by",
    "can",
    "candidate",
    "company",
    "do",
    "does",
    "for",
    "from",
    "has",
    "have",
    "in",
    "into",
    "is",
    "it",
    "job",
    "more",
    "most",
    "must",
    "of",
    "on",
    "or",
    "our",
    "role",
    "that",
    "the",
    "their",
    "this",
    "to",
    "we",
    "with",
    "work",
    "you",
    "your",
}

SKILL_TERMS = [
    "accessibility",
    "agile",
    "airflow",
    "analytics",
    "api",
    "aws",
    "azure",
    "backend",
    "cloud",
    "communication",
    "css",
    "data analysis",
    "data engineering",
    "devops",
    "docker",
    "fastapi",
    "frontend",
    "gcp",
    "graphql",
    "html",
    "javascript",
    "kubernetes",
    "llm",
    "machine learning",
    "next.js",
    "node.js",
    "openai",
    "postgresql",
    "product design",
    "python",
    "react",
    "sql",
    "stakeholder management",
    "typescript",
    "ui/ux",
]


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#./\s-]", " ", value.lower())).strip()


def tokenize(value: str) -> list[str]:
    return [token for token in normalize_text(value).split() if len(token) > 2 and token not in STOPWORDS]


def extract_keywords(value: str, limit: int = 35) -> list[str]:
    normalized = normalize_text(value)
    counts = Counter(tokenize(normalized))

    for term in SKILL_TERMS:
        if term in normalized:
            counts[term] += 5

    return [term for term, _ in counts.most_common(limit)]


def infer_job_details(jd: str) -> dict[str, str]:
    lines = [line.strip() for line in jd.splitlines() if line.strip()][:20]
    job_title = ""
    company_name = ""

    for line in lines:
        title_match = re.search(r"(?:job\s*title|title|role)\s*[:\-]\s*(.+)$", line, flags=re.I)
        company_match = re.search(r"(?:company|organization|employer)\s*[:\-]\s*(.+)$", line, flags=re.I)
        if title_match and not job_title:
            job_title = title_match.group(1).strip()
        if company_match and not company_name:
            company_name = company_match.group(1).strip()

    if not job_title and lines:
        job_title = re.sub(r"^we are hiring\s*", "", lines[0], flags=re.I)[:80]

    return {
        "job_title": job_title or "Target Role",
        "company_name": company_name or "Target Company",
    }


def format_bytes(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"
