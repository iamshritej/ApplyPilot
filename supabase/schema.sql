create table if not exists public.resumes (
  id text primary key,
  kind text not null check (kind in ('original', 'optimized')),
  parent_id text references public.resumes(id) on delete set null,
  version integer not null default 1,
  original_name text not null,
  stored_name text not null,
  mime_type text not null,
  size bigint not null,
  storage_path text not null,
  text_content text not null,
  keywords text[] not null default '{}',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id text primary key,
  job_title text not null,
  company_name text not null,
  resume_id text not null references public.resumes(id) on delete cascade,
  optimized_resume_id text references public.resumes(id) on delete set null,
  applied_at timestamptz not null default now()
);

create table if not exists public.download_logs (
  id text primary key,
  resume_id text not null references public.resumes(id) on delete cascade,
  file_name text not null,
  downloaded_at timestamptz not null default now()
);

create index if not exists resumes_parent_id_idx on public.resumes(parent_id);
create index if not exists applications_applied_at_idx on public.applications(applied_at desc);
create index if not exists download_logs_downloaded_at_idx on public.download_logs(downloaded_at desc);

-- Create a private storage bucket named "resumes" in Supabase Storage.
-- The service role key used by the Next.js API routes can upload and download files.
