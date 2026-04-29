# ApplyPilot

ApplyPilot is a Python-only MVP for managing and optimizing job applications with AI. It uploads PDF/DOCX resumes, extracts resume text, ranks every resume against a pasted job description, generates a one-page optimized PDF version, asks whether the user applied, tracks applications, and provides career advice.

No Java, JavaScript, TypeScript, React, or Node runtime is required.

## Stack

- Python 3.11+
- FastAPI
- Jinja2 server-rendered templates
- SQLite
- Plain HTML and CSS
- ReportLab for optimized one-page PDF generation
- pypdf and python-docx for resume text extraction
- Optional OpenAI API calls through Python `requests`

## Local Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000`.

On macOS or Linux, activate the virtual environment with:

```bash
source .venv/bin/activate
```

## Environment Variables

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
APP_DATABASE_PATH=.data/applypilot.sqlite3
APP_STORAGE_DIR=.data/storage
```

If `OPENAI_API_KEY` is not set, ApplyPilot still works with local keyword extraction, TF-style cosine scoring, heuristic resume optimization, and deterministic career advice.

## Features

- Upload multiple PDF/DOCX resumes
- Store resumes in SQLite and local file storage
- Preview and download each resume
- Paste a job description
- Rank resumes by keyword, skills, role relevance, and optional embeddings
- Generate an optimized one-page PDF resume
- Save optimized versions as resume history
- Ask whether the user applied
- Track job title, company, date/time, and resume used
- Show AI career advice with apply recommendation, reasoning, growth potential, and skill gaps
- Mobile-first dashboard layout

## Deployment

This app can be deployed on Python-friendly hosts such as Render, Railway, Fly.io, or a VPS.

Typical start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

For production, attach persistent disk storage for `.data/` or point `APP_DATABASE_PATH` and `APP_STORAGE_DIR` to a mounted volume.

## Resume Optimization Note

The optimizer edits extracted resume text and generates a new one-page PDF. It preserves the logical structure and keeps the output ATS-friendly. Exact binary-level preservation of arbitrary uploaded PDF/DOCX typography is not guaranteed without a dedicated document editing engine, but the generated version is constrained to a clean one-page resume.
