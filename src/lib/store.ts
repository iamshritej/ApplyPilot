import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  ApplicationRecord,
  DownloadLog,
  PublicResume,
  ResumeKind,
  ResumeMetadata,
  ResumeRecord
} from "@/lib/types";

type DatabaseShape = {
  resumes: ResumeRecord[];
  applications: ApplicationRecord[];
  downloadLogs: DownloadLog[];
};

type ResumeRow = {
  id: string;
  kind: ResumeKind;
  parent_id: string | null;
  version: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  storage_path: string;
  text_content: string;
  keywords: string[];
  metadata: ResumeMetadata | null;
  created_at: string;
  updated_at: string;
};

type ApplicationRow = {
  id: string;
  job_title: string;
  company_name: string;
  resume_id: string;
  optimized_resume_id: string | null;
  applied_at: string;
};

type DownloadLogRow = {
  id: string;
  resume_id: string;
  file_name: string;
  downloaded_at: string;
};

const dataDir = path.join(process.cwd(), ".data");
const storageDir = path.join(dataDir, "storage");
const dbPath = path.join(dataDir, "db.json");

let supabase: SupabaseClient | null = null;

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getBucketName() {
  return process.env.SUPABASE_BUCKET || "resumes";
}

function getSupabase() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: {
          persistSession: false
        }
      }
    );
  }

  return supabase;
}

async function ensureLocalDb() {
  await fs.mkdir(storageDir, { recursive: true });

  try {
    await fs.access(dbPath);
  } catch {
    const empty: DatabaseShape = {
      resumes: [],
      applications: [],
      downloadLogs: []
    };
    await fs.writeFile(dbPath, JSON.stringify(empty, null, 2));
  }
}

async function readLocalDb(): Promise<DatabaseShape> {
  await ensureLocalDb();
  const raw = await fs.readFile(dbPath, "utf8");
  return JSON.parse(raw) as DatabaseShape;
}

async function writeLocalDb(db: DatabaseShape) {
  await ensureLocalDb();
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

function resumeFromRow(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    kind: row.kind,
    parentId: row.parent_id ?? undefined,
    version: row.version,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    size: row.size,
    storagePath: row.storage_path,
    text: row.text_content,
    keywords: row.keywords ?? [],
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function resumeToRow(record: ResumeRecord): ResumeRow {
  return {
    id: record.id,
    kind: record.kind,
    parent_id: record.parentId ?? null,
    version: record.version,
    original_name: record.originalName,
    stored_name: record.storedName,
    mime_type: record.mimeType,
    size: record.size,
    storage_path: record.storagePath,
    text_content: record.text,
    keywords: record.keywords,
    metadata: record.metadata ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function applicationFromRow(row: ApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    jobTitle: row.job_title,
    companyName: row.company_name,
    resumeId: row.resume_id,
    optimizedResumeId: row.optimized_resume_id ?? undefined,
    appliedAt: row.applied_at
  };
}

function applicationToRow(record: ApplicationRecord): ApplicationRow {
  return {
    id: record.id,
    job_title: record.jobTitle,
    company_name: record.companyName,
    resume_id: record.resumeId,
    optimized_resume_id: record.optimizedResumeId ?? null,
    applied_at: record.appliedAt
  };
}

function downloadLogFromRow(row: DownloadLogRow): DownloadLog {
  return {
    id: row.id,
    resumeId: row.resume_id,
    fileName: row.file_name,
    downloadedAt: row.downloaded_at
  };
}

function downloadLogToRow(record: DownloadLog): DownloadLogRow {
  return {
    id: record.id,
    resume_id: record.resumeId,
    file_name: record.fileName,
    downloaded_at: record.downloadedAt
  };
}

export function toPublicResume(resume: ResumeRecord): PublicResume {
  return {
    id: resume.id,
    kind: resume.kind,
    parentId: resume.parentId,
    version: resume.version,
    originalName: resume.originalName,
    storedName: resume.storedName,
    mimeType: resume.mimeType,
    size: resume.size,
    keywords: resume.keywords,
    metadata: resume.metadata,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
    previewUrl: `/api/resumes/${resume.id}/preview`,
    downloadUrl: `/api/resumes/${resume.id}/download`
  };
}

export async function listResumes() {
  const client = getSupabase();
  if (client) {
    const { data, error } = await client
      .from("resumes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as ResumeRow[]).map(resumeFromRow);
  }

  const db = await readLocalDb();
  return [...db.resumes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getResumeById(id: string) {
  const client = getSupabase();
  if (client) {
    const { data, error } = await client.from("resumes").select("*").eq("id", id).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? resumeFromRow(data as ResumeRow) : null;
  }

  const db = await readLocalDb();
  return db.resumes.find((resume) => resume.id === id) ?? null;
}

export async function getNextVersion(parentId: string) {
  const resumes = await listResumes();
  const versions = resumes
    .filter((resume) => resume.parentId === parentId || resume.id === parentId)
    .map((resume) => resume.version);

  return Math.max(1, ...versions) + 1;
}

export async function saveResumeFile(input: {
  kind: ResumeKind;
  parentId?: string;
  version?: number;
  originalName: string;
  mimeType: string;
  text: string;
  keywords: string[];
  metadata?: ResumeMetadata;
  data: Buffer;
}) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const extension = path.extname(input.originalName) || fileExtensionFromMime(input.mimeType);
  const storedName = `${id}${extension}`;
  const storagePath = `${input.kind}/${storedName}`;

  const record: ResumeRecord = {
    id,
    kind: input.kind,
    parentId: input.parentId,
    version: input.version ?? 1,
    originalName: input.originalName,
    storedName,
    mimeType: input.mimeType,
    size: input.data.byteLength,
    storagePath,
    text: input.text,
    keywords: input.keywords,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now
  };

  const client = getSupabase();
  if (client) {
    const { error: storageError } = await client.storage
      .from(getBucketName())
      .upload(storagePath, input.data, {
        contentType: input.mimeType,
        upsert: false
      });

    if (storageError) {
      throw new Error(storageError.message);
    }

    const { error } = await client.from("resumes").insert(resumeToRow(record));
    if (error) {
      throw new Error(error.message);
    }

    return record;
  }

  await ensureLocalDb();
  await fs.mkdir(path.dirname(path.join(storageDir, storagePath)), { recursive: true });
  await fs.writeFile(path.join(storageDir, storagePath), input.data);

  const db = await readLocalDb();
  db.resumes.push(record);
  await writeLocalDb(db);

  return record;
}

export async function readResumeFile(resume: ResumeRecord) {
  const client = getSupabase();
  if (client) {
    const { data, error } = await client.storage.from(getBucketName()).download(resume.storagePath);
    if (error) {
      throw new Error(error.message);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  return fs.readFile(path.join(storageDir, resume.storagePath));
}

export async function listApplications() {
  const client = getSupabase();
  if (client) {
    const { data, error } = await client
      .from("applications")
      .select("*")
      .order("applied_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as ApplicationRow[]).map(applicationFromRow);
  }

  const db = await readLocalDb();
  return [...db.applications].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}

export async function createApplication(input: {
  jobTitle: string;
  companyName: string;
  resumeId: string;
  optimizedResumeId?: string;
}) {
  const record: ApplicationRecord = {
    id: randomUUID(),
    jobTitle: input.jobTitle,
    companyName: input.companyName,
    resumeId: input.resumeId,
    optimizedResumeId: input.optimizedResumeId,
    appliedAt: new Date().toISOString()
  };

  const client = getSupabase();
  if (client) {
    const { error } = await client.from("applications").insert(applicationToRow(record));
    if (error) {
      throw new Error(error.message);
    }
    return record;
  }

  const db = await readLocalDb();
  db.applications.push(record);
  await writeLocalDb(db);

  return record;
}

export async function createDownloadLog(input: { resumeId: string; fileName: string }) {
  const record: DownloadLog = {
    id: randomUUID(),
    resumeId: input.resumeId,
    fileName: input.fileName,
    downloadedAt: new Date().toISOString()
  };

  const client = getSupabase();
  if (client) {
    const { error } = await client.from("download_logs").insert(downloadLogToRow(record));
    if (error) {
      throw new Error(error.message);
    }
    return record;
  }

  const db = await readLocalDb();
  db.downloadLogs.push(record);
  await writeLocalDb(db);
  return record;
}

export async function listDownloadLogs() {
  const client = getSupabase();
  if (client) {
    const { data, error } = await client
      .from("download_logs")
      .select("*")
      .order("downloaded_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(error.message);
    }

    return (data as DownloadLogRow[]).map(downloadLogFromRow);
  }

  const db = await readLocalDb();
  return [...db.downloadLogs].sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt)).slice(0, 50);
}

function fileExtensionFromMime(mimeType: string) {
  if (mimeType.includes("pdf")) {
    return ".pdf";
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return ".docx";
  }
  return ".bin";
}
