from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.database import (
    create_application,
    create_download_log,
    ensure_database,
    get_resume,
    list_applications,
    list_download_logs,
    list_resumes,
    next_version,
    resume_file_path,
    save_resume,
)
from app.documents import create_optimized_pdf, extract_resume_text
from app.keywords import extract_keywords, format_bytes, infer_job_details
from app.matching import rank_resumes
from app.optimizer import career_advice, optimize_resume

app = FastAPI(title="ApplyPilot", version="2.0.0")
templates = Jinja2Templates(directory="templates")
templates.env.filters["bytes"] = format_bytes
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.on_event("startup")
def startup() -> None:
    ensure_database()


def dashboard_context(
    request: Request,
    *,
    notice: str = "",
    jd: str = "",
    job_title: str = "",
    company_name: str = "",
    matches: list[dict[str, Any]] | None = None,
    advice: dict[str, Any] | None = None,
    optimized: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ensure_database()
    resumes = list_resumes()
    applications = list_applications()
    download_logs = list_download_logs()
    resume_names = {resume["id"]: resume["original_name"] for resume in resumes}

    return {
        "request": request,
        "notice": notice,
        "resumes": resumes,
        "applications": applications,
        "download_logs": download_logs,
        "resume_names": resume_names,
        "jd": jd,
        "job_title": job_title,
        "company_name": company_name,
        "matches": matches or [],
        "best_score": (matches or [{}])[0].get("score", "-") if matches else "-",
        "advice": advice,
        "optimized": optimized,
        "optimized_count": len([resume for resume in resumes if resume["kind"] == "optimized"]),
    }


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("dashboard.html", dashboard_context(request))


@app.post("/resumes")
async def upload_resumes(files: list[UploadFile] = File(...)) -> RedirectResponse:
    ensure_database()
    for uploaded in files:
        content = await uploaded.read()
        if not content:
            continue
        mime_type = uploaded.content_type or "application/octet-stream"
        text = extract_resume_text(content, uploaded.filename or "resume", mime_type)
        save_resume(
            kind="original",
            original_name=uploaded.filename or "resume",
            mime_type=mime_type,
            content=content,
            text=text,
            keywords=extract_keywords(text, 45),
        )
    return RedirectResponse("/", status_code=303)


@app.post("/analyze", response_class=HTMLResponse)
def analyze(
    request: Request,
    jd: str = Form(...),
    job_title: str = Form(""),
    company_name: str = Form(""),
) -> HTMLResponse:
    jd = jd.strip()
    if not jd:
        return templates.TemplateResponse("dashboard.html", dashboard_context(request, notice="Paste a job description first."))

    resumes = list_resumes()
    matches = rank_resumes(jd, resumes) if resumes else []
    best_resume = get_resume(matches[0]["resume_id"]) if matches else (resumes[0] if resumes else None)
    advice = career_advice(jd, best_resume, matches[0] if matches else None)
    details = infer_job_details(jd)

    return templates.TemplateResponse(
        "dashboard.html",
        dashboard_context(
            request,
            jd=jd,
            job_title=job_title.strip() or details["job_title"],
            company_name=company_name.strip() or details["company_name"],
            matches=matches,
            advice=advice,
        ),
    )


@app.post("/optimize", response_class=HTMLResponse)
def optimize(
    request: Request,
    resume_id: str = Form(...),
    jd: str = Form(...),
    job_title: str = Form(""),
    company_name: str = Form(""),
) -> HTMLResponse:
    resume = get_resume(resume_id)
    if not resume:
        return templates.TemplateResponse("dashboard.html", dashboard_context(request, notice="Resume not found."))

    match = rank_resumes(jd, [resume])[0]
    optimization = optimize_resume(resume, jd, match, job_title, company_name)
    version = next_version(resume["id"])
    base_name = Path(resume["original_name"]).stem
    output_name = f"{base_name}-optimized-v{version}.pdf"
    pdf = create_optimized_pdf(
        title=base_name,
        subtitle=f"{optimization['job_title']} | {optimization['company_name']}",
        body=optimization["optimized_text"],
    )
    optimized_resume = save_resume(
        kind="optimized",
        parent_id=resume["id"],
        version=version,
        original_name=output_name,
        mime_type="application/pdf",
        content=pdf,
        text=optimization["optimized_text"],
        keywords=extract_keywords(optimization["optimized_text"], 45),
        metadata={
            "source_resume_id": resume["id"],
            "job_title": optimization["job_title"],
            "company_name": optimization["company_name"],
            "summary": optimization["summary"],
        },
    )
    advice = career_advice(jd, resume, match)

    return templates.TemplateResponse(
        "dashboard.html",
        dashboard_context(
            request,
            notice="Optimized resume generated.",
            jd=jd,
            job_title=optimization["job_title"],
            company_name=optimization["company_name"],
            matches=[match],
            advice=advice,
            optimized={"resume": optimized_resume, "optimization": optimization, "source_resume_id": resume["id"]},
        ),
    )


@app.post("/applications", response_class=HTMLResponse)
def save_application(
    request: Request,
    job_title: str = Form(...),
    company_name: str = Form(...),
    resume_id: str = Form(...),
    optimized_resume_id: str = Form(""),
) -> HTMLResponse:
    create_application(job_title.strip(), company_name.strip(), resume_id, optimized_resume_id or None)
    return templates.TemplateResponse("dashboard.html", dashboard_context(request, notice="Application saved."))


@app.post("/applications/skip", response_class=HTMLResponse)
def skip_application(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("dashboard.html", dashboard_context(request, notice="No application saved."))


@app.get("/resumes/{resume_id}/preview")
def preview_resume(request: Request, resume_id: str) -> Response:
    resume = get_resume(resume_id)
    if not resume:
        return Response("Resume not found.", status_code=404)

    path = resume_file_path(resume)
    if resume["mime_type"] == "application/pdf":
        return FileResponse(path, media_type="application/pdf", filename=resume["original_name"])

    return templates.TemplateResponse("preview.html", {"request": request, "resume": resume})


@app.get("/resumes/{resume_id}/download")
def download_resume(resume_id: str) -> Response:
    resume = get_resume(resume_id)
    if not resume:
        return Response("Resume not found.", status_code=404)
    create_download_log(resume["id"], resume["original_name"])
    return FileResponse(resume_file_path(resume), media_type=resume["mime_type"], filename=resume["original_name"])
