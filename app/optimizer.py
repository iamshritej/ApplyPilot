from __future__ import annotations

from typing import Any

from app.ai import call_openai_json
from app.keywords import extract_keywords, infer_job_details

OPTIMIZATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["optimized_text", "summary", "added_keywords", "improved_bullets", "job_title", "company_name"],
    "properties": {
        "optimized_text": {"type": "string"},
        "summary": {"type": "string"},
        "added_keywords": {"type": "array", "items": {"type": "string"}},
        "improved_bullets": {"type": "array", "items": {"type": "string"}},
        "job_title": {"type": "string"},
        "company_name": {"type": "string"},
    },
}

ADVICE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["should_apply", "reasoning", "growth_potential_score", "skill_gap_analysis", "suggested_focus"],
    "properties": {
        "should_apply": {"type": "boolean"},
        "reasoning": {"type": "string"},
        "growth_potential_score": {"type": "number"},
        "skill_gap_analysis": {"type": "array", "items": {"type": "string"}},
        "suggested_focus": {"type": "array", "items": {"type": "string"}},
    },
}


def optimize_resume(resume: dict[str, Any], jd: str, match: dict[str, Any] | None, job_title: str, company_name: str) -> dict[str, Any]:
    details = infer_job_details(jd)
    title = job_title.strip() or details["job_title"]
    company = company_name.strip() or details["company_name"]
    missing_keywords = (match or {}).get("missing_keywords") or missing_keywords_for(jd, resume["text"])

    try:
        ai_result = call_openai_json(
            system=(
                "You are an expert ATS resume editor. Edit only resume text content. "
                "Keep the source resume section order and bullet style as much as plain text allows. "
                "Do not invent employers, credentials, dates, degrees, tools, or metrics. "
                "Keep the result concise enough for one page, around 450 to 650 words. Return JSON only."
            ),
            user={
                "job_title": title,
                "company_name": company,
                "job_description": jd,
                "current_resume_text": resume["text"],
                "missing_keywords": missing_keywords,
                "rules": [
                    "ATS-friendly",
                    "one page only",
                    "preserve section order",
                    "preserve bullet style",
                    "modify text only",
                ],
            },
            schema=OPTIMIZATION_SCHEMA,
            schema_name="optimized_resume",
        )
    except Exception:
        ai_result = None

    if ai_result and ai_result.get("optimized_text"):
        ai_result["optimized_text"] = trim_to_one_page(ai_result["optimized_text"])
        ai_result["job_title"] = title
        ai_result["company_name"] = company
        return ai_result

    return fallback_optimization(resume["text"], missing_keywords, title, company)


def career_advice(jd: str, resume: dict[str, Any] | None, match: dict[str, Any] | None) -> dict[str, Any]:
    resume_text = resume["text"] if resume else ""
    jd_keywords = extract_keywords(jd, 35)
    resume_keywords = extract_keywords(resume_text, 35)
    missing = [keyword for keyword in jd_keywords if keyword not in resume_keywords][:8]
    score = (match or {}).get("score", max(35, 86 - len(missing) * 7))

    try:
        ai_result = call_openai_json(
            system="You are a practical career advisor. Be direct, realistic, concise, and return JSON only.",
            user={
                "job_description": jd,
                "resume_text": resume_text,
                "match_score": score,
                "missing_keywords": missing,
            },
            schema=ADVICE_SCHEMA,
            schema_name="career_advice",
        )
    except Exception:
        ai_result = None

    if ai_result:
        ai_result["growth_potential_score"] = clamp_score(ai_result["growth_potential_score"])
        return ai_result

    return {
        "should_apply": score >= 58,
        "reasoning": (
            "The resume already overlaps with the JD on core responsibilities and keywords."
            if score >= 72
            else "The role is reachable with targeted resume optimization."
            if score >= 58
            else "The JD shows several gaps that may weaken the application."
        ),
        "growth_potential_score": clamp_score(score + min(12, len(missing) * 2)),
        "skill_gap_analysis": [f"Make {keyword} visible if you have real experience." for keyword in missing]
        or ["No major keyword gaps detected."],
        "suggested_focus": missing[:4],
    }


def fallback_optimization(text: str, missing_keywords: list[str], job_title: str, company_name: str) -> dict[str, Any]:
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    keywords = missing_keywords[:8]
    keyword_index = 0
    improved: list[str] = []
    improved_bullets: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith(("-", "*", "•")) and keyword_index < len(keywords) and len(stripped) < 180:
            keyword = keywords[keyword_index]
            keyword_index += 1
            new_line = f"{stripped}; aligned work with {keyword}"
            improved.append(new_line)
            improved_bullets.append(keyword)
        else:
            improved.append(line)

    if keyword_index < len(keywords):
        improved.append("CORE KEYWORDS")
        improved.append(" | ".join(keywords[keyword_index:]))

    return {
        "optimized_text": trim_to_one_page("\n".join(improved)),
        "summary": f"Optimized toward {job_title} at {company_name} with targeted JD language.",
        "added_keywords": keywords,
        "improved_bullets": improved_bullets,
        "job_title": job_title,
        "company_name": company_name,
    }


def missing_keywords_for(jd: str, resume_text: str) -> list[str]:
    resume_keywords = set(extract_keywords(resume_text, 45))
    return [keyword for keyword in extract_keywords(jd, 35) if keyword not in resume_keywords][:12]


def trim_to_one_page(text: str) -> str:
    words = text.replace("\n", " \n ").split()
    if len(words) <= 680:
        return text.strip()
    return " ".join(words[:680]).strip()


def clamp_score(value: float) -> int:
    return max(0, min(100, round(float(value))))
