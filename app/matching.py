from __future__ import annotations

import math
from collections import Counter
from typing import Any

from app.ai import embed_texts
from app.keywords import extract_keywords, infer_job_details, tokenize


def rank_resumes(jd: str, resumes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    jd_keywords = extract_keywords(jd, 45)
    embeddings = None
    try:
        embeddings = embed_texts([jd] + [resume["text"] for resume in resumes])
    except Exception:
        embeddings = None

    jd_embedding = embeddings[0] if embeddings else None
    resume_embeddings = embeddings[1:] if embeddings else []
    details = infer_job_details(jd)

    matches: list[dict[str, Any]] = []
    for index, resume in enumerate(resumes):
        resume_keywords = resume.get("keywords") or extract_keywords(resume["text"], 45)
        resume_keyword_set = set(resume_keywords)
        matched = [keyword for keyword in jd_keywords if keyword in resume_keyword_set][:18]
        missing = [keyword for keyword in jd_keywords if keyword not in resume_keyword_set][:12]

        keyword_score = len(matched) / len(jd_keywords) if jd_keywords else 0
        skills_score = skill_score(jd_keywords, resume_keywords)
        role_score_value = role_score(details["job_title"], resume["text"])
        semantic_score = (
            cosine(jd_embedding, resume_embeddings[index])
            if jd_embedding and index < len(resume_embeddings)
            else lexical_similarity(jd, resume["text"])
        )

        blended = clamp(semantic_score * 0.42 + keyword_score * 0.28 + skills_score * 0.2 + role_score_value * 0.1)
        matches.append(
            {
                "resume_id": resume["id"],
                "resume_name": resume["original_name"],
                "score": round(blended * 100),
                "skills_score": round(skills_score * 100),
                "keyword_score": round(keyword_score * 100),
                "role_score": round(role_score_value * 100),
                "semantic_score": round(semantic_score * 100),
                "matched_keywords": matched,
                "missing_keywords": missing,
                "rationale": rationale(blended, matched, missing, resume["kind"]),
            }
        )

    return sorted(matches, key=lambda item: item["score"], reverse=True)


def skill_score(jd_keywords: list[str], resume_keywords: list[str]) -> float:
    skill_terms = [keyword for keyword in jd_keywords if "." in keyword or len(keyword) > 3]
    if not skill_terms:
        return 0
    resume_set = set(resume_keywords)
    return len([keyword for keyword in skill_terms if keyword in resume_set]) / len(skill_terms)


def role_score(job_title: str, resume_text: str) -> float:
    role_tokens = tokenize(job_title)
    if not role_tokens:
        return 0.5
    resume_tokens = set(tokenize(resume_text))
    return len([token for token in role_tokens if token in resume_tokens]) / len(role_tokens)


def lexical_similarity(a: str, b: str) -> float:
    vector_a = Counter(tokenize(a))
    vector_b = Counter(tokenize(b))
    terms = set(vector_a) | set(vector_b)
    dot = sum(vector_a[term] * vector_b[term] for term in terms)
    mag_a = math.sqrt(sum(value * value for value in vector_a.values()))
    mag_b = math.sqrt(sum(value * value for value in vector_b.values()))
    return dot / (mag_a * mag_b) if mag_a and mag_b else 0


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0
    dot = sum(left * right for left, right in zip(a, b))
    mag_a = math.sqrt(sum(value * value for value in a))
    mag_b = math.sqrt(sum(value * value for value in b))
    return clamp(dot / (mag_a * mag_b)) if mag_a and mag_b else 0


def rationale(score: float, matched: list[str], missing: list[str], kind: str) -> str:
    if score >= 0.75:
        return f"Strong {kind} resume match with {len(matched)} JD keywords already visible."
    if score >= 0.55:
        targets = ", ".join(missing[:3]) or "targeted keywords"
        return f"Usable match. Optimization should emphasize {targets}."
    targets = ", ".join(missing[:4]) or "skills not visible in this resume"
    return f"Lower fit. The JD calls for {targets}."


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))
