# ApplyPilot

ApplyPilot is a production-shaped MVP for managing job applications with AI. It uploads PDF/DOCX resumes, extracts text, ranks resumes against a pasted job description, generates a one-page optimized PDF version, tracks applications after the user confirms they applied, and provides career advice.

## Stack

- Next.js App Router with API routes
- React dashboard UI
- Local JSON database and file storage for development
- Optional Supabase Postgres and Supabase Storage for deployment
- OpenAI Responses API for resume optimization and advice when `OPENAI_API_KEY` is set
- OpenAI embeddings for semantic matching when `OPENAI_API_KEY` is set
- Deterministic local fallbacks when no AI key is configured

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Without Supabase variables, resumes and applications are stored in `.data/`. Without an OpenAI key, matching, advice, and optimization still work with local keyword and cosine-similarity logic.

## Environment Variables

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET=resumes
```

The default OpenAI text model follows the OpenAI Models documentation current at implementation time, where GPT-5.2 is listed as the featured frontier model. The app uses the Responses API because OpenAI positions it as the current interface for new model responses.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Create a private Storage bucket named `resumes`.
4. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_BUCKET=resumes` to `.env.local` and to Vercel.

## Deploy to Vercel

1. Push this project to GitHub.
2. Import it in Vercel as a Next.js project.
3. Add the environment variables above.
4. Deploy.

For real production usage, use Supabase mode. The local `.data/` fallback is intended for development and demos because serverless file systems are ephemeral.

## Resume Optimization Notes

The optimizer enforces text-only edits, ATS-friendly wording, and a one-page PDF output. For arbitrary uploaded PDFs, exact binary-level font/layout preservation is not generally possible from extracted text alone. In production, pair this workflow with editable DOCX templates or a document rendering service if exact source typography must be guaranteed across every resume format.
